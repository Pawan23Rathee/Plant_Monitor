// workers/weatherWorker.js
const cron = require("node-cron");
const Plant = require("../models/Plant");
const Alert = require("../models/Alert");
const { fetchWeatherForLocation } = require("../utils/fetchWeather");

const CRON = process.env.WEATHER_CHECK_CRON || "0 */1 * * *"; // default every hour

function evaluateRiskForPlant(plant, weather) {
  // weather: { tempC, humidity, windMs, rainMm, description, raw }
  const issues = [];
  let level = "info";

  // Heatwave: temp >= 35°C
  if (weather.tempC >= 35) {
    issues.push(`High temperature ${weather.tempC}°C — risk of heat stress`);
    level = "warning";
    if (weather.tempC >= 40) level = "critical";
  }

  // Frost: temp <= 4°C
  if (weather.tempC <= 4) {
    issues.push(`Low temperature ${weather.tempC}°C — frost risk`);
    level = "critical";
  }

  // Low humidity
  if (weather.humidity !== undefined && weather.humidity < 30) {
    issues.push(`Low humidity ${weather.humidity}% — misting recommended`);
    if (level !== "critical") level = "warning";
  }

  // Heavy rain
  if (weather.rainMm !== undefined && weather.rainMm >= 10) {
    issues.push(`Heavy rain expected (~${weather.rainMm} mm) — waterlogging risk`);
    if (level !== "critical") level = "warning";
  }

  // Strong wind
  if (weather.windMs !== undefined && weather.windMs >= 10) {
    issues.push(`Strong wind (~${weather.windMs} m/s) — secure plants`);
    if (level !== "critical") level = "warning";
  }

  // Create friendly message
  const title = issues.length ? `Weather alert for ${plant.name}` : `Weather update for ${plant.name}`;
  const message = issues.length ? issues.join("; ") : `Current: ${weather.description || "clear"}, ${weather.tempC}°C, humidity ${weather.humidity}%`;

  return { title, message, issues, level, meta: weather };
}

async function runCheckOnce() {
  try {
    const plants = await Plant.find({ status: "active" }).lean();
    if (!plants || plants.length === 0) return;

    for (const plant of plants) {
      try {
        // Determine location: if plant.meta.location contains {lat,lon} use that else fallback to DEFAULT_LOCATION city
        const loc = (plant.meta && plant.meta.location) || null;
        let weather;
        if (loc && loc.lat && loc.lon) {
          weather = await fetchWeatherForLocation({ lat: loc.lat, lon: loc.lon });
        } else if (loc && loc.city) {
          weather = await fetchWeatherForLocation({ city: loc.city });
        } else {
          weather = await fetchWeatherForLocation(); // uses DEFAULT_LOCATION
        }

        const evaluation = evaluateRiskForPlant(plant, weather);

        // Create alert only if critical/warning OR (optional) create info updates if desired
        if (evaluation.level === "critical" || evaluation.level === "warning") {
          await Alert.create({
            plantId: plant._id,
            title: evaluation.title,
            message: evaluation.message,
            level: evaluation.level,
            meta: evaluation.meta
          });
        } else {
          // optionally create periodic info alerts; comment out if not desired
          // await Alert.create({ plantId: plant._id, title: evaluation.title, message: evaluation.message, level: 'info', meta: evaluation.meta });
        }
      } catch (e) {
        console.error("Worker per-plant error:", e);
      }
    }
  } catch (err) {
    console.error("Weather worker error:", err);
  }
}

function startWeatherWorker() {
  console.log("Starting weather worker cron:", CRON);
  // run immediately once
  runCheckOnce().catch(console.error);

  // schedule
  cron.schedule(CRON, () => {
    runCheckOnce().catch(console.error);
  });
}

module.exports = { startWeatherWorker, runCheckOnce };
