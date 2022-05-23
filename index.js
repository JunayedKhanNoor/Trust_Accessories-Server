const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000;

const app = express();

app.use(cors());
app.use(express.json());

const uri = "mongodb+srv://trust_accessories:Mycz9sQGUp1n5VIv@cluster0.jmcvs.mongodb.net/?retryWrites=true&w=majority";
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).send({ message: "UnAuthorizes access" });
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
      //Add User to DB
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
      //get users
      app.get("/user", verifyJWT, async(req,res)=>{
          const users = await userCollection.find().toArray();
          res.send(users);
      })
      //make admin
      app.put("/user/admin/:email",verifyJWT,verifyAdmin, async(req,res)=>{
        const email = req.params.email;
        const filter = {email: email};
        const updateDoc = {
          $set:{role: "admin"},
        };
        const result = userCollection.updateOne(filter, updateDoc);
        res.send(result);
      })
       //isAdmin?
       app.get("/admin/:email", async (req, res) => {
        const email = req.params.email;
        const user = await userCollection.findOne({ email: email });
        const isAdmin = user.role === "admin";
        res.send({ admin: isAdmin });
      });
      //get all Accessories
      app.get("/accessories", async(req,res)=>{
          const accessories = await accessoriesCollection.find().toArray();
          res.send(accessories);
      })
      //get single accessory
      app.get("/accessory/:id", async(req,res)=>{
        const id = req.params.id;
        const query = { _id: ObjectId(id) };
        const accessory = await accessoriesCollection.findOne(query);
        res.send(accessory);
    })
    //set order and reduce quantity from stock
    app.post("/order/:id", async (req, res) => {
      const id = req.params.id;
      const filter = {_id: ObjectId(id)};
      const accessory = await accessoriesCollection.findOne(filter);
      const order = req.body;
      const query = {name:order.name, minOrder: { $lte: order.quantity }, quantity: { $gte: order.quantity }  }
      const exist = await accessoriesCollection.findOne(query);
      if (exist) {
        const result = await ordersCollection.insertOne(order);
        const available = accessory.quantity-order.quantity;
        const updateDoc = {
          $set: {
            quantity: available,
          }
        };
        const updatedAccessory = await accessoriesCollection.updateOne(filter, updateDoc);
        return res.send({ success: true, result,  updatedAccessory});
      }
      return res.send({ success: false, order: "Invalid Quantity" });
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
