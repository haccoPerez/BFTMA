import {ARSENAL,weaponRule} from './arsenal.js';
import {hitsCharacter} from './combat.js';
export const PROJECTILE_SPEED=12;
export const PROJECTILE_GRAVITY=Object.freeze(Object.fromEntries(Object.entries(ARSENAL).map(([id,r])=>[id,r.gravity||0])));
export function advanceProjectile(p,{players,terrain,width,height,explode,impact,split}){
  const rule=weaponRule(p.type);
  p.age=(p.age||0)+1;
  const detonate=(x,y,hit=null)=>{p.alive=false;if(impact)impact(p,x,y,hit);else explode(x,y,p.type,hit);};
  if(p.placed){if(p.age>=p.fuse)detonate(p.x,p.y);return;}
  if(p.type==='cluster'&&!p.child&&p.age>15&&p.vy>=0&&split){p.alive=false;split(p);return;}
  if(p.fuse&&p.age>=p.fuse){detonate(p.x,p.y);return;}
  if(p.resting){if(terrain.isSolid(p.x,p.y+4))return;p.resting=false;}
  p.vy+=p.gravity??rule.gravity??0;
  const samples=Math.max(1,Math.ceil(Math.hypot(p.vx,p.vy))),dx=p.vx/samples,dy=p.vy/samples;
  for(let i=0;i<samples;i++){
    const x=p.x+dx,y=p.y+dy;
    const hit=players.find(target=>target.alive&&!(target.id===p.ownerId&&p.age<9)&&!(p.hitCooldowns?.[target.id]>p.age)&&hitsCharacter(target,x,y,p.type==='disc'?6:3));
    if(hit){
      if(p.type==='frag'){
        p.hitCooldowns??={};p.hitCooldowns[hit.id]=p.age+12;
        p.vx*=-.2;p.vy=-Math.max(1,Math.abs(p.vy)*.3);break;
      }
      if(p.type==='disc'&&p.bounces>0&&impact){
        impact(p,x,y,hit);p.hitCooldowns??={};p.hitCooldowns[hit.id]=p.age+24;
        p.vx*=-.9;p.vy=-Math.abs(p.vy)-1;p.bounces--;p.x-=dx*3;break;
      }
      detonate(x,y,hit);break;
    }
    if(terrain.isSolid(x,y)){
      if(p.bounces>0||p.type==='frag'){
        const n=terrain.calculateNormal(x,y),dot=p.vx*n.x+p.vy*n.y,damping=p.type==='disc'?.92:.6;
        p.vx=(p.vx-2*dot*n.x)*damping;p.vy=(p.vy-2*dot*n.y)*damping;
        p.x-=dx*2;p.y-=dy*2;p.x+=n.x*2;p.y+=n.y*2;p.bounces--;
        if(p.type==='frag'&&n.y<-.4&&Math.hypot(p.vx,p.vy)<1.8){p.vx=p.vy=0;p.resting=true;}
      }else detonate(x,y);
      break;
    }
    p.x=x;p.y=y;p.traveled=(p.traveled||0)+Math.hypot(dx,dy);
  }
  if(p.age>600||p.traveled>(rule.range||10000)||p.x < -80||p.x>width+80||p.y < -height||p.y>height+50)p.alive=false;
}
