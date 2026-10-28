import subprocess, time, sys, os
from playwright.sync_api import sync_playwright
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."); OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "capturas"); os.makedirs(OUT, exist_ok=True)
srv = subprocess.Popen([sys.executable, "-m", "http.server", "8766", "--bind", "127.0.0.1"], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1); err = []
try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2, color_scheme="light")
        pg.on("pageerror", lambda e: err.append(str(e)))
        pg.on("dialog", lambda d: d.accept())
        pg.goto("http://127.0.0.1:8766/index.html"); pg.wait_for_selector("#nombre")
        pg.fill("#nombre", "Prueba niño"); pg.click("[data-act=empezar]"); pg.click("[data-act=elegirPj][data-id=viuda]")
        if pg.locator("[data-act=introVista]").count(): pg.click("[data-act=introVista]")
        pg.evaluate("""() => { const s = window.__LV.s; s.contactos.push({id:'cX', nombre:'Catalina la Rubia', rel:3, lado:'dentro', desde:1}); s.nino.cuerpo = 2; window.__LV.render(); }""")
        pg.screenshot(path=f"{OUT}/nino_amanecer.png", full_page=True)
        pg.click("[data-act=dejarNino]")
        pg.screenshot(path=f"{OUT}/nino_dejado.png", full_page=True)
        pg.click("[data-act=recogerNino]")
        pg.click("[data-act=empezarDia]")
        pg.click("[data-act=acabarDia]")
        pg.evaluate("""() => { const s = window.__LV.s; s.raciones = 1; s.monedas = 0; s.contactos[0].rel = 2; window.__LV.render(); }""")
        pg.screenshot(path=f"{OUT}/nino_noche.png", full_page=True)
        pg.click("[data-act=noche][data-id=portico]")
        pg.click("[data-act=comeNino][data-d='0']")
        pg.click("[data-act=dormir]")
        pg.screenshot(path=f"{OUT}/nino_noche_res.png", full_page=True)
        print(pg.evaluate("() => JSON.stringify(window.__LV.s.nino) + ' cuerpo madre ' + window.__LV.s.cuerpo"))
        b.close()
finally:
    srv.terminate()
print("errores:", err or "ninguno")
