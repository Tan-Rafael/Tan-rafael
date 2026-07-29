import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { clamp, escapeXml } from "./xml.mjs";
import { paletteDefinitions } from "./hero.mjs";

const WIDTH = 1180;
const HEIGHT = 300;
const OUTER_RADIUS = 18;

function flattenDays(dayGrid) {
  const days = [];
  dayGrid.forEach((week) => week.forEach((count) => days.push(count)));
  return days;
}

function computeStreaks(days) {
  let longest = 0;
  let running = 0;
  days.forEach((count) => {
    running = count > 0 ? running + 1 : 0;
    longest = Math.max(longest, running);
  });
  let current = 0;
  for (let index = days.length - 1; index >= 0; index -= 1) {
    if (days[index] > 0) current += 1;
    else break;
  }
  return { longest, current };
}

// Builds a smooth cubic-bezier path through a series of points using a
// Catmull-Rom to Bezier conversion, so the wave reads as a continuous
// energy signal rather than a grid of blocky cells.
function smoothPath(points) {
  if (points.length < 2) return "";
  const [first] = points;
  let d = `M ${first[0].toFixed(2)} ${first[1].toFixed(2)}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const p0 = points[index === 0 ? index : index - 1];
    const p1 = points[index];
    const p2 = points[index + 1];
    const p3 = points[index + 2 < points.length ? index + 2 : index + 1];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`;
  }
  return d;
}

function accentForIndex(index, total, colors) {
  const ratio = index / Math.max(1, total - 1);
  if (ratio < 0.34) return colors.violet;
  if (ratio < 0.67) return colors.cyan;
  return colors.green;
}

function buildWavePanel(stats, colors, box) {
  const totals = stats.weeklyTotals.length ? stats.weeklyTotals : [0];
  const maxTotal = Math.max(...totals, 1);
  const plotX = box.x + 26;
  const plotWidth = box.width - 52;
  const plotTop = box.y + 20;
  const plotHeight = box.height - 46;
  const stepX = plotWidth / Math.max(1, totals.length - 1);

  const points = totals.map((value, index) => {
    const x = plotX + index * stepX;
    const y = plotTop + plotHeight - (value / maxTotal) * plotHeight * 0.86;
    return [x, y];
  });

  const linePath = smoothPath(points);
  const baseline = plotTop + plotHeight;
  const areaPath = `${linePath} L ${(plotX + plotWidth).toFixed(2)} ${baseline.toFixed(2)} L ${plotX.toFixed(2)} ${baseline.toFixed(2)} Z`;

  const nodes = points.map(([x, y], index) => {
    const value = totals[index];
    const radius = clamp(2 + (value / maxTotal) * 4.4, 2, 6.4);
    const accent = accentForIndex(index, points.length, colors);
    const dur = (2.4 + (index % 5) * 0.35).toFixed(2);
    const delay = ((index % 7) * 0.18).toFixed(2);
    if (value <= 0) return "";
    return `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${radius.toFixed(2)}" fill="${accent}" opacity="0.85"><animate attributeName="opacity" values="0.5;1;0.5" dur="${dur}s" begin="${delay}s" repeatCount="indefinite"/></circle>`;
  }).join("");

  const comets = [0, 1, 2, 3].map((tail) => {
    const r = 6.4 - tail * 1.2;
    const op = (0.85 - tail * 0.19).toFixed(2);
    const delay = (-tail * 0.16).toFixed(2);
    return `<circle r="${r.toFixed(2)}" fill="url(#comet-core)" opacity="${op}">
  <animateMotion dur="9s" begin="${delay}s" repeatCount="indefinite" rotate="auto"><mpath href="#pulse-line"/></animateMotion>
</circle>`;
  }).join("\n");

  return `<text x="${box.x + 26}" y="${box.y - 10}" class="panel-title">CONTRIBUTION.PULSE</text>
<path d="${areaPath}" fill="url(#pulse-area)" opacity="0.55"/>
<path id="pulse-line" d="${linePath}" fill="none" stroke="url(#pulse-stroke)" stroke-width="5.5" stroke-linecap="round" opacity="0.16" filter="url(#pulse-blur)"/>
<path d="${linePath}" fill="none" stroke="url(#pulse-stroke)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
${nodes}
${comets}`;
}

