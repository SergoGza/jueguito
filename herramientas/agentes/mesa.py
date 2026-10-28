#!/usr/bin/env python3
"""Mesa de juego: deja jugar Liber Vagatorum desde la línea de comandos, sobre la app real.

Abre la app en un Chromium sin ventana (Playwright), enseña el texto de la pantalla y una lista numerada de lo que
se puede pulsar, y pulsa lo que se le pida. Quien juega ve exactamente lo que vería en el móvil: ni reglas ni cifras
ocultas. Cada partida vive en su propia carpeta (perfil del navegador, estado de la pantalla y diario), así que
varias partidas pueden jugarse a la vez sin pisarse.

Uso (desde la raíz del repositorio):
  python3 herramientas/agentes/mesa.py nueva <personaje> <carpeta> [semilla] [nombre]
  python3 herramientas/agentes/mesa.py ver <carpeta>
  python3 herramientas/agentes/mesa.py pulsar <carpeta> <n o texto> [<n o texto> ...]
  python3 herramientas/agentes/mesa.py diario <carpeta> "<etiqueta> texto"
  python3 herramientas/agentes/mesa.py encuesta <carpeta> "<dolió>" "<sobraba>" "<faltó>" ["<otros>"]
  python3 herramientas/agentes/mesa.py estado <carpeta>
  python3 herramientas/agentes/mesa.py comprobar     (abre el navegador y la app, y dice si funciona)

personaje: mozo, viuda o soldado. En «pulsar», un número es siempre el botón con ese número en la lista de la
pantalla actual; «dado:4» pulsa el dado que vale 4; un texto pulsa el primer botón disponible cuyo título empiece por
él (si no hay, el primero cuyo título o descripción lo contenga), sin distinguir mayúsculas. Con varios, se pulsan en orden, cada uno sobre la pantalla
que deja el anterior.
"""
import json
import mimetypes
import shutil
import sys
import urllib.parse
from datetime import datetime
from pathlib import Path

from playwright.sync_api import sync_playwright

RAIZ = Path(__file__).resolve().parents[2]
ORIGEN = "http://liber.local/"
# Botones que no son del juego o que lo romperían: menú, tema, instalar, historial, informes y abandonar.
FUERA = {"menu", "tema", "inicio", "historial", "instalar", "abandonar", "abandonarDesdeInicio", "nueva",
         "descargar", "compartir", "copiar", "hDescargar", "hCompartir", "hCopiar", "empezar", "elegirPj"}
ETIQUETAS = ("[DECIDO]", "[OBVIO]", "[NADA]", "[NO ENTIENDO]")
# Si el Chromium de Playwright no se puede descargar (en la nube de Claude Code, su servidor no está en la lista de
# dominios), preparar.sh deja aquí la ruta de otro Chromium.
CHROMIUM = RAIZ / "herramientas" / "agentes" / ".chromium"
AYUDA = {"ayuda", "metro", "red"}  # abren explicaciones: van al final de la lista


def servir(route):
    ruta = urllib.parse.urlparse(route.request.url).path.lstrip("/") or "index.html"
    f = (RAIZ / ruta).resolve()
    if RAIZ in f.parents and f.is_file():
        tipo = mimetypes.guess_type(str(f))[0] or "application/octet-stream"
        route.fulfill(path=str(f), content_type=tipo)
    else:
        route.fulfill(status=404, body="")


def opciones_navegador():
    if CHROMIUM.is_file():
        ruta = CHROMIUM.read_text().strip()
        if ruta and Path(ruta).is_file():
            return {"executable_path": ruta, "args": ["--no-sandbox", "--no-zygote"]}
    return {}


