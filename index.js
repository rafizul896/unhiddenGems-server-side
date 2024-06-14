const express = require('express');
const cors = require('cors');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const app = express();
const port = process.env.PORT || 5000;

// middleware
const corsOptions = {
    origin: ['http://localhost:5173', 'http://localhost:5174'],
    credentials: true,
    optionSuccessStatus: 200,
}
app.use(cors(corsOptions))
app.use(express.json())
// verify Token
const verifyToken = (req, res, next) => {
    if (!req.headers.authorization) {
        return res.status(401).send({ message: 'unauthorid access' })
    }
    const token = req.headers.authorization.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_KEY, (err, decoded) => {
        if (err) {
            console.log(err)
            return res.status(401).send({ message: 'unauthorid access' })
        }
        req.user = decoded;
        next();
    })
}

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
        const bookingsCollection = client.db('tourist-Guide').collection('booking');
        const usersCollection = client.db('tourist-Guide').collection('users');

        // jwt related
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_KEY, { expiresIn: '1d' });
            res.send({ token })
        })

        // save user data in mongoDB
        app.post('/user', async (req, res) => {
            const user = req.body;
            const query = { email: user.email };
            // check the user already exists in DB
            const isExist = await usersCollection.findOne(query);
            if (isExist) {
                return
            }
            const result = await usersCollection.insertOne(user);
            res.send(result)
        })
        // get all users
        app.get('/users', async (req, res) => {
            const result = await usersCollection.find().toArray();
            res.send(result);
        })

        // get a user 
        app.get('/user/:email', async (req, res) => {
            const email = req.params.email;
            const result = await usersCollection.findOne({ email });
            res.send(result);
        })

        // update user role
        app.patch('/users/update/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const query = { email: email };
            const updateDoc = {
                $set: { ...user }
            }
            const result = await usersCollection.updateOne(query, updateDoc);
            res.send(result);
        })

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

        // a user wishlist
        app.get('/wishlist/:email', async (req, res) => {
            const email = req.params.email;
            const query = { 'tourist.email': email };
            const result = await wishlistsCollection.find(query).toArray();
            res.send(result);
        })

        app.post('/wishlist', async (req, res) => {
            const package = req.body;
            const email = package?.tourist?.email
            const query = { packageId: package.packageId, 'tourist.email': email }
            const isExist = await wishlistsCollection.findOne(query)
            if (isExist) {
                return res.send({ message: 'exist' })
            }
            const result = await wishlistsCollection.insertOne(package);
            res.send(result)
        })

        // delete a wish
        app.delete('/wishlist/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await wishlistsCollection.deleteOne(query);
            res.send(result);
        })
        
        // booking
        app.get('/bookings', async (req, res) => {
            const result = await bookingsCollection.find().toArray();
            res.send(result);
        })

        app.post('/bookings', async (req, res) => {
            const bookingInfo = req.body;
            const filter = { packageName: bookingInfo.packageName }
            const isExist = await bookingsCollection.findOne(filter);
            if (isExist) {
                return res.send({ message: 'exist' })
            }
            const result = await bookingsCollection.insertOne(bookingInfo);
            res.send(result);
        })

        // get a booking data
        app.get('/booking/:email', async (req, res) => {
            const email = req.params.email;
            const query = { 'touristInfo.touristEmail': email };
            const result = await bookingsCollection.find(query).toArray();
            res.send(result)
        })

        // delete a booking
        app.delete('/booking/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await bookingsCollection.deleteOne(query);
            res.send(result);
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