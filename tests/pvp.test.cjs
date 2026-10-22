const {test}=require('node:test');const assert=require('node:assert/strict');const {spawn}=require('node:child_process');const path=require('node:path');const {createRequire}=require('node:module');
const runtime=process.env.BFTMA_NODE_MODULES?createRequire(path.join(process.env.BFTMA_NODE_MODULES,'__pvp.cjs')):createRequire(path.resolve(__dirname,'../tools/package.json'));const {chromium}=runtime('playwright');
const wait=async(page,fn)=>{try{return await page.waitForFunction(fn,null,{timeout:30000});}catch(error){
 throw Error(error.message+' · '+JSON.stringify(await page.evaluate(()=>({status:document.getElementById('status')?.textContent,menu:document.getElementById('menuStatus')?.textContent,connectDisabled:document.getElementById('connect')?.disabled,screen:document.body.dataset.screen}))),{cause:error});
}};
test('PvP with latency: prediction, team turns, reset and disconnect',async()=>{
 const server=spawn(process.execPath,['tools/server.cjs'],{cwd:path.resolve(__dirname,'..'),stdio:'pipe'});let browser;
 try{
  await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);server.once('exit',code=>reject(Error('Server exited '+code)));});
  browser=await chromium.launch({headless:true,...(process.env.BFTMA_BROWSER_CHANNEL?{channel:process.env.BFTMA_BROWSER_CHANNEL}:{})});
  const context=await browser.newContext({viewport:{width:844,height:390}});const errors=[];
  await context.route('**/src/ui/renderer.js',async route=>{const response=await route.fetch();const source=(await response.text()).replace(" const ctx=canvas.getContext('2d');"," window.networkGame=game;window.networkCamera=camera;const ctx=canvas.getContext('2d');");await route.fulfill({response,body:source});});
  await context.route('https://esm.run/trystero@0.26.0',route=>route.fulfill({contentType:'text/javascript',body:`
   export const selfId=crypto.randomUUID();
   export function joinRoom(config,name){
    const channel=new BroadcastChannel(config.appId+name),actions=new Map(),peers=new Set();
    const room={makeAction(name){const action={send(data,options={}){if(name==='state')window.sentState=data;channel.postMessage({type:'action',name,data,target:options.target,id:selfId});return Promise.resolve();}};actions.set(name,action);return action;},leave(){channel.postMessage({type:'leave',id:selfId});channel.close();}};
    channel.onmessage=({data:m})=>{
     if(m.id===selfId)return;
     if(m.type==='leave'){room.onPeerLeave?.(m.id);return;}
     if(m.type==='join'||m.type==='ack'){if(!peers.has(m.id)){peers.add(m.id);room.onPeerJoin?.(m.id);}if(m.type==='join')channel.postMessage({type:'ack',id:selfId});}
     else if(m.type==='action'&&(!m.target||m.target===selfId))setTimeout(()=>{if(m.name==='state')window.receivedStates=(window.receivedStates||0)+1;actions.get(m.name)?.onMessage?.(m.data,{peerId:m.id});},60);
    };channel.postMessage({type:'join',id:selfId});return room;
   }
  `}));
  const a=await context.newPage(),b=await context.newPage();for(const page of [a,b])page.on('pageerror',e=>errors.push(e.message));
  await Promise.all([a.goto('http://localhost:8080/?mode=pvp',{waitUntil:'domcontentloaded'}),b.goto('http://localhost:8080/?mode=pvp',{waitUntil:'domcontentloaded'})]);
  for(const page of [a,b]){await wait(page,()=>!document.getElementById('connect').disabled);await page.locator('#room').fill('latency-test');await page.locator('#connect').click();}
  await Promise.all([a,b].map(page=>wait(page,()=>document.body.dataset.screen==='game')));
  const host=(await a.locator('#status').textContent()).includes('anfitrión')?a:b,guest=host===a?b:a;
  await wait(host,()=>window.networkGame.canFire);await wait(guest,()=>window.networkGame.canFire);
  assert.equal(await host.evaluate(()=>window.networkGame.players.length),6);assert.equal(await guest.evaluate(()=>window.networkGame.players.length),6);
  assert.equal(await host.evaluate(()=>window.networkGame.firstTeam),await guest.evaluate(()=>window.networkGame.firstTeam));
  if(await host.evaluate(()=>window.networkGame.currentTurn===0)){
   await host.locator('#weaponToggle').click();await host.locator('[data-weapon="medkit"]').click();await host.locator('#fireBtn').click();
  }
  await wait(guest,()=>!document.getElementById('fireBtn').disabled&&window.networkGame.currentTurn===1);
  await guest.locator('#weaponToggle').click();await guest.locator('[data-weapon="sniper"]').click();
  await wait(host,()=>window.networkGame.activePlayer.equipped==='sniper');
  await guest.locator('#weaponToggle').click();await guest.locator('[data-weapon="frag"]').click();
  await guest.locator('#fuseToggle').click();await guest.waitForFunction(()=>document.getElementById('fuseToggle').textContent==='Mecha: 3 s');
  await guest.locator('#fuseToggle').click();await wait(host,()=>window.networkGame.activePlayer.grenadeFuse===4);
  await guest.locator('#weaponToggle').click();await guest.locator('[data-weapon="bazooka"]').click();
  const x=await guest.evaluate(()=>window.networkGame.activePlayer.x);
  await guest.keyboard.down('d');await guest.waitForTimeout(35);
  assert.ok(await guest.evaluate(before=>window.networkGame.activePlayer.x>before,x),'Guest movement waits for the server');
  await guest.keyboard.up('d');await guest.waitForTimeout(200);
  await host.evaluate(()=>window.networkGame.command(1,{type:'aim',angle:-1.15,power:.65,turnId:window.networkGame.turnId}));
  await wait(guest,()=>Math.abs(window.networkGame.activePlayer.angle+1.15)<.01);
  const firedTurn=await guest.evaluate(()=>window.networkGame.turnId);
  await guest.locator('#fireBtn').click();await wait(host,()=>window.networkGame.lastShot?.team===1);
  await wait(guest,()=>window.networkGame.projectiles.length>0);
  const samples=await guest.evaluate(async()=>{
    const result=[];
    for(let i=0;i<14;i++){await new Promise(requestAnimationFrame);result.push({x:window.networkGame.projectiles[0]?.x,tick:window.networkGame.tick,count:window.receivedStates});}
    return result;
  });
  assert.ok(samples.some((sample,i)=>i&&sample.count===samples[i-1].count&&sample.tick>samples[i-1].tick&&sample.x!==undefined&&sample.x!==samples[i-1].x),'Projectile does not move locally between authoritative packets');
  await host.waitForFunction(turn=>window.networkGame.turnId>turn&&window.networkGame.canFire,firedTurn,{timeout:20000});
  await guest.waitForFunction(turn=>window.networkGame.turnId>turn&&window.networkGame.canFire,firedTurn,{timeout:20000});
  const hostData=await host.evaluate(()=>({team:window.networkGame.currentTurn,member:window.networkGame.activePlayer.member,health:window.networkGame.players.map(p=>p.health)}));
  await guest.waitForTimeout(200);
  assert.deepEqual(await guest.evaluate(()=>({team:window.networkGame.currentTurn,member:window.networkGame.activePlayer.member,health:window.networkGame.players.map(p=>p.health)})),hostData);
  await host.locator('#weaponToggle').click();await host.locator('[data-weapon="medkit"]').click();await host.locator('#fireBtn').click();
  await wait(guest,()=>!document.getElementById('fireBtn').disabled&&window.networkGame.currentTurn===1);
  await guest.locator('#weaponToggle').click();await guest.locator('[data-weapon="teleport"]').click();
  assert.equal(await guest.locator('#weaponPanel').isHidden(),true);
  const target=await guest.evaluate(()=>{window.networkCamera.hold=true;const p=window.networkGame.activePlayer;for(const sy of [180,210,150,240])for(const sx of [422,322,522]){const raw=window.networkCamera.screenToWorld(sx,sy),target=window.networkGame.teleportTarget(p,raw);if(target.valid&&Math.hypot(target.x-p.x,target.y-p.y)>60)return {sx,sy,x:target.x,id:p.id,turn:window.networkGame.turnId};}throw Error('No visible PvP teleport destination');});
  await guest.mouse.click(target.sx,target.sy);
  await wait(host,()=>window.networkGame.lastShot?.weapon==='teleport'&&window.networkGame.players.some(p=>p.transit));
  await host.waitForFunction(turn=>window.networkGame.turnId>turn,target.turn,{timeout:15000});
  await guest.waitForFunction(turn=>window.networkGame.turnId>turn,target.turn,{timeout:15000});
  assert.ok(Math.abs(await host.evaluate(id=>window.networkGame.players.find(p=>p.id===id).x,target.id)-target.x)<2);
  assert.ok(Math.abs(await guest.evaluate(id=>window.networkGame.players.find(p=>p.id===id).x,target.id)-target.x)<2);
  assert.equal(await host.locator('#level').isDisabled(),false);assert.equal(await guest.locator('#level').isDisabled(),true);
  await host.locator('#weaponToggle').click();await host.locator('[data-weapon="airstrike"]').click();
  await host.evaluate(()=>{window.networkGame.command(0,{type:'aim',angle:.5,power:.15,turnId:window.networkGame.turnId});});
  await host.locator('#fireBtn').click();await wait(host,()=>window.networkGame.aircraft.length>0);
  await wait(guest,()=>window.networkGame.aircraft.length>0&&window.networkGame.hazards.some(h=>h.type==='signal'));
  await host.locator('#reset').evaluate(button=>button.click());await wait(host,()=>window.networkGame.turnId===0&&window.networkGame.introRemaining>0);
  await wait(guest,()=>window.networkGame.turnId===0&&window.networkGame.introRemaining>0);
  assert.equal(await guest.evaluate(()=>window.networkGame.aircraft.length),0);
  // A ready marker belongs to the team, including its next active member.
  await host.evaluate(()=>{
    const g=window.networkGame,s=g.snapshot(),target=s.players.find(p=>p.team===0&&p.alive);
    s.currentTurn=1;s.intro=0;s.turnId=2;s.turnTimer=20;
    s.orbital={markers:[{team:1,x:g.level.width-30,y:20,age:60,targetId:null,attached:false,readyTurn:2,grey:true}],strike:null};g.restore(s);
  });
  await wait(guest,()=>window.networkGame.currentTurn===1&&window.networkGame.orbitalReady(1));
  await guest.locator('#weaponToggle').click();await guest.locator('[data-weapon="orbital"]').click();
  await wait(guest,()=>document.getElementById('fireBtn').querySelector('span').textContent==='LLAMAR');
  assert.equal(await guest.locator('#cancelOrbital').isVisible(),true);
  await guest.locator('#fireBtn').click();
  await wait(host,()=>!!window.networkGame.orbital.strike);
  await wait(guest,()=>!!window.networkGame.orbital.strike);
  assert.equal(await host.evaluate(()=>window.networkGame.orbital.strike.targetId),null);
  assert.equal(await guest.evaluate(()=>window.networkGame.orbital.strike.targetId),null);
  await wait(host,()=>window.networkGame.orbital.strike?.hit);
  await wait(guest,()=>window.networkGame.orbital.strike?.hit);
  assert.equal(await host.evaluate(()=>window.networkGame.orbital.markers.length),0);
  assert.equal(await guest.evaluate(()=>window.networkGame.orbital.markers.length),0);
  assert.ok(await guest.evaluate(()=>window.networkGame.terrain.operations.some(op=>op.type==='tunnel'&&op.args[0]===window.networkGame.level.width-30)),'Unmarked orbital terrain cut was not replicated');
  await guest.locator('#backToMenu').evaluate(button=>button.click());await wait(host,()=>document.getElementById('status').textContent.includes('desconectado'));
  assert.deepEqual(errors,[]);await context.close();
 }finally{await browser?.close();server.kill();}
});
