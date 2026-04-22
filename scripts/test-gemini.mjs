// Quick Gemini connectivity test. Run with: node scripts/test-gemini.mjs
// Reads GOOGLE_API_KEY from .env.local

import { GoogleGenAI } from "@google/genai";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "..", ".env.local");

try {
  const env = readFileSync(envPath, "utf8");
  for (const line of env.split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch (err) {
  console.error("Could not read .env.local:", err.message);
  process.exit(1);
}

const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("No GOOGLE_API_KEY / GEMINI_API_KEY in .env.local");
  process.exit(1);
}

console.log("Key present, length:", apiKey.length, "starts with:", apiKey.slice(0, 8));

const ai = new GoogleGenAI({ apiKey });

const models = [
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash-lite",
  "gemini-flash-lite-latest",
  "gemini-flash-latest",
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemma-3-4b-it",
  "gemma-3-12b-it",
  "gemma-3-27b-it",
];

for (const model of models) {
  try {
    console.log(`\n--- Testing ${model} ---`);
    const resp = await ai.models.generateContent({
      model,
      contents: [{ role: "user", parts: [{ text: "Say hi in exactly 3 words" }] }],
      config: { maxOutputTokens: 20 },
    });
    console.log(`✅ ${model}: "${resp.text}"`);
  } catch (err) {
    const raw = err?.message || String(err);
    // Extract just the code/status
    const match = raw.match(/"code":\s*(\d+)/);
    const code = match ? match[1] : "?";
    console.log(`❌ ${model}: HTTP ${code} — ${raw.slice(0, 150)}`);
  }
}
