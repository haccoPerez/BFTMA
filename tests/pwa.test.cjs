const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const http=require('node:http');
const path=require('node:path');
const {createRequire}=require('node:module');
const runtime=process.env.BFTMA_NODE_MODULES?createRequire(path.join(process.env.BFTMA_NODE_MODULES,'__pwa.cjs')):createRequire(path.resolve(__dirname,'../tools/package.json'));
const {chromium}=runtime('playwright');

test('PWA installs under a repository path and runs offline in landscape',async()=>{
  const root=path.resolve(__dirname,'..');
  const prefix='/bftma-test/';
  const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webmanifest':'application/manifest+json'};
  const server=http.createServer(async(req,res)=>{
    const url=new URL(req.url,'http://localhost');
    if(!url.pathname.startsWith(prefix)){res.writeHead(404).end();return;}
    const relative=decodeURIComponent(url.pathname.slice(prefix.length))||'index.html';
    const target=path.resolve(root,relative);
    if(!target.startsWith(root+path.sep)){res.writeHead(403).end();return;}
    try{const data=await fs.readFile(target);res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream'}).end(data);}
    catch{res.writeHead(404).end();}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let browser;
  try{
    browser=await chromium.launch({headless:true,...(process.env.BFTMA_BROWSER_CHANNEL?{channel:process.env.BFTMA_BROWSER_CHANNEL}:{})});
    const context=await browser.newContext({viewport:{width:667,height:375}});
    const page=await context.newPage();
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    const base=`http://127.0.0.1:${server.address().port}${prefix}`;
    await page.goto(base);
    await page.waitForFunction(()=>!document.getElementById('startGame').disabled);
    await page.waitForFunction(()=>!!navigator.serviceWorker.controller,null,{timeout:45000});
    const manifest=await page.evaluate(async()=>await(await fetch(document.querySelector('link[rel="manifest"]').href)).json());
    assert.equal(manifest.scope,'./');assert.equal(manifest.start_url,'./index.html');
    assert.equal(manifest.orientation,'landscape');assert.equal(manifest.display,'fullscreen');
    for(const icon of manifest.icons){
      const size=await page.evaluate(async src=>{const im=new Image();im.src=new URL(src,location.href);await im.decode();return `${im.width}x${im.height}`;},icon.src);
      assert.equal(size,icon.sizes);
    }
    const nav=await page.locator('.setup-nav').boundingBox();
    const controls=await page.locator('.app-actions').boundingBox();
    assert.ok(controls.x+controls.width<=nav.x,'Install/fullscreen controls overlap the navigation');
    await page.locator('#installApp').click();
    assert.equal(await page.locator('#installHelp').evaluate(el=>el.open),true);
    await page.locator('#closeInstallHelp').click();
    await page.locator('#menuFullscreen').click();
    await page.waitForFunction(()=>!!document.fullscreenElement);
    await page.locator('#menuFullscreen').click();
    await page.waitForFunction(()=>!document.fullscreenElement);
    await context.setOffline(true);
    await page.reload();
    await page.waitForFunction(()=>!document.getElementById('startGame').disabled);
    for(const id of ['kiosco','canseco','escolleras']){
      await page.locator(`[data-level-card="${id}"]`).click();
      await page.waitForFunction(()=>!document.getElementById('startGame').disabled);
      assert.equal(await page.locator('#level').inputValue(),id);
      const loaded=await page.evaluate(async()=>{
        const {LEVELS,loadLevelSource}=await import('./src/levels/index.js');
        const level=LEVELS[document.getElementById('level').value];
        const terrain=await loadLevelSource(level),background=new Image();background.src=level.scenery.background;await background.decode();
        return terrain.naturalWidth>0&&background.naturalWidth>0;
      });
      assert.ok(loaded,'Landmark resources unavailable offline: '+id);
    }
    await page.locator('#startGame').click();
    await page.waitForFunction(()=>document.body.dataset.screen==='game'&&!document.getElementById('fireBtn').disabled);
    await page.locator('#backToMenu').evaluate(el=>el.click());
    await page.selectOption('#mode','ai');
    await page.waitForFunction(()=>!document.getElementById('startGame').disabled);
    await page.locator('#startGame').click();
    await page.waitForFunction(()=>document.body.dataset.screen==='game'&&!document.getElementById('fireBtn').disabled);
    assert.deepEqual(errors,[]);
    await context.close();
  }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
});
