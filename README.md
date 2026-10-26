# Liber Vagatorum · prototipo jugable (v0.3)

Prototipo web de las reglas del día: Salamanca, 1 a 10 de junio de 1545. Una página estática, sin servidor ni base de datos, instalable en el móvil y jugable sin conexión.

## Publicarlo en GitHub Pages

1. Crea un repositorio nuevo en GitHub (por ejemplo `liber-vagatorum-prototipo`). Puede ser público o privado. Con cuenta gratuita, Pages solo funciona en repositorios públicos.
2. Sube **todo el contenido de esta carpeta** a la raíz del repositorio: `index.html`, los `.js`, `styles.css`, `manifest.webmanifest`, `sw.js`, `.nojekyll` y la carpeta `icons/`. Basta con arrastrar los archivos en «Add file → Upload files».
3. En el repositorio: **Settings → Pages → Build and deployment → Source: Deploy from a branch**. Elige la rama `main` y la carpeta `/ (root)`, y guarda.
4. Al cabo de uno o dos minutos estará en `https://TU-USUARIO.github.io/NOMBRE-DEL-REPO/`. Ese es el enlace que pasas a los testers.

## Instalarlo en el móvil

- **Android (Chrome):** abre el enlace y toca «Instalar en el móvil» en la pantalla de inicio, o usa el menú ⋮ → «Instalar aplicación».
- **iPhone (Safari):** botón Compartir → «Añadir a pantalla de inicio».

Una vez abierto la primera vez, funciona sin conexión. La partida se guarda sola en el dispositivo.

## Cómo llegan los informes

Al acabar la partida, el tester contesta tres preguntas y manda el informe:

- **Móvil:** «Compartir informe» adjunta un `.txt` y deja elegir la app de correo.
- **Ordenador:** «Descargar» y luego «Abrir el correo», y adjunta el archivo descargado.

El informe trae la partida entera: cada decisión, los dados, los testigos, los movimientos de la autoridad, los minutos por día y las respuestas. Al final lleva los datos en bruto, para analizarlos.

El correo de destino está en `rules.js` (`CONFIG.email`). **Ojo:** en GitHub Pages el código es público, así que esa dirección queda a la vista de cualquiera.

## Cambiar reglas

Todas las reglas están en `rules.js`: sitios, testigos, efectos, parámetros, calendario, personajes, movimientos de la autoridad… Cambia los números ahí. El motor (`engine.js`) los lee sin tocar nada más.

**Cada vez que cambies algo, sube la versión en dos sitios**, o los móviles seguirán usando la copia antigua:

1. `rules.js` → `version: "0.3"`, por ejemplo a `"0.3a"`.
2. `sw.js` → `const VERSION = "lv-0.3-1"`, por ejemplo a `"lv-0.3a-1"`.

Las partidas a medias de una versión anterior avisan de que pueden fallar.

## Probarlo en local

Hace falta un servidor, no basta con abrir el archivo:

```
python3 -m http.server 8000
```

y abre `http://localhost:8000`.

## Qué cambia en la v0.3 (tras el segundo playtest, con la viuda)

- **Dados sin cifras exactas:** sigues viendo tus dados al amanecer, pero al elegir dado ya no te dice «3 monedas», sino «te darán poco / algo / bastante». Los umbrales (3 o más, 4 o más…) siguen en la descripción de cada acción.
- **El niño de la viuda:** tiene su propio cuerpo (de 0 a 5). Cada noche come: si no hay pan para los dos, eliges quién come. Bajo techo y comido se recupera; las fiebres y las tormentas le afectan aparte. Con cuerpo 0, se lo llevan al hospital de niños. Muy débil (1) y dentro de la muralla, el cura se lo lleva a los niños de la doctrina, salvo que alguien de tu red lo esconda. En el arrabal no se lo llevan.
- **Si detienen a la viuda,** se llevan al niño, salvo que alguien de su red (relación 2 o más) se quede con él. Al amanecer también puedes dejarlo con alguien: cada noche le das una ración o su precio, y si no puedes, la relación baja. Si interrogan o se llevan a quien lo cuida, lo pierdes.
- **Con el niño al lado, la limosna en moneda rinde +1** (añadido mío: hace que dejarlo con alguien tenga un coste, no solo una ventaja). Se cambia en `PARAMS.ninoPedir`.
- **La viuda no trabaja de peón:** lava ropa en la ribera, a tercia y a sexta (dado 3 o más: 2 monedas).
- **Sin detención previa, el termómetro no pasa de +2:** «reincidente» es quien ya ha sido detenido. La primera detención nunca es la horca.
- **Licencia:** ahora se avisa cuando la consigues y cuando la pierdes.

