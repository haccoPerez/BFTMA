import {drawWeaponIcon} from './combat-art.js';
import {ARSENAL} from '../engine/arsenal.js';
export function bindBattleHud(){
  const $=id=>document.getElementById(id);
  let equipped='bazooka';
  const cancel=document.createElement('button');cancel.id='cancelOrbital';cancel.type='button';cancel.textContent='Descartar marcador';cancel.hidden=true;
  $('fuseToggle').insertAdjacentElement('afterend',cancel);
  const grid=document.querySelector('.weapon-grid');grid.replaceChildren();
  for(const [id,rule] of Object.entries(ARSENAL)){
    const button=document.createElement('button'),canvas=document.createElement('canvas'),label=document.createElement('span');
    button.dataset.weapon=id;button.setAttribute('aria-pressed',String(id===equipped));button.classList.toggle('active',id===equipped);
    button.title=rule.help;canvas.width=72;canvas.height=48;canvas.dataset.combatArt=id;canvas.setAttribute('aria-hidden','true');
    label.textContent=rule.name;button.append(canvas,label);grid.append(button);
  }
  $('weaponDescription').textContent=ARSENAL[equipped].help;
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
    equipped=weapon;
    const selected=document.querySelector(`[data-weapon="${weapon}"]`);
    $('currentWeaponName').textContent=selected.querySelector('span').textContent;
    $('weaponToggle').title=ARSENAL[weapon].name;
    $('weaponToggle').setAttribute('aria-label','Cambiar arma: '+ARSENAL[weapon].name);
    drawWeaponIcon($('currentWeaponArt'),weapon);
    for(const button of document.querySelectorAll('[data-weapon]')){
      const active=button.dataset.weapon===weapon;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));
    }
    $('weaponDescription').textContent=ARSENAL[weapon].help;
    close();
  }
  return {close,selectWeapon,update(game,canControl){
    const marker=game.orbital?.markers.find(m=>m.team===game.currentTurn),orbitalSelected=equipped==='orbital';
    const ready=game.orbitalReady?.(game.currentTurn);
    const hint=game.gameOver?'Partida terminada':game.introRemaining?'Sorteo…':game.orbital?.strike?'Ataque orbital':game.escaping?'¡Huye!':game.players.some(p=>p.transit)?'Teletransportando…':game.resolving?'En vuelo…':canControl?(orbitalSelected?(marker?(ready?(marker.attached?'Objetivo fijado · llama por radio':'Atacar posición del marcador'):'Disponible en tu siguiente turno'):'Lanza el marcador · alcance de fijación 140 px'):equipped==='teleport'?'Toca tu destino':'Tu turno'):'Turno rival';
    if($('fireHint').textContent!==hint)$('fireHint').textContent=hint;
    const p=game.activePlayer;
    for(const team of [0,1]){
      const members=game.players.filter(p=>p.team===team),label=`${team===0?'Azul':'Rojo'} ${members.filter(p=>p.alive).length}/3 · ${members.reduce((sum,p)=>sum+p.health,0)} PV`;
      const target=$('team'+team);if(target.textContent!==label)target.textContent=label;
    }
    $('shotPower').disabled=!canControl||!game.canFire||!ARSENAL[equipped].power||(orbitalSelected&&!!marker);
    const value=Math.round((p?.power??1)*100);$('shotPower').value=value;$('powerValue').textContent=value+'%';
    $('powerControl').classList.toggle('fixed-power',!ARSENAL[equipped].power);
    $('powerControl').hidden=equipped==='teleport'||(orbitalSelected&&!!marker);
    cancel.hidden=!(canControl&&game.canFire&&orbitalSelected&&marker);cancel.disabled=!canControl||!game.canFire;
    $('fuseToggle').hidden=equipped!=='frag';
    $('fuseToggle').disabled=!canControl||!game.canFire;
    $('fuseToggle').textContent=`Mecha: ${p.grenadeFuse||2} s`;
    $('fuseToggle').setAttribute('aria-label',`Mecha de ${p.grenadeFuse||2} segundos; tocar para cambiar a ${p.grenadeFuse===4?2:(p.grenadeFuse||2)+1}`);
    const fireLabel=equipped==='teleport'?'TOCA MAPA':orbitalSelected?(marker?'LLAMAR':'MARCADOR'):'FUEGO';
    $('fireBtn').querySelector('span').textContent=fireLabel;
    $('fireBtn').setAttribute('aria-label',equipped==='teleport'?'Toca el mapa para teletransportarte':fireLabel==='LLAMAR'?'Llamar al satélite':fireLabel==='MARCADOR'?'Lanzar marcador orbital':'Disparar');
    if(orbitalSelected&&marker&&!ready)$('fireBtn').disabled=true;
  }};
}
