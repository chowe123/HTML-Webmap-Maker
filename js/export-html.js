function generateHTML(data) {
  const pageTitle = escapeHtml(data.title || 'Interactive Map');
  const headerTitle = escapeHtml(data.title || 'Interactive Map Maker');
  const infoBodyHtml = data.dataNote
    ? escapeHtml(data.dataNote).replace(/\n/g, '<br>')
    : '';
  const infoPanelHtml = data.dataNote
    ? `<button id="infoBtn" title="About this map">i</button>
       <div id="infoPanel" class="hidden">
         <div class="info-panel-header"><span>${headerTitle}</span><button id="infoClose" title="Close">&times;</button></div>
         <div id="infoPanelBody">${infoBodyHtml}</div>
       </div>`
    : '';
  const usedMaki = {};
  function collectMaki(t) {
    if (t && t.indexOf('maki-') === 0 && typeof MAKI_ICONS !== 'undefined' && MAKI_ICONS[t] && !usedMaki[t]) usedMaki[t] = MAKI_ICONS[t].body;
  }
  (data.layers || []).forEach(function(l) {
    collectMaki(l.pointSymbolType);
    Object.keys(l.categorySymbols || {}).forEach(function(k) { var cs = l.categorySymbols[k]; if (cs) collectMaki(cs.pointSymbolType); });
  });
  data.maki = usedMaki;
  function prettifyDirLabel(key) {
    var s = String(key == null ? '' : key).replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (!s) return 'Detail';
    return s.replace(/\w\S*/g, function(w) { return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(); });
  }
  function dirLabelFor(cfg, key) {
    if (cfg && cfg.detailLabels && cfg.detailLabels[key]) return cfg.detailLabels[key];
    return prettifyDirLabel(key);
  }
  function mergeDirPerson(byName, person) {
    if (!person || !person.name) return;
    var ex = byName[person.name];
    if (!ex) { byName[person.name] = person; return; }
    (person.wards || []).forEach(function(w) { if (ex.wards.indexOf(w) === -1) ex.wards.push(w); });
  }
  function sortDirPeople(byName) {
    return Object.keys(byName).sort(function(a, b) {
      return String(a).localeCompare(String(b), undefined, { sensitivity: 'base' });
    }).map(function(k) { return byName[k]; });
  }
  function buildDirFromRecords(cfg, layers) {
    var byName = {};
    var src = (layers || []).filter(function(l) { return !cfg.sourceLayerId || l.id === cfg.sourceLayerId; });
    if (cfg.sourceLayerId && !src.length) return null;
    var found = false;
    src.forEach(function(l) {
      ((l.geojson && l.geojson.features) || []).forEach(function(f) {
        var p = (f && f.properties) || {};
        var raw = p[cfg.recordField];
        if (!raw) return;
        var arr;
        try { arr = JSON.parse(raw); } catch (e) { return; }
        if (!Array.isArray(arr)) return;
        found = true;
        arr.forEach(function(person) {
          if (!person || !person.name) return;
          var details = [];
          Object.keys(person).forEach(function(k) {
            if (k === 'name' || k === 'role' || k === 'municipality' || k === 'wards') return;
            var v = person[k];
            if (v === null || v === undefined || String(v).trim() === '') return;
            details.push([dirLabelFor(cfg, k), String(v)]);
          });
          mergeDirPerson(byName, {
            name: String(person.name),
            role: person.role ? String(person.role) : '',
            municipality: person.municipality ? String(person.municipality) : '',
            wards: (person.wards || []).map(function(w) { return String(w); }),
            details: details
          });
        });
      });
    });
    if (!found) return null;
    return sortDirPeople(byName);
  }
  function buildDirFromTable(cfg, table) {
    if (!table || !cfg.nameCol) return null;
    var ci = {};
    table.columns.forEach(function(c, i) { if (!(c in ci)) ci[c] = i; });
    function col(name) { return name && (name in ci) ? ci[name] : -1; }
    var ni = col(cfg.nameCol), ri = col(cfg.roleCol), gi = col(cfg.groupCol), wi = col(cfg.wardsCol);
    if (ni < 0 || wi < 0) return null;
    var split = cfg.wardsSplit || '';
    var detailCols = (cfg.detailCols && cfg.detailCols.length ? cfg.detailCols : table.columns.slice())
      .filter(function(c) { return (c in ci) && c !== cfg.nameCol && c !== cfg.roleCol && c !== cfg.groupCol && c !== cfg.wardsCol; });
    var byName = {};
    (table.rows || []).forEach(function(r) {
      var name = String(r[ni] || '').trim();
      if (!name) return;
      var wards = [];
      var parts = split ? String(r[wi] || '').split(split) : [r[wi]];
      parts.forEach(function(p) {
        p = String(p == null ? '' : p).trim();
        if (p && wards.indexOf(p) === -1) wards.push(p);
      });
      var details = [];
      detailCols.forEach(function(c) {
        var v = String(r[ci[c]] == null ? '' : r[ci[c]]).trim();
        if (!v) return;
        details.push([dirLabelFor(cfg, c), v]);
      });
      mergeDirPerson(byName, {
        name: name,
        role: ri >= 0 ? String(r[ri] || '').trim() : '',
        municipality: gi >= 0 ? String(r[gi] || '').trim() : '',
        wards: wards,
        details: details
      });
    });
    return sortDirPeople(byName);
  }
  function buildDirectory(data) {
    var dc = data.directoryConfig;
    if (dc && dc.enabled) {
      var people = null;
      if (dc.mode === 'table') people = buildDirFromTable(dc, data.directoryTable);
      else people = buildDirFromRecords(dc, data.layers);
      if (!people || !people.length) return null;
      return {
        cfg: { title: dc.title || 'Directory', zoomLayerId: dc.zoomLayerId || null,
               zoomKeyField: dc.zoomKeyField || 'WardLabel', subtitleStyle: dc.subtitleStyle || 'auto',
               areaWord: dc.areaWord || 'areas' },
        people: people
      };
    }
    // Legacy fallback: ward-map style records found by convention.
    var legacy = buildDirFromRecords(
      { recordField: 'CouncillorDirectoryJSON',
        detailLabels: { services: 'Peel services and programs', initiatives: 'Key health initiatives',
                        priorities: 'Top priorities', committees: 'Key committees' } },
      data.layers);
    if (!legacy || !legacy.length) return null;
    return {
      cfg: { title: 'Councillor Directory', zoomLayerId: null, zoomKeyField: 'WardLabel', subtitleStyle: 'mayor', areaWord: 'wards' },
      people: legacy
    };
  }
  const directory = buildDirectory(data);
  const directoryPeople = directory ? directory.people : [];
  const directoryCfg = directory ? directory.cfg : null;
  const directoryPanelHtml = directory
    ? `<button id="dirBtn" title="${escapeHtml(directory.cfg.title)}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></button>
       <div id="dirPanel" class="hidden">
         <div class="info-panel-header"><span>${escapeHtml(directory.cfg.title)}</span><button id="dirClose" title="Close">&times;</button></div>
         <div id="dirPanelBody"><input id="dirSearch" type="text" placeholder="Search\u2026" autocomplete="off" /><div id="dirFilterBanner"><span id="dirFilterText"></span><button id="dirFilterClear" type="button" title="Clear selection">&times;</button></div><div id="dirList"></div></div>
       </div>`
    : '';

return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${pageTitle}</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<link rel="stylesheet" href="https://unpkg.com/maplibre-gl/dist/maplibre-gl.css"/>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">

<style>
  :root {
    --bg-main: #090d16;
    --bg-sidebar: #0f172a;
    --bg-card: rgba(30, 41, 59, 0.4);
    --border-color: rgba(255, 255, 255, 0.08);
    --text-primary: #f8fafc;
    --text-secondary: #94a3b8;
    --text-muted: #64748b;
    --accent: #3b82f6;
    --radius-lg: 12px;
    --radius-md: 8px;
    --shadow-lg: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html { color-scheme: dark; }
  body {
    font-family: 'Inter', sans-serif;
    background-color: var(--bg-main);
    color: var(--text-primary);
    height: 100vh;
    display: flex;
    overflow: hidden;
  }
  #sidebar {
    width: 360px;
    height: 100vh;
    background: var(--bg-sidebar);
    border-right: 1px solid var(--border-color);
    display: flex;
    flex-direction: column;
    z-index: 10;
  }
  .sidebar-header {
    padding: 20px 24px;
    border-bottom: 1px solid var(--border-color);
  }
  .logo-title {
    font-family: 'Outfit', sans-serif;
    font-size: 19px;
    font-weight: 700;
    background: linear-gradient(135deg, #ffffff 40%, #93c5fd);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    line-height: 1.3;
  }
  .data-note-text {
    font-size: 12px;
    line-height: 1.5;
    color: var(--text-secondary);
    white-space: pre-wrap;
  }
  .sidebar-content {
    flex: 1;
    overflow-y: auto;
    padding: 20px 20px 40px 20px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  .card {
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-lg);
    padding: 16px;
  }
  .card-title {
    font-family: 'Outfit', sans-serif;
    font-size: 13px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: var(--text-secondary);
    margin-bottom: 12px;
  }
  input[type="text"] {
    width: 100%;
    padding: 10px 12px;
    background-color: rgba(15, 23, 42, 0.8);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    color: var(--text-primary);
    font-size: 13px;
    outline: none;
  }
  .layer-node {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: rgba(15, 23, 42, 0.4);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    padding: 10px 12px;
  }
  .layer-left { display: flex; align-items: center; gap: 8px; min-width: 0; }
  .layer-title { font-size: 13px; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .legend-item { font-size: 13px; font-weight: 600; color: var(--text-primary); margin-top: 10px; margin-bottom: 4px; }
  .legend-subitem { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--text-secondary); padding-left: 8px; margin-top: 4px; min-height: 22px; }
  .map-search-control { display: flex; flex-direction: column; min-width: 220px; }
  .map-search-inner { display: flex; align-items: center; background: var(--bg-sidebar); border-radius: var(--radius-md); }
  .map-search-inner input { flex:1; min-width:0; background:transparent; border:none; padding:7px 10px; font-size:12px; color:var(--text-primary); outline:none; }
  .map-search-inner input::placeholder { color: var(--text-muted); }
  .map-search-inner button { display:flex; align-items:center; justify-content:center; background:transparent; border:none; color:var(--text-muted); padding:5px 10px; cursor:pointer; flex-shrink:0; }
  .map-search-inner button:hover { color: var(--text-primary); }
  .map-search-dropdown { background:var(--bg-sidebar); border-top:1px solid var(--border-color); max-height:160px; overflow-y:auto; display:none; }
  .map-search-dropdown:empty { display:none; }
  .map-search-dropdown:not(:empty) { display:block; }
  .map-search-dropdown div { padding:6px 10px; font-size:11px; color:var(--text-secondary); cursor:pointer; border-bottom:1px solid rgba(255,255,255,0.04); line-height:1.4; }
  .map-search-dropdown div:hover { background:rgba(255,255,255,0.05); color:var(--text-primary); }
  .map-mode-toggle { display:inline-flex; align-items:center; justify-content:center; background:transparent; border:none; border-left:1px solid var(--border-color); color:var(--text-muted); padding:6px 8px; cursor:pointer; flex-shrink:0; opacity:0.6; }
  .map-mode-toggle:hover { opacity:1; color:var(--accent); }
  .map-pin-hint { padding:10px; font-size:11px; color:var(--text-secondary); line-height:1.4; }
  #dirSearch { margin-bottom: 4px; }
  #dirList { display: flex; flex-direction: column; gap: 8px; margin-top: 8px; }
  .dir-item { background: rgba(15, 23, 42, 0.4); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 10px 12px; }
  .dir-head { cursor: pointer; }
  .dir-name { font-size: 13px; font-weight: 600; color: var(--text-primary); }
  .dir-sub { font-size: 11px; color: var(--text-secondary); margin-top: 2px; }
  .dir-detail { display: none; margin-top: 8px; border-top: 1px solid var(--border-color); padding-top: 8px; }
  .dir-item.open .dir-detail { display: block; }
  .dir-sec { font-size: 12px; color: var(--text-primary); line-height: 1.5; margin-bottom: 6px; word-break: break-word; }
  .dir-sec-label { display: block; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.6px; color: var(--text-muted); margin-bottom: 2px; }
  .dir-zoom { margin-top: 4px; padding: 6px 10px; font-size: 12px; font-weight: 600; color: #fff; background: var(--accent); border: none; border-radius: 6px; cursor: pointer; }
  .dir-zoom:hover { filter: brightness(1.15); }
  .dir-empty { font-size: 12px; color: var(--text-muted); padding: 6px 2px; }
  #map { flex: 1; height: 100vh; background-color: #0b0f19 !important; position: relative; }
  .leaflet-popup-content-wrapper { background: rgba(15,23,42,0.95) !important; color:#fff !important; border:1px solid var(--border-color); }
  .gis-point-symbol-icon, .gis-custom-point-icon { background: transparent !important; border: none !important; }
  .gis-point-symbol-icon svg { display: block; }
  .layer-label { background: none !important; border: none !important; box-shadow: none !important; font-weight: bold; padding: 1px 3px !important; line-height: 1.2 !important; white-space: nowrap; }
  #infoBtn {
    position: absolute; top: 76px; right: 10px; z-index: 1000;
    width: 34px; height: 34px; border-radius: 50%;
    background: #0f172a; border: 1px solid rgba(255,255,255,0.08);
    color: #f8fafc; font-size: 17px; font-weight: 700; font-family: Georgia, serif; font-style: italic;
    cursor: pointer; box-shadow: var(--shadow-lg);
    display: flex; align-items: center; justify-content: center; padding: 0;
  }
  #infoBtn:hover { border-color: var(--accent); color: #93c5fd; }
  #infoPanel {
    position: absolute; top: 0; right: 0; bottom: 0; width: 330px; max-width: 85%; z-index: 999;
    background: rgba(15,23,42,0.97); border-left: 1px solid rgba(255,255,255,0.08);
    box-shadow: var(--shadow-lg); display: flex; flex-direction: column;
    transform: translateX(0); transition: transform 0.25s ease;
    font-family: 'Inter', sans-serif;
  }
  #infoPanel.hidden { transform: translateX(105%); }
  .info-panel-header {
    display: flex; align-items: center; gap: 8px;
    padding: 14px 16px; border-bottom: 1px solid rgba(255,255,255,0.08); flex-shrink: 0;
  }
  .info-panel-header span {
    flex: 1; min-width: 0; font-family: 'Outfit', sans-serif; font-size: 15px; font-weight: 700; color: #f8fafc;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  #infoClose {
    background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); color: #64748b;
    width: 26px; height: 26px; border-radius: 6px; cursor: pointer; font-size: 14px; line-height: 1; flex-shrink: 0;
  }
  #infoClose:hover { color: #f8fafc; background: rgba(255,255,255,0.1); }
  #infoPanelBody {
    flex: 1; overflow-y: auto; padding: 16px; font-size: 12px; line-height: 1.6; color: #94a3b8; word-break: break-word;
  }
  #dirBtn {
    position: absolute; top: 120px; right: 10px; z-index: 1000;
    width: 34px; height: 34px; border-radius: 50%;
    background: #0f172a; border: 1px solid rgba(255,255,255,0.08);
    color: #f8fafc; cursor: pointer; box-shadow: var(--shadow-lg);
    display: flex; align-items: center; justify-content: center; padding: 0;
  }
  #dirBtn:hover { border-color: var(--accent); color: #93c5fd; }
  #dirPanel {
    position: absolute; top: 0; right: 0; bottom: 0; width: 330px; max-width: 85%; z-index: 999;
    background: rgba(15,23,42,0.97); border-left: 1px solid rgba(255,255,255,0.08);
    box-shadow: var(--shadow-lg); display: flex; flex-direction: column;
    transform: translateX(0); transition: transform 0.25s ease;
    font-family: 'Inter', sans-serif;
  }
  #dirPanel.hidden { transform: translateX(105%); }
  #dirClose {
    background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); color: #64748b;
    width: 26px; height: 26px; border-radius: 6px; cursor: pointer; font-size: 14px; line-height: 1; flex-shrink: 0;
  }
  #dirClose:hover { color: #f8fafc; background: rgba(255,255,255,0.1); }
  #dirPanelBody { flex: 1; overflow-y: auto; padding: 16px; }
  #dirFilterBanner { display: none; align-items: center; justify-content: space-between; gap: 8px; background: rgba(59,130,246,0.15); border: 1px solid rgba(59,130,246,0.4); border-radius: 8px; padding: 6px 10px; margin: 8px 0; font-size: 12px; color: #bfdbfe; }
  #dirFilterClear { background: transparent; border: none; color: #bfdbfe; font-size: 15px; line-height: 1; cursor: pointer; padding: 0 2px; }
  #dirFilterClear:hover { color: #ffffff; }
