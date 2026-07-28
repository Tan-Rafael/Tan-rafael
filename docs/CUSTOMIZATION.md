# Customization

## Edit Configuration First

Most customization belongs in `profile.config.json`. The schema limits hero text lengths because SVG terminal rows cannot wrap safely.

### Profile

Use a specific headline that combines direction and evidence, such as:

- `AI Researcher & Web3 Builder`
- `Machine Learning Engineer & Open Source Maintainer`
- `Backend Engineer & Developer Tools Builder`

Avoid long skill inventories in the headline.

### Research Direction

The `research` object powers both the terminal panel and the longer Research Direction section. Keep `primary`, `direction`, and `themes` compact; use `narrative` for nuance.

### Featured Projects

The first four projects appear in the hero. Up to six appear in the README table. Order them by how strongly they support your positioning, not by creation date.

`heroLabel` should describe the project's role in two to four words, for example `Web3 trust layer` or `Test recovery system`.

### Public Links

The first two links appear in the hero. Up to four become badges below it. Only include links you are comfortable making permanently public.

## Palettes

- `signal`: cyan, violet, and green on a research-console background.
- `ocean`: teal, blue, and indigo with a calmer systems feel.
- `solar`: cyan, blue, and amber with warmer technical accents.
- `quantum`: neon cyan, electric blue, and neon violet on a near-black background, with an ambient neural network, rotating AI core, and animated corner frames layered behind the panels for an AI command-center feel.

Every palette includes separate dark and light values.

## Portrait Guidance

Best results come from:

- A transparent PNG.
- Head-to-torso framing.
- Clear facial lighting.
- Visible separation between hair, face, and clothing.
- Minimal translucent edges around the cutout.

Do not add a decorative background before generation. The console adds its own restrained ambient layer.

## Updating Later

Edit `profile.config.json`, then regenerate with the same private source file:

```bash
npm run generate -- --source /absolute/path/to/portrait.png
```

The content and portrait determine a new eight-character asset version. Old generated hero assets are removed automatically, and README receives the new filenames.

If you only changed `profile.config.json` text or `appearance.palette` and do not have the original portrait file on hand, run `npm run generate:hero-theme` instead. It reuses the ASCII portrait already baked into the current `assets/hero/*.svg` files and rebuilds everything else (palette, copy, ambient layers) around it.

Recent Activity content is preserved when the full README is regenerated.

## Cyber Intelligence Dashboard

The `## GitHub Stats` section is rendered by `scripts/lib/dashboard.mjs` from real data instead of third-party badge services. It fetches your public repository, star, fork, follower, language, issue, pull request, and contribution-calendar totals through the GitHub API and draws them as animated stat rings, language bars, a contribution heatmap, and a weekly activity chart, styled to match the hero console's `quantum` theme.

Regenerate it whenever you want fresh numbers sooner than the scheduled workflow:

```bash
GITHUB_TOKEN=your_personal_access_token npm run dashboard
```

Or preview the layout offline with placeholder data:

```bash
npm run dashboard:sample
```

Output files are written to `assets/dashboard/dashboard-dark.svg` and `assets/dashboard/dashboard-light.svg`. The reference scales behind each stat ring (for example, 500 stars or 1,500 yearly contributions for a "full" ring) are cosmetic and can be adjusted in `STAT_DEFS` inside `scripts/lib/dashboard.mjs` if your numbers are much larger or smaller.
