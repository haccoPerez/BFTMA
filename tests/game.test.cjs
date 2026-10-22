const {test}=require('node:test');
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const path=require('node:path');
const {createRequire}=require('node:module');
const fromRuntime=process.env.BFTMA_NODE_MODULES
  ?createRequire(path.join(process.env.BFTMA_NODE_MODULES,'__tests.cjs'))
  :createRequire(path.resolve(__dirname,'../tools/package.json'));
const {chromium}=fromRuntime('playwright');
const wait=(page,fn)=>page.waitForFunction(fn,null,{polling:50,timeout:10000});

test('shared engine, terrain changes, destruction and authoritative replication',async()=>{
  const server=spawn(process.execPath,['tools/server.cjs'],{cwd:path.resolve(__dirname,'..'),stdio:'pipe'});
  let browser;
  try{
    await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);server.once('exit',code=>reject(new Error('Server exited '+code)));});
    browser=await chromium.launch({headless:true,...(process.env.BFTMA_BROWSER_CHANNEL?{channel:process.env.BFTMA_BROWSER_CHANNEL}:{})});
    const page=await browser.newPage();
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto('http://localhost:8080');
    await wait(page,()=>document.getElementById('status').textContent==='Partida local');
    assert.equal(await page.locator('#mainMenu').isVisible(),true);
    assert.equal(await page.locator('#ui').isHidden(),true);
    const pausedClock=await page.locator('#turnBadge').textContent();
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator('#turnBadge').textContent(),pausedClock);
    await page.selectOption('#level','ship');
    await wait(page,()=>!document.getElementById('startGame').disabled&&document.getElementById('levelTitle').textContent==='Carguero de Tampico');
    await page.locator('#startGame').click();
    await wait(page,()=>!document.getElementById('fireBtn').disabled);
    assert.equal(await page.locator('#gameCanvas').getAttribute('data-world-width'),'1920');
    const zoomBefore=await page.locator('#cameraZoom').textContent();
    await page.locator('#cameraToggle').click();await page.locator('#zoomIn').click();
    await page.waitForFunction(before=>document.getElementById('cameraZoom').textContent!==before,zoomBefore,{polling:50});
    await page.locator('#viewMap').click();
    await page.screenshot({path:'tests/ship-overview.png'});
    await page.locator('#cameraToggle').click();await page.locator('#followPlayer').click();
    await page.setViewportSize({width:390,height:844});
    await wait(page,()=>document.getElementById('gameCanvas').getAttribute('width')==='390');
    for(const selector of ['#btnLeft','#btnRight','#btnJump','#fireBtn','#weaponToggle']){
      const bounds=await page.locator(selector).boundingBox();
      assert.ok(bounds.width>=48&&bounds.height>=48&&bounds.x>=0&&bounds.x+bounds.width<=390);
    }
    await page.locator('#weaponToggle').click();
    await page.locator('[data-weapon="lemon"]').click();
    assert.equal(await page.locator('#currentWeaponName').textContent(),'Limón');
    assert.equal(await page.locator('#weaponPanel').isHidden(),true);
    const touch=await page.context().newCDPSession(page);
    const pinchZoom=await page.locator('#cameraZoom').textContent();
    await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:100,y:450,id:1},{x:260,y:450,id:2}]});
    await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:80,y:450,id:1},{x:280,y:450,id:2}]});
    await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await page.waitForFunction(before=>document.getElementById('cameraZoom').textContent!==before,pinchZoom,{polling:50});
    await page.screenshot({path:'tests/camera-mobile.png'});
    await touch.detach();await page.setViewportSize({width:1280,height:720});
    await page.screenshot({path:'tests/ship-preview.png'});
    await page.locator('#optionsToggle').click();await page.locator('#backToMenu').click();
    await page.selectOption('#level','islands');
    await wait(page,()=>!document.getElementById('startGame').disabled);
    await page.locator('#styleToggle').click();
    await page.selectOption('#styleAccessory','bow');
    await page.locator('#styleName').fill('Mapachín');
    await page.locator('#startGame').click();
    await wait(page,()=>!document.getElementById('fireBtn').disabled);
    await page.locator('#optionsToggle').click();await page.locator('#backToMenu').click();
    assert.equal(await page.locator('#styleAccessory').inputValue(),'bow');
    assert.equal(await page.locator('#styleName').inputValue(),'Mapachín');
    await page.selectOption('#stylePlayer','1');
    await page.selectOption('#styleAccessory','hat');
    await page.selectOption('#stylePlayer','0');
    await page.screenshot({path:'tests/customization-preview.png'});
    await page.setViewportSize({width:390,height:844});
    await page.screenshot({path:'tests/menu-mobile.png',fullPage:true});
    assert.equal(await page.evaluate(()=>document.getElementById('mainMenu').scrollWidth<=innerWidth),true);
    await page.setViewportSize({width:1280,height:720});
    assert.equal(await page.locator('#level').inputValue(),'islands');
    await page.locator('#startGame').click();
    await page.locator('#weaponToggle').click();await page.locator('[data-weapon="screw"]').click();
    await page.locator('#fireBtn').click();
    await page.locator('#optionsToggle').click();await page.locator('#reset').click();
    await wait(page,()=>!document.getElementById('fireBtn').disabled);
    const result=await page.evaluate(async()=>{
      const {createGame,PROJECTILE_GRAVITY}=await import('/src/engine/game.js');
      const {LEVELS,loadLevelSource}=await import('/src/levels/index.js');
      const {createCamera}=await import('/src/ui/camera.js');
      const source=await loadLevelSource(LEVELS.crab);
      const host=createGame(LEVELS.crab,source),guest=createGame(LEVELS.crab,source);
      const camera=createCamera();camera.resize(390,844);camera.update(host,1/60);
      if(camera.zoom<1)throw new Error('La cámara móvil no acerca al personaje');
      const point=camera.worldToScreen(200,100),world=camera.screenToWorld(point.x,point.y);
      if(Math.abs(world.x-200)>1e-6||Math.abs(world.y-100)>1e-6)throw new Error('Conversión de coordenadas incorrecta');
      const anchor=camera.screenToWorld(123,456);camera.zoomAt(1.2,123,456);
      const afterZoom=camera.screenToWorld(123,456);
      if(Math.hypot(anchor.x-afterZoom.x,anchor.y-afterZoom.y)>1e-6)throw new Error('El zoom mueve el punto bajo el cursor');
      const stateBeforeCamera=JSON.stringify(host.snapshot());camera.showMap();
      if(Math.abs(camera.zoom-Math.min(390/1280,844/720))>1e-6)throw new Error('La vista general no encuadra el mapa');
      camera.resume();camera.update(host,1);
      if(!camera.following||camera.zoom<1)throw new Error('No se recupera el seguimiento');
      if(JSON.stringify(host.snapshot())!==stateBeforeCamera)throw new Error('La cámara modifica el juego');
      const tracking=createCamera();tracking.resize(390,844);
      const scene={level:{width:1920,height:1080},turnId:0,currentTurn:0,players:[{x:650,y:400,angle:0},{x:1500,y:400,angle:Math.PI}],projectiles:[],terrain:{operations:[]}};
      tracking.update(scene,1/60);
      const trackingStart={x:tracking.x,y:tracking.y,zoom:tracking.zoom};
      scene.currentTurn=1;scene.turnId=1;
      scene.projectiles.push({x:trackingStart.x,y:trackingStart.y,vx:12,vy:0});
      tracking.update(scene,1/60);
      if(Math.hypot(tracking.x-trackingStart.x,tracking.y-trackingStart.y)>1e-6)throw new Error('La cámara persigue un proyectil dentro de la zona estable');
      scene.projectiles[0].x+=120;tracking.update(scene,1/60);
      const beforeBounce=tracking.x;scene.projectiles[0].vx=-12;tracking.update(scene,1/60);
      if(tracking.x<beforeBounce)throw new Error('El rebote invierte la cámara por la velocidad');
      const impact={x:tracking.x,y:tracking.y};scene.projectiles.length=0;scene.terrain.operations.push({type:'circle'});
      for(let i=0;i<40;i++)tracking.update(scene,1/60);
      if(Math.hypot(tracking.x-impact.x,tracking.y-impact.y)>1e-6)throw new Error('La cámara abandona el impacto inmediatamente');
      for(let i=0;i<40;i++)tracking.update(scene,1/60);
      if(tracking.x<=impact.x||tracking.zoom!==trackingStart.zoom)throw new Error('No vuelve suavemente al rival con el mismo zoom');
      const originalRadius=host.players[1].radius;
      if(!host.command(1,{type:'appearance',appearance:{accessory:'wig',nickname:'Rival'}}))throw new Error('No se puede personalizar fuera del turno');
      if(host.players[1].radius!==originalRadius||host.players[1].health!==100)throw new Error('La apariencia altera la mecánica');
      host.command(0,{type:'appearance',appearance:{accessory:'ruta-invalida',nickname:'abcdefghijklmnopqrst'}});
      if(host.players[0].appearance.accessory!=='none'||host.players[0].appearance.nickname.length!==16)throw new Error('Apariencia sin validar');
      const initial=host.terrain.isSolid(640,450);
      const denied=host.command(1,{type:'fire',weapon:'screw',turnId:0});
      host.terrain.apply({type:'circle',args:[640,450,30]});
      const destroyed=!host.terrain.isSolid(640,450);
      const fired=host.command(0,{type:'fire',weapon:'bazooka',turnId:0});
      const oldX=host.projectiles[0].x;
      host.step();const moved=host.projectiles.length===0||host.projectiles[0].x!==oldX;
      const stale=host.command(1,{type:'fire',weapon:'lemon',turnId:0});
      guest.restore(host.snapshot());
      const same=JSON.stringify(host.snapshot())===JSON.stringify(guest.snapshot());
      const replica=!guest.terrain.isSolid(640,450);
      const pristine=createGame(LEVELS.crab,source).terrain.isSolid(640,450);
      const islands=createGame(LEVELS.islands,await loadLevelSource(LEVELS.islands));
      const ship=createGame(LEVELS.ship,await loadLevelSource(LEVELS.ship));
      if(ship.terrain.isSolid(960,50)||!ship.terrain.isSolid(960,720))throw new Error('Máscara del carguero incorrecta');
      for(const team of ship.level.teamSpawns){
        if(team.length!==5)throw new Error('Faltan posiciones en el carguero');
        for(const spawn of team){
          if(ship.terrain.isSolid(spawn.x,spawn.y)||ship.terrain.isSolid(spawn.x,spawn.y+12))throw new Error('Spawn del carguero dentro del terreno');
          if(!Array.from({length:8},(_,dy)=>ship.terrain.isSolid(spawn.x,spawn.y+13+dy)).some(Boolean))throw new Error('Spawn del carguero sin suelo');
        }
      }
      ship.terrain.apply({type:'circle',args:[960,720,30]});
      if(ship.terrain.isSolid(960,720))throw new Error('El casco no se destruye');
      const gap=!islands.terrain.isSolid(960,950);
      const bridge=Array.from({length:1080},(_,y)=>islands.terrain.isSolid(960,y)).some(Boolean);
      const transparentSky=!islands.terrain.isSolid(960,50);
      const islandSolid=Array.from({length:1080},(_,y)=>islands.terrain.isSolid(380,y)).some(Boolean);
      for(const team of LEVELS.islands.teamSpawns){
        if(team.length!==5)throw new Error('Se necesitan cinco posiciones por equipo');
        for(const spawn of team){
          if(islands.terrain.isSolid(spawn.x,spawn.y)||islands.terrain.isSolid(spawn.x,spawn.y+12))throw new Error('Spawn dentro del terreno');
          if(!Array.from({length:8},(_,dy)=>islands.terrain.isSolid(spawn.x,spawn.y+13+dy)).some(Boolean))throw new Error('Spawn sin suelo cercano');
        }
      }
      host.terrain.apply({type:'tunnel',args:[400,450,400,450,10]});
      const degenerate=!host.terrain.isSolid(400,450);
      const clock=createGame(LEVELS.crab,source);
      for(let i=0;i<601;i++)clock.step();
      // In empty sky, the bazooka must keep horizontal speed and curve down.
      const blank=document.createElement('canvas');blank.width=1280;blank.height=720;
      const ballistic=createGame(LEVELS.crab,blank);
      Object.assign(ballistic.players[0],{x:400,y:250,angle:-.5});
      ballistic.command(0,{type:'fire',weapon:'bazooka',turnId:0});
      const launch={...ballistic.projectiles[0]},steps=30;
      for(let i=0;i<steps;i++)ballistic.step();
      const shot=ballistic.projectiles[0],gravity=PROJECTILE_GRAVITY.bazooka;
      if(!shot||Math.abs(shot.x-(launch.x+launch.vx*steps))>1e-6||
        Math.abs(shot.y-(launch.y+launch.vy*steps+gravity*steps*(steps+1)/2))>1e-6)
        throw new Error('La bazooka no sigue la parábola esperada');
      const {explosionDamage,DAMAGE}=await import('/src/engine/combat.js');
      const targets=[0,50,200].map(x=>({x,y:0,radius:12,health:100,alive:true}));
      explosionDamage(targets,0,0,'bazooka');
      if(targets[0].health!==50||targets[1].health<=50||targets[1].health>=100||targets[2].health!==100)
        throw new Error('El daño debe disminuir con la distancia');
      const makeDuel=()=>{
        const duel=createGame(LEVELS.crab,blank);
        Object.assign(duel.players[0],{x:300,y:250,angle:0});
        Object.assign(duel.players[1],{x:400,y:250,angle:Math.PI});
        return duel;
      };
      const {chooseShot,createComputerPlayer,applyAimError,DIFFICULTIES}=await import('/src/engine/ai.js');
      for(const difficulty of ['easy','normal','hard']){
        const error=Math.abs(applyAimError(.5,difficulty,()=>.75)-.5)*180/Math.PI;
        if(error<DIFFICULTIES[difficulty].errorMin-1e-6||error>DIFFICULTIES[difficulty].errorMax+1e-6)
          throw new Error('Error de puntería fuera del rango de dificultad');
      }
      if(DIFFICULTIES.easy.errorMax!==8||DIFFICULTIES.easy.samples!==48)
        throw new Error('Fácil no conserva la precisión del anterior Normal');
      if(Math.abs(applyAimError(0,'easy',()=>.75))<=Math.abs(applyAimError(0,'hard',()=>.75)))
        throw new Error('Las dificultades no cambian la precisión');
      const makeAIDuel=()=>{
        const floor=document.createElement('canvas');floor.width=1280;floor.height=720;
        floor.getContext('2d').fillRect(0,400,1280,320);
        const duel=createGame(LEVELS.crab,floor);
        Object.assign(duel.players[0],{x:300,y:250,angle:0});
        Object.assign(duel.players[1],{x:400,y:250,angle:Math.PI});return duel;
      };
      const aiDuel=makeAIDuel();
      const beforePlan=JSON.stringify(aiDuel.snapshot());
      const selected=chooseShot(aiDuel,1);
      if(JSON.stringify(aiDuel.snapshot())!==beforePlan)throw new Error('La predicción de IA modifica la partida');
      if(selected.score<20)throw new Error('La IA no encuentra un tiro cercano');
      const ai=createComputerPlayer(1);
      ai.update(aiDuel,2);
      if(aiDuel.currentTurn!==0||aiDuel.resolving)throw new Error('La IA juega fuera de turno');
      aiDuel.command(0,{type:'fire',weapon:'screw',turnId:0});
      for(let i=0;i<180&&aiDuel.currentTurn===1;i++){ai.update(aiDuel,1/60);aiDuel.step();}
      if(aiDuel.gameOver||aiDuel.currentTurn===1)throw new Error('La IA no dispara en su turno');
      const resetAI=makeAIDuel();resetAI.command(0,{type:'fire',weapon:'screw',turnId:0});
      for(let i=0;i<180&&resetAI.currentTurn===1;i++){ai.update(resetAI,1/60);resetAI.step();}
      if(resetAI.gameOver||resetAI.currentTurn===1)throw new Error('La IA no se reinicia con otra partida');
      const mobile=makeAIDuel();
      Object.assign(mobile.players[0],{x:300,y:387,angle:-Math.PI/2,isGrounded:true});
      Object.assign(mobile.players[1],{x:900,y:387,isGrounded:true});
      mobile.command(0,{type:'fire',weapon:'screw',turnId:0});
      const walker=createComputerPlayer(1,{difficulty:'easy',random:()=>.5});
      for(let i=0;i<240&&mobile.currentTurn===1;i++){walker.update(mobile,1/60);mobile.step();}
      if(mobile.players[1].x>860||mobile.currentTurn===1||mobile.gameOver)
        throw new Error('La IA no camina antes de disparar aun con un tiro disponible');
      const gapSource=document.createElement('canvas');gapSource.width=1280;gapSource.height=720;
      gapSource.getContext('2d').fillRect(0,400,500,320);gapSource.getContext('2d').fillRect(700,400,580,320);
      const cautious=createGame(LEVELS.crab,gapSource);
      Object.assign(cautious.players[0],{x:300,y:387,angle:-Math.PI/2,isGrounded:true});
      Object.assign(cautious.players[1],{x:715,y:387,isGrounded:true});
      cautious.command(0,{type:'fire',weapon:'screw',turnId:0});
      const careful=createComputerPlayer(1,{difficulty:'easy',random:()=>.5});
      for(let i=0;i<240&&cautious.currentTurn===1;i++){careful.update(cautious,1/60);cautious.step();}
      if(cautious.players[1].x<715||cautious.gameOver||cautious.currentTurn===1)
        throw new Error('La IA se mueve hacia un hueco o no completa el turno');
      const pushed=makeDuel();
      explosionDamage(pushed.players,350,250,'bazooka');
      if(pushed.players[0].vx>=0||pushed.players[1].vx<=0||pushed.players.some(p=>p.vy>=0))
        throw new Error('La explosión no empuja hacia afuera y arriba');
      const oldEnemyX=pushed.players[1].x,oldEnemyY=pushed.players[1].y;
      pushed.step();
      if(pushed.players[1].x<=oldEnemyX||pushed.players[1].y>=oldEnemyY)
        throw new Error('El retroceso no mueve al jugador fuera de turno');
      const pushedCopy=makeDuel();pushedCopy.restore(pushed.snapshot());
      if(pushedCopy.players[1].vx!==pushed.players[1].vx||pushedCopy.players[1].vy!==pushed.players[1].vy)
        throw new Error('El impulso no se replica');
      const wallSource=document.createElement('canvas');wallSource.width=1280;wallSource.height=720;
      const wallCtx=wallSource.getContext('2d');wallCtx.fillRect(350,0,10,720);
      const blocked=createGame(LEVELS.crab,wallSource);
      Object.assign(blocked.players[0],{x:335,y:250,vx:6,vy:-2});blocked.step();
      if(blocked.players[0].x>338||blocked.players[0].vx!==0)throw new Error('El empuje atraviesa paredes');
      const walking=makeDuel();walking.players[0].angle=-.4;
      const elevation=Math.sin(walking.players[0].angle);
      walking.command(0,{type:'input',left:true,turnId:0});walking.step();
      if(walking.players[0].x>=300||Math.cos(walking.players[0].angle)>=0||Math.abs(Math.sin(walking.players[0].angle)-elevation)>1e-6)
        throw new Error('Caminar a la izquierda no refleja la orientación conservando la elevación');
      walking.command(0,{type:'input',right:true,turnId:0});walking.step();
      if(Math.cos(walking.players[0].angle)<=0||Math.abs(walking.players[0].angle+.4)>1e-6)
        throw new Error('Caminar a la derecha no restaura la orientación');
      walking.command(0,{type:'input',turnId:0});walking.command(0,{type:'aim',angle:Math.PI-.3,turnId:0});walking.step();
      if(Math.cos(walking.players[0].angle)>=0)throw new Error('No se puede apuntar hacia atrás al detenerse');
      for(const weapon of ['bazooka','lemon','screw']){
        const duel=makeDuel();
        duel.command(0,{type:'fire',weapon,turnId:0});
        if(weapon!=='screw'){
          const timer=duel.turnTimer;
          if(duel.command(1,{type:'fire',weapon:'screw',turnId:1}))throw new Error('Se disparó durante la resolución');
          duel.step();
          if(duel.turnTimer!==timer)throw new Error('El reloj corre durante el vuelo');
          for(let i=0;i<20&&duel.resolving;i++)duel.step();
        }else if(duel.players[0].health!==100)throw new Error('El tornillo daña al tirador en la boca del arma');
        if(duel.players[1].health!==100-DAMAGE[weapon].maximum)throw new Error('Daño directo incorrecto: '+weapon);
      }
      const lethal=makeDuel();lethal.players[1].health=40;
      lethal.command(0,{type:'fire',weapon:'bazooka',turnId:0});
      for(let i=0;i<20&&!lethal.gameOver;i++)lethal.step();
      if(!lethal.gameOver||lethal.winner!==0||lethal.players[1].alive||lethal.players[1].health!==0)
        throw new Error('No se registra la eliminación y victoria');
      if(!lethal.players[1].death||lethal.players[1].death.kind!=='impact')throw new Error('No se registra la tumba del impacto');
      if(lethal.command(0,{type:'fire',weapon:'screw',turnId:lethal.turnId}))throw new Error('Se puede disparar después de ganar');
      const frozen=JSON.stringify(lethal.snapshot());lethal.step();
      if(JSON.stringify(lethal.snapshot())!==frozen)throw new Error('La partida terminada sigue simulándose');
      const copy=makeDuel();copy.restore(lethal.snapshot());
      if(JSON.stringify(copy.snapshot())!==JSON.stringify(lethal.snapshot()))throw new Error('Vida o resultado no se replican');
      if(makeDuel().players.some(p=>p.health!==100||!p.alive))throw new Error('El reinicio no restaura la vida');
      const falling=makeDuel();falling.players[1].y=800;falling.step();
      if(!falling.gameOver||falling.winner!==0)throw new Error('La caída no elimina');
      if(falling.players[1].death.kind!=='fall'||!falling.players[1].lastGrounded)throw new Error('La caída pierde la posición de la tumba');
      const draw=makeDuel();draw.players.forEach(p=>p.y=800);draw.step();
      if(!draw.gameOver||draw.winner!==null)throw new Error('No se registra el empate');
      return {initial,denied,destroyed,fired,moved,stale,same,replica,pristine,gap,bridge,transparentSky,islandSolid,degenerate,turn:clock.currentTurn};
    });
    assert.deepEqual(result,{initial:true,denied:false,destroyed:true,fired:true,moved:true,stale:false,same:true,replica:true,pristine:true,gap:true,bridge:true,transparentSky:true,islandSolid:true,degenerate:true,turn:1});
    await page.screenshot({path:'tests/preview.png'});
    await page.evaluate(async()=>{
      const {createGame}=await import('/src/engine/game.js');const {LEVELS}=await import('/src/levels/index.js');
      const {bindResults,resultPresentation}=await import('/src/ui/results.js');
      const source=document.createElement('canvas');source.width=1280;source.height=720;source.getContext('2d').fillRect(0,300,1280,420);
      const game=createGame(LEVELS.crab,source);Object.assign(game.players[0],{x:300,y:287,angle:0});Object.assign(game.players[1],{x:400,y:287,health:35});
      game.command(0,{type:'fire',weapon:'screw',turnId:0});
      if(resultPresentation(game,'ai',0).kind!=='win'||resultPresentation(game,'pvp',1).kind!=='lose'||resultPresentation(game,'local',0).title!=='¡Victoria azul!')throw new Error('Resultado incorrecto según perspectiva');
      const draw={...game,winner:null};if(resultPresentation(draw,'ai',0).kind!=='draw')throw new Error('Empate incorrecto');
      window.resultFixture=bindResults({onMenu:()=>window.resultFixture.hide(),onRestart:()=>window.resultFixture.hide()});
      window.resultGame=game;window.resultFixture.update(game,0,{playing:true,mode:'ai',localIndex:0});
      window.resultFixture.update(game,1200,{playing:true,mode:'ai',localIndex:0});
    });
    assert.equal(await page.locator('#resultTitle').textContent(),'¡Ganaste!');
    await page.screenshot({path:'tests/result-win.png'});
    await page.locator('#resultMenu').click();
    await page.evaluate(()=>{
      window.resultFixture.update(window.resultGame,0,{playing:true,mode:'pvp',localIndex:1,canRestart:false});
      window.resultFixture.update(window.resultGame,1200,{playing:true,mode:'pvp',localIndex:1,canRestart:false});
    });
    assert.equal(await page.locator('#resultTitle').textContent(),'Esta vez no…');
    assert.equal(await page.locator('#resultRestart').isHidden(),true);
    await page.screenshot({path:'tests/result-lose.png'});
    await page.locator('#resultMenu').click();
    await page.locator('#startGame').click();
    await wait(page,()=>!document.getElementById('fireBtn').disabled);
    // Real pointer capture: the handle follows the drag, aim points away from it.
    await page.evaluate(async()=>{
      const {bindInput}=await import('/src/ui/input.js');
      const canvas=document.createElement('canvas');canvas.id='aim-test';canvas.width=1280;canvas.height=720;
      canvas.style.cssText='position:fixed;left:0;top:0;width:1280px;height:720px;z-index:999;background:#181926';
      document.body.append(canvas);
      const p={x:500,y:300,angle:0,pivotOffset:45,pivotRadius:16};
      window.aimTest={turnId:0,currentTurn:0,players:[p],projectiles:[],level:{width:1280,height:720}};
      const {createCamera}=await import('/src/ui/camera.js');
      window.aimCamera=createCamera();window.aimCamera.resize(1280,720);
      window.aimCamera.update(window.aimTest,1/60);window.aimCamera.zoom=2;window.aimCamera.x=500;window.aimCamera.y=300;
      bindInput(canvas,{getGame:()=>window.aimTest,getCamera:()=>window.aimCamera,canControl:()=>true,send:command=>{if(command.type==='aim')p.angle=command.angle;}});
    });
    await page.mouse.move(550,360);await page.mouse.down();
    await page.mouse.move(490,460,{steps:5});
    let aim=await page.evaluate(async()=>{
      const {getPivotCoords}=await import('/src/ui/renderer.js');const p=window.aimTest.players[0];
      return {angle:p.angle,pivot:getPivotCoords(p)};
    });
    assert.ok(Math.abs(aim.angle-Math.atan2(-50,75))<1e-6);
    assert.ok(aim.pivot.x<500&&aim.pivot.y>300);
    await page.mouse.move(790,260,{steps:5});
    aim=await page.evaluate(()=>window.aimTest.players[0].angle);
    assert.ok(Math.abs(aim-Math.atan2(50,-75))<1e-6);
    await page.mouse.up();
    await page.evaluate(()=>document.getElementById('aim-test').remove());
    await page.locator('#optionsToggle').click();await page.locator('#backToMenu').click();
    await page.selectOption('#mode','ai');
    await wait(page,()=>document.getElementById('status').textContent.includes('Contra la computadora'));
    assert.equal(await page.locator('#difficulty').inputValue(),'easy');
    assert.equal(await page.locator('#difficultyLabel').isVisible(),true);
    await page.selectOption('#difficulty','normal');
    assert.equal(await page.evaluate(()=>localStorage.getItem('bftma.aiDifficulty')),'normal');
    await page.selectOption('#difficulty','easy');
    await page.locator('#startGame').click();
    await page.locator('#weaponToggle').click();await page.locator('[data-weapon="screw"]').click();
    await page.locator('#fireBtn').click();
    await wait(page,()=>document.getElementById('turnBadge').textContent.startsWith('IA'));
    assert.equal(await page.locator('#fireBtn').isDisabled(),true);
    await wait(page,()=>document.getElementById('turnBadge').textContent.includes('Resolviendo')||document.getElementById('turnBadge').textContent.startsWith('P1')||document.getElementById('turnBadge').textContent.includes('Gana'));
    await page.locator('#optionsToggle').click();await page.locator('#backToMenu').click();
    await page.selectOption('#mode','local');
    assert.equal(await page.locator('#difficultyLabel').isHidden(),true);
    await wait(page,()=>document.getElementById('status').textContent==='Partida local');
    await page.setViewportSize({width:390,height:844});
    await page.locator('[data-setup-tab="character"]').click();
    assert.equal(await page.locator('#styleName').isVisible(),true);
    await page.locator('[data-setup-tab="arsenal"]').click();
    assert.equal(await page.locator('.arsenal-showcase').isVisible(),true);
    await page.locator('[data-setup-tab="play"]').click();
    assert.equal(await page.locator('#levelCards').isVisible(),true);
    await page.locator('[data-level-card="ship"]').click();
    await wait(page,()=>document.getElementById('level').value==='ship'&&!document.getElementById('startGame').disabled);
    await page.screenshot({path:'tests/menu-refresh-mobile.png'});
    await page.setViewportSize({width:1280,height:720});
    assert.deepEqual(errors,[]);
    // Exercise the real PvP adapter and app in two tabs, replacing only the
    // external WebRTC transport with a deterministic BroadcastChannel transport.
    const context=await browser.newContext();
    context.setDefaultTimeout(10000);
    context.setDefaultNavigationTimeout(30000);
    await context.route('https://esm.run/trystero@0.26.0',route=>route.fulfill({contentType:'text/javascript',body:`
      export const selfId=crypto.randomUUID();
      export function joinRoom(config,name){
        const channel=new BroadcastChannel(config.appId+name),actions=new Map(),peers=new Set();
        const room={makeAction(name){const action={send(data,options={}){if(name==='state')window.pvpTestState=data.state;channel.postMessage({type:'action',name,data,target:options.target,id:selfId});}};actions.set(name,action);return action;},leave(){channel.postMessage({type:'leave',id:selfId});channel.close();}};
        channel.onmessage=({data:m})=>{
          if(m.id===selfId)return;
          if(m.type==='leave'){room.onPeerLeave?.(m.id);return;}
          if(m.type==='join'||m.type==='ack'){
            if(!peers.has(m.id)){peers.add(m.id);room.onPeerJoin?.(m.id);}
            if(m.type==='join')channel.postMessage({type:'ack',id:selfId});
          }else if(m.type==='action'&&(!m.target||m.target===selfId))actions.get(m.name)?.onMessage?.(m.data,{peerId:m.id});
        };
        channel.postMessage({type:'join',id:selfId});return room;
      }
    `}));
    const a=await context.newPage(),b=await context.newPage();
    a.on('pageerror',e=>errors.push(e.message));b.on('pageerror',e=>errors.push(e.message));
    await Promise.all([a.goto('http://localhost:8080/?mode=pvp'),b.goto('http://localhost:8080/?mode=pvp')]);
    await Promise.all([wait(a,()=>document.getElementById('status').textContent.includes('Entra')),wait(b,()=>document.getElementById('status').textContent.includes('Entra'))]);
    for(const [tab,accessory,nickname] of [[a,'helmet','Azulito'],[b,'wig','Pelucas']]){
      await tab.locator('#styleToggle').evaluate(button=>button.click());
      await tab.selectOption('#styleAccessory',accessory);
      await tab.locator('#styleName').fill(nickname);
      await tab.selectOption('#level','islands');
      await wait(tab,()=>!document.getElementById('connect').disabled);
    }
    await a.locator('#connect').evaluate(button=>button.click());await b.locator('#connect').evaluate(button=>button.click());
    await Promise.all([wait(a,()=>document.getElementById('status').textContent.includes('Conectado')),wait(b,()=>document.getElementById('status').textContent.includes('Conectado'))]);
    const host=(await a.locator('#status').textContent()).includes('anfitrión')?a:b;
    const guest=host===a?b:a;
    assert.equal(await host.locator('#level').isDisabled(),false);
    await wait(host,()=>window.pvpTestState?.players.every(p=>p.appearance.nickname));
    const expectedHost=host===a?'Azulito':'Pelucas',expectedGuest=host===a?'Pelucas':'Azulito';
    assert.equal(await host.evaluate(()=>window.pvpTestState.players[0].appearance.nickname),expectedHost);
    assert.equal(await host.evaluate(()=>window.pvpTestState.players[1].appearance.nickname),expectedGuest);
    await wait(guest,()=>document.getElementById('level').value==='islands');
    await wait(host,()=>window.pvpTestState?.levelId==='islands'&&window.pvpTestState.players.every(p=>p.appearance.nickname));
    assert.equal(await host.evaluate(()=>window.pvpTestState.players[1].appearance.nickname),expectedGuest);
    assert.equal(await guest.locator('#level').isDisabled(),true);
    await host.locator('#fireBtn').evaluate(button=>button.click());
    await wait(guest,()=>!document.getElementById('fireBtn').disabled);
    await guest.locator('#fireBtn').evaluate(button=>button.click());
    await wait(host,()=>!document.getElementById('fireBtn').disabled);
    await host.locator('#reset').evaluate(button=>button.click());
    await wait(guest,()=>document.getElementById('turnBadge').textContent.startsWith('P1'));
    await guest.locator('#backToMenu').evaluate(button=>button.click());
    try {await wait(host,()=>document.getElementById('status').textContent.includes('desconectado'));}
    catch(error){console.log('PvP disconnect diagnostics',{host:await host.locator('#status').textContent(),guest:await guest.locator('#status').textContent(),errors});throw error;}
    assert.deepEqual(errors,[]);
    assert.equal(await guest.locator('#mainMenu').isVisible(),true);
    assert.equal(await host.locator('#mainMenu').isVisible(),true);
    await context.close();
  }finally{await browser?.close();server.kill();}
});
