# Hurtar y la horca: prototipo para bots

**12 de noviembre de 2026: montado en la j0.12.** Lo decidido en las nueve rondas tiene ya pantalla (botón «Activar hurtar» al empezar) y está en `main`; ver «Hurtar y la horca» en el README y «Montado en la j0.12» al final de esta nota. Lo que sigue es el registro del prototipo y de las medidas, tal como se escribió.

10 de noviembre de 2026. Rama `claude/hurto-prototipo`, sobre la j0.11 más el bot aplicado (`f0fe327`). No va a `main`, no tiene pantalla y no decide nada: son palancas para medir las opciones antes de que Sergio decida por rondas.

## Qué hay

- **Reglas** en `rules.js` (`PARAMS.hurto`) y `engine.js`, detrás de `opts.hurto`. Sin esa opción, el motor da exactamente lo mismo que la j0.11 (comprobado con el veterano y el novato, un verano, con los tuyos y la cadena).
- **Política del bot y cuentas** en `herramientas/hurto-comun.js`: `HURTO=nunca|apuro|grave|hambre|siempre` (apuro: sin ración y cuerpo ≤ 2; grave: sin ración y cuerpo ≤ 3; hambre: desde sexta, sin la ración; siempre: en vez de pedir).
- **Lanzador** en `herramientas/hurto-tanda.js`: una tanda por variante, política, bot (veterano de `bot.js` y oficio de `aplicado.js`) y escenario (un verano, con los tuyos, cadena como mozo, cadena como moza). Cada variante cambia una palanca respecto de la base.
- **Medidas** en `claude/hurto-medidas.jsonl`: 332 tandas de 2.000 partidas (semillas 1 a 2.000), una línea por tanda.

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
| `ojos`, `prendido`, `huye`, `gente` | con mucha gente te ven más; si te ven te cogen siempre; si te ven escapas siempre; con mucha gente te sujetan y con poca escapas |
| `riesgo05`, `riesgo15`, `riesgo2` | el riesgo de que te vean, por 0,5, 1,5 y 2 |
| `tres`, `dos`, `castellana`, `cuenta` | azotes, oreja y horca; oreja y horca; azotes, azotes y horca; prenderte cuenta además como detención |
| `cuerpoOreja`, `cuerpoOrejaTodos`, `cuerpoEspalda` | entre veranos la justicia solo sabe lo que lleva el cuerpo: el segundo peldaño corta la oreja (la lee solo la justicia, o todo el mundo), o no hay oreja y la espalda azotada, venga de donde venga, gasta el aviso |
| `orejaTodos`, `orejaJusticia`, `espalda` (de antes de la ronda 3) | la oreja la lee todo el mundo (menos limosna, ni obra ni hoz); solo el alcalde; el alcalde lee como primer hurto la espalda azotada por pedir |
| `necesidad`, `restituir`, `restituirUna` | con cuerpo ≤ 2 te ven la mitad; si te buscan, en San Esteban devuelves 2 pedazos y la parte perdona; lo mismo, una vez cada verano. El bot solo restituye cuando le sobra (lo que devuelve y la ración de esa noche): la primera versión devolvía el pan que acababa de coger |
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

## Decisiones (Sergio, por rondas)

- **Ronda 1 (10 de noviembre): A, pan de un puesto.** Una hogaza (2 pedazos) en la Plaza o la Rúa cuando hay mercado o tienda abierta. Descartadas: la olla de una casa a sexta (B: mismos números, pero el riesgo no se lee en el mapa; la cita de Robles puede quedar como texto) y la ropa para el invierno (C: no compensa a nadie con el premio medido y el momento es obvio). Que hurtar tarde 2 ratos o una franja no cambia nada. Medido por parejas (las mismas partidas, solo las que llegan a estar sin ración y con cuerpo 2 o menos, un verano): veterano, 14 % sin hurtar y 63 % hurtando; oficio, 77 % y 65 % (con el riesgo a la mitad, 83 %).

- **Ronda 2 (11 de noviembre): D, según la gente.** Te ve el dueño o el vecino. Con mucha gente te ven menos (1 de cada 4), pero si te ven te sujetan allí mismo; con poca te ven más (1 de cada 3), pero escapas con lo hurtado y te buscan por tus señas (la ronda te para la mitad de las veces que llegas donde está, y cualquier parada o noche en un portal acaba ante la justicia; dura hasta que te prenden o hasta el invierno). Descartadas: te cogen siempre allí (A: para quien juega bien es «nunca», y no usa nada de lo construido), escapas siempre (B: para el que pasa hambre hurtar siempre ya gana a no hurtar) y mitad y mitad (C: la segunda tirada es a ciegas). Pendiente para el cierre: con estos números, poca gente es mejor siempre (que te busquen cuesta menos que te cojan), y «te buscan» aprieta sin freno (quien se sabe buscado deja de entrar y pasa hambre). Medido por parejas en apuros (un verano): veterano, 14 % sin hurtar y 67 % hurtando; oficio, 77 % y 78 %.
- Desde aquí las medidas llevan D fija y están en `claude/hurto-medidas-d.jsonl`; las de antes de la ronda 2 (con «mitad y mitad» de base), en `claude/hurto-medidas.jsonl`.

