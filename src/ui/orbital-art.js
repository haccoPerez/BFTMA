const circle=(ctx,x,y,r)=>{ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();ctx.stroke();};
let satellite=null,radioSprite=null;
export async function loadOrbitalArt(){
  const load=name=>new Promise((resolve,reject)=>{
    const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(Error('No se pudo cargar '+name));
    image.src=new URL('../../assets/weapons/'+name,import.meta.url).href;
  });
  [satellite,radioSprite]=await Promise.all([load('orbital-satellite-v1.png'),load('orbital-radio-v1.png')]);
}
export function drawOrbitalIcon(ctx,x,y,width,height,{radio=false,angle=0}={}){
  if(radio&&radioSprite){
    const size=Math.min(width,height);ctx.save();ctx.translate(x,y);ctx.rotate(angle);
    ctx.drawImage(radioSprite,-size/2,-size/2,size,size);ctx.restore();return;
  }
  if(!radio&&satellite){
    ctx.save();ctx.translate(x,y);ctx.rotate(angle);
    const size=Math.min(width,height*1.6);ctx.drawImage(satellite,-size/2,-size/2,size,size);ctx.restore();return;
  }
  ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.scale(width/64,height/48);
  ctx.lineWidth=2;ctx.strokeStyle='#182a42';
  const metal=ctx.createLinearGradient(-20,-20,20,20);metal.addColorStop(0,'#e1f3fc');metal.addColorStop(.45,'#7e9bac');metal.addColorStop(1,'#30465f');
  ctx.fillStyle=metal;
  if(!radio){
    for(const side of [-1,1]){
      ctx.fillStyle='#204b80';ctx.fillRect(side<0?-31:12,-13,19,26);ctx.strokeRect(side<0?-31:12,-13,19,26);
      ctx.strokeStyle='#73bfe0';ctx.lineWidth=.7;
      for(let i=1;i<4;i++){const left=side<0?-31:12;ctx.beginPath();ctx.moveTo(left+i*4.7,-13);ctx.lineTo(left+i*4.7,13);ctx.moveTo(left,-13+i*6.5);ctx.lineTo(left+19,-13+i*6.5);ctx.stroke();}
    }
    ctx.strokeStyle='#182a42';ctx.lineWidth=2;ctx.fillStyle=metal;ctx.beginPath();ctx.roundRect(-11,-14,22,29,5);ctx.fill();ctx.stroke();
    ctx.fillStyle='#83f4ff';circle(ctx,0,5,7);ctx.fillStyle='#eafcff';circle(ctx,0,5,3);
    ctx.beginPath();ctx.moveTo(0,-14);ctx.lineTo(0,-23);ctx.stroke();
  }
  ctx.restore();
}
export function drawOrbitalWorld(ctx,game){
  for(const e of game.effects||[])if(e.kind==='orbital-fizzle'){
    const t=1-e.ttl/35;ctx.save();ctx.globalAlpha=(1-t)*.75;ctx.fillStyle='#a5a7ad';
    for(let i=0;i<7;i++){const a=i*Math.PI*2/7;ctx.beginPath();ctx.arc(e.x+Math.cos(a)*t*25,e.y+Math.sin(a)*t*15-t*14,3+t*8,0,Math.PI*2);ctx.fill();}
    ctx.restore();
  }
  for(const m of game.orbital?.markers||[]){
    ctx.save();ctx.strokeStyle=m.team===0?'#6ddcff':'#ff8b9a';ctx.lineWidth=1.5;
    if(!m.attached){ctx.globalAlpha=.22;ctx.setLineDash([5,7]);ctx.beginPath();ctx.arc(m.x,m.y,140,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;ctx.setLineDash([]);}
    ctx.fillStyle='#28394b';ctx.beginPath();ctx.roundRect(m.x-6,m.y-6,12,12,3);ctx.fill();ctx.stroke();
    ctx.fillStyle=m.attached?'#9ff7ff':'#9b9da8';circle(ctx,m.x,m.y,2.5);
    if(m.attached){ctx.beginPath();ctx.arc(m.x,m.y-3,15+Math.sin(game.tick*.08)*2,0,Math.PI*2);ctx.stroke();}
    ctx.font='bold 11px system-ui';ctx.textAlign='center';ctx.fillStyle='#fff';ctx.strokeStyle='#152333';ctx.lineWidth=3;
    const label=m.attached?'FIJADO':'EN ESPERA';ctx.strokeText(label,m.x,m.y-24);ctx.fillText(label,m.x,m.y-24);ctx.restore();
  }
  const s=game.orbital?.strike;
  if(s&&s.age>=180){
    const fade=Math.min(1,(240-s.age)/15),w=44*(.92+.08*Math.sin(s.age*1.7));
    ctx.save();ctx.globalAlpha=fade;ctx.shadowColor='#7bdfff';ctx.shadowBlur=20;
    ctx.fillStyle='#67cfff60';ctx.fillRect(s.x-w,-game.level.height*4,w*2,game.level.height*5);
    ctx.fillStyle='#80ddff';ctx.fillRect(s.x-w/2,-game.level.height*4,w,game.level.height*5);
    ctx.fillStyle='#f1fdff';ctx.fillRect(s.x-w*.22,-game.level.height*4,w*.44,game.level.height*5);
    ctx.shadowBlur=0;ctx.strokeStyle='#e4fbff';ctx.lineWidth=3;
    for(let i=0;i<5;i++){ctx.beginPath();ctx.ellipse(s.x,s.y+8,18+(s.age-180)*1.6+i*9,6+i*3,0,0,Math.PI*2);ctx.stroke();}
    ctx.restore();
  }
}
export function drawOrbitalCinematic(ctx,game,width,height){
  const s=game.orbital?.strike;if(!s||s.age>=180)return;
  const reduced=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const alpha=s.age<45?s.age/45:s.age<150?1:Math.max(0,1-(s.age-150)/30);
  ctx.save();ctx.globalAlpha=alpha;
  const sky=ctx.createLinearGradient(0,0,0,height);sky.addColorStop(0,'#020611');sky.addColorStop(1,'#10274a');ctx.fillStyle=sky;ctx.fillRect(0,0,width,height);
  for(let i=0;i<80;i++){
    const x=(i*167.37)%width,y=((i*97.13)+(reduced?0:s.age*(s.age<45?8:s.age>=150?-16:.05)))%height;
    ctx.fillStyle=i%3?'#c8e9ff':'#fff';ctx.fillRect(x,(y+height)%height,1.5,s.age<45&&!reduced?12:1.5);
  }
  const scale=Math.min(width/700,height/340),cx=width*.5,cy=height*.43;
  ctx.save();ctx.translate(cx,cy);ctx.scale(scale,scale);ctx.rotate(reduced?-.15:-.45+Math.min(s.age,150)*.005);
  drawOrbitalIcon(ctx,0,0,330,250);
  const charge=Math.max(0,Math.min(1,(s.age-45)/105));
  if(charge){
    // Light gathers at the lens, then converging particles feed a white-hot core.
    ctx.globalCompositeOperation='lighter';
    const radius=8+charge*48,pulse=reduced?1:1+Math.sin(s.age*.3)*.06;
    const glow=ctx.createRadialGradient(0,0,0,0,0,radius*2.2);
    glow.addColorStop(0,'#f4feff');glow.addColorStop(.18,'#b7f8ff');glow.addColorStop(.48,`rgba(67,211,255,${.2+charge*.5})`);glow.addColorStop(1,'rgba(34,145,255,0)');
    ctx.fillStyle=glow;ctx.beginPath();ctx.arc(0,0,radius*2.2*pulse,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle=`rgba(140,239,255,${charge*.7})`;ctx.lineWidth=1.5;
    for(let i=0;i<12;i++){
      const phase=reduced ? .5 : ((s.age*.024+i/12)%1),distance=12+(1-phase)*(65+charge*32),a=i*2.399+(reduced?0:s.age*.009);
      const x=Math.cos(a)*distance,y=Math.sin(a)*distance;
      ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x*.84,y*.84);ctx.stroke();
      ctx.fillStyle='#c8faff';ctx.beginPath();ctx.arc(x,y,1+charge*2,0,Math.PI*2);ctx.fill();
    }
    ctx.strokeStyle='#b4f7ff';ctx.globalAlpha=alpha*charge*.8;ctx.lineWidth=1+charge*2;
    ctx.beginPath();ctx.arc(0,0,radius*(1.3-charge*.35),0,Math.PI*2);ctx.stroke();
    ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(0,0,(3+charge*17)*pulse,0,Math.PI*2);ctx.fill();
    ctx.globalCompositeOperation='source-over';
  }
  ctx.restore();
  ctx.fillStyle='#e3f9ff';ctx.textAlign='center';ctx.font='bold 16px system-ui';
  ctx.fillText(s.age<45?'ENLACE ORBITAL':s.age<150?'CONCENTRANDO ENERGÍA':'DESCARGA ORBITAL',width/2,height*.84);
  ctx.restore();
}
