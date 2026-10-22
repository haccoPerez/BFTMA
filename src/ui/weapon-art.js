// Select each connected silhouette, preserving the original atlas unchanged.
// Some diagonal icons overlap their neighbours' bounding boxes, so a plain
// rectangular crop would include pieces of the adjacent weapon.
export async function loadWeaponArt(){
  const image=new Image();
  const loaded=new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(Error('No se pudo cargar el atlas de armas'));});
  image.src=new URL('../../assets/weapons/arsenal-v1.png',import.meta.url).href;
  const [_,frames]=await Promise.all([loaded,fetch(new URL('../../assets/weapons/arsenal-v1.frames.json',import.meta.url)).then(response=>{
    if(!response.ok)throw Error('No se pudieron cargar las regiones del arsenal');return response.json();
  })]);
  const sprites=new Map();
  for(const [id,frame] of Object.entries(frames)){
    const canvas=document.createElement('canvas');canvas.width=frame.width;canvas.height=frame.height;
    const ctx=canvas.getContext('2d',{willReadFrequently:true});
    ctx.drawImage(image,frame.x,frame.y,frame.width,frame.height,0,0,frame.width,frame.height);
    const pixels=ctx.getImageData(0,0,canvas.width,canvas.height),data=pixels.data;
    const size=canvas.width*canvas.height,visited=new Uint8Array(size),queue=new Int32Array(size);
    let read=0,write=0;const seed=frame.seed[1]*canvas.width+frame.seed[0];queue[write++]=seed;visited[seed]=1;
    while(read<write){
      const index=queue[read++],x=index%canvas.width,y=Math.floor(index/canvas.width);
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
        const nx=x+dx,ny=y+dy;if(nx<0||nx>=canvas.width||ny<0||ny>=canvas.height)continue;
        const next=ny*canvas.width+nx;if(!visited[next]&&data[next*4+3]>30){visited[next]=1;queue[write++]=next;}
      }
    }
    for(let index=0;index<size;index++)if(!visited[index])data[index*4+3]=0;
    ctx.putImageData(pixels,0,0);
    sprites.set('weapon:'+id,{image:canvas,x:0,y:0,width:canvas.width,height:canvas.height});
  }
  return sprites;
}