- **Ronda 3 (11 de noviembre): D, vergüenza, azotes y horca** («ya iremos ajustando»). La primera vez que te prenden te sacan a la vergüenza (en un asno, con el pregonero delante, sin azotes): pierdes el pan, el día y la noche de cárcel, y el alcalde dice «A la segunda, el verdugo». La segunda, azotes; la tercera, la horca. Va aparte de las detenciones por pedir. Descartadas: azotes, segundo castigo y horca (A: al que cogen flaco lo mata el primer peldaño; 141 de 715 veteranos en apuros), castigo y horca (B: la única en que la horca sale de verdad, pero un solo castigo te deja a un hurto de la horca toda la vida) y que prenderte cuente para el destierro (C: el ladrón acaba desterrado antes que ahorcado). Medido por parejas en apuros (un verano): veterano, 14 % sin hurtar y 75 % hurtando; oficio, 77 % y 91 %. En la cadena, el oficio que hurta solo en apuros completa el 52,4 % (sin hurtar, 50,6 %). Pendiente: la horca casi no sale si se hurta con cabeza (4,6 % de las cadenas del veterano que hurta cuando le falta la ración), y la vergüenza no deja marca en el cuerpo (ronda 5).
- Las medidas con la escalera decidida están en `claude/hurto-medidas-r3.jsonl`.

- **Ronda 4 (11 de noviembre): A, ahorcado se muere solo.** Te sacan de la cárcel a la horca, se acaba la cadena y el siguiente es el anónimo (el testigo de la horca). No pide regla nueva: ya estaba decidido que en la cárcel se muere solo. Descartadas: que siga uno de los tuyos que quede libre (B) o quien durmió contigo la última noche libre (C): con cualquiera de las dos la horca es un relevo más y hurtar siempre sube de 5,5 % a 26-28 % para la veterana y de 15 % a 26-28 % para la moza del oficio. Que los tuyos estén entre la gente puede darse por texto, sin que hereden.

- **Ronda 5 (11 de noviembre): D2, la espalda quita el peldaño de en medio.** La justicia no recuerda de un verano a otro más que lo que lleva el cuerpo: la vergüenza se olvida en invierno; los azotes, no. No hay oreja ni otra marca de ladrón. Al que tiene la espalda azotada, por lo que sea (la segunda detención, la justicia o los varazos de la ronda a la mujer), le queda la vergüenza, pero azotes ya lleva: si lo prenden otra vez, la horca. Al limpio le toca vergüenza, azotes y horca. Se dice por el mundo (propuesta de Claude: al sacarlo a la vergüenza, el alcalde le levanta la camisa, «Azotes ya llevas. A la segunda, la soga»). Sergio prefería D (la espalda gasta el aviso: el azotado va directo a los azotes) y pidió equilibrarla: tal cual, la moza del oficio en apuros quedaba por debajo de no hurtar (85,3 % contra 86,3 %), porque a la mujer la ronda la azota por la calle y los azotes con el cuerpo bajo matan. Con D2, 89,1 %; la veterana en apuros, 38,6 % (con D, 27,8 %); hurtar siempre es lo peor (8,0 %), y la cadena acaba en la horca el 12 % de las veces para la veterana que hurta solo en apuros (antes, 1-2 %). Descartadas: el libro (A: la cuenta no se pierde nunca; contradice lo decidido en el relevo y pide un contador), la oreja (B y C: licencia en Castilla; C abría una espiral), D tal cual y D1 (solo cuentan los azotes del verdugo: equilibra quitando el efecto).
- Las medidas con las rondas 1 a 5 fijas están en `claude/hurto-medidas-r5.jsonl`.

- **Ronda 6 (11 de noviembre): A, galeras al primer hurto desde 1552.** Es la pragmática tal cual: al ladrón mayor de veinte años, vergüenza y cuatro años de galeras la primera vez; sale de la cadena sin morir y ya no puede acabar en la horca. La mujer sigue en la escalera (limpia: vergüenza, azotes y horca; azotada: vergüenza y horca), así que desde 1552 la horca es cosa de mujeres. Descartadas: vergüenza la primera vez y galeras a la segunda (B: licencia que los números no piden) y sin galeras para el ladrón (C: contra la fuente). Las tres daban casi lo mismo (menos de dos puntos hurtando con cabeza), y con galeras no se completa más que sin ellas: no hay trampa de hacerse mandar a galeras. Con todo lo decidido, la mujer gana más hurtando en apuros (veterana, de 5 % a 39 %; veterano, de 5 % a 21 %) y acaba más en la horca (12 % de las cadenas frente a 3 %).

