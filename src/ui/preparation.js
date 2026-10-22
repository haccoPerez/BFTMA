import {LEVELS} from '../levels/index.js';
export function bindPreparation(){
  const menu=document.getElementById('mainMenu'),levelSelect=document.getElementById('level');
  function tab(name){
    menu.dataset.tab=name;
    for(const button of document.querySelectorAll('[data-setup-tab]')){
      const active=button.dataset.setupTab===name;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));
    }
    menu.scrollTo({top:0,behavior:'smooth'});
  }
  for(const button of document.querySelectorAll('[data-setup-tab]'))button.addEventListener('click',()=>tab(button.dataset.setupTab));
  for(const level of Object.values(LEVELS)){
    const button=document.createElement('button');button.type='button';button.dataset.levelCard=level.id;
    const image=document.createElement('img');image.src=level.image;image.alt='';
    const label=document.createElement('span');label.textContent=level.name;button.append(image,label);
    button.addEventListener('click',()=>{if(levelSelect.disabled)return;levelSelect.value=level.id;levelSelect.dispatchEvent(new Event('change'));});
    document.getElementById('levelCards').append(button);
  }
  function refresh(){
    for(const button of document.querySelectorAll('[data-level-card]')){
      const active=button.dataset.levelCard===levelSelect.value;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));
    }
    const mode=document.getElementById('mode').value;
    document.getElementById('setupSummary').textContent=`${mode==='ai'?'Contra IA':mode==='pvp'?'Online PvP':'Local'} · ${LEVELS[levelSelect.value]?.name||''}`;
  }
  tab('play');refresh();return {refresh,tab};
}
