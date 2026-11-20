(function (global) {
  'use strict';

  function displayField(value, label) {
    if (value == null || value === '') {
      return `<span title="${UI.esc(label)} was not supplied; unverified">— <small>Unverified</small></span>`;
    }
    return UI.esc(value);
  }

  function render(feed, container) {
    if (!container) return;
    const plays = (feed && feed.liveData && feed.liveData.plays) || {};
    const currentPlay = plays.currentPlay || {};
    const matchup = currentPlay.matchup || {};
    const batter = matchup.batter || {};
    const pitcher = matchup.pitcher || {};

    if (!batter.fullName && !pitcher.fullName) {
      container.innerHTML = '<p style="color:var(--muted);">No active batter/pitcher matchup in the returned game feed.</p>';
      return;
    }

    container.innerHTML = `
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(240px, 1fr)); gap:12px;">
        <div class="stat-box">
          <div class="stat-lbl">Current Batter</div>
          <div class="stat-val" style="font-size:16px;">${displayField(batter.fullName, 'Batter')}</div>
          <div style="color:var(--muted); font-size:12px;">Bats: ${displayField(matchup.batSide && matchup.batSide.description, 'Bats side')}</div>
        </div>
        <div class="stat-box">
          <div class="stat-lbl">Current Pitcher</div>
          <div class="stat-val" style="font-size:16px;">${displayField(pitcher.fullName, 'Pitcher')}</div>
          <div style="color:var(--muted); font-size:12px;">Throws: ${displayField(matchup.pitchHand && matchup.pitchHand.description, 'Throws side')}</div>
        </div>
      </div>
    `;
  }

  global.Props = { render };
})(window);
