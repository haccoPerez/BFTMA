// Installation and presentation only; the game stays a static vanilla app.
const $=id=>document.getElementById(id);
let installPrompt=null,installedThisSession=false;
const installed=()=>installedThisSession||matchMedia('(display-mode: standalone)').matches||matchMedia('(display-mode: fullscreen)').matches||navigator.standalone===true;
function refresh(){
  $('installApp').hidden=installed();
  for(const button of [$('menuFullscreen'),$('gameFullscreen')]){
    button.hidden=!document.fullscreenEnabled;
    button.textContent=document.fullscreenElement?'Salir de pantalla completa':'Pantalla completa';
  }
}
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;refresh();});
window.addEventListener('appinstalled',()=>{installPrompt=null;installedThisSession=true;refresh();});
matchMedia('(display-mode: standalone)').addEventListener('change',refresh);
document.addEventListener('fullscreenchange',refresh);
async function fullscreen(){
  try{
    if(document.fullscreenElement){await document.exitFullscreen();return;}
    await document.documentElement.requestFullscreen();
    try{await screen.orientation?.lock?.('landscape');}catch{/* Rotate manually when the browser does not support locking. */}
  }catch{
    $('installHelpText').textContent='El navegador no permitió pantalla completa. Puedes instalar el juego desde su menú para abrirlo sin la barra de dirección.';
    $('installHelp').showModal();
  }
}
for(const button of [$('menuFullscreen'),$('gameFullscreen')])button.addEventListener('click',fullscreen);
$('installApp').addEventListener('click',async()=>{
  if(installPrompt){
    const prompt=installPrompt;installPrompt=null;
    try{await prompt.prompt();await prompt.userChoice;}catch{/* Keep the manual installation instructions available. */}
    refresh();return;
  }
  const ios=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  $('installHelpText').textContent=ios?
    'En Safari abre Compartir → Añadir a pantalla de inicio y activa Abrir como app web si aparece. Después inicia BFTMA desde su icono. Gira el dispositivo para jugar en horizontal.':
    'Abre el menú del navegador y elige Instalar aplicación o Añadir a pantalla de inicio. Después abre BFTMA desde su icono. Si no aparece la opción, visita la versión HTTPS y espera a que termine de cargar.';
  $('installHelp').showModal();
});
$('closeInstallHelp').addEventListener('click',()=>$('installHelp').close());
refresh();
if('serviceWorker' in navigator&&isSecureContext){
  window.addEventListener('load',()=>{
    navigator.serviceWorker.register(new URL('../../sw.js',import.meta.url),{updateViaCache:'none'})
      .catch(error=>console.warn('No se pudo preparar el juego sin conexión:',error));
  });
}
