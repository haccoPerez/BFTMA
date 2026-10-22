// Transport only: game rules stay in engine/game.js.
// Lower peer ID is authoritative. The guest predicts locally; the host validates.
export function pvpUnavailableReason(){
  if(!globalThis.isSecureContext||!globalThis.crypto?.subtle)
    return 'El PvP requiere HTTPS. Abre el juego desde una dirección HTTPS en ambos dispositivos; HTTP por IP local no permite el cifrado de la conexión. Localhost solo sirve para pruebas en la misma PC.';
  if(typeof globalThis.RTCPeerConnection!=='function')
    return 'Este navegador no dispone de WebRTC para conectar el PvP.';
  return '';
}
export async function connectPvp(roomName,{onStatus,onReady,onCommand,onState,onLeave}) {
  const unavailable=pvpUnavailableReason();
  if(unavailable)throw new Error(unavailable);
  const {joinRoom,selfId}=await import('https://esm.run/trystero@0.26.0');
  const room=joinRoom({appId:'bftma-teams-arsenal-v9'},roomName);
  const hello=room.makeAction('hello');
  const command=room.makeAction('command');
  const state=room.makeAction('state');
  const ping=room.makeAction('ping'),pong=room.makeAction('pong');
  let peer=null,host=false,closed=false,latency=0,pingTimer=null,stateBusy=false,latestState=null;
  async function flushState(){
    if(stateBusy||!peer||!host||closed)return;
    stateBusy=true;
    try{while(latestState&&!closed){const value=latestState;latestState=null;await state.send(value,{target:peer});}}
    catch{if(!closed)onStatus('La conexión se está recuperando…');}
    finally{stateBusy=false;}
  }
  const session={
    get playerIndex(){return host?0:1;},get isHost(){return host;},
    get latency(){return latency;},
    sendCommand:data=>{if(peer)command.send(data,{target:peer});},
    sendState:data=>{if(peer&&host){latestState=data;void flushState();}},
    close:()=>{if(closed)return;closed=true;clearInterval(pingTimer);latestState=null;peer=null;room.leave();}
  };
  function ready(id){
    if(closed || (peer&&peer!==id))return;
    if(!peer){peer=id;host=selfId<peer;pingTimer=setInterval(()=>{if(!closed)ping.send(performance.now(),{target:peer});},1000);onReady(session);}
  }
  room.onPeerJoin=id=>{if(!closed&&!peer)hello.send({version:9},{target:id});};
  // The hello also handles a peer event arriving before the other side is ready.
  hello.onMessage=(data,{peerId})=>{if(!closed&&data?.version===9&&!peer){ready(peerId);if(!closed)hello.send({version:9},{target:peerId});}};
  ping.onMessage=(stamp,{peerId})=>{if(!closed&&peerId===peer)pong.send(stamp,{target:peer});};
  pong.onMessage=(stamp,{peerId})=>{if(!closed&&peerId===peer&&Number.isFinite(stamp)){const measured=Math.max(0,Math.min(250,(performance.now()-stamp)/2));latency=latency?latency*.7+measured*.3:measured;}};
  command.onMessage=(data,{peerId})=>{if(peerId===peer&&host)onCommand(data,1);};
  state.onMessage=(data,{peerId})=>{if(peerId===peer&&!host)onState(data);};
  room.onPeerLeave=id=>{if(id===peer){peer=null;session.close();onLeave();}};
  onStatus('Buscando rival…');
  return session;
}
