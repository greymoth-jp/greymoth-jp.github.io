// dev-timeline / card.js — pure "born-to-share" poster generator.
// buildModel(stats) -> ordered draw primitives on a 1080x1350 canvas (single source
// of truth). renderSVG(model) -> on-screen SVG string. app.js renders the SAME model
// to <canvas> for the exported PNG (correct fonts). No network, deterministic, auditable.
//
// Design bet (locked via design-ref): RISO PRINT POSTER, not dark glass.
// cream newsprint + duotone vermillion x deep-ink + halftone giant numeral on a
// perforated print-pass frame. Display=Anton, accent=Fraunces italic, labels=JetBrains Mono.

var W = 1080, H = 1350;
var INK = '#16130F', CREAM = '#F4EEE2', VERM = '#FF3B14', BLUE = '#1B43FF', PAPER2 = '#EAE2D0';

function nf(n) { return (n == null ? 0 : n).toLocaleString('en-US'); }
function compact(n) { // 1234567 -> 1.2M
  n = n || 0;
  if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M';
  if (n >= 1e4) return (n / 1e3).toFixed(0) + 'k';
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(n);
}

// build the ordered primitive list. items: rect | text | bar | halftone | perf | line.
function buildModel(stats) {
  var s = stats, items = [];
  var add = function (o) { items.push(o); };

  add({ t: 'rect', x: 0, y: 0, w: W, h: H, fill: CREAM });
  add({ t: 'grain', x: 0, y: 0, w: W, h: H });                 // riso paper grain overlay
  // print-pass frame (double ink hairline) + perforation
  add({ t: 'rect', x: 40, y: 40, w: W - 80, h: H - 80, fill: 'none', stroke: INK, sw: 3 });
  add({ t: 'rect', x: 52, y: 52, w: W - 104, h: H - 104, fill: 'none', stroke: INK, sw: 1 });
  add({ t: 'perf', x: 40, y: 250, w: W - 80 });                 // tear line under header

  // --- header: ticket meta ---
  add({ t: 'rect', x: 40, y: 40, w: W - 80, h: 70, fill: VERM });
  add({ t: 'text', s: 'DEV · TIMELINE', x: 78, y: 88, size: 34, font: 'mono', color: CREAM, ls: 6 });
  add({ t: 'text', s: 'PROOF OF WORK', x: W - 78, y: 88, size: 26, font: 'mono', color: CREAM, ls: 4, anchor: 'end' });
  add({ t: 'text', s: '@' + (s.user && s.user.login || 'unknown'), x: 78, y: 178, size: 58, font: 'display', color: INK });
  add({ t: 'text', s: 'YEAR IN CODE — ' + s.year, x: 80, y: 224, size: 28, font: 'mono', color: INK, ls: 3 });
  add({ t: 'text', s: String(s.year).slice(-2), x: W - 92, y: 240, size: 124, font: 'display', color: VERM, anchor: 'end', halftone: true });

  // --- HERO: the one memorable element — giant halftone numeral = total contributions ---
  var heroLabel = s.totalDays ? 'CONTRIBUTIONS' : 'PUBLIC ACTIONS · 90d';
  var heroVal = compact(s.totalContributions);
  add({ t: 'text', s: heroLabel, x: 82, y: 344, size: 28, font: 'mono', color: INK, ls: 6 });
  add({ t: 'text', s: heroVal, x: 70, y: 608, size: 300, font: 'display', color: INK, halftone: true });
  if (s.totalDays) {
    add({ t: 'text', s: s.activeDays + ' active days · ' + s.restDays + ' rest', x: 82, y: 656, size: 30, font: 'mono', color: VERM, ls: 1 });
  } else {
    add({ t: 'text', s: 'public mode — full calendar needs a token', x: 82, y: 656, size: 26, font: 'mono', color: VERM, ls: 1 });
  }

  // --- stat tiles row (2x2 implied via 4 columns) ---
  var top = s.topLanguages[0] ? s.topLanguages[0].name : '—';
  var tiles = [
    { k: 'LONGEST STREAK', v: s.totalDays ? s.longestStreak + 'd' : '—' },
    { k: 'TOP LANGUAGE', v: top },
    { k: 'STARS EARNED', v: compact(s.starsEarned) },
    { k: s.busiestWeekday ? 'BUSIEST DAY' : 'REPOS', v: s.busiestWeekday ? s.busiestWeekday.name : nf(s.totalRepos) }
  ];
  var tx = 70, tw = (W - 140) / 4, ty = 720;
  add({ t: 'perf', x: 40, y: ty - 26, w: W - 80 });
  tiles.forEach(function (tl, i) {
    var cx = tx + i * tw;
    if (i > 0) add({ t: 'line', x1: cx, y1: ty + 6, x2: cx, y2: ty + 150, stroke: INK, sw: 1 });
    add({ t: 'text', s: tl.k, x: cx + 14, y: ty + 34, size: 19, font: 'mono', color: INK, ls: 1 });
    add({ t: 'text', s: String(tl.v), x: cx + 12, y: ty + 118, size: tl.v.length > 6 ? 46 : 62, font: 'display', color: i === 1 ? VERM : INK });
  });

  // --- growth bars (12 months) — the year's shape ---
  var gy = 920, gh = 220, gx = 80, gw = W - 160;
  add({ t: 'text', s: s.growthSeries ? 'THE YEAR, MONTH BY MONTH' : 'GROWTH — needs token for monthly data', x: 80, y: gy - 8, size: 22, font: 'mono', color: INK, ls: 3 });
  if (s.growthSeries) {
    var max = Math.max.apply(null, s.growthSeries) || 1;
    var bw = gw / 12, peak = s.growthSeries.indexOf(max);
    var MON = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
    s.growthSeries.forEach(function (v, i) {
      var bh = Math.max(3, Math.round(v / max * gh));
      add({ t: 'rect', x: gx + i * bw + 4, y: gy + gh - bh, w: bw - 8, h: bh, fill: i === peak ? VERM : INK });
      add({ t: 'text', s: MON[i], x: gx + i * bw + bw / 2, y: gy + gh + 30, size: 20, font: 'mono', color: INK, anchor: 'middle' });
    });
  } else {
    add({ t: 'rect', x: gx, y: gy + 10, w: gw, h: gh, fill: PAPER2 });
    add({ t: 'text', s: 'connect a GitHub token to unlock the full-year graph', x: W / 2, y: gy + 10 + gh / 2 + 6, size: 24, font: 'mono', color: INK, anchor: 'middle' });
  }

  // --- archetype stamp ---
  var ay = 1210;
  add({ t: 'perf', x: 40, y: ay - 36, w: W - 80 });
  add({ t: 'rect', x: 70, y: ay - 14, w: 360, h: 96, fill: INK, rot: -2 });
  add({ t: 'text', s: s.archetype.label, x: 90, y: ay + 30, size: 40, font: 'display', color: VERM, rot: -2 });
  add({ t: 'text', s: 'ARCHETYPE', x: 92, y: ay + 64, size: 18, font: 'mono', color: CREAM, ls: 4, rot: -2 });
  add({ t: 'text', s: '“' + s.archetype.blurb + '”', x: 460, y: ay + 26, size: 30, font: 'serif', color: INK, italic: true, wrap: 560 });
  add({ t: 'text', s: 'greymoth-jp.github.io/dev-timeline', x: W - 78, y: ay + 74, size: 18, font: 'mono', color: INK, anchor: 'end', ls: 1 });

  return { w: W, h: H, bg: CREAM, archetype: s.archetype.key, items: items };
}