</style>
</head>
<body>

<div id="sidebar">
  <div class="sidebar-header">
    <div class="logo-title">${headerTitle}</div>
  </div>
  <div class="sidebar-content">
    <div class="card">
      <div class="card-title">Legend</div>
      <div id="legend" style="padding-bottom: 16px;"></div>
    </div>
    <div class="card">
      <div class="card-title">Layers</div>
      <div id="layers" style="display:flex; flex-direction:column; gap:8px;"></div>
    </div>
  </div>
</div>

<div id="map">${infoPanelHtml}${directoryPanelHtml}

<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script src="https://unpkg.com/maplibre-gl@5.11.0/dist/maplibre-gl.js"></script>
<script src="https://unpkg.com/@maplibre/maplibre-gl-leaflet@0.1.3/leaflet-maplibre-gl.js"></script>
<script src="https://cdn.jsdelivr.net/npm/sql.js@1.10.3/dist/sql-wasm.js"></script>
<script>
const exportedData = ${JSON.stringify(data)};
const mv = exportedData.mapView || { lat: 43.7, lng: -79.4, zoom: 10 };
const map = L.map('map', { renderer: L.canvas() }).setView([mv.lat, mv.lng], mv.zoom);
var _remoteBasemap = null;
var _localBasemap = null;
var _activeBasemap = 'none';
function showBasemap(which) {
  if (which === 'local') {
    if (!_localBasemap) { showMBTilesPrompt(); return; }
    if (_remoteBasemap && map.hasLayer(_remoteBasemap)) map.removeLayer(_remoteBasemap);
    if (!map.hasLayer(_localBasemap)) _localBasemap.addTo(map);
    _activeBasemap = 'local';
  } else {
    if (!_remoteBasemap) return;
    if (_localBasemap && map.hasLayer(_localBasemap)) map.removeLayer(_localBasemap);
    if (!map.hasLayer(_remoteBasemap)) _remoteBasemap.addTo(map);
    _activeBasemap = 'remote';
  }
  updateBasemapUI();
}
function updateBasemapUI() {
  var b = document.getElementById('_bm_toggle');
  if (!b) return;
  var r = b.querySelector('#_bm_remote_btn'), l = b.querySelector('#_bm_local_btn');
  function paint(btn, on) { if (btn) btn.style.background = on ? '#3b82f6' : 'transparent'; }
  paint(r, _activeBasemap === 'remote');
  paint(l, _activeBasemap === 'local');
}
function isOffline() { return typeof navigator !== 'undefined' && navigator.onLine === false; }

