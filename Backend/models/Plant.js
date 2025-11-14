// models/Plant.js
const mongoose = require("mongoose");

const PlantSchema = new mongoose.Schema({
  // --------------------------------------
  // BASIC DETAILS
  // --------------------------------------
  name: { type: String, required: true },     // plant name
  species: { type: String },                  // tomato, potato, aloe vera etc.
  type: { type: String, default: "manual" },  // "manual" | "ai-detected"

  // --------------------------------------
  // DATES
  // --------------------------------------
  plantedAt: { type: Date, default: Date.now },     // user sets when seed was planted
  createdAt: { type: Date, default: Date.now },      // database creation date

  // --------------------------------------
  // GROWTH CYCLE
  // --------------------------------------
  expectedGrowthDays: { type: Number, default: null },  // example: tomato = 90 days
  predictedHarvestDate: { type: Date },                 // AI auto-fill
  growthStage: { type: String, default: "seedling" },   // seedling/young/mature/harvest

  // --------------------------------------
  // REMINDERS
  // --------------------------------------
  wateringIntervalDays: { type: Number, default: 2 },   // every 2 days
  lastWateredAt: { type: Date, default: null },

  fertilizerIntervalDays: { type: Number, default: 14 },
  lastFertilizedAt: { type: Date, default: null },

  // --------------------------------------
  // CARE & ENVIRONMENT
  // --------------------------------------
  sunlightRequired: { type: String },   // full sun / partial / indoor
  potSize: { type: String },            // small/medium/large
  location: { type: String },           // balcony/kitchen/garden

  // --------------------------------------
  // STATUS
  // --------------------------------------
  status: {
    type: String,
    enum: ["active", "harvested", "dead"],
    default: "active",
  },

  // --------------------------------------
  // META (FUTURE PROOF)
  // --------------------------------------
  meta: {
    type: Object,
    default: {},
  },

  // --------------------------------------
  // SOFT DELETE / ARCHIVE
  // --------------------------------------
  deletedAt: { type: Date, default: null },  // for trash/restore system
});

// Optional virtual: days grown
PlantSchema.virtual("daysSincePlanted").get(function () {
  if (!this.plantedAt) return 0;
  const diff = Date.now() - this.plantedAt.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
});

// Ensure virtuals show up in JSON
PlantSchema.set("toJSON", { virtuals: true });
PlantSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("Plant", PlantSchema);
