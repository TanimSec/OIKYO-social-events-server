const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
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

// ==========================================
// JWT Verification Middleware
// ==========================================
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  // 1. Check if Authorization header is present and properly formatted
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: true,
      message: 'Unauthorized access: No token provided or format is invalid',
    });
  }

  // 2. Extract the token from 'Bearer <token>'
  const token = authHeader.split(' ')[1];

  // 3. Verify the token signature and expiration
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({
        error: true,
        message: 'Forbidden access: Token is invalid or has expired',
      });
    }

    // 4. Attach decoded payload to request object for downstream handlers
    req.user = decoded;
    next();
  });
};

// ==========================================
// Authentication / Token Routes
// ==========================================

// Create/Sign JWT Token
app.post('/api/jwt', (req, res) => {
  const user = req.body;
  if (!user || !user.email) {
    return res.status(400).json({ error: true, message: 'User email is required' });
  }

  const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
    expiresIn: '7d',
  });

  res.status(200).json({ success: true, token });
});

// Test Protected Route (Verifies that verifyToken is functional)
app.get('/api/jwt-test', verifyToken, (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Access granted to protected route!',
    user: req.user,
  });
});

// ==========================================
// Health Check Route
// ==========================================
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
