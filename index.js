const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion } = require("mongodb");
const jwt = require("jsonwebtoken");

const app = express();

const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// verify jwt token:
// ei function er kaaj hocceh kono user jate amar servier side er data gula dekhte nah pare:

function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ message: "UnAuthorized access" });
  }
  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: "Forbidden access" });
    }
    req.decoded = decoded;
    next();
  });
}

// mongodb:

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.yxnod.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

async function run() {
  try {
    client.connect();
    const serviceCollection = client
      .db("docotrs_portal")
      .collection("services");

    const bookingCollection = client
      .db("docotrs_portal")
      .collection("bookings");

    const userCollection = client.db("docotrs_portal").collection("users");

    const doctorCollection = client.db("docotrs_portal").collection("doctors");

    app.get("/service", async (req, res) => {
      // .project diye shudu specific kore name field ti kei dekhabe amar server side er api teh:
      const cursor = serviceCollection.find({}).project({ name: 1 });
      const services = await cursor.toArray();
      res.send(services);
    });

    // get all the users:
    app.get("/user", verifyJWT, async (req, res) => {
      const result = await userCollection.find({}).toArray();
      res.send(result);
    });

    // check korbo user ti admin kina nicher ei get method diye:
    app.get("/admin/:email", async (req, res) => {
      const email = req.params.email;
      const user = await userCollection.findOne({ email: email });
      const isAdmin = user.role === "admin";
      res.send({ admin: isAdmin });
    });

    // kono user jate admin banate pare arekti user ke tar jonne ei put method ti:
    app.put("/user/admin/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      // kon user admin banabe seti thakbe requester er modde:
      const requester = req.decoded.email;
      const requesterAccount = await userCollection.findOne({
        email: requester,
      });
      if (requesterAccount.role === "admin") {
        const filter = { email: email };

        const updateDoc = {
          $set: { role: "admin" },
        };
        const result = await userCollection.updateOne(filter, updateDoc);

        res.send(result);
      } else {
        res.status(403).send({ message: "forbidden" });
      }
    });

    // for the signIn or googleSignIn users:
    app.put("/user/:email", async (req, res) => {
      const email = req.params.email;
      const filter = { email: email };
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          user: req.body,
        },
      };
      const result = await userCollection.updateOne(filter, updateDoc, options);

      // jokhon database e user ti jabe tokhon jate jwt token create kore:
      const token = jwt.sign(
        { email: email },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: "1h" }
      );

      res.send({ result, token: token });
    });

    // Warning: This is not the proper way to query multiple collection.
    // After learning more about mongodb. use aggregate, lookup, pipeline, match, group
    app.get("/available", async (req, res) => {
      // step 1:  get all services
      const services = await serviceCollection.find().toArray();

      // step 2: get the booking of that day. output: [{}, {}, {}, {}, {}, {}]
      const date = req.query.date;

      const query = { date: date };
      // eikhane suppose 31may teh kon kon service gula nitesi sob gula ekti array er moddeh thakbe:
      const bookings = await bookingCollection.find(query).toArray();

      // step 3: for each service(eikhane ami kon  service ti niechilam  31may teh seigula alada alada kora)
      services.forEach((service) => {
        // step 4: find bookings for that service. output: [{}, {}, {}, {}]
        const serviceBookings = bookings.filter(
          (book) => book.treatment === service.name
        );
        // step 5: select slots for the service Bookings: ['', '', '', '']
        const bookedSlots = serviceBookings.map((book) => book.slot);
        // step 6: select those slots that are not in bookedSlots
        const available = service.slots.filter(
          (slot) => !bookedSlots.includes(slot)
        );
        //step 7: set available to slots to make it easier
        service.slots = available;
      });

      res.send(services);
    });

    // for booking get api(dashboard er ui teh kon kon user kon kon bookings koreche tar jonne):

    app.get("/booking", verifyJWT, async (req, res) => {
      const patientEmail = req.query.patientEmail;
      const decodedEmail = req.decoded.email;
      if (patientEmail === decodedEmail) {
        const query = { patientEmail: patientEmail };
        const bookings = await bookingCollection.find(query).toArray();
        return res.send(bookings);
      } else {
        return res.status(403).send({ message: "forbidden access" });
      }
    });
    // for booking post:
    app.post("/booking", async (req, res) => {
      const booking = req.body;
      // user booking only one specific service per day:
      const query = {
        treatment: booking?.treatment,
        date: booking?.date,
        patientEmail: booking?.patientEmail,
      };

      const existingBookings = await bookingCollection.findOne(query);

      if (existingBookings) {
        return res.send({
          success: false,
          booking: existingBookings,
        });
      }

      const result = await bookingCollection.insertOne(booking);
      return res.send({ success: true, result });
    });

    // adding doctor to the database:
    app.post("/doctor", async (req, res) => {
      const doctor = req.body;
      const result = await doctorCollection.insertOne(doctor);
      res.send(result);
    });
  } finally {
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello from doctors portal!");
});

app.listen(port, () => {
  console.log(`Doctor portal is running the server ${port}`);
});
