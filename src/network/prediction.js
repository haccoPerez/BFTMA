// The guest simulates the same fixed step. Snapshots reconcile gameplay;
// short visual offsets hide small corrections without changing hit positions.
export function createPrediction(){
  let ready=false,pending=[],number=0,lastTurn=-1,offsets=new Map();
  const key=(kind,item)=>kind+item.id;
  const entities=game=>[...game.players.map(p=>['c',p]),...game.projectiles.map(p=>['p',p])];
  return {
    get ready(){return ready},
    reset(){ready=false;pending=[];number=0;lastTurn=-1;offsets.clear();},
    command(game,team,command){
      const data={...command,commandSeq:++number};
      pending.push(data);if(pending.length>120)pending.shift();
      game.command(team,data);return data;
    },
    reconcile(game,packet,team,latency=0){
      const old=new Map(entities(game).map(([kind,p])=>{const off=offsets.get(key(kind,p));return [key(kind,p),{x:p.x+(off?.x||0),y:p.y+(off?.y||0)}];}));
      const fresh=!ready||packet.epoch!==this.epoch;
      game.restore(packet.state);
      pending=pending.filter(cmd=>cmd.commandSeq>(packet.ackCommandSeq||0)&&cmd.epoch===packet.epoch&&cmd.turnId===game.turnId);
      // Replay only unacknowledged commands; confirmed shots are never fired twice.
      for(const cmd of pending)game.command(team,cmd);
      const catchup=Math.min(12,Math.max(0,Math.round(latency*60/1000)));
      for(let i=0;i<catchup;i++)game.step();
      offsets=new Map();
      if(!fresh&&lastTurn===game.turnId)for(const [kind,p] of entities(game)){
        const before=old.get(key(kind,p));if(!before)continue;
        const dx=before.x-p.x,dy=before.y-p.y;
        // Teleports and very large corrections must snap instead of gliding.
        if(Math.hypot(dx,dy)<110)offsets.set(key(kind,p),{x:dx,y:dy});
      }
      lastTurn=game.turnId;ready=true;this.epoch=packet.epoch;
    },
    update(dt){const decay=Math.exp(-22*dt);for(const [id,off] of offsets){off.x*=decay;off.y*=decay;if(Math.hypot(off.x,off.y)<.1)offsets.delete(id);}},
    view(game){
      if(!ready)return game;
      const moved=(kind,p)=>{const off=offsets.get(key(kind,p));return off?{...p,x:p.x+off.x,y:p.y+off.y}:p;};
      // Keep a stable game identity for the camera and result animation.
      return {players:game.players.map(p=>moved('c',p)),projectiles:game.projectiles.map(p=>moved('p',p))};
    }
  };
}
