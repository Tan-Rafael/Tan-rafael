import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { loadConfig, repositoryRoot } from "./lib/config.mjs";
import { paletteDefinitions, layouts, createHeroSvg } from "./lib/hero.mjs";

function extractAscii(svgText) {
  const match = svgText.match(/<text class="ascii">([\s\S]*?)<\/text>/);
  if (!match) throw new Error("Could not find existing ascii portrait block to reuse.");
  return match[1];
}

async function run() {
  const config = await loadConfig();
  const outputDirectory = resolve(repositoryRoot, "assets/hero");
  const manifest = JSON.parse(await readFile(resolve(outputDirectory, "manifest.json"), "utf8"));
  const palette = paletteDefinitions[config.appearance.palette];

  const desktopAscii = extractAscii(await readFile(resolve(outputDirectory, manifest.assets.desktopDark), "utf8"));
  const mobileAscii = extractAscii(await readFile(resolve(outputDirectory, manifest.assets.mobileDark), "utf8"));

  await writeFile(resolve(outputDirectory, manifest.assets.desktopDark), createHeroSvg(config, palette.dark, "desktop", desktopAscii));
  await writeFile(resolve(outputDirectory, manifest.assets.desktopLight), createHeroSvg(config, palette.light, "desktop", desktopAscii));
  await writeFile(resolve(outputDirectory, manifest.assets.mobileDark), createHeroSvg(config, palette.dark, "mobile", mobileAscii));
  await writeFile(resolve(outputDirectory, manifest.assets.mobileLight), createHeroSvg(config, palette.light, "mobile", mobileAscii));

  console.log("Regenerated 4 hero assets with the quantum ambient theme.");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
