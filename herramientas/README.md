# Herramientas de prueba

Nada de esto lo necesita el juego: sirve para probar y equilibrar las reglas.

- `simlib.js`: el bot. Lo usan todas las simulaciones. Políticas `azar`, `prudente` y `egoista`. Admite ganchos para medir cosas sin copiar el bot (ver la cabecera del archivo).
- `sim.js [N]`: juega N partidas por personaje con el bot al azar y el prudente, comprueba invariantes y saca porcentajes. `node herramientas/sim.js 1500`
- `calib.js [N]`: prueba combinaciones de palancas (definidas arriba del archivo) sin tocar `rules.js` (se aplican encima de las reglas actuales; desde la v0.5, el paquete «mixto» ya está en `rules.js`, así que `base` es la v0.5). `COMBOS="persigue2+expSuave3+techo3;pan1" node herramientas/calib.js 600`. Con `POL=azar`, usa el bot al azar. De la viuda da la supervivencia con el niño, que es su victoria desde la v0.5.
- `causas.js`: de qué muere cada personaje, cuántas veces le detienen y si le echaron de la ciudad, con las palancas que se pasen: `PALANCAS='{"pregonPersigue":2,"expulsionDias":3}' node herramientas/causas.js`.
- `dados.js [N]`: dados muertos y decisiones. Qué pasa con cada dado según su valor y cuántas franjas tienen algo que decidir. `node herramientas/dados.js 2000`
- `mapa-dados.js`: qué puede sacar cada valor de dado en cada franja de un día, sin contar riesgos. `DIA=4 node herramientas/mapa-dados.js`
- `red.js [N]`: qué hace el bot con la red: cuántas veces se junta, a qué relación llega, cuántas noches duerme con alguien, cuántos interrogatorios hay y cuántas veces le venden.
- `prueba-red.js`: prueba dirigida de juntarse y señalar (v0.4). Debe salir todo «ok».
- `lista.js [N]`: la lista de pobres (v0.4b) con la viuda: si entra, cuántas raciones saca, cuántas veces la borran, cuánto lava y qué le pasa al niño. Compara el bot que entra en la lista con el que no entra nunca.
- `prueba-lista.js`: prueba dirigida de la lista (v0.4b). Debe salir todo «ok».
- `prueba-v05.js`: prueba dirigida de la v0.5 (pregón que persigue, expulsión, techo con relación 3, media ración, hospital y final de la viuda). Debe salir todo «ok».
- `ingresos.js`: de dónde sale el dinero y el cuerpo por día jugado, por personaje.
- `ninostats.js`: qué le pasa al niño de la viuda según cómo juegue el bot.
- `webtest.py PJ TEMA SEMILLA`: juega una partida entera en el navegador (Playwright, móvil 390x844) y comprueba el informe, el historial y el service worker. `python3 herramientas/webtest.py viuda dark 1`
- `webnino.py`: prueba dirigida de la interfaz del niño.
- `webv05.py`: prueba dirigida de la interfaz de la v0.5 (avisos del pregón, expulsión, media ración, techo y final de la viuda). Deja capturas en `capturas/v05_*.png`.

## El bot prudente

Ve todos los riesgos y no finge salvo que se pida (`FINGIR=auto|siempre|4|5`). Para cada acción gasta el dado más bajo que rinde lo mismo que el más alto.

Desde la v0.4 usa la red: se junta con quien más relación tiene de su lado de la muralla (para llegar pronto a relación 2, que da techo), descuenta el riesgo de dejar a esa persona señalada y solo delata a quien no le da techo ni pan. `RED=no` hace que no se junte con nadie y `DELATAR=no`, que no delate nunca: sirven para medir cuánto aporta cada cosa. Con la viuda, el niño come primero salvo que ella muriera de hambre esa noche (su victoria es llegar los dos). Desde la v0.4b entra en la lista de pobres si puede, cumple cada día y solo pide estando en ella si la ganancia compensa el riesgo de que le borren; `LISTA=no` hace que no entre nunca.

Desde el 27 de octubre de 2026 tiene corregidos dos fallos de la v0.3b:
- probaba el examen de licencia con cualquier dado, así que la viuda suspendía una y otra vez y le subía el termómetro;
- iba a «trabajar» con dados que no llegaban, porque contaba como ventaja que le vieran trabajar aunque no le contrataran.

Con esos fallos la viuda sobrevivía el 41 %; sin ellos, el 58-60 %. `BOT=viejo` reproduce aquel bot (con las reglas de la v0.3b daba exactamente sus cifras; con reglas nuevas sirve para comparar bots sobre las mismas reglas).
