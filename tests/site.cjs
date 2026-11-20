const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const ROOT = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const load = (window, files) => files.forEach((file) => window.eval(read(file)));
const waitForReady = async (window) => {
  if (window.document.readyState === 'loading') {
    await new Promise((resolve) => window.document.addEventListener('DOMContentLoaded', resolve, { once: true }));
  }
  await new Promise((resolve) => setTimeout(resolve, 0));
};
const response = (data) => ({ ok: true, json: async () => data });

function sampleFeed() {
  return {
    gameData: {
      game: { pk: 775296 },
      teams: {
        away: { id: 119, name: 'Los Angeles Dodgers', abbreviation: 'LAD' },
        home: { id: 147, name: 'New York Yankees', abbreviation: 'NYY' },
      },
      status: { detailedState: 'Final' },
      venue: { name: 'Test Park' },
    },
    liveData: {
      plays: {
        currentPlay: { count: { balls: 1, strikes: 2, outs: 1 }, matchup: {} },
        allPlays: [
          {
            about: { inning: 1, halfInning: 'Top', endTime: '2024-10-30T20:00:00Z' },
            result: { eventType: 'field_error', description: 'Primary field error', awayScore: 1, homeScore: 0 },
            matchup: { batter: { fullName: 'Batter One' }, pitcher: { fullName: 'Pitcher One' } },
            playEvents: [],
            runners: [],
          },
          {
            about: { inning: 1, halfInning: 'Top' },
            result: { eventType: 'fielders_choice', description: 'A throwing error is mentioned', awayScore: 1, homeScore: 0 },
            playEvents: [],
            runners: [],
          },
          {
            about: { inning: 2, halfInning: 'Bottom' },
            result: { eventType: 'os_ruling_pending_primary', description: 'Primary pending in result', awayScore: 1, homeScore: 0 },
            playEvents: [],
            runners: [],
          },
          {
            about: { inning: 2, halfInning: 'Bottom' },
            result: { eventType: 'field_out', description: 'Prior pending fixture', awayScore: 1, homeScore: 0 },
            playEvents: [{ details: { eventType: 'os_ruling_pending_prior', description: 'Prior should not appear' } }],
            runners: [],
          },
          {
            about: { inning: 3, halfInning: 'Top' },
            result: { eventType: 'field_out', description: 'Primary pending in event', awayScore: 1, homeScore: 0 },
            playEvents: [{ details: { eventType: 'os_ruling_pending_primary', description: 'Primary pending in event' } }],
            runners: [],
          },
        ],
      },
      linescore: {
        teams: {
          away: { runs: 7, hits: 10, errors: 1 },
          home: { runs: 6, hits: 8, errors: 0 },
        },
        innings: [
          { num: 1, away: { runs: 1 }, home: { runs: 0 } },
          { num: 2, away: {}, home: { runs: 1 } },
        ],
        outs: 0,
      },
      boxscore: {
        teams: {
          away: {
            batters: [1],
            players: { ID1: { person: { fullName: 'Batter One' }, stats: { batting: { atBats: 4, runs: 1, hits: 2, rbi: 1 } } } },
          },
          home: {
            batters: [2],
            players: { ID2: { person: { fullName: 'Batter Two' }, stats: { batting: { atBats: 4, runs: 1, hits: 1, rbi: 0 } } } },
          },
        },
      },
    },
  };
}

function sampleSchedule() {
  return {
    dates: [{
      games: [
        {
          gamePk: 775296,
          gameDate: '2024-10-30T20:00:00Z',
          status: { abstractGameState: 'Final', detailedState: 'Final' },
          teams: {
            away: { team: { id: 119, name: 'Los Angeles Dodgers', abbreviation: 'LAD' }, score: 7 },
            home: { team: { id: 147, name: 'New York Yankees', abbreviation: 'NYY' }, score: 6 },
          },
          venue: { name: 'Test Park' },
        },
        {
          gamePk: 775297,
          gameDate: '2024-10-30T20:00:00Z',
          status: { abstractGameState: 'Preview', detailedState: 'Scheduled' },
          teams: {
            away: { team: { name: '<img src=x onerror=alert(1)>' } },
            home: { team: { name: 'Home Team' } },
          },
        },
      ],
    }],
  };
}

