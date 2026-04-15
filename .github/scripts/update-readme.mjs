import { readFileSync, writeFileSync } from "node:fs";

const owner = process.env.GITHUB_REPOSITORY_OWNER;

if (!owner) {
  throw new Error("Missing required GITHUB_REPOSITORY_OWNER.");
}

const headers = {
  Accept: "application/vnd.github+json",
  "User-Agent": "profile-readme-updater",
};

const token = process.env.GITHUB_TOKEN;
if (token) {
  headers.Authorization = `Bearer ${token}`;
}

async function gh(url) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`GitHub API error ${res.status}: ${url}`);
  return res.json();
}

const repos = await gh(
  `https://api.github.com/users/${owner}/repos?per_page=100&sort=pushed`
);
const ownRepos = repos.filter((r) => !r.fork && !r.archived && r.name !== owner);

const latest = ownRepos
  .sort((a, b) => new Date(b.pushed_at) - new Date(a.pushed_at))
  .slice(0, 8);

const langCount = new Map();
for (const r of ownRepos) {
  if (!r.language) continue;
  langCount.set(r.language, (langCount.get(r.language) || 0) + 1);
}

const topStack = [...langCount.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10)
  .map(([lang, count]) => `- **${lang}** (${count} repos)`)
  .join("\n");

const recentProjects = latest
  .map((r) => {
    const desc = r.description ? ` - ${r.description}` : "";
    return `- [${r.name}](${r.html_url})${desc}`;
  })
  .join("\n");

const readme = readFileSync("README.md", "utf8");

function replaceSection(content, start, end, replacement) {
  const regex = new RegExp(`(${start}[\\s\\S]*?\\n)([\\s\\S]*?)(\\n${end})`, "m");
  if (!regex.test(content)) {
    throw new Error(`Missing section markers: ${start} ... ${end}`);
  }
  return content.replace(regex, `$1${replacement}$3`);
}

let updated = readme;
updated = replaceSection(
  updated,
  "<!--START_SECTION:projects-->",
  "<!--END_SECTION:projects-->",
  recentProjects || "- No public projects found."
);

updated = replaceSection(
  updated,
  "<!--START_SECTION:stack-->",
  "<!--END_SECTION:stack-->",
  topStack || "- No language data available yet."
);

writeFileSync("README.md", updated, "utf8");
console.log("README updated.");