function loadMBTilesBuffer(buf) {
  initSqlJs({ locateFile: function(f) { return 'https://cdn.jsdelivr.net/npm/sql.js@1.10.3/dist/' + f; } }).then(function(SQL) {
    try {
      var db = new SQL.Database(new Uint8Array(buf));
      var meta = {};
      var ms = db.prepare("SELECT name, value FROM metadata");
      while (ms.step()) { var row = ms.getAsObject(); meta[row.name] = row.value; }
      ms.free();
      var fmt = (meta.format || 'png').replace(/^image\\//, '');
      var maxZ = parseInt(meta.maxzoom, 10) || 18;
      function qTile(z, x, y) {
        var tmsY = Math.pow(2, z) - 1 - y;
        var s = db.prepare("SELECT tile_data FROM tiles WHERE zoom_level=? AND tile_column=? AND tile_row=?");
        s.bind([z, x, tmsY]); if (s.step()) { var r = s.getAsObject(); s.free(); return r.tile_data; } s.free();
        s = db.prepare("SELECT tile_data FROM tiles WHERE zoom_level=? AND tile_column=? AND tile_row=?");
        s.bind([z, x, y]); if (s.step()) { var r = s.getAsObject(); s.free(); return r.tile_data; } s.free();
        return null;
      }
      var layer = new (L.GridLayer.extend({
        createTile: function(coords, done) {
          var tile = L.DomUtil.create('img', 'leaflet-tile');
          tile.alt = '';
          try {
            var d = qTile(coords.z, coords.x, coords.y);
            if (d) {
              var mime = fmt === 'jpg' || fmt === 'jpeg' ? 'image/jpeg' : 'image/png';
              var url = URL.createObjectURL(new Blob([d], { type: mime }));
              tile.addEventListener('load', function() { URL.revokeObjectURL(url); done(null, tile); });
              tile.addEventListener('error', function() { URL.revokeObjectURL(url); done(null, tile); });
              tile.src = url;
            } else { done(null, tile); }
          } catch(e) { done(null, tile); }
          return tile;
        }
      }))({ minZoom: 0, maxZoom: 22, maxNativeZoom: maxZ, tileSize: 256, noWrap: true });
      _localBasemap = layer;
      showBasemap('local');
      doneMBTiles(null, buf);
    } catch(e) { doneMBTiles(e, null); }
  }).catch(function(e) { doneMBTiles(e, null); });
}
function doneMBTiles(err, buf) {
  var banner = document.getElementById('_mbtiles_banner');
  if (err) {
    if (banner) { banner.textContent = 'Error: ' + (err.message || err); banner.style.borderColor = '#ef4444'; banner.style.cursor = 'default'; banner.style.opacity = '1'; }
    setTimeout(function() {
      if (banner) {
        banner.textContent = 'Click to select the MBTiles basemap file';
        banner.style.borderColor = '#3b82f6'; banner.style.cursor = 'pointer'; banner.style.opacity = '1';
      }
    }, 4000);
  } else {
    // Cache in IndexedDB for next page load
    try {
      var cr = indexedDB.open('MbtilesCache', 1);
      cr.onupgradeneeded = function(e) { if (!e.target.result.objectStoreNames.contains('data')) e.target.result.createObjectStore('data'); };
      cr.onsuccess = function(e) {
        var tx = e.target.result.transaction('data', 'readwrite');
        tx.objectStore('data').put(buf, 'mbtiles');
      };
    } catch(ie) {}
    if (banner) {
      banner.textContent = 'Basemap loaded';
      banner.style.borderColor = '#22c55e'; banner.style.cursor = 'default'; banner.style.opacity = '0.8';
      setTimeout(function() { if (banner && banner.parentNode) banner.parentNode.removeChild(banner); }, 1500);
    }
  }
}
function tryLoadMBTiles(filename) {
  if (window.location.protocol === 'file:') { tryLoadMBTilesFromCache(); return; }
  fetch(filename).then(function(r) {
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.arrayBuffer();
  }).then(function(buf) {
    loadMBTilesBuffer(buf);
  }).catch(function() {
    showMBTilesPrompt();
  });
}
function tryLoadMBTilesFromCache() {
  try {
    var cr = indexedDB.open('MbtilesCache', 1);
    cr.onupgradeneeded = function(e) { if (!e.target.result.objectStoreNames.contains('data')) e.target.result.createObjectStore('data'); };
    cr.onsuccess = function(e) {
      var tx = e.target.result.transaction('data', 'readonly');
      var r = tx.objectStore('data').get('mbtiles');
      r.onsuccess = function() {
        if (r.result instanceof ArrayBuffer) { loadMBTilesBuffer(r.result); }
        else { showMBTilesPrompt(); }
      };
      r.onerror = function() { showMBTilesPrompt(); };
    };
    cr.onerror = function() { showMBTilesPrompt(); };
  } catch(e) { showMBTilesPrompt(); }
}
function showMBTilesPrompt() {
  var inp = document.createElement('input');
  inp.type = 'file'; inp.accept = '.mbtiles';
  inp.id = '_mbtiles_picker';
  inp.style.display = 'none';
  inp.addEventListener('change', function(e) {
    var f = e.target.files[0]; if (!f) return;
    var banner = document.getElementById('_mbtiles_banner');
    if (banner) { banner.textContent = 'Loading basemap...'; banner.style.borderColor = '#3b82f6'; banner.style.cursor = 'default'; banner.style.opacity = '0.6'; }
    var reader = new FileReader();
    reader.onload = function(ev) { loadMBTilesBuffer(ev.target.result); };
    reader.readAsArrayBuffer(f);
  });
  document.body.appendChild(inp);
  var old = document.getElementById('_mbtiles_banner');
  if (old) old.parentNode.removeChild(old);
  var lbl = document.createElement('label');
  lbl.htmlFor = '_mbtiles_picker';
  lbl.id = '_mbtiles_banner';
  lbl.textContent = 'Click to select the MBTiles basemap file';
  lbl.style.cssText = 'position:absolute;bottom:30px;left:50%;transform:translateX(-50%);background:#1e293b;color:#f8fafc;padding:14px 28px;border-radius:10px;border:2px dashed #3b82f6;font-size:15px;font-weight:600;z-index:1000;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,0.5);text-align:center;white-space:nowrap;';
  document.getElementById('map').appendChild(lbl);
}
function base64ToBuffer(b64) {
  var raw = atob(b64);
  var buf = new Uint8Array(raw.length);
  for (var i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i);
  return buf.buffer;
}
var exBasemap = exportedData.basemap || 'none';
if (exBasemap === 'local') {
  if (exportedData.mbtilesDataUrl) {
    try { loadMBTilesBuffer(base64ToBuffer(exportedData.mbtilesDataUrl)); }
    catch (e) { showMBTilesPrompt(); }
  } else if (exportedData.mbtilesFilename) tryLoadMBTiles(exportedData.mbtilesFilename);
} else if (exBasemap !== 'none') {
${currentBasemap === 'none' || currentBasemap === 'local' ? '' : `
var bmCfg = { type: '${BASEMAPS[currentBasemap].type}', url: '${BASEMAPS[currentBasemap].url}', attribution: '${BASEMAPS[currentBasemap].attribution}' };
if (isOffline()) {
  showMBTilesPrompt();
} else if (bmCfg.type === 'vector') {
  _remoteBasemap = L.maplibreGL({ style: bmCfg.url, attribution: bmCfg.attribution });
  _remoteBasemap.addTo(map);
} else {
  _remoteBasemap = L.tileLayer(bmCfg.url, { attribution: bmCfg.attribution });
  _remoteBasemap.addTo(map);
  _remoteBasemap.on('tileerror', function() { showMBTilesPrompt(); });
}
_activeBasemap = _remoteBasemap ? 'remote' : 'local';
if (isOffline()) updateBasemapUI();
`}
}

let layers = [];
let searchMarker = null;
let debounceTimer = null;

function compareCategoryKeys(a, b) {
  const labelA = a === '' ? '\\uffff' : String(a);
  const labelB = b === '' ? '\\uffff' : String(b);
  return labelA.localeCompare(labelB, undefined, { sensitivity: 'base', numeric: true });
}

function getCategorySortValue(l, key) {
  const intervals = l.intervals || [];
  for (let i = 0; i < intervals.length; i++) {
    if (intervals[i].key === key) return intervals[i].classIndex ?? 0;
  }
  const num = parseFloat(key);
  return isNaN(num) ? Infinity : num;
}

function sortCategoryKeys(keys, mode, l) {
  if (mode === 'numeric-asc' || mode === 'numeric-desc') {
    const sorted = keys.slice().sort(function(a, b) { return getCategorySortValue(l, a) - getCategorySortValue(l, b); });
    if (mode === 'numeric-desc') sorted.reverse();
    return sorted;
  }
  const sorted = keys.slice().sort(compareCategoryKeys);
  if (mode === 'desc') sorted.reverse();
  return sorted;
}

function getOrderedCategoryKeys(l) {
  const keys = Object.keys(l.categories || {});
  const order = l.categoryOrder || [];
  const ordered = order.filter(function(k) { return keys.indexOf(k) !== -1; });
  keys.forEach(function(k) { if (ordered.indexOf(k) === -1) ordered.push(k); });
  return ordered;
}

function classifyValueByLimits(num, limits) {
  for (let i = 0; i < limits.length; i++) {
    const upper = limits[i];
    const hasUpper = upper !== null && upper !== '' && isFinite(Number(upper));
    if (!hasUpper) {
      if (i === 0) return 0;
      const prev = Number(limits[i - 1]);
      if (isFinite(prev) && num > prev) return i;
      continue;
    }
    const upperN = Number(upper);
    if (num <= upperN) {
      if (i === 0) return 0;
      const prev = Number(limits[i - 1]);
      if (!isFinite(prev) || num > prev) return i;
    }
  }
  return Math.max(0, limits.length - 1);
}

function getCategoryKeyForValue(l, rawValue) {
  const method = l.classifyMethod || 'unique';
  if (method === 'unique' || !l.symbologyField) {
    if (rawValue === null || rawValue === undefined) return '__null__';
    return String(rawValue);
  }
  const num = Number(rawValue);
  if (isNaN(num) || !isFinite(num)) return '__non_numeric__';
  const limits = l.classLimits || [];
  if (!limits.length) return '__outlier__';
  return 'class_' + classifyValueByLimits(num, limits);
}

function getCategoryDisplayLabel(l, key) {
  if (l.customCategoryLabels && l.customCategoryLabels[key]) return l.customCategoryLabels[key];
  const intervals = l.intervals || [];
  for (let i = 0; i < intervals.length; i++) {
    if (intervals[i].key === key) return intervals[i].label;
  }
  if (key === '__null__') return '[No value]';
  if (key === '__non_numeric__') return '[Non-numeric]';
  if (key === '__outlier__') return '[Out of range]';
  return key || '[Empty]';
}

function getExportedFillColor(l, feature) {
  let fillColor = l.color;
  if (l.symbologyType === 'categorized' && l.symbologyField) {
    const val = feature.properties ? feature.properties[l.symbologyField] : null;
    const catKey = getCategoryKeyForValue(l, val);
    if (l.categories[catKey]) fillColor = l.categories[catKey];
  }
  return fillColor;
}

function getExportedFeatureStyle(l, feature) {
  const fillColor = getExportedFillColor(l, feature);
  const layerOpacity = l.opacity ?? 0.4;
  let fillOpacity = layerOpacity;
  let strokeColor = l.strokeColor || fillColor;
  let strokeWeight = l.weight;
  let strokeOpacity = layerOpacity;
  if (l.symbologyType === 'categorized' && l.symbologyField) {
    const val = feature.properties ? feature.properties[l.symbologyField] : null;
    const catKey = getCategoryKeyForValue(l, val);
    if (l.categoryNoFill && l.categoryNoFill[catKey]) fillOpacity = 0;
    const cs = l.categoryStroke && l.categoryStroke[catKey];
    if (cs) {
      if (cs.color !== undefined && cs.color !== '') strokeColor = cs.color;
      if (cs.width !== undefined) strokeWeight = cs.width;
      if (cs.opacity !== undefined) strokeOpacity = cs.opacity;
    }
  }
  return { color: strokeColor, fillColor, fillOpacity, opacity: strokeOpacity, weight: strokeWeight };
}

function getExportedSelFeatureStyle(l, feature) {
  var style = getExportedFeatureStyle(l, feature);
  var sel = selectedFeatures[l.name];
  if (sel && sel.size) {
    var features = l.geojson.features || [];
    var idx = features.indexOf(feature);
    if (idx >= 0 && sel.has(idx)) {
      style.fillColor = '#00e5ff';
      style.fillOpacity = 1;
      style.weight = Math.max(style.weight || 1, 3);
      style.opacity = 1;
    }
  }
  return style;
}

function getExportedPointStrokeColor(l) {
  return l.pointStrokeColor || l.strokeColor || '#ffffff';
}

function getExportedSymbolSvgShape(type, fill, strokeAttr) {
  var f = fill || '#3b82f6';
  var s = strokeAttr || '';
  if (typeof type === 'string' && type.indexOf('maki-') === 0 && typeof exportedData !== 'undefined' && exportedData.maki && exportedData.maki[type]) {
    var sc = '#ffffff';
    var swd = 2;
    var m1 = s.match(/stroke="([^"]+)"/);
    if (m1 && m1[1] !== 'none') sc = m1[1];
    var m2 = s.match(/stroke-width="([\\d.]+)"/);
    if (m2) swd = parseFloat(m2[1]);
    if (s.indexOf('stroke="none"') !== -1) swd = 0;
    var ring = swd > 0 ? ' stroke="' + sc + '" stroke-width="' + swd + '"' : '';
    return '<circle cx="10" cy="10" r="8.5" fill="#ffffff"' + ring + '/>'
      + '<g transform="translate(4.6,4.6) scale(0.72)" fill="' + f + '">' + exportedData.maki[type] + '</g>';
  }
  switch (type) {
    case 'square': return '<rect x="2" y="2" width="16" height="16" rx="2" fill="' + f + '"' + s + '/>';
    case 'triangle': return '<polygon points="10,2 18,17 2,17" fill="' + f + '"' + s + ' stroke-linejoin="round"/>';
    case 'diamond': return '<polygon points="10,2 18,10 10,18 2,10" fill="' + f + '"' + s + ' stroke-linejoin="round"/>';
    case 'pentagon': return '<polygon points="10,2 17.6,7.5 14.7,16.5 5.3,16.5 2.4,7.5" fill="' + f + '"' + s + ' stroke-linejoin="round"/>';
    case 'hexagon': return '<polygon points="10,2 16.9,6 16.9,14 10,18 3.1,14 3.1,6" fill="' + f + '"' + s + ' stroke-linejoin="round"/>';
    case 'star': return '<polygon points="10,2 11.9,7.4 17.6,7.5 13.0,11.0 14.7,16.5 10,13.2 5.3,16.5 7.0,11.0 2.4,7.5 8.1,7.4" fill="' + f + '"' + s + ' stroke-linejoin="round"/>';
    case 'cross': return '<rect x="8" y="2" width="4" height="16" rx="1" fill="' + f + '"' + s + '/><rect x="2" y="8" width="16" height="4" rx="1" fill="' + f + '"' + s + '/>';
    case 'crosshair': return '<circle cx="10" cy="10" r="7" fill="none"' + s + '/><line x1="10" y1="3" x2="10" y2="17" stroke="#fff" stroke-width="1.5"/><line x1="3" y1="10" x2="17" y2="10" stroke="#fff" stroke-width="1.5"/><circle cx="10" cy="10" r="3" fill="' + f + '"' + s + '/>';
    case 'pin': return '<path d="M10,2 C4,2 2,6 2,10 C2,15 10,18 10,18 C10,18 18,15 18,10 C18,6 16,2 10,2Z" fill="' + f + '"' + s + ' stroke-linejoin="round"/>';
    case 'arrow': return '<polygon points="10,2 18,14 13,14 13,18 7,18 7,14 2,14" fill="' + f + '"' + s + ' stroke-linejoin="round"/>';
    case 'teardrop': return '<path d="M10,1 C10,1 18,11 18,14 C18,18.4 14.4,19 10,19 C5.6,19 2,18.4 2,14 C2,11 10,1 10,1Z" fill="' + f + '"' + s + ' stroke-linejoin="round"/>';
    case 'ring': return '<circle cx="10" cy="10" r="8" fill="none"' + s + '/><circle cx="10" cy="10" r="3" fill="' + f + '"' + s + '/>';
    default: return '<circle cx="10" cy="10" r="8" fill="' + f + '"' + s + '/>';
  }
}

