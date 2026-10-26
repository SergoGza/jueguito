# Herramientas de prueba

Nada de esto lo necesita el juego: sirve para probar y equilibrar las reglas.

- `sim.js [N]`: juega N partidas por personaje con dos bots (`azar` y `prudente`), comprueba invariantes y saca porcentajes. `node herramientas/sim.js 1500`
- `simlib.js`: el bot, para usarlo desde otros scripts (se genera a partir de `sim.js`).
- `calib.js [N]`: prueba combinaciones de palancas (definidas arriba del archivo) sin tocar `rules.js` (se aplican encima de las reglas actuales). `COMBOS="techoNoCura+pan1;pedirDuro" node herramientas/calib.js 600`. Con `POL=azar`, usa el bot al azar.
- `ingresos.js`: de dónde sale el dinero y el cuerpo por día jugado, por personaje.
- `ninostats.js`: qué le pasa al niño de la viuda según cómo juegue el bot.
- `webtest.py PJ TEMA SEMILLA`: juega una partida entera en el navegador (Playwright, móvil 390x844) y comprueba el informe, el historial y el service worker. `python3 herramientas/webtest.py viuda dark 1`
- `webnino.py`: prueba dirigida de la interfaz del niño.

El bot prudente ve todos los riesgos y no usa casi la red: es un jugador cuidadoso pero torpe con la gente.
