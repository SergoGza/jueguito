#!/usr/bin/env python3
"""Junta los diarios de una tanda de agentes y escribe RESUMEN.md en la carpeta de la versión.

Uso (desde la raíz del repositorio): python3 herramientas/agentes/resumen.py v0.4
"""
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

BASE = Path(__file__).resolve().parent / "partidas"
ETIQUETAS = ["DECIDO", "OBVIO", "NADA", "NO ENTIENDO"]


def leer(carpeta):
    nombre = carpeta.name.split("-")
    pj, estilo, semilla = (nombre + ["?", "?", "?"])[:3]
    diario = (carpeta / "diario.md").read_text(encoding="utf-8").splitlines() if (carpeta / "diario.md").exists() else []
    cuenta = Counter()
    noentiendo = []
    for l in diario:
        m = re.search(r"\[(DECIDO|OBVIO|NADA|NO ENTIENDO)\]", l)
        if m:
            cuenta[m.group(1)] += 1
            if m.group(1) == "NO ENTIENDO":
                noentiendo.append(l.lstrip("- ").strip())
    res = json.loads((carpeta / "resultado.json").read_text(encoding="utf-8")) if (carpeta / "resultado.json").exists() else None
    return {"pj": pj, "estilo": estilo, "semilla": semilla, "cuenta": cuenta, "noentiendo": noentiendo, "res": res, "lineas": len(diario)}


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    dir_v = BASE / sys.argv[1]
    partidas = [leer(c) for c in sorted(dir_v.iterdir()) if c.is_dir()] if dir_v.exists() else []
    if not partidas:
        raise SystemExit(f"No hay partidas en {dir_v}")
    L = [f"# Agentes · {sys.argv[1]}", "", f"{len(partidas)} partidas. Los agentes son el mismo modelo: sirven para encontrar huecos, no como votos ni para porcentajes.", ""]
    L += ["## Partidas", "", "| Personaje | Estilo | Semilla | Final | DECIDO | OBVIO | NADA | NO ENTIENDO |", "|---|---|---|---|---|---|---|---|"]
    total = Counter()
    for p in partidas:
        f = p["res"]["final"] if p["res"] else None
        fin = f"{f['tipo']}, día {f['dia']}" if f else "sin terminar"
        L.append(f"| {p['pj']} | {p['estilo']} | {p['semilla']} | {fin} | " + " | ".join(str(p["cuenta"][e]) for e in ETIQUETAS) + " |")
        total.update(p["cuenta"])
    n = sum(total.values()) or 1
    L += ["", "**Reparto de las decisiones:** " + " · ".join(f"{e} {round(100 * total[e] / n)} %" for e in ETIQUETAS), ""]
    porpj = defaultdict(Counter)
    for p in partidas:
        porpj[p["pj"]].update(p["cuenta"])
    L += ["| Personaje | " + " | ".join(ETIQUETAS) + " |", "|---|" + "---|" * len(ETIQUETAS)]
    for pj, c in porpj.items():
        m = sum(c.values()) or 1
        L.append(f"| {pj} | " + " | ".join(f"{round(100 * c[e] / m)} %" for e in ETIQUETAS) + " |")
    L += ["", "## Lo que no entendieron", ""]
    ne = [(p, l) for p in partidas for l in p["noentiendo"]]
    L += [f"- ({p['pj']}, {p['estilo']}) {l}" for p, l in ne] or ["Nada."]
    L += ["", "## Encuesta", ""]
    for p in partidas:
        if not p["res"]:
            continue
        e = p["res"].get("encuesta", {})
        L += [f"**{p['pj']}, {p['estilo']} ({p['semilla']})**", f"- Le dolió: {e.get('dolio', '')}", f"- Sobraba: {e.get('sobro', '')}", f"- No entendió o echó de menos: {e.get('falto', '')}"]
        if e.get("otros"):
            L.append(f"- Otros: {e['otros']}")
        L.append("")
    texto = "\n".join(L)
    (dir_v / "RESUMEN.md").write_text(texto, encoding="utf-8")
    print(texto)


if __name__ == "__main__":
    main()
