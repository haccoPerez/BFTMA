import {ACCESSORIES,normalizeAppearance} from '../characters/catalog.js';
const sprites=new Map();
async function loadImage(path){
  const image=new Image();
  await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(new Error('No se pudo cargar '+path));image.src=path;});
  return image;
}
// Find alpha bounds within a sprite cell; original PNGs remain unchanged.
function frame(image,x=0,y=0,width=image.width,height=image.height){
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,x,y,width,height,0,0,width,height);
  const data=ctx.getImageData(0,0,width,height).data;
  let left=width,top=height,right=-1,bottom=-1;
  for(let iy=0;iy<height;iy++)for(let ix=0;ix<width;ix++)if(data[(iy*width+ix)*4+3]>32){
    left=Math.min(left,ix);right=Math.max(right,ix);top=Math.min(top,iy);bottom=Math.max(bottom,iy);
  }
  if(right<left)throw new Error('Sprite vacío');
  return {image,x:x+left,y:y+top,width:right-left+1,height:bottom-top+1};
}
export {frame as getSpriteFrame};
export async function loadCharacterAssets(){
  const [body,accessories]=await Promise.all([
    loadImage(new URL('../../assets/characters/raccoon.png',import.meta.url).href),
    loadImage(new URL('../../assets/characters/accessories.png',import.meta.url).href)
  ]);
  sprites.set('raccoon',frame(body));
  const width=Math.floor(accessories.width/2),height=Math.floor(accessories.height/2);
  for(const [id,accessory] of Object.entries(ACCESSORIES))if(accessory.cell){
    sprites.set(id,frame(accessories,accessory.cell[0]*width,accessory.cell[1]*height,width,height));
  }
}
function drawFrame(ctx,sprite,x,y,width,height){ctx.drawImage(sprite.image,sprite.x,sprite.y,sprite.width,sprite.height,x,y,width,height);}
export function drawCharacter(ctx,player){
  const appearance=normalizeAppearance(player.appearance),body=sprites.get('raccoon');
  ctx.save();ctx.translate(player.x,player.y);
  // Team identity stays visible even when two players choose identical cosmetics.
  ctx.strokeStyle=player.color;ctx.lineWidth=3;
  ctx.beginPath();ctx.ellipse(0,player.radius+2,19,5,0,0,Math.PI*2);ctx.stroke();
  if(Math.cos(player.angle)<0)ctx.scale(-1,1);
  if(player.hurtTimer>0)ctx.globalAlpha=.6;
  if(body){
    const height=46,width=height*body.width/body.height;
    const accessory=ACCESSORIES[appearance.accessory],sprite=sprites.get(appearance.accessory);
    const drawAccessory=()=>{
      const accessoryHeight=accessory.width*sprite.height/sprite.width;
      drawFrame(ctx,sprite,(accessory.offsetX||0)-accessory.width/2,accessory.bottom-accessoryHeight,accessory.width,accessoryHeight);
    };
    // Hat interiors are behind the skull. Only the crown/front above the
    // forehead is composited in front; the rear underside cannot cover the face.
    const layered=sprite&&Number.isFinite(accessory.frontCutoff);
    if(layered)drawAccessory();
    drawFrame(ctx,body,-width*.65,player.radius-height,width,height);
    if(sprite){
      ctx.save();
      if(layered){ctx.beginPath();ctx.rect(-100,-150,200,150+accessory.frontCutoff);ctx.clip();}
      drawAccessory();ctx.restore();
    }
  }else{
    ctx.fillStyle=player.color;ctx.beginPath();ctx.arc(0,0,player.radius,0,Math.PI*2);ctx.fill();
  }
  ctx.restore();
}
