import {drawEquipment} from './combat-art.js';
import {drawOrbitalIcon} from './orbital-art.js';
const THROWABLES=new Set(['frag','lemon','gas','disc','dynamite','mine','cluster','ice']);
const CORRECTION={bazooka:.65,sniper:.55,machinegun:.65,shotgun:.65,laser:.55,screw:.65};

export function drawHeldWeapon(ctx,p,game){
  const weapon=p.equipped||'bazooka',shot=game.lastShot;
  const age=shot?.ownerId===p.id?game.tick-shot.tick:10000;
  if(THROWABLES.has(weapon)&&game.resolving&&age>7)return;
  const firing=shot?.weapon===weapon&&age>=0&&(weapon==='machinegun'?age<32:age<9);
  const recoil=firing?Math.sin(Math.PI*(weapon==='machinegun'?(age%4)/4:age/9))*3:0;
  ctx.save();ctx.translate(p.x,p.y-10);ctx.rotate(p.angle);
  if(Math.cos(p.angle)<0)ctx.scale(1,-1);
  if(weapon==='orbital'){
    if(game.orbital?.markers.some(m=>m.team===p.team)||game.orbital?.strike?.team===p.team){
      const side=Math.cos(p.angle)<0?-1:1;
      if(side<0)ctx.scale(1,-1);ctx.rotate(-p.angle);ctx.scale(side,1);
      drawOrbitalIcon(ctx,16,-4,38,38,{radio:true});
    }else{
      ctx.fillStyle='#304858';ctx.strokeStyle='#9defff';ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(4,-6,20,12,3);ctx.fill();ctx.stroke();ctx.fillStyle='#c2f9ff';ctx.fillRect(16,-2,4,4);
    }
  }else if(weapon==='arrow'){
    const tension=firing?Math.max(0,1-age/7):.4+(p.power||1)*.6;
    ctx.strokeStyle='#72442d';ctx.lineWidth=5;ctx.lineCap='round';
    ctx.beginPath();ctx.moveTo(13,-23);ctx.bezierCurveTo(35,-10,35,10,13,23);ctx.stroke();
    ctx.strokeStyle='#e4bb78';ctx.lineWidth=2;ctx.stroke();
    ctx.strokeStyle='#f0e8c9';ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(13,-23);ctx.lineTo(12-tension*17,0);ctx.lineTo(13,23);ctx.stroke();
    if(!game.resolving)drawEquipment(ctx,'arrow',11-tension*7,0,39,10);
  }else if(weapon==='airstrike'){
    // The aircraft is the support icon; the character holds a radio, never a plane.
    ctx.rotate(-p.angle);if(Math.cos(p.angle)<0)ctx.scale(1,-1);
    ctx.translate(Math.cos(p.angle)<0?-13:13,-2);
    ctx.strokeStyle='#152833';ctx.lineWidth=2;ctx.fillStyle='#627a65';
    ctx.beginPath();ctx.roundRect(-8,-13,16,26,3);ctx.fill();ctx.stroke();
    ctx.beginPath();ctx.moveTo(4,-13);ctx.lineTo(4,-31);ctx.stroke();
    ctx.fillStyle=firing?'#ff775e':'#b7ea97';ctx.fillRect(-4,-8,8,5);
    ctx.strokeStyle='#223f3d';for(let y=1;y<=8;y+=3){ctx.beginPath();ctx.moveTo(-4,y);ctx.lineTo(4,y);ctx.stroke();}
  }else{
    ctx.save();ctx.translate(13-recoil,0);ctx.rotate(CORRECTION[weapon]||0);
    if(weapon==='bazooka')ctx.scale(-1,1);
    drawEquipment(ctx,weapon,0,0,['sniper','shotgun','machinegun','laser','bazooka'].includes(weapon)?47:28,weapon==='disc'?29:24);
    ctx.restore();
    if(firing&&['sniper','machinegun','shotgun','bazooka'].includes(weapon)){
      const length=10+(age%3)*3;ctx.fillStyle='#fff0b2';ctx.strokeStyle='#f5a34e';ctx.lineWidth=1;
      ctx.beginPath();ctx.moveTo(31,-3);ctx.lineTo(39,-8);ctx.lineTo(35,-2);ctx.lineTo(35+length,0);ctx.lineTo(35,3);ctx.lineTo(39,8);ctx.lineTo(31,3);ctx.closePath();ctx.fill();ctx.stroke();
    }
  }
  // A small foreground paw places the weapon in the character's hands.
  ctx.fillStyle='#60514b';ctx.strokeStyle='#261f29';ctx.lineWidth=1.2;ctx.beginPath();ctx.ellipse(7,6,5,4,-.2,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.restore();
}

export function drawAirSupport(ctx,game){
  for(const signal of (game.hazards||[]).filter(h=>h.type==='signal')){
    ctx.save();ctx.fillStyle='#f24e53';
    for(let i=0;i<14;i++){
      const progress=((signal.age+i*9)%120)/120;
      ctx.globalAlpha=(1-progress)*.42;
      ctx.beginPath();ctx.arc(signal.x+Math.sin(i*2.7+progress*3)*progress*28,signal.y-progress*112,8+progress*16,0,Math.PI*2);ctx.fill();
    }
    ctx.globalAlpha=1;ctx.fillStyle='#ffe2a4';ctx.fillRect(signal.x-3,signal.y-4,6,8);ctx.restore();
  }
  for(const plane of game.aircraft||[]){
    ctx.save();ctx.strokeStyle='#ffffff80';ctx.lineWidth=3;
    ctx.beginPath();ctx.moveTo(plane.x-plane.dir*35,plane.y);ctx.lineTo(plane.x-plane.dir*110,plane.y+3);ctx.stroke();
    ctx.translate(plane.x,plane.y);ctx.scale(plane.dir===1?-1:1,1);
    drawEquipment(ctx,'airstrike',0,0,150,104,.69);ctx.restore();
  }
}