// ---------- STORY: Spotify-Wrapped-style slides (each 1080x1350, one bold focus) ----------
function storyBase(login, page) {
  var items = [], add = function (o) { items.push(o); };
  add({ t: 'rect', x: 0, y: 0, w: W, h: H, fill: CREAM });
  add({ t: 'grain', x: 0, y: 0, w: W, h: H });
  add({ t: 'rect', x: 40, y: 40, w: W - 80, h: H - 80, fill: 'none', stroke: INK, sw: 3 });
  add({ t: 'rect', x: 52, y: 52, w: W - 104, h: H - 104, fill: 'none', stroke: INK, sw: 1 });
  add({ t: 'rect', x: 40, y: 40, w: W - 80, h: 64, fill: VERM });
  add({ t: 'text', s: '@' + login, x: 78, y: 81, size: 28, font: 'mono', color: CREAM, ls: 3 });
  add({ t: 'text', s: page + '/6', x: W - 78, y: 81, size: 28, font: 'mono', color: CREAM, ls: 2, anchor: 'end' });
  return { items: items, add: add };
}
function buildStory(s) {
  var login = (s.user && s.user.login) || 'unknown', out = [];
  function push(key, title, b) { out.push({ key: key, title: title, model: { w: W, h: H, bg: CREAM, items: b.items } }); }

  // 1) cover
  var c = storyBase(login, 1);
  c.add({ t: 'text', s: 'YOUR', x: 80, y: 430, size: 150, font: 'display', color: INK });
  c.add({ t: 'text', s: 'YEAR IN', x: 80, y: 580, size: 150, font: 'display', color: INK });
  c.add({ t: 'text', s: 'CODE', x: 80, y: 730, size: 150, font: 'display', color: VERM, halftone: true });
  c.add({ t: 'text', s: String(s.year), x: 84, y: 800, size: 34, font: 'mono', color: INK, ls: 6 });
  c.add({ t: 'perf', x: 40, y: 1180, w: W - 80 });
  c.add({ t: 'text', s: '“a riso print, not a dashboard”', x: 80, y: 1250, size: 32, font: 'serif', color: INK, italic: true });
  push('cover', 'Cover', c);

  // 2) contributions
  var v = storyBase(login, 2);
  v.add({ t: 'text', s: 'YOU MADE', x: 82, y: 300, size: 40, font: 'mono', color: INK, ls: 6 });
  v.add({ t: 'text', s: compact(s.totalContributions), x: 70, y: 660, size: 340, font: 'display', color: INK, halftone: true });
  v.add({ t: 'text', s: s.totalDays ? 'CONTRIBUTIONS' : 'PUBLIC ACTIONS', x: 84, y: 740, size: 44, font: 'display', color: VERM });
  if (s.totalDays) v.add({ t: 'text', s: s.activeDays + ' active days · ' + s.restDays + ' days of rest', x: 84, y: 820, size: 30, font: 'mono', color: INK });
  else v.add({ t: 'text', s: 'public actions in the last ~90 days · add a token for your full year', x: 84, y: 800, size: 26, font: 'mono', color: INK });
  push('contributions', 'Contributions', v);

  // 3) languages
  var l = storyBase(login, 3);
  l.add({ t: 'text', s: 'YOUR STACK', x: 82, y: 300, size: 40, font: 'mono', color: INK, ls: 6 });
  var top = s.topLanguages.slice(0, 5), ly = 420, lh = 150, lw = W - 160;
  if (top.length) {
    top.forEach(function (lng, i) {
      var y = ly + i * lh, bw = Math.max(60, Math.round(lw * lng.pct / (top[0].pct || 1)));
      l.add({ t: 'rect', x: 80, y: y, w: bw, h: 96, fill: i === 0 ? VERM : INK });
      l.add({ t: 'text', s: lng.name, x: 96, y: y + 64, size: 48, font: 'display', color: CREAM });
      l.add({ t: 'text', s: lng.pct + '%', x: 80 + bw + 20, y: y + 64, size: 44, font: 'display', color: INK });
    });
  } else { l.add({ t: 'text', s: 'no public languages found', x: 84, y: 480, size: 30, font: 'mono', color: INK }); }
  push('languages', 'Languages', l);

  // 4) peak
  var p = storyBase(login, 4);
  p.add({ t: 'text', s: 'YOUR PEAK', x: 82, y: 300, size: 40, font: 'mono', color: INK, ls: 6 });
  if (s.mostActiveDay) {
    p.add({ t: 'text', s: s.mostActiveDay.count + '', x: 70, y: 600, size: 300, font: 'display', color: INK, halftone: true });
    p.add({ t: 'text', s: 'CONTRIBUTIONS IN ONE DAY', x: 84, y: 680, size: 32, font: 'display', color: VERM });
    p.add({ t: 'text', s: s.mostActiveDay.weekday + ' · ' + s.mostActiveDay.date, x: 84, y: 740, size: 30, font: 'mono', color: INK });
    if (s.busiestWeekday) p.add({ t: 'text', s: 'busiest weekday: ' + s.busiestWeekday.name, x: 84, y: 800, size: 28, font: 'mono', color: INK });
    if (s.busiestHour) p.add({ t: 'text', s: 'most code around ' + (s.busiestHour.hour < 10 ? '0' : '') + s.busiestHour.hour + ':00 (est.)', x: 84, y: 850, size: 28, font: 'mono', color: INK });
  } else { p.add({ t: 'text', s: 'add a token to unlock your peak day', x: 84, y: 520, size: 30, font: 'mono', color: INK }); }
  push('peak', 'Peak', p);

  // 5) streak
  var st = storyBase(login, 5);
  st.add({ t: 'text', s: 'YOU KEPT GOING', x: 82, y: 300, size: 40, font: 'mono', color: INK, ls: 5 });
  if (s.totalDays) {
    st.add({ t: 'text', s: String(s.longestStreak), x: 70, y: 640, size: 320, font: 'display', color: INK, halftone: true });
    st.add({ t: 'text', s: 'DAYS IN A ROW', x: 84, y: 720, size: 44, font: 'display', color: VERM });
    st.add({ t: 'text', s: 'current streak: ' + s.currentStreak + ' days', x: 84, y: 790, size: 30, font: 'mono', color: INK });
    // ridge: 12 month bars
    if (s.growthSeries) {
      var max = Math.max.apply(null, s.growthSeries) || 1, gx = 84, gw = W - 168, bw2 = gw / 12;
      s.growthSeries.forEach(function (m, i) { var bh = Math.max(3, Math.round(m / max * 200)); st.add({ t: 'rect', x: gx + i * bw2 + 3, y: 1130 - bh, w: bw2 - 6, h: bh, fill: INK }); });
    }
  } else { st.add({ t: 'text', s: 'streaks need a token (GraphQL calendar)', x: 84, y: 520, size: 30, font: 'mono', color: INK }); }
  push('streak', 'Streak', st);

  // 6) archetype
  var a = storyBase(login, 6);
  a.add({ t: 'text', s: 'YOU ARE', x: 82, y: 320, size: 40, font: 'mono', color: INK, ls: 8 });
  a.add({ t: 'rect', x: 70, y: 420, w: W - 140, h: 220, fill: INK, rot: -1.5 });
  a.add({ t: 'text', s: s.archetype.label, x: W / 2, y: 560, size: 86, font: 'display', color: VERM, anchor: 'middle', rot: -1.5 });
  a.add({ t: 'text', s: '“' + s.archetype.blurb + '”', x: 80, y: 760, size: 38, font: 'serif', color: INK, italic: true, wrap: 920 });
  a.add({ t: 'perf', x: 40, y: 1170, w: W - 80 });
  a.add({ t: 'text', s: 'made at greymoth-jp.github.io/dev-timeline', x: W / 2, y: 1240, size: 24, font: 'mono', color: INK, anchor: 'middle', ls: 1 });
  push('archetype', 'Archetype', a);

  return out;
}