function buildExportedPointSymbolHtml(symbolType, fillColor, strokeColor, size, strokeWidth) {
  const stroke = strokeColor || '#ffffff';
  const sw = parseExportedPointStrokeWidth(strokeWidth ?? 2);
  const dim = Math.max(8, size * 2);
  const safeFill = fillColor || '#3b82f6';
  const strokeAttr = sw > 0 ? ' stroke="' + stroke + '" stroke-width="' + sw + '"' : ' stroke="none"';
  const inner = getExportedSymbolSvgShape(symbolType, safeFill, strokeAttr);
  return '<svg xmlns="http://www.w3.org/2000/svg" width="' + dim + '" height="' + dim + '" viewBox="0 0 20 20" style="display:block">' + inner + '</svg>';
}

function parseExportedPointStrokeWidth(value) {
  const n = parseFloat(value);
  if (isNaN(n) || n < 0) return 0;
  return Math.min(20, n);
}

function isExportedPointFeature(feature) {
  const t = feature && feature.geometry && feature.geometry.type;
  return t === 'Point' || t === 'MultiPoint';
}

function layerDataHasPoints(l) {
  const features = l.geojson.features || (l.geojson.type === 'Feature' ? [l.geojson] : []);
  for (let i = 0; i < features.length; i++) {
    const t = features[i].geometry && features[i].geometry.type;
    if (t === 'Point' || t === 'MultiPoint') return true;
  }
  return false;
}

