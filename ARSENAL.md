# Arsenal de BFTMA

Todas las opciones están disponibles desde el primer turno. Son valores iniciales de balance, centralizados en `src/engine/arsenal.js`, con su explicación también dentro del juego. Todos los ataques pueden afectar a aliados. Los números de explosión son máximos; el daño disminuye al alejarse del centro.

| Arma | Daño | Uso y diferencia |
|---|---:|---|
| Bazooka | 50 | Cohete en parábola, explosión de radio 90 y cráter de 50. Potencia variable. |
| Tornillo | 35 | Perfora 220 px y golpea a todos los personajes a lo largo del túnel. |
| Limón | 40 | Granada con dos rebotes y mecha de 3 s. Potencia variable. |
| Francotirador | 75 | Impacto instantáneo, alcance 1600; se detiene en la primera pared o personaje. |
| Láser | 35 por objetivo | Atraviesa 950 px y abre un túnel fino; puede alcanzar varios personajes. |
| Fragmentación | 28 + fragmentos | Mecha de 2, 3 o 4 s, con contador visible; los impactos no detonan la granada. Explosión principal y ocho fragmentos explosivos de hasta 10 cada uno. |
| Dinamita | 80 | Se coloca, nunca se lanza. Mecha de 3 s para huir; explosión amplia y gran cráter. |
| Puñetazo | 30 | Alcance 65, un objetivo y empujón fuerte. No destruye suelo. |
| Apoyo aéreo | 28 por bomba | Lanza una bengala de humo rojo. La cámara muestra el mapa completo y un avión lo cruza a gran altura, soltando cinco bombas sobre la señal. Hay tres segundos para moverse y buscar cobertura mientras llega. |
| Metralleta | 8 por bala | Ráfaga de ocho balas, con ligera dispersión y alcance 950. |
| Escopeta | 10 por perdigón | Siete perdigones en abanico. Alcance 350; favorece la proximidad. |
| Gas | 5 a 1 por segundo | Varios óvalos crecen de radio 90 a 260 y se desvanecen en 12 s, hasta cuatro cambios de turno. Aplica daño cada segundo dentro de la nube, sin explosión inicial. El equipo lanzador lleva máscaras que protegen del gas desde el lanzamiento hasta disiparse sus nubes. |
| Flecha | 38 + sangrado | Parábola y daño directo. Sangrado de 6 al comenzar los dos próximos turnos de su equipo. |
| Escudo | 22 por golpe | Cinco rebotes, incluso contra personajes. Puede regresar hacia quien lo lanzó. |
| Teletransportador | — | Toca o haz clic en un destino a menos de 650 px. Se desintegra en partículas y reaparece. Arrastrar mueve la cámara. Un destino inválido no consume turno. |
| Kit médico | Cura 35 | Solo al integrante activo, hasta 100; no revive. Consume turno. |
| Mortero | 65 | Parábola de largo alcance (aproximadamente 900 px en terreno a la misma altura, a máxima potencia y 45°), explosión de radio 100 y cráter grande. Potencia variable. |
| Racimo | 24 por minibomba | Se divide desde un mismo punto en cinco parábolas en abanico al comenzar a descender. Los impulsos de apertura conservan la velocidad media del tiro y su gravedad. Potencia variable. |
| Mina | 65 | Colocación con 2 s para huir. Después se activa por proximidad a 45 px, durante ocho cambios de turno. |
| Rayo orbital | 85 | Dos turnos: marcador con potencia variable, fijación al enemigo más cercano a 140 px y llamada por radio desde el siguiente turno propio. Si está vacío, fogonazo gris y espera; desde el siguiente turno propio también se puede disparar sobre su posición sin enemigo fijado. Salta y se adhiere al objetivo; puede descartarse gratis antes de llamar o conservarse mientras usas otra arma. Satélite con carga y rayo vertical de 44 px que perfora el terreno y daña también a aliados. |
| Criogénico | 18 + congelación | Movimiento a la mitad y salto reducido durante dos turnos de su equipo. Durante el siguiente turno, la puntería y su guía oscilan hasta ±4°; el disparo usa el ángulo visible. |

La potencia varía entre 15 y 100 %. Arrastrar más lejos la mira aumenta la fuerza; el deslizador permite afinarla después. Las armas instantáneas, de colocación, el kit médico y el teletransportador ignoran este control.

Los equipos alternan una acción por turno. Al disparar comienza la resolución; nadie puede encadenar otra arma. La excepción de movimiento es el tiempo para huir tras colocar dinamita o mina. Durante el vuelo y las explosiones se espera antes de entregar el turno siguiente.

La IA usa reposicionamiento, potencia y una selección de bazooka, limón, tornillo y francotirador. El jugador humano dispone del arsenal completo. Esta primera implementación necesita pruebas de balance en mapas reales antes de fijar valores definitivos.
