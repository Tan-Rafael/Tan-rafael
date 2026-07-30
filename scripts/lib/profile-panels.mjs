import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { escapeXml } from "./xml.mjs";
import { paletteDefinitions } from "./palette.mjs";

const WIDTH = 1180;
const OUTER_RADIUS = 18;
const MARGIN = 14;
const GAP = 16;
const CHAR_W = 7.1; // rough monospace advance at font-size 12

function panel(x, y, width, height, colors, accent, opacity = 0.4) {
  return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${width.toFixed(1)}" height="${height.toFixed(1)}" rx="14" fill="${colors.panel}" fill-opacity="${opacity}" stroke="${accent}" stroke-opacity="0.35"/>
<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${width.toFixed(1)}" height="3" rx="1.5" fill="${accent}" opacity="0.75"/>`;
}

function sectionTitle(x, y, label, colors, accent) {
  return `<circle cx="${(x - 10).toFixed(1)}" cy="${(y - 4.5).toFixed(1)}" r="3.4" fill="${accent}"><animate attributeName="opacity" values="1;0.3;1" dur="1.6s" repeatCount="indefinite"/></circle>
<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" class="panel-title">${escapeXml(label)}</text>`;
}

function wrapText(text, maxChars) {
  const words = text.split(" ");
  const lines = [];
  let current = "";
  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  });
  if (current) lines.push(current);
  return lines;
}

/* ---------------------------------------------------------------------- */
/* Background — same circuit-grid / corner-bracket language as ai-metrics */
/* ---------------------------------------------------------------------- */
function buildBackground(colors, width, height) {
  const gridLines = [];
  for (let gx = 0; gx <= width; gx += 44) {
    gridLines.push(`<line x1="${gx}" y1="0" x2="${gx}" y2="${height}" stroke="${colors.cyan}" stroke-width="0.5" opacity="0.04"/>`);
  }
  for (let gy = 0; gy <= height; gy += 44) {
    gridLines.push(`<line x1="0" y1="${gy}" x2="${width}" y2="${gy}" stroke="${colors.cyan}" stroke-width="0.5" opacity="0.04"/>`);
  }
  const nodes = [[0.03, 0.15], [0.06, 0.55], [0.04, 0.9], [0.97, 0.2], [0.95, 0.6], [0.97, 0.9]];
  const dots = nodes.map(([fx, fy], i) => {
    const x = (fx * width).toFixed(1);
    const y = (fy * height).toFixed(1);
    const dur = (4 + (i % 5)).toFixed(1);
    return `<circle cx="${x}" cy="${y}" r="1.6" fill="${colors.cyan}" opacity="0.3"><animate attributeName="opacity" values="0.1;0.5;0.1" dur="${dur}s" repeatCount="indefinite"/></circle>`;
  }).join("");
  const corners = [[9, 9, 1, 1], [width - 9, 9, -1, 1], [9, height - 9, 1, -1], [width - 9, height - 9, -1, -1]];
  const arm = 26;
  const frames = corners.map(([x, y, dx, dy], index) =>
    `<path d="M ${x} ${(y + arm * dy).toFixed(1)} L ${x} ${y} L ${(x + arm * dx).toFixed(1)} ${y}" fill="none" stroke="${colors.cyan}" stroke-width="1.6" opacity="0.5"><animate attributeName="opacity" values="0.28;0.8;0.28" dur="${(3 + index * 0.4).toFixed(1)}s" repeatCount="indefinite"/></path>`
  ).join("");
  return `<g aria-hidden="true" opacity="0.7">${gridLines.join("")}</g><g aria-hidden="true">${dots}</g><g aria-hidden="true">${frames}</g>
<rect x="0" y="0" width="${width}" height="40" fill="url(#scanSweep)" opacity="0.5"><animate attributeName="y" values="-${height};${height}" dur="10s" repeatCount="indefinite"/></rect>`;
}