// ---------- SVG renderer (on-screen) ----------
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
var FONTS = { display: "Anton, 'Arial Narrow', sans-serif", mono: "'JetBrains Mono', ui-monospace, monospace", serif: "Fraunces, Georgia, serif" };

function svgText(it) {
  var anchor = it.anchor || 'start';
  var fam = FONTS[it.font] || FONTS.display;
  var style = it.italic ? 'font-style:italic;' : '';
  var ls = it.ls ? ' letter-spacing="' + it.ls + '"' : '';
  var rot = it.rot ? ' transform="rotate(' + it.rot + ' ' + it.x + ' ' + it.y + ')"' : '';
  var fill = it.halftone ? 'url(#halftone)' : it.color;
  // simple word-wrap for blurb
  if (it.wrap) {
    var words = String(it.s).split(' '), lines = [], cur = '', cpl = Math.floor(it.wrap / (it.size * 0.5));
    words.forEach(function (w) { if ((cur + ' ' + w).trim().length > cpl) { lines.push(cur.trim()); cur = w; } else cur += ' ' + w; });
    if (cur.trim()) lines.push(cur.trim());
    var tspans = lines.map(function (l, i) { return '<tspan x="' + it.x + '" dy="' + (i === 0 ? 0 : it.size * 1.05) + '">' + esc(l) + '</tspan>'; }).join('');
    return '<text x="' + it.x + '" y="' + it.y + '" font-family="' + fam + '" font-size="' + it.size + '" fill="' + it.color + '" text-anchor="' + anchor + '" style="' + style + '"' + ls + rot + '>' + tspans + '</text>';
  }
  return '<text x="' + it.x + '" y="' + it.y + '" font-family="' + fam + '" font-size="' + it.size + '" fill="' + fill + '" text-anchor="' + anchor + '" style="' + style + '"' + ls + rot + '>' + esc(it.s) + '</text>';
}

