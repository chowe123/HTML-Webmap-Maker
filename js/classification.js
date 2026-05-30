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
    let s1 = 0, s2 = 0, w = 0;
    for (let mIdx = 1; mIdx <= l; mIdx++) {
      const i3 = l - mIdx + 1;
      const val = sorted[i3 - 1];
      s2 += val * val; s1 += val; w += 1;
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
    if (i === n - 1) { limits.push(null); }
    else {
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
    if (upper === null || upper === '' || !isFinite(Number(upper))) { out.push(null); break; }
    const n = Number(upper);
    if (n > lastFinite) { out.push(n); lastFinite = n; }
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
    if (i === 0 && hasUpper) { label = `\u2264 ${formatNumber(upperN)}`; }
    else if (!hasUpper && hasPrev) { label = `> ${formatNumber(prevN)}`; }
    else if (hasUpper && hasPrev) { label = `> ${formatNumber(prevN)}, \u2264 ${formatNumber(upperN)}`; }
    else if (hasUpper) { label = `\u2264 ${formatNumber(upperN)}`; }
    else { label = `Class ${i + 1}`; }
    intervals.push({ key: `class_${i}`, label, classIndex: i, upper: upperN, lower: prevN });
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
  keys.forEach(k => { if (!layer.categoryOrder.includes(k)) layer.categoryOrder.push(k); });
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
