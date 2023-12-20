const express = require('express')
const app = express();
const cors = require('cors')
const jwt = require('jsonwebtoken');
require('dotenv').config()
const port = process.env.PORT || 5000;

//middleware
app.use(cors({
  origin: [
    'http://localhost:5173',
  ],
  credentials: true
}));
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.o19wwr0.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    const mobilecollection = client.db("mobileshopdb").collection("mobiles")
    const cartCollection = client.db("mobileshopdb").collection("carts")
    const orderCollection = client.db("mobileshopdb").collection("orders")

    // jwt related apis

    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
      res.send({ token });
    })

    // middle wares
    const verifyToken = (req, res, next) => {
      console.log('inside verify token', req.headers.authorization);
      if (!req.headers.authorization) {
        return res.status(401).send({ message: 'unauthorized access' });
      }
      const token = req.headers.authorization.split(' ')[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: 'unauthorized access' })
        }
        req.decoded = decoded;
        next();
      })
    }


    // mobile related apis
    app.post('/addmobile', async (req, res) => {
      try {
        const newmobile = req.body;
        const result = await mobilecollection.insertOne(newmobile);
        res.send(result);
      } catch (error) {
        console.error('Error in /addmobile:', error);
        res.status(500).json({ error: 'Internal Server Error' });
      }
    });

    app.get('/allmobile', async (req, res) => {
      try {
        console.log(req.headers);
        const page = parseInt(req.query.page);
        const size = parseInt(req.query.size);

        const filter = req.query;
        const query = {
          modelname: { $regex: filter.modelname || '', $options: 'i' },
          brandname: { $regex: filter.brandname || '', $options: 'i' },
          type: { $regex: filter.type || '', $options: 'i' },
          processor: { $regex: filter.processor || '', $options: 'i' },
          storage: { $regex: filter.storage || '', $options: 'i' },
        };

        const options = {
          sort: {
            price: filter.sort === 'asc' ? 1 : -1
          }
        };

        const result = await mobilecollection.find(query, options).skip(page * size).limit(size).toArray();

        res.send(result)
      } catch (error) {
        console.error('Error in /allmobile:', error);
        res.status(500).json({ error: 'Internal Server Error' });
      }
    });

    app.get('/allmobile/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await mobilecollection.findOne(query);
      res.send(result);
    })

    //cart collections
    app.post('/carts', async (req, res) => {
      const cartItem = req.body;
      const result = await cartCollection.insertOne(cartItem);
      res.send(result)
    })

    app.get('/carts', async (req, res) => {
      const email = req.query.email;
      const query = { email: email }
      const result = await cartCollection.find(query).toArray()
      res.send(result)
    })

    app.delete('/carts/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await cartCollection.deleteOne(query)
      res.send(result);
    })

    // order related api
    app.post('/orders', verifyToken, async (req, res) => {
      try {
        const orders = req.body;

        const query = {
          _id: {
            $in: orders.cartIds.map(id => new ObjectId(id))
          }
        };

        const deleteResult = await cartCollection.deleteMany(query);

        const result = await orderCollection.insertOne(orders);
        res.send({result, deleteResult});
      } catch (error) {
        console.error('Error in /orders:', error);
        res.status(500).json({ error: 'Internal Server Error' });
      }
    });

    // stats
    app.get('/mobile-stats', async (req, res) => {
      const mobile = await mobilecollection.estimatedDocumentCount();
      res.send({ mobile })
    })




    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    //   await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('mobileshop is running')
})
app.listen(port, () => {
  console.log(`mobileshop is sitting on port ${port}`);
})