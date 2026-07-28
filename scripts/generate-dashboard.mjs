#!/usr/bin/env node

import { resolve } from "node:path";
import { loadConfig, readFlag, repositoryRoot } from "./lib/config.mjs";
import { fetchGithubStats, buildSampleStats } from "./lib/github-data.mjs";
import { generateDashboardAssets } from "./lib/dashboard.mjs";

const useSample = process.argv.includes("--sample");
const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;

try {
  const config = await loadConfig(readFlag("--config"));
  const stats = useSample
    ? buildSampleStats(config.profile.username)
    : await fetchGithubStats(config.profile.username, token);

  await generateDashboardAssets({
    config,
    stats,
    outputDirectory: resolve(repositoryRoot, "assets/dashboard")
  });

  console.log(`Dashboard generated for ${config.profile.username}${useSample ? " (sample data)" : ""}.`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
