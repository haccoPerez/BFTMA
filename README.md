# BFTMA

Juego de artillería por turnos con terreno destructible. El modo local y el online usan el mismo motor y la misma interfaz.

## Publicar en hosting estático

El juego es HTML, CSS y JavaScript vanilla. No requiere Node.js, npm, compilación ni instalar herramientas en el hosting.

Sube `index.html`, `index_pvp.html`, `src/` y `assets/` a la misma carpeta pública, conservando su estructura. Abre la URL de `index.html`. Las referencias son relativas y también permiten publicarlo en una subcarpeta. El hosting debe servir los archivos `.js` como JavaScript y es preferible usar HTTPS para el modo online.

El navegador carga los módulos directamente con `<script type="module">`. Para probar localmente puedes usar cualquier servidor estático que ya tengas disponible. Abrir el HTML con `file://` no es compatible con la carga de módulos y lectura del alfa del terreno.

Selecciona modo, terreno, arma y dispara. A/D o flechas para moverse; W, espacio o flecha arriba para saltar. Arrastra el círculo de apuntado hacia atrás, como una resortera: el disparo sale en dirección contraria al arrastre. La distancia del arrastre no cambia la potencia; se dispara con el botón ¡Fuego! También hay botones táctiles. La bazooka describe una parábola con gravedad suave (0.12 por paso de simulación); el limón conserva su gravedad de 0.25 y sus rebotes.

## Menú de preparación

Al abrir el juego aparece el menú, con selección de modo, dificultad (solo contra IA), terreno con vista previa y personalización del personaje. El reloj, la IA y los controles de combate permanecen detenidos hasta empezar. El menú se puede desplazar y se adapta a pantallas pequeñas.

Las pestañas **Jugar**, **Personaje** y **Arsenal** separan la preparación en móvil. Los terrenos se pueden elegir desde sus tarjetas ilustradas o el selector; el resumen indica modo y mapa. El botón de inicio queda en el pie fijo al desplazarse. Arsenal muestra las armas disponibles, pero elegir un inventario personalizado sigue pendiente.

Para Local o Contra IA pulsa **Iniciar partida**. Para Online escribe la sala y pulsa **Conectar y jugar** en ambos dispositivos; la partida empieza al encontrar al rival y el mapa del anfitrión se replica al invitado. Puedes cancelar la búsqueda. Los ajustes de partida están en el menú, mientras que el HUD conserva armas, disparo, reinicio y el botón **Menú**.

Volver al menú termina la sesión actual: detiene la simulación, limpia las entradas y cierra la conexión si era online. La siguiente partida empieza con vida y tiempo completos usando las opciones elegidas. Las apariencias y dificultad guardadas se conservan. La sección **Arsenal** es un espacio reservado deshabilitado; las tres armas actuales siguen disponibles para ambos jugadores.

## Cámara y capas visuales

La cámara empieza acercada y sigue al personaje activo; al disparar sigue el proyectil y después pasa al siguiente personaje. Se adapta al tamaño de pantalla sin reducir todo el mapa a una miniatura en móvil. Los sprites mantienen el mismo tamaño de mundo y el apuntado convierte las coordenadas de pantalla con la transformación inversa de la cámara. Durante el arrastre de apuntado se mantiene fija para evitar que el movimiento de cámara cambie el ángulo.

Durante el vuelo, el proyectil puede recorrer una zona central antes de desplazar la cámara. El seguimiento usa su posición, sin anticiparse según la velocidad para evitar tirones al rebotar. Tras un impacto conserva el encuadre durante 0.85 s (0.35 s si el proyectil desaparece sin destruir terreno) y luego se desplaza suavemente al siguiente personaje. El seguimiento no cambia el zoom y respeta la exploración manual hasta pulsar Seguir.

- Rueda del ratón o botones **+ / −**: acercar y alejar.
- Arrastrar una zona vacía: explorar el mapa sin mover personajes.
- Dos dedos en móvil: zoom con pinza y desplazamiento.
- **Ver mapa**: encuadrar todo el terreno.
- **Seguir**: recuperar el seguimiento automático; al volver desde la vista general se restaura el acercamiento.