### Simulación (corregida)

La simulación de la v0.2 tenía un fallo en el bot: cuando no tenía nada bueno que hacer, cruzaba la puerta, gastaba franjas y dormía fuera. Los porcentajes de la v0.2 (36 % / 65 % / 81 %) estaban mal. Con el bot corregido, 1.500 partidas por personaje, bot prudente que ve todos los riesgos:

| | v0.2 | v0.3 |
|---|---|---|
| Mozo | 54 % (horca 46 %) | 86 % (horca 13 %) |
| Viuda | 82 % | 100 % (pierde al niño en el 36 %) |
| Soldado | 95 % | 99 % |

Jugando al azar no sobrevive casi nadie (2 %). Para un jugador cuidadoso, el juego es fácil: los supervivientes acaban con cuerpo 8-9. El techo de +2 es lo que más facilita la partida del mozo.

## Qué cambia en la v0.2 (tras el primer playtest: «fácil y plano»)

- **Hatillo:** solo puedes guardar 2 raciones de una noche a otra. Ya no se puede acaparar pan barato.
- **El dinero es peligroso:** con más de 4 monedas, si te ven pedir un alguacil o la beneficencia, te tienen por fingidor (+1). Al raso te pueden robar la mitad y pegarte (−1 de cuerpo). Si te detienen, te lo quitan todo.
- **Desgaste:** dormir al raso cuesta 1 de cuerpo. Descansar solo funciona con dado 3 o más. El mesón cuesta lo que una ración.
- **Hospital:** solo admite enfermos (cuerpo 5 o menos). A la tercera vez que te apuntan, te recogen. Antes era gratis y sin riesgo: el bot dormía allí todas las noches.
- **Red con consecuencias:** la autoridad interroga a tu gente (con relación baja, te venden). Con «se paga el doble por delatar», quien tenga poca relación contigo puede venderte. Te piden comida. Enferman, desaparecen o mueren. Con relación 3, te dan pan si te falta. Solo puedes delatar a alguien de tu red, y lo pierdes.
- **Reincidencia:** tras cada detención, «Te buscan» empieza en el número de veces que te han detenido (hasta 3).
- **Escalada:** desde el pregón de expulsión (día 3), la autoridad hace un movimiento más cada noche, te vea o no.
- **Sucesos al amanecer:** fiebres, tormentas, subidas del pan, redadas, pan de cofradía, muertes, más pobres.
- **Economía más justa:** pedir da menos con dados bajos (1-2 nada; 3-4 una moneda; 5 dos; 6 tres). La sopa necesita 4 o más. Las obras solo contratan a tercia. El pan sube hasta 6.

(La simulación que se publicó con la v0.2 tenía un fallo en el bot; ver los números corregidos en la sección de la v0.3.)

## Qué cambió respecto al kit en Excel (v0.1a → v0.1b)

- Los dados se tiran todos al amanecer y tú decides a qué acción va cada uno.
- La autoridad juega sola: primero una ronda donde más te vieron y, después, los movimientos a dado.
- La muralla existe: el puente y el arrabal quedan fuera. Para dormir en el arrabal hay que haber salido antes por la puerta, y para volver a entrar hay que cruzarla.
- La red es automática: compartir o preguntar crea contactos con nombre y relación. Preguntar solo sube la relación si sale bien (3 o más).
- Antes de cada acción ves quién te puede ver y qué te pasaría. Antes de dormir ves el riesgo de detención y el castigo que te tocaría.
- La venganza del delatado se aplica sola.
- El catálogo de tretas se conserva entre partidas jugadas en el mismo dispositivo.
