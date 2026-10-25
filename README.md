# Liber Vagatorum · prototipo jugable (v0.1b)

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

1. `rules.js` → `version: "0.1b"`, por ejemplo a `"0.1c"`.
2. `sw.js` → `const VERSION = "lv-0.1b-1"`, por ejemplo a `"lv-0.1c-1"`.

Las partidas a medias de una versión anterior avisan de que pueden fallar.

## Probarlo en local

Hace falta un servidor, no basta con abrir el archivo:

```
python3 -m http.server 8000
```

y abre `http://localhost:8000`.

## Qué cambia respecto al kit en Excel (v0.1a)

- Los dados se tiran todos al amanecer y tú decides a qué acción va cada uno.
- La autoridad juega sola: primero una ronda donde más te vieron y, después, los movimientos a dado.
- La muralla existe: el puente y el arrabal quedan fuera. Para dormir en el arrabal hay que haber salido antes por la puerta, y para volver a entrar hay que cruzarla.
- La red es automática: compartir o preguntar crea contactos con nombre y relación. Preguntar solo sube la relación si sale bien (3 o más).
- Antes de cada acción ves quién te puede ver y qué te pasaría. Antes de dormir ves el riesgo de detención y el castigo que te tocaría.
- La venganza del delatado se aplica sola.
- El catálogo de tretas se conserva entre partidas jugadas en el mismo dispositivo.
