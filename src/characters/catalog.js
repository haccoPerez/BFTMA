// Cosmetic identifiers only. No cosmetic changes collisions or combat stats.
export const ACCESSORIES=Object.freeze({
  none:{name:'Sin accesorio'},
  // Coordinates relative to the character center, before facing is mirrored.
  helmet:{name:'Casco',cell:[0,0],width:34,offsetX:1,bottom:-21,frontCutoff:-28},
  hat:{name:'Sombrero',cell:[1,0],width:39,offsetX:0,bottom:-21,frontCutoff:-28},
  wig:{name:'Peluca',cell:[0,1],width:34,offsetX:-2,bottom:-17},
  bow:{name:'Moño',cell:[1,1],width:19,offsetX:0,bottom:-22}
});
export function normalizeAppearance(value={}){
  return Object.freeze({character:'raccoon',
    accessory:Object.hasOwn(ACCESSORIES,value?.accessory)?value.accessory:'none',
    nickname:typeof value?.nickname==='string'?value.nickname.replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,16):''});
}
