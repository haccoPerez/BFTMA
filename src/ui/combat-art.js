import {getSpriteFrame} from './characters.js';
const sprites=new Map(),seenShots=new WeakMap();
export async function loadCombatArt(){
  const image=new Image();
  await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(new Error('No se pudo cargar el arte de combate'));image.src=new URL('../../assets/effects/combat-atlas.png',import.meta.url).href;});
  const split=Math.round(image.width*.56),half=Math.floor(image.height/2);
  for(const [name,x,y,width] of [['bazooka',0,0,split],['lemon',split,0,image.width-split],['screw',0,half,split],['grave',split,half,image.width-split]])
    sprites.set(name,getSpriteFrame(image,x,y,width,half));
  // Icons are derived from the same source rectangles as the in-world sprites.
  for(const canvas of document.querySelectorAll('[data-combat-art]')){
    const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);
    drawSprite(ctx,canvas.dataset.combatArt,canvas.width/2,canvas.height/2,canvas.width*.86,canvas.height*.86);
  }
}
function drawSprite(ctx,name,x,y,maxWidth,maxHeight,angle=0){
  const sprite=sprites.get(name);if(!sprite)return;
  const scale=Math.min(maxWidth/sprite.width,maxHeight/sprite.height),width=sprite.width*scale,height=sprite.height*scale;
  ctx.save();ctx.translate(x,y);ctx.rotate(angle);
  ctx.drawImage(sprite.image,sprite.x,sprite.y,sprite.width,sprite.height,-width/2,-height/2,width,height);ctx.restore();
}
export function drawProjectile(ctx,p,time){
  if(p.type==='lemon')drawSprite(ctx,'lemon',p.x,p.y,21,24,time*.006);
  else drawSprite(ctx,p.type,p.x,p.y,34,18,Math.atan2(p.vy,p.vx));
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
export function drawWeaponIcon(canvas,weapon){const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);drawSprite(ctx,weapon,canvas.width/2,canvas.height/2,canvas.width*.9,canvas.height*.9);}
