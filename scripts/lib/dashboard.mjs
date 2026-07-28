import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { clamp, escapeXml } from "./xml.mjs";
import { paletteDefinitions } from "./hero.mjs";

const WIDTH = 1180;
const OUTER_RADIUS = 18;

const STAT_DEFS = [
  { key: "repositories", label: "REPOSITORIES", reference: 60 },
  { key: "stars", label: "TOTAL STARS", reference: 500 },
  { key: "forks", label: "TOTAL FORKS", reference: 150 },
  { key: "followers", label: "FOLLOWERS", reference: 300 },
  { key: "contributions", label: "CONTRIBUTIONS / YR", reference: 1500 }
];

function formatCompact(value) {
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`;
  return String(value);
}

function buildAmbientLayer(colors, width, height) {
  const nodes = [
    [0.03, 0.15], [0.07, 0.5], [0.04, 0.85], [0.22, 0.08], [0.2, 0.62], [0.18, 0.93],
    [0.5, 0.06], [0.5, 0.5], [0.5, 0.94], [0.78, 0.1], [0.8, 0.55], [0.8, 0.9], [0.97, 0.3], [0.96, 0.7]
  ];
  const edges = [[0, 1], [1, 2], [1, 4], [3, 4], [4, 5], [4, 7], [6, 7], [7, 8], [7, 10], [9, 10], [10, 11], [10, 12], [12, 13]];
  const points = nodes.map(([fx, fy]) => [fx * width, fy * height]);
  const lines = edges.map(([a, b], index) => {
    const [x1, y1] = points[a];
    const [x2, y2] = points[b];
    return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${index % 2 === 0 ? colors.cyan : colors.blue}" stroke-width="0.6" opacity="0.09"/>`;
  }).join("");
  const dots = points.map(([x, y], index) => {
    const dur = (4 + (index % 5)).toFixed(1);
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${index % 3 === 0 ? 2.2 : 1.4}" fill="${colors.cyan}" opacity="0.22"><animate attributeName="opacity" values="0.1;0.42;0.1" dur="${dur}s" repeatCount="indefinite"/></circle>`;
  }).join("");

  const corners = [[9, 9, 1, 1], [width - 9, 9, -1, 1], [9, height - 9, 1, -1], [width - 9, height - 9, -1, -1]];
  const arm = 26;
  const frames = corners.map(([x, y, dx, dy], index) => `<path d="M ${x} ${(y + arm * dy).toFixed(1)} L ${x} ${y} L ${(x + arm * dx).toFixed(1)} ${y}" fill="none" stroke="${colors.cyan}" stroke-width="1.6" opacity="0.5"><animate attributeName="opacity" values="0.28;0.8;0.28" dur="${(3 + index * 0.4).toFixed(1)}s" repeatCount="indefinite"/></path>`).join("");

  return `<g aria-hidden="true" opacity="0.6">${lines}${dots}</g><g aria-hidden="true">${frames}</g>`;
}