La vista es local a cada navegador, independiente del estado PvP. Se limita la resolución interna a un máximo de 1.5 veces los píxeles CSS para contener el coste de renderizado en pantallas de alta densidad.

`assets/backgrounds/puerto-tampico.png` es la imagen decorativa del fondo. `src/ui/scenery.js` la dibuja detrás del terreno y dibuja agua animada por delante de la parte baja del mapa. `scenery.waterY` en cada nivel fija la altura del agua. Ambas capas son solo visuales: no forman parte de la máscara, no cambian el daño ni añaden ahogamiento; las reglas de caída siguen siendo las existentes. La cámara vive en `src/ui/camera.js` y los terrenos conservan su resolución de colisión original.

## Controles de combate para móvil

El HUD reserva la esquina inferior izquierda para moverse y saltar, con botones táctiles de 58 px. A la derecha quedan el arma equipada y un botón circular de fuego de 88 px. En horizontal de poca altura se compactan manteniendo blancos táctiles amplios. Se respetan las áreas seguras de pantallas con recortes y el alto dinámico del navegador móvil.

Pulsa el icono del arma para abrir una bandeja de tres opciones grandes; elegir una actualiza el icono y el nombre y cierra la bandeja. El botón de fuego indica si es tu turno, si hay un proyectil en vuelo o si terminó la partida. La cabecera solo muestra el turno y los accesos a cámara y opciones. Zoom, vista general y seguimiento están dentro del botón de cámara; Reiniciar y Volver al menú están en Opciones. Solo se abre un panel a la vez, y tocar el campo o pulsar Escape lo cierra.

La lógica de presentación está en `src/ui/battle-hud.js`; las reglas de disparo, turnos, física y teclado se conservan en sus módulos existentes.

## Organización

- `src/engine/game.js`: reglas, física a 60 pasos por segundo, armas, turnos y estado serializable.
- `src/engine/terrain.js`: imagen mutable, máscara de colisión, destrucción y registro de operaciones.
- `src/engine/combat.js`: vida y reglas de daño de las armas.
- `src/characters/catalog.js`: identificadores y validación de apariencias.
- `src/ui/characters.js`: carga de sprites y composición del personaje con su accesorio.
- `src/ui/customization.js`: selector, vista previa y preferencias locales.
- `src/ui/preparation.js`: navegación del menú y tarjetas de terrenos.
- `src/ui/results.js`: victoria/derrota/empate y presentación animada del resultado.
- `src/ui/combat-art.js`: sprites de proyectiles, perforación y tumbas.
- `src/ui/`: renderizado Canvas, teclado/táctil y estilos. No contiene reglas de juego ni transporte.
- `src/network/pvp.js`: conexión Trystero y envío de comandos/estado. No simula física.
- `src/levels/index.js`: catálogo de niveles y carga de sus fuentes visuales.
- `src/app.js`: conecta los módulos, administra la sesión y ejecuta el bucle.
- `assets/terrains/`: imágenes de terreno.
- `examples/tictactoe.html`: antigua prueba independiente de tres en raya.
- `index_pvp.html`: acceso compatible que redirige a `index.html?mode=pvp`.

## Cambiar el terreno por referencia

```js
import {LEVELS, loadLevelSource} from './src/levels/index.js';
import {createGame} from './src/engine/game.js';

const level = LEVELS.islands; // o LEVELS.crab
const game = createGame(level, await loadLevelSource(level));
```

Cada definición tiene `id`, `name`, `width`, `height`, `image` y dos `spawns`. El alfa mayor a 128 indica terreno sólido; el espacio transparente es aire. Cada partida crea su propia copia mutable: destruir o reiniciar no altera la definición ni la imagen original.

El nivel **Cangrejo azul** utiliza la imagen original. **Islas gemelas** utiliza `assets/terrains/islas-gemelas-v2.png`: dos islas de arena y roca, una palmera, un puente de madera, terrazas a distintas alturas, pilares para cubrirse y arcos con huecos transparentes. Su mundo mide 1920×1080 frente a los 1280×720 del mapa original; los personajes conservan su tamaño y velocidad en unidades de mundo. Toda la silueta opaca, incluido el puente y la palmera, es terreno destructible. Para añadir otro PNG basta registrar otra definición; no hay que copiar el motor.

