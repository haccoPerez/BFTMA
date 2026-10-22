// Shared by simulation and rendering so the visible cloud matches its reach.
export function gasState(hazard){
  const progress=Math.min(1,Math.max(0,(hazard.age||0)/720));
  return {radius:90+170*progress,alpha:.32*(1-progress),damage:Math.max(1,Math.ceil(5*(1-progress)))};
}
export function hasGasMask(player,game){
  return game.projectiles.some(p=>p.type==='gas'&&p.team===player.team)||game.hazards.some(h=>h.type==='gas'&&h.team===player.team);
}
