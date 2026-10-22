// Shared by the real simulation and the computer's trajectory previews.
export const PROJECTILE_SPEED=12;
export const PROJECTILE_GRAVITY=Object.freeze({bazooka:.12,lemon:.25});
export function advanceProjectile(p,{players,terrain,width,height,explode}){
  p.age=(p.age||0)+1;p.vy+=PROJECTILE_GRAVITY[p.type]||0;
  const samples=Math.max(1,Math.ceil(Math.hypot(p.vx,p.vy))),dx=p.vx/samples,dy=p.vy/samples;
  for(let i=0;i<samples;i++){
    const x=p.x+dx,y=p.y+dy;
    const hit=players.find(player=>player.alive&&Math.hypot(player.x-x,player.y-y)<=player.radius+4);
    if(hit){explode(x,y,p.type,hit);p.alive=false;break;}
    if(terrain.isSolid(x,y)){
      if(p.type==='lemon'&&p.bounces>0){
        const n=terrain.calculateNormal(x,y),dot=p.vx*n.x+p.vy*n.y;
        p.vx=(p.vx-2*dot*n.x)*.6;p.vy=(p.vy-2*dot*n.y)*.6;
        p.x+=n.x*2;p.y+=n.y*2;p.bounces--;
      }else{explode(x,y,p.type);p.alive=false;}
      break;
    }
    p.x=x;p.y=y;
  }
  if(p.age>900||p.x<0||p.x>width||p.y < -height||p.y>height+50)p.alive=false;
}