function renderSVG(model) {
  var defs =
    '<defs>' +
    '<filter id="grainf"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.06 0"/></filter>' +
    '<pattern id="halftone" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="' + INK + '"/><circle cx="4" cy="4" r="3.1" fill="' + VERM + '"/></pattern>' +
    '</defs>';
  var body = model.items.map(function (it) {
    if (it.t === 'rect') {
      var stroke = it.stroke ? ' stroke="' + it.stroke + '" stroke-width="' + (it.sw || 1) + '"' : '';
      var rot = it.rot ? ' transform="rotate(' + it.rot + ' ' + it.x + ' ' + it.y + ')"' : '';
      return '<rect x="' + it.x + '" y="' + it.y + '" width="' + it.w + '" height="' + it.h + '" fill="' + it.fill + '"' + stroke + rot + '/>';
    }
    if (it.t === 'grain') return '<rect x="0" y="0" width="' + W + '" height="' + H + '" filter="url(#grainf)"/>';
    if (it.t === 'line') return '<line x1="' + it.x1 + '" y1="' + it.y1 + '" x2="' + it.x2 + '" y2="' + it.y2 + '" stroke="' + it.stroke + '" stroke-width="' + (it.sw || 1) + '"/>';
    if (it.t === 'perf') return '<line x1="' + it.x + '" y1="' + it.y + '" x2="' + (it.x + it.w) + '" y2="' + it.y + '" stroke="' + INK + '" stroke-width="2" stroke-dasharray="2 8" stroke-linecap="round"/>';
    if (it.t === 'text') return svgText(it);
    return '';
  }).join('');
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" font-weight="400">' + defs + body + '</svg>';
}

