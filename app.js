// =========================
// MAP INIT
// =========================

const BASEMAPS = {
  none: {
    type: 'none',
    url: '',
    attribution: ''
  },
  dark: {
    type: 'vector',
    url: 'https://tiles.openfreemap.org/styles/dark',
    attribution: 'OpenFreeMap &copy; OpenMapTiles Data from OpenStreetMap'
  },
  light: {
    type: 'vector',
    url: 'https://tiles.openfreemap.org/styles/positron',
    attribution: 'OpenFreeMap &copy; OpenMapTiles Data from OpenStreetMap'
  },
  streets: {
    type: 'vector',
    url: 'https://tiles.openfreemap.org/styles/liberty',
    attribution: 'OpenFreeMap &copy; OpenMapTiles Data from OpenStreetMap'
  },
  bright: {
    type: 'vector',
    url: 'https://tiles.openfreemap.org/styles/bright',
    attribution: 'OpenFreeMap &copy; OpenMapTiles Data from OpenStreetMap'
  },
  satellite: {
    type: 'raster',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri, Maxar, Earthstar Geographics'
  }
};

let currentBasemap = 'none';
let tileLayer = null;

const map = L.map('map').setView([43.7, -79.4], 10);

function setBasemap(name) {
  const config = BASEMAPS[name];
  if (!config) return;
  if (tileLayer) { map.removeLayer(tileLayer); tileLayer = null; }
  if (name === 'none') { currentBasemap = name; return; }
  if (config.type === 'vector') {
    tileLayer = L.maplibreGL({
      style: config.url,
      attribution: config.attribution
    }).addTo(map);
  } else {
    tileLayer = L.tileLayer(config.url, { attribution: config.attribution }).addTo(map);
  }
  currentBasemap = name;
}

setBasemap('none');

// =========================
// STATE
// =========================

let layerStore = [];
let layerCounter = 0;
let projectTitle = '';
let dataNote = '';

let searchMarker = null;
let debounceTimer = null;
let searchMode = 'pin';

const PROJECT_VERSION = 1;

// =========================
// HELPERS
// =========================

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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

