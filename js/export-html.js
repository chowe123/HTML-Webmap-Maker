function generateHTML(data) {
  const pageTitle = escapeHtml(data.title || 'Interactive Map');
  const headerTitle = escapeHtml(data.title || 'Interactive Map Maker');
  const dataNoteHtml = data.dataNote
    ? `<div class="card data-note-card"><div class="card-title">Data Note</div><p class="data-note-text">${escapeHtml(data.dataNote).replace(/\n/g, '<br>')}</p></div>`
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
  #map { flex: 1; height: 100vh; background-color: #0b0f19 !important; position: relative; }
  .leaflet-popup-content-wrapper { background: rgba(15,23,42,0.95) !important; color:#fff !important; border:1px solid var(--border-color); }
  .gis-point-symbol-icon, .gis-custom-point-icon { background: transparent !important; border: none !important; }
  .gis-point-symbol-icon svg { display: block; }
  .layer-label { background: none !important; border: none !important; box-shadow: none !important; font-weight: bold; padding: 1px 3px !important; line-height: 1.2 !important; white-space: nowrap; }
</style>
</head>
<body>

<div id="sidebar">
  <div class="sidebar-header">
    <div class="logo-title">${headerTitle}</div>
  </div>
  <div class="sidebar-content">
    ${dataNoteHtml}
    <div class="card">
      <div class="card-title">Layers</div>
      <div id="layers" style="display:flex; flex-direction:column; gap:8px;"></div>
    </div>
    <div class="card">
      <div class="card-title">Legend</div>
      <div id="legend" style="padding-bottom: 16px;"></div>
    </div>
  </div>
</div>

<div id="map"></div>

<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script src="https://unpkg.com/maplibre-gl/dist/maplibre-gl.js"></script>
<script src="https://unpkg.com/@maplibre/maplibre-gl-leaflet/leaflet-maplibre-gl.js"></script>
<script src="https://cdn.jsdelivr.net/npm/sql.js@1.10.3/dist/sql-wasm.js"></script>
<script>
const exportedData = ${JSON.stringify(data)};
const mv = exportedData.mapView || { lat: 43.7, lng: -79.4, zoom: 10 };
const map = L.map('map', { renderer: L.canvas() }).setView([mv.lat, mv.lng], mv.zoom);

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
      layer.addTo(map);
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
var exBasemap = exportedData.basemap || 'none';
if (exBasemap === 'local') {
  if (exportedData.mbtilesFilename) tryLoadMBTiles(exportedData.mbtilesFilename);
} else if (exBasemap !== 'none') {
${currentBasemap === 'none' || currentBasemap === 'local' ? '' : `
var bmCfg = { type: '${BASEMAPS[currentBasemap].type}', url: '${BASEMAPS[currentBasemap].url}', attribution: '${BASEMAPS[currentBasemap].attribution}' };
if (bmCfg.type === 'vector') {
  L.maplibreGL({ style: bmCfg.url, attribution: bmCfg.attribution }).addTo(map);
} else {
  L.tileLayer(bmCfg.url, { attribution: bmCfg.attribution }).addTo(map);
}
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
  const title = escapeExportedHtml(titleRaw ? replaceExportedPopupTokens(titleRaw, feature, layerConfig) : layerConfig.name);
  const template = layerConfig.popupTemplate && layerConfig.popupTemplate.trim();
  if (template) {
    const body = template.split('\\n').map(function(line) { return escapeExportedHtml(replaceExportedPopupTokens(line, feature, layerConfig)); }).join('<br/>');
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
map.on('click', function() { clearExportedSelection(); });
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
        updateExportedLayerStyles(l);
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
    d.querySelector("input").onchange = (e) => { if (e.target.checked) map.addLayer(l.layer); else map.removeLayer(l.layer); syncMapZIndex(); };
    ld.appendChild(d);
    const legTitle = document.createElement("div"); legTitle.className = "legend-item"; legTitle.innerText = l.name; lg.appendChild(legTitle);
    if (l.showLegend === false) { /* skip legend for this layer */ }
    else if (l.symbologyType === 'single') {
      const sub = document.createElement("div"); sub.className = "legend-subitem";
      const swatch = document.createElement('span'); swatch.style.cssText = 'background:' + l.color + ';width:12px;height:12px;display:inline-block;border-radius:3px;flex-shrink:0;';
      const text = document.createElement('span'); text.textContent = ' All features';
      sub.appendChild(swatch); sub.appendChild(text); lg.appendChild(sub);
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
</script>
</body>
</html>`;
}
