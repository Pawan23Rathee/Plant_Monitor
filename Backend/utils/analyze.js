// utils/analyze.js

const OPENAI_KEY = process.env.AI_API_KEY;
const MODEL = process.env.AI_MODEL || "gpt-4o-mini";


module.exports = async function analyze(imageUrl) {
  // -------------------------------------------------
  // DEMO MODE (if API key missing)
  // -------------------------------------------------
  if (!OPENAI_KEY) {
    return {
      isPlant: false,
      healthScore: 0,
      summary: "AI disabled — No plant detection",
      issues: [],
      recommendations: ["Enable AI_API_KEY for real analysis"],
      wateringSuggestion: "",
      fertilizerSuggestion: "",
      todayCare: "",
      raw: { demo: true }
    };
  }

  // -------------------------------------------------
  // STRICT JSON-ONLY ANALYSIS PROMPT
  // -------------------------------------------------
  const prompt = `
You are a strict plant detection + plant health analysis system.

1) First detect: "Is there a plant visible in this image?"

2) If NO plant is detected, return EXACTLY this JSON:

{
  "isPlant": false,
  "healthScore": 0,
  "summary": "No plant detected",
  "issues": [],
  "recommendations": [],
  "wateringSuggestion": "",
  "fertilizerSuggestion": "",
  "todayCare": ""
}

3) If a plant IS detected, return ONLY this JSON:

{
  "isPlant": true,
  "healthScore": 0-100,
  "summary": "short summary",
  "issues": ["..."],
  "recommendations": ["..."],
  "wateringSuggestion": "short advice",
  "fertilizerSuggestion": "organic advice like gobar ki khaad",
  "todayCare": "what to do today"
}

Image URL: ${imageUrl}

Return JSON ONLY. No explanations.
`;

  // -------------------------------------------------
  // REQUEST BODY (OpenAI Responses API)
  // -------------------------------------------------
  const body = {
    model: MODEL,
    input: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt }
        ]
      }
    ]
  };

  try {
    // -------------------------------------------------
    // OPENAI API CALL
    // -------------------------------------------------
    const resp = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    const json = await resp.json();

    // -------------------------------------------------
    // EXTRACT RAW TEXT SAFELY
    // -------------------------------------------------
    let text = "";
    try {
      text =
        json.output?.[0]?.content?.[0]?.text ||
        json.output_text ||
        JSON.stringify(json);
    } catch {
      text = JSON.stringify(json);
    }

    // -------------------------------------------------
    // MATCH JSON BLOCK ONLY
    // -------------------------------------------------
    const match = text.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(match ? match[0] : text);

    // -------------------------------------------------
    // FINAL NORMALIZED RESPONSE
    // -------------------------------------------------
    return {
      isPlant: parsed.isPlant ?? false,
      healthScore: parsed.healthScore || 0,
      summary: parsed.summary || "",
      issues: parsed.issues || [],
      recommendations: parsed.recommendations || [],
      wateringSuggestion: parsed.wateringSuggestion || "",
      fertilizerSuggestion: parsed.fertilizerSuggestion || "",
      todayCare: parsed.todayCare || "",
      raw: parsed
    };

  } catch (err) {
    console.error("Analyze error:", err);

    // -------------------------------------------------
    // FAILSAFE RESPONSE
    // -------------------------------------------------
    return {
      isPlant: false,
      healthScore: 0,
      summary: "Analysis failed",
      issues: [],
      recommendations: [],
      wateringSuggestion: "",
      fertilizerSuggestion: "",
      todayCare: "",
      raw: { error: err.message }
    };
  }
};
