'use strict';
const el = id => document.getElementById(id);
const root = 'https://statsapi.mlb.com/api/v1';
const date = el('date');
const now = new Date();
date.value = [now.getFullYear(), String(now.getMonth()+1).padStart(2,'0'), String(now.getDate()).padStart(2,'0')].join('-');
let version = 0;
async function get(url) {
  const response = await fetch(url,{signal:AbortSignal.timeout(20000)});
  if (!response.ok) throw Error(response.status);
  return response.json();
}
function row(text, url, incomplete=false) {
  const item = document.createElement('article');
  const link = document.createElement('a');
  link.href = url;
  link.textContent = 'MLB source';
  item.append(text, incomplete ? ' · Unverified missing field · ' : ' · ', link);
  return item;
}
async function refresh() {
  const seq = ++version;
  el('games').replaceChildren(); el('feed').replaceChildren();
  el('status').textContent = 'Loading MLB data…';
  const schedule = `${root}/schedule?sportId=1&date=${encodeURIComponent(date.value)}`;
  try {
    if (!date.value) throw Error();
    const data = await get(schedule);
    const games = data.dates.flatMap(d => d.games);
    if (seq !== version) return;
    if (!games.length && data.totalGames !== 0) throw Error();
    for (const g of games) {
      const sides = ['away','home'].map(s => [g.teams?.[s]?.team?.name,g.teams?.[s]?.score]);
      const state = g.status?.detailedState;
      el('games').append(row(`${sides.map(s=>s.join(' ')).join(' at ')} — ${state ?? ''}`,schedule,!state || sides.flat().some(v=>v==null)));
    }
    const feeds = await Promise.all(games.map(async g => {
      if (!Number.isSafeInteger(g.gamePk)) return [row('Game ID unavailable',schedule,true)];
      const url = `${root}/game/${g.gamePk}/playByPlay`;
      try {
        const pbp = await get(url);
        return pbp.allPlays.filter(p=>['field_error','official_scorer_pending'].includes(p.result?.eventType)).map(p=>row(p.result.description ?? '',url,!p.result.description));
      } catch { return [row('Play feed unavailable',schedule,true)]; }
    }));
    if (seq !== version) return;
    el('feed').replaceChildren(...feeds.flat());
    if (!feeds.flat().length) el('feed').textContent = 'No matching rulings reported.';
    el('status').replaceChildren(row(games.length?'Schedule loaded':'No MLB games scheduled',schedule));
  } catch { if(seq===version) el('status').replaceChildren(row('Schedule unavailable',schedule,true)); }
}
date.addEventListener('change',refresh);
refresh(); setInterval(refresh,60000);
