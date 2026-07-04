// Refresh the homepage impact-map numbers from the GitHub API.
// Run by .github/workflows/refresh-stats.yml (daily) or `node scripts/refresh-stats.mjs`.
// Rewrites <!--S:key-->value<!--/S--> spans in index.html; the "date" span only
// bumps when a number actually changed, so "last synced" = last time the count moved.
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const AUTHOR = 'greymoth-jp';
const FILE = new URL('../index.html', import.meta.url);

// gh is authed via GH_TOKEN in Actions, or the local keyring when run by hand.
const search = (flags) =>
  JSON.parse(
    execSync(`gh search prs --author=${AUTHOR} ${flags} --limit 1000 --json repository`, {
      encoding: 'utf8',
    })
  );

const merged = search('--merged');
const open = search('--state=open');
const closed = search('--state=closed'); // GitHub counts merged PRs as closed

const nums = {
  merged: merged.length,
  repos: new Set(merged.map((p) => p.repository.nameWithOwner)).size,
  open: open.length,
  // closed-without-merge, rounded to the nearest 5 for the "around N" phrasing
  rejected: Math.max(0, Math.round((closed.length - merged.length) / 5) * 5),
};

let html = readFileSync(FILE, 'utf8');
let changed = false;
for (const [k, v] of Object.entries(nums)) {
  html = html.replace(new RegExp(`(<!--S:${k}-->)(.*?)(<!--/S-->)`, 'g'), (_m, a, old, c) => {
    if (String(old) !== String(v)) changed = true;
    return `${a}${v}${c}`;
  });
}

if (changed) {
  const date = new Date().toISOString().slice(0, 10); // ponytail: UTC date is fine for a "last synced" stamp
  html = html.replace(/(<!--S:date-->)(.*?)(<!--\/S-->)/g, `$1${date}$3`);
  writeFileSync(FILE, html);
  console.log('updated', JSON.stringify({ ...nums, date }));
} else {
  console.log('no change', JSON.stringify(nums));
}
