import {drawCharacter} from './characters.js';
import {gasState,hasGasMask} from '../engine/gas.js';
import {firingAngle} from '../engine/aim.js';
import {drawBackground,drawWater} from './scenery.js';
import {drawProjectile,drawGraves,drawShotEffects,drawEquipment} from './combat-art.js';
import {ARSENAL,shotSpeed} from '../engine/arsenal.js';
import {drawTeleportEffect} from './teleport-effects.js';
import {drawHeldWeapon,drawAirSupport} from './weapon-presentation.js';
import {drawOrbitalWorld,drawOrbitalCinematic} from './orbital-art.js';
    export function getPivotCoords(p) {
      return {
        x: p.x - Math.cos(p.angle) * p.pivotOffset,
        y: p.y - Math.sin(p.angle) * p.pivotOffset
      };
    }


export function renderGame(canvas,game,{camera=null,time=0,view=null,weapon='bazooka',teleportPreview=null}={}){
 game.terrain.flush?.();
 const ctx=canvas.getContext('2d');
 const players=view?.players||game.players,projectiles=view?.projectiles||game.projectiles;
 const currentTurn=game.activeIndex??game.currentTurn;
 const WIDTH=game.level.width, HEIGHT=game.level.height;
 const {terrainCanvas,shadowCanvas}=game.terrain;
      // Render
      ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);
      if(camera){
        const ratio=canvas.width/camera.width;ctx.scale(ratio,ratio);
        drawBackground(ctx,camera.width,camera.height,game.level);
        ctx.translate(camera.width/2,camera.height/2);ctx.scale(camera.zoom,camera.zoom);ctx.translate(-camera.x,-camera.y);
      }else drawBackground(ctx,WIDTH,HEIGHT,game.level);
      ctx.save();

      // 1. Capa de sombra detrás
      ctx.drawImage(shadowCanvas, 0, 0);

      // 2. Capa de terreno destructible
      ctx.drawImage(terrainCanvas, 0, 0);
      drawGraves(ctx,game);

      // 3. Jugadores e interfaces
      players.forEach((p, idx) => {
        if(!p.alive)return;
        const isCurrent = idx === currentTurn;
        const visibleWeapon=p.equipped||weapon;
        p={...p,angle:firingAngle(p,visibleWeapon,game.tick)};
        const pivot = getPivotCoords(p);

        if (isCurrent&&game.canAct&&visibleWeapon!=='teleport'&&!(visibleWeapon==='orbital'&&game.orbital?.markers.some(m=>m.team===p.team))) {
          // Indicador de turno
          ctx.strokeStyle = '#ffcc00'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.radius + 6, 0, Math.PI * 2); ctx.stroke();

          // Pivote y guía
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(pivot.x, pivot.y); ctx.stroke();

          ctx.fillStyle = p.isDragging ? '#ffcc00' : 'rgba(255, 255, 255, 0.2)';
          ctx.strokeStyle = p.color; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(pivot.x, pivot.y, p.pivotRadius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

          const bX = p.x + Math.cos(p.angle) * (p.radius + 4);
          const bY = p.y + Math.sin(p.angle) * (p.radius + 4);
          ctx.strokeStyle = p.color; ctx.lineWidth = 3; ctx.setLineDash([6, 4]);
          ctx.beginPath(); ctx.moveTo(bX, bY); ctx.lineTo(bX + Math.cos(p.angle) * 55, bY + Math.sin(p.angle) * 55); ctx.stroke();
          ctx.setLineDash([]);
          const rule=ARSENAL[visibleWeapon];
          if(rule?.power&&['projectile','airstrike','orbital'].includes(rule.kind)){
            const speed=shotSpeed(visibleWeapon,p.power);let x=p.x+Math.cos(p.angle)*22,y=p.y-10+Math.sin(p.angle)*22,vx=Math.cos(p.angle)*speed,vy=Math.sin(p.angle)*speed;
            ctx.fillStyle='#f6e6a9';
            for(let step=0;step<180;step++){
              vy+=rule.gravity||0;x+=vx;y+=vy;
              if(game.terrain.isSolid(x,y)||x<0||x>WIDTH||y>HEIGHT)break;
              if(step%6===0){ctx.beginPath();ctx.arc(x,y,step<60?2:1.3,0,Math.PI*2);ctx.fill();}
            }
          }
        }

        if(p.transit){drawTeleportEffect(ctx,p,game.tick);return;}
        drawCharacter(ctx,p,{gasMask:hasGasMask(p,game)});
        if(isCurrent)drawHeldWeapon(ctx,p,game);
        const barWidth=48,barX=p.x-barWidth/2,barY=p.y-57;
        ctx.fillStyle='#111';ctx.fillRect(barX-1,barY-1,barWidth+2,8);
        ctx.fillStyle=p.health>50?'#65dc70':p.health>25?'#ffcf45':'#ff5252';
        ctx.fillRect(barX,barY,barWidth*p.health/p.maxHealth,6);
        ctx.font='bold 13px system-ui';ctx.textAlign='center';ctx.textBaseline='bottom';
        ctx.lineWidth=3;ctx.strokeStyle='#111';ctx.strokeText(`${p.health}/${p.maxHealth}`,p.x,barY-3);
        ctx.fillStyle='#fff';ctx.fillText(`${p.health}/${p.maxHealth}`,p.x,barY-3);
        const label=`P${(p.team??p.id-1)+1} · ${(p.member??0)+1}${p.appearance?.nickname?' · '+p.appearance.nickname:''}`;
        ctx.font='bold 12px system-ui';ctx.textBaseline='top';ctx.strokeText(label,p.x,p.y+p.radius+11);
        ctx.fillStyle=p.color;ctx.fillText(label,p.x,p.y+p.radius+11);
      });

      if(game.canFire&&weapon==='teleport'&&teleportPreview){
        const target=game.teleportTarget(game.activePlayer,teleportPreview);
        ctx.strokeStyle=target.valid?'#bc94ff':'#ff7070';ctx.lineWidth=3;
        ctx.beginPath();ctx.arc(target.x,target.y,20,0,Math.PI*2);ctx.stroke();
        ctx.font='12px system-ui';ctx.textAlign='center';ctx.fillStyle=ctx.strokeStyle;ctx.fillText(target.valid?'Destino':target.reason,target.x,target.y-28);
      }
      for(const h of game.hazards||[]){
        if(h.type==='signal')continue;
        if(h.type==='gas'){
          const cloud=gasState(h);ctx.save();ctx.fillStyle='#94dc68';ctx.globalAlpha=cloud.alpha;
          for(let i=0;i<7;i++){
            const angle=i*Math.PI*2/7,offset=i===0?0:cloud.radius*.38;
            ctx.beginPath();ctx.ellipse(h.x+Math.cos(angle)*offset,h.y+Math.sin(angle)*offset*.65,cloud.radius*.62,cloud.radius*.48,Math.sin(i)*.2,0,Math.PI*2);ctx.fill();
          }
          ctx.restore();continue;
        }
        if(h.type==='mine'){drawEquipment(ctx,'mine',h.x,h.y,32,24);continue;}
        ctx.save();ctx.globalAlpha=h.type==='gas'?.28:.95;ctx.fillStyle=h.type==='gas'?'#94dc68':'#ebbc58';
        ctx.beginPath();ctx.ellipse(h.x,h.y,h.type==='gas'?h.radius:12,h.type==='gas'?h.radius*.75:6,0,0,Math.PI*2);ctx.fill();ctx.restore();
      }
      for(const e of game.effects||[]){
        ctx.save();ctx.globalAlpha=Math.min(1,e.ttl/25);ctx.strokeStyle=e.color||'#ffd087';ctx.fillStyle=ctx.strokeStyle;ctx.lineWidth=e.kind==='beam'?3:2;
        if(e.kind==='beam'){ctx.beginPath();ctx.moveTo(e.x,e.y);ctx.lineTo(e.x1,e.y1);ctx.stroke();}
        else if(e.kind==='heal'){ctx.font='bold 22px system-ui';ctx.textAlign='center';ctx.fillText('+35',e.x,e.y-15+(e.ttl-40)*.5);}
        else{const radius=(e.radius||18)*(1-e.ttl/55);ctx.beginPath();ctx.arc(e.x,e.y,Math.max(2,radius),0,Math.PI*2);ctx.stroke();}
        ctx.restore();
      }
      // Proyectiles
      drawAirSupport(ctx,game);
      projectiles.forEach(p=>drawProjectile(ctx,p,time));
      drawShotEffects(ctx,game,time);
      drawWater(ctx,game.level,time);
      drawOrbitalWorld(ctx,game);
      ctx.restore();ctx.setTransform(1,0,0,1,0,0);
      if(camera){const ratio=canvas.width/camera.width;ctx.save();ctx.scale(ratio,ratio);drawOrbitalCinematic(ctx,game,camera.width,camera.height);ctx.restore();}
}
