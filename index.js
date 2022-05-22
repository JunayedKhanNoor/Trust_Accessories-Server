const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const { MongoClient, ServerApiVersion } = require('mongodb');
const port = process.env.PORT || 5000;

const app = express();

app.use(cors());
app.use(express.json());

const uri = "mongodb+srv://trust_accessories:Mycz9sQGUp1n5VIv@cluster0.jmcvs.mongodb.net/?retryWrites=true&w=majority";
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });


async function run() {
  try {
    await client.connect();
    const accessoriesCollection = client.db("trust_accessories").collection("accessories");
    const ordersCollection = client.db("trust_accessories").collection("orders");
    const userCollection = client.db("trust_accessories").collection("users");
    const paymentCollection = client.db("trust_accessories").collection("payments");

    const verifyAdmin = async (req, res, next) => {
        const requester = req.decoded.email;
        const requesterAccount = await userCollection.findOne({ email: requester });
        if (requesterAccount.role === "admin") {
          next();
        } else {
          res.status(403).send({ message: "Forbidden access" });
        }
      };
      app.put("/user/:email", async (req, res) => {
        const email = req.params.email;
        const user = req.body;
        const filter = { email: email };
        const options = { upsert: true };
        const updateDoc = {
          $set: user,
        };
        const result = await userCollection.updateOne(filter, updateDoc, options);
        const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, {
          expiresIn: "1d",
        });
        res.send({ result, token });
      });
  } finally {
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello from Trust Accessories");
});
app.listen(port, () => {
  console.log(`Trust Accessories app listening on port: ${port}`);
});
