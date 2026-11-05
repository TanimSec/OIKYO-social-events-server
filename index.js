const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
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

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: true,
      message: 'Unauthorized access: No token provided or format is invalid',
    });
  }

  const token = authHeader.split(' ')[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({
        error: true,
        message: 'Forbidden access: Token is invalid or has expired',
      });
    }

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

// Test Protected Route
app.get('/api/jwt-test', verifyToken, (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Access granted to protected route!',
    user: req.user,
  });
});

// ==========================================
// Events Endpoints (Step S4)
// ==========================================

/**
 * POST /api/events
 * Private: Requires valid JWT (verifyToken)
 * Creates a new social development event with future date validation
 */
app.post('/api/events', verifyToken, async (req, res) => {
  try {
    if (!eventsCollection) {
      return res.status(503).json({ error: true, message: 'Database connection not ready' });
    }

    const { title, description, eventType, thumbnail, location, eventDate, creatorName } = req.body;

    // 1. Mandatory Field Validation
    if (!title || !description || !eventType || !thumbnail || !location || !eventDate) {
      return res.status(400).json({
        error: true,
        message: 'All fields (title, description, eventType, thumbnail, location, eventDate) are required',
      });
    }

    // 2. Future Date Validation (Enforce strictly today or future dates)
    const todayString = new Date().toISOString().split('T')[0];
    const targetDateString = eventDate.split('T')[0];

    if (targetDateString < todayString) {
      return res.status(400).json({
        error: true,
        message: 'Event date must be in the future. Past dates cannot be added.',
      });
    }

    // 3. Assemble Event Document with JWT-verified creatorEmail
    const newEvent = {
      title: title.trim(),
      description: description.trim(),
      eventType: eventType.trim(),
      thumbnail: thumbnail.trim(),
      location: location.trim(),
      eventDate: targetDateString,
      creatorEmail: req.user.email,
      creatorName: creatorName ? creatorName.trim() : req.user.name || 'Community Leader',
      createdAt: new Date().toISOString(),
    };

    const result = await eventsCollection.insertOne(newEvent);

    return res.status(201).json({
      success: true,
      message: 'Social development event created successfully!',
      insertedId: result.insertedId,
      event: { ...newEvent, _id: result.insertedId },
    });
  } catch (error) {
    console.error('Error creating event:', error);
    return res.status(500).json({ error: true, message: 'Internal server error while creating event' });
  }
});

/**
 * GET /api/events/upcoming
 * Public: Anyone can view upcoming events
 * Features:
 * - Strictly filters out past events (eventDate >= today)
 * - Supports ?limit=6 (for Home page recent upcoming events)
 * - Supports ?page=1&limit=9 (for Upcoming Events pagination)
 * - Supports ?search=keyword (matches title or location case-insensitively)
 * - Supports ?eventType=category (filters specific event type)
 * - Sorted ascending by eventDate (nearest upcoming event first)
 */
app.get('/api/events/upcoming', async (req, res) => {
  try {
    if (!eventsCollection) {
      return res.status(503).json({ error: true, message: 'Database connection not ready' });
    }

    const { limit, page, search, eventType } = req.query;
    const todayString = new Date().toISOString().split('T')[0];

    // Base query: Strictly future/current dates
    const query = {
      eventDate: { $gte: todayString },
    };

    // Filter by Event Type (Cleanup, Plantation, Donation, Healthcare, Education, Relief)
    if (eventType && eventType !== 'All' && eventType.trim() !== '') {
      query.eventType = eventType.trim();
    }

    // Search by title or location (Case-insensitive regex)
    if (search && search.trim() !== '') {
      query.$or = [
        { title: { $regex: search.trim(), $options: 'i' } },
        { location: { $regex: search.trim(), $options: 'i' } },
      ];
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 0;
    const skipNum = limitNum > 0 && pageNum > 0 ? (pageNum - 1) * limitNum : 0;

    // Execute query sorted by eventDate ascending
    let cursor = eventsCollection.find(query).sort({ eventDate: 1 });

    if (skipNum > 0) {
      cursor = cursor.skip(skipNum);
    }
    if (limitNum > 0) {
      cursor = cursor.limit(limitNum);
    }

    const [events, totalEvents] = await Promise.all([
      cursor.toArray(),
      eventsCollection.countDocuments(query),
    ]);

    const totalPages = limitNum > 0 ? Math.ceil(totalEvents / limitNum) : 1;

    return res.status(200).json({
      success: true,
      count: events.length,
      totalEvents,
      currentPage: pageNum,
      totalPages,
      events,
    });
  } catch (error) {
    console.error('Error fetching upcoming events:', error);
    return res.status(500).json({ error: true, message: 'Internal server error while fetching upcoming events' });
  }
});

/**
 * GET /api/events/:id
 * Public: Anyone can view a specific event's details
 * Retrieves a single event by its 24-character hexadecimal MongoDB ObjectId
 */
app.get('/api/events/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Validate if the provided id is a valid 24-hex-char MongoDB ObjectId
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        error: true,
        message: 'Invalid event ID format. Must be a valid 24-character ObjectId.',
      });
    }

    // 2. Database connection check
    if (!eventsCollection) {
      return res.status(503).json({ error: true, message: 'Database connection not ready' });
    }

    const event = await eventsCollection.findOne({ _id: new ObjectId(id) });

    if (!event) {
      return res.status(404).json({
        error: true,
        message: 'Event not found with the specified ID',
      });
    }

    return res.status(200).json({
      success: true,
      event,
    });
  } catch (error) {
    console.error('Error fetching event details:', error);
    return res.status(500).json({
      error: true,
      message: 'Internal server error while fetching event details',
    });
  }
});

