// List available Gemini models for your API key.
// Run: node scripts/list-models.mjs

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "..", ".env.local");

const env = readFileSync(envPath, "utf8");
for (const line of env.split(/\r?\n/)) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;

const resp = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
);
const data = await resp.json();

if (!data.models) {
  console.log("ERROR:", JSON.stringify(data, null, 2));
  process.exit(1);
}

console.log(`Found ${data.models.length} models:\n`);
for (const m of data.models) {
  const supports = m.supportedGenerationMethods || [];
  if (supports.includes("generateContent") || supports.includes("streamGenerateContent")) {
    console.log(`  ${m.name.replace("models/", "")}  (${supports.join(", ")})`);
  }
}
