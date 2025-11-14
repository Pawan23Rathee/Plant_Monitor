// src/PlantBuddy.jsx
import React, { useEffect, useRef, useState } from "react";
import { Line } from "react-chartjs-2";
import "chart.js/auto";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

/**
 * PlantBuddy (Option A)
 * - AI species detection + growth estimate
 * - If no plant detected -> ask user for name/type and create plant
 * - Growth chart using healthScore logs
 *
 * Tailwind classes used for styling.
 */

export default function PlantBuddy() {
  // state
  const [plants, setPlants] = useState([]);
  const [logs, setLogs] = useState({});
  const [selectedPlantId, setSelectedPlantId] = useState(null);

  const [cameraOpen, setCameraOpen] = useState(false);
  const [askingPlantInfo, setAskingPlantInfo] = useState(null); // { imageUrl, analysis }
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  // refs
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // auto-clear message
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(""), 3500);
    return () => clearTimeout(t);
  }, [message]);

  // load plants once
  useEffect(() => {
    async function fetchPlants() {
      try {
        setLoading(true);
        const res = await fetch(`${API_URL}/api/plants`);
        const data = await res.json();
        setPlants(data || []);
      } catch (err) {
        console.error("Error fetching plants:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchPlants();
  }, []);

  // load logs whenever plants change
  useEffect(() => {
    if (!plants || plants.length === 0) return;
    let canceled = false;
    async function fetchLogs() {
      try {
        const results = await Promise.all(
          plants.map((p) =>
            fetch(`${API_URL}/api/logs/plant/${p._id}`).then((r) => r.json())
          )
        );
        if (canceled) return;
        const map = {};
        plants.forEach((p, i) => (map[p._id] = results[i] || []));
        setLogs(map);
      } catch (err) {
        console.error("Error loading logs:", err);
      }
    }
    fetchLogs();
    return () => {
      canceled = true;
    };
  }, [plants]);

  // ---------- helpers ----------
  const getDaysSince = (iso) => {
    if (!iso) return null;
    const days = Math.floor((Date.now() - new Date(iso)) / (1000 * 60 * 60 * 24));
    return days;
  };

  const getGrowthStage = (plantedAt) => {
    const days = getDaysSince(plantedAt);
    if (days === null) return "—";
    if (days < 7) return `🌱 Germination (${days}d)`;
    if (days < 30) return `🌿 Early Growth (${days}d)`;
    if (days < 60) return `🌾 Vegetative (${days}d)`;
    if (days < 90) return `🌼 Flowering (${days}d)`;
    return `🥕 Harvest Ready (${days}d)`;
  };

  // species heuristic for growth (fallback if AI doesn't return estimated days)
  const speciesGrowthEstimate = (species = "") => {
    const s = (species || "").toLowerCase();
    if (!s) return { days: 80, note: "Typical vegetable ~70–90 days" };
    if (s.includes("tomato")) return { days: 80, note: "Tomato ~70–90 days" };
    if (s.includes("spinach")) return { days: 35, note: "Spinach ~30–45 days" };
    if (s.includes("carrot")) return { days: 75, note: "Carrot ~70–90 days" };
    if (s.includes("basil")) return { days: 60, note: "Basil ~40–70 days" };
    if (s.includes("potato")) return { days: 90, note: "Potato ~80–120 days" };
    if (s.includes("mint")) return { days: 180, note: "Mint perennial / long-term" };
    return { days: 80, note: "Typical vegetable ~70–90 days" };
  };

  // ---------- API actions ----------
  async function addPlant(name, species, plantedAt) {
    try {
      const res = await fetch(`${API_URL}/api/plants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          species,
          plantedAt: plantedAt || new Date().toISOString(),
        }),
      });
      const newPlant = await res.json();
      setPlants((prev) => [newPlant, ...prev]);
      setMessage("Plant added successfully!");
    } catch (err) {
      console.error("addPlant error:", err);
      setMessage("Error adding plant");
    }
  }

  const deletePlant = async (id) => {
    if (!confirm("Delete this plant and its logs?")) return;
    try {
      await fetch(`${API_URL}/api/plants/${id}`, { method: "DELETE" });
      setPlants((prev) => prev.filter((p) => p._id !== id));
      setLogs((prev) => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
      setMessage("Plant deleted");
    } catch (err) {
      console.error("deletePlant error:", err);
      setMessage("Delete failed");
    }
  };

  const archivePlant = async (id) => {
    try {
      await fetch(`${API_URL}/api/plants/archive/${id}`, { method: "POST" });
      setPlants((prev) => prev.filter((p) => p._id !== id));
      setMessage("Plant archived (completed)");
    } catch (err) {
      console.error("archivePlant error:", err);
      setMessage("Archive failed");
    }
  };

  // ---------- camera actions ----------
  const openCamera = (id) => {
    setSelectedPlantId(id);
    setCameraOpen(true);

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch (err) {
        console.error("camera error:", err);
        setMessage("Camera permission denied");
      }
    }
    start();
  };

  const closeCamera = () => {
    setCameraOpen(false);
    const v = videoRef.current;
    if (v?.srcObject) {
      v.srcObject.getTracks().forEach((t) => t.stop());
      v.srcObject = null;
    }
  };

  // helper to convert blob -> dataURL
  const blobToDataUrl = (blob) =>
    new Promise((res) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.readAsDataURL(blob);
    });

  // ---------- capture & upload ----------
  const capturePhoto = async () => {
    try {
      const v = videoRef.current;
      const c = canvasRef.current;
      c.width = v.videoWidth || 640;
      c.height = v.videoHeight || 480;
      const ctx = c.getContext("2d");
      ctx.drawImage(v, 0, 0, c.width, c.height);

      const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.9));
      if (!blob) throw new Error("capture failed");

      // prepare form
      const form = new FormData();
      form.append("image", blob);
      form.append("plantId", selectedPlantId || "");

      setMessage("Uploading & analyzing...");
      const res = await fetch(`${API_URL}/api/logs/upload`, {
        method: "POST",
        body: form,
      });

      const json = await res.json();

      // Normalize possible shapes:
      // - { ok: true, log }
      // - { isPlant, healthScore, summary, ... }
      // - saved log object directly
      let savedLog = null;
      let analysis = null;

      if (json.ok && json.log) {
        savedLog = json.log;
        analysis = savedLog.rawAnalysis || savedLog.raw || savedLog.analysis || savedLog;
      } else if (json.log) {
        savedLog = json.log;
        analysis = savedLog.raw || savedLog.analysis || savedLog;
      } else if (json.isPlant !== undefined || json.healthScore !== undefined) {
        analysis = json;
      } else {
        analysis = json;
      }

      // If backend returned savedLog and plantId present, update logs
      if (savedLog && savedLog.plantId) {
        setLogs((prev) => ({
          ...prev,
          [savedLog.plantId]: [savedLog, ...(prev[savedLog.plantId] || [])],
        }));
      }

      // If analysis says no plant detected -> ask user to supply name/type
      const noPlant =
        (analysis && (analysis.isPlant === false || (analysis.summary && /no plant/i.test(analysis.summary)))) ||
        (!analysis && !savedLog);

      if (noPlant) {
        const imageUrl = savedLog?.imageUrl || (await blobToDataUrl(blob));
        setAskingPlantInfo({ imageUrl, analysis });
        setMessage("");
        closeCamera();
        return;
      }

      // If plant detected -> refresh logs for the selected plant if available
      if (selectedPlantId) {
        try {
          const r = await fetch(`${API_URL}/api/logs/plant/${selectedPlantId}`);
          const arr = await r.json();
          setLogs((prev) => ({ ...prev, [selectedPlantId]: arr || [] }));
        } catch (e) {
          console.warn("refresh logs failed", e);
        }
      }

      setMessage("Analysis complete");
      closeCamera();
    } catch (err) {
      console.error("capturePhoto error:", err);
      setMessage("Upload/analysis failed");
      closeCamera();
    }
  };

  // ---------- create plant when AI couldn't detect ----------
  const handleCreatePlantFromImage = async ({ name, species, plantedAt, imageUrl, analysis }) => {
    try {
      setMessage("Saving plant...");
      // create plant
      const res = await fetch(`${API_URL}/api/plants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, species, plantedAt: plantedAt || new Date().toISOString() }),
      });
      const created = await res.json();

      // create manual log if backend supports it
      try {
        await fetch(`${API_URL}/api/logs/manual`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plantId: created._id, imageUrl, analysis }),
        });
      } catch (err) {
        console.warn("manual log not created (backend may not support):", err);
      }

      // update frontend
      setPlants((prev) => [created, ...prev]);
      // fetch logs for new plant
      try {
        const r = await fetch(`${API_URL}/api/logs/plant/${created._id}`);
        const arr = await r.json();
        setLogs((prev) => ({ ...prev, [created._1d]: arr || [] })); // best-effort (typo-safe)
      } catch (e) {
        // ignore
      }

      setMessage("Plant created");
    } catch (err) {
      console.error("handleCreatePlantFromImage error:", err);
      setMessage("Failed to create plant");
    } finally {
      setAskingPlantInfo(null);
    }
  };

  // ---------- estimate growth period helper ----------
  // prefer analysis.estimatedGrowthDays else species heuristic
  const estimateGrowth = (analysis, species) => {
    if (analysis && typeof analysis.estimatedGrowthDays === "number") {
      return { days: analysis.estimatedGrowthDays, note: "Estimated by AI" };
    }
    return speciesGrowthEstimate(species || (analysis && analysis.species));
  };

  // ---------- UI ----------
  return (
    <div className="w-full min-h-screen bg-gradient-to-b from-green-50 to-emerald-100 p-4 flex flex-col items-center">
      <h1 className="text-3xl font-bold text-emerald-800 mb-4">🌿 PlantBuddy</h1>

      {/* Manual Add */}
      <div className="w-full max-w-lg bg-white rounded-xl shadow p-4 mb-6">
        <h2 className="text-lg font-semibold mb-2">Add New Plant (manual)</h2>
        <AddPlantForm onAdd={async (name, species, plantedDate) => await addPlant(name, species, plantedDate)} />
      </div>

      {/* Plants Grid */}
      <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-4">
        {plants.map((p) => (
          <div key={p._id} className="bg-white rounded-xl shadow p-4">
            <div className="flex justify-between">
              <div>
                <h3 className="text-lg font-semibold">{p.name}</h3>
                <p className="text-sm text-gray-500">{p.species || "Unknown species"}</p>
                <p className="text-xs text-gray-400">Planted: {p.plantedAt ? new Date(p.plantedAt).toLocaleDateString() : "—"}</p>
                <div className="mt-1 text-sm font-medium text-green-700">{getGrowthStage(p.plantedAt)}</div>
              </div>

              <div className="flex flex-col gap-2">
                <button onClick={() => openCamera(p._id)} className="bg-emerald-500 text-white px-3 py-1 rounded">📷 Capture</button>
                <button onClick={() => archivePlant(p._id)} className="bg-gray-500 text-white px-3 py-1 rounded">✅ Archive</button>
                <button onClick={() => deletePlant(p._id)} className="bg-red-600 text-white px-3 py-1 rounded">🗑 Delete</button>
              </div>
            </div>

            {/* Growth chart */}
            {(logs[p._id] || []).length > 0 && (
              <div className="mt-3">
                <Line
                  data={{
                    labels: logs[p._id].map((l) => (l.createdAt ? new Date(l.createdAt).toLocaleDateString() : "")),
                    datasets: [{ label: "Health Score (%)", data: logs[p._id].map((l) => l.healthScore || 0), borderWidth: 2 }],
                  }}
                  height={120}
                />
              </div>
            )}

            {/* recent logs */}
            <div className="mt-3 space-y-2">
              {(logs[p._id] || []).slice(0, 4).map((log, idx) => (
                <div key={log._id || idx} className="border rounded p-2">
                  <div className="text-xs text-gray-500">{log.createdAt ? new Date(log.createdAt).toLocaleString() : "—"}</div>
                  <div className="font-semibold">{log.summary || "No summary"} ({log.healthScore ?? "—"}%)</div>
                  {log.issues?.length > 0 && <div className="text-sm text-green-700 mt-1">Issues: {log.issues.join(", ")}</div>}
                  {log.wateringSuggestion && <div className="text-sm mt-1"><strong>Watering:</strong> {log.wateringSuggestion}</div>}
                  {log.fertilizerSuggestion && <div className="text-sm mt-1"><strong>Fertilizer:</strong> {log.fertilizerSuggestion}</div>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Camera modal */}
      {cameraOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-4 w-full max-w-md">
            <video ref={videoRef} className="w-full rounded mb-3 bg-black" />
            <canvas ref={canvasRef} className="hidden" />

            <div className="flex gap-2">
              <button onClick={capturePhoto} className="flex-1 bg-emerald-600 text-white py-2 rounded">Capture</button>
              <button onClick={closeCamera} className="flex-1 bg-gray-300 py-2 rounded">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Ask user when no plant detected */}
      {askingPlantInfo && (
        <AskPlantModal
          data={askingPlantInfo}
          onCancel={() => setAskingPlantInfo(null)}
          onSave={handleCreatePlantFromImage}
          estimateGrowth={estimateGrowth}
        />
      )}

      <p className="mt-4 text-gray-600">{message}</p>
    </div>
  );
}

/* ---------------------------
   AddPlantForm component
   --------------------------- */
function AddPlantForm({ onAdd }) {
  const [name, setName] = useState("");
  const [species, setSpecies] = useState("");
  const [plantedDate, setPlantedDate] = useState("");

  return (
    <div>
      <input className="w-full border rounded p-2 mb-2" placeholder="Plant name" value={name} onChange={(e) => setName(e.target.value)} />
      <input className="w-full border rounded p-2 mb-2" placeholder="Species (optional)" value={species} onChange={(e) => setSpecies(e.target.value)} />
      <input type="date" className="w-full border rounded p-2 mb-2" value={plantedDate} onChange={(e) => setPlantedDate(e.target.value)} />
      <button className="w-full bg-emerald-600 text-white py-2 rounded" onClick={() => {
        if (!name.trim()) { alert("Enter name"); return; }
        onAdd(name.trim(), species.trim() || null, plantedDate || null);
        setName(""); setSpecies(""); setPlantedDate("");
      }}>Add Plant</button>
    </div>
  );
}

/* ---------------------------
   AskPlantModal component
   --------------------------- */
function AskPlantModal({ data, onCancel, onSave, estimateGrowth }) {
  const [name, setName] = useState("");
  const [species, setSpecies] = useState("");
  const [plantedDate, setPlantedDate] = useState(new Date().toISOString().slice(0,10));

  // show AI hint if available
  const aiHint = data.analysis && (data.analysis.species || data.analysis.summary || data.analysis.estimatedGrowthDays);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-60">
      <div className="bg-white rounded-xl p-4 w-full max-w-lg">
        <h3 className="text-lg font-semibold mb-2">Plant not detected — please add details</h3>

        {data.imageUrl && <img src={data.imageUrl} alt="captured" className="w-full max-h-48 object-contain mb-3 rounded" />}

        {aiHint && <p className="text-sm text-gray-600 mb-2">AI hint: {String(aiHint)}</p>}

        <input className="w-full border rounded p-2 mb-2" placeholder="Plant name (e.g., My Tomato)" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="w-full border rounded p-2 mb-2" placeholder="Species (optional, e.g., tomato)" value={species} onChange={(e) => setSpecies(e.target.value)} />
        <label className="text-sm text-gray-500">Planted date</label>
        <input type="date" className="w-full border rounded p-2 mb-3" value={plantedDate} onChange={(e) => setPlantedDate(e.target.value)} />

        <div className="flex gap-2">
          <button onClick={() => {
            if (!name.trim()) { alert("Enter plant name"); return; }
            onSave({ name: name.trim(), species: species.trim() || null, plantedAt: plantedDate, imageUrl: data.imageUrl, analysis: data.analysis });
          }} className="flex-1 bg-emerald-600 text-white py-2 rounded">Save Plant</button>

          <button onClick={onCancel} className="flex-1 bg-gray-300 py-2 rounded">Cancel</button>
        </div>

        {/* show estimate if available */}
        {estimateGrowth && <div className="mt-3 text-sm text-gray-700">
          <strong>Estimate:</strong> {JSON.stringify(estimateGrowth(data.analysis, data.analysis?.species))}
        </div>}
      </div>
    </div>
  );
}
