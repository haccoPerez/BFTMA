// Transport only: game rules stay in engine/game.js.
// Lower peer ID is authoritative. The guest sends commands, never physics.
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
  const room=joinRoom({appId:'bftma-shared-engine-v2'},roomName);
  const hello=room.makeAction('hello');
  const command=room.makeAction('command');
  const state=room.makeAction('state');
  let peer=null,host=false,closed=false;
  const session={
    get playerIndex(){return host?0:1;},get isHost(){return host;},
    sendCommand:data=>{if(peer)command.send(data,{target:peer});},
    sendState:data=>{if(peer&&host)state.send(data,{target:peer});},
    close:()=>{if(closed)return;closed=true;room.leave();}
  };
  function ready(id){
    if(closed || (peer&&peer!==id))return;
    if(!peer){peer=id;host=selfId<peer;onReady(session);}
  }
  room.onPeerJoin=id=>{if(!peer){ready(id);hello.send({version:1},{target:id});}};
  // The hello also handles a peer event arriving before the other side is ready.
  hello.onMessage=(data,{peerId})=>{if(data?.version===1)ready(peerId);};
  command.onMessage=(data,{peerId})=>{if(peerId===peer&&host)onCommand(data,1);};
  state.onMessage=(data,{peerId})=>{if(peerId===peer&&!host)onState(data);};
  room.onPeerLeave=id=>{if(id===peer){peer=null;session.close();onLeave();}};
  onStatus('Buscando rival…');
  return session;
}
