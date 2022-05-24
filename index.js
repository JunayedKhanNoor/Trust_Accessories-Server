const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 5000;

const app = express();

app.use(cors());
app.use(express.json());

const uri =
  "mongodb+srv://trust_accessories:Mycz9sQGUp1n5VIv@cluster0.jmcvs.mongodb.net/?retryWrites=true&w=majority";
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});
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
    app.get("/user", verifyJWT, async (req, res) => {
      const users = await userCollection.find().toArray();
      res.send(users);
    });
    //make admin
    app.put("/user/admin/:email", verifyJWT, verifyAdmin, async (req, res) => {
      const email = req.params.email;
      const filter = { email: email };
      const updateDoc = {
        $set: { role: "admin" },
      };
      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
    });
    //isAdmin?
    app.get("/admin/:email", async (req, res) => {
      const email = req.params.email;
      const user = await userCollection.findOne({ email: email });
      const isAdmin = user.role === "admin";
      res.send({ admin: isAdmin });
    });
    //get all Accessories
    app.get("/accessories", async (req, res) => {
      const accessories = await accessoriesCollection.find().toArray();
      res.send(accessories);
    });
    //Page Count for all orders
    app.get("/orderCount", async (req, res) => {
      const count = await ordersCollection.estimatedDocumentCount();
      res.send({ count });
    });
    //get orders by page number
    app.get("/ordersPage", async (req, res) => {
      const page = parseInt(req.query.page);
      const size = parseInt(req.query.size);
      const query = {};
      const cursor = ordersCollection.find(query);
      let accessories;
      if (page || size) {
        accessories = await cursor
          .skip(page * size)
          .limit(size)
          .toArray();
      } else {
        accessories = await cursor.toArray();
      }
      res.send(accessories);
    });
    //delete Accessory
    app.delete("/accessories/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const result = await accessoriesCollection.deleteOne(filter);
      res.send(result);
    });
    //get single accessory
    app.get("/accessories/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const accessory = await accessoriesCollection.findOne(query);
      res.send(accessory);
    });
    //Add accessory to database
    app.post("/accessories", verifyJWT, verifyAdmin, async (req, res) => {
      const accessory = req.body;
      const result = await accessoriesCollection.insertOne(accessory);
      res.send(result);
    });
    //delete accessory from database
    app.delete("/accessories/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const result = await accessoriesCollection.deleteOne(filter);
      res.send(result);
    });
    //get all orders for admin
    app.get("/orders", verifyJWT,verifyAdmin, async (req, res) => {
        const orders = await ordersCollection.find().toArray();
        return res.send(orders);
    });
    //set order and reduce quantity from stock
    app.post("/order/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const accessory = await accessoriesCollection.findOne(filter);
      const order = req.body;
      //const query = {name:order.name, minOrder: { $gte: order.quantity }, quantity: { $gte: order.quantity }  }
      //const exist = await accessoriesCollection.findOne(query);
      const result = await ordersCollection.insertOne(order);
      const available = accessory.quantity - order.quantity;
      const updateDoc = {
        $set: {
          quantity: available,
        },
      };
      const updatedAccessory = await accessoriesCollection.updateOne(filter, updateDoc);
      return res.send({ success: true, result, updatedAccessory });
      // if (exist) {
      //   return res.send({ success: false, order: "Invalid Quantity" });
      // }
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