`LEVELS.islands.teamSpawns` reserva cinco posiciones distintas por color, distribuidas en las terrazas y ajustadas a la máscara real. Es preparación del mapa para equipos de 3–5 personajes; el motor actual sigue creando un personaje por color desde `spawns`. La selección de personajes y rotación dentro del equipo aún no están implementadas. La imagen plana anterior se conserva como referencia.

**Carguero de Tampico** (`LEVELS.ship`) es un terreno de 1920×1080 inspirado en un barco de contenedores del puerto: cabina, pilas de carga a varias alturas, cubiertas y huecos en el casco. Usa `assets/terrains/carguero-tampico.png` con alfa real; el barco completo es destructible. Tiene cinco posiciones reservadas por equipo y dos apariciones iniciales comprobadas contra la máscara. Está disponible en el menú para local, IA y PvP. Cada definición de nivel incluye también `description`, que el menú muestra sin lógica específica por mapa.

## Vida y combate

Cada personaje empieza con 100 de vida, visible en una barra y un contador. Bazooka: máximo 50 de daño y radio de daño 90; limón: máximo 40 y radio 70; tornillo: 35 a cada rival que atraviese su túnel de 220 unidades. Los valores están centralizados en `src/engine/combat.js`. Las explosiones dañan según distancia al borde del personaje, incluyendo al tirador si está cerca; el terreno no bloquea el daño dentro del radio. Los proyectiles explotan al tocar un personaje; el limón conserva los rebotes contra terreno. El tornillo no daña al propio tirador.

El reloj y las acciones del siguiente jugador esperan mientras se resuelve el proyectil. Al llegar a cero de vida o caer fuera del mapa, el personaje queda eliminado. Gana el último superviviente; si ambos mueren se declara empate. La partida se detiene y se puede usar Reiniciar (en online lo controla el anfitrión). La vida, las eliminaciones y el resultado se replican junto con el resto del estado PvP.

Los impactos también empujan: las explosiones alejan al personaje del centro con una pequeña elevación y fuerza decreciente según distancia; el tornillo lo desplaza en la dirección de perforación. El impulso se frena gradualmente, respeta paredes y techos y afecta a ambos jugadores aunque no tengan el turno. Sus velocidades se replican en PvP. La intensidad se ajusta con `knockback` en las reglas de cada arma.

## Imágenes de armas, tumbas y resultado

`assets/effects/combat-atlas.png` contiene cohete, limón, taladro y lápida con transparencia. El renderizador usa regiones independientes, ajustadas a sus límites alfa, y reutiliza el mismo arte en la bandeja de armas y el menú Arsenal. El cohete gira con su velocidad, el limón rota durante el vuelo y el tornillo, que sigue siendo instantáneo en las reglas, muestra una perforación visual de 0.3 s. Ninguna imagen cambia los radios de impacto o el daño.

Al morir se guarda `player.death` con posición y causa. Una lápida pequeña reemplaza al personaje; si hay suelo debajo se apoya en él y, en una caída fuera del mundo, utiliza `lastGrounded`. Es decorativa, no bloquea disparos ni movimiento, se replica con el estado y desaparece al reiniciar. `lastShot` permite sincronizar también el efecto visual del tornillo.

Después de terminar la partida se deja un segundo para ver el impacto y la tumba, y aparece el resultado. En local se anuncia el equipo ganador; contra IA y en PvP se presenta victoria o derrota desde la perspectiva local. Incluye celebración con movimiento y confeti, presentación de derrota, empate, resumen de vida y accesos a Otra partida o Volver al menú. El invitado online solo puede volver al menú; el anfitrión controla el reinicio. Las animaciones respetan `prefers-reduced-motion`.

## Contra la computadora

Selecciona **Contra IA** en el menú: P1 azul es humano y P2 rojo lo controla la computadora. Funciona en el navegador, sin servicios de IA, claves ni conexiones adicionales. El modo local y el PvP siguen disponibles. El selector de dificultad aparece solo en este modo y se guarda localmente; el valor inicial es Fácil. Se elige antes de iniciar la partida.

