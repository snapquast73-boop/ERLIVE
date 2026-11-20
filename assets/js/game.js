(function (global) {
  'use strict';

  let gamePk = null;
  let countdown = 15;
  let latestRequest = 0;

  function init() {
    const params = new URLSearchParams(window.location.search);
    gamePk = params.get('gamePk');
    if (!gamePk) {
      document.getElementById('main').innerHTML =
        '<div class="panel">Missing <code>gamePk</code> parameter. <a href="index.html">Return to scoreboard</a>.</div>';
      return;
    }

    setupTabs();
    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) refreshBtn.addEventListener('click', () => { countdown = 15; loadGame(); });

    loadGame();
    setInterval(() => {
      countdown -= 1;
      if (countdown <= 0) {
        countdown = 15;
        loadGame();
      }
      const cdEl = document.getElementById('countdown');
      if (cdEl) cdEl.textContent = `${countdown}s`;
    }, 1000);
  }

  function setupTabs() {
    const buttons = document.querySelectorAll('.tabs-game .tab-btn');
    const panels = {
      plays: document.getElementById('panel-plays'),
      boxscore: document.getElementById('panel-boxscore'),
      props: document.getElementById('panel-props'),
      reviews: document.getElementById('panel-reviews'),
    };
    buttons.forEach((btn) => {
      btn.addEventListener('click', () => {
        buttons.forEach((b) => b.classList.remove('tab-on'));
        btn.classList.add('tab-on');
        const target = btn.dataset.tab;
        Object.keys(panels).forEach((k) => {
          if (panels[k]) panels[k].style.display = k === target ? '' : 'none';
        });
      });
    });
  }

  async function loadGame() {
    const request = ++latestRequest;
    const loading = document.getElementById('loading');
    const statusLine = document.getElementById('status-line');
    if (loading) loading.classList.add('show');
    try {
      const feed = await MLBAPI.getGameLive(gamePk);
      if (request !== latestRequest) return;
      renderHeader(feed);
      renderLivePanel(feed);
      renderLinescore(feed);
      renderPlays(feed);
      renderBoxscore(feed);
      if (global.Props) Props.render(feed, document.getElementById('props-wrap'));
      renderReviews(feed);
      if (statusLine) statusLine.textContent = `Updated ${new Date().toLocaleTimeString()}`;
    } catch (err) {
      if (request !== latestRequest) return;
      console.error(err);
      if (statusLine) statusLine.textContent = `Error loading game: ${err.message}`;
    } finally {
      if (request === latestRequest && loading) loading.classList.remove('show');
    }
  }

  function renderHeader(feed) {
    const gd = feed.gameData || {};
    const ls = (feed.liveData && feed.liveData.linescore) || {};
    const away = (gd.teams && gd.teams.away) || {};
    const home = (gd.teams && gd.teams.home) || {};
    const awayScore = ls.teams && ls.teams.away ? ls.teams.away.runs : null;
    const homeScore = ls.teams && ls.teams.home ? ls.teams.home.runs : null;
    const state = (gd.status && gd.status.detailedState) || '';

    const awayLogo = UI.teamLogoUrl(away.id);
    const homeLogo = UI.teamLogoUrl(home.id);
    document.getElementById('header-away').innerHTML = `
      ${awayLogo ? `<img class="team-logo" style="width:36px;height:36px;" src="${awayLogo}" alt="">` : ''}
      <div>
        <div style="font-weight:700;font-size:16px;">${displayField(away.name, 'Away team name')}</div>
        <div style="color:var(--muted);font-size:12px;">${displayField(away.abbreviation, 'Away abbreviation')}</div>
      </div>
    `;
    document.getElementById('header-center').innerHTML = `
      <div class="header-score">${displayField(awayScore, 'Away score')} – ${displayField(homeScore, 'Home score')}</div>
      <div style="color:var(--muted);font-size:12px;">${displayField(state, 'Game status')}</div>
      <div style="font-size:11px;"><a href="${officialFeedUrl()}" target="_blank" rel="noopener">Official MLB game feed</a></div>
    `;
    document.getElementById('header-home').innerHTML = `
      <div>
        <div style="font-weight:700;font-size:16px;">${displayField(home.name, 'Home team name')}</div>
        <div style="color:var(--muted);font-size:12px;">${displayField(home.abbreviation, 'Home abbreviation')}</div>
      </div>
      ${homeLogo ? `<img class="team-logo" style="width:36px;height:36px;" src="${homeLogo}" alt="">` : ''}
    `;
    document.getElementById('header-away').className = 'header-side';
    document.getElementById('header-home').className = 'header-side home';
    document.getElementById('header-meta').innerHTML = gd.venue && gd.venue.name
      ? UI.esc(gd.venue.name)
      : '<span title="Venue was not supplied; unverified">Venue unverified</span>';
  }

  function renderLivePanel(feed) {
    const el = document.getElementById('live-panel');
    const ls = (feed.liveData && feed.liveData.linescore) || {};
    const cp = (feed.liveData && feed.liveData.plays && feed.liveData.plays.currentPlay) || {};
    const count = cp.count || {};
    const matchup = cp.matchup || {};
    el.innerHTML = `
      <div style="display:flex;flex-wrap:wrap;justify-content:space-between;gap:12px;">
        <div><strong>At Bat:</strong> ${displayField(matchup.batter && matchup.batter.fullName, 'Batter')}</div>
        <div><strong>Pitching:</strong> ${displayField(matchup.pitcher && matchup.pitcher.fullName, 'Pitcher')}</div>
        <div><strong>Count:</strong> ${displayField(count.balls, 'Balls')}-${displayField(count.strikes, 'Strikes')} · <strong>Outs:</strong> ${displayField(ls.outs ?? count.outs, 'Outs')}</div>
      </div>
    `;
  }

  function officialFeedUrl() {
    return `${MLBAPI.BASE_V11}/game/${encodeURIComponent(gamePk)}/feed/live`;
  }

  function displayField(value, label) {
    if (value == null || value === '') {
      return `<span title="${UI.esc(label)} was not supplied; unverified">— <small>Unverified</small></span>`;
    }
    return UI.esc(value);
  }

  function dataRow(values) {
    const missing = values.some(value => value == null || value === '');
    const url = officialFeedUrl();
    const cells = values.map(value => `<td>${UI.esc(value)}</td>`).join('');
    return `<tr>${cells}<td><a href="${url}">MLB feed</a>${missing ? ' · Blank fields unverified' : ''}</td></tr>`;
  }

  function renderLinescore(feed) {
    const el = document.getElementById('linescore-wrap');
    const ls = (feed.liveData && feed.liveData.linescore) || {};
    const innings = ls.innings || [];
    if (!innings.length) {
      el.innerHTML = '<div style="color:var(--muted);">Linescore not yet available.</div>';
      return;
    }

    const headCols = innings.map(i => `<th>${UI.esc(i.num)}</th>`).join('');
    const teamRow = side => dataRow([
      feed.gameData?.teams?.[side]?.abbreviation,
      ...innings.map(i => i[side]?.runs),
      ...['runs', 'hits', 'errors'].map(key => ls.teams?.[side]?.[key]),
    ]);

    el.innerHTML = `
      <div style="overflow-x:auto;">
        <table class="linescore-table">
          <thead><tr><th>Team</th>${headCols}<th>R</th><th>H</th><th>E</th><th>Source</th></tr></thead>
          <tbody>
            ${teamRow('away')}${teamRow('home')}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderPlays(feed) {
    const el = document.getElementById('plays-wrap');
    const plays = ((feed.liveData && feed.liveData.plays && feed.liveData.plays.allPlays) || []).slice().reverse();
    if (!plays.length) {
      el.innerHTML = '<div style="color:var(--muted);">No plays recorded yet.</div>';
      return;
    }
    el.innerHTML = plays.map((p) => {
      const about = p.about || {};
      const res = p.result || {};
      const hasReview = Boolean(p.reviewDetails) || (p.playEvents || []).some((e) => e.reviewDetails);
      return `
        <div class="play-item">
          <div class="play-head">
            <span>${displayField(about.halfInning, 'Inning half')} ${displayField(about.inning, 'Inning')} · ${UI.esc(res.event || '')}</span>
            <span>${hasReview ? '<span class="pill pill-review">Review</span>' : ''} ${displayField(res.awayScore, 'Away score')}–${displayField(res.homeScore, 'Home score')}</span>
          </div>
          <div class="play-desc">${res.description ? UI.esc(res.description) : '<span title="Description was not supplied; unverified">Description blank — unverified</span>'}</div>
          <div style="margin-top:4px;font-size:11px;"><a href="${officialFeedUrl()}" target="_blank" rel="noopener">Official MLB game feed</a></div>
        </div>
      `;
    }).join('');
  }

  function renderBoxscore(feed) {
    const el = document.getElementById('boxscore-wrap');
    const box = (feed.liveData && feed.liveData.boxscore && feed.liveData.boxscore.teams) || {};
    if (!box.away || !box.home) {
      el.innerHTML = '<div style="color:var(--muted);">Box score not available yet.</div>';
      return;
    }
    const renderTeam = (teamData, label) => {
      const batters = (teamData.batters || []).map((id) => teamData.players && teamData.players[`ID${id}`]).filter(Boolean);
      const rows = batters.map((p) => {
        const s = (p.stats && p.stats.batting) || {};
        return dataRow([p.person?.fullName, s.atBats, s.runs, s.hits, s.rbi]);
      }).join('');
      return `
        <h4>${UI.esc(label)}</h4>
        <table class="boxscore-table">
          <thead><tr><th>Batter</th><th>AB</th><th>R</th><th>H</th><th>RBI</th><th>Source</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      `;
    };
    el.innerHTML = renderTeam(box.away, 'Away Batting') + renderTeam(box.home, 'Home Batting');
  }

  function renderReviews(feed) {
    const items = Reviews.extractGameReviews(feed);
    const badge = document.getElementById('reviews-tab-count');
    if (badge) {
      badge.textContent = items.length;
      badge.style.display = items.length ? 'inline-block' : 'none';
    }
    const bannerWrap = document.getElementById('live-review-banner-wrap');
    const active = items.filter((i) => i.inProgress && i.category !== 'os_pending');
    if (bannerWrap) {
      bannerWrap.innerHTML = active.length
        ? `<div class="banner-box" style="margin-top:12px;">🚨 <strong>Active Review:</strong> ${UI.esc(active[0].label)} — ${UI.esc(active[0].reason)}</div>`
        : '';
    }
    const el = document.getElementById('reviews-wrap');
    if (!items.length) {
      el.innerHTML = '<div style="color:var(--muted);">No field errors, pending scorer markers, challenges, or reviews in this game.</div>';
      return;
    }
    el.innerHTML = items.map((i) => `
      <div class="play-item">
        <div class="play-head">
          <span>${UI.esc(i.label)} · ${displayField(i.halfInning, 'Inning half')} ${displayField(i.inning, 'Inning')}</span>
          <span class="pill ${i.inProgress ? 'pill-review' : 'pill-final'}">${UI.esc(i.outcome)}</span>
        </div>
        <div class="play-desc">${i.reason ? UI.esc(i.reason) : '<span title="Description was not supplied; unverified">Description blank — unverified</span>'}</div>
        <div style="margin-top:4px;font-size:11px;"><a href="${officialFeedUrl()}" target="_blank" rel="noopener">Official MLB game feed</a></div>
      </div>
    `).join('');
  }

  document.addEventListener('DOMContentLoaded', init);
})(window);
