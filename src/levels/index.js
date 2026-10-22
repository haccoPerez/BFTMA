// A level is an immutable reference. Mutable pixels belong to each game instance.
const crabImage = new URL('../../assets/terrains/fondo1.png', import.meta.url).href;
const islandsImage = new URL('../../assets/terrains/islas-gemelas-v2.png', import.meta.url).href;
const shipImage = new URL('../../assets/terrains/carguero-tampico.png', import.meta.url).href;
export const LEVELS = Object.freeze({
  crab: Object.freeze({id:'crab',name:'Cangrejo azul',width:1280,height:720,
    scenery:Object.freeze({waterY:675}),
    description:'Una enorme silueta de cangrejo: cada disparo cambia el escenario.',
    image:crabImage,spawns:[{x:200,y:40},{x:1080,y:40}]}),
  islands: Object.freeze({id:'islands',name:'Islas gemelas',width:1920,height:1080,
    scenery:Object.freeze({waterY:910}),
    description:'Terrazas, refugios de roca y un puente entre dos islas tropicales.',
    image:islandsImage,spawns:[{x:330,y:525},{x:1650,y:430}],
    // Reserved positions for a future 3–5 character team roster.
    teamSpawns:[
      [{x:330,y:525},{x:470,y:372},{x:610,y:578},{x:760,y:473},{x:840,y:503}],
      [{x:1220,y:600},{x:1350,y:512},{x:1510,y:373},{x:1650,y:430},{x:1780,y:404}]
    ]}),
  ship: Object.freeze({id:'ship',name:'Carguero de Tampico',width:1920,height:1080,
    scenery:Object.freeze({waterY:745}),
    description:'Contenedores escalonados, cubiertas y un casco destructible inspirado en el puerto de Tampico.',
    image:shipImage,spawns:[{x:480,y:504},{x:1450,y:514}],
    teamSpawns:[
      [{x:350,y:569},{x:480,y:504},{x:620,y:540},{x:740,y:639},{x:920,y:456}],
      [{x:1090,y:571},{x:1300,y:576},{x:1450,y:514},{x:1600,y:539},{x:1770,y:447}]
    ]})
});

export async function loadLevelSource(level) {
  const image = new Image();
  await new Promise((resolve,reject)=>{
    image.onload=resolve;
    image.onerror=()=>reject(new Error('No se pudo cargar el terreno: '+level.image));
    image.src=level.image;
  });
  return image;
}
