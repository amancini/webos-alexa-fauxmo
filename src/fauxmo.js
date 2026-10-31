/*
 * webos-alexa-fauxmo
 * Emulates a Philips Hue v1 bridge on a rooted LG webOS TV so Amazon Alexa can
 * discover and control it: power (screen on/off), volume, launch apps and channels.
 *
 * Written in ES5 to run on the ancient node (v0.12) shipped with webOS 4.x.
 * No external dependencies - only node core modules.
 *
 * Config: edit ROOM, HTTP_PORT and the `devices` map below.
 */
var http = require('http');
var dgram = require('dgram');
var os = require('os');
var exec = require('child_process').exec;

/* =========================== CONFIG =========================== */
// Room/suffix appended to every device name, e.g. ROOM='Bedroom' -> "TV Bedroom".
// Leave '' for plain names ("TV", "Netflix", ...). Helps Alexa disambiguate rooms.
var ROOM = '';
var HTTP_PORT = 80;            // Alexa (older Echos) expect the Hue bridge on port 80
var MAC = '00:17:88:12:ab:cd'; // fake bridge MAC; change if you run more than one bridge
/* App ids below are the webOS application ids. Find yours with:
 *   luna-send -n 1 -w 3000 luna://com.webos.service.applicationmanager/listApps '{}'
 */
var APPS = {
  netflix: 'netflix',
  disney:  'com.disney.disneyplus-prod',
  prime:   'amazon',
  youtube: 'youtube.leanback.v4'
};
/* ============================================================= */

function lanIp() {
  var ifs = os.networkInterfaces();
  for (var name in ifs) {
    var arr = ifs[name];
    for (var i = 0; i < arr.length; i++) {
      var a = arr[i];
      if (a.family === 'IPv4' && !a.internal && a.address.indexOf('127.') !== 0) return a.address;
    }
  }
  return '127.0.0.1';
}
var IP = lanIp();
var MACPLAIN = MAC.replace(/:/g, '');
var BRIDGEID = (MACPLAIN.substring(0, 6) + 'FFFE' + MACPLAIN.substring(6)).toUpperCase();
var UUID = '2f402f80-da50-11e1-9b23-' + MACPLAIN;

function nm(base) { return ROOM ? (base + ' ' + ROOM) : base; }

/* ---- TV control via luna-send ---- */
function luna(uri, payload) {
  var cmd = "luna-send -n 1 -w 1500 luna://" + uri + " '" + JSON.stringify(payload || {}) + "'";
  exec(cmd, function (e) { if (e) console.log('luna ERR', uri, e.message); });
}
function launchApp(id) { luna('com.webos.service.applicationmanager/launch', { id: id }); }
function screenOn()    { luna('com.webos.service.tvpower/power/turnOnScreen', {}); }
function screenOff()   { luna('com.webos.service.tvpower/power/turnOffScreen', {}); }
function setVolume(v)  { luna('com.webos.service.audio/media/setVolume', { volume: v }); }
function openChannel(n){ luna('com.webos.service.apiadapter/tv/openChannel', { channelNumber: String(n) }); }
function briToPct(bri) { return Math.max(0, Math.min(100, Math.round(bri / 254 * 100))); }

/* ---- devices (Hue "lights") ---- */
var devices = {
  '1': { name: nm('TV'), bri: 254, on: false,
    onSet:  function (v) { this.on = v; if (v) screenOn(); else screenOff(); },
    briSet: function (b) { this.bri = b; this.on = true; setVolume(briToPct(b)); } },
  '2': { name: nm('Netflix'), bri: 254, on: false,
    onSet:  function (v) { this.on = v; if (v) launchApp(APPS.netflix); },
    briSet: function (b) { this.bri = b; launchApp(APPS.netflix); } },
  '3': { name: nm('Disney'), bri: 254, on: false,
    onSet:  function (v) { this.on = v; if (v) launchApp(APPS.disney); },
    briSet: function (b) { this.bri = b; launchApp(APPS.disney); } },
  '4': { name: nm('Prime Video'), bri: 254, on: false,
    onSet:  function (v) { this.on = v; if (v) launchApp(APPS.prime); },
    briSet: function (b) { this.bri = b; launchApp(APPS.prime); } },
  '5': { name: nm('YouTube'), bri: 254, on: false,
    onSet:  function (v) { this.on = v; if (v) launchApp(APPS.youtube); },
    briSet: function (b) { this.bri = b; launchApp(APPS.youtube); } },
  '6': { name: nm('Channel'), bri: 254, on: false,
    onSet:  function (v) { this.on = v; },
    briSet: function (b) { this.bri = b; this.on = true; openChannel(briToPct(b)); } }
};

function lightObj(id) {
  var d = devices[id];
  return {
    state: { on: d.on, bri: d.bri, alert: 'none', reachable: true },
    type: 'Dimmable light', name: d.name, modelid: 'LWB007', manufacturername: 'Philips',
    uniqueid: '00:17:88:5e:d3:' + (id.length < 2 ? '0' + id : id) + ':00:01-0b',
    swversion: '66012040'
  };
}
function allLights() { var o = {}; for (var id in devices) o[id] = lightObj(id); return o; }

