# BFTMA — Análisis del prototipo actual y GDD para port a Godot (Android)

> Documento generado a partir de la revisión directa de `index.html`, `index_pvp.html`, `pvp.html` y `fondo1.png` en la raíz del proyecto (no hay más código: no hay build system, ni backend, ni assets adicionales).

---

## 1. Qué es este proyecto hoy

Es un **prototipo técnico en HTML5 Canvas + JavaScript vanilla** de un juego de artillería por turnos estilo *Worms*, sin backend, sin build tools, servido como archivos estáticos. No hay `package.json`, framework ni bundler: todo vive inline en tres archivos `.html`.

| Archivo | Rol real |
|---|---|
| `index.html` | Prototipo **local**, 2 jugadores en el mismo dispositivo/pantalla, hot-seat por turnos. |
| `index_pvp.html` | Mismo motor de juego que `index.html`, pero con sincronización **P2P por WebRTC** (librería [Trystero](https://github.com/dmotz/trystero), señalización serverless vía red Nostr). |
| `pvp.html` | **No pertenece al juego.** Es un tres-en-raya P2P suelto, casi seguro usado para probar el patrón de conexión Trystero (`joinRoom`, `makeAction`, `onPeerJoin`) antes de aplicarlo al juego real. Es descartable o queda como referencia de la capa de red. |
| `fondo1.png` | Única imagen del juego: sirve como textura del terreno *y* como máscara de colisión (vía canal alfa). |

No hay: menú, pantalla de título, sonido, sistema de vidas/daño, condición de victoria, IA, persistencia, ni múltiples niveles. Es un **vertical slice de mecánica de movimiento + destrucción + disparo**, no un juego completo.

---

## 2. Inventario técnico de lo implementado

### 2.1 Terreno destructible (el corazón del prototipo)
- El PNG (`fondo1.png`) se dibuja en un `<canvas>` de memoria (`terrainCanvas`).
- Se genera una **máscara de colisión por píxel**: un `Uint8Array` de `WIDTH*HEIGHT` (1280×720 = ~921K bytes) donde cada celda es `1` (sólido) si el alfa del píxel > 128, `0` si no.
- Se crea además una **capa de sombra interior**: se duplica la imagen desplazada 6px, se tiñe de negro al 45% de opacidad usando `globalCompositeOperation = 'source-in'`, y se dibuja detrás del terreno — truco barato para dar sensación de profundidad en los bordes destruidos.
- Destrucción:
  - `carveCircle(cx, cy, r)`: agujero circular (explosiones). Usa `destination-out` en el canvas visual **y** recorre manualmente el rectángulo delimitador actualizando el `Uint8Array` (doble trabajo: visual + lógico, no derivan uno del otro).
  - `carveTunnel(x0,y0,x1,y1,radius)`: túnel/línea gruesa (arma "Tornillo"), misma doble actualización.
  - `calculateNormal(cx, cy)`: aproxima la normal de la superficie muestreando una vecindad 7×7 de píxeles sólidos — se usa para rebotes de proyectiles.

### 2.2 Física y movimiento
- Nada de motor de físicas real (no Box2D/Rapier): es un **kinematic controller manual** contra la máscara de colisión.
- Gravedad simple: `vy += 0.3` por frame, tope `vy ≤ 10`.
- Suelo: se comprueba `isSolid(x, y+radius)` en la siguiente posición.
- Movimiento horizontal con **step-up** (subida de escalones): prueba hasta 6px hacia arriba buscando una `y` libre antes de permitir el desplazamiento — así el jugador "sube" pendientes suaves del terreno sin física real.
- Salto: velocidad vertical fija (`-6.5`) si está en el suelo.
- Solo el jugador con el turno activo puede moverse; el otro queda congelado.

### 2.3 Sistema de turnos
- Alternancia simple `currentTurn = 1 - currentTurn`.
- Temporizador fijo de 10s por turno, auto-pasa turno al agotarse o al disparar.
- Sin fase de "retirada" tras disparar (a diferencia de Worms clásico), sin control de cámara durante el turno del rival.

### 2.4 Apuntado
- No es apuntado tipo Worms (mantener tecla para variar ángulo). Aquí es **drag de un "pivote"**: un círculo dibujado a 45px del jugador que sigue el ángulo `atan2(dy,dx)` del puntero/dedo al arrastrarlo.
- No hay barra de potencia/carga — el ángulo lo es todo, la velocidad de disparo es fija por arma.
- Línea discontinua como indicador de dirección del cañón (sin predicción de trayectoria real).

### 2.5 Armas (3, muy simples)
| Arma | Tipo | Comportamiento |
|---|---|---|
| Bazooka | Proyectil | Velocidad fija (12), **sin gravedad**, línea recta hasta chocar; explota con `carveCircle(r=50)`. |
| Tornillo | Instantáneo | No es proyectil: perfora un túnel de 220px al instante (`carveTunnel`, radio 10). |
| Limón | Proyectil | Con gravedad (0.25/frame) y rebote (hasta 2 rebotes, reflexión por normal de superficie, pérdida de energía ×0.6); exploto con `carveCircle(r=30)`. |

No hay daño, HP, munición limitada, ni selección de inventario más allá de tres botones fijos.

### 2.6 Input
- Teclado: WASD/flechas + espacio (salto). Solo activo si es tu turno (en la versión PvP).
- Táctil: botones on-screen (izquierda/derecha/salto) vía Pointer Events, más drag sobre el canvas para apuntar.
- Conversión de coordenadas pantalla→canvas con lógica de letterboxing (el canvas es `1280×720` fijo, escalado con `object-fit: contain`).

### 2.7 Red / Multiplayer (`index_pvp.html`)
- **Trystero**: librería que implementa WebRTC data channels con señalización descentralizada (por defecto sobre relés Nostr, sin servidor propio).
- Asignación determinista de jugador: compara `selfId` vs `peerId` (quien tiene el ID "menor" es P1).
- Se sincronizan 3 tipos de mensajes: `move` (posición/velocidad/grounded del jugador activo), `aim` (ángulo), `fire` (arma+ángulo+posición al disparar), `timeout` (para sincronizar fin de turno por reloj).
- **Modelo de confianza total**: cada cliente ejecuta su propia física y le "dice" al otro qué pasó — no hay validación de servidor, es trivialmente vulnerable a manipulación del cliente (aceptable para un prototipo casual, no para un juego competitivo serio).
- No hay reconexión, ni salas persistentes, ni matchmaking real más allá de un código de sala en texto.

---

## 3. Qué falta para ser "un juego" (no solo un prototipo)

Esto no es una crítica al código —es correcto identificarlo para dimensionar el port—, sino el inventario de huecos frente a un Worms mínimamente jugable:

- Sistema de salud/daño y muerte de jugador.
- Condición de victoria/derrota y pantalla de resultado.
- Más de un "worm" por equipo (aquí cada jugador es un único círculo).
- Viento (mecánica clásica del género que afecta proyectiles).
- Límite de munición / rotación de armas / inventario.
- Cámara con seguimiento de proyectil y zoom (aquí la cámara es fija, se ve el mapa completo).
- Menús, sonido, música, feedback de impacto/daño.
- Generación de terreno (aquí es una imagen estática única, no hay variedad de mapas ni terreno procedural).
- Guardado de progreso / meta-juego.
- IA para modo un jugador.

---

## 4. Viabilidad de portar a Godot (Android)

**Veredicto general: alta viabilidad para el núcleo del juego, complejidad media-alta específicamente en la capa de red P2P si se quiere preservar el modelo "sin servidor" de Trystero.**

### 4.1 Terreno destructible → Viable, mapeo casi 1:1
La técnica (imagen + máscara de bits + `destination-out`) se traduce directamente:
- Godot: cargar el PNG en una `Image`, generar una máscara de colisión con `Image.get_data()` / `PackedByteArray`, exactamente como el `Uint8Array` actual.
- Para "cavar" agujeros: `Image.blend_rect_mask()` o modificar directamente los píxeles de una `Image` y subirla a una `ImageTexture` (`update()` por frame o solo cuando cambia el terreno — más barato que en Canvas 2D porque no hay que redibujar cada frame, solo al destruir).
- **Punto de atención de rendimiento en Android**: recorrer manualmente cada píxel de un círculo/línea en GDScript puede ser notablemente más lento que en V8/JS para radios grandes o terrenos de alta resolución. Recomendaciones:
  - Usar una máscara de colisión a **resolución reducida** (p. ej. la mitad o un cuarto de la resolución visual) y solo la textura visual a resolución completa.
  - Si el rendimiento en gama baja de Android es un problema, mover el cálculo de destrucción a una función crítica en C# o GDExtension (C++/Rust), o usar un compute shader.
  - Alternativa más "Godot-nativa": usar `BitMap` (clase pensada justo para máscaras de colisión desde alfa de imagen) en vez de reinventar el array plano.

### 4.2 Física / movimiento → Viable, mismo enfoque manual
- No hace falta usar `CharacterBody2D` con el motor de físicas de Godot ni recrear todo con RigidBody; el enfoque actual (kinematic manual contra el bitmask, con step-up) se puede portar prácticamente línea por línea a GDScript dentro de `_physics_process`.
- Es una decisión de diseño válida mantenerlo así para tener control total sobre el terreno destructible (los motores de física de tile/mesh no manejan bien geometría que cambia píxel a píxel en tiempo real).

### 4.3 Input táctil → Trivial
- Godot tiene soporte nativo de touch (`InputEventScreenTouch`, `InputEventScreenDrag`) y es habitual usar `TouchScreenButton` o joysticks virtuales. El patrón actual (botones on-screen + drag para apuntar) se replica sin fricción, y de hecho mejora: Godot maneja mejor multitouch y safe areas de Android que los Pointer Events crudos usados hoy.

### 4.4 Renderizado → Trivial
- Todo lo que hoy se hace con `CanvasRenderingContext2D` (círculos, líneas discontinuas, etc.) tiene equivalente directo con `Node2D._draw()` o nodos (`Line2D`, `Polygon2D`, `Sprite2D`). Sin riesgos aquí.

### 4.5 Multiplayer P2P → El punto de mayor fricción real
Esta es la pieza que **no tiene equivalente "gratis"** en Godot:
- Trystero da señalización WebRTC serverless (usa redes públicas como relés Nostr/BitTorrent/Firebase como "buzón" inicial) — funciona bien en navegador porque el navegador ya trae WebRTC nativo y Trystero abstrae toda la parte fea.
- Godot sí soporta WebRTC (`WebRTCPeerConnection`, `WebRTCMultiplayerPeer`), pero **necesita un mecanismo de señalización propio** (intercambiar SDP/ICE candidates entre los dos peers antes de que el WebRTC directo funcione). Eso implica montar, aunque sea mínimo, uno de:
  1. Un pequeño servidor de señalización (WebSocket) — no es un servidor de juego, solo de "presentación", pero es infraestructura que hoy el proyecto no tiene ni necesita.
  2. Usar el modelo cliente-servidor de Godot con **ENet sobre un servidor relay** en vez de P2P puro — más robusto en redes móviles (los NATs de operadoras móviles con CGNAT rompen WebRTC P2P directo con más frecuencia que WiFi/hogar), pero deja de ser "serverless".
  3. Servicios de terceros para NAT traversal/relay (STUN/TURN) — necesarios de todas formas si se insiste en P2P real para que funcione de forma fiable en redes móviles.
- **Conclusión práctica**: replicar el juego local (`index.html`) en Godot es sencillo. Replicar el modo P2P *exactamente* como está (cero infraestructura) es la parte que consume más tiempo de ingeniería y probablemente no vale la pena optimizar por "serverless puro" en un port a Android — es más razonable adoptar un modelo cliente-servidor ligero (autoritativo o semi-autoritativo) desde el principio, lo cual además arregla gratis el problema de que hoy cada cliente es "de confianza total" (cheating trivial).

### 4.6 Exportación a Android → Sin riesgo
- El pipeline de exportación de Godot a Android es maduro y bien documentado; no hay ningún elemento en este prototipo (canvas, WebRTC nativo del navegador, etc.) que dependa de APIs exclusivas de navegador salvo, precisamente, Trystero/WebRTC del browser — que de todos modos hay que reemplazar por el WebRTC nativo de Godot como se explicó arriba.

### 4.7 Estimación de esfuerzo relativo
| Sistema | Esfuerzo de port | Motivo |
|---|---|---|
| Terreno destructible + colisión por píxel | Bajo–Medio | Mapeo directo, cuidar rendimiento en gama baja Android |
| Movimiento/física manual | Bajo | Traducción casi literal del algoritmo |
| Armas actuales (3) | Bajo | Lógica simple y ya resuelta |
| Turnos/temporizador | Bajo | Trivial |
| Input táctil/aim | Bajo | Godot lo facilita más que el HTML actual |
| Modo local 2 jugadores | Bajo | Es el más directo de portar |
| Modo multijugador P2P serverless | Medio–Alto | No hay equivalente directo; requiere decisión de arquitectura de red nueva |
| Features de "juego completo" faltantes (HP, victoria, viento, múltiples worms, cámara, sonido, menús) | Medio–Alto | No existen hoy; es trabajo nuevo, no port |

---

## 5. GDD — Game Design Document (propuesta para versión Godot/Android)

### 5.1 Concepto
**BFTMA** (nombre de trabajo) es un juego de artillería por turnos 2D con terreno completamente destructible, en la línea de *Worms*, pensado para partidas rápidas en móvil, con foco inicial en:
1. Modo local hot-seat (2 jugadores, mismo dispositivo).
2. Modo online 1v1.

### 5.2 Plataforma objetivo
- Android (mínimo API level a definir según Godot 4.x — recomendable apuntar a Android 8.0+ / API 26+ para cubrir la mayoría del parque sin complicar el soporte).
- Orientación: horizontal (landscape), igual que el prototipo actual (1280×720 lógico).
- Input: exclusivamente táctil en el target final (el teclado del prototipo actual queda solo como ayuda de desarrollo/debug en editor).

### 5.3 Loop de juego (core loop)
1. Se cargan 2 equipos (inicialmente: 1 worm por equipo, ver §5.7 sobre expansión futura).
2. Turno del jugador activo (temporizador visible, p. ej. 15–30s, ajustable — el prototipo usa 10s, posiblemente corto para partidas reales).
3. El jugador puede: moverse (izq/der, salto), elegir arma, apuntar (drag), disparar.
4. Al disparar (o agotarse el tiempo), termina el turno → cambia al rival.
5. El impacto destruye terreno y, si aplica, daña al worm alcanzado.
6. Se repite hasta que un equipo pierde todos sus worms → pantalla de victoria/derrota.

### 5.4 Controles (táctil, Android)
| Acción | Control propuesto |
|---|---|
| Mover izquierda/derecha | Botones virtuales o D-pad flotante (como el prototipo) |
| Saltar | Botón dedicado |
| Apuntar | Drag sobre el worm activo o un joystick de apuntado (mejora sobre el "pivote" actual, que es funcional pero poco intuitivo para dedos gordos en pantallas pequeñas — evaluar joystick radial como alternativa) |
| Cambiar arma | Rueda/carrusel de iconos en la parte inferior/lateral |
| Disparar | Botón de fuego (con posible carga de potencia mantenida, ver mejora en §5.6) |
| Pausar / menú | Botón esquina superior |

### 5.5 Terreno
- Mantiene el enfoque actual: imagen base + máscara de colisión por alfa + destrucción vía "sello" de formas (círculo, línea).
- Mejora propuesta: soportar **varios mapas** (varias imágenes/temas) en vez de una única `fondo1.png`, y contemplar generación semi-procedural a futuro (fuera de alcance del MVP).
- Capa de sombra interior del prototipo (offset + tint negro) se mantiene como técnica de arte barata y efectiva.

### 5.6 Armas — MVP (portadas) + mejoras sugeridas
| Arma | Estado | Notas de diseño para Godot |
|---|---|---|
| Bazooka | Portar tal cual | Considerar añadir gravedad leve + viento para dar profundidad táctica (hoy vuela recta, sin gravedad) |
| Tornillo (drill) | Portar tal cual | Bien como está: utilidad de movimiento/exploración de terreno |
| Limón (grenade) | Portar tal cual | El rebote con normal de superficie ya es una mecánica sólida, mantenerla |
| **Nuevas (post-MVP)** | Propuesta | Granada de racimo, dinamita con detonador, arma cuerda/gancho — estándar del género, fuera del prototipo actual |

Mejora recomendada sobre el apuntado actual: introducir **potencia variable** (mantener presionado el botón de fuego para cargar potencia, como en Worms clásico) en vez de velocidad fija — añade profundidad sin costo de implementación alto.

### 5.7 Progresión de alcance (fuera del prototipo, a diseñar)
- **Vida/daño**: cada worm con HP (p. ej. 100), daño según arma y proximidad a la explosión.
- **Múltiples worms por equipo** (clásico: 2–4): requiere selección de worm activo dentro del equipo en cada turno del equipo (rotación) o turno fijo por worm.
- **Viento**: variable aleatoria por turno que afecta trayectoria de proyectiles, mostrada en UI.
- **Condición de victoria**: equipo rival sin worms vivos.
- **Muerte por caída/agua**: si el mapa tiene zonas de "vacío" o agua en los bordes.

### 5.8 Multijugador — recomendación de arquitectura
Dado el análisis de §4.5, se recomienda **no** intentar replicar Trystero 1:1. Opciones ordenadas de menor a mayor esfuerzo de infraestructura:

1. **MVP pragmático**: solo modo local (hot-seat) para el primer release Android. Es el 90% del valor con 10% del riesgo de red.
2. **Online simple**: servidor relay ligero (ENet o WebSocket) que reenvía los mismos 4 tipos de mensajes que ya existen (`move`, `aim`, `fire`, `timeout`) — cambia poco el diseño de mensajes actual, solo el transporte y quién los origina/valida.
3. **Online robusto**: el relay valida turno/reglas server-side (autoridad de servidor) para eliminar el problema actual de "cliente de confianza total" — recomendable si se planea cualquier forma de ranking/competitivo.

### 5.9 Arte y audio (no existen en el prototipo — a definir)
- Estilo visual: el prototipo no define arte propio, solo usa un `fondo1.png` genérico. Se necesita dirección de arte (pixel art / cartoon 2D, paleta, personajes/worms con animaciones de idle/andar/salto/disparo/muerte).
- Audio: inexistente hoy. Necesario: SFX de disparo/explosión/salto/paso, música de fondo, voces cómicas (tradición del género).

### 5.10 Riesgos principales del proyecto
1. **Rendimiento de destrucción de terreno por píxel en Android de gama baja** — mitigar con máscara de colisión de menor resolución que la visual.
2. **Red P2P en redes móviles reales (CGNAT)** — mitigar bajando expectativas de "serverless puro" y aceptando un relay mínimo.
3. **Alcance de diseño**: el prototipo cubre ~15% de las mecánicas de un Worms jugable (falta HP, victoria, viento, multi-worm, arte, audio, menús) — dimensionar el roadmap real en base a esto, no a lo ya construido.

### 5.11 Roadmap sugerido (alto nivel)
1. **Fase 0 — Port de núcleo**: terreno destructible + física manual + 3 armas + turnos, en Godot, modo local, sin arte final (placeholders).
2. **Fase 1 — Juego completo mínimo**: HP, muerte, condición de victoria, múltiples worms por equipo, viento, menús básicos, arte/audio placeholder final.
3. **Fase 2 — Multijugador online**: arquitectura de red elegida (§5.8), pruebas en redes móviles reales.
4. **Fase 3 — Pulido y contenido**: más armas, más mapas, progresión/meta, monetización (si aplica, a decidir aparte).

---

## 6. Conclusión

El prototipo actual demuestra que **el núcleo técnico más difícil de un Worms-like — terreno destructible por píxel con física manual — ya está resuelto y probado**, y ese es exactamente el sistema que mejor se traslada a Godot con bajo riesgo. Lo que falta no es "portar código" sino **diseñar y construir el resto del juego** (daño, victoria, contenido, arte, audio) que hoy no existe, y **decidir conscientemente una arquitectura de red distinta** para el modo online, ya que el modelo serverless actual (Trystero) no tiene un análogo directo y de bajo esfuerzo dentro de Godot/Android.
