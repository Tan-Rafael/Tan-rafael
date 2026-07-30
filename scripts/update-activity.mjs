#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { loadConfig, repositoryRoot } from "./lib/config.mjs";
import { ACTIVITY_END, ACTIVITY_START } from "./lib/readme.mjs";
import { classifyEvent, generateActivityAssets } from "./lib/activity-panel.mjs";

const dryRun = process.argv.includes("--dry-run");
const useSample = process.argv.includes("--sample");
const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;

function formatDate(value) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function eventToLine(event) {
  const repo = event.repo?.name;
  const info = classifyEvent(event);
  if (!repo || !info) return null;
  const date = formatDate(event.created_at);
  const repoLink = `https://github.com/${repo}`;
  const repoLabel = repo.split("/")[1] || repo;
  return { line: `- ${date}: ${info.text.replace(repoLabel, `[${repo}](${repoLink})`)}.`, item: { kind: info.kind, text: info.text, date } };
}

function sampleEvents() {
  const now = Date.now();
  const day = 86400000;
  return [
    { type: "PushEvent", created_at: new Date(now).toISOString(), repo: { name: "Tan-Rafael/Tan-Rafael" }, payload: { commits: [{}] } },
    { type: "CreateEvent", created_at: new Date(now - day).toISOString(), repo: { name: "Tan-Rafael/Tan-Rafael" }, payload: { ref_type: "branch" } },
    { type: "PushEvent", created_at: new Date(now - day).toISOString(), repo: { name: "Tan-Rafael/Tan-Rafael" }, payload: { commits: [{}] } },
    { type: "CreateEvent", created_at: new Date(now - 2 * day).toISOString(), repo: { name: "Tan-Rafael/Tan-Rafael" }, payload: { ref_type: "branch" } },
    { type: "CreateEvent", created_at: new Date(now - 12 * day).toISOString(), repo: { name: "Tan-Rafael/Anlytix" }, payload: { ref_type: "branch" } },
    { type: "CreateEvent", created_at: new Date(now - 16 * day).toISOString(), repo: { name: "Tan-Rafael/Analisis-Asset" }, payload: { ref_type: "branch" } }
  ];
}

function replaceActivity(readme, content) {
  const startIndex = readme.indexOf(ACTIVITY_START);
  const endIndex = readme.indexOf(ACTIVITY_END);
  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    throw new Error("README activity markers are missing or malformed. Regenerate the profile first.");
  }
  return `${readme.slice(0, startIndex + ACTIVITY_START.length)}\n${content}\n${readme.slice(endIndex)}`;
}

try {
  const config = await loadConfig();
  if (!config.activity.enabled) {
    console.log("Recent activity is disabled in profile.config.json.");
    process.exit(0);
  }

  let events;
  if (useSample) {
    events = sampleEvents();
  } else {
    const headers = { Accept: "application/vnd.github+json", "User-Agent": `${config.profile.username}-profile-readme` };
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(`https://api.github.com/users/${config.profile.username}/events/public?per_page=50`, { headers });
    if (!response.ok) throw new Error(`GitHub API returned ${response.status} ${response.statusText}.`);
    events = await response.json();
  }

  const results = events.map(eventToLine).filter(Boolean);
  const seen = new Set();
  const deduped = results.filter((result) => (seen.has(result.line) ? false : (seen.add(result.line), true))).slice(0, config.activity.limit);
  const lines = deduped.map((result) => result.line);
  const items = deduped.map((result) => result.item);
  const content = lines.length ? lines.join("\n") : "_No recent public activity was found._";

  await generateActivityAssets({ config, items, outputDirectory: resolve(repositoryRoot, "assets/activity") });

  const readmePath = resolve(repositoryRoot, "README.md");
  const readme = await readFile(readmePath, "utf8");
  const nextReadme = replaceActivity(readme, content);

  if (dryRun) {
    console.log(content);
    console.log("\nDry run complete. README.md was not modified.");
  } else {
    await writeFile(readmePath, nextReadme);
    console.log(`README.md activity block and assets/activity panel updated${useSample ? " (sample data)" : ""}.`);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
