import {createTerrain} from './terrain.js';
import {advanceProjectile} from './projectiles.js';
import {MAX_HEALTH,damagePlayer,explosionDamage,tunnelDamage,hitsCharacter,knockback,characterDistance} from './combat.js';
import {ARSENAL,WEAPONS,weaponRule,shotSpeed,clampPower} from './arsenal.js';
import {normalizeAppearance} from '../characters/catalog.js';
import {createOrbitalSystem} from './orbital.js';
import {gasState,hasGasMask} from './gas.js';
import {firingAngle} from './aim.js';
export {WEAPONS} from './arsenal.js';
export {PROJECTILE_GRAVITY} from './projectiles.js';
export const FIXED_STEP=1/60;
export const TURN_SECONDS=20;
const clone=value=>structuredClone(value);
export function createGame(level,source,{firstTeam=0,introTicks=0,teamSize=3}={}){
 const WIDTH=level.width,HEIGHT=level.height,terrain=createTerrain(level,source);
 const {isSolid}=terrain;
 const players=[];
 for(let member=0;member<teamSize;member++)for(let team=0;team<2;team++){
   const base=level.teamSpawns?.[team]?.[member]||{x:level.spawns[team].x+(team?-1:1)*member*64,y:level.spawns[team].y};
   let spawn={...base};
   // A spawn must have ground below it, including silhouettes with holes.
   function hasFloor(x){for(let y=Math.max(0,Math.floor(base.y));y<HEIGHT;y++)if(isSolid(x,y))return true;return false;}
   if(!hasFloor(spawn.x))for(let offset=24;offset<WIDTH/2;offset+=24){const x=base.x+(team?-1:1)*offset;if(x>24&&x<WIDTH-24&&hasFloor(x)){spawn.x=x;break;}}
   while(isSolid(spawn.x,spawn.y+12)&&spawn.y>0)spawn.y--;
   players.push({...spawn,id:players.length+1,team,member,name:`P${team+1} · ${member+1}/3`,radius:12,color:team===0?'#00a2ff':'#ff3344',vx:0,vy:0,isGrounded:false,health:MAX_HEALTH,maxHealth:MAX_HEALTH,alive:true,hurtTimer:0,death:null,lastGrounded:{...spawn},appearance:normalizeAppearance(),angle:team===0?-.25:Math.PI+.25,power:1,equipped:'bazooka',grenadeFuse:2,pivotOffset:45,pivotRadius:16,bleedTurns:0,freezeTurns:0});
 }
 const projectiles=[],hazards=[],effects=[],scheduled=[],aircraft=[];
 const inputState={left:false,right:false,jump:false};
 let currentTurn=firstTeam===1?1:0,turnTimer=TURN_SECONDS,turnId=0,tick=0,intro=Math.max(0,introTicks);
 let gameOver=false,winner=null,shotId=0,lastShot=null,entityId=0,pendingShot=false,escapeTicks=0,settleTicks=0;
 let cursors=[0,0];
 const activeIndex=()=>{
   const list=players.filter(p=>p.team===currentTurn);
   for(let offset=0;offset<list.length;offset++){const p=list[(cursors[currentTurn]+offset)%list.length];if(p.alive)return players.indexOf(p);}
   return currentTurn;
 };
 const activePlayer=()=>players[activeIndex()];
 const clearInput=()=>{inputState.left=inputState.right=inputState.jump=false;};
 const effect=(kind,x,y,extra={})=>effects.push({id:++entityId,kind,x,y,ttl:40,...extra});
 const orbitalSystem=createOrbitalSystem({players,terrain,height:HEIGHT,effect}),orbital=orbitalSystem.state;
 function updateOutcome(){
   if(projectiles.length||scheduled.length||aircraft.length||orbital.strike||intro>0||players.some(p=>p.alive&&p.transit))return;
   const teams=[0,1].filter(team=>players.some(p=>p.team===team&&p.alive));
   if(teams.length<=1){gameOver=true;winner=teams.length?teams[0]:null;clearInput();}
 }
 function nextTurn(){
   updateOutcome();if(gameOver)return;
   cursors[currentTurn]=(cursors[currentTurn]+1)%teamSize;
   currentTurn=1-currentTurn;turnId++;turnTimer=TURN_SECONDS;pendingShot=false;escapeTicks=0;settleTicks=0;clearInput();
   cursors[currentTurn]=activePlayer().member;
   for(const p of players.filter(p=>p.team===currentTurn&&p.alive)){
     if(p.bleedTurns>0){damagePlayer(p,6,'bleed');p.bleedTurns--;effect('bleed',p.x,p.y-20);}
     if(p.freezeTurns>0)p.freezeTurns--;
     if(p.tremorTurns>0)p.tremorTurns--;
   }
   updateOutcome();
 }
 function carveCircle(x,y,r){if(r>0)terrain.apply({type:'circle',args:[x,y,r]});}
 function explode(x,y,weapon,directHit=null){
   const rule=weaponRule(weapon);carveCircle(x,y,rule.crater||0);explosionDamage(players,x,y,weapon,directHit);
   effect('explosion',x,y,{radius:rule.radius||25,color:rule.color||'#ffb763'});
   if(weapon==='ice')for(const p of players)if(p.alive&&characterDistance(p,x,y)<rule.radius){p.freezeTurns=3;p.tremorTurns=2;}
 }
 function spawn(weapon,x,y,angle,power,owner,extra={}){
   const rule=weaponRule(weapon),speed=shotSpeed(weapon,power);
   const p={id:++entityId,type:weapon,x,y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,ownerId:owner?.id,team:owner?.team,bounces:rule.bounces||0,fuse:rule.fuse||0,age:0,alive:true,...extra};
   projectiles.push(p);return p;
 }
 function split(p){
   effect('split',p.x,p.y,{radius:24,color:'#ffc67d'});
   // Fan out from one pivot along the flight direction. Center the impulses
   // so the group's average velocity still follows the original shot.
   const heading=Math.atan2(p.vy,p.vx),spread=.55,impulse=3.2;
   const meanForward=(1+2*Math.cos(spread)+2*Math.cos(2*spread))/5;
   for(let i=0;i<5;i++){
     const angle=(i-2)*spread,forward=impulse*(Math.cos(angle)-meanForward),side=impulse*Math.sin(angle);
     spawn('cluster',p.x,p.y,0,1,null,{child:true,ownerId:p.ownerId,team:p.team,
       vx:p.vx+Math.cos(heading)*forward-Math.sin(heading)*side,
       vy:p.vy+Math.sin(heading)*forward+Math.cos(heading)*side,
       gravity:p.gravity??weaponRule(p.type).gravity});
   }
 }
 function callAirSupport(x,y,flare){
   const dir=flare.team===1?-1:1;
   const targetX=Math.max(20,Math.min(WIDTH-20,x));
   hazards.push({id:++entityId,type:'signal',x:targetX,y,age:0,expires:turnId+1});
   // Approach from beyond the map; cruising altitude is above all terrain.
   aircraft.push({id:++entityId,x:dir===1?-1040:WIDTH+1040,y:-180,dir,speed:10,targetX,ownerId:flare.ownerId,team:flare.team,nextBomb:0,age:0});
   escapeTicks=180;turnTimer=3;clearInput();
   effect('radio',x,y,{radius:26,color:'#ff7272'});
 }
 function updateAircraft(){
   for(let i=aircraft.length-1;i>=0;i--){const plane=aircraft[i];plane.age++;plane.x+=plane.dir*plane.speed;
     while(plane.nextBomb<5){
       const x=Math.max(15,Math.min(WIDTH-15,plane.targetX+plane.dir*(plane.nextBomb-2)*65));
       if((plane.x-x)*plane.dir<0)break;
       spawn('airstrike',x,plane.y+14,Math.PI/2,1,players.find(p=>p.id===plane.ownerId),{vx:0,vy:2,gravity:.18,fuse:0});plane.nextBomb++;
     }
     if(plane.dir===1?plane.x>WIDTH+220:plane.x< -220)aircraft.splice(i,1);
   }
 }
 function impact(p,x,y,hit){
   if(p.type==='orbital'){orbitalSystem.arm(p,x,y,turnId);return;}
   if(p.type==='flare'){callAirSupport(x,y,p);return;}
   const rule=weaponRule(p.type);
   if(['sniper','machinegun','shotgun','arrow','disc'].includes(p.type)){
     if(hit){damagePlayer(hit,rule.maximum);knockback(hit,p.vx,p.vy,rule.knockback);if(p.type==='arrow'&&hit.alive)hit.bleedTurns=2;}
     carveCircle(x,y,rule.crater||0);effect('hit',x,y,{radius:hit?16:7,color:rule.color});return;
   }
   if(p.type==='gas'){
     hazards.push({id:++entityId,type:'gas',x,y,radius:gasState({age:0}).radius,team:p.team,ownerId:p.ownerId,expires:turnId+4,age:0});
     return;
   }
   explode(x,y,p.type,hit);
   if(p.type==='frag')for(let i=0;i<8;i++)spawn('fragment',x,y-4,-Math.PI+i*Math.PI/4,.8,null,{ownerId:p.ownerId,team:p.team,fuse:65,bounces:0});
 }
 function trace(p,weapon,angle=p.angle){
   const rule=weaponRule(weapon),x=p.x+Math.cos(angle)*20,y=p.y-10+Math.sin(angle)*20;
   let endX=x,endY=y;
   for(let d=0;d<=rule.range;d+=2){endX=x+Math.cos(angle)*d;endY=y+Math.sin(angle)*d;
     const hit=players.find(target=>target!==p&&hitsCharacter(target,endX,endY,1));
     if(hit){damagePlayer(hit,rule.maximum);knockback(hit,Math.cos(angle),Math.sin(angle),rule.knockback);break;}
     if(isSolid(endX,endY)||endX<0||endX>WIDTH||endY>HEIGHT)break;
   }
   effect('beam',x,y,{x1:endX,y1:endY,color:'#fff2bc',ttl:16});
 }
 function teleportTarget(p,point){
   if(!Number.isFinite(point?.x)||!Number.isFinite(point?.y))return {x:p.x,y:p.y,valid:false,reason:'Toca el mapa'};
   const target={x:point.x,y:point.y},range=ARSENAL.teleport.range;
   if(target.x<20||target.x>WIDTH-20||target.y<30||target.y>HEIGHT-15||Math.hypot(target.x-p.x,target.y-p.y)>range)
     return {...target,valid:false,reason:'Fuera de alcance'};
   const free=y=>{
     for(let dx=-14;dx<=14;dx+=4)for(let dy=-30;dy<=12;dy+=4)if(isSolid(target.x+dx,y+dy))return false;
     return !players.some(other=>other!==p&&other.alive&&Math.hypot(other.x-target.x,other.y-y)<36);
   };
   // A click on the terrain surface places the feet just above it.
   for(let dy=0;dy<=100;dy+=2){const y=target.y-dy;
     if(y>=30&&Math.hypot(target.x-p.x,y-p.y)<=range&&free(y))return {...target,y,valid:true};
   }
   return {...target,valid:false,reason:'Bloqueado'};
 }
 function updateTransit(p){
   const transit=p.transit;if(!transit)return;
   if(!p.alive){p.transit=null;return;}
   const age=tick-transit.start;
   if(age>=24&&!transit.switched){
     const target=teleportTarget(p,{x:transit.toX,y:transit.toY});
     if(target.valid){p.x=target.x;p.y=target.y;transit.toX=p.x;transit.toY=p.y;}
     else{transit.toX=p.x;transit.toY=p.y;}
     transit.switched=true;p.vx=p.vy=0;p.isGrounded=false;
   }
   if(age>=transit.duration){p.transit=null;p.isGrounded=false;}
 }
 function fireCurrent(weapon,point){
   const p=activePlayer(),rule=ARSENAL[weapon],angle=firingAngle(p,weapon,tick);
   cursors[currentTurn]=p.member;
   p.equipped=weapon;
   const startX=p.x+Math.cos(angle)*22,startY=p.y-10+Math.sin(angle)*22;
   if(rule.kind==='orbital'){
     if(orbitalSystem.markerFor(currentTurn)){if(!orbitalSystem.call(currentTurn,turnId))return false;}
     else spawn(weapon,startX,startY,angle,p.power,p);
   }else if(rule.kind==='teleport'){
     const target=teleportTarget(p,point);if(!target.valid)return false;
     p.transit={fromX:p.x,fromY:p.y,toX:target.x,toY:target.y,start:tick,duration:54,switched:false};p.vx=p.vy=0;
   }else if(rule.kind==='heal'){
     p.health=Math.min(p.maxHealth,p.health+35);effect('heal',p.x,p.y-20,{radius:30,color:'#8deaab'});
   }else if(rule.kind==='placed'){
     const side=Math.cos(angle)>=0?1:-1;
     spawn(weapon,p.x+side*26,p.y+5,0,1,p,{vx:0,vy:0,placed:true,fuse:rule.fuse});escapeTicks=rule.fuse;
   }else if(rule.kind==='mine'){
     hazards.push({id:++entityId,type:'mine',x:p.x+(Math.cos(angle)>=0?27:-27),y:p.y+7,radius:45,expires:turnId+8,age:0});escapeTicks=120;
   }else if(rule.kind==='ray')trace(p,weapon,angle);
   else if(rule.kind==='beam'||rule.kind==='tunnel'){
     const x1=startX+Math.cos(angle)*rule.range,y1=startY+Math.sin(angle)*rule.range;
     terrain.apply({type:'tunnel',args:[startX,startY,x1,y1,rule.radius]});
     tunnelDamage(players.filter(target=>target!==p),startX,startY,x1,y1,weapon);
     effect('beam',startX,startY,{x1,y1,color:rule.color,ttl:22});
   }else if(rule.kind==='melee'){
     const hit=players.filter(target=>target!==p&&target.alive&&Math.hypot(target.x-p.x,target.y-p.y)<rule.range&&Math.cos(angle)*(target.x-p.x)+Math.sin(angle)*(target.y-p.y)>0).sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))[0];
     if(hit){damagePlayer(hit,rule.maximum);knockback(hit,Math.cos(angle),-.25,rule.knockback);}
     effect('punch',startX,startY,{radius:35,color:rule.color});
   }else if(rule.kind==='airstrike'){
     spawn('flare',startX,startY,angle,p.power,p);
   }else if(rule.kind==='burst'){
     for(let i=0;i<8;i++)scheduled.push({at:tick+i*4,type:weapon,x:startX,y:startY,angle:angle+Math.sin(i*2.4)*.035,power:1,ownerId:p.id,team:p.team});
   }else if(rule.kind==='shotgun'){
     for(let i=0;i<7;i++)spawn(weapon,startX,startY,angle+(i-3)*.055,1,p);
   }else spawn(weapon,startX,startY,angle,p.power,p,weapon==='frag'?{fuse:p.grenadeFuse*60}:{});
   lastShot={id:++shotId,weapon,x:startX,y:startY,angle,power:p.power,ownerId:p.id,team:p.team,tick};
   pendingShot=true;settleTicks=30;clearInput();return true;
 }
 function updatePlayerPhysics(p,isCurrent){
   if(!p.alive||p.transit)return;
   if(isCurrent){
     const dir=Number(inputState.right)-Number(inputState.left),slow=p.freezeTurns>0?.5:1;
     if(dir){
       p.angle=Math.atan2(Math.sin(p.angle),dir*Math.abs(Math.cos(p.angle)));
       const targetX=Math.max(p.radius,Math.min(WIDTH-p.radius,p.x+dir*2*slow));
       for(let s=0;s<=6;s++)if(!isSolid(targetX,p.y-s)&&!isSolid(targetX,p.y-s-p.radius)){p.x=targetX;p.y-=s;break;}
     }
     if(inputState.jump&&p.isGrounded){p.vy=-6.5*(p.freezeTurns>0?.7:1);p.isGrounded=false;}
   }
   if(p.y>HEIGHT+60){damagePlayer(p,p.health,'fall');return;}
   const steps=Math.max(1,Math.ceil(Math.abs(p.vx)));
   for(let i=0;i<steps&&p.vx!==0;i++){
     const x=p.x+p.vx/steps,edge=x+Math.sign(p.vx)*p.radius;
     if(x<p.radius||x>WIDTH-p.radius||[0,-.65,.65].some(offset=>isSolid(edge,p.y+offset*p.radius))){p.vx=0;break;}p.x=x;
   }
   p.vx*=p.isGrounded?.78:.94;if(Math.abs(p.vx)<.05)p.vx=0;
   p.vy=Math.min(10,p.vy+.3);const n=Math.max(1,Math.ceil(Math.abs(p.vy))),dy=p.vy/n;p.isGrounded=false;
   for(let i=0;i<n;i++){
     const y=p.y+dy,edge=y+Math.sign(dy)*p.radius;
     if([0,-.65,.65].some(offset=>isSolid(p.x+offset*p.radius,edge))){p.vy=0;p.isGrounded=dy>0;break;}p.y=y;
   }
   if(p.isGrounded)p.lastGrounded={x:p.x,y:p.y};
 }
 function step(){
   if(gameOver)return;
   tick++;
   for(let i=effects.length-1;i>=0;i--)if(--effects[i].ttl<=0)effects.splice(i,1);
   const inIntro=intro>0;if(inIntro)intro--;
   const canMove=!inIntro&&(!pendingShot||escapeTicks>0);
   if(!inIntro&&!pendingShot){turnTimer-=FIXED_STEP;if(turnTimer<=0)nextTurn();}
   if(escapeTicks>0){escapeTicks--;turnTimer=escapeTicks/60;}
   const acting=activePlayer();if(!pendingShot)cursors[currentTurn]=acting.member;
   for(const p of players){updateTransit(p);p.hurtTimer=Math.max(0,p.hurtTimer-FIXED_STEP);updatePlayerPhysics(p,canMove&&p===acting);}
   if(inIntro)return;
   for(let i=scheduled.length-1;i>=0;i--)if(scheduled[i].at<=tick){const s=scheduled.splice(i,1)[0];spawn(s.type,s.x,s.y,s.angle,s.power,players.find(p=>p.id===s.ownerId));}
   updateAircraft();
   orbitalSystem.step();
   for(let i=projectiles.length-1;i>=0;i--){const p=projectiles[i];advanceProjectile(p,{players,terrain,width:WIDTH,height:HEIGHT,explode,impact,split});if(!p.alive)projectiles.splice(i,1);}
   for(let i=hazards.length-1;i>=0;i--){const h=hazards[i];h.age++;
     if(h.expires<=turnId){hazards.splice(i,1);continue;}
     if(h.type==='gas'){
       const cloud=gasState(h);h.radius=cloud.radius;
       if(h.age>=720){hazards.splice(i,1);continue;}
       if(h.age%60===0)for(const p of players)if(p.alive&&!hasGasMask(p,{projectiles,hazards})&&characterDistance(p,h.x,h.y)<h.radius)damagePlayer(p,cloud.damage,'gas');
     }
     if(h.type==='mine'&&h.age>=120&&players.some(p=>p.alive&&characterDistance(p,h.x,h.y)<45)){hazards.splice(i,1);explode(h.x,h.y,'mine');}
   }
   updateOutcome();if(gameOver)return;
   if(pendingShot&&escapeTicks===0&&projectiles.length===0&&scheduled.length===0&&aircraft.length===0&&!orbital.strike&&!players.some(p=>p.transit)){if(--settleTicks<=0)nextTurn();}
   else if(!pendingShot&&!acting.alive)nextTurn();
 }
 function command(team,cmd){
   if(cmd?.type==='appearance'&&(team===0||team===1)){for(const p of players.filter(p=>p.team===team))p.appearance=normalizeAppearance(cmd.appearance);return true;}
   if(gameOver||intro>0||team!==currentTurn||cmd?.turnId!==turnId||!activePlayer().alive)return false;
   if(pendingShot&&escapeTicks<=0)return false;
   const p=activePlayer();
   if(cmd.type==='input'){for(const key of ['left','right','jump'])inputState[key]=cmd[key]===true;}
   else if(cmd.type==='cancelOrbital'&&!pendingShot)return orbitalSystem.cancel(team);
   else if(cmd.type==='aim'&&Number.isFinite(cmd.angle)){p.angle=cmd.angle;if(Number.isFinite(cmd.power))p.power=clampPower(cmd.power);}
   else if(cmd.type==='equip'&&!pendingShot&&WEAPONS.includes(cmd.weapon))p.equipped=cmd.weapon;
   else if(cmd.type==='fuse'&&!pendingShot&&[2,3,4].includes(cmd.seconds))p.grenadeFuse=cmd.seconds;
   else if(cmd.type==='power'&&Number.isFinite(cmd.power))p.power=clampPower(cmd.power);
   else if(cmd.type==='fire'&&!pendingShot&&WEAPONS.includes(cmd.weapon))return fireCurrent(cmd.weapon,cmd.target);
   else return false;
   return true;
 }
 function snapshot(){return clone({levelId:level.id,turnId,currentTurn,turnTimer,tick,intro,firstTeam,gameOver,winner,lastShot,shotId,entityId,cursors,pendingShot,escapeTicks,settleTicks,inputState,players,projectiles,hazards,effects,scheduled,aircraft,orbital,operations:terrain.operations});}
 function restore(s){
   if(s.levelId!==level.id)throw new Error('El estado pertenece a otro nivel');
   currentTurn=s.currentTurn;turnTimer=s.turnTimer;turnId=s.turnId;tick=s.tick||0;intro=s.intro||0;firstTeam=s.firstTeam??0;
   gameOver=s.gameOver;winner=s.winner;lastShot=clone(s.lastShot||null);shotId=s.shotId||lastShot?.id||0;entityId=s.entityId||0;
   cursors=[...(s.cursors||[0,0])];pendingShot=s.pendingShot||false;escapeTicks=s.escapeTicks||0;settleTicks=s.settleTicks||0;
   Object.assign(inputState,s.inputState||{left:false,right:false,jump:false});
   players.splice(0,players.length,...clone(s.players));projectiles.splice(0,projectiles.length,...clone(s.projectiles));
   hazards.splice(0,hazards.length,...clone(s.hazards||[]));effects.splice(0,effects.length,...clone(s.effects||[]));scheduled.splice(0,scheduled.length,...clone(s.scheduled||[]));
   aircraft.splice(0,aircraft.length,...clone(s.aircraft||[]));
   orbitalSystem.restore(s.orbital);
   terrain.sync(s.operations||[]);
 }
 return {level,terrain,players,projectiles,hazards,effects,aircraft,orbital,inputState,step,command,clearInput,snapshot,restore,teleportTarget,
   orbitalReady:team=>orbitalSystem.ready(team,turnId),
   get activeIndex(){return activeIndex()},get activePlayer(){return activePlayer()},
   get firstTeam(){return firstTeam},get introRemaining(){return intro/60},get tick(){return tick},
   get lastShot(){return lastShot},get gameOver(){return gameOver},get winner(){return winner},
   get escaping(){return escapeTicks>0},get canAct(){return !gameOver&&!intro&&activePlayer().alive&&(!pendingShot||escapeTicks>0)},get canFire(){return !gameOver&&!intro&&activePlayer().alive&&!pendingShot},
   get resolving(){return pendingShot&&escapeTicks===0},get currentTurn(){return currentTurn},get turnTimer(){return turnTimer},get turnId(){return turnId}};
}
