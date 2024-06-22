const express = require('express');
const cors = require('cors');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const app = express();
const port = process.env.PORT || 5000;

// middleware
const corsOptions = {
    origin: ['http://localhost:5173', 'http://localhost:5174', 'https://assignment-twelve-f7a9a.web.app', 'https://touristguide-2ce57.firebaseapp.com'],
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
        const storiesCollection = client.db('tourist-Guide').collection('stories');

        // Verify Admin Middleware
        const verifyAdmin = async (req, res, next) => {
            const user = req.user;
            const query = { email: user?.email };
            const result = await usersCollection.findOne(query)
            if (!result || result?.role !== 'Admin') {
                return res.status(401).send({ message: 'unauthorized access' })
            }
            next()
        }

        // Verify Tour Guide Middleware
        const verifyTourGuide = async (req, res, next) => {
            const user = req.user;
            const query = { email: user?.email };
            const result = await usersCollection.findOne(query);
            if (!result || result?.role !== 'Tour Guide') {
                return res.status(401).send({ message: 'unauthorized access' });
            }
            next();
        }

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
        app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
            const search = req.query.search;
            const role = req.query.filter;
            const size = parseInt(req.query.size);
            const page = parseInt(req.query.page);
            let query = {}
            if (search) {
                query.$or = [
                    { name: new RegExp(search, 'i') },
                    { email: new RegExp(search, 'i') }
                ]
            }
            if (role) {
                query.role = role
            }
            const skip = (page - 1) * size
            const result = await usersCollection.find(query).skip(skip).limit(size).toArray();
            res.send(result);
        })

        // get a user 
        app.get('/user/:email', async (req, res) => {
            const email = req.params.email;
            const result = await usersCollection.findOne({ email });
            res.send(result);
        })

        // update user role
        app.patch('/users/update/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const query = { email: email };
            const updateDoc = {
                $set: { ...user }
            }
            const result = await usersCollection.updateOne(query, updateDoc);
            res.send(result);
        })

        // Manage Users update role
        app.patch('/users/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const data = req.body;
            const query = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: { ...data }
            }
            const result = await usersCollection.updateOne(query, updateDoc);
            res.send(result)
        })

        // tourGuides
        app.get('/tourGuides', async (req, res) => {
            const result = await tourGuidesCollection.find().toArray();
            res.send(result);
        })

        app.post('/tourGuides', verifyToken, async (req, res) => {
            const data = req.body;
            const result = await tourGuidesCollection.insertOne(data);
            res.send(result);
        })

        app.get('/tourGuides/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await tourGuidesCollection.findOne(query);
            res.send(result);
        })

        // add a review
        app.patch('/addReview/:id', verifyToken, async (req, res) => {
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
            const type = req.query?.type;
            const size = parseInt(req.query?.size);
            const query = {};
            if (type) {
                query.tourType = type
            }
            const result = await packagesCollection.find(query).limit(size).toArray();
            res.send(result);
        })

        // get a package
        app.get('/packages/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await packagesCollection.findOne(query);
            res.send(result);
        })

        // add a package
        app.post('/packages', verifyToken, verifyAdmin, async (req, res) => {
            const data = req.body;
            const result = await packagesCollection.insertOne(data);
            res.send(result);
        })

        // Wishlist
        app.get('/wishlist', async (req, res) => {
            const result = await wishlistsCollection.find().toArray();
            res.send(result);
        })

        // a user wishlist
        app.get('/wishlist/:email', verifyToken, async (req, res) => {
            const size = parseInt(req.query?.size);
            const page = parseInt(req.query?.page);
            const email = req.params.email;
            const tokenData = req.user?.email;
            if (tokenData !== email) {
                return res.status(403).send({ message: 'unauthorid access' })
            }
            const query = { 'tourist.email': email };
            const skip = (page - 1) * size
            const result = await wishlistsCollection.find(query).skip(skip).limit(size).toArray();
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

        app.post('/bookings', verifyToken, async (req, res) => {
            const bookingInfo = req.body;
            const email = bookingInfo.touristInfo.touristEmail
            const filter = {
                packageName: bookingInfo.packageName,
                'touristInfo.touristEmail': email
            }
            const isExist = await bookingsCollection.findOne(filter);
            if (isExist) {
                return res.send({ message: 'exist' })
            }
            const result = await bookingsCollection.insertOne(bookingInfo);
            res.send(result);
        })

        // get a user booking data
        app.get('/booking/:email', verifyToken, async (req, res) => {
            const size = parseInt(req.query?.size);
            const page = parseInt(req.query?.page);
            const email = req.params.email;
            const tokenData = req.user?.email;
            if (tokenData !== email) {
                return res.status(403).send({ message: 'unauthorid access' })
            }
            const query = { 'touristInfo.touristEmail': email };
            const skip = (page - 1) * size
            const result = await bookingsCollection.find(query).skip(skip).limit(size).toArray();
            res.send(result)
        })

        // delete a booking
        app.delete('/booking/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await bookingsCollection.deleteOne(query);
            res.send(result);
        })

        // assigned-tours
        app.get('/assigned-tours/:name', verifyToken, verifyTourGuide, async (req, res) => {
            const name = req.params.name;
            const size = parseInt(req.query?.size);
            const page = parseInt(req.query?.page);
            const query = { tourGuideName: name };
            const skip = (page - 1) * size
            const result = await bookingsCollection.find(query).skip(skip).limit(size).toArray();
            res.send(result);
        })

        // update user role
        app.patch('/booking/status/:id', async (req, res) => {
            const id = req.params.id;
            const data = req.body;
            console.log(data)
            const query = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: { ...data }
            }
            const result = await bookingsCollection.updateOne(query, updateDoc);
            res.send(result);
        })

        //*{stories}*//
        app.get('/stories', async (req, res) => {
            const size = parseInt(req.query?.size);
            const result = await storiesCollection.find().limit(size).toArray();
            res.send(result);
        })
        // get a story
        app.get('/stories/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await storiesCollection.findOne(query);
            res.send(result);
        })

        // post a story
        app.post('/stories', verifyToken, async (req, res) => {
            const data = req.body;
            const result = await storiesCollection.insertOne(data);
            res.send(result);
        })

        // only totalCount
        app.get('/users-total', verifyToken, async (req, res) => {
            const search = req.query?.search;
            const role = req.query?.filter;
            let query = {};
            if (search) {
                query.$or = [
                    { name: new RegExp(search, 'i') },
                    { email: new RegExp(search, 'i') }
                ]
            }
            if (role) {
                query.role = role
            }
            const result = await usersCollection.countDocuments(query);
            res.send({ count: result });
        })

        app.get('/assigned-tours-total/:name', async (req, res) => {
            const name = req.params.name;
            const query = { tourGuideName: name };
            const result = await bookingsCollection.countDocuments(query);
            res.send({ count: result });
        })

        app.get('/booking-total/:email', async (req, res) => {
            const email = req.params.email;
            const query = { 'touristInfo.touristEmail': email };
            const result = await bookingsCollection.countDocuments(query);
            res.send({ count: result });
        })

        app.get('/wishlist-total/:email', async (req, res) => {
            const email = req.params.email;
            const query = { 'tourist.email': email };
            const result = await wishlistsCollection.countDocuments(query);
            res.send({ count: result });
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