| Dificultad | Desviación de puntería | Comportamiento |
|---|---|---|
| Fácil | Hasta 8° | Equivale al anterior Normal: reacciona en 1 s, evalúa 48 ángulos y varias jugadas. |
| Normal | Hasta 5° | Reacciona en 0.85 s, evalúa 64 ángulos y reduce las decisiones subóptimas. |
| Difícil | Hasta 1.2° | Reacciona en 0.65 s, evalúa todos los ángulos de la búsqueda y elige la mejor opción. |

La desviación se aplica al ángulo final después de la búsqueda, también al tornillo. Las dificultades conservan la misma vida, daño, velocidad y reglas. Los parámetros están en `DIFFICULTIES` dentro de `src/engine/ai.js`.

`src/engine/ai.js` evalúa ángulos para bazooka y limón, incluidos los rebotes, y comprueba si el tornillo alcanza al rival. Puntúa el daño esperado y penaliza el daño propio. Antes de atacar intenta reposicionarse durante 1 s en Fácil, 1.35 s en Normal y 1.5 s en Difícil: se acerca si está lejos y se aleja si está dentro de 190 unidades. Comprueba varios puntos de suelo delante; si encuentra un hueco intenta la dirección opuesta o se queda quieta. Salta ante obstáculos con espacio encima. Tras moverse recalcula el tiro desde la posición real. Espera brevemente antes de actuar y respeta turnos, reloj, muerte y resolución de proyectiles; usa exclusivamente los comandos normales del motor.

La predicción reutiliza `src/engine/projectiles.js`, el mismo avance de proyectiles de la partida, sin modificar el terreno. Es una primera IA heurística: considera las posiciones actuales para calcular el tiro, sin anticipar toda la física del rival, no planifica rutas complejas ni explora varias jugadas futuras.

## Personaje y personalización

El primer personaje es un mapache con pose estática que mira hacia la dirección de apuntado. El PNG base transparente está en `assets/characters/raccoon.png`; los accesorios están separados en `assets/characters/accessories.png`, una hoja 2×2: casco, sombrero, peluca y moño. El renderizador calcula los límites alfa de cada celda al cargarla y compone el accesorio sobre la cabeza sin modificar las imágenes originales. Los prompts de generación están junto a las imágenes. La animación de caminar y saltar queda para una siguiente fase.

Abre **Apariencia** para elegir accesorio o dejarlo vacío, escribir un apodo de hasta 16 caracteres y ver el resultado. En local se puede personalizar P1 y P2 por separado; en online se edita únicamente el propio personaje. Un aro y la etiqueta P1/P2 conservan el color del equipo aunque ambos usen el mismo accesorio. La apariencia no altera vida, radio de colisión ni daño.

Las preferencias locales y el perfil online se guardan por separado en `localStorage` bajo `bftma.appearance.v1`. Si el almacenamiento no está disponible se puede seguir jugando y personalizando durante la sesión. Los reinicios y cambios de nivel conservan la elección.

En PvP se envían solo identificadores de personaje/accesorio y apodo; cada navegador carga los mismos PNG estáticos. El anfitrión valida y asigna la apariencia al índice del remitente, independientemente de quién tenga el turno. El invitado reenvía su elección hasta verla confirmada en el estado replicado. No puede cambiar la apariencia del rival mediante el mensaje. Ambos clientes deben tener esta versión (sala interna `bftma-shared-engine-v2`).

## PvP

Abre el modo online en dos navegadores y usa la misma sala. Requiere Internet para cargar Trystero y conectar WebRTC. Para jugar entre dispositivos, ambos deben abrir una URL HTTPS con un certificado válido y reconocido por sus navegadores: HTTP por IP local no expone `crypto.subtle`, necesario para la señalización cifrada. `http://localhost` es una excepción del navegador útil para pruebas en una misma PC. El juego detecta esta limitación antes de intentar conectar. Basta un hosting estático con HTTPS; no requiere instalar Node en el servidor.