function buildStatCards(stats, colors) {
  const margin = 14;
  const gap = 14;
  const cardWidth = (WIDTH - margin * 2 - gap * (STAT_DEFS.length - 1)) / STAT_DEFS.length;
  const cardHeight = 96;
  const y = 52;
  const accents = [colors.cyan, colors.violet, colors.blue, colors.green, colors.cyan];
  const ringRadius = 22;
  const circumference = 2 * Math.PI * ringRadius;

  const cards = STAT_DEFS.map((def, index) => {
    const x = margin + index * (cardWidth + gap);
    const value = stats[def.key] ?? 0;
    const pct = clamp(value / def.reference, 0.04, 1);
    const offset = circumference * (1 - pct);
    const accent = accents[index];
    const ringCx = x + cardWidth - 38;
    const ringCy = y + 34;
    const dur = (1.1 + index * 0.15).toFixed(2);

    return `<g>
  <rect x="${x.toFixed(1)}" y="${y}" width="${cardWidth.toFixed(1)}" height="${cardHeight}" rx="13" fill="${colors.panel}" fill-opacity="0.42" stroke="${accent}" stroke-opacity="0.35"/>
  <rect x="${x.toFixed(1)}" y="${y}" width="${cardWidth.toFixed(1)}" height="3" rx="1.5" fill="${accent}" opacity="0.75"/>
  <text x="${(x + 18).toFixed(1)}" y="${(y + 42).toFixed(1)}" class="mono" font-size="27" font-weight="700" fill="${colors.primary}">${escapeXml(formatCompact(value))}</text>
  <text x="${(x + 18).toFixed(1)}" y="${(y + 66).toFixed(1)}" class="mono" font-size="9.5" letter-spacing="1.1" fill="${colors.muted}">${def.label}</text>
  <circle cx="${ringCx.toFixed(1)}" cy="${ringCy.toFixed(1)}" r="${ringRadius}" fill="none" stroke="${colors.muted}" stroke-width="3" opacity="0.18"/>
  <circle cx="${ringCx.toFixed(1)}" cy="${ringCy.toFixed(1)}" r="${ringRadius}" fill="none" stroke="${accent}" stroke-width="3" stroke-linecap="round" stroke-dasharray="${circumference.toFixed(1)}" stroke-dashoffset="${circumference.toFixed(1)}" transform="rotate(-90 ${ringCx.toFixed(1)} ${ringCy.toFixed(1)})"><animate attributeName="stroke-dashoffset" from="${circumference.toFixed(1)}" to="${offset.toFixed(1)}" dur="${dur}s" begin="0.2s" fill="freeze"/></circle>
  <circle cx="${ringCx.toFixed(1)}" cy="${(ringCy - ringRadius).toFixed(1)}" r="2" fill="${accent}"><animate attributeName="opacity" values="1;0.3;1" dur="1.6s" repeatCount="indefinite"/></circle>
</g>`;
  }).join("\n");

  return { markup: cards, bottom: y + cardHeight };
}

function buildLanguagePanel(stats, colors, box) {
  const languages = stats.languages.length ? stats.languages : [{ name: "N/A", color: colors.muted, share: 1 }];
  const barX = box.x + 20;
  const barWidth = box.width - 110;
  const barHeight = 12;
  const rowGap = 27;
  const startY = box.y + 46;

  const rows = languages.map((language, index) => {
    const y = startY + index * rowGap;
    const targetWidth = Math.max(4, barWidth * language.share);
    const dur = (0.7 + index * 0.12).toFixed(2);
    const pct = Math.round(language.share * 100);
    const color = language.color || colors.cyan;
    return `<g>
  <text x="${barX}" y="${(y - 4).toFixed(1)}" class="mono" font-size="10.5" fill="${colors.primary}">${escapeXml(language.name)}</text>
  <text x="${(barX + barWidth).toFixed(1)}" y="${(y - 4).toFixed(1)}" text-anchor="end" class="mono" font-size="10" fill="${colors.muted}">${pct}%</text>
  <rect x="${barX}" y="${y}" width="${barWidth.toFixed(1)}" height="${barHeight}" rx="4" fill="${colors.muted}" opacity="0.14"/>
  <rect x="${barX}" y="${y}" width="0" height="${barHeight}" rx="4" fill="${color}" opacity="0.85"><animate attributeName="width" from="0" to="${targetWidth.toFixed(1)}" dur="${dur}s" begin="0.3s" fill="freeze"/></rect>
</g>`;
  }).join("\n");

  return `<text x="${box.x + 20}" y="${box.y + 26}" class="panel-title">LANGUAGE.DISTRIBUTION</text>
<rect x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" rx="13" fill="${colors.panel}" fill-opacity="0.4" stroke="${colors.blue}" stroke-opacity="0.3"/>
${rows}`;
}

function colorForCount(count, maxCount, colors) {
  if (maxCount <= 0 || count <= 0) return colors.muted;
  const ratio = clamp(count / maxCount, 0, 1);
  const stops = [colors.muted, colors.blue, colors.cyan, colors.green];
  const scaled = ratio * (stops.length - 1);
  return stops[Math.min(stops.length - 1, Math.round(scaled))];
}

