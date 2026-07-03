// dev-timeline / app.js — zero-env client glue: input -> fetch/demo -> engine -> card.
// State lives in localStorage (token) + URL (?u=username, ?p=demoPersona). No backend.
(function () {
  var E = window.devTimelineEngine, C = window.devTimelineCard, F = window.devTimelineFixtures, GH = window.devTimelineGitHub;
  var $ = function (id) { return document.getElementById(id); };
  var current = { model: null, stats: null, login: 'demo', year: new Date().getFullYear() };
  var demoIx = 0;

  function setError(msg) { var e = $('error'); if (!msg) { e.classList.add('hidden'); return; } e.textContent = msg; e.classList.remove('hidden'); }
  function busy(on, label) { var g = $('gen'); g.disabled = on; g.innerHTML = on ? (label || 'Reading…') + ' <span class="spin">▮</span>' : 'Generate →'; }

  var PROV = [
    { key: 'totalContributions', label: 'contributions' },
    { key: 'streak', label: 'streaks' },
    { key: 'languages', label: 'languages' },
    { key: 'codeVolume', label: 'lines ±' },
    { key: 'busiestHour', label: 'peak hour' }
  ];
  function badges(stats) {
    return PROV.map(function (p) {
      var v = stats.provenance[p.key] || 'unavailable';
      return '<span class="badge ' + v + '">' + p.label + ': ' + v + '</span>';
    }).join('');
  }
  function statRows(s) {
    var rows = [];
    var push = function (k, v, accent) { rows.push('<li><span class="k">' + k + '</span><span class="v' + (accent ? ' accent' : '') + '">' + v + '</span></li>'); };
    push(s.totalDays ? 'Contributions' : 'Public actions (90d)', C.compact(s.totalContributions), true);
    if (s.totalDays) { push('Longest streak', s.longestStreak + 'd'); push('Active days', s.activeDays + '/' + s.totalDays); }
    if (s.topLanguages[0]) push('Top language', s.topLanguages[0].name + ' ' + s.topLanguages[0].pct + '%', true);
    push('Languages', String(s.languageCount));
    push('Stars earned', C.compact(s.starsEarned));
    if (s.busiestWeekday) push('Busiest day', s.busiestWeekday.name);
    if (s.busiestHour) push('Peak hour', String(s.busiestHour.hour).padStart(2, '0') + ':00');
    push('Repos', String(s.totalRepos));
    return rows.join('');
  }
  function noteFor(s) {
    if (s.mode === 'token') return 'Accurate full-year data via GraphQL. Lines ±  needs per-commit stats and isn’t fetched (no fake numbers).';
    return 'Public mode: no full-year calendar or streak (GitHub only exposes that with a token). Numbers shown are exact where the badge says so.';
  }

  function render(stats) {
    current.stats = stats; current.login = stats.user.login; current.year = stats.year;
    var model = C.buildModel(stats); current.model = model;
    var frame = $('posterFrame');
    frame.classList.remove('empty'); frame.innerHTML = '<div id="poster">' + C.renderSVG(model) + '</div>';
    $('archLabel').textContent = stats.archetype.label + ' — ' + stats.archetype.blurb;
    $('badges').innerHTML = badges(stats);
    $('statList').innerHTML = statRows(stats);
    $('note').textContent = noteFor(stats);
    $('side').classList.remove('hidden');
    setError('');
  }

  function loadDemo() {
    var personas = F.all; var p = personas[demoIx % personas.length]; demoIx++;
    render(E.compute(p.data));
    history.replaceState(null, '', '?p=' + p.name);
  }

  async function generate() {
    var login = $('user').value.trim().replace(/^@/, '');
    var token = $('token').value.trim();
    if (!login) { setError('Enter a GitHub username (or hit “Try a demo”).'); return; }
    if (token) { try { localStorage.setItem('dt_token', token); } catch (e) {} }
    setError(''); busy(true, token ? 'Reading year…' : 'Reading public…');
    try {
      var data = await GH.fetchData(login, token || null);
      render(E.compute(data));
      history.replaceState(null, '', '?u=' + encodeURIComponent(login));
    } catch (err) {
      setError(err.message || String(err));
    } finally { busy(false); }
  }

  async function ensureFonts() {
    if (!document.fonts || !document.fonts.load) return;
    try {
      await Promise.all([
        document.fonts.load('400 320px Anton'),
        document.fonts.load("700 30px 'JetBrains Mono'"),
        document.fonts.load("italic 400 30px Fraunces")
      ]);
      await document.fonts.ready;
    } catch (e) {}
  }
  async function downloadPNG() {
    if (!current.model) return;
    await ensureFonts();
    var cv = document.createElement('canvas'); cv.width = C.W; cv.height = C.H;
    var ctx = cv.getContext('2d');
    ctx.fillStyle = C.COLORS.CREAM; ctx.fillRect(0, 0, C.W, C.H);
    C.renderCanvas(ctx, current.model);
    cv.toBlob(function (blob) {
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'dev-timeline-' + current.login + '-' + current.year + '.png';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 3000);
    }, 'image/png');
  }
  async function copyLink() {
    var url = location.origin + location.pathname + '?u=' + encodeURIComponent(current.login);
    try { await navigator.clipboard.writeText(url); var b = $('copy'); var t = b.textContent; b.textContent = 'Copied ✓'; setTimeout(function () { b.textContent = t; }, 1400); }
    catch (e) { setError('Copy failed — link: ' + url); }
  }

  // ---- multi-card story (Spotify-Wrapped-style slides) ----
  var story = null;
  function renderSlide() {
    var sl = story[current.slideIx];
    $('slide').innerHTML = C.renderSVG(sl.model);
    $('counter').textContent = (current.slideIx + 1) + ' / ' + story.length;
  }
  function openStory() { if (!current.stats) return; story = C.buildStory(current.stats); current.slideIx = 0; renderSlide(); $('story').classList.remove('hidden'); }
  function closeStory() { $('story').classList.add('hidden'); }
  function navStory(d) { if (!story) return; current.slideIx = Math.max(0, Math.min(story.length - 1, current.slideIx + d)); renderSlide(); }
  async function dlSlide() {
    if (!story) return; await ensureFonts();
    var m = story[current.slideIx].model, cv = document.createElement('canvas'); cv.width = C.W; cv.height = C.H;
    var ctx = cv.getContext('2d'); ctx.fillStyle = C.COLORS.CREAM; ctx.fillRect(0, 0, C.W, C.H); C.renderCanvas(ctx, m);
    cv.toBlob(function (b) { var a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'dev-timeline-' + current.login + '-' + story[current.slideIx].key + '.png'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 3000); }, 'image/png');
  }

  function init() {
    var y = new Date().getFullYear(); $('thisYear').textContent = y;
    try { var saved = localStorage.getItem('dt_token'); if (saved) $('token').value = saved; } catch (e) {}
    $('gen').addEventListener('click', generate);
    $('demo').addEventListener('click', loadDemo);
    $('dl').addEventListener('click', downloadPNG);
    $('copy').addEventListener('click', copyLink);
    var su = function () { return location.origin + location.pathname + '?u=' + encodeURIComponent(current.login); };
    $('shareX').addEventListener('click', function () { window.open('https://twitter.com/intent/tweet?text=' + encodeURIComponent('My year in code, printed like a riso zine 🖨️ — zero backend, my token never left the browser. #buildinpublic') + '&url=' + encodeURIComponent(su()), '_blank', 'noopener'); });
    $('shareReddit').addEventListener('click', function () { window.open('https://www.reddit.com/submit?url=' + encodeURIComponent(su()) + '&title=' + encodeURIComponent('I built a Spotify Wrapped for developers — your year in code as a riso print (no login, token stays in your browser)'), '_blank', 'noopener'); });
    $('storyBtn').addEventListener('click', openStory);
    $('prev').addEventListener('click', function () { navStory(-1); });
    $('next').addEventListener('click', function () { navStory(1); });
    $('dlSlide').addEventListener('click', dlSlide);
    $('closeStory').addEventListener('click', closeStory);
    document.addEventListener('keydown', function (e) { if ($('story').classList.contains('hidden')) return; if (e.key === 'ArrowLeft') navStory(-1); else if (e.key === 'ArrowRight') navStory(1); else if (e.key === 'Escape') closeStory(); });
    $('user').addEventListener('keydown', function (e) { if (e.key === 'Enter') generate(); });
    $('advToggle').addEventListener('click', function () {
      var a = $('adv'); a.classList.toggle('open');
      this.textContent = (a.classList.contains('open') ? '▾' : '▸') + ' advanced — add a token for the full-year graph & streak';
    });
    var q = new URLSearchParams(location.search);
    if (q.get('p')) { var pn = q.get('p'); var found = F.all.filter(function (x) { return x.name === pn; })[0]; if (found) { render(E.compute(found.data)); return; } }
    if (q.get('u')) { $('user').value = q.get('u'); generate(); return; }
  }
  document.addEventListener('DOMContentLoaded', init);
})();
