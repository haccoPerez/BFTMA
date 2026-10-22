import {ACCESSORIES,normalizeAppearance} from '../characters/catalog.js';
import {drawCharacter} from './characters.js';
const STORAGE_KEY='bftma.appearance.v1';
export function bindCustomization({getGame,isOnline,getPlayerIndex,onChange}){
  const $=id=>document.getElementById(id);
  let saved={};try{saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}')||{};}catch{}
  const local=[normalizeAppearance(saved.local?.[0]||{accessory:'helmet'}),normalizeAppearance(saved.local?.[1]||{accessory:'hat'})];
  let online=normalizeAppearance(saved.online||{accessory:'none'});
  const selectedIndex=()=>isOnline()?(getPlayerIndex()??0):Number($('stylePlayer').value);
  const selected=()=>isOnline()?online:local[selectedIndex()];
  for(const [id,value] of Object.entries(ACCESSORIES))$('styleAccessory').add(new Option(value.name,id));
  function preview(){
    const canvas=$('stylePreview'),ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.save();ctx.translate(canvas.width/2,canvas.height-48);ctx.scale(3.1,3.1);
    const index=selectedIndex();
    drawCharacter(ctx,{x:0,y:0,radius:12,angle:0,color:index===0?'#00a2ff':'#ff3344',appearance:selected()});ctx.restore();
  }
  function refresh(){
    $('stylePlayerLabel').hidden=isOnline();
    $('styleAccessory').value=selected().accessory;$('styleName').value=selected().nickname;
    $('styleTarget').textContent=isOnline()?'Tu apariencia':`Apariencia de P${selectedIndex()+1}`;
    preview();
  }
  function change(){
    const appearance=normalizeAppearance({accessory:$('styleAccessory').value,nickname:$('styleName').value});
    if(isOnline())online=appearance;else local[selectedIndex()]=appearance;
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify({local,online}));}catch{}
    onChange(selectedIndex(),appearance);preview();
  }
  $('styleAccessory').addEventListener('change',change);$('styleName').addEventListener('input',change);
  $('stylePlayer').addEventListener('change',refresh);
  $('styleToggle').addEventListener('click',()=>{$('stylePanel').hidden=false;$('styleToggle').setAttribute('aria-expanded','true');refresh();$('styleName').focus();});
  $('styleClose').addEventListener('click',()=>{$('stylePanel').hidden=true;$('styleToggle').setAttribute('aria-expanded','false');});
  refresh();
  return {refresh,preview,getOnline:()=>online,getLocal:index=>local[index]};
}
