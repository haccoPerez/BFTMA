export const MAX_HEALTH = 100;
export const DAMAGE = Object.freeze({
  bazooka: Object.freeze({maximum:50, radius:90, crater:50,knockback:4}),
  lemon: Object.freeze({maximum:40, radius:70, crater:30,knockback:3}),
  screw: Object.freeze({maximum:35, radius:10, range:220,knockback:2.5})
});

function knockback(player,dx,dy,strength){
  if(!player.alive)return;
  const length=Math.hypot(dx,dy);
  const nx=length?dx/length:0,ny=length?dy/length:-1;
  player.vx=Math.max(-6,Math.min(6,(player.vx||0)+nx*strength));
  player.vy=Math.max(-7,Math.min(7,(player.vy||0)+Math.min(-strength*.55,ny*strength)));
  player.isGrounded=false;
}

export function damagePlayer(player, amount, cause='impact') {
  if(!player.alive || amount<=0)return;
  player.health=Math.max(0,player.health-Math.round(amount));
  player.alive=player.health>0;
  player.hurtTimer=.35;
  if(!player.alive){player.death={x:player.x,y:player.y,kind:cause};player.vx=0;player.vy=0;player.isGrounded=false;}
}

export function explosionDamage(players,x,y,weapon,directHit=null) {
  const rule=DAMAGE[weapon];
  for(const player of players){
    const distance=player===directHit?0:Math.max(0,Math.hypot(player.x-x,player.y-y)-player.radius);
    if(distance<rule.radius){
      const falloff=1-distance/rule.radius;
      damagePlayer(player,Math.max(1,Math.round(rule.maximum*falloff)));
      knockback(player,player.x-x,player.y-y,rule.knockback*falloff);
    }
  }
}

export function tunnelDamage(players,x0,y0,x1,y1) {
  const dx=x1-x0,dy=y1-y0,length=dx*dx+dy*dy;
  for(const player of players){
    const t=length?Math.max(0,Math.min(1,((player.x-x0)*dx+(player.y-y0)*dy)/length)):0;
    if(Math.hypot(player.x-(x0+t*dx),player.y-(y0+t*dy))<=player.radius+DAMAGE.screw.radius){
      damagePlayer(player,DAMAGE.screw.maximum);
      knockback(player,dx,dy,DAMAGE.screw.knockback);
    }
  }
}
