## astra_config.be — ALL ASTRA HTTP endpoints (combined)
##
## Berry webserver.on() replaces all prior handlers, so we must
## register everything in a single script with a single prefix.
##
## GET/POST /astra_cfg        → per-device config (relay labels, notes)
## GET/POST /astra_app        → full app config (devices, dashboards, settings)
## GET/POST /astra_dash       → dashboard subset
##
## Storage files:
##   /astra_config.json  — per-device config
##   /astra_app.json     — app config

import webserver
import json

var CFG_FILE = '/astra_config.json'
var APP_FILE = '/astra_app.json'
var _registered = false

# ─── File I/O ────────────────────────────────────────────────────────────────

def read_json(path)
  try
    var f = open(path, 'r')
    var s = f.read()
    f.close()
    if size(s) > 2  return s  end
  except .. end
  return nil
end

def write_json(path, s)
  try
    var f = open(path, 'w')
    f.write(s)
    f.close()
    return true
  except .. as e, m
    tasmota.log("ASTRA: write error " + str(m), 2)
    return false
  end
end

def json_response(data)
  webserver.content_open(200, "application/json")
  webserver.content_send(data)
  webserver.content_close()
end

# ─── Per-device config (/astra_cfg) ─────────────────────────────────────────

def handle_cfg()
  var body = webserver.arg("plain")
  if size(body) > 2
    json_response('{"ok":' + (write_json(CFG_FILE, body) ? 'true' : 'false') + '}')
  else
    var data = read_json(CFG_FILE)
    json_response(data != nil ? data : '{"version":1}')
  end
end

# ─── App config (/astra_app) ────────────────────────────────────────────────

def handle_app()
  var body = webserver.arg("plain")
  if size(body) > 2
    json_response('{"ok":' + (write_json(APP_FILE, body) ? 'true' : 'false') + '}')
  else
    var data = read_json(APP_FILE)
    json_response(data != nil ? data : '{"version":1,"savedAt":0}')
  end
end

# ─── Dashboard subset (/astra_dash) ─────────────────────────────────────────

def handle_dash()
  var body = webserver.arg("plain")
  if size(body) > 2
    var incoming = json.load(body)
    if incoming == nil
      json_response('{"ok":false,"error":"bad json"}')
      return
    end
    var raw = read_json(APP_FILE)
    var cfg = raw != nil ? json.load(raw) : {}
    if cfg == nil  cfg = {}  end
    try
      if incoming.contains('dashboards')       cfg['dashboards'] = incoming['dashboards']  end
      if incoming.contains('activeDashboardId') cfg['activeDashboardId'] = incoming['activeDashboardId']  end
      if incoming.contains('savedAt')          cfg['savedAt'] = incoming['savedAt']  end
    except .. end
    json_response('{"ok":' + (write_json(APP_FILE, json.dump(cfg)) ? 'true' : 'false') + '}')
  else
    var raw = read_json(APP_FILE)
    var cfg = raw != nil ? json.load(raw) : {}
    if cfg == nil  cfg = {}  end
    var sub = {}
    try
      sub['savedAt'] = cfg.find('savedAt', 0)
      sub['dashboards'] = cfg.find('dashboards', [])
      sub['activeDashboardId'] = cfg.find('activeDashboardId', nil)
    except .. end
    json_response(json.dump(sub))
  end
end

# ─── Register ────────────────────────────────────────────────────────────────

def register_all()
  if _registered  return  end
  try
    webserver.on("/astra_cfg", handle_cfg)
    webserver.on("/astra_app", handle_app)
    webserver.on("/astra_dash", handle_dash)
    _registered = true
    tasmota.log("ASTRA: all endpoints registered (/astra_cfg, /astra_app, /astra_dash)", 2)
  except .. as e, m
    tasmota.log("ASTRA: register FAILED: " + str(e) + " " + str(m), 2)
    tasmota.set_timer(3000, register_all)
  end
end

tasmota.add_rule("Wifi#Connected", def(val, trig, msg)
  tasmota.set_timer(3000, register_all)
end)

if tasmota.wifi().find('up')
  register_all()
end
