const {test}=require('node:test');
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const {createRequire}=require('node:module');
const path=require('node:path');
const runtime=createRequire(process.env.BFTMA_NODE_MODULES?path.join(process.env.BFTMA_NODE_MODULES,'__levels.cjs'):path.resolve(__dirname,'../tools/package.json'));
const {chromium}=runtime('playwright');

test('landmark maps have safe spawns, destructible alpha and independent scenery',async()=>{
  const server=spawn(process.execPath,['tools/server.cjs'],{cwd:path.resolve(__dirname,'..'),stdio:'pipe'});let browser;
  try{
    await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);server.once('exit',code=>reject(Error('Server exited '+code)));});
    browser=await chromium.launch({headless:true,...(process.env.BFTMA_BROWSER_CHANNEL?{channel:process.env.BFTMA_BROWSER_CHANNEL}:{})});
    const page=await browser.newPage({viewport:{width:960,height:540}}),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto('http://localhost:8080');await page.waitForFunction(()=>!document.getElementById('startGame').disabled);
    assert.equal(await page.locator('[data-level-card]').count(),6);
    const report=await page.evaluate(async()=>{
      const {LEVELS,loadLevelSource}=await import('/src/levels/index.js');
      const {createGame}=await import('/src/engine/game.js');
      const {renderGame}=await import('/src/ui/renderer.js');
      const {drawBackground}=await import('/src/ui/scenery.js');
      const results=[];window.landmarkFixtures={};
      for(const id of ['kiosco','canseco','escolleras']){
        const level=LEVELS[id],source=await loadLevelSource(level),game=createGame(level,source);
        for(let i=0;i<180;i++)game.step();
        const safe=game.players.every(p=>p.alive&&p.health===100&&p.isGrounded&&!game.terrain.isSolid(p.x,p.y-12));
        const transparent=!game.terrain.isSolid(10,10)&&!game.terrain.isSolid(1900,10);
        const spawns=game.players.map(p=>({x:p.x,y:p.y,team:p.team}));
        const p=game.players[0];let floorY=Math.ceil(p.y+12);
        while(floorY<level.height&&!game.terrain.isSolid(p.x,floorY))floorY++;
        const before=game.terrain.isSolid(p.x,floorY);
        game.terrain.apply({type:'circle',args:[p.x,floorY,40]});
        const destructible=before&&!game.terrain.isSolid(p.x,floorY);
        const bg=document.createElement('canvas');bg.width=96;bg.height=54;
        drawBackground(bg.getContext('2d'),96,54,level);
        const signature=bg.toDataURL();
        window.landmarkFixtures[id]={level,source,state:createGame(level,source).snapshot()};
        results.push({id,safe,transparent,destructible,spawns,signature});
      }
      window.previewLandmark=async id=>{
        const {level,source}=window.landmarkFixtures[id],game=createGame(level,source);
        for(let i=0;i<180;i++)game.step();
        let canvas=document.getElementById('landmark-preview');
        if(!canvas){canvas=document.createElement('canvas');canvas.id='landmark-preview';canvas.style.cssText='position:fixed;inset:0;width:100vw;height:100vh;z-index:1000';document.body.append(canvas);}
        canvas.width=1920;canvas.height=1080;renderGame(canvas,game);
      };
      return results;
    });
    console.log(JSON.stringify(report.map(({id,spawns})=>({id,spawns}))));
    for(const result of report){
      assert.ok(result.safe,result.id+' has unsafe spawns: '+JSON.stringify(result.spawns));
      assert.ok(result.transparent,result.id+' has solid sky');assert.ok(result.destructible,result.id+' terrain is not destructible');
      await page.evaluate(id=>window.previewLandmark(id),result.id);
      await page.screenshot({path:'tests/'+result.id+'-preview.png'});
    }
    assert.equal(new Set(report.map(r=>r.signature)).size,3,'Landmarks share a background');
    assert.deepEqual(errors,[]);
  }finally{await browser?.close();server.kill();}
});