// ==========================================
// Joined Events Endpoints (Step S6)
// ==========================================

/**
 * POST /api/joined-events
 * Private: Requires valid JWT (verifyToken)
 * Allows an authenticated user to join an event (prevents duplicate join)
 */
app.post('/api/joined-events', verifyToken, async (req, res) => {
  try {
    if (!joinedEventsCollection || !eventsCollection) {
      return res.status(503).json({ error: true, message: 'Database connection not ready' });
    }

    const { eventId, userName } = req.body;

    // 1. Validate eventId
    if (!eventId || !ObjectId.isValid(eventId)) {
      return res.status(400).json({
        error: true,
        message: 'A valid 24-character eventId is required to join an event',
      });
    }

    // 2. Fetch the target event to verify existence and get accurate snapshot
    const targetEvent = await eventsCollection.findOne({ _id: new ObjectId(eventId) });
    if (!targetEvent) {
      return res.status(404).json({
        error: true,
        message: 'The event you are trying to join does not exist',
      });
    }

    // 3. Prevent duplicate join by the same user
    const userEmail = req.user.email;
    const existingJoin = await joinedEventsCollection.findOne({
      eventId: eventId,
      userEmail: userEmail,
    });

    if (existingJoin) {
      return res.status(409).json({
        error: true,
        message: 'You have already joined this event!',
      });
    }

    // 4. Store participation record
    const participationRecord = {
      eventId: targetEvent._id.toString(),
      title: targetEvent.title,
      description: targetEvent.description,
      eventType: targetEvent.eventType,
      thumbnail: targetEvent.thumbnail,
      location: targetEvent.location,
      eventDate: targetEvent.eventDate,
      creatorEmail: targetEvent.creatorEmail,
      userEmail: userEmail,
      userName: userName ? userName.trim() : req.user.name || 'Volunteer',
      joinedAt: new Date().toISOString(),
    };

    const result = await joinedEventsCollection.insertOne(participationRecord);

    return res.status(201).json({
      success: true,
      message: 'Successfully joined the event!',
      insertedId: result.insertedId,
      joinedEvent: { ...participationRecord, _id: result.insertedId },
    });
  } catch (error) {
    console.error('Error joining event:', error);
    return res.status(500).json({ error: true, message: 'Internal server error while joining event' });
  }
});

/**
 * GET /api/joined-events
 * Private: Requires valid JWT (verifyToken)
 * Retrieves all events joined by the logged-in user, sorted ascending by eventDate
 */
app.get('/api/joined-events', verifyToken, async (req, res) => {
  try {
    if (!joinedEventsCollection) {
      return res.status(503).json({ error: true, message: 'Database connection not ready' });
    }

    const userEmail = req.user.email;

    // Fetch joined events for the logged in user, sorted ascending by eventDate
    const joinedEvents = await joinedEventsCollection
      .find({ userEmail: userEmail })
      .sort({ eventDate: 1 })
      .toArray();

    return res.status(200).json({
      success: true,
      count: joinedEvents.length,
      joinedEvents,
    });
  } catch (error) {
    console.error('Error fetching joined events:', error);
    return res.status(500).json({ error: true, message: 'Internal server error while fetching joined events' });
  }
});

// ==========================================
// Manage Events Endpoints (Step S7)
// ==========================================

/**
 * GET /api/manage-events
 * Private: Requires valid JWT (verifyToken)
 * Returns all events created by the logged-in user (creatorEmail === req.user.email)
 */
