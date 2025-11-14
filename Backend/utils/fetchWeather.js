// utils/fetchWeather.js
const OPENWEATHER_KEY = process.env.OPENWEATHER_KEY;
const DEFAULT_LOCATION = process.env.DEFAULT_LOCATION || "Delhi,IN";

// Helper to fetch current weather by lat/lon or by city
// Returns normalized object { tempC, humidity, windMs, rainMm, description, raw }
async function fetchWeatherForLocation({ lat, lon, city } = {}) {
  if (!OPENWEATHER_KEY) throw new Error("OPENWEATHER_KEY not set");

  // If lat/lon present, use One Call (current)
  if (lat && lon) {
    const url = `https://api.openweathermap.org/data/2.5/onecall?lat=${lat}&lon=${lon}&exclude=minutely,hourly,daily,alerts&units=metric&appid=${OPENWEATHER_KEY}`;
    const r = await fetch(url);
    if (!r.ok) throw new Error("Weather fetch failed");
    const j = await r.json();
    const current = j.current || {};
    return {
      tempC: current.temp,
      humidity: current.humidity,
      windMs: current.wind_speed,
      rainMm: (current.rain && current.rain["1h"]) ? current.rain["1h"] : 0,
      description: (current.weather && current.weather[0] && current.weather[0].description) || "",
      raw: j
    };
  }

  // fallback: fetch by city name
  const q = city || DEFAULT_LOCATION;
  const url2 = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(q)}&units=metric&appid=${OPENWEATHER_KEY}`;
  const r2 = await fetch(url2);
  if (!r2.ok) throw new Error("Weather fetch by city failed");
  const j2 = await r2.json();
  return {
    tempC: j2.main?.temp,
    humidity: j2.main?.humidity,
    windMs: j2.wind?.speed,
    rainMm: (j2.rain && j2.rain["1h"]) ? j2.rain["1h"] : 0,
    description: (j2.weather && j2.weather[0] && j2.weather[0].description) || "",
    raw: j2
  };
}

module.exports = { fetchWeatherForLocation };
