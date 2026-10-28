---
name: agentes
description: Lanza agentes que juegan Liber Vagatorum en la app real y escriben un diario, y junta los resultados. Uso — /agentes prueba (3 partidas), /agentes completa (15) o /agentes uno <personaje> <estilo> <semilla>.
argument-hint: "[prueba | completa | uno <personaje> <estilo> <semilla>]"
disable-model-invocation: true
---

Tanda pedida: **$ARGUMENTS** (si no hay nada, es `prueba`).

Lanzas agentes `jugador-liber` que juegan la app real con `herramientas/agentes/mesa.py`, y después juntas sus diarios. Lee `herramientas/agentes/README.md` si necesitas más contexto. **No cambies nada fuera de `herramientas/agentes/partidas/`**, ni reglas ni código, aunque los diarios señalen problemas: eso lo decide Sergio.

## 1. Comprobaciones

- `bash herramientas/agentes/preparar.sh`. Instala Playwright si falta y comprueba que el navegador abre la app; si el Chromium de Playwright no se puede bajar (pasa en las sesiones en la nube de Claude Code), usa uno de npm. Si acaba con error, enséñale a Sergio el mensaje y para.
- Versión del juego: `grep -o 'version: "[^"]*"' rules.js` → por ejemplo `0.4`. Las partidas van en `herramientas/agentes/partidas/v<versión>/`.

## 2. Las partidas de la tanda

Cada partida es (personaje, estilo, semilla). Las semillas son fijas para poder comparar versiones con los mismos dados.

- **prueba:** mozo prudente 101 · viuda prudente 102 · soldado prudente 103.
- **completa:** para cada personaje (mozo, viuda, soldado) y estilo (prudente, arriesgado, novato, fingidor, social), en ese orden, semillas de la 201 a la 215: mozo-prudente 201, mozo-arriesgado 202 … soldado-social 215.
- **uno:** solo la partida indicada.

Carpeta de cada partida: `herramientas/agentes/partidas/v<versión>/<personaje>-<estilo>-<semilla>`. Si ya existe con `resultado.json`, esa partida ya está jugada: sáltala y dilo. Si existe sin `resultado.json` (quedó a medias), pregunta a Sergio si la borras y la repites.

## 3. Lanzar

Lanza un subagente `jugador-liber` por partida, **como mucho 5 a la vez**, con este mensaje (rellenado):

> Personaje: <personaje>. Estilo: <estilo>. Semilla: <semilla>. Carpeta: <carpeta>. Juega la partida entera siguiendo tus instrucciones.

No le des más contexto sobre el juego ni sobre las reglas: tiene que jugar sin saber lo que no sabría un jugador.

## 4. Juntar

Cuando acaben todas: `python3 herramientas/agentes/resumen.py v<versión>`. Escribe `RESUMEN.md` en la carpeta de la versión y lo imprime.

Después haz commit de `herramientas/agentes/partidas/v<versión>/` (solo esa carpeta; los perfiles del navegador ya están excluidos) y súbelo a la rama en la que estés. Dile a Sergio el nombre de la rama: así puede leer los diarios desde otra conversación.

Enseña a Sergio:
- La tabla de finales y etiquetas por personaje y estilo.
- Las líneas `[NO ENTIENDO]`, agrupadas si se repiten.
- Las respuestas de la encuesta.
- Lo que se repite en varias partidas (una jugada que todos hacen, una pantalla que confunde a varios).

Recuérdale que los agentes son el mismo modelo: sirven para encontrar huecos, no como votos ni para porcentajes de supervivencia (esos salen de `herramientas/sim.js`).