El menor ID de peer es P1 y anfitrión; decide el terreno y los reinicios. El invitado envía entradas y el anfitrión ejecuta el mismo motor utilizado en local. Envía estados a 20 Hz con el historial de destrucción; el invitado replica jugadores, proyectiles y terreno sin simularlos por separado.

Los comandos incluyen turno y generación de partida para rechazar acciones antiguas. Los estados tienen secuencia creciente, incluso después de reiniciar o cambiar de mapa. Se filtran mensajes por rival y se cierra la sesión al desconectarse. No existe reconexión automática; vuelve a conectar ambos dispositivos para empezar otra partida.

Limitaciones: el anfitrión es de confianza, la réplica no interpola y reenvía el historial completo de destrucción (adecuado para el prototipo; conviene compactarlo para partidas largas). Trystero se carga desde el CDN con versión fijada a 0.26.0. Todavía hay un personaje por equipo.

## Instalar como app (PWA)

El proyecto incluye `manifest.webmanifest`, `sw.js` y los iconos en `assets/icons/`. Se publica directamente en GitHub Pages sin compilar ni instalar herramientas en el hosting. Las rutas son relativas: funciona también en `https://usuario.github.io/repositorio/`. Sube `index.html`, `index_pvp.html`, `manifest.webmanifest`, `sw.js`, `src/` y `assets/` conservando la estructura.

En Android/Chrome, pulsa **Instalar** en el menú del juego o usa la opción de instalación del navegador. En iPhone/iPad, abre Safari → Compartir → Añadir a pantalla de inicio (activa Abrir como app web cuando aparezca). Inicia el juego desde su icono para eliminar la barra de dirección. El manifiesto solicita pantalla completa y orientación horizontal; cada sistema decide qué admite. También hay un botón **Pantalla completa** en el menú y las opciones de partida cuando el navegador lo permite.

Después de la primera carga y de terminar la descarga de los recursos, el service worker permite jugar local y contra IA sin Internet. El PvP requiere Internet y HTTPS. En HTTP por IP local, el juego sigue funcionando pero el navegador no habilita instalación/caché segura ni el cifrado del PvP.

Al publicar cambios, incrementa `v1` en `sw.js`. El worker nuevo espera a que se cierren las ventanas del juego antes de activarse, para evitar una recarga durante una partida. Al volver a abrirlo se usa la actualización. Los cambios de recursos también se consultan por red al estar conectado.

Prueba opcional de PWA: `node --test tests/pwa.test.cjs`. Verifica rutas de repositorio, iconos, controles de pantalla completa y partidas local/IA sin conexión.

## Herramientas opcionales de desarrollo

La orientación principal del juego en móviles es horizontal (landscape). El menú distribuye la configuración y los mapas en dos columnas, la personalización aprovecha el ancho y los resultados usan una presentación compacta para pantallas de poca altura.

`tools/` y `tests/` son herramientas locales opcionales y no se suben al hosting. El juego no las importa ni depende de ellas. Si tienes Node.js, `node tools/server.cjs` ofrece una vista local en http://localhost:8080.

Para ejecutar las pruebas automatizadas opcionales, instala Playwright desde `tools/` y ejecuta `npm test` allí. Si Playwright está en otro directorio, define `BFTMA_NODE_MODULES` con la ruta de su `node_modules`. Para usar Chrome instalado, define `BFTMA_BROWSER_CHANNEL=chrome`.

Las pruebas cubren carga de interfaz, selección y reinicio del segundo nivel, aislamiento de terreno, destrucción, proyectiles, expiración de turno, rechazo de comandos fuera de turno y réplica de estado. También abren dos pestañas con un transporte local de prueba que sustituye únicamente a Trystero para verificar el adaptador PvP: conexión, cambio de nivel, disparos alternados, reinicio y desconexión. La conectividad WebRTC entre redes reales requiere una prueba manual con dos dispositivos.

`ANALISIS_Y_GDD_GODOT.md` conserva la propuesta histórica previa a esta reorganización; su inventario de archivos ya no describe la estructura actual.
#   B F T M A  
 