/* ---------------------------------------------------------------------- */
/* About / Research — terminal-style typed paragraph block                */
/* ---------------------------------------------------------------------- */
function buildTextBlock(title, paragraphs, colors, accent, box) {
  const lines = paragraphs.flatMap((p) => wrapText(p, Math.floor((box.width - 60) / CHAR_W)));
  const lineH = 22;
  const rows = lines.map((line, i) => {
    const y = box.y + 58 + i * lineH;
    const len = line.length * CHAR_W;
    const dur = (0.5 + i * 0.18).toFixed(2);
    return `<text x="${(box.x + 40).toFixed(1)}" y="${y.toFixed(1)}" class="mono" font-size="13.5" fill="${colors.primary}" opacity="0"><animate attributeName="opacity" from="0" to="1" dur="0.4s" begin="${dur}s" fill="freeze"/>${escapeXml(line)}</text>
<rect x="${(box.x + 40).toFixed(1)}" y="${(y - 12).toFixed(1)}" width="${len.toFixed(1)}" height="14" fill="${accent}" opacity="0.12"><animate attributeName="width" from="0" to="${len.toFixed(1)}" dur="0.35s" begin="${dur}s" fill="freeze"/></rect>`;
  }).join("\n");
  const cursorY = box.y + 58 + lines.length * lineH - 11;
  const height = 58 + lines.length * lineH + 18;
  return {
    height,
    markup: `${panel(box.x, box.y, box.width, height, colors, accent)}
${sectionTitle(box.x + 40, box.y + 30, title, colors, accent)}
<path d="M ${(box.x + 22).toFixed(1)} ${(box.y + 46).toFixed(1)} l 6 6 l -6 6" fill="none" stroke="${accent}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" opacity="0.7"/>
${rows}
<rect x="${(box.x + 40).toFixed(1)}" y="${cursorY.toFixed(1)}" width="7" height="14" fill="${accent}"><animate attributeName="opacity" values="1;0;1" dur="0.9s" repeatCount="indefinite"/></rect>`
  };
}

/* ---------------------------------------------------------------------- */
/* Current Focus — animated glow cards                                    */
/* ---------------------------------------------------------------------- */
function buildFocusGrid(focus, colors, box) {
  const accents = [colors.cyan, colors.violet, colors.green, colors.blue];
  const gap = 14;
  const cardWidth = (box.width - gap * (focus.length - 1)) / focus.length;
  const cardHeight = 148;
  const cards = focus.map((item, index) => {
    const x = box.x + index * (cardWidth + gap);
    const y = box.y + 44;
    const accent = accents[index % accents.length];
    const lines = wrapText(item.description, Math.floor((cardWidth - 36) / 6.4));
    const desc = lines.slice(0, 4).map((line, i) => `<text x="${(x + 18).toFixed(1)}" y="${(y + 66 + i * 16).toFixed(1)}" class="mono" font-size="10.8" fill="${colors.muted}">${escapeXml(line)}</text>`).join("\n");
    const dur = (2.4 + index * 0.3).toFixed(1);
    return `<g>
<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${cardWidth.toFixed(1)}" height="${cardHeight}" rx="12" fill="${colors.panel}" fill-opacity="0.4" stroke="${accent}" stroke-opacity="0.4"/>
<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${cardWidth.toFixed(1)}" height="${cardHeight}" rx="12" fill="none" stroke="${accent}" stroke-opacity="0" stroke-width="1.6"><animate attributeName="stroke-opacity" values="0.15;0.65;0.15" dur="${dur}s" repeatCount="indefinite"/></rect>
<circle cx="${(x + 26).toFixed(1)}" cy="${(y + 28).toFixed(1)}" r="11" fill="${accent}" opacity="0.18"/>
<circle cx="${(x + 26).toFixed(1)}" cy="${(y + 28).toFixed(1)}" r="11" fill="none" stroke="${accent}" stroke-width="1.4" opacity="0.75"><animate attributeName="r" values="11;13.5;11" dur="${dur}s" repeatCount="indefinite"/></circle>
<circle cx="${(x + 26).toFixed(1)}" cy="${(y + 28).toFixed(1)}" r="4" fill="${accent}"/>
<text x="${(x + 46).toFixed(1)}" y="${(y + 32).toFixed(1)}" class="mono" font-size="13" font-weight="700" fill="${colors.primary}">${escapeXml(item.name)}</text>
${desc}
</g>`;
  }).join("\n");
  return { height: box.y === undefined ? 0 : 44 + cardHeight + 14, markup: cards };
}

