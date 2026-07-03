// dev-timeline / engine.js — pure deterministic "year in code" stats engine.
// Input: normalized GitHub data (see REQUIREMENTS.md §4). Output: Wrapped stats.
// No network, no Date.now(), no Math.random() — same input => same output (auditable moat).
// Honest provenance per field: exact | estimated | unavailable (cold-honest, no fake precision).

var WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// timezone-independent calendar math: parse "YYYY-MM-DD" as a UTC date.
function parseYMD(s) {
  if (typeof s !== 'string') throw new Error('date must be "YYYY-MM-DD" string');
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) throw new Error('bad date: ' + s);
  return { y: +m[1], m: +m[2], d: +m[3], utc: Date.UTC(+m[1], +m[2] - 1, +m[3]) };
}
function weekdayOf(s) { return new Date(parseYMD(s).utc).getUTCDay(); }   // 0=Sun..6=Sat
function monthOf(s) { return parseYMD(s).m - 1; }                          // 0=Jan..11=Dec

// largest-remainder rounding so integer percentages sum to EXACTLY 100.
function pct100(values) {
  var total = values.reduce(function (a, b) { return a + b; }, 0);
  if (total <= 0) return values.map(function () { return 0; });
  var raw = values.map(function (v) { return v / total * 100; });
  var out = raw.map(Math.floor);
  var rem = 100 - out.reduce(function (a, b) { return a + b; }, 0);
  var order = raw.map(function (v, i) { return { i: i, frac: v - Math.floor(v) }; })
    .sort(function (a, b) { return (b.frac - a.frac) || (a.i - b.i); });   // ties: lower index first
  for (var k = 0; k < rem; k++) out[order[k].i]++;
  return out;
}

// longest run of days with count>0; current = trailing run up to the last day.
function streaks(sorted) {
  var longest = 0, run = 0, i;
  for (i = 0; i < sorted.length; i++) {
    if (sorted[i].count > 0) { run++; if (run > longest) longest = run; } else { run = 0; }
  }
  var current = 0;
  for (i = sorted.length - 1; i >= 0; i--) { if (sorted[i].count > 0) current++; else break; }
  return { longest: longest, current: current };
}

function topLanguages(languages) {
  var entries = Object.keys(languages || {})
    .map(function (name) { return { name: name, bytes: languages[name] | 0 }; })
    .filter(function (e) { return e.bytes > 0; })
    .sort(function (a, b) { return (b.bytes - a.bytes) || (a.name < b.name ? -1 : 1); });
  var pcts = pct100(entries.map(function (e) { return e.bytes; }));
  return entries.map(function (e, i) { return { name: e.name, bytes: e.bytes, pct: pcts[i] }; });
}

// deterministic archetype: first matching rule wins, fallback is always true => exactly one.
function archetypeOf(s) {
  var top = s.topLanguages[0];
  var rules = [
    { key: 'machine', label: 'THE MACHINE', test: s.longestStreak >= 100, blurb: '100+ day streak. You do not break.' },
    { key: 'night_owl', label: 'NIGHT OWL', test: !!s.busiestHour && s.busiestHour.hour <= 5, blurb: 'Your code ships while the world sleeps.' },
    { key: 'weekend_shipper', label: 'WEEKEND SHIPPER', test: s.weekendShare >= 0.35, blurb: 'Weekends are for building.' },
    { key: 'polyglot', label: 'THE POLYGLOT', test: s.languageCount >= 6, blurb: 'You speak every language.' },
    { key: 'specialist', label: 'THE SPECIALIST', test: !!top && top.pct >= 70, blurb: (top ? top.name : 'One stack') + ' is your mother tongue.' },
    { key: 'marathoner', label: 'THE MARATHONER', test: s.activeDays >= 200, blurb: 'You showed up, again and again.' },
    { key: 'builder', label: 'THE BUILDER', test: true, blurb: 'Heads down, shipping.' }
  ];
  for (var i = 0; i < rules.length; i++) {
    if (rules[i].test) return { key: rules[i].key, label: rules[i].label, blurb: rules[i].blurb };
  }
}
var ARCHETYPE_KEYS = ['machine', 'night_owl', 'weekend_shipper', 'polyglot', 'specialist', 'marathoner', 'builder'];

function busiestHourOf(events) {
  if (!events || !events.length) return null;
  var buckets = new Array(24).fill(0), n = 0, i;
  for (i = 0; i < events.length; i++) {
    var t = events[i] && events[i].createdAt;
    var h = typeof t === 'string' ? new Date(t).getUTCHours() : NaN;
    if (h >= 0 && h <= 23) { buckets[h]++; n++; }
  }
  if (!n) return null;
  var best = 0;
  for (i = 1; i < 24; i++) if (buckets[i] > buckets[best]) best = i;   // ties: lowest hour
  return { hour: best, count: buckets[best], estimated: true };        // recent window only => estimate
}

