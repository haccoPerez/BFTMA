import {drawWeaponIcon} from './combat-art.js';
export function bindBattleHud(){
  const $=id=>document.getElementById(id);
  const panels=[['weaponToggle','weaponPanel'],['cameraToggle','cameraControls'],['optionsToggle','battleOptions']];
  function close(){for(const [button,panel] of panels){$(panel).hidden=true;$(button).setAttribute('aria-expanded','false');}}
  for(const [button,panel] of panels)$(button).addEventListener('click',()=>{
    const show=$(panel).hidden;close();$(panel).hidden=!show;$(button).setAttribute('aria-expanded',String(show));
  });
  $('closeWeapons').addEventListener('click',close);
  for(const id of ['zoomIn','zoomOut','viewMap','followPlayer','reset'])$(id).addEventListener('click',()=>{if(id!=='zoomIn'&&id!=='zoomOut')close();});
  document.getElementById('gameCanvas').addEventListener('pointerdown',close);
  window.addEventListener('keydown',event=>{if(event.key==='Escape')close();});
  function selectWeapon(weapon){
    const selected=document.querySelector(`[data-weapon="${weapon}"]`);
    $('currentWeaponName').textContent=selected.querySelector('span').textContent;
    drawWeaponIcon($('currentWeaponArt'),weapon);
    for(const button of document.querySelectorAll('[data-weapon]')){
      const active=button.dataset.weapon===weapon;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));
    }
    close();
  }
  return {close,selectWeapon,update(game,canControl){
    const hint=game.gameOver?'Partida terminada':game.resolving?'En vuelo…':canControl?'Tu turno':'Turno rival';
    if($('fireHint').textContent!==hint)$('fireHint').textContent=hint;
  }};
}
