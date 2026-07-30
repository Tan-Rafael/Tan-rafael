import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { clamp, escapeXml } from "./xml.mjs";
import { paletteDefinitions } from "./palette.mjs";

const WIDTH = 1180;
const OUTER_RADIUS = 18;
const MARGIN = 14;
const GAP = 14;
const LEFT_W = 248;
const RIGHT_W = 248;
const MID_W = WIDTH - MARGIN * 2 - LEFT_W - RIGHT_W - GAP * 2;

const STAT_DEFS = [
  { key: "repositories", label: "REPOS", reference: 60, glyph: "◧" },
  { key: "commits", label: "COMMITS", reference: 2000, glyph: "▤" },
  { key: "stars", label: "STARS", reference: 500, glyph: "★" },
  { key: "followers", label: "FOLLOWERS", reference: 300, glyph: "◎" },
  { key: "forks", label: "FORKS", reference: 150, glyph: "⑂" }
];

function formatCompact(value) {
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`;
  return String(Math.round(value));
}

function panel(x, y, width, height, colors, accent, opacity = 0.4) {
  return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${width.toFixed(1)}" height="${height.toFixed(1)}" rx="14" fill="${colors.panel}" fill-opacity="${opacity}" stroke="${accent}" stroke-opacity="0.35"/>`;
}

function sectionTitle(x, y, label, colors) {
  return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" class="panel-title">${escapeXml(label)}</text>`;
}

/* ---------------------------------------------------------------------- */
/* Background: circuit grid, drifting nodes, corner brackets, scanline    */
/* ---------------------------------------------------------------------- */
function buildBackground(colors, width, height) {
  const gridLines = [];
  for (let gx = 0; gx <= width; gx += 40) {
    gridLines.push(`<line x1="${gx}" y1="0" x2="${gx}" y2="${height}" stroke="${colors.cyan}" stroke-width="0.5" opacity="0.045"/>`);
  }
  for (let gy = 0; gy <= height; gy += 40) {
    gridLines.push(`<line x1="0" y1="${gy}" x2="${width}" y2="${gy}" stroke="${colors.cyan}" stroke-width="0.5" opacity="0.045"/>`);
  }

  const nodes = [[0.04, 0.12], [0.09, 0.4], [0.06, 0.78], [0.5, 0.05], [0.5, 0.95], [0.94, 0.15], [0.9, 0.5], [0.95, 0.82]];
  const dots = nodes.map(([fx, fy], i) => {
    const x = (fx * width).toFixed(1);
    const y = (fy * height).toFixed(1);
    const dur = (4 + (i % 5)).toFixed(1);
    return `<circle cx="${x}" cy="${y}" r="1.6" fill="${colors.cyan}" opacity="0.3"><animate attributeName="opacity" values="0.1;0.5;0.1" dur="${dur}s" repeatCount="indefinite"/></circle>`;
  }).join("");

  const corners = [[9, 9, 1, 1], [width - 9, 9, -1, 1], [9, height - 9, 1, -1], [width - 9, height - 9, -1, -1]];
  const arm = 28;
  const frames = corners.map(([x, y, dx, dy], index) =>
    `<path d="M ${x} ${(y + arm * dy).toFixed(1)} L ${x} ${y} L ${(x + arm * dx).toFixed(1)} ${y}" fill="none" stroke="${colors.cyan}" stroke-width="1.8" opacity="0.55"><animate attributeName="opacity" values="0.3;0.85;0.3" dur="${(3 + index * 0.4).toFixed(1)}s" repeatCount="indefinite"/></path>`
  ).join("");

  return `<g aria-hidden="true" opacity="0.7">${gridLines.join("")}</g><g aria-hidden="true">${dots}</g><g aria-hidden="true">${frames}</g>
<rect x="0" y="0" width="${width}" height="46" fill="url(#scanSweep)" opacity="0.5"><animate attributeName="y" values="-${height};${height}" dur="9s" repeatCount="indefinite"/></rect>`;
}