function compute(data) {
  data = data || {};
  var year = data.year | 0;
  var mode = data.mode === 'token' ? 'token' : 'public';
  var calendar = (data.calendar || []).slice().sort(function (a, b) {
    return parseYMD(a.date).utc - parseYMD(b.date).utc;
  });
  var hasCal = calendar.length > 0;
  var repos = data.repos || [];
  var commit = data.commitContribs || {};
  var prov = {};

  // --- calendar-derived (exact in token mode) ---
  var totalContributions, activeDays, restDays, mostActiveDay = null,
    busiestWeekday = null, busiestMonth = null, growthSeries = null, weekendShare = 0,
    sk = { longest: 0, current: 0 };
  if (hasCal) {
    var sumCal = 0, maxDay = calendar[0], wk = new Array(7).fill(0), mo = new Array(12).fill(0), wknd = 0;
    for (var j = 0; j < calendar.length; j++) {
      var c = calendar[j].count | 0, day = calendar[j];
      sumCal += c;
      if (c > (maxDay.count | 0) || (c === (maxDay.count | 0) && parseYMD(day.date).utc < parseYMD(maxDay.date).utc)) maxDay = day;
      var w = weekdayOf(day.date); wk[w] += c; if (w === 0 || w === 6) wknd += c;
      mo[monthOf(day.date)] += c;
    }
    totalContributions = sumCal;
    activeDays = calendar.filter(function (d) { return (d.count | 0) > 0; }).length;
    restDays = calendar.length - activeDays;
    mostActiveDay = { date: maxDay.date, count: maxDay.count | 0, weekday: WEEKDAYS[weekdayOf(maxDay.date)] };
    var bw = 0; for (var a = 1; a < 7; a++) if (wk[a] > wk[bw]) bw = a;
    busiestWeekday = { name: WEEKDAYS[bw], total: wk[bw] };
    var bm = 0; for (var b = 1; b < 12; b++) if (mo[b] > mo[bm]) bm = b;
    busiestMonth = { name: MONTHS[bm], total: mo[bm] };
    growthSeries = mo;
    weekendShare = sumCal > 0 ? wknd / sumCal : 0;
    sk = streaks(calendar);
    prov.totalContributions = prov.streak = prov.mostActiveDay = prov.busiestWeekday = prov.growth = 'exact';
  } else {
    totalContributions = (commit.total | 0) || 0;
    activeDays = null; restDays = null;
    prov.totalContributions = (commit.total != null) ? 'estimated' : 'unavailable';
    prov.streak = prov.mostActiveDay = prov.busiestWeekday = prov.growth = 'unavailable';
  }

  // --- languages / repos / stars (exact: public REST is accurate) ---
  var langs = topLanguages(data.languages || {});
  var starsEarned = repos.reduce(function (t, r) { return t + (r.stars | 0); }, 0);
  var reposCreatedThisYear = repos.filter(function (r) {
    return r.createdAt && (+String(r.createdAt).slice(0, 4) === year);
  }).length;
  prov.languages = !langs.length ? 'unavailable' : (data.languagesPartial ? 'estimated' : 'exact');
  prov.repos = 'exact';

  // --- code volume (exact only with per-commit additions/deletions, i.e. token mode) ---
  var add = commit.additions, del = commit.deletions;
  var bothNum = typeof add === 'number' && typeof del === 'number';
  var codeVolume = bothNum
    ? { additions: add, deletions: del, net: add - del, estimated: false }
    : { additions: null, deletions: null, net: null, estimated: true };
  prov.codeVolume = bothNum ? 'exact' : 'unavailable';

  // --- busiest hour (estimate from recent events; daily calendar has no hour granularity) ---
  var busiestHour = busiestHourOf(data.events);
  prov.busiestHour = busiestHour ? 'estimated' : 'unavailable';

  var stats = {
    user: data.user || { login: 'unknown' },
    year: year,
    mode: mode,
    totalDays: hasCal ? calendar.length : null,
    totalContributions: totalContributions,
    activeDays: activeDays,
    restDays: restDays,
    longestStreak: sk.longest,
    currentStreak: sk.current,
    mostActiveDay: mostActiveDay,
    busiestWeekday: busiestWeekday,
    busiestMonth: busiestMonth,
    busiestHour: busiestHour,
    weekendShare: weekendShare,
    topLanguages: langs,
    languageCount: langs.length,
    totalRepos: repos.length,
    reposCreatedThisYear: reposCreatedThisYear,
    starsEarned: starsEarned,
    codeVolume: codeVolume,
    growthSeries: growthSeries,
    provenance: prov
  };
  stats.archetype = archetypeOf(stats);
  return stats;
}

var api = {
  compute: compute, pct100: pct100, streaks: streaks, topLanguages: topLanguages,
  archetypeOf: archetypeOf, busiestHourOf: busiestHourOf,
  weekdayOf: weekdayOf, monthOf: monthOf, parseYMD: parseYMD,
  WEEKDAYS: WEEKDAYS, MONTHS: MONTHS, ARCHETYPE_KEYS: ARCHETYPE_KEYS
};
if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof window !== 'undefined') window.devTimelineEngine = api;