function isPointFeature(feature) {
  const t = feature?.geometry?.type;
  return t === 'Point' || t === 'MultiPoint';
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

function jenksClassMaxima(data, numClasses) {
  const sorted = [...data].sort((a, b) => a - b);
  const m = sorted.length;
  const k = Math.min(Math.max(1, numClasses), m);
  if (m === 0) return [];
  if (k === 1) return [sorted[m - 1]];

  const mat1 = Array.from({ length: m + 1 }, () => Array(k + 1).fill(0));
  const mat2 = Array.from({ length: m + 1 }, () => Array(k + 1).fill(0));

  for (let i = 1; i <= k; i++) {
    mat1[0][i] = 1;
    mat2[0][i] = 0;
    if (i === 1) continue;
    for (let j = 1; j <= m; j++) mat1[j][i] = Infinity;
  }

  for (let l = 2; l <= m; l++) {
    let s1 = 0;
    let s2 = 0;
    let w = 0;
    for (let mIdx = 1; mIdx <= l; mIdx++) {
      const i3 = l - mIdx + 1;
      const val = sorted[i3 - 1];
      s2 += val * val;
      s1 += val;
      w += 1;
      const variance = s2 - (s1 * s1) / w;
      const i4 = i3 - 1;
      if (i4 !== 0) {
        for (let j = 2; j <= k; j++) {
          if (mat1[l][j] >= variance + mat1[i4][j - 1]) {
            mat1[l][j] = variance + mat1[i4][j - 1];
            mat2[l][j] = i4;
          }
        }
      }
    }
    mat1[l][1] = s2 - (s1 * s1) / w;
    mat2[l][1] = 0;
  }

  const breaks = new Array(k);
  let kclass = k;
  let countNum = m - 1;
  breaks[k - 1] = sorted[countNum];

  while (kclass > 1) {
    const idx = mat2[countNum + 1][kclass - 1];
    breaks[kclass - 2] = sorted[idx];
    countNum = idx;
    kclass -= 1;
  }

  return breaks;
}

function normalizeClassCount(count) {
  return Math.min(12, Math.max(2, count || 5));
}

function ensureClassLimits(layer) {
  layer.classCount = normalizeClassCount(layer.classCount);
  if (!Array.isArray(layer.classLimits)) layer.classLimits = [];
  while (layer.classLimits.length < layer.classCount) layer.classLimits.push(null);
  layer.classLimits.length = layer.classCount;
}

function defaultClassLimitsFromData(values, classCount) {
  const sorted = [...values].sort((a, b) => a - b);
  const n = normalizeClassCount(classCount);
  const limits = [];
  for (let i = 0; i < n; i++) {
    if (i === n - 1) {
      limits.push(null);
    } else {
      const p = (i + 1) / n;
      const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
      limits.push(sorted[idx]);
    }
  }
  return limits;
}

function jenksClassLimits(values, classCount) {
  const n = normalizeClassCount(classCount);
  const maxima = jenksClassMaxima(values, n);
  const limits = [];
  for (let i = 0; i < n; i++) {
    limits.push(i < n - 1 ? maxima[i] : null);
  }
  return dedupeClassLimits(limits);
}

function dedupeClassLimits(limits) {
  const out = [];
  let lastFinite = -Infinity;
  for (let i = 0; i < limits.length; i++) {
    const upper = limits[i];
    if (upper === null || upper === '' || !isFinite(Number(upper))) {
      out.push(null);
      break;
    }
    const n = Number(upper);
    if (n > lastFinite) {
      out.push(n);
      lastFinite = n;
    }
  }
  if (!out.length) return [null, null];
  if (out[out.length - 1] !== null) out.push(null);
  return out.length >= 2 ? out : [null, null];
}

function buildClassesFromLimits(limits) {
  const intervals = [];
  for (let i = 0; i < limits.length; i++) {
    const upper = limits[i];
    const hasUpper = upper !== null && upper !== '' && isFinite(Number(upper));
    const upperN = hasUpper ? Number(upper) : null;
    const prev = i > 0 ? limits[i - 1] : null;
    const hasPrev = prev !== null && prev !== '' && isFinite(Number(prev));
    const prevN = hasPrev ? Number(prev) : null;

    let label;
    if (i === 0 && hasUpper) {
      label = `≤ ${formatNumber(upperN)}`;
    } else if (!hasUpper && hasPrev) {
      label = `> ${formatNumber(prevN)}`;
    } else if (hasUpper && hasPrev) {
      label = `> ${formatNumber(prevN)}, ≤ ${formatNumber(upperN)}`;
    } else if (hasUpper) {
      label = `≤ ${formatNumber(upperN)}`;
    } else {
      label = `Class ${i + 1}`;
    }

    intervals.push({
      key: `class_${i}`,
      label,
      classIndex: i,
      upper: upperN,
      lower: prevN
    });
  }
  return intervals;
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

function migrateLegacyBreaks(layer) {
  if (Array.isArray(layer.classLimits) && layer.classLimits.length) return;
  if (Array.isArray(layer.manualBreaks) && layer.manualBreaks.length) {
    const n = normalizeClassCount(layer.classCount || layer.manualBreaks.length + 1);
    layer.classCount = n;
    layer.classLimits = [];
    for (let i = 0; i < n; i++) {
      layer.classLimits.push(i < layer.manualBreaks.length ? layer.manualBreaks[i] : null);
    }
    return;
  }
  ensureClassLimits(layer);
}

function getCategoryKeyForValue(layer, rawValue) {
  const method = layer.classifyMethod || 'unique';
  if (method === 'unique' || !layer.symbologyField) {
    if (rawValue === null || rawValue === undefined) return '__null__';
    return String(rawValue);
  }

  const num = Number(rawValue);
  if (isNaN(num) || !isFinite(num)) return '__non_numeric__';

  const limits = layer.classLimits || [];
  if (!limits.length) return '__outlier__';

  const classIndex = classifyValueByLimits(num, limits);
  return `class_${classIndex}`;
}

function getCategoryDisplayLabel(layer, key) {
  if (layer.customCategoryLabels?.[key]) return layer.customCategoryLabels[key];
  const interval = (layer.intervals || []).find(i => i.key === key);
  if (interval) return interval.label;
  if (key === '__null__') return '[No value]';
  if (key === '__non_numeric__') return '[Non-numeric]';
  if (key === '__outlier__') return '[Out of range]';
  return key || '[Empty]';
}

// =========================
// COLOR RAMPS
// =========================

const COLOR_RAMPS = {
  'white-red':       { name: 'White to Red',      stops: ['#ffffff', '#ef5350'] },
  'lightred-darkred':{ name: 'Light→Dark Red',    stops: ['#ffcdd2', '#e53935', '#b71c1c'] },
  'red-green':       { name: 'Red→Green',         stops: ['#d32f2f', '#f5f5f5', '#388e3c'] },
  'blue-red':        { name: 'Blue→Red',          stops: ['#1565c0', '#f5f5f5', '#c62828'] },
  'blue-green':      { name: 'Blue→Green',        stops: ['#1565c0', '#43a047'] },
  'yellow-orange-red':{name:'Yellow→Orange→Red',  stops: ['#fff9c4', '#ff9800', '#d32f2f'] },
  'lightblue-darkblue':{name:'Light→Dark Blue',   stops: ['#bbdefb', '#1565c0'] },
  'green-blue-purple':{ name:'Green→Blue→Purple', stops: ['#66bb6a', '#42a5f5', '#7e57c2'] },
  'grey-black':      { name: 'Grey to Black',     stops: ['#bdbdbd', '#212121'] },
  'purple-orange':   { name: 'Purple→Orange',     stops: ['#7b1fa2', '#f5f5f5', '#e65100'] },
};

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

function assignCategoryColors(layer, keys) {
  const ramp = COLOR_RAMPS[layer.colorRamp];
  const categories = {};
  if (ramp && keys.length > 0) {
    const stops = layer.colorRampReversed ? [...ramp.stops].reverse() : ramp.stops;
    const colors = interpolateColors(stops, keys.length);
    keys.forEach((key, i) => { categories[key] = colors[i]; });
  } else {
    const prev = layer.categories || {};
    keys.forEach((key) => { categories[key] = prev[key] || getRandomColor(); });
  }
  layer.categories = categories;
}

function applyLayerClassification(layer) {
  const field = layer.symbologyField;
  if (!field) return;

  const method = layer.classifyMethod || 'unique';
  const prevColors = { ...layer.categories };
  layer.categorySymbols = {};

  if (method === 'unique') {
    layer.intervals = [];
    const keys = new Set();
    getLayerFeatures(layer.geojson).forEach(f => {
      if (f.properties && f.properties[field] !== undefined && f.properties[field] !== null) {
        keys.add(String(f.properties[field]));
      }
    });
    const keyList = [...keys];
    assignCategoryColors(layer, keyList);
    layer.categoryOrder = sortCategoryKeys(keyList, 'asc', layer);
    return;
  }

  const values = getNumericValues(layer, field);
  if (values.length === 0) {
    layer.intervals = [];
    layer.classLimits = [];
    layer.categories = { __non_numeric__: prevColors.__non_numeric__ || '#64748b' };
    layer.categoryOrder = ['__non_numeric__'];
    return;
  }

  migrateLegacyBreaks(layer);
  ensureClassLimits(layer);

  if (method === 'natural-breaks') {
    layer.classLimits = jenksClassLimits(values, layer.classCount);
  } else if (method === 'manual-intervals') {
    const hasThreshold = layer.classLimits.some(v => v !== null && v !== '' && isFinite(Number(v)));
    if (!hasThreshold) {
      layer.classLimits = defaultClassLimitsFromData(values, layer.classCount);
    }
  }

  layer.classCount = layer.classLimits.length;
  layer.intervals = buildClassesFromLimits(layer.classLimits);

  if (layer.customCategoryLabels) {
    const validKeys = new Set(layer.intervals.map(i => i.key));
    Object.keys(layer.customCategoryLabels).forEach(k => {
      if (!validKeys.has(k)) delete layer.customCategoryLabels[k];
    });
  }

  const keys = layer.intervals.map(i => i.key);
  assignCategoryColors(layer, keys);
  layer.categories.__non_numeric__ = prevColors.__non_numeric__ || '#64748b';
  layer.categoryOrder = layer.intervals.map(i => i.key);
  if (layer.categories.__non_numeric__) layer.categoryOrder.push('__non_numeric__');

  if (!['numeric-asc', 'numeric-desc'].includes(layer.categorySortMode)) {
    layer.categorySortMode = 'numeric-asc';
  }
}

function ensureCategoryOrder(layer) {
  const keys = Object.keys(layer.categories);
  if (!layer.categoryOrder) layer.categoryOrder = [];

  layer.categoryOrder = layer.categoryOrder.filter(k => keys.includes(k));
  keys.forEach(k => {
    if (!layer.categoryOrder.includes(k)) layer.categoryOrder.push(k);
  });

  if (!layer.categorySortMode) layer.categorySortMode = 'asc';
}

function getOrderedCategoryKeys(layer) {
  ensureCategoryOrder(layer);
  const keys = Object.keys(layer.categories);
  return layer.categoryOrder.filter(k => keys.includes(k));
}

function toggleCategorySort(layerId) {
  const layer = layerStore.find(l => l.id === layerId);
  if (!layer) return;

  const mode = layer.categorySortMode || 'asc';
  const isNumeric = mode === 'numeric-asc' || mode === 'numeric-desc';
  const isAsc = mode === 'asc' || mode === 'numeric-asc';

  layer.categorySortMode = isAsc
    ? (isNumeric ? 'numeric-desc' : 'desc')
    : (isNumeric ? 'numeric-asc' : 'asc');

  layer.categoryOrder = sortCategoryKeys(Object.keys(layer.categories), layer.categorySortMode, layer);
  renderUI();
}

function syncProjectMetaFromUI() {
  projectTitle = document.getElementById('projectTitle').value.trim();
  dataNote = document.getElementById('dataNote').value.trim();
}

function applyProjectMetaToUI() {
  document.getElementById('projectTitle').value = projectTitle;
  document.getElementById('dataNote').value = dataNote;
}

document.getElementById('projectTitle').addEventListener('input', syncProjectMetaFromUI);
document.getElementById('dataNote').addEventListener('input', syncProjectMetaFromUI);

// =========================
// IMPORT GEOJSON
// =========================

document.getElementById('fileInput').addEventListener('change', handleFile);

function handleFile(e) {
  const file = e.target.files[0];
  if (!file) return;

  const isZip = file.name.endsWith('.zip');

  if (isZip) {
    const reader = new FileReader();
    reader.onload = function(ev) {
      try {
        shp(ev.target.result).then(function(geojson) {
          createLayer({ name: file.name.replace(/\.zip$/,''), geojson });
        }).catch(function(err) {
          alert('Failed to parse shapefile: ' + err.message);
        });
      } catch (err) {
        alert('Failed to read shapefile: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  } else {
    const reader = new FileReader();
    reader.onload = function(ev) {
      try {
        const geojson = JSON.parse(ev.target.result);
        createLayer({ name: file.name, geojson });
      } catch (err) {
        alert('Failed to parse GeoJSON: ' + err.message);
      }
    };
    reader.readAsText(file);
  }
}

// =========================
// HELPER: EXTRACT ATTRIBUTE FIELDS
// =========================
function extractFields(geojson) {
  const fields = new Set();
  const features = geojson.features || (geojson.type === 'Feature' ? [geojson] : []);
  
  features.forEach(f => {
    if (f.properties) {
      Object.keys(f.properties).forEach(k => fields.add(k));
    }
  });
  
  return Array.from(fields);
}

// =========================
// LAYER STYLE HELPERS
// =========================

function getFeatureFillColor(layerObj, feature) {
  let fillColor = layerObj.color;
  if (layerObj.symbologyType === 'categorized' && layerObj.symbologyField) {
    const val = feature?.properties ? feature.properties[layerObj.symbologyField] : null;
    const catKey = getCategoryKeyForValue(layerObj, val);
    if (layerObj.categories[catKey]) fillColor = layerObj.categories[catKey];
  }
  return fillColor;
}

function getFeatureStyle(layerObj, feature) {
  const fillColor = getFeatureFillColor(layerObj, feature);
  const layerOpacity = layerObj.opacity ?? 0.4;
  const style = {
    color: layerObj.strokeColor ?? fillColor,
    fillColor,
    fillOpacity: layerOpacity,
    opacity: layerOpacity,
    weight: layerObj.weight
  };
  if (layerObj.noFill) style.fillOpacity = 0;
  return style;
}

function getSymbolSvgShape(type, fill, strokeAttr) {
  const f = fill || '#3b82f6';
  const s = strokeAttr || '';
  switch (type) {
    case 'square':
      return `<rect x="2" y="2" width="16" height="16" rx="2" fill="${f}"${s}/>`;
    case 'triangle':
      return `<polygon points="10,2 18,17 2,17" fill="${f}"${s} stroke-linejoin="round"/>`;
    case 'diamond':
      return `<polygon points="10,2 18,10 10,18 2,10" fill="${f}"${s} stroke-linejoin="round"/>`;
    case 'pentagon':
      return `<polygon points="10,2 17.6,7.5 14.7,16.5 5.3,16.5 2.4,7.5" fill="${f}"${s} stroke-linejoin="round"/>`;
    case 'hexagon':
      return `<polygon points="10,2 16.9,6 16.9,14 10,18 3.1,14 3.1,6" fill="${f}"${s} stroke-linejoin="round"/>`;
    case 'star':
      return `<polygon points="10,2 11.9,7.4 17.6,7.5 13.0,11.0 14.7,16.5 10,13.2 5.3,16.5 7.0,11.0 2.4,7.5 8.1,7.4" fill="${f}"${s} stroke-linejoin="round"/>`;
    case 'cross':
      return `<rect x="8" y="2" width="4" height="16" rx="1" fill="${f}"${s}/><rect x="2" y="8" width="16" height="4" rx="1" fill="${f}"${s}/>`;
    case 'crosshair':
      return `<circle cx="10" cy="10" r="7" fill="none"${s}/><line x1="10" y1="3" x2="10" y2="17" stroke="#fff" stroke-width="1.5"/><line x1="3" y1="10" x2="17" y2="10" stroke="#fff" stroke-width="1.5"/><circle cx="10" cy="10" r="3" fill="${f}"${s}/>`;
    case 'pin':
      return `<path d="M10,2 C4,2 2,6 2,10 C2,15 10,18 10,18 C10,18 18,15 18,10 C18,6 16,2 10,2Z" fill="${f}"${s} stroke-linejoin="round"/>`;
    case 'arrow':
      return `<polygon points="10,2 18,14 13,14 13,18 7,18 7,14 2,14" fill="${f}"${s} stroke-linejoin="round"/>`;
    case 'teardrop':
      return `<path d="M10,1 C10,1 18,11 18,14 C18,18.4 14.4,19 10,19 C5.6,19 2,18.4 2,14 C2,11 10,1 10,1Z" fill="${f}"${s} stroke-linejoin="round"/>`;
    case 'ring':
      return `<circle cx="10" cy="10" r="8" fill="none"${s}/><circle cx="10" cy="10" r="3" fill="${f}"${s}/>`;
    default:
      return `<circle cx="10" cy="10" r="8" fill="${f}"${s}/>`;
  }
}

function buildPointSymbolHtml(symbolType, fillColor, strokeColor, size, strokeWidth) {
  const stroke = strokeColor || '#ffffff';
  const sw = parsePointStrokeWidth(strokeWidth ?? 2);
  const dim = Math.max(8, size * 2);
  const safeFill = fillColor || '#3b82f6';
  const strokeAttr = sw > 0 ? ` stroke="${stroke}" stroke-width="${sw}"` : ' stroke="none"';
  const inner = getSymbolSvgShape(symbolType, safeFill, strokeAttr);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${dim}" height="${dim}" viewBox="0 0 20 20" style="display:block">${inner}</svg>`;
}

function createPointMarker(feature, latlng, layerObj) {
  const fillColor = getFeatureFillColor(layerObj, feature);
  const markerOpacity = layerObj.opacity ?? 0.4;

  let symbolType = layerObj.pointSymbolType || 'circle';
  let size = layerObj.pointSize ?? 10;
  let strokeColor = getPointStrokeColor(layerObj);
  let strokeWidth = layerObj.pointStrokeWidth ?? 2;
  let customUrl = layerObj.customSymbolUrl || null;

  if (layerObj.symbologyType === 'categorized' && layerObj.symbologyField) {
    const val = feature?.properties ? feature.properties[layerObj.symbologyField] : null;
    const catKey = getCategoryKeyForValue(layerObj, val);
    const catSym = layerObj.categorySymbols?.[catKey];
    if (catSym) {
      if (catSym.pointSymbolType) symbolType = catSym.pointSymbolType;
      if (catSym.pointSize != null) size = catSym.pointSize;
      if (catSym.pointStrokeColor) strokeColor = catSym.pointStrokeColor;
      if (catSym.pointStrokeWidth != null) strokeWidth = catSym.pointStrokeWidth;
      if (catSym.customSymbolUrl) customUrl = catSym.customSymbolUrl;
    }
  }

  const dim = Math.max(8, size * 2);

  if (symbolType === 'custom' && customUrl) {
    return L.marker(latlng, {
      icon: L.icon({
        iconUrl: customUrl,
        iconSize: [dim, dim],
        iconAnchor: [size, size],
        popupAnchor: [0, -size],
        className: 'gis-custom-point-icon'
      }),
      opacity: markerOpacity
    });
  }

  return L.marker(latlng, {
    icon: L.divIcon({
      className: 'gis-point-symbol-icon',
      html: buildPointSymbolHtml(symbolType, fillColor, strokeColor, size, strokeWidth),
      iconSize: [dim, dim],
      iconAnchor: [size, size]
    }),
    opacity: markerOpacity
  });
}

function replacePopupTokens(str, feature, layer) {
  if (!str) return '';
  const props = feature.properties || {};
  return String(str).replace(/\{([^}]+)\}/g, (match, key) => {
    const trimmed = key.trim();
    if (trimmed === 'layerName') return layer.name ?? '';
    if (Object.prototype.hasOwnProperty.call(props, trimmed)) {
      return props[trimmed] === null || props[trimmed] === undefined ? '' : String(props[trimmed]);
    }
    return match;
  });
}

function getPopupFieldsForFeature(layer, feature) {
  const props = feature.properties || {};
  const allFields = layer.fields?.length ? layer.fields : Object.keys(props);
  if (!Array.isArray(layer.popupFields)) return allFields.filter(f => f in props);
  return layer.popupFields.filter(f => f in props);
}

function buildFeaturePopupHtml(feature, layer) {
  if (layer.popupEnabled === false) return '';

  const props = feature.properties || {};
  const titleRaw = layer.popupTitle?.trim();
  const title = escapeHtml(titleRaw ? replacePopupTokens(titleRaw, feature, layer) : layer.name);

  const template = layer.popupTemplate?.trim();
  if (template) {
    const body = template
      .split('\n')
      .map(line => escapeHtml(replacePopupTokens(line, feature, layer)))
      .join('<br/>');
    return `<div class="gis-feature-popup" style="font-size:12px;font-family:sans-serif;line-height:1.45;">
      <b style="color:#3b82f6;font-size:13px;display:block;margin-bottom:6px;">${title}</b>
      <div style="color:#f8fafc;">${body}</div>
    </div>`;
  }

  const fields = getPopupFieldsForFeature(layer, feature);
  let html = `<div class="gis-feature-popup" style="font-size:12px;font-family:sans-serif;line-height:1.45;">`;
  html += `<b style="color:#3b82f6;font-size:13px;display:block;margin-bottom:6px;">${title}</b>`;

  if (!fields.length) {
    html += `<span style="color:#94a3b8;">No attributes to display</span>`;
  } else {
    const showLabels = layer.popupShowLabels !== false;
    fields.forEach(k => {
      const val = props[k] === null || props[k] === undefined ? '' : String(props[k]);
      if (showLabels) {
        html += `<div style="margin-bottom:3px;"><span style="color:#94a3b8;">${escapeHtml(k)}:</span> <span style="color:#f8fafc;font-weight:500;">${escapeHtml(val)}</span></div>`;
      } else {
        html += `<div style="margin-bottom:3px;color:#f8fafc;">${escapeHtml(val)}</div>`;
      }
    });
  }

  html += '</div>';
  return html;
}

function bindFeaturePopup(feature, leafletLayer, layerObj) {
  if (layerObj.popupEnabled === false) {
    leafletLayer.unbindPopup();
    return;
  }
  const html = buildFeaturePopupHtml(feature, layerObj);
  if (!html) {
    leafletLayer.unbindPopup();
    return;
  }
  leafletLayer.bindPopup(html);
}

function refreshLayerPopups(layer) {
  if (!layer?.leafletLayer) return;
  layer.leafletLayer.eachLayer(leafletLayer => {
    const f = leafletLayer.feature;
    if (f) bindFeaturePopup(f, leafletLayer, layer);
  });
}

function createGeoJsonLayer(layerObj) {
  const options = {
    style: (feature) => (isPointFeature(feature) ? {} : getFeatureStyle(layerObj, feature)),
    onEachFeature: (feature, l) => {
      bindFeaturePopup(feature, l, layerObj);
      bindFeatureLabel(feature, l, layerObj);
    }
  };

  if (layerHasPoints(layerObj)) {
    options.pointToLayer = (feature, latlng) => createPointMarker(feature, latlng, layerObj);
  }

  return L.geoJSON(layerObj.geojson, options);
}

function bindFeatureLabel(feature, leafletLayer, layerObj) {
  if (!layerObj.labelEnabled || !layerObj.labelField) return;
  const val = feature.properties?.[layerObj.labelField];
  if (val === null || val === undefined || val === '') return;
  leafletLayer.bindTooltip(String(val), {
    permanent: true,
    direction: 'center',
    className: `layer-label label-layer-${layerObj.id}`
  });
}

function updateLabelStyleTag(layer) {
  const styleId = `label-style-${layer.id}`;
  let styleEl = document.getElementById(styleId);
  if (!layer.labelEnabled || !layer.labelField) {
    if (styleEl) styleEl.remove();
    return;
  }
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = styleId;
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = `
.label-layer-${layer.id} {
  font-family: ${layer.labelFont};
  font-size: ${layer.labelSize}px !important;
  color: ${layer.labelColor} !important;
  -webkit-text-stroke: ${layer.labelStrokeWidth}px ${layer.labelStrokeColor};
  paint-order: stroke;
  text-stroke: ${layer.labelStrokeWidth}px ${layer.labelStrokeColor};
  font-weight: bold;
  background: none !important;
  border: none !important;
  box-shadow: none !important;
  padding: 1px 3px !important;
  line-height: 1.2 !important;
  white-space: nowrap;
}`;
}

function rebuildLeafletLayer(layer, options = {}) {
  const wasOnMap = layer.visible && map.hasLayer(layer.leafletLayer);
  map.removeLayer(layer.leafletLayer);
  layer.leafletLayer = createGeoJsonLayer(layer);
  if (wasOnMap) layer.leafletLayer.addTo(map);
  syncMapZIndex();
  if (options.renderUI !== false) renderUI();
}

function refreshLayerStyle(layer) {
  if (!layer?.leafletLayer) return;

  const geomTypes = getLayerGeometryTypes(layer.geojson);
  if (geomTypes.has('point')) {
    const opacity = layer.opacity ?? 0.4;
    layer.leafletLayer.eachLayer(l => {
      if (l.setOpacity) l.setOpacity(opacity);
    });
  }
  if (geomTypes.has('line') || geomTypes.has('polygon')) {
    if (layer.leafletLayer.setStyle) {
      layer.leafletLayer.setStyle(layer.leafletLayer.options.style);
    }
  }
}

function needsPointLayerRebuild(key) {
  return [
    'pointSymbolType', 'pointSize', 'customSymbolUrl',
    'pointStrokeColor', 'pointStrokeWidth',
    'color', 'strokeColor', 'symbologyType', 'symbologyField',
    'classifyMethod', 'classCount', 'classLimits', 'categories'
  ].includes(key);
}

function needsLayerRebuild(key) {
  return needsPointLayerRebuild(key) || [
    'labelEnabled', 'labelField', 'labelFont', 'labelSize',
    'labelColor', 'labelStrokeColor', 'labelStrokeWidth'
  ].includes(key);
}

const styleRefreshRaf = new Map();

function scheduleLayerStyleRefresh(layer, key = 'default') {
  const rafKey = `${layer.id}:${key}`;
  if (styleRefreshRaf.has(rafKey)) cancelAnimationFrame(styleRefreshRaf.get(rafKey));
  styleRefreshRaf.set(rafKey, requestAnimationFrame(() => {
    refreshLayerStyle(layer);
    styleRefreshRaf.delete(rafKey);
  }));
}

// =========================
// CREATE LAYER
// =========================

function createLayer({
  name,
  geojson,
  id,
  color,
  strokeColor,
  weight = 2,
  opacity = 0.4,
  noFill = false,
  pointSymbolType = 'circle',
  pointSize = 10,
  pointStrokeColor = null,
  pointStrokeWidth = 2,
  customSymbolUrl = null,
  popupEnabled = true,
  popupTitle = '',
  popupFields = null,
  popupTemplate = '',
  popupShowLabels = true,
  visible = true,
  symbologyType = 'single',
  symbologyField = '',
  categories = {},
  categorySymbols = {},
  categorySortMode = 'asc',
  categoryOrder = [],
  classifyMethod = '',
  classCount = 5,
  classLimits = [],
  intervals = [],
  symbologyExpanded = true,
  settingsExpanded = true,
  labelField = '',
  labelEnabled = false,
  labelFont = 'Arial',
  labelSize = 12,
  labelColor = '#ffffff',
  labelStrokeColor = '#000000',
  labelStrokeWidth = 2
}) {
  let layerId = id;
  if (layerId) {
    const num = parseInt(String(layerId).replace('layer_', ''), 10);
    if (!isNaN(num) && num > layerCounter) layerCounter = num;
  } else {
    layerId = 'layer_' + (++layerCounter);
  }

  const defaultColor = color || getRandomColor();
  const fields = extractFields(geojson);

  const layerObj = {
    id: layerId,
    name,
    geojson,
    leafletLayer: null,
    color: defaultColor,
    strokeColor: strokeColor || defaultColor,
    weight,
    opacity: opacity ?? 0.4,
    noFill,
    pointSymbolType: pointSymbolType || 'circle',
    pointSize: pointSize ?? 10,
    pointStrokeColor: pointStrokeColor || null,
    pointStrokeWidth: pointStrokeWidth ?? 2,
    customSymbolUrl: customSymbolUrl || null,
    popupEnabled: popupEnabled !== false,
    popupTitle: popupTitle || '',
    popupFields: popupFields === undefined ? null : popupFields,
    popupTemplate: popupTemplate || '',
    popupShowLabels: popupShowLabels !== false,
    visible,
    fields,
    geometryTypes: getLayerGeometryTypes(geojson),
    symbologyType,
    symbologyField,
    categories: { ...categories },
    categorySymbols: { ...categorySymbols },
    categorySortMode: categorySortMode || 'asc',
    categoryOrder: [...categoryOrder],
    classifyMethod: classifyMethod || '',
    classCount: classCount || 5,
    classLimits: (classLimits || []).map(v => (v === null || v === '' ? null : Number(v))),
    intervals: intervals.map(i => ({ ...i })),
    symbologyExpanded,
    settingsExpanded,
    labelField,
    labelEnabled: !!labelField,
    labelFont,
    labelSize,
    labelColor,
    labelStrokeColor,
    labelStrokeWidth
  };
  migrateLegacyBreaks(layerObj);
  ensureCategoryOrder(layerObj);
  if (layerObj.symbologyType === 'categorized' && layerObj.symbologyField && layerObj.classifyMethod && Object.keys(layerObj.categories).length === 0) {
    applyLayerClassification(layerObj);
  }

  updateLabelStyleTag(layerObj);
  layerObj.leafletLayer = createGeoJsonLayer(layerObj);

  if (layerObj.visible) {
    layerObj.leafletLayer.addTo(map);
  }
  layerStore.push(layerObj);

  renderUI();
  syncMapZIndex();
  return layerObj;
}

function renameLayer(id, newName) {
  const layer = layerStore.find(l => l.id === id);
  if (!layer) return;

  const trimmed = newName.trim();
  layer.name = trimmed || layer.name;
  renderUI();
}

// =========================
// LAYER VISIBILITY
// =========================

function toggleLayer(id) {
  const layer = layerStore.find(l => l.id === id);
  if (!layer) return;

  if (layer.visible) {
    map.removeLayer(layer.leafletLayer);
  } else {
    layer.leafletLayer.addTo(map);
  }

  layer.visible = !layer.visible;
  renderUI();
  syncMapZIndex();
}

// =========================
// COLOR / STYLING UPDATES
// =========================

function updateStyle(id, key, value, options = {}) {
  const layer = layerStore.find(l => l.id === id);
  if (!layer) return;

  layer[key] = value;

  if (key === 'symbologyField') {
    layer.classLimits = [];
    layer.intervals = [];
    layer.categories = {};
    layer.categoryOrder = [];
    layer.categorySortMode = 'asc';
  }

  if (key === 'symbologyType' && value === 'categorized' && layer.symbologyField) {
    applyLayerClassification(layer);
  }

  if (key === 'classifyMethod') {
    if (!value) { renderUI(); return; }
    if (value === 'manual-intervals') {
      const nums = getNumericValues(layer, layer.symbologyField);
      if (nums.length && (!layer.classLimits || !layer.classLimits.some(v => v !== null && v !== ''))) {
        layer.classLimits = defaultClassLimitsFromData(nums, layer.classCount || 5);
      }
    }
    applyLayerClassification(layer);
  }

  if (key === 'classCount') {
    ensureClassLimits(layer);
    applyLayerClassification(layer);
  }

  if (key === 'classLimits') {
    applyLayerClassification(layer);
  }

  if (needsLayerRebuild(key)) {
    updateLabelStyleTag(layer);
    if (options.renderUI === false) {
      rebuildLeafletLayer(layer, { renderUI: false });
      return;
    }
    rebuildLeafletLayer(layer);
    return;
  }

  if (options.renderUI === false) {
    scheduleLayerStyleRefresh(layer, key);
    return;
  }

  refreshLayerStyle(layer);
  renderUI();
}

function updateLayerPopup(layerId, partial, options = {}) {
  const layer = layerStore.find(l => l.id === layerId);
  if (!layer) return;
  Object.assign(layer, partial);
  refreshLayerPopups(layer);
  if (options.renderUI !== false) renderUI();
}

function handleCustomSymbolUpload(layerId, file) {
  if (!file || !file.type.startsWith('image/')) {
    alert('Please choose an image file (PNG, JPG, SVG, etc.).');
    return;
  }

  const reader = new FileReader();
  reader.onload = (ev) => {
    const layer = layerStore.find(l => l.id === layerId);
    if (!layer) return;
    layer.customSymbolUrl = ev.target.result;
    layer.pointSymbolType = 'custom';
    rebuildLeafletLayer(layer);
  };
  reader.readAsDataURL(file);
}

function updateCategoryColor(layerId, catKey, colorValue, options = {}) {
  const layer = layerStore.find(l => l.id === layerId);
  if (!layer) return;

  layer.categories[catKey] = colorValue;
  if (layerHasPoints(layer)) {
    if (options.renderUI === false) {
      rebuildLeafletLayer(layer, { renderUI: false });
      return;
    }
    rebuildLeafletLayer(layer);
    return;
  }
  if (options.renderUI === false) {
    scheduleLayerStyleRefresh(layer, 'category');
    return;
  }
  refreshLayerStyle(layer);
  renderUI();
}

function getLegendPointSwatch(layer, color, catKey) {
  let type = layer.pointSymbolType || 'circle';
  let sw = layer.pointStrokeWidth ?? 2;
  let customUrl = layer.customSymbolUrl || null;
  if (catKey && layer.categorySymbols?.[catKey]) {
    const catSym = layer.categorySymbols[catKey];
    if (catSym.pointSymbolType) type = catSym.pointSymbolType;
    if (catSym.pointStrokeWidth != null) sw = catSym.pointStrokeWidth;
    if (catSym.customSymbolUrl) customUrl = catSym.customSymbolUrl;
  }
  const stroke = getPointStrokeColor(layer);
  if (type === 'custom' && customUrl) {
    return `<img src="${customUrl}" alt="" style="width:12px;height:12px;object-fit:contain;border-radius:2px;opacity:${layer.opacity ?? 1};" />`;
  }
  const html = buildPointSymbolHtml(type, color, stroke, 6, sw);
  return `<span style="display:inline-flex;width:12px;height:12px;align-items:center;justify-content:center;overflow:hidden;opacity:${layer.opacity ?? 1};">${html}</span>`;
}

const SYMBOL_SHAPES = [
  { id: 'circle', label: 'Circle' },
  { id: 'square', label: 'Square' },
  { id: 'triangle', label: 'Triangle' },
  { id: 'diamond', label: 'Diamond' },
  { id: 'pentagon', label: 'Pentagon' },
  { id: 'hexagon', label: 'Hexagon' },
  { id: 'star', label: 'Star' },
  { id: 'cross', label: 'Cross' },
  { id: 'crosshair', label: 'Crosshair' },
  { id: 'pin', label: 'Pin' },
  { id: 'arrow', label: 'Arrow' },
  { id: 'teardrop', label: 'Teardrop' },
  { id: 'ring', label: 'Ring' },
  { id: 'custom', label: 'Custom Image' },
];

function closeCategorySymbolEditor() {
  const overlay = document.getElementById('sym-editor-overlay');
  if (overlay) { overlay.remove(); renderUI(); }
}

function closeLabelEditor() {
  const overlay = document.getElementById('label-editor-overlay');
  if (overlay) { overlay.remove(); renderUI(); }
}

function openLabelEditor(layer) {
  closeLabelEditor();
  const overlay = document.createElement('div');
  overlay.id = 'label-editor-overlay';

  let fieldOptions = '<option value="">-- No label --</option>';
  layer.fields.forEach(f => {
    fieldOptions += `<option value="${f}" ${layer.labelField === f ? 'selected' : ''}>${escapeHtml(f)}</option>`;
  });

  overlay.innerHTML = `
    <div class="label-editor-panel">
      <h3>Label Settings: ${escapeHtml(layer.name)}</h3>
      <div class="form-group">
        <label>Label field</label>
        <select id="le-field">${fieldOptions}</select>
      </div>
      <div class="form-group">
        <label>Font</label>
        <select id="le-font">
          <option value="Arial" ${layer.labelFont === 'Arial' ? 'selected' : ''}>Arial</option>
          <option value="Helvetica" ${layer.labelFont === 'Helvetica' ? 'selected' : ''}>Helvetica</option>
          <option value="Verdana" ${layer.labelFont === 'Verdana' ? 'selected' : ''}>Verdana</option>
          <option value="Tahoma" ${layer.labelFont === 'Tahoma' ? 'selected' : ''}>Tahoma</option>
          <option value="Georgia" ${layer.labelFont === 'Georgia' ? 'selected' : ''}>Georgia</option>
          <option value="'Courier New', monospace" ${layer.labelFont === "'Courier New', monospace" ? 'selected' : ''}>Courier New</option>
          <option value="monospace" ${layer.labelFont === 'monospace' ? 'selected' : ''}>Monospace</option>
        </select>
      </div>
      <div class="form-group">
        <label>Size: <span id="le-size-val">${layer.labelSize}</span>px</label>
        <input type="range" id="le-size" min="8" max="32" value="${layer.labelSize}" />
      </div>
      <div class="form-group">
        <div class="color-row">
          <label>Text color</label>
          <input type="color" id="le-color" value="${layer.labelColor}" />
        </div>
      </div>
      <div class="form-group">
        <div class="color-row">
          <label>Stroke (halo) color</label>
          <input type="color" id="le-stroke-color" value="${layer.labelStrokeColor}" />
        </div>
      </div>
      <div class="form-group">
        <label>Stroke width: <span id="le-stroke-width-val">${layer.labelStrokeWidth}</span>px</label>
        <input type="range" id="le-stroke-width" min="0" max="6" step="0.5" value="${layer.labelStrokeWidth}" />
      </div>
      <div class="btn-row">
        <button class="btn-cancel" id="le-cancel">Cancel</button>
        <button class="btn-apply" id="le-apply">Apply</button>
      </div>
    </div>
  `;

  overlay.querySelector('#le-size').addEventListener('input', (e) => {
    overlay.querySelector('#le-size-val').textContent = e.target.value;
  });
  overlay.querySelector('#le-stroke-width').addEventListener('input', (e) => {
    overlay.querySelector('#le-stroke-width-val').textContent = parseFloat(e.target.value).toFixed(1);
  });
  overlay.querySelector('#le-cancel').addEventListener('click', () => closeLabelEditor());
  overlay.querySelector('#le-apply').addEventListener('click', () => {
    const field = overlay.querySelector('#le-field').value;
    layer.labelField = field;
    layer.labelEnabled = !!field;
    layer.labelFont = overlay.querySelector('#le-font').value;
    layer.labelSize = parseInt(overlay.querySelector('#le-size').value, 10);
    layer.labelColor = overlay.querySelector('#le-color').value;
    layer.labelStrokeColor = overlay.querySelector('#le-stroke-color').value;
    layer.labelStrokeWidth = parseFloat(overlay.querySelector('#le-stroke-width').value);
    updateLabelStyleTag(layer);
    rebuildLeafletLayer(layer);
    closeLabelEditor();
  });
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeLabelEditor(); });

  document.body.appendChild(overlay);
}

function openCategorySymbolEditor(layer, catKey) {
  closeCategorySymbolEditor();
  if (!layer.categorySymbols) layer.categorySymbols = {};
  if (!layer.categorySymbols[catKey]) layer.categorySymbols[catKey] = {};
  const catSym = layer.categorySymbols[catKey];

  const getSym = (prop, def) => catSym[prop] != null ? catSym[prop] : def;
  const layerColor = layer.categories[catKey] || '#3b82f6';
  let curType = getSym('pointSymbolType', layer.pointSymbolType || 'circle');
  let curSize = getSym('pointSize', layer.pointSize || 10);
  let curColor = layerColor;
  let curStrokeColor = getSym('pointStrokeColor', layer.pointStrokeColor || '#ffffff');
  let curStrokeWidth = getSym('pointStrokeWidth', layer.pointStrokeWidth ?? 2);
  let curCustomUrl = getSym('customSymbolUrl', layer.customSymbolUrl || '');

  function applySettings() {
    const s = layer.categorySymbols[catKey];
    var isDef = curType === 'circle' && curSize === (layer.pointSize || 10) && curStrokeColor === (layer.pointStrokeColor || '#ffffff') && curStrokeWidth === (layer.pointStrokeWidth ?? 2) && !curCustomUrl;
    if (isDef) {
      delete s.pointSymbolType; delete s.pointSize; delete s.pointStrokeColor; delete s.pointStrokeWidth; delete s.customSymbolUrl;
      if (Object.keys(s).length === 0) delete layer.categorySymbols[catKey];
    } else {
      s.pointSymbolType = curType;
      s.pointSize = curSize;
      s.pointStrokeColor = curStrokeColor;
      s.pointStrokeWidth = curStrokeWidth;
      if (curCustomUrl) s.customSymbolUrl = curCustomUrl; else delete s.customSymbolUrl;
    }
    rebuildLeafletLayer(layer, { renderUI: false });
  }

  function updatePreview() {
    const container = overlay.querySelector('.sym-preview-main');
    container.innerHTML = '';
    if (curType === 'custom' && curCustomUrl) {
      const img = document.createElement('img');
      img.src = curCustomUrl;
      img.style.cssText = 'max-width:80px;max-height:80px;object-fit:contain;border-radius:4px;';
      container.appendChild(img);
    } else {
      const type = curType === 'custom' ? 'circle' : curType;
      container.innerHTML = buildPointSymbolHtml(type, curColor, curStrokeColor, Math.max(6, curSize / 2), curStrokeWidth);
    }
  }

  function openFilePicker() {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'image/*';
    inp.onchange = () => {
      const file = inp.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        curCustomUrl = e.target.result;
        applySettings(); updatePreview(); updateCustomRow();
      };
      reader.readAsDataURL(file);
    };
    inp.click();
  }

  const overlay = document.createElement('div');
  overlay.id = 'sym-editor-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;';
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeCategorySymbolEditor(); });

  const panel = document.createElement('div');
  panel.style.cssText = 'background:var(--panel-bg,#1e293b);border:1px solid var(--border-color,#334155);border-radius:12px;padding:20px;max-width:420px;width:90%;max-height:90vh;overflow-y:auto;box-shadow:0 8px 32px rgba(0,0,0,0.5);';

  // header
  const header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;';
  const title = document.createElement('div');
  title.style.cssText = 'font-weight:600;font-size:14px;color:var(--text-primary,#e2e8f0);';
  title.textContent = 'Edit Symbol \u2014 ' + getCategoryDisplayLabel(layer, catKey);
  header.appendChild(title);
  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = '\u2715';
  closeBtn.style.cssText = 'background:none;border:none;color:var(--text-secondary,#94a3b8);font-size:18px;cursor:pointer;padding:2px 6px;border-radius:4px;';
  closeBtn.addEventListener('click', closeCategorySymbolEditor);
  closeBtn.addEventListener('mouseenter', () => closeBtn.style.background = 'rgba(255,255,255,0.1)');
  closeBtn.addEventListener('mouseleave', () => closeBtn.style.background = 'none');
  header.appendChild(closeBtn);
  panel.appendChild(header);

  // preview
  const previewRow = document.createElement('div');
  previewRow.style.cssText = 'display:flex;justify-content:center;margin-bottom:16px;';
  const previewMain = document.createElement('div');
  previewMain.className = 'sym-preview-main';
  previewMain.style.cssText = 'display:flex;align-items:center;justify-content:center;width:90px;height:90px;background:rgba(0,0,0,0.3);border-radius:8px;border:1px solid var(--border-color,#334155);';
  previewRow.appendChild(previewMain);
  panel.appendChild(previewRow);

  // shape grid
  const shapeLabel = document.createElement('div');
  shapeLabel.style.cssText = 'font-size:12px;color:var(--text-secondary,#94a3b8);margin-bottom:6px;';
  shapeLabel.textContent = 'Shape';
  panel.appendChild(shapeLabel);

  const shapeGrid = document.createElement('div');
  shapeGrid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(44px,1fr));gap:4px;margin-bottom:14px;';

  SYMBOL_SHAPES.forEach(sh => {
    const btn = document.createElement('button');
    btn.dataset.shape = sh.id;
    btn.title = sh.label;
    btn.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;padding:4px 2px;cursor:pointer;border:2px solid transparent;border-radius:6px;background:rgba(15,23,42,0.6);transition:all 0.15s;';
    if (sh.id === curType) btn.style.borderColor = '#3b82f6';
    if (sh.id === 'custom') {
      btn.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg><span style="font-size:7px;margin-top:2px;color:var(--text-secondary,#94a3b8)">Image</span>';
    } else {
      btn.innerHTML = buildPointSymbolHtml(sh.id, curColor, curStrokeColor, 6, curStrokeWidth) + '<span style="font-size:7px;margin-top:2px;color:var(--text-secondary,#94a3b8)">' + sh.label + '</span>';
    }
    btn.addEventListener('click', () => {
      shapeGrid.querySelectorAll('button').forEach(b => b.style.borderColor = 'transparent');
      btn.style.borderColor = '#3b82f6';
      curType = sh.id;
      updateCustomRow();
      applySettings(); updatePreview();
    });
    shapeGrid.appendChild(btn);
  });
  panel.appendChild(shapeGrid);

  // --- custom image row (hidden unless custom selected) ---
  const customRow = document.createElement('div');
  customRow.id = 'sym-custom-row';
  customRow.style.cssText = 'margin-bottom:14px;';
  const customLabel = document.createElement('div');
  customLabel.style.cssText = 'font-size:12px;color:var(--text-secondary,#94a3b8);margin-bottom:6px;';
  customLabel.textContent = 'Custom Image';
  customRow.appendChild(customLabel);
  const customBtn = document.createElement('button');
  customBtn.textContent = curCustomUrl ? 'Change Image...' : 'Choose Image...';
  customBtn.style.cssText = 'padding:6px 12px;font-size:11px;background:rgba(59,130,246,0.15);color:var(--accent,#60a5fa);border:1px solid rgba(59,130,246,0.3);border-radius:6px;cursor:pointer;';
  customBtn.addEventListener('click', openFilePicker);
  customRow.appendChild(customBtn);
  if (curCustomUrl) {
    const clearBtn = document.createElement('button');
    clearBtn.textContent = 'Clear';
    clearBtn.style.cssText = 'padding:6px 12px;font-size:11px;margin-left:8px;background:rgba(239,68,68,0.15);color:#ef4444;border:1px solid rgba(239,68,68,0.3);border-radius:6px;cursor:pointer;';
    clearBtn.addEventListener('click', () => {
      curCustomUrl = '';
      applySettings(); updatePreview(); updateCustomRow();
    });
    customRow.appendChild(clearBtn);
  }
  function updateCustomRow() {
    const isCustom = curType === 'custom';
    customRow.style.display = isCustom ? 'block' : 'none';
    sizeRow.style.display = isCustom ? 'none' : 'flex';
    colorRow.style.display = isCustom ? 'none' : 'flex';
  }
  panel.appendChild(customRow);

  // size row
  const sizeRow = document.createElement('div');
  sizeRow.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:12px;';
  const sizeLabel = document.createElement('label');
  sizeLabel.style.cssText = 'font-size:12px;color:var(--text-secondary,#94a3b8);flex-shrink:0;';
  sizeLabel.textContent = 'Size';
  sizeRow.appendChild(sizeLabel);
  const sizeSlider = document.createElement('input');
  sizeSlider.type = 'range';
  sizeSlider.min = 4; sizeSlider.max = 48; sizeSlider.value = curSize;
  sizeSlider.style.cssText = 'flex:1;accent-color:#3b82f6;';
  sizeSlider.addEventListener('input', () => {
    curSize = parseInt(sizeSlider.value);
    sizeVal.textContent = curSize + 'px';
    applySettings(); updatePreview();
  });
  sizeRow.appendChild(sizeSlider);
  const sizeVal = document.createElement('span');
  sizeVal.style.cssText = 'font-size:12px;color:var(--text-primary,#e2e8f0);min-width:32px;text-align:right;';
  sizeVal.textContent = curSize + 'px';
  sizeRow.appendChild(sizeVal);
  panel.appendChild(sizeRow);

  // color row
  const colorRow = document.createElement('div');
  colorRow.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:12px;';
  const colorLabel = document.createElement('label');
  colorLabel.style.cssText = 'font-size:12px;color:var(--text-secondary,#94a3b8);flex-shrink:0;';
  colorLabel.textContent = 'Color';
  colorRow.appendChild(colorLabel);
  const colorPicker = document.createElement('input');
  colorPicker.type = 'color';
  colorPicker.value = curColor;
  colorPicker.style.cssText = 'width:32px;height:28px;border:0;padding:0;background:none;cursor:pointer;';
  colorPicker.addEventListener('input', () => {
    curColor = colorPicker.value;
    layer.categories[catKey] = curColor;
    updateCategoryColor(layer.id, catKey, curColor, { renderUI: false });
    updatePreview(); updateShapeGridColors();
  });
  colorRow.appendChild(colorPicker);
  panel.appendChild(colorRow);

  // stroke color row
  const scRow = document.createElement('div');
  scRow.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:12px;';
  const scLabel = document.createElement('label');
  scLabel.style.cssText = 'font-size:12px;color:var(--text-secondary,#94a3b8);flex-shrink:0;';
  scLabel.textContent = 'Stroke';
  scRow.appendChild(scLabel);
  const scPicker = document.createElement('input');
  scPicker.type = 'color';
  scPicker.value = curStrokeColor;
  scPicker.style.cssText = 'width:32px;height:28px;border:0;padding:0;background:none;cursor:pointer;';
  scPicker.addEventListener('input', () => {
    curStrokeColor = scPicker.value;
    applySettings(); updatePreview(); updateShapeGridColors();
  });
  scRow.appendChild(scPicker);
  const swSlider = document.createElement('input');
  swSlider.type = 'range';
  swSlider.min = 0; swSlider.max = 6; swSlider.step = 0.5; swSlider.value = curStrokeWidth;
  swSlider.style.cssText = 'flex:1;accent-color:#3b82f6;';
  swSlider.addEventListener('input', () => {
    curStrokeWidth = parseFloat(swSlider.value);
    swVal.textContent = curStrokeWidth + 'px';
    applySettings(); updatePreview(); updateShapeGridColors();
  });
  scRow.appendChild(swSlider);
  const swVal = document.createElement('span');
  swVal.style.cssText = 'font-size:12px;color:var(--text-primary,#e2e8f0);min-width:32px;text-align:right;';
  swVal.textContent = curStrokeWidth + 'px';
  scRow.appendChild(swVal);
  panel.appendChild(scRow);

  function updateShapeGridColors() {
    shapeGrid.querySelectorAll('button').forEach(btn => {
      if (btn.dataset.shape !== 'custom') {
        const st = btn.dataset.shape;
        btn.innerHTML = buildPointSymbolHtml(st, curColor, curStrokeColor, 6, curStrokeWidth) + '<span style="font-size:7px;margin-top:2px;color:var(--text-secondary,#94a3b8)">' + (SYMBOL_SHAPES.find(s => s.id === st)?.label || st) + '</span>';
      }
    });
  }

  overlay.appendChild(panel);
  document.body.appendChild(overlay);
  updatePreview();
  updateCustomRow();
}

