function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Rich text for custom popup titles/templates. Supports **bold**, *italic* and
// __underline__ markup. {field} tokens are substituted AFTER formatting via
// placeholders, so underscores/asterisks inside attribute values or field
// names can never be mistaken for markup. Values are HTML-escaped on insert.
function renderPopupRichText(raw, feature, layer) {
  if (!raw) return '';
  const props = (feature && feature.properties) || {};
  const layerName = (layer && layer.name) || '';
  const PH = '\u0001';
  const keys = [];
  let s = escapeHtml(String(raw)).replace(/\{([^}]+)\}/g, function(match, key) {
    keys.push(key.trim());
    return PH + (keys.length - 1) + PH;
  });
  s = s
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/__(.+?)__/g, '<u>$1</u>')
    .replace(/\*(.+?)\*/g, '<i>$1</i>');
  s = s.replace(/\u0001(\d+)\u0001/g, function(match, idx) {
    const key = keys[parseInt(idx, 10)];
    if (key === 'layerName') return escapeHtml(layerName);
    if (Object.prototype.hasOwnProperty.call(props, key)) {
      const v = props[key];
      return v === null || v === undefined ? '' : escapeHtml(String(v));
    }
    return '{' + escapeHtml(key) + '}';
  });
  return s;
}

// Inserts a full-width "Maki icons" section header into a symbol picker grid
// when the Maki library is registered. No-op if there are no Maki shapes.
function appendMakiGridHeader(shapeGrid) {
  if (!shapeGrid || typeof SYMBOL_SHAPES === 'undefined') return;
  const hasMaki = SYMBOL_SHAPES.some(function(sh) { return sh.group === 'maki'; });
  if (!hasMaki) return;
  const h = document.createElement('div');
  h.textContent = 'Maki icons';
  h.style.cssText = 'grid-column:1/-1;font-size:10px;font-weight:600;color:var(--text-muted,#64748b);text-transform:uppercase;letter-spacing:0.5px;margin-top:8px;';
  shapeGrid.appendChild(h);
}

function compareCategoryKeys(a, b) {
  const labelA = a === '' ? '\uffff' : String(a);
  const labelB = b === '' ? '\uffff' : String(b);
  return labelA.localeCompare(labelB, undefined, { sensitivity: 'base', numeric: true });
}

function getCategorySortValue(layer, key) {
  const interval = (layer.intervals || []).find(i => i.key === key);
  if (interval) return interval.classIndex ?? interval.min ?? 0;
  const num = parseFloat(key);
  return isNaN(num) ? Infinity : num;
}

function sortCategoryKeys(keys, mode, layer) {
  if (mode === 'numeric-asc' || mode === 'numeric-desc') {
    const sorted = [...keys].sort((a, b) => getCategorySortValue(layer, a) - getCategorySortValue(layer, b));
    if (mode === 'numeric-desc') sorted.reverse();
    return sorted;
  }
  const sorted = [...keys].sort(compareCategoryKeys);
  if (mode === 'desc') sorted.reverse();
  return sorted;
}

function formatNumber(value) {
  if (Number.isInteger(value)) return String(value);
  const rounded = Math.round(value * 1000) / 1000;
  return String(rounded);
}

function getLayerFeatures(geojson) {
  return geojson.features || (geojson.type === 'Feature' ? [geojson] : []);
}

function getLayerGeometryTypes(geojson) {
  const types = new Set();
  getLayerFeatures(geojson).forEach(f => {
    const t = f.geometry?.type;
    if (!t) return;
    if (t === 'Point' || t === 'MultiPoint') types.add('point');
    else if (t === 'LineString' || t === 'MultiLineString') types.add('line');
    else types.add('polygon');
  });
  return types;
}

function layerHasPoints(layerOrGeojson) {
  const geojson = layerOrGeojson.geojson || layerOrGeojson;
  return getLayerGeometryTypes(geojson).has('point');
}

function layerHasLinesOrPolygons(layer) {
  const types = layer.geometryTypes || getLayerGeometryTypes(layer.geojson);
  return types.has('line') || types.has('polygon');
}

function layerIsPointOnly(layer) {
  const types = layer.geometryTypes || getLayerGeometryTypes(layer.geojson);
  return types.size === 1 && types.has('point');
}

function getPointStrokeColor(layerObj) {
  return layerObj.pointStrokeColor ?? layerObj.strokeColor ?? '#ffffff';
}

function parsePointStrokeWidth(value) {
  const n = parseFloat(value);
  if (isNaN(n) || n < 0) return 0;
  return Math.min(20, n);
}

function getNumericValues(layer, field) {
  const values = [];
  getLayerFeatures(layer.geojson).forEach(f => {
    if (!f.properties || f.properties[field] === undefined || f.properties[field] === null || f.properties[field] === '') return;
    const num = Number(f.properties[field]);
    if (!isNaN(num) && isFinite(num)) values.push(num);
  });
  return values;
}

function fieldHasNumericValues(layer, field) {
  return getNumericValues(layer, field).length > 0;
}

function extractFields(geojson) {
  const fields = new Set();
  const features = geojson.features || (geojson.type === 'Feature' ? [geojson] : []);
  features.forEach(f => {
    if (f.properties) Object.keys(f.properties).forEach(k => fields.add(k));
  });
  return Array.from(fields);
}

function hexToRgb(hex) {
  return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
}

function interpolateColors(stops, count) {
  if (count <= 0) return [];
  if (count === 1) return [stops[0]];
  if (stops.length === 1) return Array(count).fill(stops[0]);
  const parsed = stops.map(hexToRgb);
  const segs = parsed.length - 1;
  const out = [];
  for (let i = 0; i < count; i++) {
    const t = (i / (count - 1)) * segs;
    const seg = Math.min(Math.floor(t), segs - 1);
    const st = t - seg;
    const [r1, g1, b1] = parsed[seg];
    const [r2, g2, b2] = parsed[seg + 1];
    out.push(rgbToHex(r1 + (r2 - r1) * st, g1 + (g2 - g1) * st, b1 + (b2 - b1) * st));
  }
  return out;
}

function getRampGradient(stops) {
  return `linear-gradient(to right, ${stops.join(', ')})`;
}

function getRandomColor() {
  const letters = '0123456789ABCDEF';
  let color = '#';
  for (let i = 0; i < 6; i++) color += letters[Math.floor(Math.random() * 16)];
  return color;
}
