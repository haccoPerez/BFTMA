import {getSpriteFrame} from './characters.js';
import {ARSENAL} from '../engine/arsenal.js';
import {loadWeaponArt} from './weapon-art.js';
import {drawOrbitalIcon,loadOrbitalArt} from './orbital-art.js';
const sprites=new Map(),seenShots=new WeakMap();
export async function loadCombatArt(){
  await loadOrbitalArt();
  const image=new Image();
  await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(new Error('No se pudo cargar el arte de combate'));image.src=new URL('../../assets/effects/combat-atlas.png',import.meta.url).href;});
  const split=Math.round(image.width*.56),half=Math.floor(image.height/2);
  for(const [name,x,y,width] of [['bazooka',0,0,split],['lemon',split,0,image.width-split],['screw',0,half,split],['grave',split,half,image.width-split]])
    sprites.set(name,getSpriteFrame(image,x,y,width,half));
  for(const [id,frame] of await loadWeaponArt())sprites.set(id,frame);
  // Icons are derived from the same source rectangles as the in-world sprites.
  for(const canvas of document.querySelectorAll('[data-combat-art]')){
    const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);
    drawWeaponIcon(canvas,canvas.dataset.combatArt);
  }
}
function drawSprite(ctx,name,x,y,maxWidth,maxHeight,angle=0){
  const sprite=sprites.get(name);if(!sprite)return;
  const scale=Math.min(maxWidth/sprite.width,maxHeight/sprite.height),width=sprite.width*scale,height=sprite.height*scale;
  ctx.save();ctx.translate(x,y);ctx.rotate(angle);
  ctx.drawImage(sprite.image,sprite.x,sprite.y,sprite.width,sprite.height,-width/2,-height/2,width,height);ctx.restore();
}
export function drawProjectile(ctx,p,time){
  if(p.type==='orbital'){
    ctx.save();ctx.translate(p.x,p.y);ctx.rotate(Math.atan2(p.vy,p.vx));ctx.fillStyle='#263e53';ctx.strokeStyle='#9cecff';ctx.lineWidth=2;
    ctx.beginPath();ctx.roundRect(-8,-5,16,10,3);ctx.fill();ctx.stroke();ctx.fillStyle='#a4f4ff';ctx.fillRect(2,-2,4,4);ctx.restore();
  }else if(p.type==='flare'){
    ctx.save();ctx.translate(p.x,p.y);ctx.rotate(Math.atan2(p.vy,p.vx));
    ctx.fillStyle='#ef564f';ctx.strokeStyle='#4f2832';ctx.lineWidth=1.5;ctx.fillRect(-7,-3,14,6);ctx.strokeRect(-7,-3,14,6);
    ctx.fillStyle='#ffe5a2';ctx.beginPath();ctx.arc(-9,0,4+Math.sin(time*.03),0,Math.PI*2);ctx.fill();ctx.restore();
  }
  else if(p.type==='disc')drawEquipment(ctx,'disc',p.x,p.y,30,30,time*.009);
  else if(['lemon','frag','gas','ice','dynamite','arrow'].includes(p.type))drawEquipment(ctx,p.type,p.x,p.y,p.type==='arrow'?34:25,p.placed?30:24,p.placed?0:Math.atan2(p.vy,p.vx));
  else if(p.type==='bazooka')drawSprite(ctx,p.type,p.x,p.y,34,18,Math.atan2(p.vy,p.vx));
  else if(['airstrike','mortar','cluster'].includes(p.type)){
    if(p.type==='cluster'&&!p.child)drawEquipment(ctx,'cluster',p.x,p.y,30,23,Math.atan2(p.vy,p.vx));
    else drawSprite(ctx,'bazooka',p.x,p.y,25,14,Math.atan2(p.vy,p.vx));
  }
  else{
    ctx.save();ctx.translate(p.x,p.y);ctx.rotate(Math.atan2(p.vy,p.vx));
    ctx.fillStyle=p.type==='fragment'?'#c7d8e0':'#ffe2a0';ctx.strokeStyle='#79532e';ctx.lineWidth=1;
    ctx.beginPath();ctx.roundRect(-6,-2,12,4,2);ctx.fill();ctx.stroke();ctx.restore();
  }
  if(p.fuse&&p.type!=='fragment'){
    const seconds=Math.max(0,(p.fuse-p.age)/60);
    ctx.save();ctx.font='bold 12px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillStyle=seconds<=1?'#9c2835':'#142737';ctx.beginPath();ctx.roundRect(p.x-23,p.y-37,46,20,6);ctx.fill();
    ctx.fillStyle='#fff7df';ctx.fillText(`${seconds.toFixed(1)} s`,p.x,p.y-27);ctx.restore();
  }
}
export function drawGraves(ctx,game){
  for(const p of game.players){
    if(p.alive||!p.death)continue;
    let x=p.death.x,bottom=p.death.y+p.radius;
    if(p.death.kind==='fall'){x=p.lastGrounded?.x??x;bottom=(p.lastGrounded?.y??game.level.height-36)+p.radius;}
    else{
      let floor=Math.max(0,Math.ceil(bottom));
      while(floor<game.level.height&&!game.terrain.isSolid(x,floor))floor++;
      if(floor<game.level.height)bottom=floor;
    }
    drawSprite(ctx,'grave',x,bottom-18,32,36);
    ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(x,bottom-36,3,0,Math.PI*2);ctx.fill();
  }
}
export function drawShotEffects(ctx,game,time){
  const shot=game.lastShot;if(!shot)return;
  let state=seenShots.get(game);
  if(!state||state.id!==shot.id){state={id:shot.id,start:time};seenShots.set(game,state);}
  const age=(time-state.start)/1000;
  if(shot.weapon==='screw'&&age<.3){
    const progress=Math.min(1,age/.24),x=shot.x+Math.cos(shot.angle)*220*progress,y=shot.y+Math.sin(shot.angle)*220*progress;
    ctx.save();ctx.globalAlpha=Math.min(1,(.3-age)*12);
    ctx.strokeStyle='#f7c36e';ctx.lineWidth=3;ctx.setLineDash([8,7]);ctx.beginPath();ctx.moveTo(shot.x,shot.y);ctx.lineTo(x,y);ctx.stroke();
    drawSprite(ctx,'screw',x,y,38,20,shot.angle);ctx.restore();
  }
}
function drawGlyph(ctx,id,x,y,width,height,angle=0){
  const color=ARSENAL[id]?.color||'#ffce81';
  ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.scale(width/64,height/44);ctx.lineWidth=3;ctx.lineJoin='round';ctx.strokeStyle='#112334';ctx.fillStyle=color;
  const rect=(x,y,w,h)=>{ctx.beginPath();ctx.rect(x,y,w,h);ctx.fill();ctx.stroke();};
  const circle=(x,y,r)=>{ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();ctx.stroke();};
  if(id==='medkit'){
    rect(-23,-14,46,31);ctx.fillStyle='#fff';rect(-5,-10,10,24);rect(-15,-3,30,10);
  }else if(id==='teleport'){
    ctx.strokeStyle=color;ctx.lineWidth=4;ctx.beginPath();ctx.ellipse(0,0,20,16,0,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.ellipse(0,0,11,9,0,0,Math.PI*2);ctx.stroke();
  }else if(id==='airstrike'){
    ctx.beginPath();ctx.moveTo(28,0);ctx.lineTo(4,-5);ctx.lineTo(-10,-20);ctx.lineTo(-19,-20);ctx.lineTo(-13,-4);ctx.lineTo(-29,-3);ctx.lineTo(-29,3);ctx.lineTo(-13,4);ctx.lineTo(-19,20);ctx.lineTo(-10,20);ctx.lineTo(4,5);ctx.closePath();ctx.fill();ctx.stroke();
  }else if(id==='punch'){
    rect(-25,-4,25,20);circle(5,-3,17);ctx.fillStyle='#9d633e';rect(-1,4,13,12);
  }else if(id==='arrow'){
    rect(-28,-2,49,4);ctx.beginPath();ctx.moveTo(30,0);ctx.lineTo(14,-9);ctx.lineTo(14,9);ctx.closePath();ctx.fill();ctx.stroke();ctx.fillStyle='#eee8dc';rect(-27,-8,10,16);
  }else if(id==='disc'||id==='mine'){
    ctx.beginPath();ctx.ellipse(0,3,25,13,0,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='#234252';circle(0,2,id==='disc'?7:5);
  }else if(id==='dynamite'){
    ctx.fillStyle='#d8564e';for(let i=0;i<3;i++)rect(-23+i*15,-12,13,28);ctx.fillStyle='#5f554b';rect(-25,0,51,7);ctx.strokeStyle='#ffcc76';ctx.beginPath();ctx.moveTo(0,-13);ctx.quadraticCurveTo(9,-25,18,-14);ctx.stroke();
  }else if(['sniper','laser','machinegun','shotgun','mortar'].includes(id)){
    rect(-20,-8,33,15);ctx.fillStyle='#cfba91';rect(-29,-3,13,14);ctx.fillStyle='#6a8490';rect(11,-5,21,7);rect(-9,7,9,13);
    if(id==='sniper'){ctx.fillStyle='#647a8a';rect(-11,-17,26,7);}
    if(id==='laser'){ctx.strokeStyle='#ff718a';ctx.beginPath();ctx.moveTo(30,-2);ctx.lineTo(40,-2);ctx.stroke();}
    if(id==='machinegun'){ctx.fillStyle='#c4ad79';rect(1,6,8,15);}
  }else{
    circle(0,2,15);ctx.fillStyle='#6f7a76';rect(-5,-19,11,8);ctx.fillStyle='#eff8d9';rect(-9,-2,18,6);
    if(id==='ice'){ctx.strokeStyle='#e3ffff';ctx.beginPath();ctx.moveTo(0,-9);ctx.lineTo(0,12);ctx.moveTo(-9,2);ctx.lineTo(9,2);ctx.stroke();}
  }
  ctx.restore();
}
export function drawWeaponIcon(canvas,weapon){
  const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);
  if(weapon==='orbital'){drawOrbitalIcon(ctx,canvas.width/2,canvas.height/2,canvas.width*.9,canvas.height*.9);return;}
  if(sprites.has('weapon:'+weapon))drawSprite(ctx,'weapon:'+weapon,canvas.width/2,canvas.height/2,canvas.width*.9,canvas.height*.9);
  else if(sprites.has(weapon))drawSprite(ctx,weapon,canvas.width/2,canvas.height/2,canvas.width*.9,canvas.height*.9);
  else drawGlyph(ctx,weapon,canvas.width/2,canvas.height/2,canvas.width*.85,canvas.height*.75);
}
export function drawEquipment(ctx,id,x,y,width,height,angle=0){
  if(id==='orbital'){drawOrbitalIcon(ctx,x,y,width,height,{angle});return;}
  if(sprites.has('weapon:'+id))drawSprite(ctx,'weapon:'+id,x,y,width,height,angle);
  else drawGlyph(ctx,id,x,y,width,height,angle);
}
