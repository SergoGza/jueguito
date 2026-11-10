# Hurtar y la horca: prototipo para bots

10 de noviembre de 2026. Rama `claude/hurto-prototipo`, sobre la j0.11 más el bot aplicado (`f0fe327`). No va a `main`, no tiene pantalla y no decide nada: son palancas para medir las opciones antes de que Sergio decida por rondas.

## Qué hay

- **Reglas** en `rules.js` (`PARAMS.hurto`) y `engine.js`, detrás de `opts.hurto`. Sin esa opción, el motor da exactamente lo mismo que la j0.11 (comprobado con el veterano y el novato, un verano, con los tuyos y la cadena).
- **Política del bot y cuentas** en `herramientas/hurto-comun.js`: `HURTO=nunca|apuro|grave|hambre|siempre` (apuro: sin ración y cuerpo ≤ 2; grave: sin ración y cuerpo ≤ 3; hambre: desde sexta, sin la ración; siempre: en vez de pedir).
- **Lanzador** en `herramientas/hurto-tanda.js`: una tanda por variante, política, bot (veterano de `bot.js` y oficio de `aplicado.js`) y escenario (un verano, con los tuyos, cadena como mozo, cadena como moza). Cada variante cambia una palanca respecto de la base.
- **Medidas** en `claude/hurto-medidas.jsonl`: 320 tandas de 2.000 partidas (semillas 1 a 2.000), una línea por tanda.

```
PROCESOS=2 node herramientas/hurto-tanda.js claude/hurto-medidas.jsonl 2000   # no repite las tandas que ya están
SOLO=base,dos node herramientas/hurto-tanda.js otro.jsonl 2000                # solo esas variantes
HURTO=hambre BOTS=veterano node herramientas/bot.js 2000 '{"PARAMS.hurto.escalera":"dos"}'
HURTO=hambre OFICIO=1 SIN_TABLA=1 PAL='{"PARAMS.hurto.que":"olla"}' node herramientas/aplicado.js 2000
```

## La base y las variantes

Base: se hurta una hogaza (2 pedazos en 2 ratos) en la Plaza o la Rúa cuando hay mercado o tienda; te ven 1 de cada 3 o 4 veces (la gente tapa); si te ven, la mitad de las veces te cogen allí y la otra mitad escapas y te buscan por tus señas (la ronda te para más y cualquier parada es con la justicia); escalera azotes, oreja y horca, aparte de las detenciones por pedir; la oreja la lee la ronda; desde 1552 el hombre va a galeras al primer hurto; ahorcado, se acaba la cadena.

| Variante | Qué cambia |
|---|---|
| `olla`, `ropa`, `lento` | la olla de una casa a sexta; ropa (no da pan, da mejor invierno); hurtar tarda una franja |
| `ojos`, `prendido`, `huye` | con mucha gente te ven más; si te ven te cogen siempre; si te ven escapas siempre |
| `riesgo05`, `riesgo15`, `riesgo2` | el riesgo de que te vean, por 0,5, 1,5 y 2 |
| `dos`, `castellana`, `cuenta` | oreja y horca; azotes, azotes y horca; prenderte cuenta además como detención |
| `orejaTodos`, `orejaJusticia`, `espalda` | la oreja la lee todo el mundo (menos limosna, ni obra ni hoz); solo el alcalde; el alcalde lee como primer hurto la espalda azotada por pedir |
| `necesidad`, `restituir` | con cuerpo ≤ 2 te ven la mitad; si te buscan, en San Esteban devuelves 2 pedazos y la parte perdona |
| `horcaAcomp`, `horcaAnoche` | ahorcado, sigue quien quede libre; sigue quien durmió contigo la última noche |
| `sinGaleras`, `mujerDos`, `mujerLarga` | sin galeras para el ladrón en 1552 (contra la fuente); mujer: azotes y horca; mujer: tres veces azotes y horca |
| `tuyosHurtan`, `malsinar` | Catalina hurta cuando pasa hambre; el que te vende cuenta también tus hurtos |

## Límites

- El bot aplicado con búsqueda no sabe valorar el hurto (su tabla de valor no tiene esos estados): se mide con el oficio y el veterano, con reglas fijas de cuándo hurtar. No hay un bot que elija por sí mismo el mejor momento.
- Los tuyos no restituyen ni aprovechan la necesidad más que como tú; con `ropa` no hurtan.

## Historia comprobada fuera de la biblia (faltan fichas)

- Partida 7,14,18: al ladrón, azotes públicos; prohíbe matarlo o cortarle miembro por hurto. La oreja de `penas-del-hurto-medievales` es francesa (siglo XIII): en Salamanca sería licencia.
- Pragmática de 25 de noviembre de 1552: al ladrón mayor de veinte años, vergüenza pública y cuatro años de galeras la primera vez; la segunda, cien azotes y galeras perpetuas. Mujeres y menores de veinte, fuera de galeras, «conforme a las leyes». Al vago, cuatro años; ocho la segunda; perpetuas la tercera.
- Pragmática de 3 de mayo de 1566: seis años desde los diecisiete; el tercer hurto, pena de muerte.
- Fuente: «Algunas consideraciones sobre la pena de azotes durante los siglos XVI-XVIII», *Hispania* LXII/3 (2002), pp. 858-873 (leída la primera mitad).

## Orden propuesto de las preguntas (pendiente del visto bueno de Sergio)

1. Qué se coge y qué da que no dé pedir. 2. Quién te ve y qué pasa si te ven. 3. La escalera de la justicia. 4. Qué es morir ahorcado: solo o acompañado. 5. Las marcas en el cuerpo y quién las lee. 6. Hombre y mujer, y 1552. 7. La necesidad extrema. 8. Los tuyos y malsinar. 9. Cierre: números y «ni siempre ni nunca».
