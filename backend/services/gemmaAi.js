const baseUrl = (process.env.LM_STUDIO_BASE_URL || "http://localhost:1234").replace(/\/+$/, "");
const model = process.env.GEMMA_MODEL || "google/gemma-4-e2b";

const GENRE_CLASSIFICATION_PROMPT = [
  "You are an expert music genre classification engine.",
  "",
  "Analyze the provided song lyrics and identify:",
  "",
  "1. Likely musical genre",
  "2. Possible subgenres",
  "3. Main lyrical themes",
  "4. Emotional atmosphere",
  "5. Language",
  "6. Confidence level",
  "",
  "IMPORTANT:",
  "- Base your analysis on the lyrical content.",
  "- Do not invent musical characteristics that cannot",
  "  be determined from lyrics alone.",
  "- Distinguish between lyrical themes and musical genre.",
  "- Multiple genres may be appropriate.",
  "- If the lyrics do not provide sufficient information,",
  "  explicitly state that.",
  "",
  "Return valid JSON:",
  "",
  "{",
  '  "genre": [],',
  '  "subgenres": [],',
  '  "themes": [],',
  '  "mood": [],',
  '  "language": "",',
  '  "confidence": 0,',
  '  "explanation": ""',
  "}",
].join("\n");

async function askGemma(input) {
  if (typeof input !== "string" || !input.trim()) {
    throw new TypeError("Gemma input must be a non-empty string");
  }

  const headers = { "Content-Type": "application/json" };
  if (process.env.LM_STUDIO_API_TOKEN) {
    headers.Authorization = "Bearer " + process.env.LM_STUDIO_API_TOKEN;
  }

  const response = await fetch(baseUrl + "/api/v1/chat", {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      input: input.trim(),
      system_prompt: GENRE_CLASSIFICATION_PROMPT,
      store: false,
    }),
  });

  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(
      "LM Studio chat failed (" +
        response.status +
        "): " +
        (responseText || response.statusText),
    );
  }

  let result;
  try {
    result = JSON.parse(responseText);
  } catch {
    throw new Error("LM Studio returned invalid JSON");
  }

  const answer = Array.isArray(result.output)
    ? result.output
        .filter((item) => item.type === "message" && typeof item.content === "string")
        .map((item) => item.content)
        .join("\n")
        .trim()
    : "";

  if (!answer) {
    throw new Error("LM Studio returned no text message");
  }
  return answer;
}

function normalizeStringList(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

async function analyzeLyricsGenre(lyrics) {
  if (typeof lyrics !== "string" || !lyrics.trim()) {
    throw new TypeError("Lyrics are required for genre analysis");
  }

  const answer = await askGemma(lyrics);

  const jsonCandidate = answer.match(/\{[\s\S]*\}/)?.[0];
  if (!jsonCandidate) throw new Error("Gemma returned no JSON genre analysis");

  let result;
  try {
    result = JSON.parse(jsonCandidate);
  } catch {
    throw new Error("Gemma returned invalid JSON genre analysis");
  }
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    throw new Error("Gemma returned an invalid genre analysis");
  }

  const confidence = Number(result.confidence);
  return {
    genre: normalizeStringList(result.genre),
    subgenres: normalizeStringList(result.subgenres),
    themes: normalizeStringList(result.themes),
    mood: normalizeStringList(result.mood),
    language: typeof result.language === "string" ? result.language.trim() : "",
    confidence: Number.isFinite(confidence)
      ? Math.min(1, Math.max(0, confidence))
      : 0,
    explanation:
      typeof result.explanation === "string" ? result.explanation.trim() : "",
  };
}

module.exports = { askGemma, analyzeLyricsGenre };