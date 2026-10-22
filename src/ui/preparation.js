import {LEVELS} from '../levels/index.js';
import {ARSENAL} from '../engine/arsenal.js';
export function bindPreparation(){
  const menu=document.getElementById('mainMenu'),levelSelect=document.getElementById('level');
  const showcase=document.querySelector('.arsenal-showcase');
  for(const [id,rule] of Object.entries(ARSENAL)){
    const card=document.createElement('div'),canvas=document.createElement('canvas'),name=document.createElement('strong'),category=document.createElement('span'),description=document.createElement('p');
    canvas.width=100;canvas.height=70;canvas.dataset.combatArt=id;
    name.textContent=rule.name;category.textContent=rule.category;description.textContent=rule.help;
    card.append(canvas,name,category,description);showcase.append(card);
  }
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
    if(level.scenery?.background){image.style.backgroundImage=`url("${level.scenery.background}")`;image.style.backgroundSize='cover';image.style.borderRadius='6px';}
    const label=document.createElement('span');label.textContent=level.name;button.append(image,label);
    button.addEventListener('click',()=>{if(levelSelect.disabled)return;levelSelect.value=level.id;levelSelect.dispatchEvent(new Event('change'));});
    document.getElementById('levelCards').append(button);
  }
  function refresh(){
    for(const button of document.querySelectorAll('[data-level-card]')){
      const active=button.dataset.levelCard===levelSelect.value;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));
    }
    const mode=document.getElementById('mode').value;
    document.getElementById('setupSummary').textContent=`${mode==='ai'?'Contra IA':mode==='pvp'?'Online PvP':'Local'} · 3 vs 3 · ${LEVELS[levelSelect.value]?.name||''}`;
  }
  tab('play');refresh();return {refresh,tab};
}
