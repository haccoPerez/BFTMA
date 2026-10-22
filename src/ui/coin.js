export function bindCoin(){
  const overlay=document.getElementById('coinOverlay'),coin=document.getElementById('coinDisc'),result=document.getElementById('coinResult');
  return {update(game,playing){
    const show=playing&&game.introRemaining>0;
    overlay.hidden=!show;if(!show)return;
    const progress=1-game.introRemaining/2.5;
    const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    coin.style.transform=reduced?'none':`translateY(${-Math.sin(Math.min(1,progress/.75)*Math.PI)*55}px) rotateY(${Math.min(1,progress/.75)*1440}deg)`;
    const revealed=progress>.7;
    coin.textContent=revealed?`P${game.firstTeam+1}`:'★';
    coin.style.setProperty('--coin-team',revealed?(game.firstTeam===0?'#00a2ff':'#ff3344'):'#ffe19c');
    result.textContent=revealed?`Inicia el equipo ${game.firstTeam===0?'azul':'rojo'}`:'¿Quién inicia la batalla?';
  }};
}
