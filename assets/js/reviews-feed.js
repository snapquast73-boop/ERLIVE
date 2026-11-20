(function (global) {
  'use strict';

  let currentDate = UI.todayStr();
  let currentTab = 'all';
  let feedItems = [];
  let countdown = 30;
  let seenIds = new Set();
  let hasInitialScan = false;
  let audioContext = null;
  let soundOn = localStorage.getItem('livpbp_sound') === '1';
  let notifyOn = localStorage.getItem('livpbp_notify') === '1' &&
    'Notification' in global && global.Notification.permission === 'granted';

  function isDate(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00`));
  }

  function init() {
    const params = new URLSearchParams(window.location.search);
    const requestedDate = params.get('date');
    if (requestedDate && isDate(requestedDate)) currentDate = requestedDate;

    loadSavedDate();
    syncDateUI();
    bindControls();
    renderAll();
    scanSchedule();

    setInterval(() => {
      countdown -= 1;
      if (countdown <= 0) {
        countdown = 30;
        scanSchedule();
      }
      const countdownEl = document.getElementById('countdown');
      if (countdownEl) countdownEl.textContent = `${countdown}s`;
    }, 1000);
  }

  function loadSavedDate() {
    feedItems = FeedLog.loadDate(currentDate).map((item) => ({ ...item, cached: true }));
    seenIds = new Set(feedItems.map((item) => item.id));
    hasInitialScan = false;
  }

  function syncDateUI() {
    const picker = document.getElementById('date-picker');
    const label = document.getElementById('date-label');
    if (picker) picker.value = currentDate;
    if (label) label.textContent = UI.formatDateLabel(currentDate);
  }

  function bindControls() {
    const soundButton = document.getElementById('sound-toggle-btn');
    const notifyButton = document.getElementById('notify-toggle-btn');
    const refreshButton = document.getElementById('refresh-btn');

    const updateButtons = () => {
      if (soundButton) soundButton.textContent = soundOn ? '🔊 Sound On' : '🔇 Sound Off';
      if (notifyButton) notifyButton.textContent = notifyOn ? '🔴 Run Alerts On' : '⚪ Run Alerts Off';
    };
    updateButtons();

    if (soundButton) {
      soundButton.addEventListener('click', () => {
        soundOn = !soundOn;
        localStorage.setItem('livpbp_sound', soundOn ? '1' : '0');
        updateButtons();
        if (soundOn) playChime();
      });
    }
    if (notifyButton) {
      notifyButton.addEventListener('click', async () => {
        try {
          if (!('Notification' in global)) {
            notifyOn = false;
          } else if (!notifyOn) {
            const permission = global.Notification.permission === 'default'
              ? await global.Notification.requestPermission()
              : global.Notification.permission;
            notifyOn = permission === 'granted';
          } else {
            notifyOn = false;
          }
        } catch (error) {
          console.warn('Desktop notifications are unavailable in this browser.', error);
          notifyOn = false;
        }
        localStorage.setItem('livpbp_notify', notifyOn ? '1' : '0');
        updateButtons();
      });
    }
    if (refreshButton) {
      refreshButton.addEventListener('click', () => {
        countdown = 30;
        scanSchedule();
      });
    }
  }

  function playChime() {
    const AudioContextClass = global.AudioContext || global.webkitAudioContext;
    if (!AudioContextClass) return;
    try {
      audioContext = audioContext || new AudioContextClass();
      if (audioContext.state === 'suspended') audioContext.resume();
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const now = audioContext.currentTime;
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(740, now);
      oscillator.frequency.setValueAtTime(988, now + 0.12);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.12, now + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start(now);
      oscillator.stop(now + 0.45);
    } catch (error) {
      console.warn('Sound alert is unavailable in this browser.', error);
    }
  }

  let latestRequestId = 0;
  async function scanSchedule() {
    const requestId = ++latestRequestId;
    const scanDate = currentDate;
    const statusLine = document.getElementById('status-line');
    if (statusLine) statusLine.textContent = 'Scanning MLB games for scoring events…';

    try {
      const schedule = await MLBAPI.getSchedule(scanDate);
      if (requestId !== latestRequestId || scanDate !== currentDate) return;
      if (!schedule || !Array.isArray(schedule.dates)) throw new Error('Schedule response did not include dates.');
      const games = schedule.dates.flatMap((date) => date && Array.isArray(date.games) ? date.games : []);
      const scannableGames = games.filter((game) => game && (!game.status || game.status.abstractGameState !== 'Preview'));

      const results = await Promise.all(scannableGames.map(async (game) => {
        if (!Number.isSafeInteger(game.gamePk)) return { feed: null, failed: true };
        try {
          const feed = await MLBAPI.getGameLive(game.gamePk);
          if (!feed || !feed.liveData || !feed.liveData.plays || !Array.isArray(feed.liveData.plays.allPlays)) {
            return { feed: null, failed: true };
          }
          return { feed, failed: false };
        } catch (error) {
          console.warn(`Game feed unavailable for ${game.gamePk}.`, error);
          return { feed: null, failed: true };
        }
      }));
      if (requestId !== latestRequestId || scanDate !== currentDate) return;

      const collected = [];
      results.forEach(({ feed }) => {
        if (feed) collected.push(...Reviews.extractGameReviews(feed));
      });

      const oldIds = seenIds;
      const newItems = hasInitialScan ? collected.filter((item) => !oldIds.has(item.id)) : [];
      const byId = new Map();
      feedItems.forEach((item) => byId.set(item.id, item));
      collected.forEach((item) => byId.set(item.id, item));
      feedItems = Array.from(byId.values()).sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
      seenIds = new Set(feedItems.map((item) => item.id));
      hasInitialScan = true;
      FeedLog.saveDate(currentDate, feedItems);

      announceNewItems(newItems);
      renderAll();
      if (statusLine) {
        const failedCount = results.filter((result) => result.failed).length;
        statusLine.textContent = `Updated ${new Date().toLocaleTimeString()} · Scanned ${results.length - failedCount}/${scannableGames.length} game(s)${failedCount ? ` · ${failedCount} game feed(s) unavailable` : ''}`;
      }
    } catch (error) {
      if (requestId !== latestRequestId || scanDate !== currentDate) return;
      console.error(error);
      if (statusLine) statusLine.textContent = `Error scanning schedule: ${error.message}`;
    }
  }

  function announceNewItems(items) {
    if (!items.length) return;
    if (soundOn) playChime();
    if (!notifyOn || !('Notification' in global) || global.Notification.permission !== 'granted') return;

    items
      .filter((item) => item.inProgress === true && safeCount(item.runsAtRisk) > 0 && item.category !== 'os_pending')
      .forEach((item) => {
        const teams = [item.awayAbbr, item.homeAbbr].filter(Boolean).join(' at ') || 'Teams unavailable';
        try {
          new global.Notification('MLB review — potential run movement', {
            body: `${teams}: ${item.runsAtRisk} scoring movement(s) are linked to an active review. This is not a prediction of the ruling.`,
            tag: `errorslive-${item.id}`,
          });
        } catch (error) {
          console.warn('Desktop notification could not be displayed.', error);
        }
      });
  }

  function renderAll() {
    renderBanner();
    renderActiveStrip();
    renderStats();
    renderTabs();
    renderFeed();
  }

  function renderBanner() {
    const element = document.getElementById('banner');
    if (!element) return;
    const atRisk = feedItems.filter((item) => !item.cached && item.category !== 'os_pending' && item.runsAtRisk > 0 && item.inProgress);
    element.innerHTML = atRisk.length
      ? `<div class="banner-box">⚠️ <strong>Potential scoring movement under review:</strong> ${atRisk.map((item) => `${displayField(item.awayAbbr, 'Away abbreviation')} @ ${displayField(item.homeAbbr, 'Home abbreviation')} (${safeCount(item.runsAtRisk)})`).join(', ')}</div>`
      : '';
  }

  function renderActiveStrip() {
    const element = document.getElementById('active-strip');
    if (!element) return;
    const active = feedItems.filter((item) => !item.cached && item.inProgress);
    element.innerHTML = active.length
      ? `<div class="active-strip"><strong>Active / pending</strong> ${active.map((item) => `<span class="pill pill-review">${displayField(item.awayAbbr, 'Away abbreviation')} @ ${displayField(item.homeAbbr, 'Home abbreviation')} · ${UI.esc(item.label)}</span>`).join(' ')}</div>`
      : '';
  }

  function renderStats() {
    const element = document.getElementById('feed-stats');
    if (!element) return;
    const currentItems = feedItems.filter((item) => !item.cached);
    const errors = currentItems.filter((item) => item.category === 'error').length;
    const pending = currentItems.filter((item) => item.category === 'os_pending').length;
    const reviews = currentItems.filter((item) => !['error', 'os_pending'].includes(item.category)).length;
    const activeReviews = currentItems.filter((item) => item.inProgress && item.category !== 'os_pending').length;
    const savedCopies = feedItems.filter((item) => item.cached).length;

    element.innerHTML = `
      <div class="stat-box"><div class="stat-val">${errors}</div><div class="stat-lbl">Current Field Errors</div></div>
      <div class="stat-box"><div class="stat-val">${pending}</div><div class="stat-lbl">Current Primary Pending</div></div>
      <div class="stat-box"><div class="stat-val">${reviews}</div><div class="stat-lbl">Current Reviews &amp; Challenges</div></div>
      <div class="stat-box"><div class="stat-val">${activeReviews}</div><div class="stat-lbl">Current Active Reviews</div></div>
      <div class="stat-box"><div class="stat-val">${savedCopies}</div><div class="stat-lbl">Saved, Not Reconfirmed</div></div>
    `;
  }

  function renderTabs() {
    const element = document.getElementById('feed-tabs');
    if (!element) return;
    const tabs = [
      { id: 'all', label: 'All' },
      { id: 'error', label: 'Field Errors' },
      { id: 'os_pending', label: 'Primary Pending' },
      { id: 'abs', label: 'ABS' },
      { id: 'challenge', label: 'Challenges' },
      { id: 'review', label: 'Reviews' },
      { id: 'boundary', label: 'Boundary Calls' },
      { id: 'active', label: 'Active Reviews' },
      { id: 'risk', label: 'Potential Runs at Risk' },
    ];
    element.innerHTML = tabs
      .map((tab) => `<button class="tab-btn ${currentTab === tab.id ? 'tab-on' : ''}" data-tab="${tab.id}" aria-pressed="${currentTab === tab.id}">${tab.label}</button>`)
      .join('');
    element.querySelectorAll('.tab-btn').forEach((button) => {
      button.addEventListener('click', () => {
        currentTab = button.dataset.tab;
        renderTabs();
        renderFeed();
      });
    });
  }

  function renderFeed() {
    const element = document.getElementById('feed-list');
    if (!element) return;
    const filtered = feedItems.filter((item) => {
      if (currentTab === 'all') return true;
      if (currentTab === 'active') return !item.cached && item.inProgress && item.category !== 'os_pending';
      if (currentTab === 'risk') return !item.cached && item.runsAtRisk > 0 && item.inProgress && item.category !== 'os_pending';
      return item.category === currentTab;
    });

    if (!filtered.length) {
      element.innerHTML = '<div class="empty-state">No matching scoring events for this date/filter.</div>';
      return;
    }

    element.innerHTML = filtered.map((item) => {
      const gamePk = item.gamePk == null ? '' : String(item.gamePk);
      const sourceUrl = gamePk
        ? `https://statsapi.mlb.com/api/v1.1/game/${encodeURIComponent(gamePk)}/feed/live`
        : 'https://statsapi.mlb.com';
      const score = `${displayField(item.awayScore, 'Away score')}–${displayField(item.homeScore, 'Home score')}`;
      const description = item.reason ? UI.esc(item.reason) : '<span title="Description was not supplied; unverified">Description blank — unverified</span>';
      const riskCount = safeCount(item.runsAtRisk);
      return `
        <article class="feed-card ${riskCount > 0 ? 'risk' : ''}">
          <div class="feed-card-head">
            <div>
              <strong>${displayField(item.awayAbbr, 'Away abbreviation')} @ ${displayField(item.homeAbbr, 'Home abbreviation')}</strong>
              <span style="color:var(--muted);">· ${displayField(item.halfInning, 'Inning half')} ${displayField(item.inning, 'Inning')} · ${UI.esc(item.label)}</span>
            </div>
            <div>
              ${item.cached ? '<span class="pill pill-final" title="Loaded from browser storage; not yet confirmed by the latest API scan">Saved copy</span>' : ''}
              ${riskCount > 0 ? `<span class="pill pill-risk">⚠️ ${riskCount} potential run movement(s)</span>` : ''}
              <span class="pill ${item.inProgress ? 'pill-review' : 'pill-final'}">${UI.esc(item.outcome)}</span>
            </div>
          </div>
          <div>${description}</div>
          <div style="margin-top:6px; font-size:12px; color:var(--muted);">
            Score: ${score} · ${gamePk ? `<a href="game.html?gamePk=${encodeURIComponent(gamePk)}">Open Game</a> · ` : ''}<a href="${sourceUrl}" target="_blank" rel="noopener">Official MLB feed</a>
          </div>
        </article>
      `;
    }).join('');
  }

  function displayField(value, label) {
    if (value == null || value === '') {
      return `<span title="${UI.esc(label)} was not supplied; unverified">— <small>Unverified</small></span>`;
    }
    return UI.esc(value);
  }

  function safeCount(value) {
    const count = Number(value);
    return Number.isSafeInteger(count) && count > 0 ? count : 0;
  }

  function changeDate(date) {
    if (!isDate(date)) return;
    currentDate = date;
    countdown = 30;
    loadSavedDate();
    syncDateUI();
    renderAll();
    scanSchedule();
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

  global.ReplayFeed = { prevDay, nextDay, today, pickDate };
  document.addEventListener('DOMContentLoaded', init);
})(window);
