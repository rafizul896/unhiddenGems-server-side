const express = require('express');
const cors = require('cors');
require('dotenv').config();
const app = express();
const port = process.env.PORT || 5000

// middleware
const corsOptions = {
    origin: ['http://localhost:5173', 'http://localhost:5174'],
    credentials: true,
    optionSuccessStatus: 200,
}
app.use(cors(corsOptions))
app.use(express.json())


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.USER_DB}:${process.env.PASS_DB}@cluster0.y7qmkns.mongodb.net/?retryWrites=true&w=majority&appName=cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        const tourGuidesCollection = client.db('tourist-Guide').collection('tourGuides');
        const packagesCollection = client.db('tourist-Guide').collection('packages');
        const wishlistsCollection = client.db('tourist-Guide').collection('wishlist');

        // tourGuides
        app.get('/tourGuides', async (req, res) => {
            const result = await tourGuidesCollection.find().toArray();
            res.send(result);
        })

        app.get('/tourGuides/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await tourGuidesCollection.findOne(query);
            res.send(result);
        })

        // add a review
        app.patch('/addReview/:id', async (req, res) => {
            const id = req.params.id;
            const review = req.body;
            const filter = { _id: new ObjectId(id) };
            const tourGuide = await tourGuidesCollection.findOne(filter);
            const isExist = tourGuide.reviews.find(r => r.userName === review.userName)
            if (isExist) {
                return res.send({ message: 'exist' })
            }
            const result = await tourGuidesCollection.updateOne(filter, { $push: { reviews: review } });
            res.send(result);
        })

        // get packages collections
        app.get('/packages', async (req, res) => {
            const result = await packagesCollection.find().toArray();
            res.send(result);
        })

        app.get('/packages/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await packagesCollection.findOne(query);
            res.send(result);
        })

        // Wishlist
        app.get('/wishlist', async (req, res) => {
            const result = await wishlistsCollection.find().toArray();
            res.send(result);
        })

        app.post('/wishlist', async (req, res) => {
            const package = req.body;
            const query = { packageId: package.packageId }
            const isExist = await wishlistsCollection.findOne(query)
            if (isExist) {
                return res.send({ message: 'exist' })
            }
            const result = await wishlistsCollection.insertOne(package);
            res.send(result)
        })

        // Send a ping to confirm a successful connection
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send(`Hello from Tourist Guide server..!`)
})

app.listen(port, () => {
    console.log(`Tourist Guide server is running port on ${port}`)
})