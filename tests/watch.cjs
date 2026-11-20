const {test}=require('node:test'), assert=require('node:assert/strict');
const {JSDOM}=require('jsdom'), fs=require('node:fs');
test('official schedule, error feed, missing fields, no games and failure',async()=>{
 const w=new JSDOM(fs.readFileSync('index.html','utf8'),{runScripts:'outside-only'}).window;
 const d=w.document; w.AbortSignal=AbortSignal; w.setInterval=()=>{};
 let schedule={dates:[{games:[{gamePk:775296,teams:{away:{team:{name:'Los Angeles Dodgers'},score:7},home:{team:{name:'New York Yankees'},score:6}},status:{detailedState:'Final'}}]}]};
 w.fetch=async url=>({ok:!!schedule,json:async()=>url.includes('/schedule')?schedule:{allPlays:[{result:{eventType:'field_error',description:'Official description'}},{result:{eventType:'os_ruling_pending_primary',description:'Primary pending fixture'}},{result:{eventType:'os_ruling_pending_prior',description:'Prior pending fixture'}}]}});
 w.eval(fs.readFileSync('watch.js','utf8')); const wait=()=>new Promise(r=>setImmediate(r)); await wait();
 assert.match(d.querySelector('#games').textContent,/Dodgers 7 at New York Yankees 6/);assert.equal(d.querySelector('#feed a').href,'https://statsapi.mlb.com/api/v1/game/775296/playByPlay');
 assert.match(d.querySelector('#feed').textContent,/Primary pending fixture/); assert.doesNotMatch(d.querySelector('#feed').textContent,/Prior pending fixture/);
 const update=async()=>{d.querySelector('input').dispatchEvent(new w.Event('change'));await wait()};
 delete schedule.dates[0].games[0].teams.home.score;await update();assert.match(d.querySelector('#games').textContent,/Unverified/);
 schedule={dates:[],totalGames:0};await update();assert.match(d.querySelector('#status').textContent,/No MLB games/);
 schedule=null;await update();assert.match(d.querySelector('#status').textContent,/Schedule unavailable/);
 for(const file of ['index.html','review.html']) for(const a of new JSDOM(fs.readFileSync(file,'utf8')).window.document.querySelectorAll('[href],[src]')){const path=a.getAttribute('href')||a.getAttribute('src');if(!path.startsWith('https://'))assert.ok(fs.existsSync(path),path)}
});
