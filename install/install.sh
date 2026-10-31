#!/bin/sh
# webos-alexa-fauxmo one-line installer.
# Run ON the rooted TV (telnet/ssh as root):
#   curl -fsSL https://raw.githubusercontent.com/amancini/webos-alexa-fauxmo/main/install/install.sh | sh
set -e
REPO="https://raw.githubusercontent.com/amancini/webos-alexa-fauxmo/main"

echo "[*] webos-alexa-fauxmo installer"
mkdir -p /var/lib/webosbrew/fauxmo /var/lib/webosbrew/init.d

echo "[*] downloading service..."
curl -fsSL -o /var/lib/webosbrew/fauxmo/fauxmo.js "$REPO/src/fauxmo.js"
curl -fsSL -o /var/lib/webosbrew/init.d/fauxmo    "$REPO/install/fauxmo.sh"
chmod +x /var/lib/webosbrew/init.d/fauxmo

echo "[*] (re)starting service..."
pkill -f fauxmo.js 2>/dev/null || true
sleep 1
/usr/bin/node /var/lib/webosbrew/fauxmo/fauxmo.js >/tmp/fauxmo.log 2>&1 &
sleep 2

echo "[*] log:"
cat /tmp/fauxmo.log
echo
echo "[*] done. Now say: \"Alexa, discover devices\""
echo "    To set a room name, edit ROOM in /var/lib/webosbrew/fauxmo/fauxmo.js and re-run."
