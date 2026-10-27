# Herramientas de prueba

Nada de esto lo necesita el juego: sirve para probar y equilibrar las reglas.

- `simlib.js`: el bot. Lo usan todas las simulaciones. Políticas `azar`, `prudente` y `egoista`. Admite ganchos para medir cosas sin copiar el bot (ver la cabecera del archivo).
- `sim.js [N]`: juega N partidas por personaje con el bot al azar y el prudente, comprueba invariantes y saca porcentajes. `node herramientas/sim.js 1500`
- `calib.js [N]`: prueba combinaciones de palancas (definidas arriba del archivo) sin tocar `rules.js` (se aplican encima de las reglas actuales). `COMBOS="techoNoCura+pan1;pedirDuro" node herramientas/calib.js 600`. Con `POL=azar`, usa el bot al azar.
- `dados.js [N]`: dados muertos y decisiones. Qué pasa con cada dado según su valor y cuántas franjas tienen algo que decidir. `node herramientas/dados.js 2000`
- `mapa-dados.js`: qué puede sacar cada valor de dado en cada franja de un día, sin contar riesgos. `DIA=4 node herramientas/mapa-dados.js`
- `ingresos.js`: de dónde sale el dinero y el cuerpo por día jugado, por personaje.
- `ninostats.js`: qué le pasa al niño de la viuda según cómo juegue el bot.
- `webtest.py PJ TEMA SEMILLA`: juega una partida entera en el navegador (Playwright, móvil 390x844) y comprueba el informe, el historial y el service worker. `python3 herramientas/webtest.py viuda dark 1`
- `webnino.py`: prueba dirigida de la interfaz del niño.

## El bot prudente

Ve todos los riesgos, no finge salvo que se pida (`FINGIR=auto|siempre|4|5`) y apenas usa la red: es un jugador cuidadoso pero torpe con la gente. Para cada acción gasta el dado más bajo que rinde lo mismo que el más alto.

Desde el 27 de octubre de 2026 tiene corregidos dos fallos de la v0.3b:
- probaba el examen de licencia con cualquier dado, así que la viuda suspendía una y otra vez y le subía el termómetro;
- iba a «trabajar» con dados que no llegaban, porque contaba como ventaja que le vieran trabajar aunque no le contrataran.

Con esos fallos la viuda sobrevivía el 41 %; sin ellos, el 58-60 %. `BOT=viejo` reproduce el bot anterior para comparar.
