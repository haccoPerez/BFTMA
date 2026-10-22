import {LEVELS} from '../levels/index.js';
export const HARBOR_BACKGROUND=new URL('../../assets/backgrounds/puerto-tampico.png',import.meta.url).href;
const backgrounds=new Map();
export async function loadScenery(){
  const urls=new Set([HARBOR_BACKGROUND,...Object.values(LEVELS).map(level=>level.scenery?.background).filter(Boolean)]);
  await Promise.all([...urls].map(async url=>{
    if(backgrounds.has(url))return;
    const image=new Image();
    await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(new Error('No se pudo cargar el fondo: '+url));image.src=url;});
    backgrounds.set(url,image);
  }));
}
export function drawBackground(ctx,width,height,level=null){
  ctx.fillStyle='#8dcbd2';ctx.fillRect(0,0,width,height);
  const background=backgrounds.get(level?.scenery?.background||HARBOR_BACKGROUND);
  if(!background)return;
  const scale=Math.max(width/background.width,height/background.height);
  const w=background.width*scale,h=background.height*scale;
  ctx.drawImage(background,(width-w)/2,(height-h)/2,w,h);
}
// Pure foreground rendering: never touches terrain pixels, damage or collision.
export function drawWater(ctx,level,time){
  const y=level.scenery?.waterY;if(!Number.isFinite(y))return;
  const gradient=ctx.createLinearGradient(0,y,0,level.height+250);
  gradient.addColorStop(0,'rgba(36,169,183,.82)');gradient.addColorStop(1,'#104775');
  ctx.beginPath();ctx.moveTo(-100,y);
  for(let x=-100;x<=level.width+120;x+=12)ctx.lineTo(x,y+Math.sin(x/65+time*.0015)*3);
  ctx.lineTo(level.width+120,level.height+400);ctx.lineTo(-100,level.height+400);ctx.closePath();ctx.fillStyle=gradient;ctx.fill();
  ctx.strokeStyle='rgba(182,246,241,.75)';ctx.lineWidth=2;ctx.beginPath();
  for(let x=-100;x<=level.width+120;x+=12){const wave=y+Math.sin(x/65+time*.0015)*3;if(x===-100)ctx.moveTo(x,wave);else ctx.lineTo(x,wave);}
  ctx.stroke();
  ctx.strokeStyle='rgba(173,236,232,.25)';
  for(let row=0;row<4;row++)for(let x=25;x<level.width;x+=130){
    const offset=Math.sin(time*.0005+row)*15;
    ctx.beginPath();ctx.moveTo(x+offset,y+22+row*25);ctx.lineTo(x+55+offset,y+22+row*25);ctx.stroke();
  }
}