function buildExportedPointIcon(feature, l) {
  var fillColor = getExportedFillColor(l, feature);
  var strokeColor = getExportedPointStrokeColor(l);
  var features = l.geojson.features || [];
  var idx = features.indexOf(feature);
  var isSelected = selectedFeatures[l.name] && idx >= 0 && selectedFeatures[l.name].has(idx);
  if (isSelected) { fillColor = '#00e5ff'; }
  let size = l.pointSize ?? 10;
  let symbolType = l.pointSymbolType || 'circle';
  let strokeWidth = l.pointStrokeWidth ?? 2;
  if (l.symbologyType === 'categorized' && l.symbologyField) {
    const val = feature.properties ? feature.properties[l.symbologyField] : null;
    const catKey = getCategoryKeyForValue(l, val);
    const catSym = l.categorySymbols?.[catKey];
    if (catSym) {
      if (catSym.pointSymbolType) symbolType = catSym.pointSymbolType;
      if (catSym.pointSize != null) size = catSym.pointSize;
      if (catSym.customSymbolUrl) customUrl = catSym.customSymbolUrl;
      if (catSym.pointStrokeWidth != null) strokeWidth = catSym.pointStrokeWidth;
    }
  }
  const markerOpacity = isSelected ? 1 : (l.opacity ?? 0.4);
  const dim = Math.max(8, size * 2);
  if (symbolType === 'custom' && (l.customSymbolUrl || (l.categorySymbols && l.categorySymbols[getCategoryKeyForValue(l, feature.properties ? feature.properties[l.symbologyField] : null)]?.customSymbolUrl))) {
    var url = l.customSymbolUrl;
    var cs = l.symbologyType === 'categorized' && l.symbologyField ? l.categorySymbols?.[getCategoryKeyForValue(l, feature.properties ? feature.properties[l.symbologyField] : null)] : null;
    if (cs && cs.customSymbolUrl) url = cs.customSymbolUrl;
    return L.icon({ iconUrl: url, iconSize: [dim, dim], iconAnchor: [size, size], popupAnchor: [0, -size], className: 'gis-custom-point-icon' });
  }
  return L.divIcon({ className: 'gis-point-symbol-icon', html: buildExportedPointSymbolHtml(symbolType, fillColor, strokeColor, size, strokeWidth), iconSize: [dim, dim], iconAnchor: [size, size] });
}
function createExportedPointMarker(feature, latlng, l) {
  const markerOpacity = (selectedFeatures[l.name] && selectedFeatures[l.name].has((l.geojson.features || []).indexOf(feature))) ? 1 : (l.opacity ?? 0.4);
  return L.marker(latlng, { icon: buildExportedPointIcon(feature, l), opacity: markerOpacity });
}

function escapeExportedHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderExportedRichText(raw, feature, layerConfig) {
  if (!raw) return '';
  var props = (feature && feature.properties) || {};
  var layerName = (layerConfig && layerConfig.name) || '';
  var PH = '\u0001';
  var keys = [];
  var s = escapeExportedHtml(String(raw)).replace(/\\{([^}]+)\\}/g, function(match, key) {
    keys.push(key.trim());
    return PH + (keys.length - 1) + PH;
  });
  s = s
    .replace(/\\*\\*(.+?)\\*\\*/g, '<b>$1</b>')
    .replace(/__(.+?)__/g, '<u>$1</u>')
    .replace(/\\*(.+?)\\*/g, '<i>$1</i>');
  s = s.replace(/\u0001(\\d+)\u0001/g, function(match, idx) {
    var key = keys[parseInt(idx, 10)];
    if (key === 'layerName') return escapeExportedHtml(layerName);
    if (Object.prototype.hasOwnProperty.call(props, key)) {
      var v = props[key];
      return v === null || v === undefined ? '' : escapeExportedHtml(String(v));
    }
    return '{' + escapeExportedHtml(key) + '}';
  });
  return s;
}