// =========================
// REORDER LAYERS STACK
// =========================

function moveLayer(index, direction) {
  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= layerStore.length) return;

  const temp = layerStore[index];
  layerStore[index] = layerStore[targetIndex];
  layerStore[targetIndex] = temp;

  renderUI();
  syncMapZIndex();
}

function syncMapZIndex() {
  layerStore.forEach(layer => {
    if (layer.visible && layer.leafletLayer.bringToFront) {
      layer.leafletLayer.bringToFront();
    }
  });
}

function deleteLayer(layerId) {
  const idx = layerStore.findIndex(l => l.id === layerId);
  if (idx === -1) return;
  const layer = layerStore[idx];
  if (layer.leafletLayer && map.hasLayer(layer.leafletLayer)) {
    map.removeLayer(layer.leafletLayer);
  }
  layerStore.splice(idx, 1);
  renderUI();
  syncMapZIndex();
}

// =========================
// UI RENDER GENERATOR
// =========================

function renderUI() {
  const layersDiv = document.getElementById('layers');
  const legendDiv = document.getElementById('legend');

  layersDiv.innerHTML = "";
  legendDiv.innerHTML = "";

  for (let i = layerStore.length - 1; i >= 0; i--) {
    const layer = layerStore[i];

    const div = document.createElement('div');
    div.className = 'layer-node';

    let fieldOptions = `<option value="">-- Choose Field --</option>`;
    layer.fields.forEach(f => {
      fieldOptions += `<option value="${f}" ${layer.symbologyField === f ? 'selected' : ''}>${f}</option>`;
    });

    div.innerHTML = `
      <div class="layer-header">
        <div class="layer-title-wrapper">
          <input type="checkbox" class="layer-checkbox" ${layer.visible ? "checked" : ""} />
          <input type="text" class="layer-name-input" value="${escapeHtml(layer.name)}" title="Click to rename layer" />
        </div>
        <div class="reorder-btns">
          <button class="btn-up" ${i === layerStore.length - 1 ? 'disabled' : ''}>▲</button>
          <button class="btn-down" ${i === 0 ? 'disabled' : ''}>▼</button>
          <button class="btn-delete-layer" title="Delete layer">✕</button>
        </div>
      </div>
      <div class="layer-controls">
        <div class="collapsible-section">
          <div class="collapsible-header" data-section="symbology" data-layer="${layer.id}">
            <span class="collapsible-title">Symbology</span>
            <span class="collapsible-chevron ${layer.symbologyExpanded ? 'open' : ''}">▶</span>
          </div>
          <div class="collapsible-content" style="display: ${layer.symbologyExpanded ? 'block' : 'none'};">
            <div class="form-group">
              <label>Coloring Style</label>
              <select class="symbology-type">
                <option value="single" ${layer.symbologyType === 'single' ? 'selected' : ''}>Single Color</option>
                <option value="categorized" ${layer.symbologyType === 'categorized' ? 'selected' : ''}>Color by Value</option>
              </select>
            </div>
            
            <div class="single-style-panel" style="display: ${layer.symbologyType === 'single' ? 'block' : 'none'}; margin-bottom: 8px;">
              <div style="display:flex; align-items:center; gap:8px;">
                <label style="margin-bottom:0; flex:1;">Choose Color</label>
                <input type="color" class="single-color" value="${layer.color}" style="background:none; border:none; cursor:pointer; width:30px; height:24px;" />
              </div>
            </div>

            <div class="categorized-style-panel" style="display: ${layer.symbologyType === 'categorized' ? 'block' : 'none'}; margin-bottom: 8px;">
              <div class="form-group">
                <label>Select Property Field</label>
                <select class="symbology-field">${fieldOptions}</select>
              </div>
              <div class="classify-options" style="display: ${layer.symbologyField ? 'block' : 'none'};">
                <div class="form-group">
                  <label>Classification</label>
                  <select class="classify-method">
                    <option value="" ${!layer.classifyMethod ? 'selected' : ''}>Select classification style…</option>
                    <option value="unique" ${layer.classifyMethod === 'unique' ? 'selected' : ''}>Unique values</option>
                    <option value="natural-breaks" ${layer.classifyMethod === 'natural-breaks' ? 'selected' : ''} ${fieldHasNumericValues(layer, layer.symbologyField) ? '' : 'disabled'}>Natural breaks</option>
                    <option value="manual-intervals" ${layer.classifyMethod === 'manual-intervals' ? 'selected' : ''} ${fieldHasNumericValues(layer, layer.symbologyField) ? '' : 'disabled'}>Manual intervals</option>
                  </select>
                </div>
                <div class="class-count-panel form-group" style="display: ${layer.classifyMethod === 'natural-breaks' || layer.classifyMethod === 'manual-intervals' ? 'block' : 'none'};">
                  <label>Number of classes</label>
                  <input type="number" class="class-count" min="2" max="12" value="${layer.classCount || 5}" />
                </div>
                <div class="manual-intervals-panel" style="display: ${layer.classifyMethod === 'manual-intervals' ? 'block' : 'none'}; margin-bottom:0;">
                  <div class="manual-class-limits"></div>
                  <span style="font-size:10px; color:var(--text-muted); display:block; margin-top:6px;">Upper limit per class (≤). Leave the last class blank for values above the previous limit.</span>
                </div>
                <div class="color-ramp-panel" style="display: ${layer.classifyMethod !== 'unique' ? 'block' : 'none'}; margin-top:6px;">
                  <div class="form-group" style="margin-bottom:4px;">
                    <label style="font-size:11px;">Color Ramp</label>
                    <div style="display:flex; gap:4px; align-items:center;">
                      <div class="ramp-picker" style="flex:1; position:relative;">
                        <button type="button" class="ramp-picker-trigger">
                          <span class="ramp-bar"></span>
                          <span class="ramp-label">Random</span>
                          <span class="ramp-arrow">▼</span>
                        </button>
                        <div class="ramp-picker-dropdown"></div>
                      </div>
                      <button class="ramp-reverse-btn" type="button" title="Reverse ramp" style="display:flex; align-items:center; justify-content:center; width:28px; height:28px; background:var(--bg-card); border:1px solid var(--border-color); border-radius:var(--radius-md); color:var(--text-muted); cursor:pointer; flex-shrink:0;">↕</button>
                    </div>
                  </div>
                </div>
              </div>
              <div class="category-list" style="display: ${layer.symbologyField ? 'block' : 'none'};"></div>
            </div>
          </div>
        </div>

        <div class="collapsible-section">
          <div class="collapsible-header" data-section="settings" data-layer="${layer.id}">
            <span class="collapsible-title">Layer Settings</span>
            <span class="collapsible-chevron ${layer.settingsExpanded ? 'open' : ''}">▶</span>
          </div>
          <div class="collapsible-content" style="display: ${layer.settingsExpanded ? 'block' : 'none'};">
            <div class="point-symbol-panel" style="display: ${layerHasPoints(layer) ? 'block' : 'none'}; margin-bottom: 8px;">
          <div class="form-group">
            <label>Point symbol</label>
            <select class="point-symbol-type">
              <option value="circle" ${(layer.pointSymbolType || 'circle') === 'circle' ? 'selected' : ''}>Circle</option>
              <option value="square" ${layer.pointSymbolType === 'square' ? 'selected' : ''}>Square</option>
              <option value="triangle" ${layer.pointSymbolType === 'triangle' ? 'selected' : ''}>Triangle</option>
              <option value="custom" ${layer.pointSymbolType === 'custom' ? 'selected' : ''}>Custom image</option>
            </select>
          </div>
          <div class="point-size-row" style="margin-bottom:8px;">
            <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
              <label>Symbol size</label>
              <span class="point-size-value" style="font-size:10px; color:var(--accent); font-weight:bold;">${layer.pointSize ?? 10}px</span>
            </div>
            <input type="range" class="point-size" min="4" max="32" value="${layer.pointSize ?? 10}" style="width:100%; accent-color:var(--accent);" />
          </div>
          <div class="custom-symbol-panel" style="display: ${layer.pointSymbolType === 'custom' ? 'block' : 'none'};">
            <label style="font-size:11px;">Upload symbol image</label>
            <div class="btn-upload-trigger custom-symbol-trigger" style="padding:12px; margin-top:4px;">
              <span style="font-size:12px; font-weight:600;">Choose image</span>
              <span style="font-size:10px; color:var(--text-muted); display:block; margin-top:2px;">PNG, JPG, or SVG</span>
            </div>
            <input type="file" class="custom-symbol-file" accept="image/*" style="display:none;" />
            ${layer.customSymbolUrl ? `<img class="custom-symbol-preview" src="${layer.customSymbolUrl}" alt="Symbol preview" style="max-width:48px; max-height:48px; margin-top:8px; border-radius:4px; border:1px solid var(--border-color);" />` : ''}
          </div>
          <div class="point-stroke-controls" style="display: ${layer.pointSymbolType !== 'custom' ? 'block' : 'none'}; margin-top: 8px;">
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
              <label style="margin-bottom:0; flex:1;">Stroke color</label>
              <input type="color" class="point-stroke-color" value="${getPointStrokeColor(layer)}" style="background:none; border:none; cursor:pointer; width:30px; height:24px;" />
            </div>
            <div style="margin-bottom:8px;">
              <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
                <label>Stroke width</label>
                <span class="point-stroke-width-value" style="font-size:10px; color:var(--accent); font-weight:bold;">${layer.pointStrokeWidth ?? 2}px</span>
              </div>
              <input type="range" class="point-stroke-width" min="0" max="10" step="0.5" value="${layer.pointStrokeWidth ?? 2}" style="width:100%; accent-color:var(--accent);" />
            </div>
          </div>
          <span style="font-size:10px; color:var(--text-muted); display:block; margin-top:6px;">Fill color uses symbology above. Opacity applies to the whole symbol.</span>
        </div>

        <div class="vector-border-panel" style="display: ${layerHasLinesOrPolygons(layer) ? 'block' : 'none'};">
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
          <label style="margin-bottom:0; flex:1;">Border Color</label>
          <input type="color" class="stroke-color" value="${layer.strokeColor || layer.color}" style="background:none; border:none; cursor:pointer; width:30px; height:24px;" />
        </div>

        <div style="margin-bottom:8px;">
          <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
            <label>Line Thickness</label>
            <span class="layer-weight-value" style="font-size:10px; color:var(--accent); font-weight:bold;">${layer.weight ? layer.weight + 'px' : 'No border'}</span>
          </div>
          <input type="range" class="layer-weight" min="0" max="6" value="${layer.weight}" style="width:100%; accent-color:var(--accent);" />
        </div>
        <div style="margin-bottom:8px;">
          <label style="display:flex; align-items:center; gap:6px; cursor:pointer; font-size:11px;">
            <input type="checkbox" class="layer-nofill" ${layer.noFill ? 'checked' : ''} style="accent-color:var(--accent);" />
            Transparent fill (stroke only)
          </label>
        </div>
        </div>
        <div>
          <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
            <label>Layer Opacity</label>
            <span class="layer-opacity-value" style="font-size:10px; color:var(--accent); font-weight:bold;">${Math.round((layer.opacity ?? 0.4) * 100)}%</span>
          </div>
          <input type="range" class="layer-opacity" min="0" max="100" value="${Math.round((layer.opacity ?? 0.4) * 100)}" style="width:100%; accent-color:var(--accent);" />
        </div>

        <div class="popup-config-panel">
          <div class="form-group" style="margin-bottom:8px;">
            <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
              <input type="checkbox" class="popup-enabled" ${layer.popupEnabled !== false ? 'checked' : ''} style="accent-color:var(--accent);" />
              Show popup on click
            </label>
          </div>
          <div class="popup-settings" style="display:${layer.popupEnabled !== false ? 'block' : 'none'};">
            <div class="form-group">
              <label>Popup title</label>
              <input type="text" class="popup-title" value="${escapeHtml(layer.popupTitle || '')}" placeholder="${escapeHtml(layer.name)} or {fieldName}" />
              <span style="font-size:10px; color:var(--text-muted);">Leave blank for layer name. Use {attribute} for feature values.</span>
            </div>
            <div class="form-group">
              <label>Attributes to show</label>
              <select class="popup-field-mode">
                <option value="all" ${!Array.isArray(layer.popupFields) ? 'selected' : ''}>All attributes</option>
                <option value="selected" ${Array.isArray(layer.popupFields) ? 'selected' : ''}>Selected only</option>
              </select>
              <div class="popup-field-list" style="display:${Array.isArray(layer.popupFields) ? 'block' : 'none'}; margin-top:6px; max-height:100px; overflow-y:auto; border:1px solid var(--border-color); border-radius:var(--radius-md); padding:6px; background:rgba(0,0,0,0.2);"></div>
            </div>
            <div class="form-group">
              <label>Custom template (optional)</label>
              <textarea class="popup-template" rows="3" placeholder="e.g. Name: {name}&#10;Population: {pop}">${escapeHtml(layer.popupTemplate || '')}</textarea>
              <span style="font-size:10px; color:var(--text-muted);">Overrides attribute list. One line per row. Use {fieldName} tokens.</span>
            </div>
            <label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-size:11px;">
              <input type="checkbox" class="popup-show-labels" ${layer.popupShowLabels !== false ? 'checked' : ''} style="accent-color:var(--accent);" />
              Show attribute labels
            </label>
          </div>
        </div>
        <div style="margin-top:10px; border-top:1px solid rgba(255,255,255,0.06); padding-top:8px;">
          <button type="button" class="btn-secondary layer-label-btn" style="font-size:11px; padding:7px 0;">Labels${layer.labelEnabled && layer.labelField ? `: ${layer.labelField}` : ''}</button>
        </div>
          </div>
        </div>
      </div>
    `;

    const nameInput = div.querySelector('.layer-name-input');
    nameInput.addEventListener('change', () => renameLayer(layer.id, nameInput.value));
    nameInput.addEventListener('blur', () => renameLayer(layer.id, nameInput.value));
    nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        nameInput.blur();
      }
    });

    // Event attachments
    div.querySelector('.layer-checkbox').onchange = () => toggleLayer(layer.id);
    const weightInput = div.querySelector('.layer-weight');
    const weightLabel = div.querySelector('.layer-weight-value');
    weightInput.addEventListener('input', (e) => {
      const w = parseInt(e.target.value, 10);
      if (weightLabel) weightLabel.textContent = w ? `${w}px` : 'No border';
      updateStyle(layer.id, 'weight', w, { renderUI: false });
    });

    const opacityInput = div.querySelector('.layer-opacity');
    const opacityLabel = div.querySelector('.layer-opacity-value');
    opacityInput.addEventListener('input', (e) => {
      const pct = parseInt(e.target.value, 10);
      if (opacityLabel) opacityLabel.textContent = `${pct}%`;
      updateStyle(layer.id, 'opacity', pct / 100, { renderUI: false });
    });

    const noFillCheck = div.querySelector('.layer-nofill');
    if (noFillCheck) {
      noFillCheck.addEventListener('change', () => updateStyle(layer.id, 'noFill', noFillCheck.checked));
    }

    const strokeColorInput = div.querySelector('.stroke-color');
    strokeColorInput.addEventListener('input', (e) => {
      updateStyle(layer.id, 'strokeColor', e.target.value, { renderUI: false });
    });
    div.querySelector('.btn-up').onclick = () => moveLayer(i, 1);
    div.querySelector('.btn-down').onclick = () => moveLayer(i, -1);
    div.querySelector('.btn-delete-layer').onclick = () => deleteLayer(layer.id);

    const pointPanel = div.querySelector('.point-symbol-panel');
    if (pointPanel) {
      const symbolTypeEl = pointPanel.querySelector('.point-symbol-type');
      const pointSizeEl = pointPanel.querySelector('.point-size');
      const pointSizeLabel = pointPanel.querySelector('.point-size-value');
      const customFile = pointPanel.querySelector('.custom-symbol-file');
      const customTrigger = pointPanel.querySelector('.custom-symbol-trigger');

      if (symbolTypeEl) {
        symbolTypeEl.onchange = (e) => updateStyle(layer.id, 'pointSymbolType', e.target.value);
      }
      if (pointSizeEl) {
        pointSizeEl.addEventListener('input', (e) => {
          const sz = parseInt(e.target.value, 10);
          if (pointSizeLabel) pointSizeLabel.textContent = `${sz}px`;
          updateStyle(layer.id, 'pointSize', sz, { renderUI: false });
        });
      }
      if (customTrigger && customFile) {
        customTrigger.onclick = () => customFile.click();
        customFile.onchange = (e) => {
          const file = e.target.files[0];
          if (file) handleCustomSymbolUpload(layer.id, file);
          e.target.value = '';
        };
      }

      const pointStrokeColorEl = pointPanel.querySelector('.point-stroke-color');
      const pointStrokeWidthEl = pointPanel.querySelector('.point-stroke-width');
      if (pointStrokeColorEl) {
        pointStrokeColorEl.addEventListener('input', (e) => {
          updateStyle(layer.id, 'pointStrokeColor', e.target.value, { renderUI: false });
        });
        pointStrokeColorEl.addEventListener('change', () => updateStyle(layer.id, 'pointStrokeColor', pointStrokeColorEl.value));
      }
      if (pointStrokeWidthEl) {
        const strokeWidthLabel = div.querySelector('.point-stroke-width-value');
        pointStrokeWidthEl.addEventListener('input', (e) => {
          const w = parseFloat(e.target.value);
          if (strokeWidthLabel) strokeWidthLabel.textContent = `${w}px`;
          updateStyle(layer.id, 'pointStrokeWidth', w, { renderUI: false });
        });
      }
    }

    const popupPanel = div.querySelector('.popup-config-panel');
    if (popupPanel) {
      const enabledEl = popupPanel.querySelector('.popup-enabled');
      const settingsEl = popupPanel.querySelector('.popup-settings');
      const titleEl = popupPanel.querySelector('.popup-title');
      const modeEl = popupPanel.querySelector('.popup-field-mode');
      const fieldListEl = popupPanel.querySelector('.popup-field-list');
      const templateEl = popupPanel.querySelector('.popup-template');
      const labelsEl = popupPanel.querySelector('.popup-show-labels');

      const selectedFields = new Set(
        Array.isArray(layer.popupFields) ? layer.popupFields : layer.fields
      );

      function renderPopupFieldList() {
        if (!fieldListEl) return;
        fieldListEl.innerHTML = '';
        layer.fields.forEach(f => {
          const label = document.createElement('label');
          label.style.cssText = 'display:flex;align-items:center;gap:6px;font-size:11px;margin-bottom:4px;cursor:pointer;color:var(--text-secondary);';
          const checked = selectedFields.has(f) ? 'checked' : '';
          label.innerHTML = `<input type="checkbox" value="${escapeHtml(f)}" ${checked} style="accent-color:var(--accent);"/> <span>${escapeHtml(f)}</span>`;
          label.querySelector('input').addEventListener('change', (e) => {
            if (e.target.checked) selectedFields.add(f);
            else selectedFields.delete(f);
            updateLayerPopup(layer.id, { popupFields: [...selectedFields] }, { renderUI: false });
          });
          fieldListEl.appendChild(label);
        });
      }

      if (Array.isArray(layer.popupFields) && fieldListEl) {
        renderPopupFieldList();
      }

      if (enabledEl) {
        enabledEl.addEventListener('change', () => {
          const on = enabledEl.checked;
          if (settingsEl) settingsEl.style.display = on ? 'block' : 'none';
          updateLayerPopup(layer.id, { popupEnabled: on });
        });
      }
      if (titleEl) {
        titleEl.addEventListener('input', () => {
          updateLayerPopup(layer.id, { popupTitle: titleEl.value }, { renderUI: false });
        });
      }
      if (modeEl && fieldListEl) {
        modeEl.addEventListener('change', () => {
          if (modeEl.value === 'all') {
            fieldListEl.style.display = 'none';
            updateLayerPopup(layer.id, { popupFields: null });
          } else {
            fieldListEl.style.display = 'block';
            layer.fields.forEach(f => selectedFields.add(f));
            renderPopupFieldList();
            updateLayerPopup(layer.id, { popupFields: [...selectedFields] });
          }
        });
      }
      if (templateEl) {
        templateEl.addEventListener('input', () => {
          updateLayerPopup(layer.id, { popupTemplate: templateEl.value }, { renderUI: false });
        });
      }
      if (labelsEl) {
        labelsEl.addEventListener('change', () => {
          updateLayerPopup(layer.id, { popupShowLabels: labelsEl.checked });
        });
      }
    }

    const labelBtn = div.querySelector('.layer-label-btn');
    if (labelBtn) {
      labelBtn.addEventListener('click', () => openLabelEditor(layer));
    }

    const symbologyHeader = div.querySelector('[data-section="symbology"]');
    if (symbologyHeader) {
      symbologyHeader.addEventListener('click', (e) => {
        e.stopPropagation();
        layer.symbologyExpanded = !layer.symbologyExpanded;
        renderUI();
      });
    }

    const settingsHeader = div.querySelector('[data-section="settings"]');
    if (settingsHeader) {
      settingsHeader.addEventListener('click', (e) => {
        e.stopPropagation();
        layer.settingsExpanded = !layer.settingsExpanded;
        renderUI();
      });
    }

    div.querySelector('.symbology-type').onchange = (e) => updateStyle(layer.id, "symbologyType", e.target.value);
    const singleColorInput = div.querySelector('.single-color');
    if (singleColorInput) {
      singleColorInput.addEventListener('input', (e) => {
        updateStyle(layer.id, 'color', e.target.value, { renderUI: false });
      });
      singleColorInput.addEventListener('change', (e) => {
        updateStyle(layer.id, 'color', e.target.value);
      });
    }
    div.querySelector('.symbology-field').onchange = (e) => updateStyle(layer.id, 'symbologyField', e.target.value);

    const classifyOptions = div.querySelector('.classify-options');
    if (classifyOptions) {
      const classifyMethodEl = classifyOptions.querySelector('.classify-method');
      const classCountEl = classifyOptions.querySelector('.class-count');
      const manualLimitsDiv = classifyOptions.querySelector('.manual-class-limits');

      if (classifyMethodEl) {
        classifyMethodEl.onchange = (e) => updateStyle(layer.id, 'classifyMethod', e.target.value);
      }
      if (classCountEl) {
        classCountEl.onchange = (e) => updateStyle(layer.id, 'classCount', parseInt(e.target.value, 10) || 5);
      }

      if (manualLimitsDiv && layer.classifyMethod === 'manual-intervals') {
        migrateLegacyBreaks(layer);
        ensureClassLimits(layer);
        layer.classLimits.forEach((limit, idx) => {
          const isLast = idx === layer.classLimits.length - 1;
          const row = document.createElement('div');
          row.className = 'class-limit-row';
          row.style.marginBottom = '6px';
          const displayVal = limit !== null && limit !== '' && isFinite(Number(limit)) ? limit : '';
          row.innerHTML = `
            <label style="font-size:11px; margin-bottom:4px;">Class ${idx + 1}${isLast ? ' (optional)' : ''}</label>
            <input type="number" step="any" class="class-limit-input" data-index="${idx}"
              value="${displayVal}" placeholder="${isLast ? 'No limit (e.g. > 20)' : 'Upper limit'}" />
          `;
          const input = row.querySelector('.class-limit-input');
          input.addEventListener('change', () => {
            const raw = input.value.trim();
            layer.classLimits[idx] = raw === '' ? null : Number(raw);
            updateStyle(layer.id, 'classLimits', layer.classLimits);
          });
          input.addEventListener('input', () => {
            const raw = input.value.trim();
            layer.classLimits[idx] = raw === '' ? null : Number(raw);
          });
          manualLimitsDiv.appendChild(row);
        });
      }

      const rampPanel = classifyOptions.querySelector('.color-ramp-panel');
      if (rampPanel) {
        const picker = rampPanel.querySelector('.ramp-picker');
        const trigger = picker.querySelector('.ramp-picker-trigger');
        const rampBar = trigger.querySelector('.ramp-bar');
        const rampLabel = trigger.querySelector('.ramp-label');
        const dropdown = picker.querySelector('.ramp-picker-dropdown');
        const rampBtn = rampPanel.querySelector('.ramp-reverse-btn');

        function rampGradientCSS(stops) {
          return `linear-gradient(to right, ${stops.join(', ')})`;
        }

        function updateTrigger() {
          const key = layer.colorRamp || '';
          if (key && COLOR_RAMPS[key]) {
            const s = layer.colorRampReversed ? [...COLOR_RAMPS[key].stops].reverse() : COLOR_RAMPS[key].stops;
            rampBar.style.background = rampGradientCSS(s);
            rampLabel.textContent = COLOR_RAMPS[key].name;
          } else {
            rampBar.style.background = '';
            rampLabel.textContent = 'Random';
          }
          rampBtn.style.color = layer.colorRampReversed && layer.colorRamp ? 'var(--accent)' : 'var(--text-muted)';
          rampBtn.style.borderColor = layer.colorRampReversed && layer.colorRamp ? 'var(--accent)' : 'var(--border-color)';
        }

        function selectRamp(key) {
          if (key) {
            layer.colorRamp = key;
            const keys = Object.keys(layer.categories).filter(k => k !== '__non_numeric__');
            const r = COLOR_RAMPS[key];
            const stops = layer.colorRampReversed ? [...r.stops].reverse() : r.stops;
            const colors = interpolateColors(stops, keys.length);
            keys.forEach((k, i) => { layer.categories[k] = colors[i]; });
          } else {
            layer.colorRamp = '';
            layer.colorRampReversed = false;
            const keys = Object.keys(layer.categories).filter(k => k !== '__non_numeric__');
            keys.forEach(k => { layer.categories[k] = getRandomColor(); });
          }
          updateTrigger();
          closeDropdown();
          if (layerHasPoints(layer)) { rebuildLeafletLayer(layer); } else { refreshLayerStyle(layer); renderUI(); }
        }

        function closeDropdown() {
          dropdown.classList.remove('open');
          document.removeEventListener('click', closeOnClickOutside);
        }

        function closeOnClickOutside(e) {
          if (!picker.contains(e.target)) closeDropdown();
        }

        function openDropdown() {
          dropdown.innerHTML = '';
          const randomOpt = document.createElement('div');
          randomOpt.className = 'ramp-picker-option' + (!layer.colorRamp ? ' selected' : '');
          randomOpt.innerHTML = '<span class="ramp-opt-bar"></span><span>Random</span>';
          randomOpt.addEventListener('click', () => selectRamp(''));
          dropdown.appendChild(randomOpt);

          Object.entries(COLOR_RAMPS).forEach(([key, r]) => {
            const stops = layer.colorRampReversed ? [...r.stops].reverse() : r.stops;
            const opt = document.createElement('div');
            opt.className = 'ramp-picker-option' + (key === layer.colorRamp ? ' selected' : '');
            opt.innerHTML = `<span class="ramp-opt-bar" style="background:${rampGradientCSS(stops)}"></span><span>${r.name}</span>`;
            opt.addEventListener('click', () => selectRamp(key));
            dropdown.appendChild(opt);
          });

          dropdown.classList.add('open');
          setTimeout(() => document.addEventListener('click', closeOnClickOutside), 0);
        }

        trigger.addEventListener('click', (e) => {
          e.stopPropagation();
          if (dropdown.classList.contains('open')) { closeDropdown(); }
          else { openDropdown(); }
        });

        updateTrigger();

        rampBtn.onclick = () => {
          layer.colorRampReversed = !layer.colorRampReversed;
          const val = layer.colorRamp || '';
          if (val) {
            const r = COLOR_RAMPS[val];
            const stops = layer.colorRampReversed ? [...r.stops].reverse() : r.stops;
            const keys = Object.keys(layer.categories).filter(k => k !== '__non_numeric__');
            const colors = interpolateColors(stops, keys.length);
            keys.forEach((k, i) => { layer.categories[k] = colors[i]; });
          }
          updateTrigger();
          if (layerHasPoints(layer)) { rebuildLeafletLayer(layer); } else { refreshLayerStyle(layer); renderUI(); }
        };
      }
    }

    if (layer.symbologyType === 'categorized' && layer.symbologyField) {
      const catListDiv = div.querySelector('.category-list');
      const isPoints = layerHasPoints(layer);
      const orderedKeys = getOrderedCategoryKeys(layer);
      orderedKeys.forEach(catKey => {
        if (!layer.categories[catKey]) return;
        const catRow = document.createElement('div');
        catRow.style.cssText = 'display:flex; align-items:center; gap:6px; margin-bottom:4px; font-size:11px; color:var(--text-secondary);';

        const colorInput = document.createElement('input');
        colorInput.type = 'color';
        colorInput.value = layer.categories[catKey];
        colorInput.style.cssText = 'width:22px; height:18px; border:0; padding:0; background:none; cursor:pointer; flex-shrink:0;';
        colorInput.addEventListener('input', (e) => {
          updateCategoryColor(layer.id, catKey, e.target.value, { renderUI: false });
        });
        colorInput.addEventListener('change', (e) => {
          updateCategoryColor(layer.id, catKey, e.target.value);
        });
        catRow.appendChild(colorInput);

        if (isPoints) {
          const catSym = layer.categorySymbols?.[catKey] || {};
          const symType = catSym.pointSymbolType || layer.pointSymbolType || 'circle';
          const symColor = catSym.pointColor || layer.categories[catKey] || '#3b82f6';
          const symStrokeColor = catSym.pointStrokeColor || layer.pointStrokeColor || '#ffffff';
          const symStrokeWidth = catSym.pointStrokeWidth ?? layer.pointStrokeWidth ?? 2;
          const symSize = catSym.pointSize || layer.pointSize || 10;
          const symCustomUrl = catSym.customSymbolUrl || layer.customSymbolUrl || '';
          const symPreview = document.createElement('span');
          symPreview.title = 'Click to edit symbol';
          symPreview.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;width:22px;height:18px;cursor:pointer;border-radius:4px;flex-shrink:0;overflow:hidden;';
          symPreview.addEventListener('mouseenter', () => symPreview.style.background = 'rgba(255,255,255,0.1)');
          symPreview.addEventListener('mouseleave', () => symPreview.style.background = 'none');
          if (symType === 'custom' && symCustomUrl) {
            symPreview.innerHTML = `<img src="${symCustomUrl}" alt="" style="width:14px;height:14px;object-fit:contain;" />`;
          } else {
            const type = symType === 'custom' ? 'circle' : symType;
            symPreview.innerHTML = buildPointSymbolHtml(type, symColor, symStrokeColor, 5, symStrokeWidth);
          }
          symPreview.addEventListener('click', () => openCategorySymbolEditor(layer, catKey));
          catRow.appendChild(symPreview);
        }

        const label = document.createElement('span');
        label.style.cssText = 'overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1;';
        label.textContent = getCategoryDisplayLabel(layer, catKey);
        catRow.appendChild(label);

        catListDiv.appendChild(catRow);
      });
    }

    layersDiv.appendChild(div);

    const legendGroup = document.createElement('div');
    legendGroup.className = 'legend-group';

    const legendItem = document.createElement('div');
    legendItem.className = 'legend-item';
    legendItem.innerText = layer.name;
    legendGroup.appendChild(legendItem);

    if (layer.symbologyType === 'single') {
      const subItem = document.createElement('div');
      subItem.className = 'legend-subitem';
      const swatch = layerHasPoints(layer)
        ? getLegendPointSwatch(layer, layer.color)
        : `<span style="background:${layer.color}"></span>`;
      subItem.innerHTML = `${swatch} All features`;
      legendGroup.appendChild(subItem);
    } else if (layer.symbologyType === 'categorized' && layer.symbologyField) {
      const sortMode = layer.categorySortMode || 'asc';
      const sortBar = document.createElement('div');
      sortBar.className = 'legend-sort-bar';
      const isAsc = sortMode === 'asc' || sortMode === 'numeric-asc';
      const isNumeric = sortMode === 'numeric-asc' || sortMode === 'numeric-desc';
      const btnLabel = isAsc
        ? (isNumeric ? '↑ 1→9' : '↑ A→Z')
        : (isNumeric ? '↓ 9→1' : '↓ Z→A');
      const toggleBtn = document.createElement('button');
      toggleBtn.type = 'button';
      toggleBtn.className = 'legend-sort-btn active';
      toggleBtn.textContent = btnLabel;
      toggleBtn.onclick = () => toggleCategorySort(layer.id);
      sortBar.appendChild(toggleBtn);
      legendGroup.appendChild(sortBar);

      const orderedKeys = getOrderedCategoryKeys(layer);
      orderedKeys.forEach((catKey) => {
        const row = document.createElement('div');
        row.className = 'legend-subitem-row';
        row.draggable = true;

        row.addEventListener('dragstart', (e) => {
          e.dataTransfer.setData('text/plain', catKey);
          row.classList.add('dragging');
        });

        row.addEventListener('dragover', (e) => {
          e.preventDefault();
          row.classList.add('drag-over');
        });

        row.addEventListener('dragleave', () => {
          row.classList.remove('drag-over');
        });

        row.addEventListener('drop', (e) => {
          e.preventDefault();
          row.classList.remove('drag-over');
          const draggedKey = e.dataTransfer.getData('text/plain');
          if (!draggedKey || draggedKey === catKey) return;
          const l = layerStore.find(l2 => l2.id === layer.id);
          if (!l) return;
          ensureCategoryOrder(l);
          const order = l.categoryOrder;
          const fromIdx = order.indexOf(draggedKey);
          const toIdx = order.indexOf(catKey);
          if (fromIdx !== -1 && toIdx !== -1) {
            order.splice(fromIdx, 1);
            order.splice(fromIdx < toIdx ? toIdx - 1 : toIdx, 0, draggedKey);
            renderUI();
          }
        });

        row.addEventListener('dragend', () => {
          document.querySelectorAll('.legend-subitem-row.dragging, .legend-subitem-row.drag-over').forEach(el => {
            el.classList.remove('dragging', 'drag-over');
          });
        });

        const subItem = document.createElement('div');
        subItem.className = 'legend-subitem';
        const swatch = layerHasPoints(layer)
          ? getLegendPointSwatch(layer, layer.categories[catKey], catKey)
          : `<span style="background:${layer.categories[catKey]}"></span>`;
        subItem.innerHTML = swatch;

        const labelSpan = document.createElement('span');
        labelSpan.className = 'cat-label';
        labelSpan.textContent = getCategoryDisplayLabel(layer, catKey);
        labelSpan.addEventListener('dblclick', () => {
          const input = document.createElement('input');
          input.type = 'text';
          input.value = labelSpan.textContent;
          input.className = 'cat-label-input';
          input.style.cssText = 'font-size:12px;padding:6px 8px;border:1px solid var(--accent);border-radius:3px;background:var(--bg-primary);color:var(--text-primary);width:100%;outline:none;box-sizing:border-box;';

          const finish = (save) => {
            if (save && input.value.trim()) {
              if (!layer.customCategoryLabels) layer.customCategoryLabels = {};
              layer.customCategoryLabels[catKey] = input.value.trim();
              renderUI();
            } else if (save && !input.value.trim() && layer.customCategoryLabels?.[catKey]) {
              delete layer.customCategoryLabels[catKey];
              renderUI();
            } else {
              labelSpan.style.display = '';
            }
            input.remove();
          };

          input.addEventListener('blur', () => finish(true));
          input.addEventListener('keydown', (ev) => {
            if (ev.key === 'Enter') finish(true);
            if (ev.key === 'Escape') finish(false);
          });

          labelSpan.style.display = 'none';
          labelSpan.parentNode.insertBefore(input, labelSpan);
          input.focus();
          input.select();
        });

        subItem.appendChild(labelSpan);
        row.appendChild(subItem);

        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'legend-del-btn';
        delBtn.title = 'Remove category';
        delBtn.textContent = '×';
        delBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          delete layer.categories[catKey];
          delete layer.customCategoryLabels?.[catKey];
          delete layer.categorySymbols?.[catKey];
          if (layer.categoryOrder) layer.categoryOrder = layer.categoryOrder.filter(k => k !== catKey);
          if (layerHasPoints(layer)) { rebuildLeafletLayer(layer); }
          else { refreshLayerStyle(layer); renderUI(); }
        });
        row.appendChild(delBtn);

        legendGroup.appendChild(row);
      });
    }

    legendDiv.appendChild(legendGroup);
  }
}

