# Agentes que juegan

Agentes de Claude que juegan la app real, viendo solo lo que vería una persona, y escriben un diario de cada decisión. Sirven para encontrar huecos antes de que los encuentre la gente que prueba el juego: franjas sin nada que decidir, textos que no se entienden, jugadas que siempre ganan.

**No sirven** para porcentajes de supervivencia (eso sale de `herramientas/sim.js`) ni como votos sobre el diseño: son todos el mismo modelo.

## Cómo se usa

Desde Claude Code, abierto en la raíz del repositorio:

- `/agentes prueba`: 3 partidas, una por personaje, con el estilo prudente. Para comprobar que todo funciona y ver si los diarios aportan algo.
- `/agentes completa`: 15 partidas, 3 personajes × 5 estilos (prudente, arriesgado, novato, fingidor, social). Para los momentos importantes, por ejemplo antes de que pruebe el juego otra gente.
- `/agentes uno viuda social 214`: una sola partida.

**Coste.** Una partida completa son unas 300 órdenes a la mesa y gasta del orden de medio millón de tokens del modelo (la primera prueba, sin las mejoras de la mesa para encadenar pasos, gastó 157.000 en dos días). La tanda de prueba ronda el millón y medio y la completa puede pasar de los siete millones: lánzala solo en los momentos importantes.

Las semillas son fijas, así que dos versiones del juego se comparan con los mismos dados. Cada partida queda en `partidas/v<versión>/<personaje>-<estilo>-<semilla>/` con su `diario.md`, `informe.txt` (el mismo informe que mandan los testers) y `resultado.json`. El resumen de la tanda, en `partidas/v<versión>/RESUMEN.md`.

Hace falta Python con Playwright y Chromium: `pip install playwright` y `python -m playwright install chromium`. Si `herramientas/webtest.py` funciona, ya está.

## Las piezas

- `mesa.py`: la mesa de juego. Abre la app en un Chromium sin ventana, enseña el texto de la pantalla y una lista numerada de lo que se puede pulsar, y pulsa lo que se le pida. Cada partida tiene su propio navegador en su carpeta, así que pueden jugarse varias a la vez. Ver `python3 herramientas/agentes/mesa.py` para las órdenes.
- `../../.claude/agents/jugador-liber.md`: el agente que juega. Solo puede ejecutar la mesa y tiene prohibido leer el código: juega sin saber más que un jugador.
- `../../.claude/skills/agentes/SKILL.md`: el comando `/agentes`, que lanza las partidas (como mucho 5 a la vez) y junta los resultados.
- `resumen.py`: junta los diarios de una tanda.

Para probar la mesa a mano: `python3 herramientas/agentes/mesa.py nueva mozo /tmp/prueba 101` y luego `pulsar /tmp/prueba <n>`. En `pulsar`, un número es el botón de la lista actual, `dado:4` elige el dado que vale 4 y un texto pulsa el primer botón cuyo título empiece así; se pueden encadenar varios (por texto y `dado:N`).

## El diario

Cada decisión lleva una etiqueta:

- `[DECIDO]` había al menos dos opciones que valían la pena.
- `[OBVIO]` solo una tenía sentido.
- `[NADA]` tenía dados, pero ninguna opción servía.
- `[NO ENTIENDO]` un texto o una regla confunde.

Comprobación: en la v0.4, el bot prudente se queda sin nada útil que hacer en el 4-8 % de las franjas en las que tiene dados (`node herramientas/dados.js`). Las `[NADA]` de los agentes prudentes deberían salir en ese orden. Si salen muy distintas, revisa primero la mesa: puede que el agente no vea alguna opción.

## La semilla

La app acepta `?semilla=N` en la dirección para fijar los dados de una partida nueva. Solo lo usa la mesa; quien juega normal tiene dados al azar.
