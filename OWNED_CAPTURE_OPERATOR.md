# Owned-capture — what shipped, and how to wire email (operator)

Principle: rented reach (X / Discord / algorithm) churns and can be taken away.
Owned capture (GitHub follow, RSS, email opt-in) compounds and is yours. This
page documents what is already live and the one piece that needs your account.

## Live now (no backend, fully owned)

1. **GitHub-follow CTA** — `index.html`, "Follow the work" section. Links to
   https://github.com/greymoth-jp . Every new public repo notifies your
   followers = a real owned launch channel. Nothing to maintain.
2. **Atom feed** — `feed.xml`, served at https://greymoth-jp.github.io/feed.xml
   (`application/xml`, valid Atom). Discoverable via
   `<link rel="alternate" type="application/atom+xml">` in `<head>` and the
   "RSS" button in the follow section. People subscribe in any reader = owned.
   **When you ship a new artifact, add one `<entry>` to `feed.xml`** (copy an
   existing entry, change title/id/link/updated/summary, bump the top-level
   `<updated>`). Keep newest first.

## Prepared, NOT faked — email list (your move)

The page shows a **"Coming soon — email list"** block on purpose. There is no
dead form that silently drops addresses. To make it live, pick a free service
below, create the account (operator-gated — not automated), and replace the
`.notify` block in `index.html` with one of the embed snippets.

### Recommendation (one line)

**Use Buttondown (free tier)** — it's the most "owned" of the free options:
plain-text-first, you can export your subscriber list any time, an RSS-to-email
automation can mail your existing `feed.xml` on each launch, and it stays out of
your way. Substack is fastest to stand up but it owns the reader relationship and
nudges toward its network; ConvertKit/Kit's free tier is generous but heavier and
more marketing-flavoured than this honest, low-key brand wants.

| Service | Free tier | Why / trade-off |
|---|---|---|
| **Buttondown** (pick this) | ~100 subs free | Plain, export-anytime, RSS→email automation pairs perfectly with `feed.xml`. Most "owned". |
| Substack | unlimited free | Zero setup, but Substack owns discovery/reader graph; less "yours". |
| ConvertKit / Kit | ~1,000 subs free | Generous, but heavier, markety; more than this brand needs. |

### Embed snippets — paste in place of the `.notify` block

The current placeholder in `index.html` is:

```html
<div class="notify"> ... Coming soon ... </div>
```

Replace it with ONE of these once the account exists. Styling reuses the
existing `.notify` shell so it stays on-brand; tweak the `action`/embed URL to
your account.

**Buttondown (recommended)** — replace `YOURNAME`:

```html
<form class="notify" action="https://buttondown.com/api/emails/embed-subscribe/YOURNAME"
      method="post" target="popupwindow"
      onsubmit="window.open('https://buttondown.com/YOURNAME','popupwindow')">
  <p class="head"><span style="font-size:11.5px;color:var(--faded);font-style:italic;font-family:var(--serif)">Get notified by email when I ship something new</span></p>
  <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px">
    <input type="email" name="email" placeholder="you@example.com" required
           style="flex:1;min-width:200px;font:inherit;font-size:13px;padding:10px 12px;border:1.5px solid var(--ink);border-radius:3px;background:#faf5e8;color:var(--ink)">
    <button type="submit"
            style="font:inherit;font-size:13px;font-weight:500;color:var(--paper);background:var(--vrm);border:1.5px solid var(--vrm);border-radius:3px;padding:10px 18px;cursor:pointer">Notify me</button>
  </div>
  <p style="font-size:11px;color:var(--faded);margin:10px 0 0">Launches only. No spam, unsubscribe any time.</p>
</form>
```

**ConvertKit / Kit** — swap in your form `action` + `data-uid` (Kit gives a full
embed; the same input/button markup above works, point `action` at your Kit form
URL).

**Substack** — Substack hosts the form; either link to your
`yourname.substack.com/subscribe` from the existing button, or paste Substack's
iframe embed inside the `.notify` shell.

### After wiring email

1. Replace the `.notify` placeholder with the chosen snippet.
2. Delete the "Coming soon" copy (it's served honestly only while there's no form).
3. (Buttondown) Turn on the RSS-to-email automation pointed at
   `https://greymoth-jp.github.io/feed.xml` so adding a `feed.xml` `<entry>`
   both updates RSS subscribers AND emails the list — one source of truth.

Do not ship a form that silently fails. Honesty over a dead button.