/* ---------------------------------------------------------------------- */
/* Left column: AI identity                                               */
/* ---------------------------------------------------------------------- */
function buildIdentityColumn(config, stats, colors, box) {
  const cx = box.x + box.width / 2;
  const ringCy = box.y + 108;
  const rank = stats.contributions > 1200 ? "S+ // AUTONOMOUS" : stats.contributions > 500 ? "A // ADVANCED" : "B // ACTIVE";
  const name = escapeXml(config.profile.name);
  const headline = escapeXml(config.profile.headline || "");
  const location = escapeXml(config.profile.location || "");

  const avatar = `
<circle cx="${cx.toFixed(1)}" cy="${ringCy}" r="64" fill="none" stroke="${colors.cyan}" stroke-width="1.2" opacity="0.25"/>
<circle cx="${cx.toFixed(1)}" cy="${ringCy}" r="52" fill="none" stroke="${colors.violet}" stroke-width="1.2" stroke-dasharray="3 6" opacity="0.45"><animateTransform attributeName="transform" type="rotate" from="0 ${cx.toFixed(1)} ${ringCy}" to="360 ${cx.toFixed(1)} ${ringCy}" dur="22s" repeatCount="indefinite"/></circle>
<circle cx="${cx.toFixed(1)}" cy="${ringCy}" r="40" fill="url(#avatarCore)" opacity="0.9"/>
<circle cx="${cx.toFixed(1)}" cy="${ringCy}" r="40" fill="none" stroke="${colors.cyan}" stroke-width="2" opacity="0.8"><animate attributeName="r" values="40;44;40" dur="2.6s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.8;0.25;0.8" dur="2.6s" repeatCount="indefinite"/></circle>
<path d="M ${(cx - 16).toFixed(1)} ${(ringCy + 6).toFixed(1)} L ${(cx - 4).toFixed(1)} ${(ringCy - 14).toFixed(1)} L ${(cx + 4).toFixed(1)} ${(ringCy + 2).toFixed(1)} L ${(cx + 18).toFixed(1)} ${(ringCy - 16).toFixed(1)}" fill="none" stroke="${colors.primary}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" opacity="0.92"/>
<circle cx="${(cx + 30).toFixed(1)}" cy="${(ringCy - 34).toFixed(1)}" r="6" fill="${colors.green}"><animate attributeName="opacity" values="1;0.3;1" dur="1.4s" repeatCount="indefinite"/></circle>`;

  const nameY = ringCy + 92;
  return `${panel(box.x, box.y, box.width, box.height, colors, colors.violet)}
${sectionTitle(box.x + 18, box.y + 30, "AI.IDENTITY", colors)}
${avatar}
<text x="${cx.toFixed(1)}" y="${nameY.toFixed(1)}" text-anchor="middle" class="mono" font-size="17" font-weight="700" fill="${colors.primary}">${name}</text>
<text x="${cx.toFixed(1)}" y="${(nameY + 20).toFixed(1)}" text-anchor="middle" class="mono" font-size="11.5" fill="${colors.muted}">${headline}</text>
<rect x="${(box.x + 22).toFixed(1)}" y="${(nameY + 34).toFixed(1)}" width="${(box.width - 44).toFixed(1)}" height="26" rx="13" fill="${colors.violet}" fill-opacity="0.16" stroke="${colors.violet}" stroke-opacity="0.5"/>
<text x="${cx.toFixed(1)}" y="${(nameY + 51).toFixed(1)}" text-anchor="middle" class="mono" font-size="11" letter-spacing="0.6" fill="${colors.violet}">RANK ${rank}</text>
<circle cx="${(box.x + 28).toFixed(1)}" cy="${(nameY + 78).toFixed(1)}" r="4.4" fill="${colors.green}"><animate attributeName="opacity" values="1;0.25;1" dur="1.1s" repeatCount="indefinite"/></circle>
<text x="${(box.x + 40).toFixed(1)}" y="${(nameY + 82).toFixed(1)}" class="mono" font-size="11.5" letter-spacing="0.6" fill="${colors.green}">GLOBAL STATUS: ONLINE</text>
<text x="${(box.x + 40).toFixed(1)}" y="${(nameY + 100).toFixed(1)}" class="mono" font-size="11" fill="${colors.muted}">${location}</text>
<line x1="${(box.x + 22).toFixed(1)}" y1="${(nameY + 116).toFixed(1)}" x2="${(box.x + box.width - 22).toFixed(1)}" y2="${(nameY + 116).toFixed(1)}" stroke="${colors.muted}" stroke-opacity="0.2"/>
<path d="M ${(box.x + 22).toFixed(1)} ${(nameY + 138).toFixed(1)} q 10 -14 20 0 t 20 0 t 20 0 t 20 0" fill="none" stroke="${colors.cyan}" stroke-width="1.6" stroke-linecap="round" opacity="0" ><animate attributeName="opacity" from="0" to="0.8" dur="1s" begin="0.4s" fill="freeze"/></path>
<text x="${cx.toFixed(1)}" y="${(nameY + 160).toFixed(1)}" text-anchor="middle" class="mono" font-size="10" letter-spacing="1" fill="${colors.muted}">DEVELOPER SIGNATURE</text>`;
}

