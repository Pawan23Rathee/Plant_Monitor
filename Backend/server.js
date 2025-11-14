// server.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const plantRoutes = require('./routes/plants');
const logRoutes = require('./routes/logs');
const reminderRoutes = require('./routes/reminders');
const reminderWorker = require('./cron/reminderWorker');

const app = express();
app.use(cors());
app.use(express.json());

// static uploads
app.use('/uploads', express.static(path.join(__dirname, process.env.UPLOAD_DIR || 'uploads')));

// routes
app.use('/api/plants', plantRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/reminders', reminderRoutes);

// simple health
app.get('/api/health', (req, res) => res.json({ ok: true, ts: Date.now() }));
app.use('/uploads', express.static('uploads'));

// connect mongoose
const MONGO = process.env.MONGO_URI || 'mongodb://localhost:27017/plantbuddy';
mongoose.connect(MONGO, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(()=> {
    console.log('Mongo connected');
    const port = process.env.PORT || 4000;
    app.listen(port, ()=> {
      console.log(`Server listening on ${port}`);
    });
    // start reminder worker
    reminderWorker.start();
  })
  .catch(err => {
    console.error('Mongo connection error', err);
  });
