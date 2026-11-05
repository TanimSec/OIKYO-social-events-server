const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Health Check Route
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Social Development Events Platform Server is running smoothly',
    timestamp: new Date().toISOString(),
  });
});

app.listen(port, () => {
  console.log(`Server is running on port: ${port}`);
});