class Mesa:
    def __init__(self, carpeta):
        self.carpeta = Path(carpeta)
        self.dialogos = []

    def __enter__(self):
        self.pw = sync_playwright().start()
        self.ctx = self.pw.chromium.launch_persistent_context(
            str(self.carpeta / "perfil"), headless=True, viewport={"width": 390, "height": 844},
            service_workers="block", locale="es-ES", **opciones_navegador())
        self.ctx.route(ORIGEN + "**", servir)
        self.pg = self.ctx.pages[0] if self.ctx.pages else self.ctx.new_page()
        self.pg.on("dialog", self._dialogo)
        self.errores = []
        self.pg.on("pageerror", lambda e: self.errores.append(str(e)))
        return self

    def __exit__(self, *a):
        self.ctx.close()
        self.pw.stop()

    def _dialogo(self, d):
        self.dialogos.append(d.message)
        d.accept()

    # ------------------------------------------------------------ estado entre llamadas
    def abrir(self, query=""):
        self.pg.goto(ORIGEN + "index.html" + query)
        self.pg.wait_for_selector("#app *")
        uip = self.carpeta / "ui.json"
        if uip.exists():
            hay = self.pg.evaluate("() => !!window.__LV.s")
            if hay:
                ui = json.loads(uip.read_text(encoding="utf-8"))
                ui.pop("menu", None)
                self.pg.evaluate("(ui) => { Object.assign(window.__LV.ui, ui); window.__LV.render(); }", ui)

    def guardar(self):
        ui = self.pg.evaluate("() => JSON.parse(JSON.stringify(window.__LV.ui))")
        (self.carpeta / "ui.json").write_text(json.dumps(ui, ensure_ascii=False), encoding="utf-8")

    # ------------------------------------------------------------ pantalla
    def botones(self):
        return self.pg.evaluate("""(fuera) => {
          const modal = document.querySelector('#modal:not([hidden])');
          const raiz = document.getElementById('app');
          const out = [];
          raiz.querySelectorAll('[data-act]').forEach((el, i) => {
            if (fuera.includes(el.dataset.act)) return;
            const r = el.getBoundingClientRect();
            if (!r.width && !r.height) return;
            const txt = (el.innerText || el.textContent || '').replace(/\\s*\\n\\s*/g, ' · ').replace(/\\s+/g, ' ').trim();
            const aria = el.getAttribute('aria-label');
            const nombre = txt.length <= 2 && aria ? `${aria} (${txt})` : txt || aria || el.dataset.act;
            const dado = el.dataset.act === 'dado' || el.dataset.act === 'dadoTreta' ? (el.querySelector('.dado') || el).textContent.trim() : '';
            out.push({ idx: i, act: el.dataset.act, dado, sel: el.classList.contains('sel'), txt: nombre, ok: !el.disabled && !el.hasAttribute('disabled') });
          });
          return { modal: !!modal, botones: out };
        }""", sorted(FUERA))

    def texto(self):
        # Copia la pantalla fuera de la vista y la deja legible como texto: los marcadores en una línea, el termómetro
        # con la casilla marcada y los dados con los gastados señalados (en el móvil se ve por el color).
        return self.pg.evaluate("""() => {
          const legible = (el) => {
            if (!el) return '';
            const c = el.cloneNode(true);
            c.removeAttribute('id');
            c.querySelectorAll('.icon-btn').forEach((x) => x.remove());
            c.querySelectorAll('.estado .chip').forEach((ch) => {
              const b = ch.querySelector('b');
              const partes = Array.from(ch.childNodes).filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).filter(Boolean);
              ch.replaceWith(document.createTextNode(`${partes[0] || ''} ${b ? b.textContent : ''}${partes[1] ? ' (' + partes[1] + ')' : ''} · `));
            });
            c.querySelectorAll('.fila-metro').forEach((f) => {
              const lbl = (f.querySelector('.lbl') || {}).textContent || '';
              const fin = (f.querySelector('.termo-lbl') || {}).textContent || '';
              const t = f.querySelector('.termo');
              let linea = `${lbl}: ${fin}`;
              if (t) {
                const on = t.querySelector('.on');
                const cerrado = t.querySelectorAll('.cerrado').length;
                linea = `${lbl}: ${on ? on.textContent : '?'}, ${fin} (escala de −3 a +3${cerrado ? '; el +3 está cerrado: solo si ya te han detenido' : ''})`;
              }
              const d = document.createElement('div'); d.textContent = linea; f.replaceWith(d);
            });
            c.querySelectorAll('.dados').forEach((d) => {
              const v = Array.from(d.querySelectorAll('.dado')).map((x) => (x.classList.contains('usado') ? '(' + x.textContent + ', gastado)' : x.textContent));
              d.replaceWith(document.createTextNode('Dados: ' + v.join('  ')));
            });
            c.querySelectorAll('.badges').forEach((b) => b.replaceWith(document.createTextNode(Array.from(b.children).map((x) => x.textContent.trim()).join(' · '))));
            c.style.cssText = 'position:absolute;left:-10000px;top:0;width:390px';
            document.body.appendChild(c);
            const t = c.innerText.replace(/\\n{3,}/g, '\\n\\n').trim();
            c.remove();
            return t;
          };
          const modal = document.querySelector('#modal:not([hidden])');
          return { app: legible(document.getElementById('app')), modal: modal ? legible(modal) : '' };
        }""")

    def pantalla(self):
        b = self.botones()
        t = self.texto()
        lineas = []
        if t["modal"]:
            lineas += ["=== VENTANA DE AYUDA (se cierra sola con tu siguiente orden; la pantalla del juego sigue igual que antes) ===",
                       t["modal"].removesuffix("Cerrar").strip(), ""]
        else:
            lineas += [t["app"], ""]
        lineas.append("=== LO QUE PUEDES PULSAR (el detalle de cada opción está arriba) ===")
        juego = [x for x in b["botones"] if x["act"] not in AYUDA]
        ayuda = [x for x in b["botones"] if x["act"] in AYUDA]
        n = 0
        for x in juego:
            partes = x["txt"].split(" · ")
            if x["ok"]:
                n += 1
                dado = f"  (dado {x['dado']})" if x.get("dado") else ""
                lineas.append(f"[{n}] {partes[0]}{dado}" + ("  ← elegido" if x["sel"] else ""))
            else:
                lineas.append(f"[–] {partes[0]} (no disponible: {partes[-1]})" if len(partes) > 1 else f"[–] {partes[0]} (no disponible)")
        if ayuda:
            items = []
            for x in ayuda:
                if x["ok"]:
                    n += 1
                    items.append(f"[{n}] {x['txt'].split(' · ')[0]}")
            lineas.append("Ayuda (explica, no gasta nada): " + " · ".join(items))
        if self.dialogos:
            lineas += ["", "(Aviso de la app, aceptado: " + " | ".join(self.dialogos) + ")"]
        if self.errores:
            lineas += ["", "ERROR DE LA APP: " + " | ".join(self.errores)]
        return "\n".join(lineas)

    def pulsar(self, objetivo):
        # las ventanas de ayuda solo explican: si hay una abierta, se cierra antes de seguir
        self.pg.evaluate("() => { const m = document.getElementById('modal'); if (m && !m.hidden) { m.hidden = true; m.innerHTML = ''; } }")
        b = self.botones()["botones"]
        orden = [x for x in b if x["act"] not in AYUDA] + [x for x in b if x["act"] in AYUDA]
        disponibles = [x for x in orden if x["ok"]]
        elegido = None
        obj = str(objetivo).strip()
        if obj.lower().startswith("dado:"):
            v = obj.split(":", 1)[1].strip()
            elegido = next((x for x in disponibles if x.get("dado") == v and not x["sel"]), None) or next((x for x in disponibles if x.get("dado") == v), None)
        elif obj.isdigit():
            k = int(objetivo)
            if 1 <= k <= len(disponibles):
                elegido = disponibles[k - 1]
        else:
            q = str(objetivo).lower().strip()
            titulo = lambda x: x["txt"].split(" · ")[0].lower()
            elegido = (next((x for x in disponibles if titulo(x).startswith(q)), None)
                       or next((x for x in disponibles if q in titulo(x)), None)
                       or next((x for x in disponibles if q in x["txt"].lower()), None))
        if not elegido:
            raise ValueError(f"no hay ningún botón disponible «{objetivo}»")
        self.pg.locator("#app [data-act]").nth(elegido["idx"]).click()
        self.pg.wait_for_timeout(50)
        return elegido["txt"].split(" · ")[0]

    def estado(self):
        return self.pg.evaluate("""() => { const s = window.__LV.s; if (!s) return null;
          return { dia: s.dia, fase: s.fase, franja: s.franja, final: s.final, personaje: s.pj, version: s.v }; }""")