// =========================
// BASEMAP
// =========================

document.getElementById('basemapOptions').addEventListener('change', (e) => {
  const label = e.target.closest('.basemap-option');
  if (!label || !e.target.matches('input[type="radio"]')) return;
  const name = e.target.value;
  setBasemap(name);
  document.querySelectorAll('.basemap-option').forEach(el => el.classList.remove('active'));
  label.classList.add('active');
});

document.querySelectorAll('input[name="searchMode"]').forEach(el => {
  el.addEventListener('change', (e) => {
    if (!e.target.checked) return;
    searchMode = e.target.value;
    const ctrl = document.querySelector('.map-search-control');
    if (!ctrl) return;
    if (searchMode === 'off') { ctrl.style.display = 'none'; return; }
    ctrl.style.display = 'flex';
    const tog = ctrl.querySelector('#mapToggleMode');
    const inp = ctrl.querySelector('#mapSearchBox');
    const btn = ctrl.querySelector('#mapSearchBtn');
    const dd = ctrl.querySelector('.map-search-dropdown');
    if (searchMode === 'pin') {
      if (tog) tog.style.display = 'none';
      inp.placeholder = 'lat, lon (e.g. 43.86, -79.29)';
      btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>';
      dd.innerHTML = '<div class="map-pin-hint">Enter coordinates as <b>lat, lon</b> then press Enter or click the pin button.</div>';
      dd.style.display = 'block';
    } else {
      if (tog) tog.style.display = '';
      inp.placeholder = 'Search places\u2026';
      btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';
      dd.innerHTML = '';
      dd.style.display = '';
    }
    inp.value = '';
  });
});

