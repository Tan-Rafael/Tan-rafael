import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { escapeXml } from "./xml.mjs";
import { paletteDefinitions } from "./palette.mjs";

const WIDTH = 1180;
const OUTER_RADIUS = 18;
const MARGIN = 14;

function buildBackground(colors, width, height) {
  const gridLines = [];
  for (let gx = 0; gx <= width; gx += 44) {
    gridLines.push(`<line x1="${gx}" y1="0" x2="${gx}" y2="${height}" stroke="${colors.cyan}" stroke-width="0.5" opacity="0.04"/>`);
  }
  for (let gy = 0; gy <= height; gy += 44) {
    gridLines.push(`<line x1="0" y1="${gy}" x2="${width}" y2="${gy}" stroke="${colors.cyan}" stroke-width="0.5" opacity="0.04"/>`);
  }
  const corners = [[9, 9, 1, 1], [width - 9, 9, -1, 1], [9, height - 9, 1, -1], [width - 9, height - 9, -1, -1]];
  const arm = 26;
  const frames = corners.map(([x, y, dx, dy], index) =>
    `<path d="M ${x} ${(y + arm * dy).toFixed(1)} L ${x} ${y} L ${(x + arm * dx).toFixed(1)} ${y}" fill="none" stroke="${colors.cyan}" stroke-width="1.6" opacity="0.5"><animate attributeName="opacity" values="0.28;0.8;0.28" dur="${(3 + index * 0.4).toFixed(1)}s" repeatCount="indefinite"/></path>`
  ).join("");
  return `<g aria-hidden="true" opacity="0.7">${gridLines.join("")}</g><g aria-hidden="true">${frames}</g>
<rect x="0" y="0" width="${width}" height="40" fill="url(#scanSweep)" opacity="0.5"><animate attributeName="y" values="-${height};${height}" dur="10s" repeatCount="indefinite"/></rect>`;
}

const KIND_META = {
  push: { glyph: "▲", accent: "cyan", verb: "PUSH" },
  branch: { glyph: "⑂", accent: "violet", verb: "BRANCH" },
  pull: { glyph: "⇄", accent: "blue", verb: "PULL REQUEST" },
  issue: { glyph: "●", accent: "green", verb: "ISSUE" },
  release: { glyph: "◆", accent: "green", verb: "RELEASE" },
  other: { glyph: "◇", accent: "muted", verb: "EVENT" }
};

function buildRow(item, index, colors, box) {
  const rowH = 46;
  const y = box.y + 62 + index * rowH;
  const meta = KIND_META[item.kind] || KIND_META.other;
  const accent = colors[meta.accent] || colors.cyan;
  const begin = (index * 0.09).toFixed(2);

  return `<g opacity="0"><animate attributeName="opacity" from="0" to="1" dur="0.4s" begin="${begin}s" fill="freeze"/>
<line x1="${(box.x + 26).toFixed(1)}" y1="${(y + 10).toFixed(1)}" x2="${(box.x + box.width - 26).toFixed(1)}" y2="${(y + 10).toFixed(1)}" stroke="${colors.muted}" stroke-opacity="0.14"/>
<circle cx="${(box.x + 26).toFixed(1)}" cy="${y.toFixed(1)}" r="12" fill="${accent}" opacity="0.14"/>
<circle cx="${(box.x + 26).toFixed(1)}" cy="${y.toFixed(1)}" r="12" fill="none" stroke="${accent}" stroke-width="1.3" opacity="0.7"><animate attributeName="opacity" values="0.35;0.9;0.35" dur="${(1.8 + (index % 4) * 0.3).toFixed(1)}s" repeatCount="indefinite"/></circle>
<text x="${(box.x + 26).toFixed(1)}" y="${(y + 4.5).toFixed(1)}" text-anchor="middle" class="mono" font-size="11" fill="${accent}">${meta.glyph}</text>
<rect x="${(box.x + 48).toFixed(1)}" y="${(y - 12).toFixed(1)}" width="${(meta.verb.length * 6.2 + 14).toFixed(1)}" height="16" rx="8" fill="${accent}" opacity="0.14"/>
<text x="${(box.x + 55).toFixed(1)}" y="${(y - 0.5).toFixed(1)}" class="mono" font-size="9.3" letter-spacing="0.5" fill="${accent}">${meta.verb}</text>
<text x="${(box.x + 48 + meta.verb.length * 6.2 + 24).toFixed(1)}" y="${(y - 0.5).toFixed(1)}" class="mono" font-size="11.5" fill="${colors.primary}">${escapeXml(item.text)}</text>
<text x="${(box.x + box.width - 26).toFixed(1)}" y="${(y - 0.5).toFixed(1)}" text-anchor="end" class="mono" font-size="10" fill="${colors.muted}">${escapeXml(item.date)}</text>
</g>`;
}

