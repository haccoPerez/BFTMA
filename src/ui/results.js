import {drawCharacter} from './characters.js';
export function resultPresentation(game,mode,localIndex=0){
  if(game.winner===null)return {kind:'draw',title:'¡Empate!',subtitle:'Nadie se quedó con la isla. ¿Otra ronda?',playerIndex:localIndex};
  const winner=game.players.find(p=>(p.team??game.players.indexOf(p))===game.winner&&p.alive)||game.players[game.winner],isLocal=mode==='local',won=isLocal||game.winner===localIndex;
  return {kind:won?'win':'lose',title:isLocal?`¡Victoria ${game.winner===0?'azul':'roja'}!`:won?'¡Ganaste!':'Esta vez no…',
    subtitle:isLocal?`${winner.appearance?.nickname||winner.name} se queda con el campo de batalla.`:won?'Buen tiro. El puerto es tuyo.':'Reagrúpate, ajusta la mira y vuelve al combate.',playerIndex:game.players.indexOf(won?winner:game.players.find(p=>(p.team??game.players.indexOf(p))===localIndex))};
}
export function bindResults({onMenu,onRestart}){
  const $=id=>document.getElementById(id);let previous=null,start=0,opened=false;
  $('resultMenu').addEventListener('click',onMenu);$('resultRestart').addEventListener('click',onRestart);
  $('resultOverlay').addEventListener('keydown',event=>{
    if(event.key!=='Tab')return;
    const buttons=[...$('resultOverlay').querySelectorAll('button')].filter(button=>!button.hidden&&!button.disabled);
    const first=buttons[0],last=buttons[buttons.length-1];
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  });
  const reduced=()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function hide(){previous=null;start=0;opened=false;$('resultOverlay').hidden=true;}
  function show(game,mode,index,canRestart){
    const result=resultPresentation(game,mode,index),player=game.players[result.playerIndex]||game.players[0];
    $('resultOverlay').dataset.result=result.kind;$('resultTitle').textContent=result.title;$('resultSubtitle').textContent=result.subtitle;
    $('resultEyebrow').textContent=result.kind==='win'?'MISIÓN CUMPLIDA':result.kind==='lose'?'LA BATALLA CONTINÚA':'HASTA LA ÚLTIMA EXPLOSIÓN';
    $('resultRestart').hidden=!canRestart;$('resultHostHint').hidden=canRestart;
    $('resultStats').textContent=[0,1].map(team=>{const members=game.players.filter((p,i)=>(p.team??i)===team);return `P${team+1} · ${members.filter(p=>p.alive).length}/${members.length} vivos · ${members.reduce((sum,p)=>sum+p.health,0)} PV`;}).join(' / ');
    const canvas=$('resultCharacter'),ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.save();ctx.translate(canvas.width/2,canvas.height-30);ctx.scale(3.4,3.4);
    drawCharacter(ctx,{...player,x:0,y:0,angle:0,hurtTimer:0});ctx.restore();
    $('resultConfetti').replaceChildren();
    if(result.kind==='win'&&!reduced())for(let i=0;i<24;i++){
      const piece=document.createElement('i');piece.style.setProperty('--x',`${(i*37)%100}%`);piece.style.setProperty('--delay',`${(i%7)*.09}s`);piece.style.setProperty('--turn',`${i%2?120:-140}deg`);piece.style.background=['#b8ef83','#ffd27c','#70d5e7','#f29a9e'][i%4];$('resultConfetti').append(piece);
    }
    $('resultOverlay').hidden=false;opened=true;(canRestart?$('resultRestart'):$('resultMenu')).focus({preventScroll:true});
  }
  return {hide,update(game,now,{playing,mode,localIndex=0,canRestart=true}){
    if(!playing||!game.gameOver){if(opened||previous)hide();return;}
    if(previous!==game){previous=game;start=now;opened=false;}
    if(!opened&&now-start>=1100)show(game,mode,localIndex,canRestart);
  }};
}