/* ---------------------------------------------------------------------- */
/* Featured Work — project cards with animated top border                 */
/* ---------------------------------------------------------------------- */
function buildProjectGrid(projects, colors, box) {
  const accents = [colors.violet, colors.cyan, colors.green, colors.blue];
  const gap = 14;
  const perRow = projects.length <= 2 ? projects.length : 3;
  const rows = Math.ceil(projects.length / perRow);
  const cardWidth = (box.width - gap * (perRow - 1)) / perRow;
  const cardHeight = 118;

  const cards = projects.map((project, index) => {
    const row = Math.floor(index / perRow);
    const col = index % perRow;
    const x = box.x + col * (cardWidth + gap);
    const y = box.y + 44 + row * (cardHeight + gap);
    const accent = accents[index % accents.length];
    const lines = wrapText(project.summary, Math.floor((cardWidth - 36) / 6.6)).slice(0, 2);
    const desc = lines.map((line, i) => `<text x="${(x + 18).toFixed(1)}" y="${(y + 68 + i * 15).toFixed(1)}" class="mono" font-size="10.5" fill="${colors.muted}">${escapeXml(line)}</text>`).join("\n");
    const dur = (1.6 + index * 0.25).toFixed(2);
    return `<g>
<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${cardWidth.toFixed(1)}" height="${cardHeight}" rx="12" fill="${colors.panel}" fill-opacity="0.4" stroke="${accent}" stroke-opacity="0.35"/>
<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="0" height="3" rx="1.5" fill="${accent}"><animate attributeName="width" from="0" to="${cardWidth.toFixed(1)}" dur="${dur}s" begin="0.2s" fill="freeze"/></rect>
<text x="${(x + 18).toFixed(1)}" y="${(y + 28).toFixed(1)}" class="mono" font-size="13" font-weight="700" fill="${colors.primary}">${escapeXml(project.name)}</text>
<rect x="${(x + 18).toFixed(1)}" y="${(y + 36).toFixed(1)}" width="${(project.focus.length * 6.4 + 16).toFixed(1)}" height="17" rx="8.5" fill="${accent}" opacity="0.16"/>
<text x="${(x + 26).toFixed(1)}" y="${(y + 48).toFixed(1)}" class="mono" font-size="9.8" fill="${accent}">${escapeXml(project.focus.toUpperCase())}</text>
${desc}
<circle cx="${(x + cardWidth - 16).toFixed(1)}" cy="${(y + 18).toFixed(1)}" r="3" fill="${colors.green}"><animate attributeName="opacity" values="1;0.25;1" dur="1.3s" repeatCount="indefinite"/></circle>
</g>`;
  }).join("\n");

  const height = 44 + rows * cardHeight + (rows - 1) * gap + 14;
  return { height, markup: cards };
}

/* ---------------------------------------------------------------------- */
/* Tech Stack — glowing pill chips, wrapped                               */
/* ---------------------------------------------------------------------- */
function buildTechStack(items, colors, box) {
  const accents = [colors.cyan, colors.violet, colors.green, colors.blue];
  const paddingX = 16;
  const chipH = 30;
  const gapX = 10;
  const gapY = 12;
  let cursorX = box.x + 22;
  let cursorY = box.y + 52;
  const maxX = box.x + box.width - 22;

  const chips = items.map((label, index) => {
    const width = label.length * 7.3 + paddingX * 2;
    if (cursorX + width > maxX) {
      cursorX = box.x + 22;
      cursorY += chipH + gapY;
    }
    const accent = accents[index % accents.length];
    const x = cursorX;
    const y = cursorY;
    cursorX += width + gapX;
    const dur = (2 + (index % 6) * 0.3).toFixed(1);
    return `<g>
<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${width.toFixed(1)}" height="${chipH}" rx="15" fill="${colors.panel}" fill-opacity="0.5" stroke="${accent}" stroke-opacity="0.45"/>
<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${width.toFixed(1)}" height="${chipH}" rx="15" fill="none" stroke="${accent}" stroke-opacity="0"><animate attributeName="stroke-opacity" values="0.15;0.7;0.15" dur="${dur}s" repeatCount="indefinite"/></rect>
<circle cx="${(x + 14).toFixed(1)}" cy="${(y + chipH / 2).toFixed(1)}" r="3" fill="${accent}"><animate attributeName="opacity" values="1;0.3;1" dur="${dur}s" repeatCount="indefinite"/></circle>
<text x="${(x + 24).toFixed(1)}" y="${(y + chipH / 2 + 4.5).toFixed(1)}" class="mono" font-size="11.5" fill="${colors.primary}">${escapeXml(label)}</text>
</g>`;
  }).join("\n");

  const height = cursorY - box.y + chipH + 20;
  return { height, markup: chips };
}