test('scorer extraction includes primary field errors and primary pending only', () => {
  const window = new JSDOM('', { runScripts: 'outside-only' }).window;
  load(window, ['assets/js/reviews.js']);
  const items = window.Reviews.extractGameReviews(sampleFeed());
  const errors = items.filter((item) => item.category === 'error');
  const pending = items.filter((item) => item.category === 'os_pending');

  assert.equal(errors.length, 1);
  assert.equal(errors[0].reason, 'Primary field error');
  assert.equal(pending.length, 2);
  assert.ok(pending.every((item) => item.label === 'Official Scorer Ruling Pending'));
  assert.equal(items.some((item) => item.reason === 'Prior should not appear'), false);
  assert.equal(items.some((item) => item.reason === 'A throwing error is mentioned'), false);
  window.close();
});

test('scoreboard renders source-linked games, escapes text, and does not fill missing scores', async () => {
  const dom = new JSDOM(read('index.html'), { url: 'https://example.test/ERLIVE/?date=2024-10-30', runScripts: 'outside-only' });
  const { window } = dom;
  window.setInterval = () => 0;
  window.console.error = () => {};
  let schedule = sampleSchedule();
  let shouldFail = false;
  window.fetch = async () => {
    if (shouldFail) throw new Error('network unavailable');
    return response(schedule);
  };
  load(window, ['assets/js/api.js', 'assets/js/ui.js', 'assets/js/scoreboard.js']);
  await waitForReady(window);

  assert.equal(window.document.querySelectorAll('.game-card').length, 2);
  assert.match(window.document.querySelector('.game-card').textContent, /Los Angeles Dodgers/);
  assert.equal(window.document.querySelector('.game-card img[onerror]'), null);
  assert.equal(window.document.querySelectorAll('.game-card a[href*="statsapi.mlb.com"]').length, 2);
  assert.equal(window.document.querySelector('.game-card a[href*="game.html?gamePk=775296"]') !== null, true);
  assert.match(window.document.querySelectorAll('.game-card')[1].textContent, /—/);
  assert.match(window.document.querySelectorAll('.game-card')[1].textContent, /Unverified/);
  assert.doesNotMatch(window.document.querySelectorAll('.game-card')[1].textContent, /undefined|null/);

  schedule = { dates: [] };
  window.Scoreboard.today();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.match(window.document.querySelector('#game-list').textContent, /No games found/);

  schedule = {};
  window.Scoreboard.today();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.match(window.document.querySelector('#status-line').textContent, /did not include dates/);

  shouldFail = true;
  window.Scoreboard.today();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.match(window.document.querySelector('#status-line').textContent, /network unavailable/);
  window.close();
});

test('scoring feed filters primary errors and pending rows and links each row to MLB', async () => {
  const dom = new JSDOM(read('reviews.html'), { url: 'https://example.test/ERLIVE/reviews.html?date=2024-10-30', runScripts: 'outside-only' });
  const { window } = dom;
  window.setInterval = () => 0;
  const schedule = { dates: [{ games: [{ gamePk: 775296, status: { abstractGameState: 'Final' } }] }] };
  const feed = sampleFeed();
  window.fetch = async (url) => response(String(url).includes('/schedule') ? schedule : feed);
  load(window, ['assets/js/api.js', 'assets/js/ui.js', 'assets/js/reviews.js', 'assets/js/feed-log.js', 'assets/js/reviews-feed.js']);
  await waitForReady(window);

  const cards = window.document.querySelectorAll('.feed-card');
  assert.equal(cards.length, 3);
  assert.match(window.document.querySelector('#feed-list').textContent, /Primary field error/);
  assert.match(window.document.querySelector('#feed-list').textContent, /Primary pending in result/);
  assert.match(window.document.querySelector('#feed-list').textContent, /Primary pending in event/);
  assert.doesNotMatch(window.document.querySelector('#feed-list').textContent, /Prior should not appear|throwing error is mentioned/);
  assert.equal(window.document.querySelectorAll('.feed-card a[href*="statsapi.mlb.com/api/v1.1/game/775296/feed/live"]').length, 3);

  window.document.querySelector('[data-tab="error"]').click();
  assert.equal(window.document.querySelectorAll('.feed-card').length, 1);
  assert.match(window.document.querySelector('.feed-card').textContent, /Primary field error/);
  window.document.querySelector('[data-tab="os_pending"]').click();
  assert.equal(window.document.querySelectorAll('.feed-card').length, 2);
  window.document.querySelector('#sound-toggle-btn').click();
  assert.match(window.document.querySelector('#sound-toggle-btn').textContent, /Sound On/);
  assert.equal(window.localStorage.getItem('livpbp_sound'), '1');
  window.document.querySelector('#notify-toggle-btn').click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.match(window.document.querySelector('#notify-toggle-btn').textContent, /Run Alerts Off/);
  window.close();
});

