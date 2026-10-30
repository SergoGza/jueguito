---
name: agentes
description: Lanza agentes que juegan Liber Vagatorum (el juguete) en la app real y escriben un diario, y junta los resultados. Uso — /agentes prueba (2 partidas), /agentes completa (6) o /agentes uno <A|B> <estilo> <semilla>.
argument-hint: "[prueba | completa | uno <A|B> <estilo> <semilla>]"
disable-model-invocation: true
---

Tanda pedida: **$ARGUMENTS** (si no hay nada, es `prueba`).

Lanzas agentes `jugador-liber` que juegan la app real con `herramientas/agentes/mesa.py`, y después juntas sus diarios. Lee `herramientas/agentes/README.md` si necesitas más contexto. **No cambies nada fuera de `herramientas/agentes/partidas/`**, ni reglas ni código, aunque los diarios señalen problemas: eso lo decide Sergio.

## 1. Comprobaciones

- `bash herramientas/agentes/preparar.sh`. Instala Playwright si falta y comprueba que el navegador abre la app; si el Chromium de Playwright no se puede bajar (pasa en las sesiones en la nube de Claude Code), usa uno de npm. Si acaba con error, enséñale a Sergio el mensaje y para.
- Versión del juego: `grep -o 'version: "[^"]*"' rules.js` → por ejemplo `j0.1`. Las partidas van en `herramientas/agentes/partidas/v<versión>/`.

## 2. Las partidas de la tanda

Cada partida es (prueba, estilo, semilla). Desde el 30 de octubre de 2026 el núcleo es la prueba A; la B queda en el código y solo se juega si se pide con `uno B …`. Las semillas son fijas para poder comparar versiones con los mismos dados.

- **prueba:** A prudente 101 · A novato 102.
- **completa:** para cada estilo (prudente, arriesgado, novato) y cada semilla (201, 202), la prueba A: A-prudente-201, A-prudente-202, A-arriesgado-201… (6 partidas).
- **uno:** solo la partida indicada.

Carpeta de cada partida: `herramientas/agentes/partidas/v<versión>/<prueba>-<estilo>-<semilla>`. Si ya existe con `resultado.json`, esa partida ya está jugada: sáltala y dilo. Si existe sin `resultado.json` (quedó a medias), pregunta a Sergio si la borras y la repites.

## 3. Lanzar

Lanza un subagente `jugador-liber` por partida, **como mucho 5 a la vez**, con este mensaje (rellenado):

> Prueba: <A o B>. Estilo: <estilo>. Semilla: <semilla>. Carpeta: <carpeta>. Juega la partida entera siguiendo tus instrucciones.

No le des más contexto sobre el juego ni sobre las reglas: tiene que jugar sin saber lo que no sabría un jugador.

## 4. Juntar

Cuando acaben todas: `python3 herramientas/agentes/resumen.py v<versión>`. Escribe `RESUMEN.md` en la carpeta de la versión y lo imprime.

Después haz commit de `herramientas/agentes/partidas/v<versión>/` (solo esa carpeta; los perfiles del navegador ya están excluidos) y súbelo a la rama en la que estés. Dile a Sergio el nombre de la rama: así puede leer los diarios desde otra conversación.

Enseña a Sergio:

- **¿Cuentan pasos y optimizan rutas?** (sería gestión): las respuestas a «cómo decidías adónde ir» y las líneas del diario que hablan de ratos o caminos.
- **¿La sorpresa se lee como mala decisión o como mala suerte?**: la tercera pregunta y las líneas del diario tras encontrarse con la ronda.
- **¿Repiten rutina y la ronda se la aprende?** ¿Se dan cuenta y cambian?: el diario y los «(tu costumbre)» del informe.
- Las líneas `[NO ENTIENDO]`, agrupadas si se repiten, y lo que se repite en varias partidas.

Recuérdale que los agentes son el mismo modelo: sirven para encontrar huecos, no como votos ni para porcentajes de supervivencia.
