// Mutable terrain instance; level definitions remain reusable and unchanged.
export function createTerrain(level, source) {
 const WIDTH = level.width, HEIGHT = level.height;
 const terrainCanvas = document.createElement('canvas');
 terrainCanvas.width = WIDTH; terrainCanvas.height = HEIGHT;
 const terrainCtx = terrainCanvas.getContext('2d', {willReadFrequently: true});
 const shadowCanvas = document.createElement('canvas');
 shadowCanvas.width = WIDTH; shadowCanvas.height = HEIGHT;
 const shadowCtx = shadowCanvas.getContext('2d');
 const terrainData = new Uint8Array(WIDTH * HEIGHT);
 const operations = [];
 let shadowDirty=false;
 function isSolid(x,y) {
   const ix = Math.floor(x), iy = Math.floor(y);
   return ix >= 0 && iy >= 0 && ix < WIDTH && iy < HEIGHT && terrainData[iy*WIDTH+ix] === 1;
 }
 function rebuildShadow() {
   shadowCtx.clearRect(0,0,WIDTH,HEIGHT);
   shadowCtx.drawImage(terrainCanvas,6,6);
   shadowCtx.globalCompositeOperation = 'source-in';
   shadowCtx.fillStyle = 'rgba(0,0,0,.45)'; shadowCtx.fillRect(0,0,WIDTH,HEIGHT);
   shadowCtx.globalCompositeOperation = 'source-over';
 }
 function reset() {
   terrainCtx.clearRect(0,0,WIDTH,HEIGHT); terrainCtx.drawImage(source,0,0,WIDTH,HEIGHT);
   const data = terrainCtx.getImageData(0,0,WIDTH,HEIGHT).data;
   for(let i=0;i<terrainData.length;i++) terrainData[i] = data[i*4+3]>128 ? 1 : 0;
   operations.length = 0; rebuildShadow();shadowDirty=false;
 }
    function carveCircle(cx, cy, r) {
      terrainCtx.save();
      terrainCtx.globalCompositeOperation = 'destination-out';
      terrainCtx.beginPath();
      terrainCtx.arc(cx, cy, r, 0, Math.PI * 2);
      terrainCtx.fill();
      terrainCtx.restore();

      const minX = Math.max(0, (cx - r) | 0);
      const maxX = Math.min(WIDTH - 1, (cx + r) | 0);
      const minY = Math.max(0, (cy - r) | 0);
      const maxY = Math.min(HEIGHT - 1, (cy + r) | 0);
      const r2 = r * r;

      for (let y = minY; y <= maxY; y++) {
        const row = y * WIDTH;
        const dy = y - cy;
        for (let x = minX; x <= maxX; x++) {
          const dx = x - cx;
          if (dx * dx + dy * dy <= r2) terrainData[row + x] = 0;
        }
      }
    }

    function carveTunnel(x0, y0, x1, y1, radius) {
      terrainCtx.save();
      terrainCtx.globalCompositeOperation = 'destination-out';
      terrainCtx.lineWidth = radius * 2;
      terrainCtx.lineCap = 'round';
      terrainCtx.beginPath();
      terrainCtx.moveTo(x0, y0);
      terrainCtx.lineTo(x1, y1);
      terrainCtx.stroke();
      terrainCtx.restore();

      const minX = Math.max(0, Math.min(x0, x1) - radius | 0);
      const maxX = Math.min(WIDTH - 1, Math.max(x0, x1) + radius | 0);
      const minY = Math.max(0, Math.min(y0, y1) - radius | 0);
      const maxY = Math.min(HEIGHT - 1, Math.max(y0, y1) + radius | 0);

      const dx = x1 - x0, dy = y1 - y0;
      const lenSq = dx * dx + dy * dy;
      if (!lenSq) return carveCircle(x0, y0, radius);
      const r2 = radius * radius;

      for (let y = minY; y <= maxY; y++) {
        const row = y * WIDTH;
        const pdy = y - y0;
        for (let x = minX; x <= maxX; x++) {
          const pdx = x - x0;
          let t = (pdx * dx + pdy * dy) / lenSq;
          t = t < 0 ? 0 : (t > 1 ? 1 : t);
          const projX = x0 + t * dx;
          const projY = y0 + t * dy;
          if ((x - projX)**2 + (y - projY)**2 <= r2) {
            terrainData[row + x] = 0;
          }
        }
      }
    }

    function calculateNormal(cx, cy) {
      let nx = 0, ny = 0;
      for (let dy = -3; dy <= 3; dy++) {
        for (let dx = -3; dx <= 3; dx++) {
          if (dx === 0 && dy === 0) continue;
          if (isSolid(cx + dx, cy + dy)) {
            const dist = Math.hypot(dx, dy);
            nx -= dx / dist; ny -= dy / dist;
          }
        }
      }
      const len = Math.hypot(nx, ny);
      return len === 0 ? { x: 0, y: -1 } : { x: nx / len, y: ny / len };
    }


 function apply(op) {
   if(op.type === 'circle') carveCircle(...op.args);
   else if(op.type === 'tunnel') carveTunnel(...op.args);
   else throw new Error('Operación de terreno desconocida');
   operations.push(op);shadowDirty=true;
 }
 function sync(history) {
   if(history.length < operations.length||operations.some((op,i)=>history[i]&&JSON.stringify(op)!==JSON.stringify(history[i]))) reset();
   for(let i=operations.length;i<history.length;i++) apply(history[i]);
 }
 reset();
 function flush(){if(shadowDirty){rebuildShadow();shadowDirty=false;}}
 return {level, terrainCanvas, shadowCanvas, operations, reset, isSolid, calculateNormal, apply, sync,flush};
}
