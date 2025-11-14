// routes/alerts.js
const express = require("express");
const router = express.Router();
const Alert = require("../models/Alert");

// GET /api/alerts  -> optional ?plantId=
router.get("/", async (req, res) => {
  try {
    const { plantId, unread } = req.query;
    const q = {};
    if (plantId) q.plantId = plantId;
    if (unread === "true") q.read = false;

    const alerts = await Alert.find(q).sort({ createdAt: -1 }).limit(200);
    res.json(alerts);
  } catch (err) {
    console.error("FETCH ALERTS ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/alerts/:id/read  -> mark read
router.post("/:id/read", async (req, res) => {
  try {
    const id = req.params.id;
    const a = await Alert.findByIdAndUpdate(id, { read: true }, { new: true });
    res.json(a);
  } catch (err) {
    console.error("MARK ALERT READ ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