function buildHeatmapPanel(stats, colors, box) {
  const grid = stats.dayGrid.length ? stats.dayGrid : [[0]];
  const maxCount = grid.reduce((max, week) => Math.max(max, ...week), 1);
  const cell = 9;
  const cellGap = 2.4;
  const originX = box.x + 20;
  const originY = box.y + 40;
  const usableWidth = box.width - 40;
  const columns = Math.min(grid.length, Math.floor(usableWidth / (cell + cellGap)));
  const trimmed = grid.slice(grid.length - columns);

  const weeks = trimmed.map((week, weekIndex) => {
    const x = originX + weekIndex * (cell + cellGap);
    const squares = week.map((count, dayIndex) => {
      const y = originY + dayIndex * (cell + cellGap);
      const fill = colorForCount(count, maxCount, colors);
      const opacity = count > 0 ? clamp(0.35 + (count / maxCount) * 0.65, 0.35, 1) : 0.16;
      return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${cell}" height="${cell}" rx="1.6" fill="${fill}" opacity="${opacity.toFixed(2)}"/>`;
    }).join("");
    const begin = (weekIndex * 0.012).toFixed(3);
    return `<g opacity="0"><animate attributeName="opacity" from="0" to="1" dur="0.5s" begin="${begin}s" fill="freeze"/>${squares}</g>`;
  }).join("\n");

  return `<text x="${box.x + 20}" y="${box.y + 26}" class="panel-title">CONTRIBUTION.HEATMAP</text>
<rect x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" rx="13" fill="${colors.panel}" fill-opacity="0.4" stroke="${colors.cyan}" stroke-opacity="0.3"/>
${weeks}
<text x="${(box.x + box.width - 20).toFixed(1)}" y="${(box.y + box.height - 12).toFixed(1)}" text-anchor="end" class="mono" font-size="9.5" fill="${colors.muted}">${stats.contributions.toLocaleString("en-US")} contributions tracked</text>`;
}

