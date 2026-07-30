import { paletteDefinitions } from "./palette.mjs";

function badgeSegment(value) {
  return encodeURIComponent(String(value).replaceAll("-", "--").replaceAll("_", "__").replaceAll(" ", "_"));
}

/**
 * Builds a centered row of real, clickable badge links — one per project —
 * styled with the active theme's accent colors so they sit visually in line
 * with the animated SVG panels, while still being genuine <a href> links
 * (SVGs embedded via <img> cannot carry working hyperlinks in any renderer).
 */
export function buildProjectLinksMarkdown(config) {
  const palette = paletteDefinitions[config.appearance.palette].dark;
  const accents = [palette.cyan, palette.violet, palette.green, palette.blue];

  const badges = config.projects.map((project, index) => {
    const accent = accents[index % accents.length].replace("#", "");
    const target = project.homepage || project.url;
    const image = `https://img.shields.io/badge/${badgeSegment(project.name)}-${badgeSegment(`Open ${project.homepage ? "Live" : "Repository"}`)}-${accent}?style=for-the-badge&logo=github&logoColor=white`;
    return `  <a href="${target}"><img alt="${project.name}" src="${image}"></a>`;
  });

  return `<p align="center">\n${badges.join("\n")}\n</p>`;
}
