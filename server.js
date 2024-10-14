const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const port = 3000;

// Enable CORS
app.use(cors());

// Parse JSON request bodies
app.use(express.json());

// Verification API
app.post('/verify', async (req, res) => {
  try {
    const response = await axios.post('http://xenblocks.io/verify', req.body);
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get the last block
app.get('/lastblock', async (req, res) => {
  try {
    const response = await axios.get('http://xenblocks.io:4445/getblocks/lastblock');
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Send POW (Proof of Work)
app.post('/send_pow', async (req, res) => {
  try {
    const response = await axios.post('http://xenblocks.io:4446/send_pow', req.body);
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get current difficulty
app.get('/difficulty', async (req, res) => {
  try {
    const response = await axios.get('http://xenblocks.io/difficulty');
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});