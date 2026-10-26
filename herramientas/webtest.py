import subprocess, time, random, sys, os
from playwright.sync_api import sync_playwright

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "capturas")
os.makedirs(OUT, exist_ok=True)
PJ = sys.argv[1] if len(sys.argv) > 1 else "mozo"
SCHEME = sys.argv[2] if len(sys.argv) > 2 else "dark"
SEED = int(sys.argv[3]) if len(sys.argv) > 3 else 1
random.seed(SEED)

srv = subprocess.Popen([sys.executable, "-m", "http.server", "8765", "--bind", "127.0.0.1"], cwd=ROOT,
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
errores = []
shots = set()
try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, color_scheme=SCHEME,
                            accept_downloads=True, is_mobile=True, has_touch=True)
        pg = ctx.new_page()
        pg.on("console", lambda m: errores.append("console: " + m.text) if m.type == "error" else None)
        pg.on("pageerror", lambda e: errores.append("pageerror: " + str(e)))
        pg.on("dialog", lambda d: d.accept())
        pg.goto("http://127.0.0.1:8765/index.html")
        pg.wait_for_selector("#nombre")

        def shot(name, full=False):
            if name in shots: return
            shots.add(name)
            pg.screenshot(path=f"{OUT}/web_{PJ}_{name}.png", full_page=full)

        shot("inicio", True)
        pg.fill("#nombre", "Prueba automática")
        pg.click("[data-act=empezar]")
        shot("personaje", True)
        pg.click(f"[data-act=elegirPj][data-id={PJ}]")
        pasos = 0
        while pasos < 400:
            pasos += 1
            st = pg.evaluate("() => ({fase: window.__LV.s.fase, dia: window.__LV.s.dia, franja: window.__LV.s.franja, pend: !!window.__LV.ui.pend, sitio: window.__LV.ui.sitio, accion: window.__LV.ui.accion})")
            if pg.locator("#modal:not([hidden])").count():
                pg.click("#modal [data-act=cerrarModal]")
                continue
            f = st["fase"]
            if f == "amanecer":
                if pg.locator("[data-act=introVista]").count():
                    shot("amanecer1", True)
                    pg.click("[data-act=introVista]")
                    continue
                if pg.locator("[data-act=favor]:not([disabled])").count():
                    shot("favor", True)
                    fav = pg.locator("[data-act=favor]:not([disabled])")
                    fav.nth(random.randrange(fav.count())).click()
                    continue
                nb = pg.locator("[data-act=dejarNino], [data-act=recogerNino]")
                if nb.count() and random.random() < 0.5:
                    shot("nino", True)
                    nb.nth(random.randrange(nb.count())).click()
                    continue
                if st["dia"] == 2 and pg.locator("[data-act=treta]").count() and random.random() < 0.8:
                    pg.locator("[data-act=treta]").first.click()
                    pg.locator("[data-act=dadoTreta]").first.click()
                    shot("fingir", True)
                    pg.click("[data-act=fingir]")
                pg.click("[data-act=empezarDia]")
            elif f == "franja":
                if st["pend"]:
                    shot(f"resultado_d{st['dia']}", True)
                    if pg.locator("[data-act=rumor]").count() and random.random() < 0.5:
                        pg.click("[data-act=rumor]")
                    pg.click("[data-act=seguir]")
                    continue
                if not st["sitio"]:
                    if random.random() < 0.08:
                        pg.click("[data-act=pasar]"); continue
                    shot(f"franja_d{st['dia']}", True)
                    opts = pg.locator("[data-act=sitio]:not([disabled])")
                    n = opts.count()
                    if n == 0:
                        pg.click("[data-act=pasar]"); continue
                    opts.nth(random.randrange(n)).click()
                    continue
                if not st["accion"]:
                    acts = pg.locator("[data-act=accion]:not([disabled])")
                    n = acts.count()
                    if n == 0:
                        pg.click("[data-act=cambiarSitio]")
                        pg.click("[data-act=pasar]")
                        continue
                    acts.nth(random.randrange(n)).click()
                    continue
                if pg.locator("[data-act=dado]").count() and pg.locator("[data-act=hacer][disabled]").count():
                    d = pg.locator("[data-act=dado]")
                    d.nth(random.randrange(d.count())).click()
                shot(f"preview_d{st['dia']}", True)
                pg.click("[data-act=hacer]")
            elif f == "castigo":
                shot("castigo", True)
                pg.locator("[data-act=castigo]").first.click()
            elif f == "noche":
                shot(f"noche_d{st['dia']}", True)
                # a veces cambia de sitio para dormir
                ops = pg.locator("[data-act=noche]:not([disabled])")
                if ops.count() > 1 and random.random() < 0.4:
                    ops.nth(random.randrange(ops.count())).click()
                cn = pg.locator("[data-act=comeNino]")
                if cn.count():
                    shot("quien_come", True)
                    cn.nth(random.randrange(cn.count())).click()
                pg.click("[data-act=dormir]")
            elif f == "autoridad":
                shot(f"autoridad_d{st['dia']}", True)
                pg.click("[data-act=amanece]")
            elif f == "fin":
                break
            else:
                errores.append("fase rara " + f); break
        final = pg.evaluate("() => window.__LV.s.final")
        shot("fin", True)
        pg.fill("#e_dolio", "Prueba: dormir fuera o no.")
        pg.fill("#e_sobro", "Nada")
        pg.fill("#e_falto", "Nada")
        with pg.expect_download() as dl:
            pg.click("[data-act=descargar]")
        path = dl.value.path()
        txt = open(path, encoding="utf-8").read()
        ok = "LIBER VAGATORUM" in txt and "Prueba: dormir fuera" in txt and "DATOS PARA ANALIZAR" in txt
        print("final:", final, "| pasos:", pasos, "| informe ok:", ok, "| bytes:", len(txt), "| nombre:", dl.value.suggested_filename)
        # recarga: la partida terminada sigue en el historial
        pg.goto("http://127.0.0.1:8765/index.html")
        pg.click("[data-act=historial]")
        print("historial:", pg.locator("[data-act=hDescargar]").count())
        # service worker y manifest
        sw = pg.evaluate("() => navigator.serviceWorker.getRegistration().then(r => !!r)")
        print("service worker registrado:", sw)
        b.close()
finally:
    srv.terminate()
print("errores:", errores if errores else "ninguno")