function createActivitySvg(config, colors, items) {
  const titlebarH = 44;
  const rowH = 46;
  const headerH = 62;
  const footerH = 34;
  const rows = items.length ? items : [{ kind: "other", text: "No recent public activity found.", date: "" }];
  const boxHeight = headerH + rows.length * rowH + 14;
  const height = titlebarH + 14 + boxHeight + footerH;
  const box = { x: MARGIN, y: titlebarH + 14, width: WIDTH - MARGIN * 2, height: boxHeight };
  const username = escapeXml(config.profile.username);

  const rowsMarkup = rows.map((item, index) => buildRow(item, index, colors, box)).join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${height}" viewBox="0 0 ${WIDTH} ${height}" role="img" aria-labelledby="raTitle raDesc">
<title id="raTitle">${escapeXml(config.profile.name)} - Recent Activity Feed</title>
<desc id="raDesc">An animated live-feed panel of recent public GitHub activity, themed to match the AI command center.</desc>
<defs>
  <linearGradient id="raBackground" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${colors.backgroundStart}"/><stop offset="1" stop-color="${colors.backgroundEnd}"/></linearGradient>
  <linearGradient id="raBorder" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${colors.violet}"/><stop offset="0.5" stop-color="${colors.cyan}"/><stop offset="1" stop-color="${colors.green}"/></linearGradient>
  <linearGradient id="scanSweep" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${colors.cyan}" stop-opacity="0"/><stop offset="0.5" stop-color="${colors.cyan}" stop-opacity="0.12"/><stop offset="1" stop-color="${colors.cyan}" stop-opacity="0"/></linearGradient>
  <style>
    .mono { font-family: 'Courier New', Consolas, monospace; }
    .panel-title { font-family: 'Courier New', Consolas, monospace; font-size: 12.5px; letter-spacing: 1.8px; fill: ${colors.blue}; opacity: 0.85; }
  </style>
</defs>
<rect width="${WIDTH}" height="${height}" rx="${OUTER_RADIUS}" fill="url(#raBackground)"/>
${buildBackground(colors, WIDTH, height)}
<rect x="3" y="3" width="${WIDTH - 6}" height="${titlebarH - 4}" rx="16" fill="${colors.panel}" fill-opacity="0.86"/>
<circle cx="26" cy="${titlebarH / 2 + 1}" r="5.4" fill="#EF4444"/><circle cx="46" cy="${titlebarH / 2 + 1}" r="5.4" fill="#F59E0B"/><circle cx="66" cy="${titlebarH / 2 + 1}" r="5.4" fill="${colors.green}"/>
<text x="${WIDTH / 2}" y="${titlebarH / 2 + 6}" text-anchor="middle" class="mono" font-size="14.5" letter-spacing="0.6" fill="${colors.muted}">${username}@activity ~ % tail -f events.log</text>
<circle cx="${WIDTH - 140}" cy="${titlebarH / 2 + 1}" r="4.6" fill="${colors.red}"><animate attributeName="opacity" values="1;0.15;1" dur="1.1s" repeatCount="indefinite"/></circle>
<text x="${WIDTH - 128}" y="${titlebarH / 2 + 6}" class="mono" font-size="12" letter-spacing="1px" fill="${colors.red}">LIVE</text>
<rect x="${box.x.toFixed(1)}" y="${box.y.toFixed(1)}" width="${box.width.toFixed(1)}" height="${box.height.toFixed(1)}" rx="14" fill="${colors.panel}" fill-opacity="0.4" stroke="${colors.violet}" stroke-opacity="0.35"/>
<rect x="${box.x.toFixed(1)}" y="${box.y.toFixed(1)}" width="${box.width.toFixed(1)}" height="3" rx="1.5" fill="${colors.violet}" opacity="0.75"/>
<circle cx="${(box.x + 30).toFixed(1)}" cy="${(box.y + 30).toFixed(1)}" r="3.4" fill="${colors.violet}"><animate attributeName="opacity" values="1;0.3;1" dur="1.6s" repeatCount="indefinite"/></circle>
<text x="${(box.x + 40).toFixed(1)}" y="${(box.y + 34).toFixed(1)}" class="panel-title">RECENT.ACTIVITY.FEED</text>
${rowsMarkup}
<circle cx="32" cy="${(height - 16).toFixed(1)}" r="4" fill="${colors.green}"><animate attributeName="opacity" values="1;0.25;1" dur="1.3s" repeatCount="indefinite"/></circle>
<text x="48" y="${(height - 12).toFixed(1)}" class="mono" font-size="12" letter-spacing="0.6" fill="${colors.muted}">EVENTS TRACKED: ${rows.length}   //   SOURCE: GITHUB PUBLIC EVENTS API   //   SYSTEM STATUS: LIVE</text>
<rect x="3" y="3" width="${WIDTH - 6}" height="${height - 6}" rx="${OUTER_RADIUS - 2}" fill="none" stroke="url(#raBorder)" stroke-width="2" opacity="0.78"><animate attributeName="opacity" values="0.5;0.95;0.5" dur="3.4s" repeatCount="indefinite"/></rect>
</svg>`;
}

export async function generateActivityAssets({ config, items, outputDirectory }) {
  const palette = paletteDefinitions[config.appearance.palette];
  await mkdir(outputDirectory, { recursive: true });
  const assets = { dark: "activity-dark.svg", light: "activity-light.svg" };

  await Promise.all([
    writeFile(resolve(outputDirectory, assets.dark), createActivitySvg(config, palette.dark, items)),
    writeFile(resolve(outputDirectory, assets.light), createActivitySvg(config, palette.light, items))
  ]);

  return { assets };
}

export function classifyEvent(event) {
  const repo = event.repo?.name;
  if (!repo) return null;
  const repoLabel = repo.split("/")[1] || repo;
  if (event.type === "PushEvent") {
    const commits = event.payload?.commits?.length || 1;
    return { kind: "push", text: `pushed ${commits} ${commits === 1 ? "commit" : "commits"} to ${repoLabel}` };
  }
  if (event.type === "CreateEvent") {
    return { kind: "branch", text: `created a ${event.payload?.ref_type || "resource"} in ${repoLabel}` };
  }
  if (event.type === "PullRequestEvent") {
    const action = event.payload?.action || "updated";
    const number = event.payload?.pull_request?.number;
    return { kind: "pull", text: `${action} pull request${number ? ` #${number}` : ""} in ${repoLabel}` };
  }
  if (event.type === "IssuesEvent") {
    const action = event.payload?.action || "updated";
    const number = event.payload?.issue?.number;
    return { kind: "issue", text: `${action} issue${number ? ` #${number}` : ""} in ${repoLabel}` };
  }
  if (event.type === "ReleaseEvent") {
    return { kind: "release", text: `published a release in ${repoLabel}` };
  }
  return null;
}
