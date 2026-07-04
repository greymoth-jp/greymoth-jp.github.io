// Refresh the homepage impact-map numbers + adoption counters from public sources.
// Run by .github/workflows/refresh-stats.yml (daily) or `node scripts/refresh-stats.mjs`.
// - Numeric spans <!--S:key-->value<!--/S--> are rewritten in place.
// - The <!--ADOPT:START-->…<!--ADOPT:END--> block is populated ONLY when adoption is
//   non-zero, so the site shows nothing embarrassing at 0 and self-reveals the moment
//   someone installs the tool. The "date" span bumps only when something changed.
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const AUTHOR = 'greymoth-jp';
const FILE = new URL('../index.html', import.meta.url);
const sh = (cmd) => execSync(cmd, { encoding: 'utf8' });

// --- merged/open/closed PR counts (GitHub search) ---
const search = (flags) =>
  JSON.parse(sh(`gh search prs --author=${AUTHOR} ${flags} --limit 1000 --json repository`));
const merged = search('--merged');
const open = search('--state=open');
const closed = search('--state=closed'); // GitHub counts merged PRs as closed
const nums = {
  merged: merged.length,
  repos: new Set(merged.map((p) => p.repository.nameWithOwner)).size,
  open: open.length,
  rejected: Math.max(0, Math.round((closed.length - merged.length) / 5) * 5),
};

// --- adoption: weekly npm installs of the scorecard (0 / not-found → hidden) ---
// ponytail: npm's per-package endpoint is the only clean, no-auth adoption counter today;
// add GitHub "used by" later if a dependents API appears.
let npmWeekly = 0;
try {
  const j = JSON.parse(
    sh(`curl -s "https://api.npmjs.org/downloads/point/last-week/@greymoth/i18n-scorecard"`)
  );
  if (typeof j.downloads === 'number') npmWeekly = j.downloads;
} catch { /* not-found / offline → stays 0, block stays empty */ }

const adoptHtml =
  npmWeekly > 0
    ? `<p class="note" style="margin-top:14px"><b>Adoption so far.</b> <b>${npmWeekly}</b> weekly npm installs of <span class="mono">@greymoth/i18n-scorecard</span> — the first repos running the pipeline. Auto-counted from the npm registry, same as the merge numbers above.</p>`
    : '';

let html = readFileSync(FILE, 'utf8');
let changed = false;

for (const [k, v] of Object.entries(nums)) {
  html = html.replace(new RegExp(`(<!--S:${k}-->)(.*?)(<!--/S-->)`, 'g'), (_m, a, old, c) => {
    if (String(old) !== String(v)) changed = true;
    return `${a}${v}${c}`;
  });
}

html = html.replace(/(<!--ADOPT:START-->)([\s\S]*?)(<!--ADOPT:END-->)/g, (_m, a, old, c) => {
  if (old !== adoptHtml) changed = true;
  return `${a}${adoptHtml}${c}`;
});

if (changed) {
  const date = new Date().toISOString().slice(0, 10);
  html = html.replace(/(<!--S:date-->)(.*?)(<!--\/S-->)/g, `$1${date}$3`);
  writeFileSync(FILE, html);
  console.log('updated', JSON.stringify({ ...nums, npmWeekly, date }));
} else {
  console.log('no change', JSON.stringify({ ...nums, npmWeekly }));
}
