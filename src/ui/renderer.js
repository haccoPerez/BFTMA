import {drawCharacter} from './characters.js';
import {drawBackground,drawWater} from './scenery.js';
import {drawProjectile,drawGraves,drawShotEffects} from './combat-art.js';
    export function getPivotCoords(p) {
      return {
        x: p.x - Math.cos(p.angle) * p.pivotOffset,
        y: p.y - Math.sin(p.angle) * p.pivotOffset
      };
    }


export function renderGame(canvas,game,{camera=null,time=0}={}){
 const ctx=canvas.getContext('2d');
 const {players,projectiles,currentTurn}=game;
 const WIDTH=game.level.width, HEIGHT=game.level.height;
 const {terrainCanvas,shadowCanvas}=game.terrain;
      // Render
      ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);
      if(camera){
        const ratio=canvas.width/camera.width;ctx.scale(ratio,ratio);
        drawBackground(ctx,camera.width,camera.height);
        ctx.translate(camera.width/2,camera.height/2);ctx.scale(camera.zoom,camera.zoom);ctx.translate(-camera.x,-camera.y);
      }else drawBackground(ctx,WIDTH,HEIGHT);
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
        const pivot = getPivotCoords(p);

        if (isCurrent&&!game.gameOver&&!game.resolving) {
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
        }

        drawCharacter(ctx,p);
        const barWidth=48,barX=p.x-barWidth/2,barY=p.y-57;
        ctx.fillStyle='#111';ctx.fillRect(barX-1,barY-1,barWidth+2,8);
        ctx.fillStyle=p.health>50?'#65dc70':p.health>25?'#ffcf45':'#ff5252';
        ctx.fillRect(barX,barY,barWidth*p.health/p.maxHealth,6);
        ctx.font='bold 13px system-ui';ctx.textAlign='center';ctx.textBaseline='bottom';
        ctx.lineWidth=3;ctx.strokeStyle='#111';ctx.strokeText(`${p.health}/${p.maxHealth}`,p.x,barY-3);
        ctx.fillStyle='#fff';ctx.fillText(`${p.health}/${p.maxHealth}`,p.x,barY-3);
        const label=`P${p.id}${p.appearance?.nickname?' · '+p.appearance.nickname:''}`;
        ctx.font='bold 12px system-ui';ctx.textBaseline='top';ctx.strokeText(label,p.x,p.y+p.radius+11);
        ctx.fillStyle=p.color;ctx.fillText(label,p.x,p.y+p.radius+11);
      });

      // Proyectiles
      projectiles.forEach(p=>drawProjectile(ctx,p,time));
      drawShotEffects(ctx,game,time);
      drawWater(ctx,game.level,time);
      ctx.restore();ctx.setTransform(1,0,0,1,0,0);
}
