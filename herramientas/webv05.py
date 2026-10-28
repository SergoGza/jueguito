# Prueba dirigida de la interfaz de la v0.5: pregón, expulsión, techo con relación 3, media ración y final de la viuda.
# Uso: python3 herramientas/webv05.py  (deja capturas en herramientas/capturas/v05_*.png)
import subprocess, time, sys, os
from playwright.sync_api import sync_playwright
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."); OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "capturas"); os.makedirs(OUT, exist_ok=True)
srv = subprocess.Popen([sys.executable, "-m", "http.server", "8767", "--bind", "127.0.0.1"], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1); err = []; fallos = 0
def ok(c, m):
    global fallos
    print(("ok: " if c else "FALLA: ") + m)
    if not c: fallos += 1
def empezar(pg, pj):
    pg.goto("http://127.0.0.1:8767/index.html"); pg.evaluate("() => localStorage.clear()"); pg.reload(); pg.wait_for_selector("#nombre")
    pg.fill("#nombre", "Prueba v05"); pg.click("[data-act=empezar]"); pg.click(f"[data-act=elegirPj][data-id={pj}]")
    if pg.locator("[data-act=introVista]").count(): pg.click("[data-act=introVista]")
def ir_al_dia(pg, dia):
    pg.evaluate(f"""() => {{ const s = window.__LV.s; s.dia = {dia}; s.hoy.dia = {dia}; s.tiempos[{dia}] = {{ inicio: new Date().toISOString(), fin: null }}; window.__LV.render(); }}""")
texto = lambda pg: pg.inner_text("body")
try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2, color_scheme="light")
        pg.on("pageerror", lambda e: err.append(str(e)))
        pg.on("dialog", lambda d: d.accept())

        # 1) mozo, día 4: aviso del pregón al amanecer y en la tabla de testigos
        empezar(pg, "mozo"); ir_al_dia(pg, 4)
        t = texto(pg)
        ok("si un alguacil te ve dentro de la muralla, Te buscan +2" in t and "te sacan de la ciudad y no te dejan entrar en 3 días" in t, "el amanecer del día 4 explica el pregón al mozo")
        pg.screenshot(path=f"{OUT}/v05_pregon_amanecer.png", full_page=True)
        pg.click("[data-act=empezarDia]")
        pg.click("[data-act=sitio][data-id=plaza]"); pg.click("[data-act=accion][data-id=pedir]")
        ok("pregón en marcha: Te buscan +2" in texto(pg), "la tabla de testigos avisa del pregón")
        pg.screenshot(path=f"{OUT}/v05_pregon_testigos.png", full_page=True)

        # 2) mozo echado de la ciudad: insignia y puerta cerrada para él
        pg.evaluate("""() => { const s = window.__LV.s; s.fuera = true; s.vetadoHasta = 6; window.__LV.ui.sitio = null; window.__LV.ui.accion = null; window.__LV.render(); }""")
        ok("Te han echado: no puedes entrar hasta el día 7" in texto(pg), "insignia de expulsión")
        pg.click("[data-act=sitio][data-id=puente]")
        ok("la guardia no te deja entrar hasta el día 7" in texto(pg), "cruzar la puerta está vetado y dice hasta cuándo")
        pg.screenshot(path=f"{OUT}/v05_expulsado.png", full_page=True)

        # 3) soldado: el hospital le recoge a la segunda
        empezar(pg, "soldado")
        pg.evaluate("""() => { const s = window.__LV.s; s.apuntes = 1; window.__LV.render(); }""")
        ok("Apuntado en el hospital: 1 de 2" in texto(pg), "al soldado le cuentan las veces sobre 2")

        # 4) viuda en la lista: media ración y techo con relación 3
        empezar(pg, "viuda")
        pg.evaluate("""() => { const s = window.__LV.s; s.termo = -2; s.contactos.push({id:'cX', nombre:'Catalina la Rubia', rel:2, lado:'dentro', desde:1}); window.__LV.render(); }""")
        pg.click("[data-act=empezarDia]")
        pg.evaluate("""() => { const s = window.__LV.s; s.hoy.cumplido = true; window.__LV.render(); }""")
        pg.click("[data-act=acabarDia]")
        t = texto(pg)
        ok("Al niño le dan media: la próxima noche que cumplas, otra ración para él" in t, "la noche explica la media ración del niño")
        ok("Necesitas relación 3" in t, "dormir con alguien de tu red pide relación 3")
        pg.screenshot(path=f"{OUT}/v05_noche_lista.png", full_page=True)

        # 5) viuda: última noche sin el niño → «Sobrevives sin tu hijo»
        empezar(pg, "viuda"); ir_al_dia(pg, 10)
        pg.click("[data-act=empezarDia]")
        pg.evaluate("""() => { const s = window.__LV.s; s.nino.perdido = true; s.nino.con = null; s.nino.motivo = 'El cura lo ve y se lo lleva a los niños de la doctrina.'; s.raciones = 2; window.__LV.render(); }""")
        pg.click("[data-act=acabarDia]")
        pg.click("[data-act=noche][data-id=portico]"); pg.click("[data-act=dormir]")
        if pg.locator("[data-act=seguir]").count(): pg.click("[data-act=seguir]")
        t = texto(pg)
        ok("Sobrevives sin tu hijo" in t and "Has salvado a uno de los dos" in t, "final de la viuda sin el niño")
        pg.screenshot(path=f"{OUT}/v05_final_sin_nino.png", full_page=True)

        # 6) viuda: última noche con el niño → «Sobrevives»
        empezar(pg, "viuda"); ir_al_dia(pg, 10)
        pg.click("[data-act=empezarDia]")
        pg.evaluate("""() => { const s = window.__LV.s; s.raciones = 2; window.__LV.render(); }""")
        pg.click("[data-act=acabarDia]")
        pg.click("[data-act=noche][data-id=portico]"); pg.click("[data-act=dormir]")
        if pg.locator("[data-act=seguir]").count(): pg.click("[data-act=seguir]")
        t = texto(pg)
        ok("Sobrevives" in t and "sin tu hijo" not in t and "Tu hijo sigue contigo" in t, "final de la viuda con el niño")
        b.close()
finally:
    srv.terminate()
print("errores:", err or "ninguno")
sys.exit(1 if fallos or err else 0)
