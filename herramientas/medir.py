#!/usr/bin/env python3
"""La medida de la diversión (claude/diagnostico-diversion.md, 23-nov): cuántas cosas distintas hace el que conoce las
reglas y cuánto se repite. Juega el oficio de aplicado.js (OFICIO=1, sin tabla de valor), una partida por semilla, lee
su crónica y cuenta.

Uso (desde la raíz del repositorio):
  python3 herramientas/medir.py                          400 veranos de 1545, las reglas de ahora
  python3 herramientas/medir.py -n 300 sin: tretas:TRETAS=todas voto:TRETAS=voto
                                                         varias variantes, cada una «nombre:VAR=valor,VAR=valor»
  python3 herramientas/medir.py -n 300 cadena:CADENA=1,HURTO=apuro
                                                         la cadena (1545-1557) con los tuyos y hurtando en apuros
Las mismas semillas (1…n) para todas las variantes. Las variables pasan tal cual a aplicado.js (TRETAS, HURTO, CADENA,
LLAGA, TUYOS, PAL…).

Lo que cuenta, por día jugado:
  - acciones (andar, pedir, pedir con una treta, esperar, hurtar, trabajo, comprar, acabar) y verbos distintos usados;
  - cuántas veces pide y dónde: pares (franja, sitio) ya usados antes en la partida;
  - los días que empiezan con los mismos tres pasos que un día anterior (la ruta aprendida);
  - las noches: ración entera, y cómo amanece (cuerpo 5 o más; 2 o menos), y dónde duerme;
  - el día desde el que ya no le falta (desde ese día cena entera todas las noches libres): «se resuelve el día…».
"""
import argparse, collections, os, re, statistics as st, subprocess, sys
from concurrent.futures import ThreadPoolExecutor

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LINEA = re.compile(r"^(Prima|Tercia|Sexta|Nona|Vísperas|Completas) (\d)/6 · (.*)$")
NOCHE = re.compile(r"Noche \(([^)]*)\): come (\d), cuerpo (\d) → (\d)")


def juega(sem, env):
    e = dict(os.environ, SEMILLA=str(sem), CRONICA="1", OFICIO="1", SIN_TABLA="1")
    e.update(env)
    r = subprocess.run(["node", os.path.join(RAIZ, "herramientas", "aplicado.js"), "1"], env=e, capture_output=True, text=True)
    if r.returncode:
        sys.exit(f"falló la semilla {sem}: {r.stderr[-500:]}")
    return r.stdout


def lee(texto):
    """La crónica de una partida, día a día."""
    dias, cur = [], None
    for raw in texto.splitlines():
        if raw.startswith("-- "):
            cur = {"acts": [], "pide": [], "ruta": [], "noche": None}
            dias.append(cur)
            continue
        if cur is None:
            continue
        m = LINEA.match(raw)
        if m:
            fr, _, txt = m.groups()
            if " → " in txt and not txt.startswith("Llega"):
                cur["acts"].append("andar"); cur["ruta"].append(txt.split(" → ")[1])
            elif txt.startswith("Pide en "):
                cur["acts"].append("pedir"); cur["pide"].append((fr, txt[8:].split(" (")[0]))
            elif txt.startswith("Pide con "):
                treta, lugar = re.match(r"Pide con (.*) en (.*?) \(", txt).groups()
                cur["acts"].append("treta"); cur["pide"].append((fr, lugar)); cur.setdefault("tretas", []).append(treta)
            elif txt.startswith("Empieza a pedir"):
                cur["acts"].append("pedir")
            elif txt.startswith("Espera"):
                cur["acts"].append("esperar")
            elif txt.startswith("Hurta"):
                cur["acts"].append("hurtar")
            elif txt.startswith("Le cogen") or txt.startswith("No le cogen"):
                cur["acts"].append("trabajo")
            elif txt.startswith("Compra") or txt.startswith("Vende") or txt.startswith("Se quita"):
                cur["acts"].append("comprar" if not txt.startswith("Se quita") else "quitarse")
            continue
        if raw.startswith("noche · Da el día por acabado"):
            cur["acts"].append("acabar")
        elif raw.startswith("noche · Aprende"):
            cur["acts"].append("aprender")
        mn = NOCHE.search(raw)
        if mn:
            cur["noche"] = (mn.group(1).split(",")[0], int(mn.group(2)), int(mn.group(3)), int(mn.group(4)))
    return [d for d in dias if d["acts"] or d["noche"]]


