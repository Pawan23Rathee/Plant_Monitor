// models/Reminder.js
const mongoose = require('mongoose');

const ReminderSchema = new mongoose.Schema({
  plantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Plant', required: true },
  type: { type: String, enum: ['water','nutrient','custom'], default: 'water' },
  note: { type: String },
  nextAt: { type: Date, required: true },
  repeatDays: { type: Number, default: 0 }, // 0 => one-off
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Reminder', ReminderSchema);