- **Ronda 7 (12 de noviembre): B, los vecinos miran a otro lado.** Con el cuerpo en 2 o menos te ven la mitad de las veces; el alcalde no cambia: si te ven, todo sigue igual. Se dice por el mundo después de que pase (el panadero te mira las costillas y vuelve la cabeza). Ayuda solo al que hurta por necesidad (veterana en apuros, de 38,6 % a 49,6 %; moza del oficio, de 89,1 % a 91,8 %) y no mueve nada para el que hurta siempre. Descartadas: nada, solo se dice (A) y restituir en San Esteban (C: no llega a quien la necesita, porque el que hurtó por hambre no tiene dos pedazos que devolver, y sí al que hurta con pan de sobra: hurtar siempre sube de 8 % a 20 % para la veterana; el hallazgo puede quedar como texto del fraile). Pendiente: con B el necesitado casi deja de llegar a la horca (de 12 % a 3,5 % de las cadenas), no está medido si tienta quedarse flaco para hurtar más seguro, y «te buscan» sigue sin freno.
- Las medidas con las rondas 1 a 7 fijas están en `claude/hurto-medidas-r7.jsonl`.

- **Ronda 8 (12 de noviembre): D, las dos.** Catalina (la que se arriesga) hurta cuando pasa hambre (cuerpo 2 o menos y sin cena), con tus mismas reglas, y de noche te lo cuenta; Pedro no hurta. Y el que te vende cuenta también lo que has hurtado ese verano: desde ese día te buscan. Con Catalina hurtando se le mueren menos tuyos al veterano (de 0,48 a 0,30 por cadena) y la cadena sube (veterano en apuros, de 25,5 % a 34,5 %; oficio, de 54,2 % a 58,8 %); el malsín resta alrededor de un punto y pasa en 7-9 de cada 100 cadenas si hurtas en apuros. Avisos: hace la cadena más fácil, y a Catalina la ahorcan en 1 de cada 200 cadenas (la horca sigue sin verse).
- Las medidas con las rondas 1 a 8 fijas, y las del cierre, están en `claude/hurto-medidas-r8.jsonl` (las tandas hechas con `HGENTE=poca|mucha` llevan `conGente`).

- **Ronda 9 (12 de noviembre): D, los tres ajustes.** Te buscan tres días; Catalina hurta antes (con el cuerpo en 3 o menos); con poca gente te ven 1 de cada 2 (con mucha, 1 de cada 4). Quedan fijados en `rules.js`, y las medidas finales están en `claude/hurto-medidas-final.jsonl`. Comprobación final (% que llega o completa: nunca / en apuros / cuando falta la ración / siempre): un verano, veterano 52,6 / 75,0 / 73,3 / 53,0 y oficio 98,1 / 98,3 / 96,3 / 59,6; con los tuyos, 37,2 / 62,4 / 63,3 / 46,5 y 87,3 / 90,4 / 83,4 / 61,1; cadena como mozo, 8,5 / 36,5 / 34,4 / 13,8 y 57,4 / 60,9 / 45,6 / 17,3; cadena como moza, 8,3 / 49,5 / 31,4 / 6,1 y 86,6 / 91,3 / 69,0 / 17,6. A Catalina la ahorcan en 4-9 de cada 100 cadenas. Sin la opción de hurto, el motor sigue dando lo mismo que `main` (comprobado con un verano y con la cadena).
- Las nueve decisiones están pasadas al proyecto, en `claude/decisiones-replanteamiento.md` («Hurtar y la horca»).

### Lo medido para el cierre (ronda 9)

