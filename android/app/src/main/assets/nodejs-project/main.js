'use strict';

/**
 * Android entry point for LAN File Server.
 *
 * This file is the Node.js process entry point when running inside the
 * nodejs-mobile-android embedded runtime.
 *
 * Communication with the Android UI is via rn-bridge:
 *   Android → Node.js : rn_bridge.channel.on('message', cb)
 *   Node.js → Android : rn_bridge.channel.send(jsonString)
 *
 * Message protocol:
 *   Android sends: {"type":"start","rootPath":"...","port":8080}
 *   Android sends: {"type":"stop"}
 *   Node.js sends: {"type":"ready"}
 *   Node.js sends: {"type":"started","url":"http://192.168.x.x:8080","ip":"...","port":8080}
 *   Node.js sends: {"type":"error","message":"..."}
 */

const rn_bridge = require('rn-bridge');
const os = require('os');

let serverStarted = false;

// ── Bridge: receive messages from Android UI ─────────────────────────────────

rn_bridge.channel.on('message', function (msg) {
  try {
    const data = JSON.parse(msg);
    if (data.type === 'start' && !serverStarted) {
      startServer(data.rootPath, parseInt(data.port, 10) || 8080);
    } else if (data.type === 'stop') {
      process.emit('SIGTERM');
    }
  } catch (e) {
    rn_bridge.channel.send(JSON.stringify({ type: 'error', message: String(e) }));
  }
});

// ── Start server with Android-specific config ────────────────────────────────

function startServer(rootPath, port) {
  serverStarted = true;

  // Pass config to loadConfig() via environment variables
  process.env.SHARE_ROOTS  = rootPath;
  process.env.PORT         = String(port);
  process.env.HOST         = '0.0.0.0';
  process.env.MDNS_ENABLED = 'false'; // mDNS/Bonjour not reliable on Android

  // Intercept console.log to detect successful server startup
  const origLog = console.log;
  let startReported = false;

  console.log = function () {
    origLog.apply(console, arguments);

    if (startReported) return;
    const line = Array.prototype.join.call(arguments, ' ');

    if (line.includes('LAN File Host started')) {
      startReported = true;
      // Short delay to let the listen callback fully complete
      setTimeout(function () {
        const ip = getWifiIp();
        const url = ip
          ? 'http://' + ip + ':' + port
          : 'http://127.0.0.1:' + port;

        rn_bridge.channel.send(JSON.stringify({
          type: 'started',
          url:  url,
          ip:   ip,
          port: port,
        }));
      }, 200);
    }
  };

  try {
    // Load the compiled TypeScript server.
    // dist/ and node_modules/ are copied alongside this file by sync-android.sh.
    require('./dist/server.js');
  } catch (e) {
    rn_bridge.channel.send(JSON.stringify({ type: 'error', message: String(e) }));
  }
}

// ── Utility: pick the best LAN IP ────────────────────────────────────────────

function getWifiIp() {
  const interfaces = os.networkInterfaces();

  // Prefer wlan0 (Android WiFi interface name)
  var preferred = ['wlan0', 'wlan1', 'eth0', 'en0', 'en1'];
  for (var i = 0; i < preferred.length; i++) {
    var ifaces = interfaces[preferred[i]];
    if (ifaces) {
      for (var j = 0; j < ifaces.length; j++) {
        if (ifaces[j].family === 'IPv4' && !ifaces[j].internal) {
          return ifaces[j].address;
        }
      }
    }
  }

  // Fall back to any non-loopback IPv4
  var names = Object.keys(interfaces);
  for (var n = 0; n < names.length; n++) {
    var list = interfaces[names[n]];
    for (var k = 0; k < list.length; k++) {
      if (list[k].family === 'IPv4' && !list[k].internal) {
        return list[k].address;
      }
    }
  }
  return null;
}

// ── Signal readiness so Android sends the config ─────────────────────────────

rn_bridge.channel.send(JSON.stringify({ type: 'ready' }));
