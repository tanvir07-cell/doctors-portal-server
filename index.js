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