/* ---------------------------------------------------------------------- */
/* Assemble                                                                */
/* ---------------------------------------------------------------------- */
function createProfileSvg(config, colors) {
  const titlebarH = 44;
  let y = titlebarH + GAP;
  const width = WIDTH - MARGIN * 2;
  const x = MARGIN;
  const blocks = [];

  const about = buildTextBlock("ABOUT.ME", config.profile.about, colors, colors.cyan, { x, y, width });
  blocks.push(about.markup);
  y += about.height + GAP;

  const focusBox = { x, y, width };
  const focus = buildFocusGrid(config.focus, colors, focusBox);
  const focusHeight = 44 + 148 + 14;
  blocks.push(`${panel(x, y, width, focusHeight, colors, colors.violet)}
${sectionTitle(x + 40, y + 30, "CURRENT.FOCUS", colors, colors.violet)}
${focus.markup}`);
  y += focusHeight + GAP;

  const work = buildProjectGrid(config.projects, colors, { x, y, width });
  blocks.push(`${panel(x, y, width, work.height, colors, colors.green)}
${sectionTitle(x + 40, y + 30, "FEATURED.WORK", colors, colors.green)}
${work.markup}`);
  y += work.height + GAP;

  const research = buildTextBlock("RESEARCH.DIRECTION", [config.research.narrative], colors, colors.blue, { x, y, width });
  blocks.push(research.markup);
  y += research.height + GAP;

  const tech = buildTechStack(config.techStack, colors, { x, y, width });
  blocks.push(`${panel(x, y, width, tech.height, colors, colors.cyan)}
${sectionTitle(x + 40, y + 30, "TECH.STACK", colors, colors.cyan)}
${tech.markup}`);
  y += tech.height + GAP;

  const footerY = y + 20;
  const height = footerY + 20;
  const username = escapeXml(config.profile.username);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${height}" viewBox="0 0 ${WIDTH} ${height}" role="img" aria-labelledby="pTitle pDesc">
<title id="pTitle">${escapeXml(config.profile.name)} - Profile Console</title>
<desc id="pDesc">An animated cyber-console rendering of the about, focus, featured work, research, and tech-stack sections.</desc>
<defs>
  <linearGradient id="pBackground" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${colors.backgroundStart}"/><stop offset="1" stop-color="${colors.backgroundEnd}"/></linearGradient>
  <linearGradient id="pBorder" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${colors.violet}"/><stop offset="0.5" stop-color="${colors.cyan}"/><stop offset="1" stop-color="${colors.green}"/></linearGradient>
  <linearGradient id="scanSweep" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${colors.cyan}" stop-opacity="0"/><stop offset="0.5" stop-color="${colors.cyan}" stop-opacity="0.12"/><stop offset="1" stop-color="${colors.cyan}" stop-opacity="0"/></linearGradient>
  <style>
    .mono { font-family: 'Courier New', Consolas, monospace; }
    .panel-title { font-family: 'Courier New', Consolas, monospace; font-size: 12.5px; letter-spacing: 1.8px; fill: ${colors.blue}; opacity: 0.85; }
    .live-label { font-family: 'Courier New', Consolas, monospace; font-size: 12px; letter-spacing: 1px; fill: ${colors.red}; }
  </style>
</defs>
<rect width="${WIDTH}" height="${height}" rx="${OUTER_RADIUS}" fill="url(#pBackground)"/>
${buildBackground(colors, WIDTH, height)}
<rect x="3" y="3" width="${WIDTH - 6}" height="${titlebarH - 4}" rx="16" fill="${colors.panel}" fill-opacity="0.86"/>
<circle cx="26" cy="${titlebarH / 2 + 1}" r="5.4" fill="#EF4444"/><circle cx="46" cy="${titlebarH / 2 + 1}" r="5.4" fill="#F59E0B"/><circle cx="66" cy="${titlebarH / 2 + 1}" r="5.4" fill="${colors.green}"/>
<text x="${WIDTH / 2}" y="${titlebarH / 2 + 6}" text-anchor="middle" class="mono" font-size="14.5" letter-spacing="0.6" fill="${colors.muted}">${username}@profile ~ % ./whoami --verbose</text>
<circle cx="${WIDTH - 140}" cy="${titlebarH / 2 + 1}" r="4.6" fill="${colors.green}"><animate attributeName="opacity" values="1;0.15;1" dur="1.1s" repeatCount="indefinite"/></circle>
<text x="${WIDTH - 128}" y="${titlebarH / 2 + 6}" class="mono" font-size="12" letter-spacing="1px" fill="${colors.green}">READY</text>
${blocks.join("\n")}
<rect x="3" y="3" width="${WIDTH - 6}" height="${height - 6}" rx="${OUTER_RADIUS - 2}" fill="none" stroke="url(#pBorder)" stroke-width="2" opacity="0.78"><animate attributeName="opacity" values="0.5;0.95;0.5" dur="3.4s" repeatCount="indefinite"/></rect>
</svg>`;
}

export async function generateProfilePanelsAssets({ config, outputDirectory }) {
  const palette = paletteDefinitions[config.appearance.palette];
  await mkdir(outputDirectory, { recursive: true });
  const assets = { dark: "profile-dark.svg", light: "profile-light.svg" };

  await Promise.all([
    writeFile(resolve(outputDirectory, assets.dark), createProfileSvg(config, palette.dark)),
    writeFile(resolve(outputDirectory, assets.light), createProfileSvg(config, palette.light))
  ]);

  return { assets };
}