/* ---------------------------------------------------------------------- */
/* Middle column: stat widgets                                            */
/* ---------------------------------------------------------------------- */
function buildStatWidgets(stats, colors, box) {
  const count = STAT_DEFS.length;
  const cardWidth = (box.width - GAP * (count - 1)) / count;
  const cardHeight = box.height;
  const accents = [colors.cyan, colors.violet, colors.blue, colors.green, colors.cyan];
  const ringRadius = 24;
  const circumference = 2 * Math.PI * ringRadius;

  const cards = STAT_DEFS.map((def, index) => {
    const x = box.x + index * (cardWidth + GAP);
    const value = stats[def.key] ?? 0;
    const pct = clamp(value / def.reference, 0.04, 1);
    const offset = circumference * (1 - pct);
    const accent = accents[index];
    const ringCx = x + cardWidth / 2;
    const ringCy = box.y + 40;
    const dur = (1.1 + index * 0.15).toFixed(2);

    return `<g>
${panel(x, box.y, cardWidth, cardHeight, colors, accent, 0.38)}
<circle cx="${ringCx.toFixed(1)}" cy="${ringCy.toFixed(1)}" r="${ringRadius}" fill="none" stroke="${colors.muted}" stroke-width="3.2" opacity="0.18"/>
<circle cx="${ringCx.toFixed(1)}" cy="${ringCy.toFixed(1)}" r="${ringRadius}" fill="none" stroke="${accent}" stroke-width="3.2" stroke-linecap="round" stroke-dasharray="${circumference.toFixed(1)}" stroke-dashoffset="${circumference.toFixed(1)}" transform="rotate(-90 ${ringCx.toFixed(1)} ${ringCy.toFixed(1)})"><animate attributeName="stroke-dashoffset" from="${circumference.toFixed(1)}" to="${offset.toFixed(1)}" dur="${dur}s" begin="0.2s" fill="freeze"/></circle>
<text x="${ringCx.toFixed(1)}" y="${(ringCy + 5).toFixed(1)}" text-anchor="middle" class="mono" font-size="13" fill="${accent}">${def.glyph}</text>
<text x="${ringCx.toFixed(1)}" y="${(box.y + cardHeight - 26).toFixed(1)}" text-anchor="middle" class="mono" font-size="20" font-weight="700" fill="${colors.primary}">${escapeXml(formatCompact(value))}</text>
<text x="${ringCx.toFixed(1)}" y="${(box.y + cardHeight - 10).toFixed(1)}" text-anchor="middle" class="mono" font-size="9.5" letter-spacing="0.8" fill="${colors.muted}">${def.label}</text>
</g>`;
  }).join("\n");

  return cards;
}

/* ---------------------------------------------------------------------- */
/* Skill Network: radar / hexagon chart replacing language bars            */
/* ---------------------------------------------------------------------- */
function buildSkillRadar(stats, colors, box) {
  const languages = (stats.languages.length ? stats.languages : [{ name: "N/A", share: 1, color: colors.muted }]).slice(0, 6);
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2 + 10;
  const radius = Math.min(box.width, box.height) / 2 - 34;
  const sides = languages.length;
  const maxShare = Math.max(...languages.map((l) => l.share), 0.01);

  const axisPoints = languages.map((_, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / sides;
    return [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle), angle];
  });

  const rings = [0.33, 0.66, 1].map((frac) => {
    const pts = axisPoints.map(([, , angle]) => `${(cx + radius * frac * Math.cos(angle)).toFixed(1)},${(cy + radius * frac * Math.sin(angle)).toFixed(1)}`).join(" ");
    return `<polygon points="${pts}" fill="none" stroke="${colors.muted}" stroke-width="0.8" opacity="0.22"/>`;
  }).join("");

  const spokes = axisPoints.map(([x, y]) => `<line x1="${cx.toFixed(1)}" y1="${cy.toFixed(1)}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${colors.muted}" stroke-width="0.7" opacity="0.2"/>`).join("");

  const dataPts = languages.map((lang, i) => {
    const [, , angle] = axisPoints[i];
    const frac = 0.18 + 0.8 * (lang.share / maxShare);
    return [cx + radius * frac * Math.cos(angle), cy + radius * frac * Math.sin(angle)];
  });
  const dataPolygon = dataPts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

  const labels = languages.map((lang, i) => {
    const [x, y, angle] = axisPoints[i];
    const lx = cx + (radius + 20) * Math.cos(angle);
    const ly = cy + (radius + 20) * Math.sin(angle);
    const anchor = Math.cos(angle) > 0.2 ? "start" : Math.cos(angle) < -0.2 ? "end" : "middle";
    const pct = Math.round((lang.share / languages.reduce((s, l) => s + l.share, 0)) * 100);
    const dot = `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.6" fill="${lang.color || colors.cyan}"><animate attributeName="r" values="2.6;4;2.6" dur="${(2 + i * 0.3).toFixed(1)}s" repeatCount="indefinite"/></circle>`;
    return `${dot}<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="${anchor}" class="mono" font-size="10.5" fill="${colors.primary}">${escapeXml(lang.name)}</text><text x="${lx.toFixed(1)}" y="${(ly + 13).toFixed(1)}" text-anchor="${anchor}" class="mono" font-size="9.5" fill="${colors.muted}">${pct}%</text>`;
  }).join("");

  return `${panel(box.x, box.y, box.width, box.height, colors, colors.blue)}
${sectionTitle(box.x + 18, box.y + 28, "SKILL.NETWORK", colors)}
${rings}${spokes}
<polygon points="${dataPolygon}" fill="${colors.cyan}" fill-opacity="0.16" stroke="${colors.cyan}" stroke-width="1.8" opacity="0"><animate attributeName="opacity" from="0" to="1" dur="1s" begin="0.3s" fill="freeze"/></polygon>
${labels}`;
}

