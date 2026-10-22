import {ARSENAL} from './arsenal.js';
const AIMED=new Set(['projectile','ray','beam','tunnel','airstrike','burst','shotgun','orbital']);
export function firingAngle(player,weapon,tick){
  if(!(player.tremorTurns>0)||!AIMED.has(ARSENAL[weapon]?.kind))return player.angle;
  return player.angle+Math.sin(tick*Math.PI/36+player.id*.7)*(4*Math.PI/180);
}