test('cached feed rows are labeled and excluded from current counts until reconfirmed', async () => {
  const dom = new JSDOM(read('reviews.html'), { url: 'https://example.test/ERLIVE/reviews.html?date=2024-10-30', runScripts: 'outside-only' });
  const { window } = dom;
  window.setInterval = () => 0;
  window.localStorage.setItem('livpbp_feed_log_2024-10-30', JSON.stringify([{
    id: '775296-0-os-primary-pending',
    gamePk: 775296,
    category: 'os_pending',
    label: 'Official Scorer Ruling Pending',
    reason: 'Previously saved marker',
    inning: 1,
    halfInning: 'Top',
    inProgress: true,
    outcome: 'Pending',
    runsAtRisk: 0,
    timestamp: '2024-10-30T20:00:00Z',
  }]));
  const schedule = { dates: [{ games: [{ gamePk: 775296, status: { abstractGameState: 'Final' } }] }] };
  const emptyFeed = { gameData: { game: { pk: 775296 }, teams: {} }, liveData: { plays: { allPlays: [] } } };
  window.fetch = async (url) => response(String(url).includes('/schedule') ? schedule : emptyFeed);
  load(window, ['assets/js/api.js', 'assets/js/ui.js', 'assets/js/reviews.js', 'assets/js/feed-log.js', 'assets/js/reviews-feed.js']);
  await waitForReady(window);

  assert.match(window.document.querySelector('#feed-list').textContent, /Saved copy/);
  const stats = Array.from(window.document.querySelectorAll('#feed-stats .stat-box'));
  const statValues = Object.fromEntries(stats.map((box) => [box.querySelector('.stat-lbl').textContent, box.querySelector('.stat-val').textContent]));
  assert.equal(statValues['Saved, Not Reconfirmed'], '1');
  assert.equal(statValues['Current Primary Pending'], '0');
  window.close();
});

test('game tables leave missing fields blank and give every data row an official feed link', async () => {
  const dom = new JSDOM(read('game.html'), { url: 'https://example.test/ERLIVE/game.html?gamePk=775296', runScripts: 'outside-only' });
  const { window } = dom;
  window.setInterval = () => 0;
  load(window, ['assets/js/api.js', 'assets/js/ui.js', 'assets/js/reviews.js', 'assets/js/props.js']);
  window.MLBAPI.getGameLive = async () => sampleFeed();
  load(window, ['assets/js/game.js']);
  await waitForReady(window);
  await new Promise((resolve) => setTimeout(resolve, 0));

  const rows = Array.from(window.document.querySelectorAll('table tbody tr'));
  assert.ok(rows.length > 0);
  assert.ok(rows.every((row) => row.querySelector('a[href^="https://statsapi.mlb.com/api/v1.1/game/775296/feed/live"]')));
  const activityRows = window.document.querySelectorAll('#plays-wrap .play-item, #reviews-wrap .play-item');
  assert.ok(activityRows.length > 0);
  assert.ok(Array.from(activityRows).every((row) => row.querySelector('a[href^="https://statsapi.mlb.com/api/v1.1/game/775296/feed/live"]')));
  assert.match(window.document.querySelector('#linescore-wrap').textContent, /Blank fields unverified/);
  assert.doesNotMatch(window.document.querySelector('#status-line').textContent, /Error loading game/);
  window.close();
});

test('every local HTML href/src target exists', () => {
  const pages = ['index.html', 'reviews.html', 'game.html', 'review.html', '404.html'];
  for (const page of pages) {
    const dom = new JSDOM(read(page));
    for (const element of dom.window.document.querySelectorAll('[href], [src]')) {
      const value = element.getAttribute('href') || element.getAttribute('src');
      if (!value || value.startsWith('https://') || value.startsWith('data:') || value.startsWith('#')) continue;
      const parsed = new URL(value, `https://example.test/ERLIVE/${page}`);
      if (parsed.origin !== 'https://example.test') continue;
      let file = decodeURIComponent(parsed.pathname).replace(/^\/ERLIVE\//, '').replace(/^\//, '');
      if (!file) file = 'index.html';
      assert.ok(fs.existsSync(path.join(ROOT, file)), `${page}: ${value}`);
    }
    dom.window.close();
  }
});