def informe(nombre, juegos):
    dias = [d for g in juegos for d in g]
    n = len(dias)
    c = collections.Counter(a for d in dias for a in d["acts"])
    tot = sum(c.values())
    print(f"\n== {nombre}: {len(juegos)} partidas, {n} días")
    print(f"acciones por día: {tot / n:.1f} · verbos distintos por partida: {st.mean(len({a for d in g for a in d['acts']}) for g in juegos):.1f}")
    print("  " + " · ".join(f"{k} {v / n:.2f}/día ({100 * v / tot:.0f} %)" for k, v in c.most_common()))
    pide = [len(d["pide"]) for d in dias]
    print(f"pide (con o sin treta) {st.mean(pide):.2f} veces al día")
    rep_ruta = tot_ruta = rep_pide = tot_pide = 0
    lugares, resuelto = [], []
    for g in juegos:
        vr, vp, ls = set(), set(), set()
        for d in g:
            if len(d["ruta"]) >= 3:
                k = tuple(d["ruta"][:3]); tot_ruta += 1; rep_ruta += k in vr; vr.add(k)
            for p in d["pide"]:
                tot_pide += 1; rep_pide += p in vp; vp.add(p); ls.add(p[1])
        if ls:
            lugares.append(len(ls))
        # se resuelve: el primer día desde el que todas las noches libres cena entera
        libres = [(i + 1, d["noche"]) for i, d in enumerate(g) if d["noche"] and d["noche"][0] != "cárcel"]
        dia = None
        for i in range(len(libres)):
            if all(x[1][1] == 2 for x in libres[i:]):
                dia = libres[i][0]; break
        resuelto.append(dia if dia is not None else 11)
    print(f"días que empiezan con los mismos tres pasos que un día anterior: {100 * rep_ruta / max(tot_ruta, 1):.0f} %")
    print(f"peticiones en un par (franja, sitio) ya usado antes en la partida: {100 * rep_pide / max(tot_pide, 1):.0f} % · sitios distintos donde pide: {st.mean(lugares) if lugares else 0:.1f} de 9")
    noches = [d["noche"] for d in dias if d["noche"] and d["noche"][0] != "cárcel"]
    if noches:
        print(f"noches: ración entera {100 * sum(x[1] == 2 for x in noches) / len(noches):.0f} % · amanece con 5 o más {100 * sum(x[3] >= 5 for x in noches) / len(noches):.0f} % · con 2 o menos {100 * sum(x[3] <= 2 for x in noches) / len(noches):.0f} %")
        print("dónde duerme: " + " · ".join(f"{k} {100 * v / len(noches):.0f} %" for k, v in collections.Counter(x[0] for x in noches).most_common()))
    r = collections.Counter(resuelto)
    print(f"se resuelve (desde ese día cena entera todas las noches): mediana día {st.median(resuelto):.0f} · " + " · ".join(f"día {k if k <= 10 else 'nunca'} {100 * v / len(resuelto):.0f} %" for k, v in sorted(r.items())))
    tr = collections.Counter(t for d in dias for t in d.get("tretas", []))
    if tr:
        print("tretas usadas por partida: " + " · ".join(f"{k} {v / len(juegos):.1f}" for k, v in tr.most_common()))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("-n", type=int, default=400, help="partidas por variante (semillas 1…n)")
    ap.add_argument("-p", type=int, default=os.cpu_count() or 2, help="procesos a la vez")
    ap.add_argument("variantes", nargs="*", default=["reglas de ahora:"], help="nombre:VAR=valor,VAR=valor")
    a = ap.parse_args()
    for v in a.variantes:
        nombre, _, resto = v.partition(":")
        env = dict(x.split("=", 1) for x in resto.split(",") if x)
        with ThreadPoolExecutor(a.p) as ex:
            juegos = [lee(t) for t in ex.map(lambda s: juega(s, env), range(1, a.n + 1))]
        informe(f"{nombre} ({', '.join(f'{k}={w}' for k, w in env.items()) or 'sin variables'})", juegos)


if __name__ == "__main__":
    main()
