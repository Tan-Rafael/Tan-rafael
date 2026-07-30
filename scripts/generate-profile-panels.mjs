#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { loadConfig, readFlag, repositoryRoot } from "./lib/config.mjs";
import { generateProfilePanelsAssets } from "./lib/profile-panels.mjs";
import { buildProjectLinksMarkdown } from "./lib/project-links.mjs";
import { PROJECT_LINKS_END, PROJECT_LINKS_START } from "./lib/readme.mjs";

function replaceProjectLinks(readme, content) {
  const startIndex = readme.indexOf(PROJECT_LINKS_START);
  const endIndex = readme.indexOf(PROJECT_LINKS_END);
  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    throw new Error("README project-link markers are missing. Add <!-- AUTO:PROJECT_LINKS:START --> / <!-- AUTO:PROJECT_LINKS:END --> below the Featured Work panel first.");
  }
  return `${readme.slice(0, startIndex + PROJECT_LINKS_START.length)}\n${content}\n${readme.slice(endIndex)}`;
}

try {
  const config = await loadConfig(readFlag("--config"));

  await generateProfilePanelsAssets({
    config,
    outputDirectory: resolve(repositoryRoot, "assets/profile")
  });

  const readmePath = resolve(repositoryRoot, "README.md");
  const readme = await readFile(readmePath, "utf8");
  if (readme.includes(PROJECT_LINKS_START)) {
    const content = buildProjectLinksMarkdown(config);
    await writeFile(readmePath, replaceProjectLinks(readme, content));
    console.log(`Profile panels and clickable project links generated for ${config.profile.username}.`);
  } else {
    console.log(`Profile panels generated for ${config.profile.username}. (No PROJECT_LINKS markers found in README.md — skipped link update.)`);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