app.get('/api/manage-events', verifyToken, async (req, res) => {
  try {
    if (!eventsCollection) {
      return res.status(503).json({ error: true, message: 'Database connection not ready' });
    }

    const creatorEmail = req.user.email;
    const myEvents = await eventsCollection
      .find({ creatorEmail })
      .sort({ createdAt: -1 })
      .toArray();

    return res.status(200).json({
      success: true,
      count: myEvents.length,
      events: myEvents,
    });
  } catch (error) {
    console.error('Error fetching manage-events:', error);
    return res.status(500).json({ error: true, message: 'Internal server error while fetching created events' });
  }
});

/**
 * PUT /api/events/:id
 * Private: Requires valid JWT (verifyToken) + Creator Ownership Verification
 * Updates an event after ensuring future date validity and ownership check
 */
app.put('/api/events/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: true, message: 'Invalid event ID format' });
    }

    if (!eventsCollection) {
      return res.status(503).json({ error: true, message: 'Database connection not ready' });
    }

    // 1. Fetch the event to verify existence and check ownership
    const existingEvent = await eventsCollection.findOne({ _id: new ObjectId(id) });
    if (!existingEvent) {
      return res.status(404).json({ error: true, message: 'Event not found' });
    }

    // 2. Strict Ownership Check
    if (existingEvent.creatorEmail !== req.user.email) {
      return res.status(403).json({
        error: true,
        message: 'Forbidden: You do not have permission to update this event. You can only edit events you created.',
      });
    }

    const { title, description, eventType, thumbnail, location, eventDate } = req.body;

    if (!title || !description || !eventType || !thumbnail || !location || !eventDate) {
      return res.status(400).json({
        error: true,
        message: 'All fields (title, description, eventType, thumbnail, location, eventDate) are required',
      });
    }

    // 3. Future Date Validation
    const todayString = new Date().toISOString().split('T')[0];
    const targetDateString = eventDate.split('T')[0];
    if (targetDateString < todayString) {
      return res.status(400).json({
        error: true,
        message: 'Event date must be in the future. Past dates cannot be set.',
      });
    }

    // 4. Update Event in eventsCollection
    const updatedFields = {
      title: title.trim(),
      description: description.trim(),
      eventType: eventType.trim(),
      thumbnail: thumbnail.trim(),
      location: location.trim(),
      eventDate: targetDateString,
      updatedAt: new Date().toISOString(),
    };

    await eventsCollection.updateOne({ _id: new ObjectId(id) }, { $set: updatedFields });

    // 5. Keep joined events snapshots in sync
    if (joinedEventsCollection) {
      await joinedEventsCollection.updateMany(
        { eventId: id },
        {
          $set: {
            title: updatedFields.title,
            description: updatedFields.description,
            eventType: updatedFields.eventType,
            thumbnail: updatedFields.thumbnail,
            location: updatedFields.location,
            eventDate: updatedFields.eventDate,
          },
        }
      );
    }

    return res.status(200).json({
      success: true,
      message: 'Event updated successfully!',
      event: { ...existingEvent, ...updatedFields },
    });
  } catch (error) {
    console.error('Error updating event:', error);
    return res.status(500).json({ error: true, message: 'Internal server error while updating event' });
  }
});

/**
 * DELETE /api/events/:id
 * Private: Requires valid JWT (verifyToken) + Creator Ownership Verification
 * Deletes an event only if the requester is the original creator
 */
app.delete('/api/events/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: true, message: 'Invalid event ID format' });
    }

    if (!eventsCollection) {
      return res.status(503).json({ error: true, message: 'Database connection not ready' });
    }

    // 1. Fetch event to verify existence and check ownership
    const existingEvent = await eventsCollection.findOne({ _id: new ObjectId(id) });
    if (!existingEvent) {
      return res.status(404).json({ error: true, message: 'Event not found' });
    }

    // 2. Strict Ownership Check
    if (existingEvent.creatorEmail !== req.user.email) {
      return res.status(403).json({
        error: true,
        message: 'Forbidden: You do not have permission to delete this event. You can only delete events you created.',
      });
    }

    // 3. Delete event from eventsCollection
    await eventsCollection.deleteOne({ _id: new ObjectId(id) });

    // 4. Cascade delete: remove any joined event records for this event
    if (joinedEventsCollection) {
      await joinedEventsCollection.deleteMany({ eventId: id });
    }

    return res.status(200).json({
      success: true,
      message: 'Event deleted successfully!',
    });
  } catch (error) {
    console.error('Error deleting event:', error);
    return res.status(500).json({ error: true, message: 'Internal server error while deleting event' });
  }
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
