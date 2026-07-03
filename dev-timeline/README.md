# Dev Timeline — your year in code, printed like a zine

A developer "Spotify Wrapped": enter a GitHub username, get a **shareable riso-print poster**
of your year in code — contributions, longest streak, top languages, busiest day, the year's
growth graph, and a deterministic archetype (THE MACHINE / NIGHT OWL / POLYGLOT / …).

**Zero backend.** Pure client-side HTML/CSS/JS — deploy the folder to any static host
(`vercel --prod`, GitHub Pages, Netlify). Your GitHub token (optional) is used only for the
request from your own browser and is never sent to any server.

The share image *is* the product — every print is the ad.

## Why it looks different
Every other GitHub-Wrapped tool is dark + monospace + mint = AI-slop. This one is the opposite:
**warm newsprint paper, duotone vermillion × deep ink, halftone giant numerals, a perforated
print-pass frame.** One bold bet, cohesion the only rule (display = Anton, accent = Fraunces
italic, data = JetBrains Mono).

## Honest data (cold, no fake precision)
| stat | token mode | public mode (no token) |
|---|---|---|
| contributions / streak / calendar / growth | **exact** (GraphQL `contributionsCollection`) | unavailable — GitHub only exposes these with a token |
| languages / repos / stars | exact (public REST) | exact |
| lines added/deleted | not fetched (needs per-commit stats) → shown as `unavailable`, never faked | unavailable |
| busiest hour | estimated (recent events window) | estimated |

Every number on screen carries a provenance badge (`exact` / `estimated` / `unavailable`).
Public mode is rate-limited to 60 requests/hour by GitHub.

## Architecture (deterministic core = the moat)
- `engine.js` — **pure** (Node+browser): normalized GitHub data → Wrapped stats. No network, no `Date.now`/`Math.random`. Same input ⇒ same output.
- `card.js` — **pure**: `buildModel(stats)` → draw primitives (single source of truth) → `renderSVG` (on-screen) and `renderCanvas` (PNG export with correct fonts).
- `github.js` — thin browser fetch client (GraphQL token-mode / REST public-mode).
- `fixtures.js` — 3 offline personas; `index.html` / `app.js` / `styles.css` — the app.

## Verify
```
node engine.audit.js     # 100% PASS — invariants + 3000× fuzz
node experiment.js       # 3 personas run fixtures→engine→card→SVG end-to-end
```
Then open `index.html` (or serve the folder) and hit **Try a demo** — works fully offline.

## Roadmap (deferred)
`@vercel/og` dynamic OG card · OAuth device-flow (instead of pasted token) · multi-card story export ·
leaderboard (needs backend). Same engine/card base reused by the sibling apps (Internet Resume,
Open Source Wrapped, Indie Hacker Radar, Japan Readiness Score).

## License / references
Patterns studied (not copied) and license-logged in `../../GitRepo/REFERENCES.md` (2026-06-22):
github-readme-stats, streak-stats, gitstory-2025 (all MIT) for data approach; CSS-Tricks /
Frontend Masters / utilitybend for the duotone/halftone/grain technique.
