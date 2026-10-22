import {ARSENAL} from './arsenal.js';
import {damagePlayer,knockback} from './combat.js';

// All timing is simulation time, so both PvP clients see the same sequence.
export function createOrbitalSystem({players,terrain,height,effect}){
  const state={markers:[],strike:null};
  const markerFor=team=>state.markers.find(m=>m.team===team);
  const targetFor=m=>players.find(p=>p.id===m.targetId&&p.alive);
  function arm(projectile,x,y,turn){
    if(markerFor(projectile.team))return;
    state.markers.push({team:projectile.team,x,y,age:0,targetId:null,attached:false,readyTurn:turn+2,grey:false});
  }
  function ready(team,turn){const m=markerFor(team);return !!(m&&turn>=m.readyTurn);}
  function call(team,turn){
    if(!ready(team,turn)||state.strike)return false;
    const m=markerFor(team),p=m.attached?targetFor(m):null;
    state.strike={team,targetId:p?.id??null,x:p?.x??m.x,y:p?.y??m.y,age:0,hit:false};
    state.markers.splice(state.markers.indexOf(m),1);return true;
  }
  function cancel(team){const m=markerFor(team);if(!m||state.strike)return false;state.markers.splice(state.markers.indexOf(m),1);return true;}
  function step(){
    for(const m of state.markers){
      m.age++;
      let target=targetFor(m);
      if(m.targetId&&!target){m.targetId=null;m.attached=false;}
      if(!target){
        target=players.filter(p=>p.alive&&p.team!==m.team&&Math.hypot(p.x-m.x,p.y-12-m.y)<=ARSENAL.orbital.lockRange)
          .sort((a,b)=>Math.hypot(a.x-m.x,a.y-12-m.y)-Math.hypot(b.x-m.x,b.y-12-m.y)||a.id-b.id)[0];
        if(target){m.targetId=target.id;m.jump={x:m.x,y:m.y,age:0};}
        else if(!m.grey){effect('orbital-fizzle',m.x,m.y,{radius:30,color:'#b6bac3',ttl:35});m.grey=true;}
      }
      if(target){
        if(!m.attached){
          m.jump.age++;const t=Math.min(1,m.jump.age/24);
          m.x=m.jump.x+(target.x-m.jump.x)*t;m.y=m.jump.y+(target.y-22-m.jump.y)*t-Math.sin(t*Math.PI)*48;
          if(t===1){m.attached=true;delete m.jump;}
        }else{m.x=target.x;m.y=target.y-22;}
      }else if(m.y<height-6&&!terrain.isSolid(m.x,m.y+6))m.y+=2;
    }
    const s=state.strike;if(!s)return;
    s.age++;
    const target=players.find(p=>p.id===s.targetId&&p.alive);
    if(target&&!s.hit){s.x=target.x;s.y=target.y;}
    if(s.age>=180&&!s.hit){
      s.hit=true;
      const r=ARSENAL.orbital;
      // The concentrated column cuts through cover; allies in it also take damage.
      terrain.apply({type:'tunnel',args:[s.x,-100,s.x,height,r.beamWidth/2]});
      for(const p of players)if(p.alive&&Math.abs(p.x-s.x)<=r.beamWidth/2+p.radius&&p.y<=height){
        damagePlayer(p,r.maximum,'orbital');knockback(p,Math.sign(p.x-s.x)||1,-.5,r.knockback);
      }
      effect('explosion',s.x,s.y,{radius:70,color:'#a6eaff',ttl:45});
    }
    if(s.age>=240)state.strike=null;
  }
  return {state,markerFor,ready,arm,call,cancel,step,restore(value){
    state.markers.splice(0,state.markers.length,...structuredClone(value?.markers||[]));state.strike=structuredClone(value?.strike||null);
  }};
}
