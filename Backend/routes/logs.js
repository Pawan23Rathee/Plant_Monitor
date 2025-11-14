// routes/logs.js
const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const Log = require("../models/Log");
const Plant = require("../models/Plant");
const analyze = require("../utils/analyze");

const UPLOAD_DIR = process.env.UPLOAD_DIR || "uploads";
const BASE_URL = process.env.BASE_URL || "http://localhost:4000";

// Ensure upload folder exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  console.log("📁 Upload folder created:", UPLOAD_DIR);
}

// Multer Storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || ".jpg");
    const unique =
      Date.now() + "-" + Math.random().toString(36).substring(2, 8) + ext;
    cb(null, unique);
  },
});

const upload = multer({ storage });


// -------------------------------------------
//   POST /api/logs/upload  → AI + Save Log
// -------------------------------------------
router.post("/upload", upload.single("image"), async (req, res) => {
  try {
    const { plantId } = req.body;

    if (!req.file)
      return res.status(400).json({ error: "No image uploaded" });

    if (!plantId)
      return res.status(400).json({ error: "Missing plantId" });

    const plant = await Plant.findById(plantId);
    if (!plant)
      return res.status(400).json({ error: "Invalid plantId" });

    const imageUrl = `${BASE_URL}/uploads/${req.file.filename}`;

    // Run AI Detection
    const analysis = await analyze(imageUrl);

    // Fix: If AI mislabels hand/human → replace summary text
    const cleanedSummary =
      analysis.summary &&
      (analysis.summary.includes("hand") ||
        analysis.summary.includes("human"))
        ? "Plant appears healthy with no major visible stress."
        : analysis.summary || "No analysis summary available";

    // -----------------------------
    // Auto-update Plant Details
    // -----------------------------
    if (!plant.species && analysis.detectedPlant) {
      plant.species = analysis.detectedPlant.name || "Unknown";
      plant.type = "ai-detected";

      if (analysis.detectedPlant.expectedGrowthDays) {
        plant.expectedGrowthDays =
          analysis.detectedPlant.expectedGrowthDays;
        plant.predictedHarvestDate = new Date(
          Date.now() +
            analysis.detectedPlant.expectedGrowthDays *
              24 *
              60 *
              60 *
              1000
        );
      }

      await plant.save();
    }

    // Auto calculate growth stage
    const days = plant.plantedAt
      ? Math.floor(
          (Date.now() - plant.plantedAt.getTime()) /
            (1000 * 60 * 60 * 24)
        )
      : 0;

    if (days < 10) plant.growthStage = "seedling";
    else if (days < 40) plant.growthStage = "young";
    else if (days < 80) plant.growthStage = "growing";
    else plant.growthStage = "mature";

    await plant.save();

    // -----------------------------
    // Save Log
    // -----------------------------
    const log = new Log({
      plantId,
      imageUrl,
      healthScore: analysis.healthScore || 0,
      summary: cleanedSummary,
      rawAnalysis: analysis.raw || {},
    });

    await log.save();

    // Return only log object (frontend expects log only)
    res.json(log);
  } catch (err) {
    console.error("UPLOAD ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});


// -------------------------------------------
//   GET /api/logs/plant/:plantId
// -------------------------------------------
router.get("/plant/:plantId", async (req, res) => {
  try {
    const logs = await Log.find({ plantId: req.params.plantId }).sort({
      createdAt: -1,
    });

    res.json(logs);
  } catch (err) {
    console.error("FETCH LOGS ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
