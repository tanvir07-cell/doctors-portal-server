const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion } = require("mongodb");

const app = express();

const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

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

    app.get("/service", async (req, res) => {
      const cursor = serviceCollection.find({});
      const services = await cursor.toArray();
      res.send(services);
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

    // for booking get api:
    app.get("/booking", async (req, res) => {
      const patientEmail = req.query.patientEmail;
      const query = { patientEmail: patientEmail };
      const bookings = await bookingCollection.find(query).toArray();
      res.send(bookings);
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
