// routes/plants.js
const express = require("express");
const router = express.Router();

const Plant = require("../models/Plant");
const Log = require("../models/Log");

// -----------------------------------------------
// 📌 Calculate Growth Stage (Shared Utility)
// -----------------------------------------------
function getGrowthStage(plantedDate) {
  if (!plantedDate) return "unknown";

  const days = Math.floor(
    (Date.now() - new Date(plantedDate).getTime()) /
      (1000 * 60 * 60 * 24)
  );

  if (days < 10) return "seedling";
  if (days < 40) return "young";
  if (days < 80) return "growing";
  return "mature";
}

// -----------------------------------------------
// 📌 Create Plant
// -----------------------------------------------
router.post("/", async (req, res) => {
  try {
    const { name, species, plantedAt, expectedGrowthDays } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Plant name is required" });
    }

    // Prepare plant object
    const plantData = {
      name: name.trim(),
      species: species || null,
      plantedAt: plantedAt ? new Date(plantedAt) : new Date(),
    };

    // If user added expected growth days
    if (expectedGrowthDays) {
      plantData.expectedGrowthDays = expectedGrowthDays;
      plantData.predictedHarvestDate = new Date(
        Date.now() + expectedGrowthDays * 24 * 60 * 60 * 1000
      );
    }

    // Growth stage auto-set
    plantData.growthStage = getGrowthStage(plantData.plantedAt);

    const plant = new Plant(plantData);
    await plant.save();

    res.json(plant);
  } catch (e) {
    console.error("CREATE PLANT ERROR:", e);
    res.status(500).json({ error: e.message });
  }
});

// -----------------------------------------------
// 📌 Get All Plants
// -----------------------------------------------
router.get("/", async (req, res) => {
  try {
    const plants = await Plant.find().sort({ createdAt: -1 });
    res.json(plants);
  } catch (e) {
    console.error("FETCH PLANTS ERROR:", e);
    res.status(500).json({ error: e.message });
  }
});

// -----------------------------------------------
// 📌 Get Single Plant
// -----------------------------------------------
router.get("/:id", async (req, res) => {
  try {
    const plant = await Plant.findById(req.params.id);
    if (!plant)
      return res.status(404).json({ error: "Plant not found" });

    res.json(plant);
  } catch (e) {
    console.error("FETCH SINGLE PLANT ERROR:", e);
    res.status(500).json({ error: e.message });
  }
});

// -----------------------------------------------
// 📌 Delete Plant + All Logs
// -----------------------------------------------
router.delete("/:id", async (req, res) => {
  try {
    const plantId = req.params.id;

    // Delete plant
    const deletedPlant = await Plant.findByIdAndDelete(plantId);
    if (!deletedPlant) {
      return res.status(404).json({ error: "Plant not found" });
    }

    // Delete logs belonging to this plant
    await Log.deleteMany({ plantId });

    res.json({ ok: true, message: "Plant and logs deleted" });
  } catch (e) {
    console.error("DELETE PLANT ERROR:", e);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
