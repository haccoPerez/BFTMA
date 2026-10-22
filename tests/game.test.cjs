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
  const page=await browser.newPage({viewport:{width:844,height:390},hasTouch:true}),errors=[];
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
   const {bindInput}=await import('/src/ui/input.js');
   let keyboardGame=make(),keyboardWeapon='bazooka',keyboardEnabled=true;
   const keyboard=bindInput(document.createElement('canvas'),{
     getGame:()=>keyboardGame,canControl:()=>keyboardEnabled&&keyboardGame.canAct,isPlaying:()=>keyboardEnabled,getWeapon:()=>keyboardWeapon,
     send:cmd=>keyboardGame.command(keyboardGame.currentTurn,{...cmd,turnId:keyboardGame.turnId})
   });
   const key=(type,name,repeat=false)=>document.body.dispatchEvent(new KeyboardEvent(type,{key:name,repeat,bubbles:true,cancelable:true}));
   let actor=keyboardGame.activePlayer,angle=actor.angle;
   key('keydown','ArrowUp');keyboard.update(.1);key('keyup','ArrowUp');
   ensure(actor.angle<angle&&!keyboardGame.inputState.jump,'Up does not adjust aim or still jumps');
   angle=actor.angle;key('keydown','ArrowDown');keyboard.update(.1);key('keyup','ArrowDown');ensure(actor.angle>angle,'Down does not lower aim');
   actor.angle=Math.PI+.25;angle=actor.angle;key('keydown','ArrowUp');keyboard.update(.1);key('keyup','ArrowUp');ensure(actor.angle>angle,'Left-facing aim moves in the wrong direction');
   key('keydown','Z');ensure(actor.power===.15,'Charge does not start at minimum');keyboard.update(.1);ensure(actor.power>.15,'Held Z does not charge');
   key('keyup','Z');const charged=actor.power;keyboard.update(.1);ensure(actor.power===charged&&!keyboardGame.lastShot,'Releasing Z changes power or fires');
   key('keydown','z');for(let i=0;i<20;i++)keyboard.update(.1);ensure(actor.power===1,'Charge does not cap at full power');key('keyup','z');
   key('keydown','x');ensure(keyboardGame.lastShot?.weapon==='bazooka','X does not fire');
   const shot=keyboardGame.lastShot.id;key('keydown','x',true);ensure(keyboardGame.lastShot.id===shot,'X repeats a shot while held');key('keyup','x');
   keyboardGame=make();actor=keyboardGame.activePlayer;keyboardWeapon='sniper';key('keydown','z');keyboard.update(.1);key('keyup','z');ensure(actor.power===1,'Z changes a fixed-power weapon');
   keyboardWeapon='teleport';key('keydown','x');key('keyup','x');ensure(!keyboardGame.lastShot,'X fires teleport without a map destination');
   keyboardWeapon='bazooka';key('keydown','z');window.dispatchEvent(new Event('blur'));keyboard.update(.1);ensure(actor.power===.15,'Blur does not cancel charging');key('keyup','z');
   key('keydown','z');const changed=keyboardGame.snapshot();changed.turnId++;keyboardGame.restore(changed);keyboard.update(.1);ensure(keyboardGame.activePlayer.power===.15,'Charge leaks across turns');key('keyup','z');
   const editor=document.createElement('input');document.body.append(editor);editor.focus();editor.dispatchEvent(new KeyboardEvent('keydown',{key:'x',bubbles:true}));ensure(!keyboardGame.lastShot,'Typing X in a field fires');editor.remove();
   keyboard.clear();keyboardEnabled=false;
   const {firingAngle}=await import('/src/engine/aim.js');
   const frozen=make(),victim=frozen.players[1];
   frozen.projectiles.push({id:990,type:'ice',x:victim.x,y:victim.y,vx:0,vy:0,age:0,fuse:1,team:0,ownerId:1,alive:true});run(frozen,1);
   ensure(victim.tremorTurns===2&&victim.freezeTurns===3,'Ice does not apply tremor and slow');
   command(frozen,'fire',{weapon:'medkit'});run(frozen,31);
   ensure(frozen.currentTurn===1&&victim.tremorTurns===1,'Tremor expires before the affected team can act');
   for(const weapon of ['bazooka','sniper','laser','machinegun','shotgun','orbital']){
     const player={...victim,angle:-.4},a=firingAngle(player,weapon,0),b=firingAngle(player,weapon,18);
     ensure(a!==b&&Math.abs(a-player.angle)<=4*Math.PI/180,'Aim does not oscillate within four degrees');
   }
   ensure(firingAngle(victim,'teleport',18)===victim.angle,'Tremor changes destination-based tools');
   const shaking=make();shaking.activePlayer.tremorTurns=1;shaking.activePlayer.angle=-.7;
   const expected=firingAngle(shaking.activePlayer,'bazooka',shaking.tick);command(shaking,'fire',{weapon:'bazooka'});
   ensure(Math.abs(Math.atan2(shaking.projectiles[0].vy,shaking.projectiles[0].vx)-expected)<1e-9,'Shot does not match visible tremor');
   command(frozen,'fire',{weapon:'medkit'});run(frozen,31);command(frozen,'fire',{weapon:'medkit'});run(frozen,31);
   ensure(victim.tremorTurns===0&&victim.freezeTurns===1,'Tremor must last one team turn while slow lasts two');
   for(const vx of [-9,9])for(const vy of [0,4]){
     const cluster=make();
     cluster.projectiles.push({id:900,type:'cluster',x:600,y:100,vx,vy,age:15,alive:true,ownerId:1,team:0});
     const replay=make();replay.restore(cluster.snapshot());
     run(cluster,1);run(replay,1);
     const children=cluster.projectiles;
     ensure(children.length===5&&children.every(p=>p.child&&p.x===600&&p.y===100&&p.ownerId===1&&p.team===0),'Racimo loses shared pivot or ownership');
     const meanX=children.reduce((sum,p)=>sum+p.vx,0)/5;
     ensure(Math.abs(meanX-vx)<1e-9,'Racimo loses horizontal inertia');
     ensure(Math.abs(children.reduce((sum,p)=>sum+p.vy,0)/5-vy)<1e-9,'Racimo loses vertical inertia');
     ensure(new Set(children.map(p=>Math.atan2(p.vy,p.vx).toFixed(5))).size===5,'Racimo does not fan into five trajectories');
     const center=children[2],x=center.x,y=center.y,childVx=center.vx,childVy=center.vy;
     run(cluster,1);run(replay,1);
     ensure(Math.abs(center.x-x-childVx)<1e-9&&Math.abs(center.y-y-childVy-ARSENAL.cluster.gravity)<1e-9,'Minibomb does not follow a ballistic arc');
     ensure(JSON.stringify(cluster.snapshot())===JSON.stringify(replay.snapshot()),'Racimo replay diverges');
   }
   const {gasState,hasGasMask}=await import('/src/engine/gas.js');
   const fresh=gasState({age:0}),old=gasState({age:600});
   ensure(fresh.radius===90&&old.radius>90,'Initial gas size is not doubled');
   ensure(old.radius>fresh.radius&&old.alpha<fresh.alpha&&old.damage<fresh.damage,'Gas does not expand, fade and weaken');
   const toxic=make(),ally=toxic.players[0],enemy=toxic.players[1];
   enemy.x=ally.x+25;
   toxic.hazards.push({type:'gas',team:ally.team,x:ally.x,y:ally.y,radius:45,age:0,expires:4});
   const allyHealth=ally.health,enemyHealth=enemy.health;run(toxic,60);
   ensure(ally.health===allyHealth&&enemy.health<enemyHealth,'Gas masks do not protect only their team');
   const firstSecond=enemy.health;run(toxic,59);
   ensure(enemy.health===firstSecond,'Gas damage ticks faster than once per second');
   run(toxic,1);ensure(enemy.health<firstSecond&&ally.health===allyHealth,'Gas damage is not repeated each second or hurts allies');
   const replica=make();replica.restore(toxic.snapshot());
   ensure(hasGasMask(replica.players[0],replica),'Gas mask ownership lost in snapshot');
   run(toxic,600);ensure(!hasGasMask(ally,toxic)&&!toxic.hazards.some(h=>h.type==='gas'),'Gas or mask outlives dissipation');
   ensure(hasGasMask(ally,{projectiles:[{type:'gas',team:ally.team}],hazards:[]}), 'Masks missing during grenade flight');
   const burst=make(),thrower=burst.players[0],nearby=burst.players[1];nearby.x=thrower.x+25;
   burst.projectiles.push({id:900,type:'gas',x:thrower.x,y:thrower.y,vx:0,vy:0,age:0,fuse:1,team:thrower.team,ownerId:thrower.id,alive:true});
   run(burst,1);ensure(thrower.health===100&&nearby.health===100,'Gas burst causes immediate explosive damage');
   run(burst,59);ensure(thrower.health===100&&nearby.health<100,'Gas burst does not start protected, recurring damage');
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
  const cdp=await page.context().newCDPSession(page);
  const swipe=async(selector)=>{
    const box=await page.locator(selector).boundingBox();
    const x=box.x+box.width/2,y=box.y+box.height*.7;
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
    for(let i=1;i<=10;i++){
      await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-i*Math.min(14,box.height*.05)}]});
      await page.waitForTimeout(20);
    }
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await page.waitForFunction(selector=>document.querySelector(selector).scrollTop>0,selector);
  };
  await page.locator('[data-setup-tab="arsenal"]').click();
  await swipe('.arsenal-card');
  await page.setViewportSize({width:390,height:844});
  await page.locator('.arsenal-card').evaluate(card=>card.scrollTop=0);
  await swipe('#mainMenu');
  await page.setViewportSize({width:844,height:390});
  await page.locator('[data-setup-tab="play"]').click();
  await page.locator('#startGame').click();await wait(page,()=>!document.getElementById('coinOverlay').hidden);await page.screenshot({path:'tests/coin-preview.png'});
  await wait(page,()=>!document.getElementById('fireBtn').disabled);
  const jump=await page.locator('#btnJump').boundingBox();assert.ok(jump.x>422,'Jump must be on the right');
  await page.locator('#weaponToggle').click();await swipe('.weapon-grid');
  assert.equal(await page.locator('.weapon-grid button').first().evaluate(button=>getComputedStyle(button).touchAction),'pan-y');
  await page.locator('[data-weapon="sniper"]').click();
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
