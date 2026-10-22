import {createTerrain} from './terrain.js';
import {advanceProjectile,PROJECTILE_SPEED} from './projectiles.js';
export {PROJECTILE_GRAVITY} from './projectiles.js';
import {MAX_HEALTH,DAMAGE,damagePlayer,explosionDamage,tunnelDamage} from './combat.js';
import {normalizeAppearance} from '../characters/catalog.js';
export const FIXED_STEP = 1/60;
export const WEAPONS = ['bazooka','screw','lemon'];
export function createGame(level, source) {
 const WIDTH=level.width, HEIGHT=level.height;
 const terrain=createTerrain(level,source);
 const {isSolid, calculateNormal}=terrain;
 const carveCircle=(...args)=>terrain.apply({type:'circle',args});
 const carveTunnel=(...args)=>terrain.apply({type:'tunnel',args});
 const players=level.spawns.map((spawn,index)=>({
   ...spawn,id:index+1,name:index===0?'P1 (Azul)':'P2 (Rojo)',
   radius:12,color:index===0?'#00a2ff':'#ff3344',vx:0,vy:0,isGrounded:false,
   health:MAX_HEALTH,maxHealth:MAX_HEALTH,alive:true,hurtTimer:0,
   death:null,lastGrounded:{x:spawn.x,y:spawn.y},
   appearance:normalizeAppearance(),
   angle:index===0?-.25:Math.PI+.25,pivotOffset:45,pivotRadius:16
 }));
 const projectiles=[];
 const inputState={left:false,right:false,jump:false};
 let currentTurn=0, turnTimer=10, turnId=0;
 let gameOver=false,winner=null;
 let shotId=0,lastShot=null;
 function updateOutcome(){
   if(projectiles.length)return;
   const survivors=players.filter(p=>p.alive);
   if(survivors.length<=1){gameOver=true;winner=survivors.length?players.indexOf(survivors[0]):null;clearInput();}
 }
 function explode(x,y,weapon,directHit=null){
   carveCircle(x,y,DAMAGE[weapon].crater);
   explosionDamage(players,x,y,weapon,directHit);
 }
 function nextTurn(){ currentTurn=1-currentTurn; turnTimer=10; turnId++; clearInput(); }
 function clearInput(){ inputState.left=inputState.right=inputState.jump=false; }
    function fireCurrent(weapon) {
      const p = players[currentTurn];
      const speed = PROJECTILE_SPEED;
      const startX = p.x + Math.cos(p.angle) * (p.radius + 6);
      const startY = p.y + Math.sin(p.angle) * (p.radius + 6);
      lastShot={id:++shotId,weapon,x:startX,y:startY,angle:p.angle};

      if (weapon === 'bazooka') {
        projectiles.push({ type: 'bazooka', x: startX, y: startY, vx: Math.cos(p.angle)*speed, vy: Math.sin(p.angle)*speed, alive: true });
      } else if (weapon === 'screw') {
        const endX=startX+Math.cos(p.angle)*DAMAGE.screw.range,endY=startY+Math.sin(p.angle)*DAMAGE.screw.range;
        carveTunnel(startX,startY,endX,endY,DAMAGE.screw.radius);
        tunnelDamage(players.filter(target=>target!==p),startX,startY,endX,endY);
      } else if (weapon === 'lemon') {
        projectiles.push({ type: 'lemon', x: startX, y: startY, vx: Math.cos(p.angle)*speed, vy: Math.sin(p.angle)*speed, bounces: 2, alive: true });
      }
      updateOutcome();
      if(!gameOver)nextTurn();
    }


    function updatePlayerPhysics(p, isCurrent) {
      if(!p.alive)return;
      const MAX_STEP_UP = 6;
      const moveSpeed = 2.0;

      // 1. Movimiento Horizontal solo para el jugador activo
      if (isCurrent) {
        let dir = 0;
        if (inputState.left) dir -= 1;
        if (inputState.right) dir += 1;

        if (dir !== 0) {
          // Walking mirrors the aim horizontally while keeping its elevation.
          // The renderer and aim handle both use this authoritative angle.
          p.angle = Math.atan2(Math.sin(p.angle), dir * Math.abs(Math.cos(p.angle)));
          const targetX = p.x + dir * moveSpeed;
          let steppedY = null;

          // Algoritmo de escalón: probar si puede subir la pendiente
          for (let s = 0; s <= MAX_STEP_UP; s++) {
            const testY = p.y - s;
            if (!isSolid(targetX, testY) && !isSolid(targetX, testY - p.radius)) {
              steppedY = testY;
              break;
            }
          }

          if (steppedY !== null) {
            p.x = Math.max(p.radius, Math.min(WIDTH-p.radius, targetX));
            p.y = steppedY;
          }
        }

        // Salto
        if (inputState.jump && p.isGrounded) {
          p.vy = -6.5;
          p.isGrounded = false;
        }
      }

      if(p.y > HEIGHT + 60) {
        damagePlayer(p,p.health,'fall');
        return;
      }
      // Impact velocity affects either player, independently of turn controls.
      const impulseSteps=Math.max(1,Math.ceil(Math.abs(p.vx)));
      for(let i=0;i<impulseSteps&&p.vx!==0;i++){
        const nextX=p.x+p.vx/impulseSteps,edgeX=nextX+Math.sign(p.vx)*p.radius;
        if(nextX<p.radius||nextX>WIDTH-p.radius||
          [0,-.65,.65].some(offset=>isSolid(edgeX,p.y+offset*p.radius))){p.vx=0;break;}
        p.x=nextX;
      }
      p.vx*=p.isGrounded?.78:.94;
      if(Math.abs(p.vx)<.05)p.vx=0;
      // Gravedad
      p.vy += 0.3;
      if (p.vy > 10) p.vy = 10;

      const verticalSteps=Math.max(1,Math.ceil(Math.abs(p.vy))),dy=p.vy/verticalSteps;
      p.isGrounded=false;
      for(let i=0;i<verticalSteps;i++){
        const nextY=p.y+dy,edgeY=nextY+Math.sign(dy)*p.radius;
        if([0,-.65,.65].some(offset=>isSolid(p.x+offset*p.radius,edgeY))){
          p.vy=0;p.isGrounded=dy>0;break;
        }
        p.y=nextY;
      }
      if(p.isGrounded)p.lastGrounded={x:p.x,y:p.y};
    }


 function step() {
   if(gameOver)return;
   const resolving=projectiles.length>0;
   if(!resolving){turnTimer-=FIXED_STEP;if(turnTimer<=0)nextTurn();}
   players.forEach((p,i)=>{
     p.hurtTimer=Math.max(0,p.hurtTimer-FIXED_STEP);
     updatePlayerPhysics(p,!resolving&&i===currentTurn);
   });
   for(let i=projectiles.length-1;i>=0;i--){
     const p=projectiles[i];
     advanceProjectile(p,{players,terrain,width:WIDTH,height:HEIGHT,explode});
     if(!p.alive)projectiles.splice(i,1);
   }
   updateOutcome();
 }
 function command(playerIndex, command) {
   if(command?.type==='appearance'&&players[playerIndex]){
     players[playerIndex].appearance=normalizeAppearance(command.appearance);return true;
   }
   if(gameOver||projectiles.length||!players[playerIndex]?.alive||playerIndex!==currentTurn || command.turnId!==turnId) return false;
   if(command.type==='input') {
     for(const key of ['left','right','jump']) inputState[key]=command[key]===true;
   } else if(command.type==='aim' && Number.isFinite(command.angle)) players[playerIndex].angle=command.angle;
   else if(command.type==='fire' && WEAPONS.includes(command.weapon)) fireCurrent(command.weapon);
   else return false;
   return true;
 }
 function snapshot(){return {levelId:level.id,turnId,currentTurn,turnTimer,gameOver,winner,lastShot,players:players.map(p=>({...p})),projectiles:projectiles.map(p=>({...p})),operations:terrain.operations.slice()};}
 function restore(state){
   if(state.levelId!==level.id) throw new Error('El estado pertenece a otro nivel');
   currentTurn=state.currentTurn; turnTimer=state.turnTimer; turnId=state.turnId;
   gameOver=state.gameOver;winner=state.winner;
   lastShot=state.lastShot||null;shotId=lastShot?.id||0;
   state.players.forEach((p,i)=>Object.assign(players[i],p));
   projectiles.splice(0,projectiles.length,...state.projectiles.map(p=>({...p})));
   terrain.sync(state.operations);
 }
 return {level,terrain,players,projectiles,inputState,step,command,clearInput,snapshot,restore,
   get lastShot(){return lastShot},
   get gameOver(){return gameOver},get winner(){return winner},get resolving(){return projectiles.length>0},
   get currentTurn(){return currentTurn}, get turnTimer(){return turnTimer},get turnId(){return turnId}};
}
