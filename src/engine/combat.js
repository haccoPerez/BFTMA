import {ARSENAL,weaponRule} from './arsenal.js';
export const MAX_HEALTH=100;
export const DAMAGE=ARSENAL;
// Matches the visible torso and head (the old circle only covered the feet).
export function characterDistance(player,x,y){
  const cy=Math.max(player.y-18,Math.min(player.y, y));
  return Math.max(0,Math.hypot(player.x-x,cy-y)-player.radius*1.25);
}
export const hitsCharacter=(player,x,y,padding=0)=>player.alive&&characterDistance(player,x,y)<=padding;
export function knockback(player,dx,dy,strength){
  if(!player.alive||!strength)return;
  const length=Math.hypot(dx,dy),nx=length?dx/length:0,ny=length?dy/length:-1;
  player.vx=Math.max(-8,Math.min(8,(player.vx||0)+nx*strength));
  player.vy=Math.max(-8,Math.min(8,(player.vy||0)+Math.min(-strength*.55,ny*strength)));
  player.isGrounded=false;
}
export function damagePlayer(player,amount,cause='impact'){
  if(!player.alive||amount<=0)return;
  player.health=Math.max(0,player.health-Math.round(amount));player.alive=player.health>0;player.hurtTimer=.35;
  if(!player.alive){player.death={x:player.x,y:player.y,kind:cause};player.vx=0;player.vy=0;player.isGrounded=false;}
}
export function explosionDamage(players,x,y,weapon,directHit=null){
  const rule=weaponRule(weapon);
  for(const p of players){
    if(!p.alive)continue;
    const distance=p===directHit?0:characterDistance(p,x,y);
    if(distance<rule.radius){const falloff=1-distance/rule.radius;damagePlayer(p,Math.max(1,Math.round(rule.maximum*falloff)));knockback(p,p.x-x,p.y-y,rule.knockback*falloff);}
  }
}
export function tunnelDamage(players,x0,y0,x1,y1,weapon='screw'){
  const rule=weaponRule(weapon),dx=x1-x0,dy=y1-y0,length=Math.hypot(dx,dy);
  for(const p of players){
    if(!p.alive)continue;
    for(let distance=0;distance<=length;distance+=3){const t=length?distance/length:0;
      if(hitsCharacter(p,x0+t*dx,y0+t*dy,rule.radius)){damagePlayer(p,rule.maximum);knockback(p,dx,dy,rule.knockback);break;}
    }
  }
}
