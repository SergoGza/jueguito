#!/usr/bin/env bash
# Deja lista la mesa de los agentes: Playwright y un Chromium que abra la app. Se puede repetir sin miedo.
# Uso (desde la raíz del repositorio): bash herramientas/agentes/preparar.sh
#
# En una sesión en la nube de Claude Code (claude.ai/code, o la pestaña Code de la app del móvil), con la red por
# defecto, PyPI y npm están permitidos pero el servidor de donde Playwright baja su Chromium no. Por eso, si el
# Chromium de Playwright no se puede bajar, se usa el del paquete npm @sparticuz/chromium y se apunta su ruta en
# herramientas/agentes/.chromium, que mesa.py lee.
set -u
cd "$(dirname "$0")/../.."
MESA=herramientas/agentes/mesa.py
listo() { python3 "$MESA" comprobar; }

echo "== 1. Playwright para Python"
if ! python3 -c "import playwright" 2>/dev/null; then
  pip install --quiet playwright 2>/dev/null || pip install --quiet --break-system-packages playwright || { echo "No se pudo instalar Playwright con pip."; exit 1; }
fi
listo && exit 0

echo "== 2. El Chromium de Playwright"
timeout 300 python3 -m playwright install chromium >/dev/null 2>&1 && listo && exit 0

echo "== 3. Las librerías del sistema que necesita Chromium"
timeout 300 python3 -m playwright install-deps chromium >/dev/null 2>&1 || true
listo && exit 0

echo "== 4. Chromium desde npm (@sparticuz/chromium)"
DIR="${HOME:-/root}/.cache/liber-chromium"
mkdir -p "$DIR"
( cd "$DIR" && { [ -f package.json ] || npm init -y >/dev/null; } && timeout 300 npm install --silent @sparticuz/chromium >/dev/null 2>&1 ) || { echo "No se pudo instalar @sparticuz/chromium con npm."; exit 1; }
RUTA=$(cd "$DIR" && node -e "const c=require('@sparticuz/chromium'); (c.default||c).executablePath().then((p)=>console.log(p))")
[ -n "$RUTA" ] && [ -f "$RUTA" ] || { echo "@sparticuz/chromium no ha dejado ningún Chromium."; exit 1; }
echo "$RUTA" > herramientas/agentes/.chromium
listo && exit 0

echo "La mesa sigue sin arrancar. Pásale este mensaje a Sergio."
exit 1