// ---------- Canvas renderer (browser only, for PNG export with correct fonts) ----------
// Uses document-loaded web fonts; never called in Node. Halftone numerals are drawn as
// an ink fill + offset vermillion ghost = riso ink-misregistration (on-brand, robust).
var CFONT = { display: 'Anton', mono: 'JetBrains Mono', serif: 'Fraunces' };
function canvasFont(it) {
  var fam = CFONT[it.font] || 'Anton';
  return (it.italic ? 'italic ' : '') + (it.font === 'mono' ? '600 ' : '400 ') + it.size + "px '" + fam + "'";
}
function renderCanvas(ctx, model) {
  ctx.save();
  ctx.textBaseline = 'alphabetic';
  model.items.forEach(function (it) {
    if (it.t === 'rect') {
      ctx.save(); if (it.rot) { ctx.translate(it.x, it.y); ctx.rotate(it.rot * Math.PI / 180); ctx.translate(-it.x, -it.y); }
      if (it.fill && it.fill !== 'none') { ctx.fillStyle = it.fill; ctx.fillRect(it.x, it.y, it.w, it.h); }
      if (it.stroke) { ctx.strokeStyle = it.stroke; ctx.lineWidth = it.sw || 1; ctx.strokeRect(it.x, it.y, it.w, it.h); }
      ctx.restore(); return;
    }
    if (it.t === 'grain') { drawGrain(ctx, model.w, model.h); return; }
    if (it.t === 'line') { ctx.strokeStyle = it.stroke; ctx.lineWidth = it.sw || 1; ctx.beginPath(); ctx.moveTo(it.x1, it.y1); ctx.lineTo(it.x2, it.y2); ctx.stroke(); return; }
    if (it.t === 'perf') { ctx.save(); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.setLineDash([2, 8]); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(it.x, it.y); ctx.lineTo(it.x + it.w, it.y); ctx.stroke(); ctx.restore(); return; }
    if (it.t === 'text') {
      ctx.save(); ctx.font = canvasFont(it); ctx.textAlign = it.anchor === 'end' ? 'right' : (it.anchor === 'middle' ? 'center' : 'left');
      if (it.ls) ctx.letterSpacing = it.ls + 'px';
      if (it.rot) { ctx.translate(it.x, it.y); ctx.rotate(it.rot * Math.PI / 180); ctx.translate(-it.x, -it.y); }
      if (it.wrap) { drawWrapped(ctx, it); ctx.restore(); return; }
      if (it.halftone) { ctx.fillStyle = VERM; ctx.fillText(it.s, it.x + 6, it.y + 6); ctx.fillStyle = INK; ctx.fillText(it.s, it.x, it.y); }
      else { ctx.fillStyle = it.color; ctx.fillText(it.s, it.x, it.y); }
      ctx.restore(); return;
    }
  });
  ctx.restore();
}
function drawWrapped(ctx, it) {
  ctx.fillStyle = it.color;
  var words = String(it.s).split(' '), line = '', y = it.y;
  words.forEach(function (w) {
    if (ctx.measureText((line + ' ' + w).trim()).width > it.wrap && line) { ctx.fillText(line.trim(), it.x, y); line = w; y += it.size * 1.05; }
    else line += ' ' + w;
  });
  if (line.trim()) ctx.fillText(line.trim(), it.x, y);
}
function drawGrain(ctx, w, h) {
  try {
    var img = ctx.getImageData(0, 0, w, h), d = img.data, seed = 1234567;
    for (var i = 0; i < d.length; i += 4) {
      seed = (1103515245 * seed + 12345) & 0x7fffffff; var n = (seed % 24) - 12;
      d[i] += n; d[i + 1] += n; d[i + 2] += n;
    }
    ctx.putImageData(img, 0, 0);
  } catch (e) { /* tainted/unsupported: skip grain, not fatal */ }
}

var api = { buildModel: buildModel, buildStory: buildStory, renderSVG: renderSVG, renderCanvas: renderCanvas, compact: compact, W: W, H: H, COLORS: { INK: INK, CREAM: CREAM, VERM: VERM, BLUE: BLUE }, FONTS: FONTS };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof window !== 'undefined') window.devTimelineCard = api;
