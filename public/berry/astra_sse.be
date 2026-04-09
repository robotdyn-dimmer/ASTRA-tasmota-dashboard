## astra_sse.be — SSE push server for ASTRA dashboard
## Detects relay changes by comparing power state every 100ms in the driver loop.
## This is more reliable than Berry rules which don't fire for HTTP commands.
##
## Endpoint: GET http://<device-ip>:81/astra/sse
## Events:   type=init   (current state on connect)
##           type=power  (relay state changed)
##           type=sensor (tele#sensor)
##           type=state  (tele#state every 5min)

import json
import string

var SSE_PORT = 81
var _srv = nil
var _clients = []   # list of {cnx, buf, ready}
var _started = false
var _last_power = {}   # previous power state for change detection

# ─── Broadcast helpers ────────────────────────────────────────────────────────

def broadcast(s)
  var frame = bytes().fromstring("data: " + s + "\n\n")
  var i = size(_clients) - 1
  while i >= 0
    var c = _clients[i]
    if c['ready'] && c['cnx'].connected()
      c['cnx'].write(frame)
    elif !c['cnx'].connected()
      _clients.remove(i)
    end
    i -= 1
  end
end

def broadcast_raw(s)
  var b = bytes().fromstring(s)
  var i = size(_clients) - 1
  while i >= 0
    var c = _clients[i]
    if c['ready'] && c['cnx'].connected()
      c['cnx'].write(b)
    elif !c['cnx'].connected()
      _clients.remove(i)
    end
    i -= 1
  end
end

# ─── Power state helper ───────────────────────────────────────────────────────

def power_payload(t)
  var payload = {'type': t}
  var powers = tasmota.get_power()
  var i = 0
  while i < size(powers)
    payload['POWER' + str(i + 1)] = powers[i] ? 1 : 0
    i += 1
  end
  return payload
end

# Returns true if power state changed, updates _last_power
def power_changed()
  var powers = tasmota.get_power()
  var changed = false
  var i = 0
  while i < size(powers)
    var key = str(i + 1)
    var cur = powers[i] ? 1 : 0
    if _last_power.find(key) != cur
      _last_power[key] = cur
      changed = true
    end
    i += 1
  end
  return changed
end

# ─── Driver class ─────────────────────────────────────────────────────────────

class AstraSseDriver
  def every_100ms()
    if _srv == nil  return  end

    # Accept new TCP clients
    while _srv.hasclient()
      var cnx = _srv.acceptasync()
      if cnx != nil
        _clients.push({'cnx': cnx, 'buf': '', 'ready': false})
      end
    end

    # Process pending handshakes
    var i = size(_clients) - 1
    while i >= 0
      var c = _clients[i]
      var cnx = c['cnx']

      if !cnx.connected()
        _clients.remove(i)
        i -= 1
        continue
      end

      if !c['ready']
        if cnx.available() > 0
          var data = cnx.read()
          if type(data) == 'bytes'
            c['buf'] += data.tostring()
          else
            c['buf'] += str(data)
          end
        end
        if string.find(c['buf'], "\r\n\r\n") >= 0
          cnx.write(bytes().fromstring(
            "HTTP/1.1 200 OK\r\n" +
            "Content-Type: text/event-stream\r\n" +
            "Cache-Control: no-cache\r\n" +
            "Connection: keep-alive\r\n" +
            "Access-Control-Allow-Origin: *\r\n" +
            "\r\n"
          ))
          cnx.write(bytes().fromstring(
            "data: " + json.dump(power_payload('init')) + "\n\n"
          ))
          c['ready'] = true
          c['buf'] = ''
          tasmota.log("ASTRA SSE: client connected (" + str(size(_clients)) + " active)", 2)
        end
      end

      i -= 1
    end

    # Detect power state changes and push to all clients
    if size(_clients) > 0 && power_changed()
      broadcast(json.dump(power_payload('power')))
    end
  end
end

var _driver = AstraSseDriver()

# ─── Sensor telemetry rules (fires every TelePeriod, typically 5 min) ─────────

tasmota.add_rule("Tele#Sensor", def(val, trig, msg)
  if type(msg) == 'map'
    var payload = {'type': 'sensor'}
    for k: msg.keys()
      payload[k] = msg[k]
    end
    broadcast(json.dump(payload))
  end
end)

tasmota.add_rule("Tele#State", def(val, trig, msg)
  var payload = power_payload('state')
  if type(msg) == 'map' && msg.contains('Heap')
    payload['Heap'] = msg['Heap']
  end
  broadcast(json.dump(payload))
end)

# ─── Heartbeat ────────────────────────────────────────────────────────────────

def sse_heartbeat()
  broadcast_raw(": ok\n\n")
  tasmota.set_timer(25000, sse_heartbeat)
end

# ─── Start after WiFi ─────────────────────────────────────────────────────────

def start_sse()
  if _started  return  end
  _started = true
  try
    _srv = tcpserver(SSE_PORT)
    tasmota.add_driver(_driver)
    tasmota.set_timer(25000, sse_heartbeat)
    # Initialize last power state
    var powers = tasmota.get_power()
    var i = 0
    while i < size(powers)
      _last_power[str(i + 1)] = powers[i] ? 1 : 0
      i += 1
    end
    tasmota.log("ASTRA SSE server started on :" + str(SSE_PORT), 2)
  except .. as e, m
    tasmota.log("ASTRA SSE: start failed - " + str(e) + ": " + str(m), 1)
  end
end

tasmota.add_rule("Wifi#Connected", def(val, trig, msg)
  tasmota.set_timer(500, start_sse)
end)

# Start immediately if WiFi already up (after BrRestart)
var wifi = tasmota.wifi()
if type(wifi) == 'map' && wifi.find('up') == true
  tasmota.set_timer(500, start_sse)
else
  tasmota.log("ASTRA SSE: waiting for WiFi...", 2)
end
