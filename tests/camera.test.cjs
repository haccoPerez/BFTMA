const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const cameraModule=import('data:text/javascript;base64,'+fs.readFileSync(path.join(__dirname,'../src/ui/camera.js')).toString('base64'));
const makeScene=()=>({level:{width:1920,height:1080},turnId:0,currentTurn:0,
  players:[{x:650,y:400,angle:0},{x:1500,y:400,angle:Math.PI}],projectiles:[],terrain:{operations:[]}});

test('shot stays in a stable window; speed reversal does not flip the camera',async()=>{
  const {createCamera}=await cameraModule,camera=createCamera(),scene=makeScene();
  camera.resize(390,844);camera.update(scene,1/60);
  const start={x:camera.x,y:camera.y,zoom:camera.zoom};
  scene.currentTurn=1;scene.turnId=1;
  scene.projectiles.push({x:start.x,y:start.y,vx:12,vy:0});camera.update(scene,1/60);
  assert.equal(camera.x,start.x);assert.equal(camera.y,start.y);
  scene.projectiles[0].x+=120;camera.update(scene,1/60);
  const before=camera.x;scene.projectiles[0].vx=-12;camera.update(scene,1/60);
  assert.ok(camera.x>=before);assert.equal(camera.zoom,start.zoom);
});
test('impact remains visible before smoothly transitioning to the next player',async()=>{
  const {createCamera}=await cameraModule,camera=createCamera(),scene=makeScene();
  camera.resize(390,844);camera.update(scene,1/60);
  scene.projectiles.push({x:900,y:350,vx:12});scene.currentTurn=1;scene.turnId=1;
  camera.update(scene,1/60);scene.projectiles.length=0;scene.terrain.operations.push({});
  const impact={x:camera.x,y:camera.y,zoom:camera.zoom};
  for(let i=0;i<40;i++)camera.update(scene,1/60);
  assert.equal(camera.x,impact.x);assert.equal(camera.y,impact.y);
  for(let i=0;i<40;i++)camera.update(scene,1/60);
  assert.ok(camera.x>impact.x);assert.ok(camera.x<scene.players[1].x);
  assert.equal(camera.zoom,impact.zoom);
});
test('manual camera is not overridden by projectile or turn changes',async()=>{
  const {createCamera}=await cameraModule,camera=createCamera(),scene=makeScene();
  camera.resize(390,844);camera.update(scene,1/60);camera.pan(20,0);
  const before=camera.x;scene.projectiles.push({x:1000,y:350,vx:12});scene.currentTurn=1;scene.turnId=1;
  camera.update(scene,1/60);assert.equal(camera.following,false);assert.equal(camera.x,before);
  camera.resume();camera.update(scene,1/60);assert.equal(camera.following,true);
});
test('moving shots stay in view on a narrow screen without changing zoom',async()=>{
  const {createCamera}=await cameraModule,camera=createCamera(),scene=makeScene();
  camera.resize(390,844);camera.update(scene,1/60);
  const zoom=camera.zoom;scene.projectiles.push({x:650,y:400,vx:12});
  for(let i=0;i<45;i++){
    const shot=scene.projectiles[0];shot.x+=12;camera.update(scene,1/60);
    const position=camera.worldToScreen(shot.x,shot.y);
    assert.ok(position.x>=0&&position.x<=390);assert.equal(camera.zoom,zoom);
  }
});

test('air support frames the map and high aircraft until all bombs resolve, then restores zoom',async()=>{
  const {createCamera}=await cameraModule,camera=createCamera(),scene=makeScene();
  camera.resize(844,390);camera.update(scene,1/60);const previous=camera.zoom;
  scene.aircraft=[{x:960,y:-180}];
  // The application measures the canvas every frame, including during the overview.
  for(let i=0;i<100;i++){camera.resize(844,390);camera.update(scene,1/60);}
  for(const point of [{x:0,y:0},{x:1920,y:1080},{x:960,y:-260}]){
    const screen=camera.worldToScreen(point.x,point.y);assert.ok(screen.x>=0&&screen.x<=844&&screen.y>=0&&screen.y<=390);
  }
  const overview=camera.zoom;assert.ok(overview<previous);
  scene.aircraft=[];scene.projectiles=[{type:'airstrike',x:1500,y:700}];
  for(let i=0;i<60;i++)camera.update(scene,1/60);
  assert.ok(Math.abs(camera.zoom-overview)<.001);
  scene.projectiles=[];scene.currentTurn=1;
  for(let i=0;i<30;i++)camera.update(scene,1/60);
  assert.ok(Math.abs(camera.zoom-overview)<.001,'Overview ends before impacts settle');
  for(let i=0;i<180;i++)camera.update(scene,1/60);
  assert.equal(camera.zoom,previous);assert.equal(camera.following,true);
});

test('manual camera input can interrupt the automatic air-support overview',async()=>{
  const {createCamera}=await cameraModule,camera=createCamera(),scene=makeScene();
  camera.resize(844,390);camera.update(scene,1/60);scene.aircraft=[{x:960,y:-180}];
  for(let i=0;i<60;i++)camera.update(scene,1/60);
  camera.zoomAt(1.5);const manualZoom=camera.zoom;
  for(let i=0;i<60;i++)camera.update(scene,1/60);
  assert.equal(camera.zoom,manualZoom);
  scene.aircraft=[];for(let i=0;i<180;i++)camera.update(scene,1/60);
  assert.equal(camera.zoom,manualZoom);assert.equal(camera.following,false);
});

test('orbital camera ascends to space, returns to the marked target and restores the previous zoom',async()=>{
  const {createCamera}=await cameraModule,camera=createCamera(),scene=makeScene();
  camera.resize(844,390);camera.update(scene,1/60);const zoom=camera.zoom;
  scene.orbital={strike:{x:1500,y:400,age:0}};
  for(let age=0;age<=180;age++){
    scene.orbital.strike.age=age;camera.resize(844,390);camera.update(scene,1/60);
    if(age===100)assert.equal(camera.y,-2200);
  }
  const target=camera.worldToScreen(1500,400);assert.ok(target.x>=0&&target.x<=844&&target.y>=0&&target.y<=390);
  scene.orbital.strike=null;
  for(let i=0;i<180;i++){camera.resize(844,390);camera.update(scene,1/60);}
  assert.equal(camera.following,true);assert.equal(camera.zoom,zoom);
});