function buildEqualizer(stats, colors, box) {
  const days = flattenDays(stats.dayGrid);
  const maxCount = Math.max(...days, 1);
  const barGap = 1.4;
  const barWidth = Math.max(1.1, (box.width - (days.length - 1) * barGap) / days.length);
  const baseline = box.y + box.height;

  const bars = days.map((count, index) => {
    const x = box.x + index * (barWidth + barGap);
    const heightRatio = clamp(count / maxCount, 0, 1);
    const h = Math.max(2, heightRatio * box.height);
    const accent = accentForIndex(index, days.length, colors);
    const opacity = count > 0 ? clamp(0.3 + heightRatio * 0.6, 0.3, 0.92) : 0.12;
    const dur = (1.6 + (index % 9) * 0.11).toFixed(2);
    const begin = ((index % 23) * 0.05).toFixed(2);
    return `<rect x="${x.toFixed(2)}" y="${(baseline - h).toFixed(2)}" width="${barWidth.toFixed(2)}" height="${h.toFixed(2)}" rx="${Math.min(1.2, barWidth / 2).toFixed(2)}" fill="${accent}" opacity="${opacity.toFixed(2)}"><animate attributeName="opacity" values="${opacity.toFixed(2)};${Math.max(0.12, opacity - 0.28).toFixed(2)};${opacity.toFixed(2)}" dur="${dur}s" begin="${begin}s" repeatCount="indefinite"/></rect>`;
  }).join("");

  return `<g opacity="0.85">${bars}</g>`;
}

function buildScanSweep(colors, box) {
  return `<rect x="${box.x}" y="${box.y}" width="46" height="${box.height}" fill="url(#pulse-sweep)" opacity="0.55">
  <animateTransform attributeName="transform" type="translate" from="0 0" to="${(box.width - 46).toFixed(1)} 0" dur="5.4s" repeatCount="indefinite"/>
</rect>`;
}

function buildFooter(stats, colors, y) {
  const days = flattenDays(stats.dayGrid);
  const { longest, current } = computeStreaks(days);
  const peakWeek = Math.max(...(stats.weeklyTotals.length ? stats.weeklyTotals : [0]));
  const items = [
    `${stats.contributions.toLocaleString("en-US")} CONTRIBUTIONS`,
    `LONGEST STREAK ${longest}D`,
    `CURRENT STREAK ${current}D`,
    `PEAK WEEK ${peakWeek}`
  ];
  const text = items.join("   //   ");
  return `<circle cx="30" cy="${y - 4.2}" r="4" fill="${colors.green}"><animate attributeName="opacity" values="1;0.25;1" dur="1.3s" repeatCount="indefinite"/></circle>
<text x="48" y="${y}" class="mono" font-size="12.5" letter-spacing="0.6" fill="${colors.muted}">${escapeXml(text)}</text>`;
}

