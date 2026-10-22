import {createGame,FIXED_STEP} from './engine/game.js';
import {LEVELS,loadLevelSource} from './levels/index.js';
import {renderGame} from './ui/renderer.js';
import {bindInput} from './ui/input.js';
import {connectPvp,pvpUnavailableReason} from './network/pvp.js';
import {loadCharacterAssets} from './ui/characters.js';
import {bindCustomization} from './ui/customization.js';
import {normalizeAppearance} from './characters/catalog.js';
import {createComputerPlayer,DIFFICULTIES} from './engine/ai.js';
import {createCamera} from './ui/camera.js';
import {loadScenery} from './ui/scenery.js';
import {bindBattleHud} from './ui/battle-hud.js';
import {loadCombatArt} from './ui/combat-art.js';
import {bindPreparation} from './ui/preparation.js';
import {bindResults} from './ui/results.js';
import {createPrediction} from './network/prediction.js';
import {bindCoin} from './ui/coin.js';
const camera=createCamera(),prediction=createPrediction();
let ackCommandSeq=0;

const $=id=>document.getElementById(id);
const canvas=$('gameCanvas'),levelSelect=$('level'),mode=$('mode');
const difficulty=$('difficulty');
try{const saved=localStorage.getItem('bftma.aiDifficulty');if(Object.hasOwn(DIFFICULTIES,saved))difficulty.value=saved;}catch{}
let computer=createComputerPlayer(1,{difficulty:difficulty.value});
const sources=new Map();
let game=null,session=null,connected=false,weapon='bazooka',epoch=0,sequence=0,receivedSequence=-1;
let accumulator=0,lastTime=0,lastBroadcast=0,loading=false,playing=false,assetsReady=false,connecting=false,connectionAttempt=0;
let remoteAppearance=normalizeAppearance();
let fuseSeconds=2;
const loadouts=[{weapon:'bazooka',fuse:2},{weapon:'bazooka',fuse:2}];
const status=message=>{$('status').textContent=message;$('menuStatus').textContent=message;};
for(const level of Object.values(LEVELS))levelSelect.add(new Option(level.name,level.id));
if(new URLSearchParams(location.search).get('mode')==='pvp')mode.value='pvp';
const authoritative=()=>mode.value!=='pvp'||session?.isHost;
const canControl=()=>playing&&!!game&&game.canAct&&!loading&&(mode.value==='local'||(mode.value==='ai'&&game.currentTurn===0)||(connected&&(session.isHost||prediction.ready)&&game.currentTurn===session.playerIndex));
function send(command){
  if(!canControl())return;
  const data={...command,turnId:game.turnId,epoch};
  if(authoritative())game.command(mode.value==='local'?game.currentTurn:0,data);
  else session.sendCommand(prediction.command(game,session.playerIndex,data));
}
const input=bindInput(canvas,{getGame:()=>game,canControl,send,getCamera:()=>camera,isPlaying:()=>playing,getWeapon:()=>weapon,onFire:()=>{$('fireBtn').click();}});
const hud=bindBattleHud();
const preparation=bindPreparation();
const coin=bindCoin();
const results=bindResults({onMenu:()=>{$('backToMenu').click();},onRestart:()=>{$('reset').click();}});
for(const [id,action] of [['zoomIn',()=>camera.zoomAt(1.2)],['zoomOut',()=>camera.zoomAt(1/1.2)],['viewMap',()=>camera.showMap()],['followPlayer',()=>camera.resume()]])$(id).addEventListener('click',action);
const styles=bindCustomization({
  getGame:()=>game,isOnline:()=>mode.value==='pvp',getPlayerIndex:()=>connected?session.playerIndex:null,
  onChange:(index,appearance)=>{
    if(!game)return;
    const command={type:'appearance',appearance};
    if(mode.value!=='pvp')game.command(index,command);
    else if(connected){if(session.isHost)game.command(0,command);else session.sendCommand(command);}
  }
});
function setPlaying(value){
  results.hide();
  input.clear();game?.clearInput();playing=value;accumulator=0;lastTime=0;
  document.body.dataset.screen=value?'game':'menu';
  $('mainMenu').hidden=value;$('ui').hidden=!value;$('mobileControls').hidden=!value;
  hud.close();
  if(!value){
    $('stylePanel').hidden=false;styles.refresh();$('mainMenu').scrollTop=0;
    (mode.value==='pvp'?$('room'):$('startGame')).focus({preventScroll:true});
  }
}
function updateSetup(){
  $('difficultyLabel').hidden=mode.value!=='ai';$('lobby').hidden=mode.value!=='pvp';
  $('startGame').hidden=mode.value==='pvp';
  $('modeDescription').textContent=mode.value==='local'?'Dos jugadores comparten el dispositivo y alternan turnos.':
    mode.value==='ai'?'Tú eres el equipo azul. La computadora controla al rojo.':'Desafía a otro jugador desde un segundo dispositivo.';
  const level=LEVELS[levelSelect.value];if(!level)return;
  $('levelPreview').src=level.image;$('levelTitle').textContent=level.name;
  $('levelSize').textContent=`${level.width} × ${level.height}`;
  $('levelDescription').textContent=level.description||'';
  preparation.refresh();
}
function applyStyles(){
  if(mode.value!=='pvp')for(const team of [0,1])game.command(team,{type:'appearance',appearance:styles.getLocal(team)});
  else if(session?.isHost){
    game.command(0,{type:'appearance',appearance:styles.getOnline()});
    game.command(1,{type:'appearance',appearance:remoteAppearance});
  }
}
async function getSource(level){
  if(!sources.has(level.id))sources.set(level.id,loadLevelSource(level).catch(error=>{sources.delete(level.id);throw error;}));
  return sources.get(level.id);
}
async function selectLevel(level) {
  results.hide();
  loading=true;$('startGame').disabled=true;$('connect').disabled=true;
  input.clear();status('Cargando terreno…');
  try {
    const source=await getSource(level);
    prediction.reset();ackCommandSeq=0;
    game=createGame(level,source,{firstTeam:crypto.getRandomValues(new Uint32Array(1))[0]%2,introTicks:150});canvas.width=level.width;canvas.height=level.height;
    applyStyles();styles.refresh();
    levelSelect.value=level.id;accumulator=0;epoch++;
    updateSetup();
    status(mode.value==='local'?'Partida local':mode.value==='ai'?`Contra la computadora · ${DIFFICULTIES[difficulty.value].name} · Tú eres P1`:connected?'Conectado':pvpUnavailableReason()||'Entra a una sala para jugar');
  } finally {loading=false;}
}
function disconnect(){
  connectionAttempt++;prediction.reset();ackCommandSeq=0;
  session?.close();session=null;connected=false;connecting=false;receivedSequence=-1;input.clear();
  $('connect').disabled=false;$('room').disabled=false;levelSelect.disabled=false;$('reset').disabled=false;
  remoteAppearance=normalizeAppearance();styles.refresh();
}
mode.addEventListener('change',async()=>{
  updateSetup();
  disconnect();$('lobby').hidden=mode.value!=='pvp';
  try{await selectLevel(LEVELS[levelSelect.value]);}catch(error){status(error.message);}
});
difficulty.addEventListener('change',()=>{
  game?.clearInput();computer=createComputerPlayer(1,{difficulty:difficulty.value});
  try{localStorage.setItem('bftma.aiDifficulty',difficulty.value);}catch{}
  if(mode.value==='ai')status(`Contra la computadora · ${DIFFICULTIES[difficulty.value].name} · Tú eres P1`);
});
$('startGame').addEventListener('click',async()=>{
  if(loading||!assetsReady||mode.value==='pvp')return;
  try{await selectLevel(LEVELS[levelSelect.value]);computer=createComputerPlayer(1,{difficulty:difficulty.value});setPlaying(true);}catch(error){status(error.message);}
});
$('backToMenu').addEventListener('click',()=>{
  setPlaying(false);if(mode.value==='pvp'){disconnect();mode.disabled=false;status('Conexión cerrada. Prepara una nueva partida.');}
  else status('Prepara tu próxima partida.');
  updateSetup();
});
levelSelect.addEventListener('change',async()=>{
  if(loading)return;
  try{await selectLevel(LEVELS[levelSelect.value]);}catch(error){status(error.message);}
});
$('reset').addEventListener('click',async()=>{
  if(loading || (connected&&!authoritative()))return;
  try{await selectLevel(game.level);}catch(error){status(error.message);}
});
for(const button of document.querySelectorAll('[data-weapon]'))button.addEventListener('click',()=>{
  if(!canControl()||!game.canFire)return;
  weapon=button.dataset.weapon;
  loadouts[game.currentTurn].weapon=weapon;
  input.clear();
  hud.selectWeapon(weapon);
});
$('fireBtn').addEventListener('click',()=>{send({type:'fire',weapon});hud.close();});
$('cancelOrbital').addEventListener('click',()=>send({type:'cancelOrbital'}));
$('shotPower').addEventListener('input',()=>send({type:'power',power:Number($('shotPower').value)/100}));
$('fuseToggle').addEventListener('click',()=>{
  if(!canControl()||!game.canFire)return;
  fuseSeconds=game.activePlayer.grenadeFuse===4?2:game.activePlayer.grenadeFuse+1;
  loadouts[game.currentTurn].fuse=fuseSeconds;
  send({type:'fuse',seconds:fuseSeconds});
});
$('connect').addEventListener('click',async()=>{
  if(loading||!assetsReady||connecting)return;
  const unavailable=pvpUnavailableReason();if(unavailable){status(unavailable);return;}
  const name=$('room').value.trim();if(!name){status('Escribe una sala');return;}
  connecting=true;$('connect').disabled=true;$('room').disabled=true;mode.disabled=true;levelSelect.disabled=true;
  const attempt=++connectionAttempt;
  let pending=null;
  try {
    await selectLevel(LEVELS[levelSelect.value]);
    if(attempt!==connectionAttempt)return;
    pending=await connectPvp(name,{
      onStatus:status,
      onReady:value=>{
        if(attempt!==connectionAttempt){value.close();return;}
        session=value;connected=true;connecting=false;receivedSequence=-1;input.clear();
        applyStyles();styles.refresh();
        if(!session.isHost)session.sendCommand({type:'appearance',appearance:styles.getOnline()});
        levelSelect.disabled=!session.isHost;$('reset').disabled=!session.isHost;
        status(session.isHost?'Conectado · P1 · anfitrión':'Conectado · P2');
        setPlaying(true);
      },
      onCommand:(command,index)=>{
        if(command?.type==='appearance'){
          remoteAppearance=normalizeAppearance(command.appearance);
          if(game)game.command(index,{type:'appearance',appearance:remoteAppearance});
        }else if(game&&!loading&&command?.epoch===epoch){
          if(Number.isInteger(command.commandSeq))ackCommandSeq=Math.max(ackCommandSeq,command.commandSeq);
          game.command(index,command);
        }
      },
      onState:async packet=>{
        if(!packet||!Number.isInteger(packet.sequence)||packet.sequence<=receivedSequence||!LEVELS[packet.state?.levelId])return;
        receivedSequence=packet.sequence;
        const source=await getSource(LEVELS[packet.state.levelId]);
        if(packet.sequence!==receivedSequence||!connected)return;
        if(!game||game.level.id!==packet.state.levelId||packet.epoch!==epoch){
          input.clear();prediction.reset();game=createGame(LEVELS[packet.state.levelId],source);epoch=packet.epoch;
          canvas.width=game.level.width;canvas.height=game.level.height;levelSelect.value=game.level.id;
          updateSetup();
        }
        const changedTurn=game.turnId!==packet.state.turnId;
        prediction.reconcile(game,packet,session.playerIndex,session.latency||0);
        // Retry until acknowledged, including the first peer handshake and resets.
        if(JSON.stringify(game.players[session.playerIndex].appearance)!==JSON.stringify(styles.getOnline()))
          session.sendCommand({type:'appearance',appearance:styles.getOnline()});
        if(changedTurn)input.clear();
      },
      onLeave:()=>{setPlaying(false);disconnect();mode.disabled=false;status('Rival desconectado. Puedes volver a entrar.');}
    });
    if(attempt!==connectionAttempt)pending.close();else session=pending;
  }catch(error){pending?.close();disconnect();mode.disabled=false;status('Error de conexión: '+error.message);}
});
$('leave').addEventListener('click',()=>{setPlaying(false);disconnect();mode.disabled=false;status('Desconectado');});
function frame(now){
  const elapsed=lastTime?Math.min((now-lastTime)/1000,.25):0;lastTime=now;
  const running=playing&&game&&!loading&&(mode.value!=='pvp'||connected);
  input.update(elapsed);
  if(canControl()&&game.canFire){
    const selected=loadouts[game.currentTurn];
    if(weapon!==selected.weapon){weapon=selected.weapon;hud.selectWeapon(weapon);}
    fuseSeconds=selected.fuse;
    if(game.activePlayer.equipped!==weapon)send({type:'equip',weapon});
    if(game.activePlayer.grenadeFuse!==fuseSeconds)send({type:'fuse',seconds:fuseSeconds});
  }
  if(running&&(authoritative()||prediction.ready)){
    accumulator+=elapsed;
    while(accumulator>=FIXED_STEP){
      const turn=game.turnId;
      if(mode.value==='ai')computer.update(game,FIXED_STEP);
      game.step();accumulator-=FIXED_STEP;
      if(game.turnId!==turn)input.clear();
    }
    if(connected&&authoritative()&&now-lastBroadcast>=100){session.sendState({epoch,sequence:++sequence,ackCommandSeq,state:game.snapshot()});lastBroadcast=now;}
  }else accumulator=0;
  if(game){
    const rect=canvas.getBoundingClientRect(),ratio=Math.min(window.devicePixelRatio||1,1.5);
    const width=Math.max(1,Math.round(rect.width*ratio)),height=Math.max(1,Math.round(rect.height*ratio));
    if(canvas.width!==width)canvas.width=width;if(canvas.height!==height)canvas.height=height;
    camera.resize(rect.width,rect.height);camera.update(game,elapsed);
    canvas.dataset.worldWidth=game.level.width;canvas.dataset.worldHeight=game.level.height;
    prediction.update(elapsed);
    renderGame(canvas,game,{camera,time:now,view:connected&&!authoritative()?prediction.view(game):null,weapon,teleportPreview:input.teleportPreview});
    $('cameraZoom').textContent=`${Math.round(camera.zoom*100)}%`;
    const p=game.activePlayer;
    $('turnBadge').textContent=game.gameOver?(game.winner===null?'EMPATE':`¡Gana el equipo ${game.winner===0?'azul':'rojo'}!`):
      game.introRemaining?'Sorteando quién inicia…':game.escaping?'¡Aléjate! '+Math.ceil(game.turnTimer)+' s':game.players.some(p=>p.transit)?'Teletransportando…':game.resolving?'Resolviendo disparo…':`${mode.value==='ai'&&game.currentTurn===1?'IA (Rojo)':p.name} · ${Math.max(0,game.turnTimer).toFixed(1)} s`;
    $('turnBadge').style.backgroundColor=game.gameOver?(game.winner===null?'#555':game.players[game.winner].color):p.color;
    results.update(game,now,{playing,mode:mode.value,localIndex:mode.value==='pvp'?(session?.playerIndex??0):0,canRestart:mode.value!=='pvp'||!!session?.isHost});
  }
  $('fireBtn').disabled=!canControl()||!game?.canFire||weapon==='teleport';
  if(game){hud.update(game,canControl());coin.update(game,playing&&(authoritative()||prediction.ready));}
  $('startGame').disabled=loading||!assetsReady||!game;
  $('connect').disabled=loading||!assetsReady||connecting||connected;
  levelSelect.disabled=loading||connecting||(connected&&!session?.isHost);
  for(const button of document.querySelectorAll('[data-level-card]'))button.disabled=levelSelect.disabled;
  requestAnimationFrame(frame);
}
$('lobby').hidden=mode.value!=='pvp';
updateSetup();
try{await Promise.all([loadCharacterAssets(),loadScenery(),loadCombatArt()]);assetsReady=true;styles.preview();await selectLevel(LEVELS.crab);}catch(error){status(error.message);}
requestAnimationFrame(frame);