function descriptionXml() {
  return '<?xml version="1.0" encoding="UTF-8" ?>\n' +
    '<root xmlns="urn:schemas-upnp-org:device-1-0">\n' +
    '<specVersion><major>1</major><minor>0</minor></specVersion>\n' +
    '<URLBase>http://' + IP + ':' + HTTP_PORT + '/</URLBase>\n<device>\n' +
    '<deviceType>urn:schemas-upnp-org:device:Basic:1</deviceType>\n' +
    '<friendlyName>Philips hue (' + IP + ')</friendlyName>\n' +
    '<manufacturer>Royal Philips Electronics</manufacturer>\n' +
    '<manufacturerURL>http://www.philips.com</manufacturerURL>\n' +
    '<modelDescription>Philips hue Personal Wireless Lighting</modelDescription>\n' +
    '<modelName>Philips hue bridge 2012</modelName>\n' +
    '<modelNumber>929000226503</modelNumber>\n' +
    '<modelURL>http://www.meethue.com</modelURL>\n' +
    '<serialNumber>' + MACPLAIN + '</serialNumber>\n' +
    '<UDN>uuid:' + UUID + '</UDN>\n<presentationURL>index.html</presentationURL>\n' +
    '</device>\n</root>\n';
}

function send(res, code, body, ctype) {
  res.writeHead(code, { 'Content-Type': ctype || 'application/json' });
  res.end(body);
}
var server = http.createServer(function (req, res) {
  var body = '';
  req.on('data', function (c) { body += c; });
  req.on('end', function () {
    var url = req.url.split('?')[0];
    if (url === '/description.xml') return send(res, 200, descriptionXml(), 'text/xml');
    if (req.method === 'POST' && (url === '/api' || url === '/api/'))
      return send(res, 200, JSON.stringify([{ success: { username: 'webosfauxmouser' } }]));
    var p = url.split('/').filter(function (x) { return x.length; });
    if (p[0] === 'api') {
      if (req.method === 'GET' && p.length === 2)
        return send(res, 200, JSON.stringify({
          lights: allLights(), groups: {}, schedules: {}, scenes: {}, rules: {}, sensors: {},
          config: { name: 'webOS Hue', mac: MAC, bridgeid: BRIDGEID, modelid: 'BSB001',
            swversion: '01041302', apiversion: '1.17.0', ipaddress: IP,
            whitelist: { webosfauxmouser: { name: 'webos' } } } }));
      if (req.method === 'GET' && p.length === 3 && p[2] === 'lights')
        return send(res, 200, JSON.stringify(allLights()));
      if (req.method === 'GET' && p.length === 4 && p[2] === 'lights') {
        if (devices[p[3]]) return send(res, 200, JSON.stringify(lightObj(p[3])));
        return send(res, 404, '[]');
      }
      if (req.method === 'PUT' && p.length === 5 && p[2] === 'lights' && p[4] === 'state') {
        var d = devices[p[3]];
        if (!d) return send(res, 404, '[]');
        var cmd = {}; try { cmd = JSON.parse(body || '{}'); } catch (e) { cmd = {}; }
        var resp = [];
        if (typeof cmd.bri !== 'undefined') { d.briSet(cmd.bri);
          var r1 = { success: {} }; r1.success['/lights/' + p[3] + '/state/bri'] = cmd.bri; resp.push(r1); }
        if (typeof cmd.on !== 'undefined') { d.onSet(cmd.on);
          var r2 = { success: {} }; r2.success['/lights/' + p[3] + '/state/on'] = cmd.on; resp.push(r2); }
        return send(res, 200, JSON.stringify(resp));
      }
      return send(res, 200, JSON.stringify({ lights: allLights() }));
    }
    send(res, 200, 'webos-alexa-fauxmo', 'text/plain');
  });
});
server.on('error', function (e) { console.log('HTTP error', e.message); });
server.listen(HTTP_PORT, '0.0.0.0', function () { console.log('HTTP on', IP + ':' + HTTP_PORT); });

/* ---- SSDP discovery responder ---- */
function ssdpResponse(st) {
  return 'HTTP/1.1 200 OK\r\nHOST: 239.255.255.250:1900\r\nEXT:\r\n' +
    'CACHE-CONTROL: max-age=100\r\nLOCATION: http://' + IP + ':' + HTTP_PORT + '/description.xml\r\n' +
    'SERVER: FreeRTOS/7.4.2, UPnP/1.0, IpBridge/1.17.0\r\nhue-bridgeid: ' + BRIDGEID + '\r\n' +
    'ST: ' + st + '\r\nUSN: uuid:' + UUID + '::' + st + '\r\n\r\n';
}
var STS = ['upnp:rootdevice', 'urn:schemas-upnp-org:device:basic:1', 'uuid:' + UUID];
var sock = dgram.createSocket({ type: 'udp4', reuseAddr: true });
sock.on('error', function (e) { console.log('SSDP error', e.message); });
sock.on('message', function (msg, rinfo) {
  var s = msg.toString();
  if (s.indexOf('M-SEARCH') === 0 && s.toLowerCase().indexOf('ssdp:discover') !== -1) {
    for (var i = 0; i < STS.length; i++) (function (st) {
      var buf = new Buffer(ssdpResponse(st));
      sock.send(buf, 0, buf.length, rinfo.port, rinfo.address);
    })(STS[i]);
  }
});
sock.bind(1900, function () {
  try { sock.addMembership('239.255.255.250'); } catch (e) { console.log('addMembership', e.message); }
  console.log('SSDP listening, bridgeid', BRIDGEID);
});
console.log('webos-alexa-fauxmo started. IP=' + IP + ' room="' + ROOM + '"');
