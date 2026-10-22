import {advanceProjectile,PROJECTILE_SPEED} from './projectiles.js';
import {DAMAGE} from './combat.js';
export const DIFFICULTIES=Object.freeze({
  easy:Object.freeze({name:'Fácil',samples:48,errorMin:0,errorMax:8,choices:3,tolerance:12,delay:1,moveTime:1,jump:true}),
  normal:Object.freeze({name:'Normal',samples:64,errorMin:0,errorMax:5,choices:2,tolerance:6,delay:.85,moveTime:1.35,jump:true}),
  hard:Object.freeze({name:'Difícil',samples:96,errorMin:0,errorMax:1.2,choices:1,tolerance:0,delay:.65,moveTime:1.5,jump:true})
});
export function applyAimError(angle,difficulty,random=Math.random){
  const rule=DIFFICULTIES[difficulty]||DIFFICULTIES.easy;
  const degrees=rule.errorMin+(rule.errorMax-rule.errorMin)*random();
  return angle+(random()<.5?-1:1)*degrees*Math.PI/180;
}

function predictedDamage(player,x,y,weapon,directHit){
  const distance=player===directHit?0:Math.max(0,Math.hypot(player.x-x,player.y-y)-player.radius);
  const rule=DAMAGE[weapon];return distance<rule.radius?Math.max(1,Math.round(rule.maximum*(1-distance/rule.radius))):0;
}
function scoreShot(game,index,weapon,angle){
  const self=game.players[index],enemy=game.players[1-index];
  const x=self.x+Math.cos(angle)*(self.radius+6),y=self.y+Math.sin(angle)*(self.radius+6);
  if(weapon==='screw'){
    const dx=Math.cos(angle)*DAMAGE.screw.range,dy=Math.sin(angle)*DAMAGE.screw.range;
    const t=Math.max(0,Math.min(1,((enemy.x-x)*dx+(enemy.y-y)*dy)/(dx*dx+dy*dy)));
    return Math.hypot(enemy.x-x-t*dx,enemy.y-y-t*dy)<=enemy.radius+DAMAGE.screw.radius?35:-100;
  }
  const shot={type:weapon,x,y,vx:Math.cos(angle)*PROJECTILE_SPEED,vy:Math.sin(angle)*PROJECTILE_SPEED,bounces:2,alive:true};
  let score=-100;
  for(let i=0;i<360&&shot.alive;i++)advanceProjectile(shot,{
    players:game.players,terrain:game.terrain,width:game.level.width,height:game.level.height,
    explode:(x,y,type,hit)=>{
      const damage=predictedDamage(enemy,x,y,type,hit),ownDamage=predictedDamage(self,x,y,type,hit);
      score=damage-ownDamage*2.5+(damage>=enemy.health?35:0)-(ownDamage>=self.health?100:0);
      // If no direct hit is possible, prefer opening terrain near the rival.
      score-=Math.hypot(enemy.x-x,enemy.y-y)*.015;
    }
  });
  return score;
}
export function chooseShot(game,index=1,{difficulty='hard',random=Math.random}={}){
  const rule=DIFFICULTIES[difficulty]||DIFFICULTIES.easy;
  const self=game.players[index],enemy=game.players[1-index];
  const candidates=[],direct=Math.atan2(enemy.y-self.y,enemy.x-self.x);
  for(const weapon of ['bazooka','lemon','screw']){
    const angles=weapon==='screw'?[direct]:[direct,...Array.from({length:rule.samples},(_,i)=>-Math.PI+i*Math.PI*2/rule.samples)];
    for(const angle of angles)candidates.push({weapon,angle,score:scoreShot(game,index,weapon,angle)});
  }
  candidates.sort((a,b)=>b.score-a.score);
  const choices=candidates.filter(shot=>shot.score>=candidates[0].score-rule.tolerance).slice(0,rule.choices);
  const selected=choices[Math.min(choices.length-1,Math.floor(random()*choices.length))];
  // Perturb AFTER evaluating trajectories; otherwise the search cancels the error.
  return {...selected,angle:applyAimError(selected.angle,difficulty,random)};
}
export function createComputerPlayer(index=1,{difficulty='easy',random=Math.random}={}){
  const rule=DIFFICULTIES[difficulty]||DIFFICULTIES.easy;
  let previousGame=null,turn=-1,elapsed=0,moved=false,movingFor=0,direction=0,stoppedAt=0;
  function command(game,value){return game.command(index,{...value,turnId:game.turnId});}
  function safeDirection(game,self,dir){
    if(!dir)return false;
    const ahead=self.x+dir*(self.radius+20);
    if(ahead<self.radius||ahead>game.level.width-self.radius)return false;
    // Check several points rather than just the destination, so narrow gaps
    // and destroyed terrain are noticed before walking over the edge.
    for(let distance=8;distance<=32;distance+=8){
      const x=self.x+dir*distance;
      if(!Array.from({length:60},(_,i)=>game.terrain.isSolid(x,self.y+self.radius+i)).some(Boolean))return false;
    }
    return true;
  }
  return {update(game,dt){
    if(game!==previousGame||game.turnId!==turn){previousGame=game;turn=game.turnId;elapsed=0;moved=false;movingFor=0;direction=0;stoppedAt=0;}
    if(game.gameOver||game.resolving||game.currentTurn!==index||!game.players[index].alive)return;
    elapsed+=dt;
    const self=game.players[index],enemy=game.players[1-index];
    // Wait briefly for gravity/knockback to settle before evaluating a shot.
    if(elapsed<rule.delay||(!movingFor&&!moved&&!self.isGrounded&&elapsed<2))return;
    if(!moved&&game.turnTimer>3){
      if(!direction){
        const toward=Math.sign(enemy.x-self.x);
        // Retreat out of splash range when too close; otherwise close distance.
        direction=Math.abs(enemy.x-self.x)<190?-toward:toward;
        if(!safeDirection(game,self,direction))direction=safeDirection(game,self,-direction)?-direction:0;
      }
      const obstacle=game.terrain.isSolid(self.x+direction*(self.radius+4),self.y);
      const ceiling=game.terrain.isSolid(self.x,self.y-self.radius-25);
      if(safeDirection(game,self,direction)&&movingFor<rule.moveTime&&(!obstacle||!ceiling)){
        command(game,{type:'input',left:direction<0,right:direction>0,jump:rule.jump&&obstacle&&self.isGrounded});
        movingFor+=dt;return;
      }
      command(game,{type:'input'});moved=true;stoppedAt=elapsed;return;
    }
    if(moved&&!self.isGrounded&&elapsed-stoppedAt<.35&&game.turnTimer>1)return;
    // Recompute after repositioning, never use an angle from the old location.
    const plan=chooseShot(game,index,{difficulty,random});
    command(game,{type:'input'});
    command(game,{type:'aim',angle:plan.angle});
    command(game,{type:'fire',weapon:plan.weapon});
  }};
}
