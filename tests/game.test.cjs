const {test}=require('node:test');
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const path=require('node:path');
const {createRequire}=require('node:module');
const runtime=process.env.BFTMA_NODE_MODULES?createRequire(path.join(process.env.BFTMA_NODE_MODULES,'__tests.cjs')):createRequire(path.resolve(__dirname,'../tools/package.json'));
const {chromium}=runtime('playwright');
const wait=(page,fn)=>page.waitForFunction(fn,null,{timeout:20000});
test('teams, twenty weapons, direct damage, power, prediction and mobile UI',async()=>{
 const server=spawn(process.execPath,['tools/server.cjs'],{cwd:path.resolve(__dirname,'..'),stdio:'pipe'});let browser;
 try{
  await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);server.once('exit',code=>reject(Error('Server exited '+code)));});
  browser=await chromium.launch({headless:true,...(process.env.BFTMA_BROWSER_CHANNEL?{channel:process.env.BFTMA_BROWSER_CHANNEL}:{})});
  const page=await browser.newPage({viewport:{width:844,height:390}}),errors=[];
  await page.route('**/src/ui/renderer.js',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace(' game.terrain.flush?.();',' window.uiGame=game;window.uiCamera=camera;game.terrain.flush?.();')});});
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://localhost:8080',{waitUntil:'domcontentloaded'});await wait(page,()=>!document.getElementById('startGame').disabled);
  assert.equal(await page.locator('[data-weapon]').count(),21);
  assert.equal(await page.locator('.arsenal-showcase>div').count(),21);
  const report=await page.evaluate(async()=>{
   const {createGame}=await import('/src/engine/game.js');
   const {ARSENAL,WEAPONS}=await import('/src/engine/arsenal.js');
   const {damagePlayer,hitsCharacter}=await import('/src/engine/combat.js');
   const {createPrediction}=await import('/src/network/prediction.js');
   const {chooseShot,createComputerPlayer}=await import('/src/engine/ai.js');
   const ensure=(value,message)=>{if(!value)throw Error(message);};
   const source=document.createElement('canvas');source.width=1200;source.height=600;source.getContext('2d').fillRect(0,500,1200,100);
   const level={id:'fixture',width:1200,height:600,spawns:[{x:150,y:450},{x:800,y:450}],teamSpawns:[[{x:150,y:450},{x:500,y:450},{x:600,y:450}],[{x:800,y:450},{x:950,y:450},{x:1080,y:450}]]};
   const make=(options={})=>{const game=createGame(level,source,options);for(let i=0;i<40;i++)game.step();return game;};
   const command=(game,type,extra={})=>game.command(game.currentTurn,{type,turnId:game.turnId,...extra});
   const run=(game,n)=>{for(let i=0;i<n;i++)game.step();};
   const rotation=make(),order=[];
   for(let i=0;i<6;i++){order.push(`${rotation.currentTurn}:${rotation.activePlayer.member}`);ensure(command(rotation,'fire',{weapon:'medkit'}),'Heal command rejected');run(rotation,31);}
   ensure(order.join(',')==='0:0,1:0,0:1,1:1,0:2,1:2','Invalid team/member rotation '+order);
   const skip=make();damagePlayer(skip.players[2],100);command(skip,'fire',{weapon:'medkit'});run(skip,31);command(skip,'fire',{weapon:'medkit'});run(skip,31);ensure(skip.activePlayer.member===2,'Dead member is not skipped');
   const deaths=make();damagePlayer(deaths.players[0],100);deaths.step();ensure(!deaths.gameOver,'One loss ends the team match');
   for(const p of deaths.players.filter(p=>p.team===0))damagePlayer(p,100);deaths.step();ensure(deaths.gameOver&&deaths.winner===1,'Whole team defeat missing');
   const coin=createGame(level,source,{firstTeam:1,introTicks:150});ensure(!command(coin,'fire',{weapon:'bazooka'}),'Can fire during coin toss');run(coin,150);ensure(coin.currentTurn===1&&coin.canFire,'Coin winner not applied');
   const outcomes={};
   const mortar=make();mortar.activePlayer.angle=-Math.PI/4;
   command(mortar,'fire',{weapon:'mortar'});
   const shell=mortar.projectiles[0];
   ensure(Math.hypot(shell.vx,shell.vy)>=16.9,'Mortar launch range was not increased');
   ensure(ARSENAL.mortar.speed**2/ARSENAL.mortar.gravity>850,'Mortar cannot cover a long distance');
   for(const seconds of [2,3,4]){
     const timed=make();timed.activePlayer.angle=.5;timed.activePlayer.power=.15;
     ensure(command(timed,'fuse',{seconds}),'Valid fuse rejected');ensure(!command(timed,'fuse',{seconds:5}),'Invalid fuse accepted');
     command(timed,'fire',{weapon:'frag'});const id=timed.projectiles[0].id;
     run(timed,seconds*60-1);
     ensure(timed.projectiles.some(p=>p.id===id&&p.type==='frag'),'Grenade exploded before selected fuse');
     ensure(timed.terrain.operations.length===0,'Grenade impact damages terrain before fuse');
     timed.step();ensure(!timed.projectiles.some(p=>p.id===id),'Grenade did not detonate on time');
     ensure(timed.projectiles.filter(p=>p.type==='fragment').length===8,'Fuse detonation loses fragments');
   }
   for(const weapon of WEAPONS.filter(id=>id!=='orbital')){
    const game=make(),self=game.activePlayer,target=game.players[1];self.angle=0;target.x=weapon==='punch'?195:240;
    if(weapon==='teleport'){target.x=850;self.power=.2;}
    if(weapon==='airstrike')self.power=.15;
    if(weapon==='medkit')self.health=30;
    if(weapon==='cluster')self.angle=-1.2;
    const x=self.x;
    ensure(command(game,'fire',{weapon,...(weapon==='teleport'?{target:{x:self.x+130,y:self.y}}:{})}),'Weapon rejected: '+weapon);
    if(weapon==='medkit')ensure(self.health===65,'Kit does not heal');
    else if(weapon==='teleport'){ensure(self.transit&&self.x===x,'Teleport skipped departure animation');run(game,24);ensure(self.x>x+100,'Teleport did not move');run(game,30);ensure(!self.transit,'Teleport arrival never finishes');}
    else if(weapon==='dynamite'){
      const bomb=game.projectiles[0];ensure(bomb.placed&&bomb.vx===0&&game.escaping,'Dynamite was thrown');
      ensure(!command(game,'fire',{weapon:'bazooka'}),'Can fire twice during escape');command(game,'input',{left:true});run(game,181);ensure(target.health<100,'Dynamite did not damage');
    }else if(weapon==='mine'){
      ensure(game.hazards[0]?.type==='mine','Mine not placed');command(game,'input',{left:true});run(game,125);const mine=game.hazards[0];ensure(mine,'Mine detonated before anyone approached');target.x=mine.x;target.y=488;game.step();ensure(target.health<100,'Mine did not trigger');
    }else if(weapon==='cluster'){
      let split=false;for(let i=0;i<120;i++){game.step();if(game.projectiles.filter(p=>p.child).length===5){split=true;break;}}ensure(split,'Cluster did not split at the apex');
    }else{
      let fragmentCount=0,gas=false,planeSeen=false,bombs=0;
      if(weapon==='airstrike')ensure(game.projectiles[0]?.type==='flare'&&!game.aircraft.length,'Airstrike skips the flare');
      for(let i=0;i<220;i++){game.step();fragmentCount=Math.max(fragmentCount,game.projectiles.filter(p=>p.type==='fragment').length);gas ||=game.hazards.some(h=>h.type==='gas');
        if(game.aircraft.length){
          if(!planeSeen){ensure(game.escaping&&!game.canFire,'No opportunity to take cover during aircraft approach');ensure(command(game,'input',{left:true}),'Cannot move while waiting for air support');}
          planeSeen=true;ensure(game.aircraft[0].y<=-180,'Aircraft flies inside the terrain');bombs=Math.max(bombs,game.aircraft[0].nextBomb);if(game.aircraft[0].nextBomb===2)window.airSupportFrame={level,source,state:game.snapshot()};}
      }
      ensure(target.health<100,'No direct damage: '+weapon);
      if(weapon==='frag')ensure(fragmentCount===8,'No eight explosive fragments');
      if(weapon==='gas')ensure(gas,'Gas cloud not created');
      if(weapon==='airstrike')ensure(planeSeen&&bombs===5,'Aircraft does not release five bombs');
    }
    outcomes[weapon]=true;
   }
   const head=make();head.players[1].x=220;
   const invalid=make();ensure(!command(invalid,'fire',{weapon:'teleport'}),'Teleport does not require a destination');ensure(!command(invalid,'fire',{weapon:'teleport',target:{x:1100,y:400}}),'Teleport exceeds its range');ensure(invalid.canFire&&!invalid.lastShot,'Invalid teleport consumes the action');
   ensure(hitsCharacter(head.players[1],220,head.players[1].y-29,3),'Head is outside hitbox');
   head.activePlayer.angle=Math.atan2(-19,70);command(head,'fire',{weapon:'sniper'});ensure(head.players[1].health===25,'Head shot missed');
   const low=make(),high=make();low.activePlayer.angle=high.activePlayer.angle=-.8;
   command(low,'power',{power:.2});command(low,'fire',{weapon:'bazooka'});command(high,'fire',{weapon:'bazooka'});
   ensure(Math.abs(low.projectiles[0].vx)<Math.abs(high.projectiles[0].vx)*.5,'Power does not change velocity');
   const before=JSON.stringify(high.snapshot());chooseShot(high,0,{difficulty:'easy',random:()=>.5});ensure(JSON.stringify(high.snapshot())===before,'AI planning mutates the game');
   const host=make(),guest=make(),prediction=createPrediction();
   command(host,'aim',{angle:-.6,power:.65});command(host,'fire',{weapon:'bazooka'});
   const packet={epoch:1,ackCommandSeq:0,state:host.snapshot()};prediction.reconcile(guest,packet,1,0);
   ensure(guest.projectiles.length===1,'Snapshot lost projectile');const start=guest.projectiles[0].x;
   for(let i=0;i<6;i++){host.step();guest.step();}
   ensure(guest.projectiles[0].x!==start,'Guest does not simulate between packets');
   ensure(JSON.stringify(host.snapshot())===JSON.stringify(guest.snapshot()),'Local projectile simulations diverge');
   const clean=make();prediction.reconcile(guest,{epoch:1,ackCommandSeq:0,state:clean.snapshot()},0,0);
   const local=prediction.command(guest,0,{type:'input',right:true,turnId:clean.turnId,epoch:1});
   prediction.reconcile(guest,{epoch:1,ackCommandSeq:0,state:clean.snapshot()},0,0);ensure(guest.inputState.right,'Unacknowledged movement lost');
   clean.command(0,local);prediction.reconcile(guest,{epoch:1,ackCommandSeq:local.commandSeq,state:clean.snapshot()},0,0);
   ensure(JSON.stringify(guest.snapshot())===JSON.stringify(clean.snapshot()),'Confirmed commands are replayed twice');
   const terrainCopy=make();terrainCopy.terrain.apply({type:'circle',args:[300,510,25]});const corrected=make();corrected.terrain.apply({type:'circle',args:[400,510,25]});terrainCopy.restore(corrected.snapshot());
   ensure(terrainCopy.terrain.isSolid(300,510)&&!terrainCopy.terrain.isSolid(400,510),'Predicted crater not reconciled');
   const deterministic=make();command(deterministic,'fire',{weapon:'frag'});run(deterministic,5);const copy=make();copy.restore(deterministic.snapshot());run(deterministic,260);run(copy,260);ensure(JSON.stringify(copy.snapshot())===JSON.stringify(deterministic.snapshot()),'Secondary explosions do not replay deterministically');
   const aiGame=make({firstTeam:1});const ai=createComputerPlayer(1,{difficulty:'easy',random:()=>.5});let fired=false;
   for(let i=0;i<600;i++){ai.update(aiGame,1/60);aiGame.step();if(aiGame.lastShot){fired=true;break;}}ensure(fired,'AI never fires for its team');
   return {weapons:Object.keys(outcomes).length,order};
  });
  assert.equal(report.weapons,20);
  await page.evaluate(async()=>{
    const {createGame}=await import('/src/engine/game.js'),{createCamera}=await import('/src/ui/camera.js'),{renderGame}=await import('/src/ui/renderer.js');
    const frame=window.airSupportFrame,game=createGame(frame.level,frame.source);game.restore(frame.state);
    const canvas=document.createElement('canvas');canvas.id='support-preview';canvas.width=844;canvas.height=390;canvas.style.cssText='position:fixed;inset:0;z-index:1000;width:100vw;height:100vh';document.body.append(canvas);
    const camera=createCamera();camera.resize(844,390);camera.update(game,1/60);
    renderGame(canvas,game,{camera,weapon:'airstrike',time:performance.now()});
  });
  await page.screenshot({path:'tests/air-support-preview.png'});await page.locator('#support-preview').evaluate(canvas=>canvas.remove());
  await page.locator('#startGame').click();await wait(page,()=>!document.getElementById('coinOverlay').hidden);await page.screenshot({path:'tests/coin-preview.png'});
  await wait(page,()=>!document.getElementById('fireBtn').disabled);
  const jump=await page.locator('#btnJump').boundingBox();assert.ok(jump.x>422,'Jump must be on the right');
  await page.locator('#weaponToggle').click();await page.locator('[data-weapon="sniper"]').click();
  await wait(page,()=>window.uiGame.activePlayer.equipped==='sniper');await page.screenshot({path:'tests/held-weapon-preview.png'});
  await page.locator('#weaponToggle').click();await page.locator('[data-weapon="frag"]').click();
  for(const value of [3,4,2]){await page.locator('#fuseToggle').click();await page.waitForFunction(value=>document.getElementById('fuseToggle').textContent===`Mecha: ${value} s`,value);}
  await page.locator('#weaponToggle').click();await page.locator('[data-weapon="teleport"]').click();
  assert.equal(await page.locator('#weaponPanel').isHidden(),true);assert.equal(await page.locator('#fireBtn').isDisabled(),true);
  const target=await page.evaluate(()=>{for(const sy of [180,210,150,240])for(const sx of [422,322,522]){const raw=window.uiCamera.screenToWorld(sx,sy),p=window.uiGame.activePlayer,t=window.uiGame.teleportTarget(p,raw);if(t.valid&&Math.hypot(t.x-p.x,t.y-p.y)>60)return {sx,sy,x:t.x,y:t.y,turn:window.uiGame.turnId};}throw Error('No visible teleport destination');});
  // Dragging explores the map and must not activate the device.
  await page.mouse.move(target.sx,target.sy);await page.mouse.down();await page.mouse.move(target.sx+25,target.sy,{steps:3});await page.mouse.up();
  assert.equal(await page.evaluate(()=>!!window.uiGame.activePlayer.transit),false);
  const click=await page.evaluate(({x,y})=>window.uiCamera.worldToScreen(x,y),target);
  await page.mouse.click(click.x,click.y);await wait(page,()=>!!window.uiGame.activePlayer.transit);
  await page.screenshot({path:'tests/teleport-preview.png'});
  await page.waitForFunction(turn=>window.uiGame.turnId>turn,target.turn);
  await wait(page,()=>document.getElementById('currentWeaponName').textContent==='Bazooka');
  await page.locator('#weaponToggle').click();await page.locator('[data-weapon="disc"]').click();assert.equal(await page.locator('#currentWeaponName').textContent(),'Escudo');
  await page.locator('#weaponToggle').click();await page.locator('[data-weapon="dynamite"]').click();
  assert.match(await page.locator('#weaponDescription').textContent(),/huir/);
  assert.equal(await page.locator('#weaponPanel').isHidden(),true);await page.locator('#weaponToggle').click();await page.screenshot({path:'tests/arsenal-preview.png'});await page.locator('#closeWeapons').click();
  await page.locator('#fireBtn').click();await wait(page,()=>document.getElementById('fireHint').textContent==='¡Huye!');
  assert.equal(await page.locator('#fireBtn').isDisabled(),true);
  const firedTurn=await page.evaluate(()=>window.uiGame.turnId);
  await page.waitForFunction(turn=>window.uiGame.turnId>turn,firedTurn);
  await wait(page,()=>document.getElementById('currentWeaponName').textContent==='Teletransportador');
  await page.locator('#weaponToggle').click();await page.locator('[data-weapon="medkit"]').click();
  await page.locator('#fireBtn').click();
  await page.waitForFunction(turn=>window.uiGame.turnId>turn+1,firedTurn);
  await wait(page,()=>window.uiGame.activePlayer.equipped==='dynamite');
  assert.equal(await page.locator('#currentWeaponName').textContent(),'Dinamita');
  assert.deepEqual(errors,[]);
  await page.close();
 }finally{await browser?.close();server.kill();}
});
