#!/usr/bin/env python3
"""Junta los diarios de una tanda de agentes y escribe RESUMEN.md en la carpeta de la versión.

Uso (desde la raíz del repositorio): python3 herramientas/agentes/resumen.py vj0.1
"""
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

BASE = Path(__file__).resolve().parent / "partidas"
ETIQUETAS = ["DECIDO", "OBVIO", "NADA", "NO ENTIENDO"]
PREGUNTAS = [("dolio", "Le dolió"), ("ir", "Cómo decidía adónde ir"), ("sorpresa", "Sorpresa con la ronda"),
             ("sobro", "Sobraba o no entendió"), ("otros", "Otros")]


def leer(carpeta):
    nombre = carpeta.name.split("-")
    prueba, estilo, semilla = (nombre + ["?", "?", "?"])[:3]
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
    return {"prueba": prueba, "estilo": estilo, "semilla": semilla, "cuenta": cuenta, "noentiendo": noentiendo, "res": res}


def metricas(p):
    r = p["res"] or {}
    T = r.get("resumen") or {}
    dias = len(r.get("porDia") or []) or 1
    ratos = sum(T.get(k, 0) for k in ("mover", "pedir", "trabajar", "esperar", "perdido")) or 1
    mov = T.get("pasos", 0) if p["prueba"] == "A" else T.get("cruces", 0)
    return {
        "mover": f"{round(100 * T.get('mover', 0) / ratos)} %",
        "esperar": f"{round(100 * (T.get('esperar', 0) + T.get('perdido', 0)) / ratos)} %",
        "mov_dia": f"{mov / dias:.1f}",
        "encuentros": T.get("encuentros", 0),
        "det": r.get("detenciones", 0),
    }


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    dir_v = BASE / sys.argv[1]
    partidas = [leer(c) for c in sorted(dir_v.iterdir()) if c.is_dir()] if dir_v.exists() else []
    if not partidas:
        raise SystemExit(f"No hay partidas en {dir_v}")
    L = [f"# Agentes · {sys.argv[1]}", "", f"{len(partidas)} partidas. Los agentes son el mismo modelo: sirven para encontrar huecos, no como votos ni para porcentajes.", ""]
    L += ["## Partidas", "", "| Prueba | Estilo | Semilla | Final | Moverse | Esperar | Pasos o cruces por día | Llegó donde la ronda | Detenciones | DECIDO | OBVIO | NADA | NO ENTIENDO |",
          "|---|---|---|---|---|---|---|---|---|---|---|---|---|"]
    total = Counter()
    for p in partidas:
        f = p["res"]["final"] if p["res"] else None
        fin = f"{f['tipo']}, día {f['dia']}" if f else "sin terminar"
        m = metricas(p) if p["res"] else {"mover": "", "esperar": "", "mov_dia": "", "encuentros": "", "det": ""}
        L.append(f"| {p['prueba']} | {p['estilo']} | {p['semilla']} | {fin} | {m['mover']} | {m['esperar']} | {m['mov_dia']} | {m['encuentros']} | {m['det']} | "
                 + " | ".join(str(p["cuenta"][e]) for e in ETIQUETAS) + " |")
        total.update(p["cuenta"])
    n = sum(total.values()) or 1
    L += ["", "**Reparto de las decisiones:** " + " · ".join(f"{e} {round(100 * total[e] / n)} %" for e in ETIQUETAS), ""]
    porpr = defaultdict(Counter)
    for p in partidas:
        porpr[p["prueba"]].update(p["cuenta"])
    L += ["| Prueba | " + " | ".join(ETIQUETAS) + " |", "|---|" + "---|" * len(ETIQUETAS)]
    for pr, c in sorted(porpr.items()):
        m = sum(c.values()) or 1
        L.append(f"| {pr} | " + " | ".join(f"{round(100 * c[e] / m)} %" for e in ETIQUETAS) + " |")
    L += ["", "## Lo que no entendieron", ""]
    ne = [(p, l) for p in partidas for l in p["noentiendo"]]
    L += [f"- ({p['prueba']}, {p['estilo']}) {l}" for p, l in ne] or ["Nada."]
    L += ["", "## Encuesta", ""]
    for p in partidas:
        if not p["res"]:
            continue
        e = p["res"].get("encuesta", {})
        L.append(f"**{p['prueba']}, {p['estilo']} ({p['semilla']})**")
        L += [f"- {titulo}: {e.get(clave, '')}" for clave, titulo in PREGUNTAS if e.get(clave)]
        L.append("")
    texto = "\n".join(L)
    (dir_v / "RESUMEN.md").write_text(texto, encoding="utf-8")
    print(texto)


if __name__ == "__main__":
    main()