/* ---------------------------------------------------------------------- */
/* Contribution Energy: neon cube matrix replacing the calendar heatmap   */
/* ---------------------------------------------------------------------- */
function colorForCount(count, maxCount, colors) {
  if (maxCount <= 0 || count <= 0) return colors.muted;
  const ratio = clamp(count / maxCount, 0, 1);
  const stops = [colors.muted, colors.blue, colors.cyan, colors.green];
  const scaled = ratio * (stops.length - 1);
  return stops[Math.min(stops.length - 1, Math.round(scaled))];
}

function buildContributionMatrix(stats, colors, box) {
  const grid = stats.dayGrid.length ? stats.dayGrid : [[0]];
  const maxCount = grid.reduce((max, week) => Math.max(max, ...week), 1);
  const cell = 8.2;
  const cellGap = 2.4;
  const skew = 3.2;
  const originX = box.x + 20;
  const originY = box.y + 44;
  const usableWidth = box.width - 40;
  const columns = Math.min(grid.length, Math.floor(usableWidth / (cell + cellGap)));
  const trimmed = grid.slice(grid.length - columns);

  const cubes = trimmed.map((week, weekIndex) => {
    const x = originX + weekIndex * (cell + cellGap);
    const squares = week.map((count, dayIndex) => {
      const y = originY + dayIndex * (cell + cellGap) - weekIndex * 0.2;
      const fill = colorForCount(count, maxCount, colors);
      const active = count > 0;
      const opacity = active ? clamp(0.4 + (count / maxCount) * 0.6, 0.4, 1) : 0.12;
      const topFace = `${x.toFixed(1)},${y.toFixed(1)} ${(x + cell).toFixed(1)},${y.toFixed(1)} ${(x + cell - skew).toFixed(1)},${(y - skew).toFixed(1)} ${(x - skew).toFixed(1)},${(y - skew).toFixed(1)}`;
      const glow = active && count >= maxCount * 0.66
        ? `<rect x="${(x - 1).toFixed(1)}" y="${(y - 1).toFixed(1)}" width="${(cell + 2).toFixed(1)}" height="${(cell + 2).toFixed(1)}" fill="${fill}" opacity="0.35"><animate attributeName="opacity" values="0.15;0.55;0.15" dur="${(2 + (dayIndex % 3)).toFixed(1)}s" repeatCount="indefinite"/></rect>`
        : "";
      return `${glow}<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${cell}" height="${cell}" rx="1.4" fill="${fill}" opacity="${opacity.toFixed(2)}"/><polygon points="${topFace}" fill="${fill}" opacity="${(opacity * 0.55).toFixed(2)}"/>`;
    }).join("");
    const begin = (weekIndex * 0.01).toFixed(3);
    return `<g opacity="0"><animate attributeName="opacity" from="0" to="1" dur="0.5s" begin="${begin}s" fill="freeze"/>${squares}</g>`;
  }).join("\n");

  return `${panel(box.x, box.y, box.width, box.height, colors, colors.green)}
${sectionTitle(box.x + 18, box.y + 28, "CONTRIBUTION.ENERGY", colors)}
${cubes}
<text x="${(box.x + box.width - 18).toFixed(1)}" y="${(box.y + box.height - 12).toFixed(1)}" text-anchor="end" class="mono" font-size="10.5" fill="${colors.muted}">${stats.contributions.toLocaleString("en-US")} contributions tracked</text>`;
}