function replaceExportedPopupTokens(str, feature, layerConfig) {
  if (!str) return '';
  const props = feature.properties || {};
  return String(str).replace(/\\{([^}]+)\\}/g, function(match, key) {
    const trimmed = key.trim();
    if (trimmed === 'layerName') return layerConfig.name || '';
    if (Object.prototype.hasOwnProperty.call(props, trimmed)) {
      return props[trimmed] === null || props[trimmed] === undefined ? '' : String(props[trimmed]);
    }
    return match;
  });
}

function buildExportedPopupHtml(feature, layerConfig) {
  if (layerConfig.popupEnabled === false) return '';
  const props = feature.properties || {};
  const titleRaw = layerConfig.popupTitle && layerConfig.popupTitle.trim();
  const title = titleRaw ? renderExportedRichText(titleRaw, feature, layerConfig) : escapeExportedHtml(layerConfig.name);
  const template = layerConfig.popupTemplate && layerConfig.popupTemplate.trim();
  if (template) {
    const body = template.split('\\n').map(function(line) { return renderExportedRichText(line, feature, layerConfig); }).join('<br/>');
    return '<div class="gis-feature-popup" style="font-size:12px;font-family:sans-serif;line-height:1.45;"><b style="color:#3b82f6;font-size:13px;display:block;margin-bottom:6px;">' + title + '</b><div style="color:#f8fafc;">' + body + '</div></div>';
  }
  let fields = Object.keys(props);
  if (layerConfig.popupFields && layerConfig.popupFields.length) { fields = layerConfig.popupFields.filter(function(f) { return f in props; }); }
  let html = '<div class="gis-feature-popup" style="font-size:12px;font-family:sans-serif;line-height:1.45;"><b style="color:#3b82f6;font-size:13px;display:block;margin-bottom:6px;">' + title + '</b>';
  if (!fields.length) { html += '<span style="color:#94a3b8;">No attributes to display</span>'; }
  else {
    const showLabels = layerConfig.popupShowLabels !== false;
    fields.forEach(function(k) {
      const val = props[k] === null || props[k] === undefined ? '' : String(props[k]);
      if (showLabels) { html += '<div style="margin-bottom:3px;"><span style="color:#94a3b8;">' + escapeExportedHtml(k) + ':</span> <span style="color:#f8fafc;font-weight:500;">' + escapeExportedHtml(val) + '</span></div>'; }
      else { html += '<div style="margin-bottom:3px;color:#f8fafc;">' + escapeExportedHtml(val) + '</div>'; }
    });
  }
  html += '</div>';
  return html;
}

// Inject per-layer label styles
exportedData.layers.forEach(function(l) {
  if (l.labelEnabled && l.labelField) {
    var s = document.createElement('style');
    s.textContent = '.exported-label { font-family:' + (l.labelFont||'Arial') + '; font-size:' + (l.labelSize||12) + 'px !important; color:' + (l.labelColor||'#ffffff') + ' !important; -webkit-text-stroke:' + (l.labelStrokeWidth||2) + 'px ' + (l.labelStrokeColor||'#000000') + '; paint-order:stroke; text-stroke:' + (l.labelStrokeWidth||2) + 'px ' + (l.labelStrokeColor||'#000000') + '; }';
    document.head.appendChild(s);
  }
});

if (exportedData.rasterLayers) {
  exportedData.rasterLayers.forEach(function(r) {
    var b = r.bounds;
    var bounds = L.latLngBounds([b.south, b.west], [b.north, b.east]);
    var overlay = L.imageOverlay(r.dataUrl, bounds, { opacity: r.opacity || 1.0 });
    if (r.visible !== false) overlay.addTo(map);
  });
}

var selectedFeatures = {};
var directoryWardFilterHandler = null;
map.on('click', function() { clearExportedSelection(); if (directoryWardFilterHandler) directoryWardFilterHandler(); });
function clearExportedSelection() {
  var changed = {};
  Object.keys(selectedFeatures).forEach(function(n) { if (selectedFeatures[n] && selectedFeatures[n].size) changed[n] = true; });
  selectedFeatures = {};
  Object.keys(changed).forEach(function(n) {
    var l = layers.find(function(x) { return x.name === n; });
    if (l && l.layer) {
      l.layer.setStyle(l.layer.options.style);
      l.layer.eachLayer(function(ll) {
        if (ll.feature && isExportedPointFeature(ll.feature) && ll.setIcon) {
          ll.setIcon(buildExportedPointIcon(ll.feature, l));
          var op = (l.opacity ?? 0.4);
          if (ll.setOpacity) ll.setOpacity(op);
        }
      });
    }
  });
}
function toggleExportedSelection(l, feature) {
  var features = l.geojson.features || [];
  var idx = features.indexOf(feature);
  if (idx < 0) return;
  clearExportedSelection();
  if (!selectedFeatures[l.name]) selectedFeatures[l.name] = new Set();
  selectedFeatures[l.name].add(idx);
}
function deselectExportedFeature(l, feature) {
  var features = l.geojson.features || [];
  var idx = features.indexOf(feature);
  if (idx < 0) return;
  var set = selectedFeatures[l.name];
  if (!set || !set.has(idx)) return;
  set.delete(idx);
  var wrapper = layers.find(function(x) { return x.name === l.name; });
  updateExportedLayerStyles(wrapper);
  if (directoryWardFilterHandler) directoryWardFilterHandler();
}
function updateExportedLayerStyles(l) {
  if (!l || !l.layer) return;
  l.layer.setStyle(l.layer.options.style);
  l.layer.eachLayer(function(ll) {
    if (ll.feature && isExportedPointFeature(ll.feature) && ll.setIcon) {
      ll.setIcon(buildExportedPointIcon(ll.feature, l));
      var isSel = selectedFeatures[l.name] && selectedFeatures[l.name].has((l.geojson.features || []).indexOf(ll.feature));
      if (ll.setOpacity) ll.setOpacity(isSel ? 1 : (l.opacity ?? 0.4));
    }
  });
}

exportedData.layers.forEach(l => {
  const geoOptions = {
    style: function(feature) { if (isExportedPointFeature(feature)) return {}; return getExportedSelFeatureStyle(l, feature); },
    onEachFeature: function(f, leafletLayer) {
      leafletLayer.on('click', function(e) {
        L.DomEvent.stopPropagation(e);
        toggleExportedSelection(l, f);
        var wrapper = layers.find(function(x) { return x.name === l.name; });
        updateExportedLayerStyles(wrapper);
        if (directoryWardFilterHandler) directoryWardFilterHandler();
      });
      leafletLayer.on('popupclose', function() {
        deselectExportedFeature(l, f);
      });
      if (l.popupEnabled === false) { leafletLayer.unbindPopup(); }
      else { const html = buildExportedPopupHtml(f, l); if (html) leafletLayer.bindPopup(html); else leafletLayer.unbindPopup(); }
      if (l.labelEnabled && l.labelField) {
        var v = f.properties ? f.properties[l.labelField] : null;
        if (v != null && v !== '') { leafletLayer.bindTooltip(String(v), { permanent: true, direction: 'center', className: 'layer-label exported-label' }); }
      }
    }
  };
  if (layerDataHasPoints(l)) { geoOptions.pointToLayer = function(feature, latlng) { return createExportedPointMarker(feature, latlng, l); }; }
  const layer = L.geoJSON(l.geojson, geoOptions);
  layer.addTo(map);
  layers.push({ ...l, layer });
});

function syncMapZIndex() { layers.forEach(l => { if (map.hasLayer(l.layer) && l.layer.bringToFront) l.layer.bringToFront(); }); }

function moveLayer(index, direction) {
  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= layers.length) return;
  const temp = layers[index]; layers[index] = layers[targetIndex]; layers[targetIndex] = temp;
  renderUI(); syncMapZIndex();
}

