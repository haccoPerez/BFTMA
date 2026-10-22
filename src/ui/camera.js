const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
export function createCamera(){
  let world=null,overview=false,snap=false,wasFlying=false,impactPause=0,flightOperations=0;
  const camera={x:0,y:0,zoom:1,width:1280,height:720,following:true,hold:false,
    get minZoom(){return world?Math.min(camera.width/world.level.width,camera.height/world.level.height):.2;},
    get defaultZoom(){return Math.max(camera.minZoom,Math.min(1.6,Math.max(1.15,camera.height/520)));},
    resize(width,height){
      if((width!==camera.width||height!==camera.height)&&camera.following)snap=true;
      camera.width=width;camera.height=height;if(world)camera.zoom=overview?camera.minZoom:clamp(camera.zoom,camera.minZoom,3.5);
    },
    screenToWorld(x,y){return {x:camera.x+(x-camera.width/2)/camera.zoom,y:camera.y+(y-camera.height/2)/camera.zoom};},
    worldToScreen(x,y){return {x:(x-camera.x)*camera.zoom+camera.width/2,y:(y-camera.y)*camera.zoom+camera.height/2};},
    zoomAt(factor,x=camera.width/2,y=camera.height/2){
      const before=camera.screenToWorld(x,y);camera.zoom=clamp(camera.zoom*factor,camera.minZoom,3.5);
      const after=camera.screenToWorld(x,y);camera.x+=before.x-after.x;camera.y+=before.y-after.y;
      overview=false;camera.following=false;
    },
    pan(dx,dy){camera.x-=dx/camera.zoom;camera.y-=dy/camera.zoom;overview=false;camera.following=false;},
    showMap(){if(!world)return;overview=true;camera.following=false;camera.zoom=camera.minZoom;camera.x=world.level.width/2;camera.y=world.level.height/2;},
    resume(){if(overview)camera.zoom=camera.defaultZoom;overview=false;camera.following=true;snap=true;impactPause=0;},
    update(game,dt){
      const fresh=world!==game;
      if(fresh){world=game;camera.zoom=camera.defaultZoom;camera.following=true;overview=false;wasFlying=false;impactPause=0;}
      const projectile=game.projectiles[0];
      if(projectile&&!wasFlying){flightOperations=game.terrain?.operations.length||0;impactPause=0;}
      if(!projectile&&wasFlying)impactPause=(game.terrain?.operations.length||0)>flightOperations ? 0.85 : 0.35;
      wasFlying=!!projectile;
      const target=projectile||game.players[game.gameOver&&game.winner!==null?game.winner:game.currentTurn];
      const paused=impactPause>0&&!projectile;
      impactPause=Math.max(0,impactPause-Math.min(dt,.1));
      if(camera.following&&!camera.hold&&!paused&&target){
        let x=target.x+(projectile?0:Math.cos(target.angle||0)*55),y=target.y-(projectile?0:50);
        if(projectile&&!fresh&&!snap){
          // Let shots travel within a central window before moving the scene.
          // No velocity look-ahead: bounces cannot instantly flip the camera.
          const position=camera.worldToScreen(target.x,target.y);
          x=camera.x+(position.x-clamp(position.x,camera.width*.38,camera.width*.62))/camera.zoom;
          y=camera.y+(position.y-clamp(position.y,camera.height*.35,camera.height*.62))/camera.zoom;
        }
        const alpha=fresh||snap?1:1-Math.exp(-(projectile?12:4)*Math.min(dt,.1));
        camera.x+=(x-camera.x)*alpha;camera.y+=(y-camera.y)*alpha;
        snap=false;
      }
      const halfWidth=camera.width/camera.zoom/2,halfHeight=camera.height/camera.zoom/2;
      camera.x=halfWidth>game.level.width/2?game.level.width/2:clamp(camera.x,halfWidth,game.level.width-halfWidth);
      if(!overview)camera.y=halfHeight>game.level.height/2?game.level.height/2:clamp(camera.y,-game.level.height+halfHeight,game.level.height-halfHeight);
    }
  };
  return camera;
}