function createPulseSvg(config, colors, stats) {
  const username = escapeXml(config.profile.username);
  const equalizerBox = { x: 14, y: HEIGHT - 60, width: WIDTH - 28, height: 40 };
  const waveBox = { x: 14, y: 66, width: WIDTH - 28, height: HEIGHT - 66 - 66 };

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-labelledby="pulse-title pulse-desc">
<title id="pulse-title">${escapeXml(config.profile.name)} - Contribution Pulse</title>
<desc id="pulse-desc">An animated energy-wave visualization of a year of GitHub contributions, with a traveling comet and a daily activity equalizer.</desc>
<defs>
  <linearGradient id="pulse-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${colors.backgroundStart}"/><stop offset="1" stop-color="${colors.backgroundEnd}"/></linearGradient>
  <linearGradient id="pulse-border" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${colors.violet}"/><stop offset="0.5" stop-color="${colors.cyan}"/><stop offset="1" stop-color="${colors.green}"/></linearGradient>
  <linearGradient id="pulse-stroke" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${colors.violet}"/><stop offset="0.5" stop-color="${colors.cyan}"/><stop offset="1" stop-color="${colors.green}"/></linearGradient>
  <linearGradient id="pulse-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${colors.cyan}" stop-opacity="0.45"/><stop offset="1" stop-color="${colors.cyan}" stop-opacity="0"/></linearGradient>
  <linearGradient id="pulse-sweep" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${colors.cyan}" stop-opacity="0"/><stop offset="0.5" stop-color="${colors.cyan}" stop-opacity="0.4"/><stop offset="1" stop-color="${colors.cyan}" stop-opacity="0"/></linearGradient>
  <radialGradient id="comet-core"><stop offset="0" stop-color="#FFFFFF"/><stop offset="0.4" stop-color="${colors.cyan}"/><stop offset="1" stop-color="${colors.cyan}" stop-opacity="0"/></radialGradient>
  <filter id="pulse-blur" x="-20%" y="-100%" width="140%" height="300%"><feGaussianBlur stdDeviation="4.2"/></filter>
  <pattern id="pulse-scanlines" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="1" fill="${colors.cyan}" opacity="0.045"/></pattern>
  <style>
    .mono { font-family: 'Courier New', Consolas, monospace; }
    .panel-title { font-family: 'Courier New', Consolas, monospace; font-size: 13.5px; letter-spacing: 2.2px; fill: ${colors.blue}; opacity: 0.82; }
    .live-label { font-family: 'Courier New', Consolas, monospace; font-size: 12.5px; letter-spacing: 1px; fill: ${colors.red}; }
  </style>
</defs>
<rect width="${WIDTH}" height="${HEIGHT}" rx="${OUTER_RADIUS}" fill="url(#pulse-bg)"/>
<rect width="${WIDTH}" height="${HEIGHT}" rx="${OUTER_RADIUS}" fill="url(#pulse-scanlines)"/>
<rect x="3" y="3" width="${WIDTH - 6}" height="40" rx="16" fill="${colors.panel}" fill-opacity="0.84"/>
<circle cx="26" cy="23" r="5.5" fill="#EF4444"/><circle cx="46" cy="23" r="5.5" fill="#F59E0B"/><circle cx="66" cy="23" r="5.5" fill="${colors.green}"/>
<text x="${WIDTH / 2}" y="28" text-anchor="middle" class="mono" font-size="15" letter-spacing="0.5" fill="${colors.muted}">${username}@pulse ~ % ./stream --contributions --live</text>
<circle cx="${WIDTH - 168}" cy="23" r="4.6" fill="${colors.red}"><animate attributeName="opacity" values="1;0.15;1" dur="1.1s" repeatCount="indefinite"/></circle><text x="${WIDTH - 156}" y="28" class="live-label">STREAMING</text>
${buildWavePanel(stats, colors, waveBox)}
${buildScanSweep(colors, { x: waveBox.x, y: waveBox.y - 4, width: waveBox.width, height: waveBox.height - 20 })}
${buildEqualizer(stats, colors, equalizerBox)}
${buildFooter(stats, colors, HEIGHT - 16)}
<rect x="3" y="3" width="${WIDTH - 6}" height="${HEIGHT - 6}" rx="${OUTER_RADIUS - 2}" fill="none" stroke="url(#pulse-border)" stroke-width="2" opacity="0.76"><animate attributeName="opacity" values="0.5;0.94;0.5" dur="3.4s" repeatCount="indefinite"/></rect>
</svg>`;
}

export async function generatePulseAssets({ config, stats, outputDirectory }) {
  const palette = paletteDefinitions[config.appearance.palette];
  await mkdir(outputDirectory, { recursive: true });
  const assets = { dark: "pulse-dark.svg", light: "pulse-light.svg" };

  await Promise.all([
    writeFile(resolve(outputDirectory, assets.dark), createPulseSvg(config, palette.dark, stats)),
    writeFile(resolve(outputDirectory, assets.light), createPulseSvg(config, palette.light, stats))
  ]);

  return { assets };
}
