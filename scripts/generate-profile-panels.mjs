#!/usr/bin/env node

import { resolve } from "node:path";
import { loadConfig, readFlag, repositoryRoot } from "./lib/config.mjs";
import { generateProfilePanelsAssets } from "./lib/profile-panels.mjs";

try {
  const config = await loadConfig(readFlag("--config"));

  await generateProfilePanelsAssets({
    config,
    outputDirectory: resolve(repositoryRoot, "assets/profile")
  });

  console.log(`Profile panels generated for ${config.profile.username}.`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