function buildAreaChart(stats, colors, box) {
  const totals = stats.weeklyTotals.length ? stats.weeklyTotals : [0];
  const maxTotal = Math.max(...totals, 1);
  const chartX = box.x + 20;
  const chartWidth = box.width - 40;
  const chartTop = box.y + 34;
  const chartHeight = box.height - 58;
  const stepX = chartWidth / Math.max(1, totals.length - 1);

  const points = totals.map((value, index) => {
    const x = chartX + index * stepX;
    const y = chartTop + chartHeight - (value / maxTotal) * chartHeight;
    return [x, y];
  });

  const linePath = points.map(([x, y], index) => `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L ${(chartX + chartWidth).toFixed(1)} ${(chartTop + chartHeight).toFixed(1)} L ${chartX.toFixed(1)} ${(chartTop + chartHeight).toFixed(1)} Z`;
  const approxLength = Math.round(chartWidth * 1.4 + chartHeight * 2);

  return `<text x="${box.x + 20}" y="${box.y + 26}" class="panel-title">WEEKLY.ACTIVITY.SIGNAL</text>
<rect x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" rx="13" fill="${colors.panel}" fill-opacity="0.4" stroke="${colors.green}" stroke-opacity="0.3"/>
<path d="${areaPath}" fill="url(#area-fill)" opacity="0.9"/>
<path d="${linePath}" fill="none" stroke="${colors.cyan}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="${approxLength}" stroke-dashoffset="${approxLength}"><animate attributeName="stroke-dashoffset" from="${approxLength}" to="0" dur="2.1s" begin="0.2s" fill="freeze"/></path>
<rect x="${chartX.toFixed(1)}" y="${chartTop.toFixed(1)}" width="26" height="${chartHeight.toFixed(1)}" fill="url(#chart-scan)" opacity="0.7"><animateTransform attributeName="transform" type="translate" from="0 0" to="${(chartWidth - 26).toFixed(1)} 0" dur="3.6s" repeatCount="indefinite"/></rect>`;
}

function buildFooterStatus(stats, colors, y) {
  const items = [
    "REPO ANALYSIS: COMPLETE",
    `ISSUES ${stats.issues.open}/${stats.issues.total}`,
    `PULL REQUESTS ${stats.pulls.open}/${stats.pulls.total}`,
    "SYSTEM STATUS: LIVE"
  ];
  const text = items.join("   //   ");
  return `<circle cx="30" cy="${y - 3.5}" r="3.5" fill="${colors.green}"><animate attributeName="opacity" values="1;0.25;1" dur="1.3s" repeatCount="indefinite"/></circle>
<text x="46" y="${y}" class="mono" font-size="10" letter-spacing="0.6" fill="${colors.muted}">${escapeXml(text)}</text>`;
}

function createDashboardSvg(config, colors, stats) {
  const { markup: statCards, bottom: statsBottom } = buildStatCards(stats, colors);
  const gap = 14;
  const panelsY = statsBottom + gap;
  const panelsHeight = 218;
  const languageBox = { x: 14, y: panelsY, width: 462, height: panelsHeight };
  const heatmapBox = { x: 14 + 462 + gap, y: panelsY, width: WIDTH - 14 - (14 + 462 + gap), height: panelsHeight };
  const chartY = panelsY + panelsHeight + gap;
  const chartBox = { x: 14, y: chartY, width: WIDTH - 28, height: 158 };
  const footerY = chartY + chartBox.height + 34;
  const height = footerY + 24;
  const username = escapeXml(config.profile.username);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${height}" viewBox="0 0 ${WIDTH} ${height}" role="img" aria-labelledby="title description">
<title id="title">${escapeXml(config.profile.name)} - Cyber Intelligence Dashboard</title>
<desc id="description">An animated dashboard visualizing live GitHub repository, contribution, and language activity.</desc>
<defs>
  <linearGradient id="background" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${colors.backgroundStart}"/><stop offset="1" stop-color="${colors.backgroundEnd}"/></linearGradient>
  <linearGradient id="border" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${colors.violet}"/><stop offset="0.48" stop-color="${colors.cyan}"/><stop offset="1" stop-color="${colors.green}"/></linearGradient>
  <linearGradient id="area-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${colors.cyan}" stop-opacity="0.4"/><stop offset="1" stop-color="${colors.cyan}" stop-opacity="0"/></linearGradient>
  <linearGradient id="chart-scan" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${colors.cyan}" stop-opacity="0"/><stop offset="0.5" stop-color="${colors.cyan}" stop-opacity="0.5"/><stop offset="1" stop-color="${colors.cyan}" stop-opacity="0"/></linearGradient>
  <pattern id="scanlines" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="1" fill="${colors.cyan}" opacity="0.05"/></pattern>
  <style>
    .mono { font-family: 'Courier New', Consolas, monospace; }
    .panel-title { font-family: 'Courier New', Consolas, monospace; font-size: 11px; letter-spacing: 2px; fill: ${colors.blue}; opacity: 0.78; }
    .live-label { font-family: 'Courier New', Consolas, monospace; font-size: 10px; letter-spacing: 1px; fill: ${colors.red}; }
  </style>
</defs>
<rect width="${WIDTH}" height="${height}" rx="${OUTER_RADIUS}" fill="url(#background)"/>
<rect width="${WIDTH}" height="${height}" rx="${OUTER_RADIUS}" fill="url(#scanlines)"/>
${buildAmbientLayer(colors, WIDTH, height)}
<rect x="3" y="3" width="${WIDTH - 6}" height="34" rx="16" fill="${colors.panel}" fill-opacity="0.84"/>
<circle cx="24" cy="20" r="5" fill="#EF4444"/><circle cx="42" cy="20" r="5" fill="#F59E0B"/><circle cx="60" cy="20" r="5" fill="${colors.green}"/>
<text x="${WIDTH / 2}" y="25" text-anchor="middle" class="mono" font-size="12" letter-spacing="0.5" fill="${colors.muted}">${username}@dashboard ~ % ./analyze --github --live</text>
<circle cx="${WIDTH - 141}" cy="20" r="4" fill="${colors.red}"><animate attributeName="opacity" values="1;0.15;1" dur="1.1s" repeatCount="indefinite"/></circle><text x="${WIDTH - 131}" y="24" class="live-label">ANALYZING</text>
${statCards}
${buildLanguagePanel(stats, colors, languageBox)}
${buildHeatmapPanel(stats, colors, heatmapBox)}
${buildAreaChart(stats, colors, chartBox)}
${buildFooterStatus(stats, colors, footerY)}
<rect x="3" y="3" width="${WIDTH - 6}" height="${height - 6}" rx="${OUTER_RADIUS - 2}" fill="none" stroke="url(#border)" stroke-width="2" opacity="0.76"><animate attributeName="opacity" values="0.5;0.94;0.5" dur="3.4s" repeatCount="indefinite"/></rect>
</svg>`;
}

export async function generateDashboardAssets({ config, stats, outputDirectory }) {
  const palette = paletteDefinitions[config.appearance.palette];
  await mkdir(outputDirectory, { recursive: true });
  const assets = { dark: "dashboard-dark.svg", light: "dashboard-light.svg" };

  await Promise.all([
    writeFile(resolve(outputDirectory, assets.dark), createDashboardSvg(config, palette.dark, stats)),
    writeFile(resolve(outputDirectory, assets.light), createDashboardSvg(config, palette.light, stats))
  ]);

  return { assets };
}
