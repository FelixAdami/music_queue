const baseUrl = (process.env.LM_STUDIO_BASE_URL || "http://localhost:1234").replace(/\/+$/, "");
const model = process.env.GEMMA_MODEL || "google/gemma-4-e2b";

const GENRE_CLASSIFICATION_PROMPT = [
  "You classify music using song lyrics.",
  "",
  "Identify only:",
  "1. Likely music genres, based on what the lyrics support.",
  "2. Main themes expressed in the lyrics.",
  "",
  "Lyrics may not provide enough evidence to determine a song's sound.",
  "Do not invent genres or infer subgenres, mood, language, or other details.",
  "Return only valid JSON with exactly these two properties:",
  "",
  "{",
  '  "genres": [],',
  '  "themes": []',
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

  return {
    genres: normalizeStringList(result.genres),
    themes: normalizeStringList(result.themes),
  };
}

module.exports = { askGemma, analyzeLyricsGenre };