def momento(est):
    if not est:
        return "inicio"
    franjas = ["Prima", "Tercia", "Sexta", "Nona", "Vísperas"]
    f = est["fase"]
    if f == "franja":
        return f"Día {est['dia']} · {franjas[est['franja']] if est['franja'] < 5 else 'noche'}"
    return f"Día {est['dia']} · {'fin' if f == 'fin' else f}"


def comprobar():
    import tempfile
    with tempfile.TemporaryDirectory() as d:
        try:
            with Mesa(d) as m:
                m.pg.goto(ORIGEN + "index.html")
                m.pg.wait_for_selector("#nombre", timeout=20000)
        except Exception as e:  # noqa: BLE001
            print("La mesa no arranca:", str(e).splitlines()[0] if str(e) else repr(e))
            sys.exit(1)
    print("ok: el navegador abre la app" + (" (Chromium de " + CHROMIUM.read_text().strip() + ")" if opciones_navegador() else ""))


def main(a):
    if a[:1] == ["comprobar"]:
        comprobar()
        return
    if len(a) < 2 or a[0] not in ("nueva", "ver", "pulsar", "diario", "encuesta", "estado"):
        print(__doc__)
        sys.exit(1)
    orden = a[0]
    if orden == "nueva":
        if len(a) < 3:
            raise SystemExit("Uso: nueva <personaje> <carpeta> [semilla] [nombre]")
        pj, carpeta = a[1], Path(a[2])
        semilla = a[3] if len(a) > 3 else ""
        nombre = a[4] if len(a) > 4 else "Agente"
        if carpeta.exists():
            raise SystemExit(f"La carpeta {carpeta} ya existe: bórrala o usa otra para empezar de cero.")
        carpeta.mkdir(parents=True)
        with Mesa(carpeta) as m:
            m.abrir("?semilla=" + urllib.parse.quote(semilla) if semilla else "")
            m.pg.fill("#nombre", nombre)
            m.pg.click("[data-act=empezar]")
            m.pg.click(f"[data-act=elegirPj][data-id={pj}]")
            m.guardar()
            est = m.estado()
            (carpeta / "partida.json").write_text(json.dumps({"personaje": pj, "semilla": semilla, "nombre": nombre, "version": est["version"] if est else None, "empezada": datetime.now().isoformat(timespec="seconds")}, ensure_ascii=False, indent=1), encoding="utf-8")
            print(m.pantalla())
        return
    carpeta = Path(a[1])
    if not (carpeta / "ui.json").exists():
        raise SystemExit(f"No hay ninguna partida en {carpeta}. Empieza con «nueva».")
    with Mesa(carpeta) as m:
        m.abrir()
        if orden == "ver":
            print(m.pantalla())
        elif orden == "pulsar":
            if len(a) < 3:
                raise SystemExit("Uso: pulsar <carpeta> <n o texto> [...]")
            hechos, fallo = [], None
            for objetivo in a[2:]:
                try:
                    hechos.append(f"«{objetivo}» → {m.pulsar(objetivo)}")
                except ValueError as e:
                    fallo = f"«{objetivo}»: {e}"
                    break
            m.guardar()
            if fallo:
                print("ATENCIÓN: " + ("pulsado " + "; ".join(hechos) + ". " if hechos else "no se ha pulsado nada. ") + "Falló " + fallo + ". Lo que sigue no se ha pulsado.\n")
            elif len(hechos) > 1:
                print("Pulsado: " + "; ".join(hechos) + ".\n")
            print(m.pantalla())
        elif orden == "diario":
            linea = " ".join(a[2:]).strip()
            if not linea.startswith(ETIQUETAS):
                raise SystemExit("La línea tiene que empezar por una etiqueta: " + ", ".join(ETIQUETAS))
            with open(carpeta / "diario.md", "a", encoding="utf-8") as f:
                f.write(f"- {momento(m.estado())} · {linea}\n")
            print("Apuntado.")
        elif orden == "encuesta":
            est = m.estado()
            if not est or est["fase"] != "fin":
                raise SystemExit("La encuesta se contesta al acabar la partida.")
            resp = (a[2:] + ["", "", "", ""])[:4]
            for clave, valor in zip(("dolio", "sobro", "falto", "otros"), resp):
                if valor:
                    m.pg.fill(f"[data-enc={clave}]", valor)
            m.pg.wait_for_timeout(50)
            informe = m.pg.evaluate("() => window.ENGINE.informe(window.__LV.s)")
            (carpeta / "informe.txt").write_text(informe, encoding="utf-8")
            resultado = {"final": est["final"], "encuesta": dict(zip(("dolio", "sobro", "falto", "otros"), resp))}
            (carpeta / "resultado.json").write_text(json.dumps(resultado, ensure_ascii=False, indent=1), encoding="utf-8")
            print("Encuesta guardada e informe escrito en " + str(carpeta / "informe.txt"))
        elif orden == "estado":
            print(json.dumps(m.estado(), ensure_ascii=False))


if __name__ == "__main__":
    main(sys.argv[1:])