function renderUI() {
  const ld = document.getElementById("layers"); const lg = document.getElementById("legend");
  ld.innerHTML = ""; lg.innerHTML = "";
  for (let i = layers.length - 1; i >= 0; i--) {
    const l = layers[i];
    const d = document.createElement("div"); d.className = "layer-node";
    d.innerHTML = \`<div class="layer-left"><input type="checkbox" \${map.hasLayer(l.layer) ? "checked" : ""} style="accent-color:var(--accent);" /><span class="layer-title">\${l.name}</span></div>\`;
    d.querySelector("input").onchange = (e) => { if (e.target.checked) map.addLayer(l.layer); else map.removeLayer(l.layer); syncMapZIndex(); renderUI(); };
    ld.appendChild(d);
    if (!map.hasLayer(l.layer)) continue;
    const legTitle = document.createElement("div"); legTitle.className = "legend-item"; legTitle.innerText = l.name; lg.appendChild(legTitle);
    if (l.showLegend === false) { /* skip legend for this layer */ }
    else if (l.symbologyType === 'single') {
      const sub = document.createElement("div"); sub.className = "legend-subitem";
      if (layerDataHasPoints(l)) {
        const symHtml = buildExportedPointSymbolHtml(l.pointSymbolType || 'circle', l.color, getExportedPointStrokeColor(l), 9, l.pointStrokeWidth ?? 2);
        const symWrap = document.createElement('span');
        symWrap.style.cssText = 'display:inline-flex;width:18px;height:18px;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;';
        symWrap.innerHTML = symHtml;
        const text = document.createElement('span'); text.textContent = ' All features';
        sub.appendChild(symWrap); sub.appendChild(text); lg.appendChild(sub);
      } else {
        const swatch = document.createElement('span'); swatch.style.cssText = 'background:' + l.color + ';width:12px;height:12px;display:inline-block;border-radius:3px;flex-shrink:0;';
        const text = document.createElement('span'); text.textContent = ' All features';
        sub.appendChild(swatch); sub.appendChild(text); lg.appendChild(sub);
      }
    } else if (l.symbologyType === 'categorized' && l.symbologyField) {
      var hiddenKeys = l.hiddenCatKeys || [];
      getOrderedCategoryKeys(l).forEach(function(k) {
        if (hiddenKeys.indexOf(k) !== -1) return;
        const sub = document.createElement("div"); sub.className = "legend-subitem";
        const swatch = document.createElement('span'); swatch.style.cssText = 'background:' + l.categories[k] + ';width:12px;height:12px;display:inline-block;border-radius:3px;flex-shrink:0;';
        const labelSpan = document.createElement('span'); labelSpan.textContent = getCategoryDisplayLabel(l, k);
        labelSpan.style.cssText = 'display:inline-block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
        labelSpan.addEventListener('dblclick', () => {
          const input = document.createElement('input'); input.type = 'text'; input.value = labelSpan.textContent;
          input.className = 'cat-label-input'; input.style.cssText = 'font-size:12px;padding:6px 8px;border:1px solid var(--accent);border-radius:3px;background:var(--bg-primary);color:var(--text-primary);width:100%;outline:none;box-sizing:border-box;';
          const finish = (save) => {
            if (save && input.value.trim()) { if (!l.customCategoryLabels) l.customCategoryLabels = {}; l.customCategoryLabels[k] = input.value.trim(); renderUI(); }
            else if (save && !input.value.trim() && l.customCategoryLabels?.[k]) { delete l.customCategoryLabels[k]; renderUI(); }
            else { labelSpan.style.display = ''; }
            input.remove();
          };
          input.addEventListener('blur', () => finish(true)); input.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') finish(true); if (ev.key === 'Escape') finish(false); });
          labelSpan.style.display = 'none'; labelSpan.parentNode.insertBefore(input, labelSpan); input.focus(); input.select();
        });
        sub.appendChild(swatch); sub.appendChild(labelSpan);
        lg.appendChild(sub);
      });
    }
  }
}

renderUI();
syncMapZIndex();

const MapSearchControl = L.Control.extend({
  options: { position: 'topright' },
  onAdd: function(map) {
    const c = L.DomUtil.create('div', 'leaflet-bar map-search-control');
    const inner = L.DomUtil.create('div', 'map-search-inner', c);
    inner.innerHTML = '<input type="text" id="mapSearchBox" placeholder="Search places\u2026" />' +
      '<button type="button" id="mapSearchBtn" aria-label="Search"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></button>' +
      '<button type="button" id="mapToggleMode" class="map-mode-toggle" aria-label="Toggle pin mode" title="Switch to pin coordinates"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg></button>';
    const dd = L.DomUtil.create('div', 'map-search-dropdown', c);
    L.DomEvent.disableClickPropagation(c);
    const inp = inner.querySelector('input'); const btn = inner.querySelector('#mapSearchBtn'); const tog = inner.querySelector('#mapToggleMode');
    var sm = exportedData.searchMode || 'both';
    if (sm === 'off') { c.style.display = 'none'; }
    let isPin = sm === 'pin';
    if (isPin && tog) tog.style.display = 'none';
    function setMode(pin) {
      isPin = pin;
      if (pin) {
        inp.placeholder = 'lat, lon (e.g. 43.86, -79.29)';
        btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>';
        dd.innerHTML = '<div class="map-pin-hint">Enter coordinates as <b>lat, lon</b>, then press Enter or click the pin button.</div>'; dd.style.display = 'block';
      } else {
        inp.placeholder = 'Search places\u2026';
        btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';
        dd.innerHTML = ''; dd.style.display = '';
      }
      inp.value = '';
    }
    if (isPin) setMode(true);
    tog.addEventListener('click', () => setMode(!isPin));
    function doAction() {
      if (isPin) {
        const parts = inp.value.split(',').map(function(s) { return s.trim(); });
        if (parts.length === 2) {
          const lat = parseFloat(parts[0]), lon = parseFloat(parts[1]);
          if (!isNaN(lat) && !isNaN(lon)) {
            map.setView([lat, lon], 14);
            if (searchMarker) map.removeLayer(searchMarker);
            searchMarker = L.marker([lat, lon]).addTo(map).bindPopup(lat + ', ' + lon).openPopup();
            dd.innerHTML = '<div class="map-pin-hint">\uD83D\uDCCD Pin placed at <b>' + lat + ', ' + lon + '</b></div>';
            return;
          }
        }
        dd.innerHTML = '<div class="map-pin-hint" style="color:#ef5350;">Invalid format. Use: <b>lat, lon</b> (e.g. 43.86, -79.29)</div>';
      } else {
        const q = inp.value.trim();
        if (q.length < 3) return;
        fetch('https://nominatim.openstreetmap.org/search?format=json&q=' + encodeURIComponent(q) + '&limit=5&countrycodes=ca')
          .then(function(r) { return r.json(); }).then(function(data) {
            dd.innerHTML = '';
            data.forEach(function(r) {
              var d = document.createElement('div'); d.textContent = r.display_name;
              d.addEventListener('click', function() {
                var lat = parseFloat(r.lat), lon = parseFloat(r.lon);
                map.setView([lat, lon], 14);
                if (searchMarker) map.removeLayer(searchMarker);
                searchMarker = L.marker([lat, lon]).addTo(map).bindPopup(r.display_name).openPopup();
                dd.innerHTML = ''; inp.value = r.display_name;
              });
              dd.appendChild(d);
            });
          }).catch(function() {});
      }
    }
    inp.addEventListener('keydown', function(e) { if (e.key === 'Enter') doAction(); });
    btn.addEventListener('click', doAction);
    return c;
  }
});
new MapSearchControl().addTo(map);
(function() {
  var btn = document.getElementById('infoBtn');
  var panel = document.getElementById('infoPanel');
  if (!btn || !panel) return;
  if (window.L && L.DomEvent) { L.DomEvent.disableClickPropagation(btn); L.DomEvent.disableClickPropagation(panel); L.DomEvent.disableScrollPropagation(panel); }
  btn.addEventListener('click', function(e) { if (e) e.stopPropagation(); var dp = document.getElementById('dirPanel'); if (dp) dp.classList.add('hidden'); panel.classList.toggle('hidden'); });
  var close = document.getElementById('infoClose');
  if (close) close.addEventListener('click', function() { panel.classList.add('hidden'); });
})();
${currentBasemap === 'none' || currentBasemap === 'local' ? '' : `
(function() {
  var bmName = ${JSON.stringify({dark:'Dark', light:'Light', streets:'Streets', bright:'Bright', satellite:'Satellite'}[currentBasemap] || currentBasemap)};
  var c = document.createElement('div');
  c.id = '_bm_toggle';
  c.style.cssText = 'position:absolute;bottom:30px;right:10px;z-index:1000;display:flex;gap:4px;background:#1e293b;border:1px solid #334155;border-radius:8px;padding:3px;box-shadow:0 4px 16px rgba(0,0,0,0.45);font-family:system-ui,sans-serif;';
  var r = document.createElement('button');
  r.id = '_bm_remote_btn';
  r.type = 'button';
  r.textContent = bmName;
  r.style.cssText = 'border:0;background:transparent;color:#e2e8f0;font-size:12px;font-weight:600;padding:6px 10px;border-radius:6px;cursor:pointer;';
  var l = document.createElement('button');
  l.id = '_bm_local_btn';
  l.type = 'button';
  l.textContent = 'Local';
  l.style.cssText = 'border:0;background:transparent;color:#e2e8f0;font-size:12px;font-weight:600;padding:6px 10px;border-radius:6px;cursor:pointer;';
  r.addEventListener('click', function() { showBasemap('remote'); });
  l.addEventListener('click', function() { showBasemap('local'); });
  c.appendChild(r); c.appendChild(l);
  document.getElementById('map').appendChild(c);
  updateBasemapUI();
})();
`}
(function() {
  var dbtn = document.getElementById('dirBtn');
  var dpanel = document.getElementById('dirPanel');
  if (dbtn && dpanel) {
    if (window.L && L.DomEvent) { L.DomEvent.disableClickPropagation(dbtn); L.DomEvent.disableClickPropagation(dpanel); L.DomEvent.disableScrollPropagation(dpanel); }
    dbtn.addEventListener('click', function(e) {
      if (e) e.stopPropagation();
      var ip = document.getElementById('infoPanel');
      if (ip) ip.classList.add('hidden');
      dpanel.classList.toggle('hidden');
    });
    var dclose = document.getElementById('dirClose');
    if (dclose) dclose.addEventListener('click', function() { dpanel.classList.add('hidden'); });
  }
  var dir = ${JSON.stringify(directoryPeople).replace(/<\//g, '<\\/')};
  var dirCfg = ${JSON.stringify(directoryCfg)};
  var listEl = document.getElementById('dirList');
  var searchEl = document.getElementById('dirSearch');
  if (!listEl || !dir || !dir.length || !dirCfg) return;
  var dirKeyField = dirCfg.zoomKeyField || 'WardLabel';
  function dirKeyOf(feature) {
    var v = feature && feature.properties && feature.properties[dirKeyField];
    return (v === null || v === undefined || v === '') ? null : String(v);
  }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function nl2br(s) { return esc(s).replace(/\\n/g, '<br/>'); }
  function wardWrapper() {
    if (dirCfg.zoomLayerId) {
      var byId = layers.find(function(x) { return x.id === dirCfg.zoomLayerId; });
      if (byId) return byId;
    }
    for (var i = 0; i < layers.length; i++) {
      var feats = (layers[i].geojson && layers[i].geojson.features) || [];
      for (var j = 0; j < feats.length; j++) {
        if (dirKeyOf(feats[j])) return layers[i];
      }
    }
    return null;
  }
  var wardLayer = wardWrapper();
  var wardFilterLabels = null;
  function personVisible(person) {
    if (!wardFilterLabels) return true;
    var wards = person.wards || [];
    for (var i = 0; i < wards.length; i++) if (wardFilterLabels.indexOf(wards[i]) !== -1) return true;
    return false;
  }
  function updateFilterBanner() {
    var banner = document.getElementById('dirFilterBanner');
    if (!banner) return;
    if (wardFilterLabels && wardFilterLabels.length) {
      banner.style.display = 'flex';
      var t = document.getElementById('dirFilterText');
      if (t) t.textContent = 'Showing: ' + wardFilterLabels.join(', ');
    } else {
      banner.style.display = 'none';
    }
  }
  function syncFilterFromSelection() {
    var labels = [];
    if (wardLayer) {
      var sel = selectedFeatures[wardLayer.name];
      var feats = (wardLayer.geojson && wardLayer.geojson.features) || [];
      if (sel) sel.forEach(function(idx) {
        var wl = dirKeyOf(feats[idx]);
        if (wl && labels.indexOf(wl) === -1) labels.push(wl);
      });
    }
    wardFilterLabels = labels.length ? labels : null;
    render(searchEl ? searchEl.value : '');
    updateFilterBanner();
    if (wardFilterLabels && dpanel && dpanel.classList.contains('hidden')) {
      var ip = document.getElementById('infoPanel');
      if (ip) ip.classList.add('hidden');
      dpanel.classList.remove('hidden');
    }
  }
  directoryWardFilterHandler = syncFilterFromSelection;
  function selectPersonWards(person) {
    if (!wardLayer) return;
    if (!map.hasLayer(wardLayer.layer)) { wardLayer.layer.addTo(map); renderUI(); }
    clearExportedSelection();
    var feats = (wardLayer.geojson && wardLayer.geojson.features) || [];
    var sel = new Set();
    feats.forEach(function(ft, idx) {
      var wl = dirKeyOf(ft);
      if (wl && (person.wards || []).indexOf(wl) !== -1) sel.add(idx);
    });
    selectedFeatures[wardLayer.name] = sel;
    updateExportedLayerStyles(wardLayer);
    var bounds = null, first = null;
    wardLayer.layer.eachLayer(function(ll) {
      var wl = dirKeyOf(ll.feature);
      if (wl && (person.wards || []).indexOf(wl) !== -1) {
        if (!first) first = ll;
        var b = ll.getBounds();
        bounds = bounds ? bounds.extend(b) : L.latLngBounds(b);
      }
    });
    if (bounds) map.fitBounds(bounds.pad(0.15));
    if (first) setTimeout(function() { first.openPopup(); }, 350);
    if (searchEl) searchEl.value = '';
    syncFilterFromSelection();
  }
  function section(label, val) {
    if (!val) return '';
    return '<div class="dir-sec"><span class="dir-sec-label">' + esc(label) + '</span>' + nl2br(val) + '</div>';
  }
  function dirSubtitle(person) {
    var wards = (person.wards || []).join(', ');
    if (dirCfg.subtitleStyle === 'mayor') {
      if (person.role === 'Mayor') return 'Mayor of ' + person.municipality;
      return person.municipality + ' - ' + wards;
    }
    return [person.role, person.municipality, wards].filter(function(s) { return s; }).join(' · ');
  }
  function render(filter) {
    listEl.innerHTML = '';
    var q = (filter || '').toLowerCase();
    var shown = 0;
    dir.forEach(function(person) {
      if (!personVisible(person)) return;
      var hay = (person.name + ' ' + person.role + ' ' + person.municipality + ' ' + (person.wards || []).join(' ')).toLowerCase();
      if (q && hay.indexOf(q) === -1) return;
      shown++;
      var item = document.createElement('div');
      item.className = 'dir-item';
      var sub = dirSubtitle(person);
      var detailHtml = '';
      (person.details || []).forEach(function(pair) {
        detailHtml += section(pair[0], pair[1]);
      });
      item.innerHTML = '<div class="dir-head"><div class="dir-name">' + esc(person.name) + '</div>' +
        '<div class="dir-sub">' + esc(sub) + '</div></div>' +
        '<div class="dir-detail">' + detailHtml +
        '<button type="button" class="dir-zoom">Show ' + esc(dirCfg.areaWord || 'areas') + ' on map</button></div>';
      item.querySelector('.dir-head').addEventListener('click', function() { item.classList.toggle('open'); });
      var zb = item.querySelector('.dir-zoom');
      zb.addEventListener('click', function(e) { if (e) e.stopPropagation(); selectPersonWards(person); });
      listEl.appendChild(item);
    });
    if (!shown) {
      var d = document.createElement('div');
      d.className = 'dir-empty';
      d.textContent = 'No matches.';
      listEl.appendChild(d);
    }
  }
  if (searchEl) searchEl.addEventListener('input', function() { render(searchEl.value); });
  var bannerClear = document.getElementById('dirFilterClear');
  if (bannerClear) bannerClear.addEventListener('click', function() {
    clearExportedSelection();
    if (wardLayer) updateExportedLayerStyles(wardLayer);
    map.closePopup();
    if (searchEl) searchEl.value = '';
    syncFilterFromSelection();
  });
  render('');
  updateFilterBanner();
})();

</script>
</body>
</html>`;
}
