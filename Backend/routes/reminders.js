// routes/reminders.js
const express = require('express');
const router = express.Router();
const Reminder = require('../models/Reminder');

// create
router.post('/', async (req, res) => {
  try {
    const { plantId, type, note, nextAt, repeatDays } = req.body;
    const r = new Reminder({ plantId, type, note, nextAt, repeatDays });
    await r.save();
    res.json(r);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// list upcoming
router.get('/', async (req, res) => {
  try {
    const list = await Reminder.find().sort({ nextAt: 1 });
    res.json(list);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// delete
router.delete('/:id', async (req, res) => {
  try {
    await Reminder.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
