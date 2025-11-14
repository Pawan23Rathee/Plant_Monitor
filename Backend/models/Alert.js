// models/Alert.js
const mongoose = require("mongoose");

const AlertSchema = new mongoose.Schema({
  plantId: { type: mongoose.Schema.Types.ObjectId, ref: "Plant", required: false },
  title: { type: String, required: true },
  message: { type: String },
  level: { type: String, enum: ["info","warning","critical"], default: "info" },
  meta: { type: Object, default: {} }, // e.g. weather payload, reason
  createdAt: { type: Date, default: Date.now },
  read: { type: Boolean, default: false }
});

module.exports = mongoose.model("Alert", AlertSchema);
