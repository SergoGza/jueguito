# Agentes que juegan

Agentes de Claude que juegan la app real, viendo solo lo que vería una persona, y escriben un diario de cada decisión. Sirven para encontrar huecos antes de que los encuentre la gente que prueba el juego: franjas sin nada que decidir, textos que no se entienden, jugadas que siempre ganan.

**No sirven** para porcentajes de supervivencia ni como votos sobre el diseño: son todos el mismo modelo.

## Cómo se usa

Desde Claude Code, abierto en la raíz del repositorio:

- `/agentes prueba`: 2 partidas, la prueba A y la B con el estilo prudente y la misma semilla. Para comprobar que todo funciona y ver si los diarios aportan algo.
- `/agentes completa`: 12 partidas, 2 pruebas × 3 estilos (prudente, arriesgado, novato) × 2 semillas. Para los momentos importantes, por ejemplo antes de que pruebe el juego otra gente.
- `/agentes uno B arriesgado 214`: una sola partida.

**Coste.** Una partida del prototipo anterior gastaba del orden de medio millón de tokens; el juguete tiene menos texto por pantalla, pero en la prueba A hay muchos pasos. Lanza la tanda completa solo en los momentos importantes.

Las semillas son fijas, y con la misma semilla la ciudad (gente, pobres y ronda) es la misma en A y en B: las dos pruebas se comparan sobre el mismo mundo. Lo que cambia son las tiradas de tus acciones, porque dependen de lo que haces. Cada partida queda en `partidas/v<versión>/<prueba>-<estilo>-<semilla>/` con su `diario.md`, `informe.txt` (el mismo informe que mandan los testers) y `resultado.json`. El resumen de la tanda, en `partidas/v<versión>/RESUMEN.md`, con las cifras que sirven para los criterios de la prueba A/B (tiempo moviéndose, pasos o cruces por día, veces que llegó donde estaba la ronda).

Hace falta Python con Playwright y un Chromium. `bash herramientas/agentes/preparar.sh` lo deja listo (el comando `/agentes` lo ejecuta al empezar): instala Playwright si falta y, si el Chromium de Playwright no se puede bajar, como pasa en las sesiones en la nube de Claude Code, usa el del paquete npm `@sparticuz/chromium` y apunta su ruta en `.chromium`, que la mesa lee. `python3 herramientas/agentes/mesa.py comprobar` dice si la mesa arranca.

## Las piezas

- `mesa.py`: la mesa de juego. Abre la app en un Chromium sin ventana, enseña el texto de la pantalla (sin el mapa, que está repetido en texto en «La ciudad: lo que sabes») y una lista numerada de lo que se puede pulsar, y pulsa lo que se le pida. Cada partida tiene su propio navegador en su carpeta, así que pueden jugarse varias a la vez. Ver `python3 herramientas/agentes/mesa.py` para las órdenes.
- `../../.claude/agents/jugador-liber.md`: el agente que juega. Solo puede ejecutar la mesa y tiene prohibido leer el código: juega sin saber más que un jugador.
- `../../.claude/skills/agentes/SKILL.md`: el comando `/agentes`, que lanza las partidas (como mucho 5 a la vez) y junta los resultados.
- `resumen.py`: junta los diarios de una tanda.

Para probar la mesa a mano: `python3 herramientas/agentes/mesa.py nueva A /tmp/prueba 101` y luego `pulsar /tmp/prueba <n>`. En `pulsar`, un número es el botón de la lista actual y un texto pulsa el primer botón cuyo título empiece así; se pueden encadenar varios por texto.

## El diario

Cada decisión lleva una etiqueta:

- `[DECIDO]` había al menos dos opciones que valían la pena.
- `[OBVIO]` solo una tenía sentido.
- `[NADA]` no había nada útil que hacer.
- `[NO ENTIENDO]` un texto o una regla confunde.

## La semilla

La app acepta `?semilla=N` en la dirección para fijar el azar de una partida nueva. Solo lo usa la mesa; quien juega normal tiene una semilla al azar (que va en el informe).
