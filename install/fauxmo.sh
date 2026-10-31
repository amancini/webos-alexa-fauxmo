#!/bin/sh
# webos-alexa-fauxmo autostart hook.
# Place in /var/lib/webosbrew/init.d/ ; HBChannel runs it at boot (run-parts).
mkdir -p /var/lib/webosbrew/fauxmo
if pgrep -f fauxmo.js >/dev/null 2>&1; then
  exit 0
fi
/usr/bin/node /var/lib/webosbrew/fauxmo/fauxmo.js >/tmp/fauxmo.log 2>&1 &
exit 0
