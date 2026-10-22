import {getPivotCoords} from './renderer.js';
export function bindInput(canvas,{getGame,canControl,send,getCamera=()=>null,isPlaying=()=>true}) {
 const keys={left:false,right:false,jump:false};
 let dragging=false, dragTurn=null;
 const emit=()=>send({type:'input',...keys});
 const pointers=new Map();let panning=null,pinch=null;
 function clear(){keys.left=keys.right=keys.jump=false;dragging=false;pointers.clear();panning=null;pinch=null;const camera=getCamera();if(camera)camera.hold=false;emit();}
 const mapping={a:'left',ArrowLeft:'left',d:'right',ArrowRight:'right',w:'jump',' ':'jump',ArrowUp:'jump'};
 window.addEventListener('keydown',e=>{
   const key=mapping[e.key]; if(!key || e.target.matches('input,select,textarea'))return;
   e.preventDefault(); if(canControl()){keys[key]=true;emit();}
 });
 window.addEventListener('keyup',e=>{const key=mapping[e.key];if(key){keys[key]=false;emit();}});
 window.addEventListener('blur',clear);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)clear();});
 for(const [id,key] of [['btnLeft','left'],['btnRight','right'],['btnJump','jump']]){
   const button=document.getElementById(id);
   button.addEventListener('pointerdown',e=>{e.preventDefault();if(canControl()){button.setPointerCapture(e.pointerId);keys[key]=true;emit();}});
   for(const event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,()=>{keys[key]=false;emit();});
 }
    function getCanvasCoords(e) {
      const camera=getCamera();
      if(camera){const rect=canvas.getBoundingClientRect();return camera.screenToWorld((e.clientX-rect.left)*camera.width/rect.width,(e.clientY-rect.top)*camera.height/rect.height);}
      const {width:WIDTH,height:HEIGHT}=getGame().level;
      const rect = canvas.getBoundingClientRect();
      const canvasAspect = WIDTH / HEIGHT;
      const rectAspect = rect.width / rect.height;
      let renderWidth = rect.width, renderHeight = rect.height;
      let offsetX = 0, offsetY = 0;

      if (rectAspect > canvasAspect) {
        renderWidth = rect.height * canvasAspect;
        offsetX = (rect.width - renderWidth) / 2;
      } else {
        renderHeight = rect.width / canvasAspect;
        offsetY = (rect.height - renderHeight) / 2;
      }

      return {
        x: ((e.clientX - rect.left - offsetX) / renderWidth) * WIDTH,
        y: ((e.clientY - rect.top - offsetY) / renderHeight) * HEIGHT
      };
    }


 canvas.addEventListener('pointerdown',e=>{
   if(!isPlaying())return;
   const camera=getCamera();
   pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
   if(camera&&pointers.size===2){
     dragging=false;panning=null;camera.hold=true;
     const [a,b]=[...pointers.values()];pinch={distance:Math.hypot(a.x-b.x,a.y-b.y),mid:{x:(a.x+b.x)/2,y:(a.y+b.y)/2}};
     canvas.setPointerCapture(e.pointerId);return;
   }
   const game=getGame(), p=game.players[game.currentTurn],pos=getCanvasCoords(e),pivot=getPivotCoords(p);
   if(!canControl()||Math.hypot(pos.x-pivot.x,pos.y-pivot.y)>p.pivotRadius+18){
     if(camera){panning={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);}return;
   }
   if(camera)camera.hold=true;
   dragging=true;dragTurn=game.turnId;canvas.setPointerCapture(e.pointerId);
 });
 canvas.addEventListener('pointermove',e=>{
   const camera=getCamera();if(pointers.has(e.pointerId))pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
   if(camera&&pinch&&pointers.size>=2){
     const [a,b]=[...pointers.values()],distance=Math.hypot(a.x-b.x,a.y-b.y),mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2},rect=canvas.getBoundingClientRect();
     if(pinch.distance>0)camera.zoomAt(distance/pinch.distance,mid.x-rect.left,mid.y-rect.top);
     camera.pan(mid.x-pinch.mid.x,mid.y-pinch.mid.y);pinch={distance,mid};return;
   }
   if(camera&&panning?.id===e.pointerId){camera.pan(e.clientX-panning.x,e.clientY-panning.y);panning={id:e.pointerId,x:e.clientX,y:e.clientY};return;}
   const game=getGame();if(!dragging||!canControl()||dragTurn!==game.turnId)return;
   const p=game.players[game.currentTurn],pos=getCanvasCoords(e);
   // The handle is behind the player: pull back to aim in the opposite direction.
   // This matches getPivotCoords, so moving the pointer never flips the handle.
   if(Math.hypot(pos.x-p.x,pos.y-p.y)>8)send({type:'aim',angle:Math.atan2(p.y-pos.y,p.x-pos.x)});
 });
 for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,e=>{
   pointers.delete(e.pointerId);dragging=false;panning=null;pinch=null;
   const camera=getCamera();if(camera)camera.hold=false;
 });
 canvas.addEventListener('wheel',e=>{const camera=getCamera();if(!camera||!isPlaying())return;e.preventDefault();const rect=canvas.getBoundingClientRect();camera.zoomAt(Math.exp(-e.deltaY*.001),e.clientX-rect.left,e.clientY-rect.top);},{passive:false});
 return {clear};
}