// =========================
// MAP SEARCH / PIN CONTROL
// =========================

const MapSearchControl = L.Control.extend({
  options: { position: 'topright' },
  onAdd: function(map) {
    const container = L.DomUtil.create('div', 'leaflet-bar map-search-control');
    const inner = L.DomUtil.create('div', 'map-search-inner', container);
    inner.innerHTML = `
      <input type="text" id="mapSearchBox" placeholder="Search places…" />
      <button type="button" id="mapSearchBtn" aria-label="Search">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      </button>
      <button type="button" id="mapToggleMode" class="map-mode-toggle" aria-label="Toggle pin mode" title="Switch to pin coordinates">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
      </button>
    `;
    const dropdown = L.DomUtil.create('div', 'map-search-dropdown', container);
    L.DomEvent.disableClickPropagation(container);

    const input = inner.querySelector('#mapSearchBox');
    const searchBtn = inner.querySelector('#mapSearchBtn');
    const toggleBtn = inner.querySelector('#mapToggleMode');

    let isPinMode = false;
    let timer;

    // Initialize based on searchMode
    if (searchMode === 'off') { container.style.display = 'none'; }
    if (searchMode === 'pin' && toggleBtn) { toggleBtn.style.display = 'none'; setPinnedMode(); }

    function setPinnedMode() {
      isPinMode = true;
      input.placeholder = 'lat, lon (e.g. 43.86, -79.29)';
      searchBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>';
      searchBtn.title = 'Place pin';
      dropdown.style.display = 'block';
      dropdown.innerHTML = '<div class="map-pin-hint">Enter coordinates as <b>lat, lon</b> then press Enter or click the pin button.</div>';
      input.value = '';
    }

    function setSearchMode() {
      isPinMode = false;
      input.placeholder = 'Search places\u2026';
      searchBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';
      searchBtn.title = 'Search';
      dropdown.innerHTML = '';
      dropdown.style.display = '';
      input.value = '';
    }

    function setMode(pinMode) {
      if (pinMode) setPinnedMode(); else setSearchMode();
      if (toggleBtn) {
        toggleBtn.title = pinMode ? 'Switch to search' : 'Switch to pin coordinates';
        toggleBtn.innerHTML = pinMode
          ? '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>'
          : '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>';
      }
    }

    function placePin(lat, lon) {
      map.setView([lat, lon], 14);
      if (searchMarker) map.removeLayer(searchMarker);
      searchMarker = L.marker([lat, lon]).addTo(map);
      searchMarker.bindPopup(`<div style="font-size:12px; color:white;">${lat}, ${lon}</div>`).openPopup();
    }

    function doAction() {
      if (isPinMode) {
        const parts = input.value.split(',').map(s => s.trim());
        if (parts.length === 2) {
          const lat = parseFloat(parts[0]);
          const lon = parseFloat(parts[1]);
          if (!isNaN(lat) && !isNaN(lon)) {
            placePin(lat, lon);
            dropdown.innerHTML = `<div class="map-pin-hint">📍 Pin placed at <b>${lat}, ${lon}</b></div>`;
            return;
          }
        }
        dropdown.innerHTML = '<div class="map-pin-hint" style="color:#ef5350;">Invalid format. Use: <b>lat, lon</b> (e.g. 43.86, -79.29)</div>';
      } else {
        const q = input.value.trim();
        if (q.length < 3) return;
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=5&countrycodes=ca`;
        fetch(url)
          .then(r => r.json())
          .then(data => {
            dropdown.innerHTML = '';
            data.forEach(r => {
              const div = document.createElement('div');
              div.textContent = r.display_name;
              div.addEventListener('click', () => {
                const lat = parseFloat(r.lat), lon = parseFloat(r.lon);
                map.setView([lat, lon], 14);
                if (searchMarker) map.removeLayer(searchMarker);
                searchMarker = L.marker([lat, lon]).addTo(map);
                searchMarker.bindPopup(`<div style="font-size:12px; color:white;">${r.display_name}</div>`).openPopup();
                dropdown.innerHTML = '';
                input.value = r.display_name;
              });
              dropdown.appendChild(div);
            });
          })
          .catch(() => {});
      }
    }

    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doAction(); });
    searchBtn.addEventListener('click', doAction);

    if (searchMode === 'both') {
      const terms = L.DomUtil.create('div', 'map-search-terms', container);
      terms.textContent = 'Geocoding: © OpenStreetMap / Nominatim';
    }

    return container;
  }
});

new MapSearchControl().addTo(map);

// Refresh warning
window.addEventListener('beforeunload', (e) => {
  if (layerStore.length > 0 || projectTitle || dataNote) {
    e.preventDefault();
    e.returnValue = '';
  }
});

// Drag-and-drop file upload
const dropZone = document.getElementById('map');
dropZone.addEventListener('dragover', (e) => { e.preventDefault(); });
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  const files = e.dataTransfer.files;
  if (files.length) {
    const dt = new DataTransfer();
    dt.items.add(files[0]);
    document.getElementById('fileInput').files = dt.files;
    handleFile({ target: { files: dt.files } });
  }
});

// =========================
// MAP EXPORTER ENGINE
// =========================

document.getElementById("exportBtn").addEventListener("click", exportHTML);
document.getElementById("saveProjectBtn").addEventListener("click", saveProject);
document.getElementById("loadProjectBtn").addEventListener("click", () => {
  document.getElementById("projectInput").click();
});
document.getElementById("projectInput").addEventListener("change", handleProjectFile);

function getLayerExportPayload(l) {
  return {
    id: l.id,
    name: l.name,
    geojson: l.geojson,
    color: l.color,
    strokeColor: l.strokeColor || l.color,
    weight: l.weight,
    opacity: l.opacity ?? 0.4,
    noFill: l.noFill || false,
    pointSymbolType: l.pointSymbolType || 'circle',
    pointSize: l.pointSize ?? 10,
    pointStrokeColor: l.pointStrokeColor || null,
    pointStrokeWidth: l.pointStrokeWidth ?? 2,
    customSymbolUrl: l.customSymbolUrl || null,
    popupEnabled: l.popupEnabled !== false,
    popupTitle: l.popupTitle || '',
    popupFields: l.popupFields,
    popupTemplate: l.popupTemplate || '',
    popupShowLabels: l.popupShowLabels !== false,
    visible: l.visible,
    symbologyType: l.symbologyType,
    symbologyField: l.symbologyField,
    categories: l.categories,
    categorySymbols: l.categorySymbols || {},
    categorySortMode: l.categorySortMode || 'asc',
    categoryOrder: l.categoryOrder || [],
    classifyMethod: l.classifyMethod || 'unique',
    classCount: l.classCount || 5,
    classLimits: l.classLimits || [],
    intervals: l.intervals || [],
    labelField: l.labelField || '',
    labelEnabled: l.labelEnabled || false,
    labelFont: l.labelFont || 'Arial',
    labelSize: l.labelSize || 12,
    labelColor: l.labelColor || '#ffffff',
    labelStrokeColor: l.labelStrokeColor || '#000000',
    labelStrokeWidth: l.labelStrokeWidth ?? 2
  };
}

function getProjectSnapshot() {
  syncProjectMetaFromUI();
  const center = map.getCenter();
  return {
    version: PROJECT_VERSION,
    title: projectTitle,
    dataNote,
    basemap: currentBasemap,
    searchMode,
    mapView: {
      lat: center.lat,
      lng: center.lng,
      zoom: map.getZoom()
    },
    layerCounter,
    layers: layerStore.map(getLayerExportPayload)
  };
}

function clearAllLayers() {
  layerStore.forEach(layer => {
    map.removeLayer(layer.leafletLayer);
  });
  layerStore = [];
}

function loadProjectSnapshot(snapshot) {
  if (!snapshot || !Array.isArray(snapshot.layers)) {
    throw new Error('Invalid project file');
  }

  clearAllLayers();
  layerCounter = snapshot.layerCounter || 0;
  projectTitle = snapshot.title || '';
  dataNote = snapshot.dataNote || '';
  applyProjectMetaToUI();

  snapshot.layers.forEach(layerData => {
    createLayer({
      id: layerData.id,
      name: layerData.name,
      geojson: layerData.geojson,
      color: layerData.color,
      strokeColor: layerData.strokeColor || layerData.color,
      weight: layerData.weight,
      opacity: layerData.opacity ?? 0.4,
      noFill: layerData.noFill || false,
      pointSymbolType: layerData.pointSymbolType || 'circle',
      pointSize: layerData.pointSize ?? 10,
      pointStrokeColor: layerData.pointStrokeColor || null,
      pointStrokeWidth: layerData.pointStrokeWidth ?? 2,
      customSymbolUrl: layerData.customSymbolUrl || null,
      popupEnabled: layerData.popupEnabled !== false,
      popupTitle: layerData.popupTitle || '',
      popupFields: layerData.popupFields,
      popupTemplate: layerData.popupTemplate || '',
      popupShowLabels: layerData.popupShowLabels !== false,
      visible: layerData.visible !== false,
      symbologyType: layerData.symbologyType || 'single',
      symbologyField: layerData.symbologyField || '',
      categories: layerData.categories || {},
      categorySymbols: layerData.categorySymbols || {},
      categorySortMode: layerData.categorySortMode || 'asc',
      categoryOrder: layerData.categoryOrder || [],
      classifyMethod: layerData.classifyMethod || 'unique',
      classCount: layerData.classCount || 5,
      classLimits: layerData.classLimits || layerData.manualBreaks || [],
      intervals: layerData.intervals || [],
      labelField: layerData.labelField || '',
      labelFont: layerData.labelFont || 'Arial',
      labelSize: layerData.labelSize || 12,
      labelColor: layerData.labelColor || '#ffffff',
      labelStrokeColor: layerData.labelStrokeColor || '#000000',
      labelStrokeWidth: layerData.labelStrokeWidth ?? 2
    });
  });

  if (snapshot.mapView) {
    map.setView(
      [snapshot.mapView.lat, snapshot.mapView.lng],
      snapshot.mapView.zoom || 10
    );
  }

  if (snapshot.basemap && BASEMAPS[snapshot.basemap]) {
    setBasemap(snapshot.basemap);
    document.querySelectorAll('.basemap-option').forEach(el => el.classList.remove('active'));
    const lbl = document.querySelector(`.basemap-option[data-basemap="${snapshot.basemap}"]`);
    if (lbl) lbl.classList.add('active');
  }

  if (snapshot.searchMode) {
    searchMode = snapshot.searchMode;
    const radio = document.querySelector(`input[name="searchMode"][value="${searchMode}"]`);
    if (radio) radio.checked = true;
    const ctrl = document.querySelector('.map-search-control');
    if (ctrl) {
      if (searchMode === 'off') { ctrl.style.display = 'none'; }
      else {
        ctrl.style.display = 'flex';
        const tog = ctrl.querySelector('#mapToggleMode');
        const inp = ctrl.querySelector('#mapSearchBox');
        const btn = ctrl.querySelector('#mapSearchBtn');
        const dd = ctrl.querySelector('.map-search-dropdown');
        if (searchMode === 'pin') {
          if (tog) tog.style.display = 'none';
          inp.placeholder = 'lat, lon (e.g. 43.86, -79.29)';
          btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>';
          dd.innerHTML = '<div class="map-pin-hint">Enter coordinates as <b>lat, lon</b> then press Enter or click the pin button.</div>';
          dd.style.display = 'block';
        } else {
          if (tog) tog.style.display = '';
          inp.placeholder = 'Search places\u2026';
          btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';
          dd.innerHTML = '';
          dd.style.display = '';
        }
        inp.value = '';
      }
    }
  }

  renderUI();
  syncMapZIndex();
}

function saveProject() {
  const snapshot = getProjectSnapshot();
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const baseName = (projectTitle || 'map-project').replace(/[^\w\-]+/g, '-').replace(/^-+|-+$/g, '') || 'map-project';

  const a = document.createElement('a');
  a.href = url;
  a.download = `${baseName}.gisproject`;
  a.click();
  URL.revokeObjectURL(url);
}

function handleProjectFile(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(ev) {
    try {
      const snapshot = JSON.parse(ev.target.result);
      loadProjectSnapshot(snapshot);
    } catch (err) {
      alert('Could not open project file. Make sure it is a valid .gisproject file.');
      console.error(err);
    }
    e.target.value = '';
  };
  reader.readAsText(file);
}

function exportHTML() {
  syncProjectMetaFromUI();
  const exportData = {
    title: projectTitle,
    dataNote,
    searchMode,
    layers: layerStore.map(l => ({
      name: l.name,
      geojson: l.geojson,
      color: l.color,
      strokeColor: l.strokeColor || l.color,
      weight: l.weight,
      opacity: l.opacity ?? 0.4,
      noFill: l.noFill || false,
      pointSymbolType: l.pointSymbolType || 'circle',
      pointSize: l.pointSize ?? 10,
      pointStrokeColor: l.pointStrokeColor || null,
      pointStrokeWidth: l.pointStrokeWidth ?? 2,
      customSymbolUrl: l.customSymbolUrl || null,
      popupEnabled: l.popupEnabled !== false,
      popupTitle: l.popupTitle || '',
      popupFields: l.popupFields,
      popupTemplate: l.popupTemplate || '',
      popupShowLabels: l.popupShowLabels !== false,
      symbologyType: l.symbologyType,
      symbologyField: l.symbologyField,
      categories: l.categories,
      categorySymbols: l.categorySymbols || {},
      categorySortMode: l.categorySortMode || 'asc',
      categoryOrder: l.categoryOrder || [],
      classifyMethod: l.classifyMethod || 'unique',
      classCount: l.classCount || 5,
      classLimits: l.classLimits || [],
      intervals: l.intervals || [],
      labelField: l.labelField || '',
      labelEnabled: l.labelEnabled || false,
      labelFont: l.labelFont || 'Arial',
      labelSize: l.labelSize || 12,
      labelColor: l.labelColor || '#ffffff',
      labelStrokeColor: l.labelStrokeColor || '#000000',
      labelStrokeWidth: l.labelStrokeWidth ?? 2
    }))
  };

  const html = generateHTML(exportData);
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);

  const baseName = (projectTitle || 'my-interactive-map').replace(/[^\w\-]+/g, '-').replace(/^-+|-+$/g, '') || 'my-interactive-map';
  const a = document.createElement("a");
  a.href = url;
  a.download = `${baseName}.html`;
  a.click();
  URL.revokeObjectURL(url);
}

// =========================
// EXPORT HTML GENERATION
// =========================

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
    padding: 20px;
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
  .layer-left {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }
  .layer-title {
    font-size: 13px;
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .reorder-btns button {
    background: rgba(255,255,255,0.04);
    border: 1px solid var(--border-color);
    color: var(--text-secondary);
    padding: 2px 5px;
    font-size: 9px;
    cursor: pointer;
    border-radius: 3px;
  }
  .legend-item { font-size: 12px; font-weight: 600; color: var(--text-primary); margin-top: 6px;}
  .legend-subitem { display: flex; align-items: center; gap: 8px; font-size: 11px; color: var(--text-secondary); padding-left: 8px; margin-top: 3px;}
  .legend-subitem span { width: 10px; height: 10px; display: inline-block; border-radius: 3px; }
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
  #map { flex: 1; height: 100vh; background-color: #0b0f19 !important; }
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
      <div id="legend"></div>
    </div>
  </div>
</div>

<div id="map"></div>

<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script src="https://unpkg.com/maplibre-gl/dist/maplibre-gl.js"></script>
<script src="https://unpkg.com/@maplibre/maplibre-gl-leaflet/leaflet-maplibre-gl.js"></script>
<script>
const exportedData = ${JSON.stringify(data)};
const map = L.map('map').setView([43.7, -79.4], 10);

${currentBasemap === 'none' ? '' : `
const bmType = '${BASEMAPS[currentBasemap].type}';
if (bmType === 'vector') {
  L.maplibreGL({
    style: '${BASEMAPS[currentBasemap].url}',
    attribution: '${BASEMAPS[currentBasemap].attribution}'
  }).addTo(map);
} else {
  L.tileLayer('${BASEMAPS[currentBasemap].url}', {
    attribution: '${BASEMAPS[currentBasemap].attribution}'
  }).addTo(map);
}
`}

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
  keys.forEach(function(k) {
    if (ordered.indexOf(k) === -1) ordered.push(k);
  });
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
  const style = {
    color: l.strokeColor || fillColor,
    fillColor,
    fillOpacity: layerOpacity,
    opacity: layerOpacity,
    weight: l.weight
  };
  if (l.noFill) style.fillOpacity = 0;
  return style;
}

function getExportedPointStrokeColor(l) {
  return l.pointStrokeColor || l.strokeColor || '#ffffff';
}

function getExportedSymbolSvgShape(type, fill, strokeAttr) {
  var f = fill || '#3b82f6';
  var s = strokeAttr || '';
  switch (type) {
    case 'square':
      return '<rect x="2" y="2" width="16" height="16" rx="2" fill="' + f + '"' + s + '/>';
    case 'triangle':
      return '<polygon points="10,2 18,17 2,17" fill="' + f + '"' + s + ' stroke-linejoin="round"/>';
    case 'diamond':
      return '<polygon points="10,2 18,10 10,18 2,10" fill="' + f + '"' + s + ' stroke-linejoin="round"/>';
    case 'pentagon':
      return '<polygon points="10,2 17.6,7.5 14.7,16.5 5.3,16.5 2.4,7.5" fill="' + f + '"' + s + ' stroke-linejoin="round"/>';
    case 'hexagon':
      return '<polygon points="10,2 16.9,6 16.9,14 10,18 3.1,14 3.1,6" fill="' + f + '"' + s + ' stroke-linejoin="round"/>';
    case 'star':
      return '<polygon points="10,2 11.9,7.4 17.6,7.5 13.0,11.0 14.7,16.5 10,13.2 5.3,16.5 7.0,11.0 2.4,7.5 8.1,7.4" fill="' + f + '"' + s + ' stroke-linejoin="round"/>';
    case 'cross':
      return '<rect x="8" y="2" width="4" height="16" rx="1" fill="' + f + '"' + s + '/><rect x="2" y="8" width="16" height="4" rx="1" fill="' + f + '"' + s + '/>';
    case 'crosshair':
      return '<circle cx="10" cy="10" r="7" fill="none"' + s + '/><line x1="10" y1="3" x2="10" y2="17" stroke="#fff" stroke-width="1.5"/><line x1="3" y1="10" x2="17" y2="10" stroke="#fff" stroke-width="1.5"/><circle cx="10" cy="10" r="3" fill="' + f + '"' + s + '/>';
    case 'pin':
      return '<path d="M10,2 C4,2 2,6 2,10 C2,15 10,18 10,18 C10,18 18,15 18,10 C18,6 16,2 10,2Z" fill="' + f + '"' + s + ' stroke-linejoin="round"/>';
    case 'arrow':
      return '<polygon points="10,2 18,14 13,14 13,18 7,18 7,14 2,14" fill="' + f + '"' + s + ' stroke-linejoin="round"/>';
    case 'teardrop':
      return '<path d="M10,1 C10,1 18,11 18,14 C18,18.4 14.4,19 10,19 C5.6,19 2,18.4 2,14 C2,11 10,1 10,1Z" fill="' + f + '"' + s + ' stroke-linejoin="round"/>';
    case 'ring':
      return '<circle cx="10" cy="10" r="8" fill="none"' + s + '/><circle cx="10" cy="10" r="3" fill="' + f + '"' + s + '/>';
    default:
      return '<circle cx="10" cy="10" r="8" fill="' + f + '"' + s + '/>';
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

function createExportedPointMarker(feature, latlng, l) {
  const fillColor = getExportedFillColor(l, feature);
  const strokeColor = getExportedPointStrokeColor(l);
  let size = l.pointSize ?? 10;
  let symbolType = l.pointSymbolType || 'circle';
  let strokeWidth = l.pointStrokeWidth ?? 2;
  let customUrl = l.customSymbolUrl || null;
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
  const markerOpacity = l.opacity ?? 0.4;
  const dim = Math.max(8, size * 2);
  if (symbolType === 'custom' && customUrl) {
    return L.marker(latlng, {
      icon: L.icon({
        iconUrl: customUrl,
        iconSize: [dim, dim],
        iconAnchor: [size, size],
        popupAnchor: [0, -size],
        className: 'gis-custom-point-icon'
      }),
      opacity: markerOpacity
    });
  }
  return L.marker(latlng, {
    icon: L.divIcon({
      className: 'gis-point-symbol-icon',
      html: buildExportedPointSymbolHtml(symbolType, fillColor, strokeColor, size, strokeWidth),
      iconSize: [dim, dim],
      iconAnchor: [size, size]
    }),
    opacity: markerOpacity
  });
}

function escapeExportedHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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
    const body = template.split('\\n').map(function(line) {
      return escapeExportedHtml(replaceExportedPopupTokens(line, feature, layerConfig));
    }).join('<br/>');
    return '<div class="gis-feature-popup" style="font-size:12px;font-family:sans-serif;line-height:1.45;"><b style="color:#3b82f6;font-size:13px;display:block;margin-bottom:6px;">' + title + '</b><div style="color:#f8fafc;">' + body + '</div></div>';
  }
  let fields = Object.keys(props);
  if (layerConfig.popupFields && layerConfig.popupFields.length) {
    fields = layerConfig.popupFields.filter(function(f) { return f in props; });
  }
  let html = '<div class="gis-feature-popup" style="font-size:12px;font-family:sans-serif;line-height:1.45;"><b style="color:#3b82f6;font-size:13px;display:block;margin-bottom:6px;">' + title + '</b>';
  if (!fields.length) {
    html += '<span style="color:#94a3b8;">No attributes to display</span>';
  } else {
    const showLabels = layerConfig.popupShowLabels !== false;
    fields.forEach(function(k) {
      const val = props[k] === null || props[k] === undefined ? '' : String(props[k]);
      if (showLabels) {
        html += '<div style="margin-bottom:3px;"><span style="color:#94a3b8;">' + escapeExportedHtml(k) + ':</span> <span style="color:#f8fafc;font-weight:500;">' + escapeExportedHtml(val) + '</span></div>';
      } else {
        html += '<div style="margin-bottom:3px;color:#f8fafc;">' + escapeExportedHtml(val) + '</div>';
      }
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

exportedData.layers.forEach(l => {
  const geoOptions = {
    style: function(feature) {
      if (isExportedPointFeature(feature)) return {};
      return getExportedFeatureStyle(l, feature);
    },
    onEachFeature: function(f, leafletLayer) {
      if (l.popupEnabled === false) {
        leafletLayer.unbindPopup();
      } else {
        const html = buildExportedPopupHtml(f, l);
        if (html) leafletLayer.bindPopup(html);
        else leafletLayer.unbindPopup();
      }
      if (l.labelEnabled && l.labelField) {
        var v = f.properties ? f.properties[l.labelField] : null;
        if (v != null && v !== '') {
          leafletLayer.bindTooltip(String(v), { permanent: true, direction: 'center', className: 'layer-label exported-label' });
        }
      }
    }
  };
  if (layerDataHasPoints(l)) {
    geoOptions.pointToLayer = function(feature, latlng) {
      return createExportedPointMarker(feature, latlng, l);
    };
  }
  const layer = L.geoJSON(l.geojson, geoOptions);

  layer.addTo(map);
  layers.push({ ...l, layer });
});

function syncMapZIndex() {
  layers.forEach(l => {
    if (map.hasLayer(l.layer) && l.layer.bringToFront) l.layer.bringToFront();
  });
}

function moveLayer(index, direction) {
  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= layers.length) return;
  const temp = layers[index];
  layers[index] = layers[targetIndex];
  layers[targetIndex] = temp;
  renderUI();
  syncMapZIndex();
}

function renderUI() {
  const ld = document.getElementById("layers");
  const lg = document.getElementById("legend");
  ld.innerHTML = ""; lg.innerHTML = "";

  for (let i = layers.length - 1; i >= 0; i--) {
    const l = layers[i];
    const d = document.createElement("div");
    d.className = "layer-node";
    d.innerHTML = \`
      <div class="layer-left">
        <input type="checkbox" \${map.hasLayer(l.layer) ? "checked" : ""} style="accent-color:var(--accent);" />
        <span class="layer-title">\${l.name}</span>
      </div>
      <div class="reorder-btns">
        <button class="btn-up" \${i === layers.length - 1 ? 'disabled' : ''}>▲</button>
        <button class="btn-down" \${i === 0 ? 'disabled' : ''}>▼</button>
      </div>
    \`;

    d.querySelector("input").onchange = (e) => {
      if (e.target.checked) map.addLayer(l.layer);
      else map.removeLayer(l.layer);
      syncMapZIndex();
    };
    d.querySelector('.btn-up').onclick = () => moveLayer(i, 1);
    d.querySelector('.btn-down').onclick = () => moveLayer(i, -1);
    ld.appendChild(d);

    const legTitle = document.createElement("div");
    legTitle.className = "legend-item";
    legTitle.innerText = l.name;
    lg.appendChild(legTitle);

    if (l.symbologyType === 'single') {
      const sub = document.createElement("div");
      sub.className = "legend-subitem";
      sub.innerHTML = '<span style="background:' + l.color + '"></span> All features';
      lg.appendChild(sub);
    } else if (l.symbologyType === 'categorized' && l.symbologyField) {
      getOrderedCategoryKeys(l).forEach(function(k) {
        const row = document.createElement('div');
        row.className = 'legend-subitem-row';

        const sub = document.createElement("div");
        sub.className = "legend-subitem";
        sub.innerHTML = '<span style="background:' + l.categories[k] + '"></span>';

        const labelSpan = document.createElement('span');
        labelSpan.className = 'cat-label';
        labelSpan.textContent = getCategoryDisplayLabel(l, k);
        labelSpan.addEventListener('dblclick', () => {
          const input = document.createElement('input');
          input.type = 'text';
          input.value = labelSpan.textContent;
          input.className = 'cat-label-input';
          input.style.cssText = 'font-size:12px;padding:6px 8px;border:1px solid var(--accent);border-radius:3px;background:var(--bg-primary);color:var(--text-primary);width:100%;outline:none;box-sizing:border-box;';

          const finish = (save) => {
            if (save && input.value.trim()) {
              if (!l.customCategoryLabels) l.customCategoryLabels = {};
              l.customCategoryLabels[k] = input.value.trim();
              renderUI();
            } else if (save && !input.value.trim() && l.customCategoryLabels?.[k]) {
              delete l.customCategoryLabels[k];
              renderUI();
            } else {
              labelSpan.style.display = '';
            }
            input.remove();
          };

          input.addEventListener('blur', () => finish(true));
          input.addEventListener('keydown', (ev) => {
            if (ev.key === 'Enter') finish(true);
            if (ev.key === 'Escape') finish(false);
          });

          labelSpan.style.display = 'none';
          labelSpan.parentNode.insertBefore(input, labelSpan);
          input.focus();
          input.select();
        });

        sub.appendChild(labelSpan);
        row.appendChild(sub);

        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'legend-del-btn';
        delBtn.title = 'Remove category';
        delBtn.textContent = '×';
        delBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          delete l.categories[k];
          delete l.customCategoryLabels?.[k];
          delete l.categorySymbols?.[k];
          if (l.categoryOrder) l.categoryOrder = l.categoryOrder.filter(ck => ck !== k);
          renderUI();
        });
        row.appendChild(delBtn);

        lg.appendChild(row);
      });
    }
  }
}

renderUI();
syncMapZIndex();

// Map Search / Pin Control
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
    const inp = inner.querySelector('input');
    const btn = inner.querySelector('#mapSearchBtn');
    const tog = inner.querySelector('#mapToggleMode');
    var sm = exportedData.searchMode || 'both';
    if (sm === 'off') { c.style.display = 'none'; }
    let isPin = sm === 'pin';
    if (isPin && tog) tog.style.display = 'none';
    function setMode(pin) {
      isPin = pin;
      if (pin) {
        inp.placeholder = 'lat, lon (e.g. 43.86, -79.29)';
        btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>';
        dd.innerHTML = '<div class="map-pin-hint">Enter coordinates as <b>lat, lon</b>, then press Enter or click the pin button.</div>';
        dd.style.display = 'block';
      } else {
        inp.placeholder = 'Search places\u2026';
        btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';
        dd.innerHTML = '';
        dd.style.display = '';
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
              var d = document.createElement('div');
              d.textContent = r.display_name;
              d.addEventListener('click', function() {
                var lat = parseFloat(r.lat), lon = parseFloat(r.lon);
                map.setView([lat, lon], 14);
                if (searchMarker) map.removeLayer(searchMarker);
                searchMarker = L.marker([lat, lon]).addTo(map).bindPopup(r.display_name).openPopup();
                dd.innerHTML = '';
                inp.value = r.display_name;
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
              dd.appendChild(d);
            });
          }).catch(() => {});
      }, 300);
    });
    return c;
  }
});
new MapSearchControl().addTo(map);
</script>
</body>
</html>`;
}

function getRandomColor() {
  const letters = '0123456789ABCDEF';
  let color = '#';
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}