- **Ni siempre ni nunca, con todo lo decidido** (llega o completa: nunca / en apuros / cuando falta la ración / siempre). Un verano: veterano 52,6 / 74,9 / 73,6 / 56,5; oficio 98,1 / 98,3 / 85,4 / 59,8. Cadena como mozo: 6,8 / 34,3 / 34,0 / 18,4 y 55,1 / 58,3 / 29,1 / 18,4. Cadena como moza: 6,9 / 52,3 / 36,1 / 9,2 y 87,4 / 91,3 / 38,9 / 20,4.
- **La gente (ronda 2).** El bot que solo hurta con mucha gente sale peor con todos los números probados (veterano hurtando siempre: 19-32 % frente a 49-62 % con poca; en apuros, 68 % frente a 73-74 %), no porque le cojan más sino porque hay menos ocasiones y que te cojan cuesta el pan y el día en el acto. La regla funciona como restricción legible («con el mercado lleno, no»), no como elección entre dos riesgos.
- **Te buscan tres días** (`busca3`): quita el apretón al que se sabe buscado (oficio que hurta cuando le falta la ración: un verano, de 85,4 % a 96,7 %; cadena, de 29,1 % a 43,7 %; como moza, de 38,9 % a 73,9 %) y sube «siempre» entre 1 y 4 puntos.
- **Catalina hurta antes**, con el cuerpo en 3 o menos (`catalina3`): la ahorcan en 3-6 de cada 100 cadenas (antes, 1 de cada 200).
- **Con poca gente te ven 1 de cada 2** (`poca50`): baja «siempre» 4-5 puntos y casi no toca «en apuros».
- **Paquetes:** `cierreC` (tres días y Catalina antes) y `cierreD` (lo mismo y poca gente 1 de cada 2).
- **Barrido del riesgo** (×0,5 y ×2 sobre la base): con la mitad, el veterano que hurta siempre llega el 67 % (nunca, 53 %); con el doble, a la moza del oficio en apuros le queda un margen de 0,8 puntos sobre no hurtar.

## Orden de las preguntas

1. Qué se coge y qué da que no dé pedir. 2. Quién te ve y qué pasa si te ven. 3. La escalera de la justicia. 4. Qué es morir ahorcado: solo o acompañado. 5. Las marcas en el cuerpo y quién las lee. 6. Hombre y mujer, y 1552. 7. La necesidad extrema. 8. Los tuyos y malsinar. 9. Cierre: números y «ni siempre ni nunca».

## Montado en la j0.12 (12 de noviembre)

Rama `claude/j0.12-hurto`, subida a `main`. Las reglas no cambian respecto de lo medido: con las mismas semillas, los bots dan exactamente los mismos resultados que el prototipo (y, sin hurtar, los de la j0.11). Lo nuevo es pantalla y texto:

- **Al empezar:** botón «Activar hurtar», que vale solo o con la llaga, los tuyos o varios veranos.
- **De día:** botón «Hurtar una hogaza» en la Plaza y la Rúa cuando hay qué coger, y una línea en «Antes de actuar» que dice el trato (poca gente: más ojos, pero puedes correr; mucha: menos ojos, pero manos que te sujetan).
- **«Te busca la justicia · día 1 de 3»** en la cabecera, solo si lo sabes: porque te vieron la cara o porque en la ribera te dicen que quien te vendió sabía lo del pan. Si te malsinan y no duermes en la ribera esa noche, te enteras cuando te para el alguacil. Al caducar: «por las tuyas no pregunta nadie».
- **El alcalde dice la escalera:** «A la segunda, el verdugo»; después de los azotes, «A la tercera, la soga»; al azotado, levantándole la camisa, «Azotes ya llevas. A la segunda, la soga».
- **La necesidad:** cuando te habrían visto y no te ven por flaco, «El panadero te ha visto la mano. Te mira las costillas y vuelve la cabeza».
- **La horca:** final propio («La horca»). Con los tuyos libres: «Catalina está entre la gente. No puede acercarse».
- **1552:** el pregón nombra a los ladrones y dice que de las mujeres no dice nada.
- **Catalina:** cuenta sus hurtos de noche («Me vieron la cara: me andarán buscando», «El panadero me vio. Me miró y se volvió para otro lado») y, si la prenden, lo que le dijo el alcalde.
- **El malsín:** el alguacil, al que le han contado tus hurtos: «A ti te conozco yo de oídas: alargas la mano en los puestos».
- **Informe y encuesta:** sección «Hurtar y la horca» (cada hurto con cuerpo, pan, gente y cómo acabó; las penas; los hurtos de Catalina) y una pregunta más: «¿Cuándo decidiste hurtar, o no hacerlo, y por qué?».
- **Ayuda y licencias:** apartado «Hurtar» y cinco licencias nuevas (`LICENCIAS_HURTO`).

Probado en Chromium sin ventana: 54 partidas enteras pulsando los botones de la app (solo hurtar, con los tuyos, con la llaga y con varios veranos), más los casos sueltos (caducan las señas, condenan a Catalina, final de la horca con los tuyos, pantalla ancha). Sin errores.

Cosas que quedan como estaban y conviene saber:

- Si te condenan a la horca con el cuerpo en 1, la noche de cárcel te deja en 0 y aun así el final es la horca, no el hambre (así se midió; en los dos casos la cadena se acaba).
- Se puede hurtar con el zurrón lleno (4 pedazos): corres el riesgo y no ganas nada. Pedir hace lo mismo.
