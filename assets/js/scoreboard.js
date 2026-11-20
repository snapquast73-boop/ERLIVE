(function (global) {
  'use strict';

  let currentDate = UI.todayStr();
  let currentFilter = 'all';
  let gamesCache = [];

  function init() {
    const params = new URLSearchParams(window.location.search);
    const requestedDate = params.get('date');
    if (requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) currentDate = requestedDate;
    syncDateUI();
    loadSchedule();
    setInterval(loadSchedule, 30000);
  }

  function syncDateUI() {
    const picker = document.getElementById('date-picker');
    const label = document.getElementById('date-label');
    if (picker) picker.value = currentDate;
    if (label) label.textContent = UI.formatDateLabel(currentDate);
  }

  let latestRequest = 0;
  async function loadSchedule() {
    const request = ++latestRequest;
    const statusLine = document.getElementById('status-line');
    if (statusLine) statusLine.textContent = 'Loading MLB schedule…';
    try {
      const data = await MLBAPI.getSchedule(currentDate);
      if (request !== latestRequest) return;
      if (!data || !Array.isArray(data.dates)) throw new Error('Schedule response did not include dates.');
      const dates = data.dates;
      gamesCache = dates.flatMap((date) => date && Array.isArray(date.games) ? date.games : []);
      renderBanner();
      renderTabs();
      renderGames();
      if (statusLine) {
        statusLine.textContent = `Updated ${new Date().toLocaleTimeString()} · ${gamesCache.length} game(s)`;
      }
    } catch (error) {
      if (request !== latestRequest) return;
      console.error(error);
      if (statusLine) statusLine.textContent = `Error loading schedule: ${error.message}`;
    }
  }

  function renderBanner() {
    const element = document.getElementById('banner');
    if (!element) return;
    const inReview = gamesCache.filter((game) => game.flags && game.flags.inReview === true);
    if (!inReview.length) {
      element.innerHTML = '';
      return;
    }
    const names = inReview
      .map((game) => `${game.teams && game.teams.away && game.teams.away.team && game.teams.away.team.abbreviation || ''} @ ${game.teams && game.teams.home && game.teams.home.team && game.teams.home.team.abbreviation || ''}`)
      .join(', ');
    element.innerHTML = `<div class="banner-box">🚨 <strong>Under Review:</strong> ${UI.esc(names)} · <a href="reviews.html?date=${encodeURIComponent(currentDate)}">Open Scoring Feed →</a></div>`;
  }

  function renderTabs() {
    const element = document.getElementById('tabs');
    if (!element) return;
    const counts = {
      all: gamesCache.length,
      live: gamesCache.filter((game) => game.status && game.status.abstractGameState === 'Live').length,
      final: gamesCache.filter((game) => game.status && game.status.abstractGameState === 'Final').length,
      preview: gamesCache.filter((game) => game.status && game.status.abstractGameState === 'Preview').length,
    };
    const tabs = [
      { id: 'all', label: `All (${counts.all})` },
      { id: 'live', label: `Live (${counts.live})` },
      { id: 'final', label: `Final (${counts.final})` },
      { id: 'preview', label: `Scheduled (${counts.preview})` },
    ];
    element.innerHTML = tabs
      .map((tab) => `<button class="tab-btn ${currentFilter === tab.id ? 'tab-on' : ''}" data-filter="${tab.id}" aria-pressed="${currentFilter === tab.id}">${tab.label}</button>`)
      .join('');
    element.querySelectorAll('.tab-btn').forEach((button) => {
      button.addEventListener('click', () => {
        currentFilter = button.dataset.filter;
        renderTabs();
        renderGames();
      });
    });
  }

  function renderGames() {
    const element = document.getElementById('game-list');
    if (!element) return;
    const filtered = gamesCache.filter((game) => {
      if (currentFilter === 'all') return true;
      const state = game.status && game.status.abstractGameState;
      return state && state.toLowerCase() === currentFilter;
    });

    if (!filtered.length) {
      element.innerHTML = '<div class="empty-state">No games found for this date/filter.</div>';
      return;
    }

    const scheduleUrl = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${encodeURIComponent(currentDate)}&hydrate=team,linescore,probablePitcher,decisions,review,flags,gameInfo`;
    element.innerHTML = filtered.map((game) => {
      const teams = game.teams || {};
      const away = teams.away || {};
      const home = teams.home || {};
      const awayTeam = away.team || {};
      const homeTeam = home.team || {};
      const state = game.status && game.status.abstractGameState;
      const status = game.status && game.status.detailedState;
      const linescore = game.linescore || {};
      const inReview = Boolean(game.flags && game.flags.inReview === true);
      let pillClass = 'pill-preview';
      let statusText = UI.formatTime(game.gameDate) || 'Status unavailable';
      if (state === 'Live') {
        pillClass = 'pill-live';
        statusText = `${linescore.inningHalf || ''} ${linescore.currentInningOrdinal || ''}`.trim() || status || 'Live';
      } else if (state === 'Final') {
        pillClass = 'pill-final';
        statusText = status || 'Final';
      } else if (state === 'Preview') {
        statusText = UI.formatTime(game.gameDate) || status || 'Scheduled';
      } else if (status) {
        statusText = status;
      }

      const scoreDisplay = (value, side) => value == null
        ? `<span title="${side} score was not supplied by the schedule; unverified">— <small>Unverified</small></span>`
        : UI.esc(value);
      const awayScore = scoreDisplay(away.score, 'Away');
      const homeScore = scoreDisplay(home.score, 'Home');
      const teamNameDisplay = (team) => team.name == null || team.name === ''
        ? '<span title="Team name was not supplied; unverified">Team name unverified</span>'
        : UI.esc(team.name);
      const venueDisplay = game.venue && game.venue.name
        ? UI.esc(game.venue.name)
        : '<span title="Venue was not supplied; unverified">Venue unverified</span>';
      const awayRecord = away.leagueRecord ? `${away.leagueRecord.wins ?? ''}-${away.leagueRecord.losses ?? ''}` : '';
      const homeRecord = home.leagueRecord ? `${home.leagueRecord.wins ?? ''}-${home.leagueRecord.losses ?? ''}` : '';
      const awayLogoUrl = UI.teamLogoUrl(awayTeam.id);
      const homeLogoUrl = UI.teamLogoUrl(homeTeam.id);
      const gameUrl = Number.isSafeInteger(game.gamePk) ? `game.html?gamePk=${encodeURIComponent(game.gamePk)}` : '';
      const logo = (url, alt) => url ? `<img class="team-logo" src="${url}" alt="" loading="lazy" referrerpolicy="no-referrer" title="${UI.esc(alt)}">` : '';

      return `
        <article class="game-card ${inReview ? 'in-review' : ''}">
          <div class="card-top">
            <span class="pill ${pillClass}">${UI.esc(statusText)}</span>
            ${inReview ? '<span class="pill pill-review">🚨 Review</span>' : ''}
          </div>
          <div class="team-row">
            <div class="team-info">
              ${logo(awayLogoUrl, awayTeam.name)}
              <span class="team-name">${teamNameDisplay(awayTeam)}</span>
              <span class="team-record">${UI.esc(awayRecord)}</span>
            </div>
            <span class="team-score" title="Blank if the schedule supplied no score">${awayScore}</span>
          </div>
          <div class="team-row">
            <div class="team-info">
              ${logo(homeLogoUrl, homeTeam.name)}
              <span class="team-name">${teamNameDisplay(homeTeam)}</span>
              <span class="team-record">${UI.esc(homeRecord)}</span>
            </div>
            <span class="team-score" title="Blank if the schedule supplied no score">${homeScore}</span>
          </div>
          <div class="card-foot">
            <span>${venueDisplay}</span>
            <span><a href="${scheduleUrl}" target="_blank" rel="noopener">Official MLB schedule</a>${gameUrl ? ` · <a href="${gameUrl}">Open Game →</a>` : ''}</span>
          </div>
        </article>
      `;
    }).join('');
  }

  function changeDate(date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    currentDate = date;
    syncDateUI();
    loadSchedule();
  }

  function prevDay() {
    changeDate(UI.shiftDate(currentDate, -1));
  }

  function nextDay() {
    changeDate(UI.shiftDate(currentDate, 1));
  }

  function today() {
    changeDate(UI.todayStr());
  }

  function pickDate() {
    const picker = document.getElementById('date-picker');
    if (picker && picker.value) changeDate(picker.value);
  }

  global.Scoreboard = { prevDay, nextDay, today, pickDate };
  document.addEventListener('DOMContentLoaded', init);
})(window);
