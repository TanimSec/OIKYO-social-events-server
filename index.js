const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection Setup
const uri = process.env.MONGODB_URI;
const dbName = process.env.DB_NAME || 'socialEventsDB';

let client;
let db;
let eventsCollection;
let joinedEventsCollection;
let isDbConnected = false;

if (uri) {
  client = new MongoClient(uri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
  });
}

async function connectDB() {
  if (!uri) {
    console.warn('⚠️ MONGODB_URI is not set in .env. Please configure your MongoDB Atlas connection string.');
    return;
  }
  try {
    await client.connect();
    // Ping admin to verify connection
    await client.db('admin').command({ ping: 1 });
    db = client.db(dbName);
    eventsCollection = db.collection('events');
    joinedEventsCollection = db.collection('joinedEvents');
    isDbConnected = true;
    console.log(`✅ Connected successfully to MongoDB Atlas (Database: ${dbName})`);
    console.log(`📁 Collections initialized: 'events', 'joinedEvents'`);
  } catch (error) {
    isDbConnected = false;
    console.error('❌ Failed to connect to MongoDB Atlas:', error.message);
  }
}

connectDB();

// Health Check Route
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Social Development Events Platform Server is running smoothly',
    database: isDbConnected ? 'Connected to MongoDB Atlas' : 'Disconnected (check MONGODB_URI in .env)',
    collections: ['events', 'joinedEvents'],
    timestamp: new Date().toISOString(),
  });
});

app.listen(port, () => {
  console.log(`Server is running on port: ${port}`);
});
