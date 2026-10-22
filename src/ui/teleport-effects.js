import {drawCharacter} from './characters.js';
const clamp=value=>Math.max(0,Math.min(1,value));
const smooth=value=>{const t=clamp(value);return t*t*(3-2*t);};
const random=seed=>{const value=Math.sin(seed*127.1+311.7)*43758.5453;return value-Math.floor(value);};

export function drawTeleportEffect(ctx,player,tick){
  const t=player.transit,age=Math.max(0,tick-t.start);
  const out=smooth(age/24),arrival=smooth((age-24)/(t.duration-24));
  const reduced=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  ctx.save();
  ctx.globalAlpha=age<24?1-out:arrival;
  if(!reduced){
    // Scan lines break the silhouette apart while the particles carry it away.
    const origin=age<24?{x:t.fromX,y:t.fromY}:{x:t.toX,y:t.toY};
    ctx.beginPath();
    for(let row=0;row<16;row++){
      const seed=random(row+player.id*59),visibility=age<24?1-out:arrival;
      if(seed<visibility+.12)ctx.rect(origin.x-50,origin.y-44+row*4,100,3.2);
    }
    ctx.clip();
  }
  drawCharacter(ctx,player);ctx.restore();
  const cloud=(x,y,progress,converging)=>{
    const spread=converging?1-progress:progress;
    const alpha=converging?Math.sin(Math.PI*clamp(progress)):(1-progress);
    if(alpha<=0)return;
    ctx.save();ctx.globalCompositeOperation='lighter';
    for(let i=0;i<(reduced?12:64);i++){
      const seed=i+player.id*197,rx=random(seed),ry=random(seed+101),theta=random(seed+31)*Math.PI*2;
      const radius=(12+random(seed+77)*40)*spread;
      const px=x+(rx-.5)*30+Math.cos(theta)*radius,py=y-18+(ry-.5)*42+Math.sin(theta)*radius-spread*14;
      ctx.globalAlpha=alpha*(.45+rx*.55);ctx.fillStyle=i%3===0?'#fff6cd':i%2?'#71e5ff':'#bb99ff';
      const size=1.2+random(seed+55)*2.2;ctx.fillRect(px,py,size,size);
    }
    ctx.strokeStyle='#8eeeff';ctx.globalAlpha=alpha*.8;ctx.lineWidth=2;
    ctx.beginPath();ctx.ellipse(x,y+12,20+spread*16,5+spread*3,0,0,Math.PI*2);ctx.stroke();ctx.restore();
  };
  if(age<32)cloud(t.fromX,t.fromY,clamp(age/32),false);
  if(age>=18)cloud(t.toX,t.toY,clamp((age-18)/(t.duration-18)),true);
}
