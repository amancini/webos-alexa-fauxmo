# webos-alexa-fauxmo

Control an **LG webOS TV** with **Amazon Alexa** — no PC, no hub, no cloud.

This is a tiny service that runs **on the TV itself** (after rooting) and emulates a
**Philips Hue v1 bridge**. Alexa discovers it natively over your LAN and can then turn
the TV on/off, change the volume, launch apps and switch channels — all by voice.

It's written in plain ES5 JavaScript with **zero dependencies**, so it runs on the
ancient `node v0.12` that ships with webOS 4.x and later.

## What you can say

| Say to Alexa | Effect |
|---|---|
| "Alexa, turn **TV** on / off" | screen on / off (TV stays reachable) |
| "Alexa, set **TV** to 30%" | volume → 30% |
| "Alexa, turn **Netflix** on" | launch Netflix |
| "Alexa, turn **Disney** on" | launch Disney+ |
| "Alexa, turn **Prime Video** on" | launch Prime Video |
| "Alexa, turn **YouTube** on" | launch YouTube |
| "Alexa, set **Channel** to 5%" | go to channel 5 (brightness% = channel number) |

Each function is exposed as a Hue "dimmable light". Set `ROOM` in the config to append a
room name (e.g. `"TV Bedroom"`) so Alexa can tell rooms apart.

## Requirements

- An LG webOS TV **rooted via [webOS Homebrew](https://github.com/webosbrew)** (Homebrew Channel installed).
- Root shell access to the TV (**Telnet or SSH**, enabled in the Homebrew Channel app).
- The TV and your Echo on the **same LAN**.

## Install

On the rooted TV, as root (telnet/ssh):

```sh
curl -fsSL https://raw.githubusercontent.com/amancini/webos-alexa-fauxmo/main/install/install.sh | sh
```

Then say **"Alexa, discover devices"** (or: Alexa app → Devices → ➕ → Light → Philips Hue).
Wait ~45s and the devices appear.

> If your shell can't reach the internet, copy `src/fauxmo.js` to
> `/var/lib/webosbrew/fauxmo/fauxmo.js` and `install/fauxmo.sh` to
> `/var/lib/webosbrew/init.d/fauxmo` (chmod +x), then run the node command from `fauxmo.sh`.

The installer sets up autostart via `/var/lib/webosbrew/init.d/` (run by Homebrew Channel's
`startup.sh` on every boot), so it survives reboots.

## Configure

Edit the CONFIG block at the top of `src/fauxmo.js`:

- `ROOM` — suffix added to every device name (`''` for none).
- `HTTP_PORT` — keep `80`; older Echos only talk to a Hue bridge on port 80.
- `APPS` — webOS application ids. List yours with:
  ```sh
  luna-send -n 1 -w 3000 luna://com.webos.service.applicationmanager/listApps '{}'
  ```

After editing, re-run the installer (or restart node).

## How it works

- **SSDP** (UDP 1900): answers Alexa's `M-SEARCH` as a Hue bridge.
- **HTTP** (TCP 80): serves `/description.xml` and a minimal Hue v1 REST API
  (`/api/<user>/lights`, `PUT .../state`).
- State changes are mapped to **`luna-send`** calls:
  - power on → `com.webos.service.tvpower/power/turnOnScreen`
  - power off → screen off (`turnOffScreen`) **or** real standby
    (`power/powerOff {"reason":"remoteKey"}`), per the `POWER_OFF` config
  - volume → `com.webos.service.audio/media/setVolume`
  - apps → `com.webos.service.applicationmanager/launch`
  - channel → `com.webos.service.apiadapter/tv/openChannel`

### Power-off mode (`POWER_OFF`)

- `'screen'` (default): **screen off** only — audio muted, TV stays on the network,
  so Alexa can turn it back **on**. ~10–15 W idle.
- `'standby'`: **real power off** — ~0.5 W, but the service dies with the TV, so Alexa
  can **no longer** turn it on. You wake it with the remote, or with **Wake-on-LAN**
  (verified working on webOS 4.x when *Mobile TV On* is enabled: a magic packet to the
  TV's MAC wakes it in seconds, after which this service autostarts). WoL must come from
  another always-on device on the LAN — the TV can't wake itself.

## Limitations

- **Channel** is set as a percentage (5% = channel 5): Hue only understands on/off + brightness.
- Some newer Echo models restrict emulated-Hue discovery; if discovery fails, retry, or
  try adding via the Alexa app under Philips Hue.
- With `POWER_OFF='standby'`, power **on from full standby** needs Wake-on-LAN sent by
  another always-on device; this service can't do it while the TV is off. The default
  screen-off mode avoids the problem.

## Disclaimer

Uses unofficial root access and undocumented `luna` APIs. Use at your own risk. Not
affiliated with LG, Amazon or Signify/Philips Hue.

## License

MIT — see [LICENSE](LICENSE).
