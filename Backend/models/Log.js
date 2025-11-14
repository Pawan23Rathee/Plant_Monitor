// models/Log.js
const mongoose = require("mongoose");

const LogSchema = new mongoose.Schema({
  plantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Plant",
    required: true,
  },

  imageUrl: { type: String }, // Stored image path

  // ------------------------------
  // AI DETECTION DATA
  // ------------------------------
  detectedPlantName: { type: String },     // e.g. "Tomato"
  detectedSpecies: { type: String },       // e.g. "Solanum Lycopersicum"
  aiConfidence: { type: Number },          // e.g. 92 (%)

  // ------------------------------
  // GROWTH TRACKING
  // ------------------------------
  growthStage: { type: String },           // seedling, young, mature, etc.
  growthDaysLeft: { type: Number },        // days remaining to full growth
  predictedHarvestDate: { type: Date },    // automatic calculation

  // ------------------------------
  // HEALTH ANALYSIS
  // ------------------------------
  healthScore: { type: Number },           // e.g. 78
  summary: { type: String },
  issues: { type: [String], default: [] },
  recommendations: { type: [String], default: [] },

  wateringSuggestion: { type: String },
  fertilizerSuggestion: { type: String },
  todayCare: { type: String },

  rawAnalysis: { type: Object },           // full AI response dump

  // ------------------------------
  // IMAGE INFO
  // ------------------------------
  imageMeta: {
    width: Number,
    height: Number,
    format: String,
  },

  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Log", LogSchema);