/* ---------------------------------------------------------------------- */
/* Weekly activity signal (area chart)                                    */
/* ---------------------------------------------------------------------- */
function buildActivitySignal(stats, colors, box) {
  const totals = stats.weeklyTotals.length ? stats.weeklyTotals : [0];
  const maxTotal = Math.max(...totals, 1);
  const chartX = box.x + 20;
  const chartWidth = box.width - 40;
  const chartTop = box.y + 40;
  const chartHeight = box.height - 60;
  const stepX = chartWidth / Math.max(1, totals.length - 1);

  const points = totals.map((value, index) => {
    const x = chartX + index * stepX;
    const y = chartTop + chartHeight - (value / maxTotal) * chartHeight;
    return [x, y];
  });

  const linePath = points.map(([x, y], index) => `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L ${(chartX + chartWidth).toFixed(1)} ${(chartTop + chartHeight).toFixed(1)} L ${chartX.toFixed(1)} ${(chartTop + chartHeight).toFixed(1)} Z`;
  const approxLength = Math.round(chartWidth * 1.4 + chartHeight * 2);

  return `${panel(box.x, box.y, box.width, box.height, colors, colors.cyan)}
${sectionTitle(box.x + 18, box.y + 28, "COMMIT.ACTIVITY.SIGNAL", colors)}
<path d="${areaPath}" fill="url(#areaFill)" opacity="0.9"/>
<path d="${linePath}" fill="none" stroke="${colors.cyan}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="${approxLength}" stroke-dashoffset="${approxLength}"><animate attributeName="stroke-dashoffset" from="${approxLength}" to="0" dur="2.1s" begin="0.2s" fill="freeze"/></path>
<rect x="${chartX.toFixed(1)}" y="${chartTop.toFixed(1)}" width="24" height="${chartHeight.toFixed(1)}" fill="url(#chartScan)" opacity="0.7"><animateTransform attributeName="transform" type="translate" from="0 0" to="${(chartWidth - 24).toFixed(1)} 0" dur="4s" repeatCount="indefinite"/></rect>`;
}

/* ---------------------------------------------------------------------- */
/* Live activity feed (marquee ticker)                                    */
/* ---------------------------------------------------------------------- */
function buildLiveFeed(stats, colors, box) {
  const items = [
    `REPO.SYNC — ${stats.repositories} repositories indexed`,
    `ISSUE.TRACKER — ${stats.issues.open}/${stats.issues.total} open`,
    `PULL.REQUESTS — ${stats.pulls.open}/${stats.pulls.total} open`,
    `LANGUAGE.SCAN — ${stats.languages.length} languages detected`,
    `CONTRIBUTION.FEED — ${stats.contributions.toLocaleString("en-US")} events this year`
  ];
  const rowH = (box.height - 34) / items.length;
  const rows = items.map((text, i) => {
    const y = box.y + 44 + i * rowH;
    return `<circle cx="${(box.x + 22).toFixed(1)}" cy="${(y - 4).toFixed(1)}" r="3" fill="${colors.cyan}"><animate attributeName="opacity" values="1;0.2;1" dur="${(1.4 + i * 0.2).toFixed(1)}s" repeatCount="indefinite"/></circle>
<text x="${(box.x + 34).toFixed(1)}" y="${y.toFixed(1)}" class="mono" font-size="11" fill="${colors.muted}">${escapeXml(text)}</text>`;
  }).join("\n");

  return `${panel(box.x, box.y, box.width, box.height, colors, colors.violet)}
${sectionTitle(box.x + 18, box.y + 28, "LIVE.ACTIVITY.FEED", colors)}
${rows}`;
}

/* ---------------------------------------------------------------------- */
/* Right column: AI system status                                        */
/* ---------------------------------------------------------------------- */
function buildGauge(x, y, radius, pct, colors, accent, label, value) {
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamp(pct, 0, 1));
  return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${radius}" fill="none" stroke="${colors.muted}" stroke-width="5" opacity="0.16"/>
<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${radius}" fill="none" stroke="${accent}" stroke-width="5" stroke-linecap="round" stroke-dasharray="${circumference.toFixed(1)}" stroke-dashoffset="${circumference.toFixed(1)}" transform="rotate(-90 ${x.toFixed(1)} ${y.toFixed(1)})"><animate attributeName="stroke-dashoffset" from="${circumference.toFixed(1)}" to="${offset.toFixed(1)}" dur="1.4s" begin="0.3s" fill="freeze"/></circle>
<text x="${x.toFixed(1)}" y="${(y + 4).toFixed(1)}" text-anchor="middle" class="mono" font-size="13" font-weight="700" fill="${colors.primary}">${value}</text>
<text x="${x.toFixed(1)}" y="${(y + radius + 16).toFixed(1)}" text-anchor="middle" class="mono" font-size="9.5" letter-spacing="0.6" fill="${colors.muted}">${label}</text>`;
}

function buildSystemColumn(stats, colors, box) {
  const languageLoad = clamp(stats.languages.length / 6, 0.2, 1);
  const focus = clamp(0.5 + stats.contributions / 3000, 0.2, 0.98);
  const learning = clamp(stats.repositories / 40, 0.15, 0.95);
  const cpu = clamp(0.3 + (stats.weeklyTotals.at(-1) || 0) / 20, 0.15, 0.95);

  const gaugeBox = { x: box.x, y: box.y, width: box.width, height: 232 };
  const gr = 34;
  const col1 = gaugeBox.x + gaugeBox.width * 0.28;
  const col2 = gaugeBox.x + gaugeBox.width * 0.72;
  const row1 = gaugeBox.y + 78;
  const row2 = gaugeBox.y + 176;

  const gauges = `${panel(gaugeBox.x, gaugeBox.y, gaugeBox.width, gaugeBox.height, colors, colors.cyan)}
${sectionTitle(gaugeBox.x + 18, gaugeBox.y + 28, "SYSTEM.STATUS", colors)}
${buildGauge(col1, row1, gr, cpu, colors, colors.cyan, "CPU", `${Math.round(cpu * 100)}%`)}
${buildGauge(col2, row1, gr, languageLoad, colors, colors.violet, "RAM", `${Math.round(languageLoad * 100)}%`)}
${buildGauge(col1, row2, gr, focus, colors, colors.green, "FOCUS", `${Math.round(focus * 100)}%`)}
${buildGauge(col2, row2, gr, learning, colors, colors.blue, "LEARNING", `${Math.round(learning * 100)}%`)}`;

  const netY = gaugeBox.y + gaugeBox.height + GAP;
  const netH = 118;
  const netRows = [
    ["GITHUB API", 0.92, colors.green],
    ["REPO SYNC", 0.98, colors.cyan]
  ].map(([label, pct, accent], i) => {
    const y = netY + 46 + i * 40;
    const barW = box.width - 40;
    const fillW = barW * pct;
    return `<text x="${(box.x + 20).toFixed(1)}" y="${(y - 8).toFixed(1)}" class="mono" font-size="10.5" fill="${colors.muted}">${label}</text>
<rect x="${(box.x + 20).toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="6" rx="3" fill="${colors.muted}" opacity="0.16"/>
<rect x="${(box.x + 20).toFixed(1)}" y="${y.toFixed(1)}" width="0" height="6" rx="3" fill="${accent}"><animate attributeName="width" from="0" to="${fillW.toFixed(1)}" dur="1.2s" begin="0.3s" fill="freeze"/></rect>`;
  }).join("\n");

  const network = `${panel(box.x, netY, box.width, netH, colors, colors.blue)}
${sectionTitle(box.x + 18, netY + 26, "NETWORK.LINK", colors)}
${netRows}`;

  const confY = netY + netH + GAP;
  const confH = 96;
  const confidence = clamp(0.55 + stats.stars / 1200, 0.4, 0.99);
  const confRadius = 42;
  const arcLength = Math.PI * confRadius;
  const confOffset = arcLength * (1 - confidence);
  const confCx = box.x + box.width / 2;
  const confCy = confY + confH - 8;
  const confidenceBlock = `${panel(box.x, confY, box.width, confH, colors, colors.violet)}
${sectionTitle(box.x + 18, confY + 24, "AI.CONFIDENCE", colors)}
<path d="M ${(confCx - confRadius).toFixed(1)} ${confCy.toFixed(1)} A ${confRadius} ${confRadius} 0 0 1 ${(confCx + confRadius).toFixed(1)} ${confCy.toFixed(1)}" fill="none" stroke="${colors.muted}" stroke-width="6" opacity="0.18"/>
<path d="M ${(confCx - confRadius).toFixed(1)} ${confCy.toFixed(1)} A ${confRadius} ${confRadius} 0 0 1 ${(confCx + confRadius).toFixed(1)} ${confCy.toFixed(1)}" fill="none" stroke="${colors.violet}" stroke-width="6" stroke-linecap="round" stroke-dasharray="${arcLength.toFixed(1)}" stroke-dashoffset="${arcLength.toFixed(1)}"><animate attributeName="stroke-dashoffset" from="${arcLength.toFixed(1)}" to="${confOffset.toFixed(1)}" dur="1.6s" begin="0.3s" fill="freeze"/></path>
<text x="${confCx.toFixed(1)}" y="${(confCy - 4).toFixed(1)}" text-anchor="middle" class="mono" font-size="16" font-weight="700" fill="${colors.primary}">${Math.round(confidence * 100)}%</text>`;

  const threatY = confY + confH + GAP;
  const threatH = box.y + box.height - threatY;
  const threatLevel = clamp(1 - stats.issues.open / Math.max(stats.issues.total, 1), 0.1, 1);
  const threatBar = `${panel(box.x, threatY, box.width, threatH, colors, colors.green)}
<text x="${(box.x + 18).toFixed(1)}" y="${(threatY + 20).toFixed(1)}" class="mono" font-size="10.5" letter-spacing="0.6" fill="${colors.muted}">THREAT LEVEL</text>
<rect x="${(box.x + 18).toFixed(1)}" y="${(threatY + 28).toFixed(1)}" width="${(box.width - 36).toFixed(1)}" height="7" rx="3.5" fill="${colors.muted}" opacity="0.16"/>
<rect x="${(box.x + 18).toFixed(1)}" y="${(threatY + 28).toFixed(1)}" width="0" height="7" rx="3.5" fill="${colors.green}"><animate attributeName="width" from="0" to="${((box.width - 36) * (1 - threatLevel)).toFixed(1)}" dur="1.2s" begin="0.4s" fill="freeze"/></rect>
<text x="${(box.x + 18).toFixed(1)}" y="${(threatY + 48).toFixed(1)}" class="mono" font-size="10.5" fill="${colors.green}">LOW — NOMINAL</text>`;

  return { markup: `${gauges}\n${network}\n${confidenceBlock}\n${threatBar}`, bottom: threatY + threatH };
}

/* ---------------------------------------------------------------------- */
/* Assemble full dashboard                                                */
/* ---------------------------------------------------------------------- */
function createAiMetricsSvg(config, colors, stats) {
  const titlebarH = 44;
  const contentY = titlebarH + 14;

  const leftBox = { x: MARGIN, y: contentY, width: LEFT_W, height: 0 };
  const midBox = { x: MARGIN + LEFT_W + GAP, y: contentY, width: MID_W, height: 0 };
  const rightBox = { x: MARGIN + LEFT_W + GAP + MID_W + GAP, y: contentY, width: RIGHT_W, height: 0 };

  // Middle column stacked sections
  const statRow = { x: midBox.x, y: midBox.y, width: midBox.width, height: 100 };
  const statMarkup = buildStatWidgets(stats, colors, statRow);

  const dualY = statRow.y + statRow.height + GAP;
  const dualH = 190;
  const halfW = (midBox.width - GAP) / 2;
  const radarBox = { x: midBox.x, y: dualY, width: halfW, height: dualH };
  const matrixBox = { x: midBox.x + halfW + GAP, y: dualY, width: halfW, height: dualH };
  const radarMarkup = buildSkillRadar(stats, colors, radarBox);
  const matrixMarkup = buildContributionMatrix(stats, colors, matrixBox);

  const chartY = dualY + dualH + GAP;
  const chartH = 156;
  const chartBox = { x: midBox.x, y: chartY, width: midBox.width, height: chartH };
  const chartMarkup = buildActivitySignal(stats, colors, chartBox);

  const feedY = chartY + chartH + GAP;
  const feedH = 128;
  const feedBox = { x: midBox.x, y: feedY, width: midBox.width, height: feedH };
  const feedMarkup = buildLiveFeed(stats, colors, feedBox);

  const midBottom = feedY + feedH;

  // Right column (system status) — self-computes its own bottom
  const systemHeight = 232 + GAP + 118 + GAP + 96 + GAP + 60;
  const rightBoxSized = { ...rightBox, height: systemHeight };
  const { markup: systemMarkup, bottom: rightBottom } = buildSystemColumn(stats, colors, rightBoxSized);

  // Left column height matches the taller of mid/right so panels align
  const contentBottom = Math.max(midBottom, rightBottom);
  const leftBoxSized = { ...leftBox, height: contentBottom - leftBox.y };
  const identityMarkup = buildIdentityColumn(config, stats, colors, leftBoxSized);

  const footerY = contentBottom + 32;
  const height = footerY + 24;
  const username = escapeXml(config.profile.username);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${height}" viewBox="0 0 ${WIDTH} ${height}" role="img" aria-labelledby="aiTitle aiDesc">
<title id="aiTitle">${escapeXml(config.profile.name)} - AI Developer Intelligence Dashboard</title>
<desc id="aiDesc">A custom animated command-center visualization of live GitHub repository, contribution, language, and system telemetry.</desc>
<defs>
  <radialGradient id="avatarCore" cx="50%" cy="42%" r="65%">
    <stop offset="0" stop-color="${colors.cyan}" stop-opacity="0.9"/>
    <stop offset="1" stop-color="${colors.violet}" stop-opacity="0.55"/>
  </radialGradient>
  <linearGradient id="aiBackground" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${colors.backgroundStart}"/><stop offset="1" stop-color="${colors.backgroundEnd}"/>
  </linearGradient>
  <linearGradient id="aiBorder" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="${colors.violet}"/><stop offset="0.5" stop-color="${colors.cyan}"/><stop offset="1" stop-color="${colors.green}"/>
  </linearGradient>
  <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${colors.cyan}" stop-opacity="0.4"/><stop offset="1" stop-color="${colors.cyan}" stop-opacity="0"/>
  </linearGradient>
  <linearGradient id="chartScan" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="${colors.cyan}" stop-opacity="0"/><stop offset="0.5" stop-color="${colors.cyan}" stop-opacity="0.5"/><stop offset="1" stop-color="${colors.cyan}" stop-opacity="0"/>
  </linearGradient>
  <linearGradient id="scanSweep" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${colors.cyan}" stop-opacity="0"/><stop offset="0.5" stop-color="${colors.cyan}" stop-opacity="0.12"/><stop offset="1" stop-color="${colors.cyan}" stop-opacity="0"/>
  </linearGradient>
  <style>
    .mono { font-family: 'Courier New', Consolas, monospace; }
    .panel-title { font-family: 'Courier New', Consolas, monospace; font-size: 12.5px; letter-spacing: 1.8px; fill: ${colors.blue}; opacity: 0.85; }
    .live-label { font-family: 'Courier New', Consolas, monospace; font-size: 12px; letter-spacing: 1px; fill: ${colors.red}; }
  </style>
</defs>
<rect width="${WIDTH}" height="${height}" rx="${OUTER_RADIUS}" fill="url(#aiBackground)"/>
${buildBackground(colors, WIDTH, height)}
<rect x="3" y="3" width="${WIDTH - 6}" height="${titlebarH - 4}" rx="16" fill="${colors.panel}" fill-opacity="0.86"/>
<circle cx="26" cy="${titlebarH / 2 + 1}" r="5.4" fill="#EF4444"/><circle cx="46" cy="${titlebarH / 2 + 1}" r="5.4" fill="#F59E0B"/><circle cx="66" cy="${titlebarH / 2 + 1}" r="5.4" fill="${colors.green}"/>
<text x="${WIDTH / 2}" y="${titlebarH / 2 + 6}" text-anchor="middle" class="mono" font-size="14.5" letter-spacing="0.6" fill="${colors.muted}">${username}@ai-console ~ % ./intelligence --dashboard --live</text>
<circle cx="${WIDTH - 168}" cy="${titlebarH / 2 + 1}" r="4.6" fill="${colors.red}"><animate attributeName="opacity" values="1;0.15;1" dur="1.1s" repeatCount="indefinite"/></circle>
<text x="${WIDTH - 156}" y="${titlebarH / 2 + 6}" class="live-label">ANALYZING</text>
${identityMarkup}
${statMarkup}
${radarMarkup}
${matrixMarkup}
${chartMarkup}
${feedMarkup}
${systemMarkup}
<circle cx="32" cy="${footerY - 4}" r="4" fill="${colors.green}"><animate attributeName="opacity" values="1;0.25;1" dur="1.3s" repeatCount="indefinite"/></circle>
<text x="48" y="${footerY}" class="mono" font-size="12" letter-spacing="0.6" fill="${colors.muted}">AI DEVELOPER INTELLIGENCE DASHBOARD  //  REPO ANALYSIS: COMPLETE  //  SYSTEM STATUS: LIVE</text>
<rect x="3" y="3" width="${WIDTH - 6}" height="${height - 6}" rx="${OUTER_RADIUS - 2}" fill="none" stroke="url(#aiBorder)" stroke-width="2" opacity="0.78"><animate attributeName="opacity" values="0.5;0.95;0.5" dur="3.4s" repeatCount="indefinite"/></rect>
</svg>`;
}

export async function generateAiMetricsAssets({ config, stats, outputDirectory }) {
  const palette = paletteDefinitions[config.appearance.palette];
  const enriched = { ...stats, commits: stats.contributions };
  await mkdir(outputDirectory, { recursive: true });
  const assets = { dark: "ai-metrics-dark.svg", light: "ai-metrics-light.svg" };

  await Promise.all([
    writeFile(resolve(outputDirectory, assets.dark), createAiMetricsSvg(config, palette.dark, enriched)),
    writeFile(resolve(outputDirectory, assets.light), createAiMetricsSvg(config, palette.light, enriched))
  ]);

  return { assets };
}
