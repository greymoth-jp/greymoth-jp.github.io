// dev-timeline / github.js — thin browser fetch client -> normalized data (engine input).
// Two modes: token (GraphQL contributionsCollection = accurate full year) and public
// (REST: profile/repos/languages/recent events, NO full-year calendar — honest limits).
// The token is used only for the request from THIS browser; it is never sent anywhere else.
// COLD: exact additions/deletions and exact LOC are NOT cheaply available -> left null
// (no fake precision). The engine flags everything via provenance.

(function () {
  var API = 'https://api.github.com';

  function yearBounds(year) {
    return { from: year + '-01-01T00:00:00Z', to: year + '-12-31T23:59:59Z' };
  }

  async function jget(url, headers) {
    var res = await fetch(url, { headers: headers || { Accept: 'application/vnd.github+json' } });
    if (res.status === 403 || res.status === 429) throw new Error('GitHub rate limit hit (unauthenticated = 60/hr). Add a token, or try later.');
    if (res.status === 404) throw new Error('User not found.');
    if (!res.ok) throw new Error('GitHub API error ' + res.status);
    return res.json();
  }

  // ---------- token mode: one GraphQL call ----------
  async function fetchToken(login, token, year) {
    var b = yearBounds(year);
    var query = '\
query($login:String!,$from:DateTime!,$to:DateTime!){\
 user(login:$login){ login name avatarUrl createdAt followers{totalCount}\
  repositories(first:100, isFork:false, ownerAffiliations:OWNER, orderBy:{field:STARGAZERS,direction:DESC}){\
   nodes{ name stargazerCount createdAt pushedAt diskUsage primaryLanguage{name}\
    languages(first:12, orderBy:{field:SIZE,direction:DESC}){ edges{ size node{name} } } } }\
  contributionsCollection(from:$from,to:$to){ totalCommitContributions restrictedContributionsCount\
   contributionCalendar{ totalContributions weeks{ contributionDays{ date contributionCount } } } } } }';
    var res = await fetch(API + '/graphql', {
      method: 'POST',
      headers: { Authorization: 'bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: query, variables: { login: login, from: b.from, to: b.to } })
    });
    if (res.status === 401) throw new Error('Token rejected (401). Check the token.');
    if (!res.ok) throw new Error('GraphQL error ' + res.status);
    var json = await res.json();
    if (json.errors && json.errors.length) throw new Error(json.errors[0].message);
    var u = json.data && json.data.user;
    if (!u) throw new Error('User not found.');

    var calendar = [];
    u.contributionsCollection.contributionCalendar.weeks.forEach(function (w) {
      w.contributionDays.forEach(function (d) { calendar.push({ date: d.date, count: d.contributionCount }); });
    });
    var languages = {};
    var repos = (u.repositories.nodes || []).map(function (r) {
      (r.languages && r.languages.edges || []).forEach(function (e) { languages[e.node.name] = (languages[e.node.name] || 0) + e.size; });
      return { name: r.name, language: r.primaryLanguage && r.primaryLanguage.name || null,
        stars: r.stargazerCount, sizeKb: r.diskUsage || 0, pushedAt: r.pushedAt, createdAt: r.createdAt };
    });
    return {
      user: { login: u.login, name: u.name, avatarUrl: u.avatarUrl, createdAt: u.createdAt, followers: u.followers.totalCount, publicRepos: repos.length },
      year: year, mode: 'token', calendar: calendar, repos: repos, languages: languages,
      commitContribs: { total: u.contributionsCollection.totalCommitContributions, additions: null, deletions: null },
      events: []
    };
  }

  // Fetch ALL of a user's owned repos across pages. The old code fetched a single
  // page of ?sort=pushed and THEN filtered forks — for anyone with many forks (e.g.
  // OSS contributors) the recently-pushed window is almost entirely forks, so the
  // fork filter left only a handful of real repos (undercounting repos/stars and
  // skewing languages). Paginate with a stable sort so every owned repo is seen.
  var MAX_REPO_PAGES = 12;    // 12*100 = 1200 repos ceiling
  var LANG_SAMPLE = 40;       // per-repo language calls capped for the 60/hr limit
  async function fetchAllOwnedRepos(login) {
    var all = [], page = 1;
    while (page <= MAX_REPO_PAGES) {
      var url = API + '/users/' + encodeURIComponent(login) +
        '/repos?per_page=100&type=owner&sort=full_name&page=' + page;
      var batch = await jget(url);
      if (!batch || !batch.length) break;
      all = all.concat(batch);
      if (batch.length < 100) break;   // last page
      page++;
    }
    return all;
  }

  // ---------- public mode: REST (rate-limited; no full-year calendar) ----------
  async function fetchPublic(login, year) {
    var user = await jget(API + '/users/' + encodeURIComponent(login));
    var repos = await fetchAllOwnedRepos(login);
    repos = (repos || []).filter(function (r) { return !r.fork; });
    // Real byte-level language aggregation across the largest non-fork repos.
    // Sort by size (repos with 0 bytes carry no languages) and cap the number of
    // languages_url calls so we stay under the unauthenticated 60 req/hr ceiling.
    var withCode = repos.filter(function (r) { return (r.size || 0) > 0; })
      .sort(function (a, b) { return (b.size || 0) - (a.size || 0); });
    var sample = withCode.slice(0, LANG_SAMPLE);
    var languagesPartial = withCode.length > sample.length;
    var languages = {};
    for (var i = 0; i < sample.length; i++) {
      try { var lg = await jget(sample[i].languages_url); Object.keys(lg).forEach(function (k) { languages[k] = (languages[k] || 0) + lg[k]; }); }
      catch (e) { /* rate limited mid-way: keep what we have, flag as partial */ languagesPartial = true; break; }
    }
    // The public events feed often returns sparse PushEvent payloads (no commits array / size),
    // so counting commits is unreliable (frequently 0). Instead count contribution-type public
    // actions in the recent window — reliably non-zero for active users, honestly labelled.
    var events = [], estTotal = 0;
    var CONTRIB = { PushEvent: 1, PullRequestEvent: 1, PullRequestReviewEvent: 1, IssuesEvent: 1, CreateEvent: 1, CommitCommentEvent: 1, ReleaseEvent: 1 };
    try {
      var ev = await jget(API + '/users/' + encodeURIComponent(login) + '/events/public?per_page=100');
      events = (ev || []).map(function (e) { return { type: e.type, createdAt: e.created_at, repo: e.repo && e.repo.name }; });
      estTotal = (ev || []).reduce(function (a, e) { return a + (CONTRIB[e.type] ? 1 : 0); }, 0);
    } catch (e2) { events = []; estTotal = 0; }
    var repoOut = repos.map(function (r) {
      return { name: r.name, language: r.language, stars: r.stargazers_count || 0, sizeKb: r.size || 0, pushedAt: r.pushed_at, createdAt: r.created_at };
    });
    return {
      user: { login: user.login, name: user.name, avatarUrl: user.avatar_url, createdAt: user.created_at, followers: user.followers, publicRepos: user.public_repos },
      year: year, mode: 'public', calendar: [], repos: repoOut, languages: languages,
      languagesPartial: languagesPartial,
      commitContribs: { total: estTotal, additions: null, deletions: null },
      events: events
    };
  }

  async function fetchData(login, token, year) {
    login = String(login || '').trim().replace(/^@/, '');
    if (!login) throw new Error('Enter a GitHub username.');
    year = year || new Date().getFullYear();
    return token ? fetchToken(login, token, year) : fetchPublic(login, year);
  }

  window.devTimelineGitHub = { fetchData: fetchData, fetchToken: fetchToken, fetchPublic: fetchPublic };
})();
