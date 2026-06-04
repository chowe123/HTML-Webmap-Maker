function setBasemap(name) {
  const config = BASEMAPS[name];
  if (!config) return;
  if (tileLayer) { map.removeLayer(tileLayer); tileLayer = null; }
  if (localMBLayer && map.hasLayer(localMBLayer)) { map.removeLayer(localMBLayer); }
  if (name !== 'local') localMBFilename = '';
  if (name === 'none') { currentBasemap = name; return; }
  if (name === 'local') {
    if (localMBLayer) { map.addLayer(localMBLayer); currentBasemap = name; }
    return;
  }
  if (config.type === 'vector') {
    tileLayer = L.maplibreGL({ style: config.url, attribution: config.attribution }).addTo(map);
  } else {
    tileLayer = L.tileLayer(config.url, { attribution: config.attribution }).addTo(map);
  }
  currentBasemap = name;
}

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
  var isSelected = layerObj && feature && (function() {
    var idx = layerObj.geojson.features ? layerObj.geojson.features.indexOf(feature) : -1;
    return idx >= 0 && isFeatureSelected(layerObj.id, idx);
  })();
  var fillColor = getFeatureFillColor(layerObj, feature);
  var layerOpacity = layerObj.opacity ?? 0.4;
  var fillOpacity = isSelected ? 1 : layerOpacity;
  var strokeColor = layerObj.strokeColor ?? fillColor;
  var strokeWeight = isSelected ? Math.max(layerObj.weight || 1, 3) : layerObj.weight;
  var strokeOpacity = isSelected ? 1 : layerOpacity;
  if (!isSelected && layerObj.symbologyType === 'categorized' && layerObj.symbologyField) {
    var val = feature?.properties ? feature.properties[layerObj.symbologyField] : null;
    var catKey = getCategoryKeyForValue(layerObj, val);
    if (layerObj.categoryNoFill && layerObj.categoryNoFill[catKey]) fillOpacity = 0;
    var cs = layerObj.categoryStroke && layerObj.categoryStroke[catKey];
    if (cs) {
      if (cs.color !== undefined && cs.color !== '') strokeColor = cs.color;
      if (cs.width !== undefined) strokeWeight = cs.width;
      if (cs.opacity !== undefined) strokeOpacity = cs.opacity;
    }
  }
  var style = {
    color: strokeColor,
    fillColor: fillColor,
    fillOpacity: fillOpacity,
    opacity: strokeOpacity,
    weight: strokeWeight
  };
  if (isSelected) style.color = '#00e5ff';
  return style;
}

function getSymbolSvgShape(type, fill, strokeAttr) {
  const f = fill || '#3b82f6';
  const s = strokeAttr || '';
  switch (type) {
    case 'square': return `<rect x="2" y="2" width="16" height="16" rx="2" fill="${f}"${s}/>`;
    case 'triangle': return `<polygon points="10,2 18,17 2,17" fill="${f}"${s} stroke-linejoin="round"/>`;
    case 'diamond': return `<polygon points="10,2 18,10 10,18 2,10" fill="${f}"${s} stroke-linejoin="round"/>`;
    case 'pentagon': return `<polygon points="10,2 17.6,7.5 14.7,16.5 5.3,16.5 2.4,7.5" fill="${f}"${s} stroke-linejoin="round"/>`;
    case 'hexagon': return `<polygon points="10,2 16.9,6 16.9,14 10,18 3.1,14 3.1,6" fill="${f}"${s} stroke-linejoin="round"/>`;
    case 'star': return `<polygon points="10,2 11.9,7.4 17.6,7.5 13.0,11.0 14.7,16.5 10,13.2 5.3,16.5 7.0,11.0 2.4,7.5 8.1,7.4" fill="${f}"${s} stroke-linejoin="round"/>`;
    case 'cross': return `<rect x="8" y="2" width="4" height="16" rx="1" fill="${f}"${s}/><rect x="2" y="8" width="16" height="4" rx="1" fill="${f}"${s}/>`;
    case 'crosshair': return `<circle cx="10" cy="10" r="7" fill="none"${s}/><line x1="10" y1="3" x2="10" y2="17" stroke="#fff" stroke-width="1.5"/><line x1="3" y1="10" x2="17" y2="10" stroke="#fff" stroke-width="1.5"/><circle cx="10" cy="10" r="3" fill="${f}"${s}/>`;
    case 'pin': return `<path d="M10,2 C4,2 2,6 2,10 C2,15 10,18 10,18 C10,18 18,15 18,10 C18,6 16,2 10,2Z" fill="${f}"${s} stroke-linejoin="round"/>`;
    case 'arrow': return `<polygon points="10,2 18,14 13,14 13,18 7,18 7,14 2,14" fill="${f}"${s} stroke-linejoin="round"/>`;
    case 'teardrop': return `<path d="M10,1 C10,1 18,11 18,14 C18,18.4 14.4,19 10,19 C5.6,19 2,18.4 2,14 C2,11 10,1 10,1Z" fill="${f}"${s} stroke-linejoin="round"/>`;
    case 'ring': return `<circle cx="10" cy="10" r="8" fill="none"${s}/><circle cx="10" cy="10" r="3" fill="${f}"${s}/>`;
    default: return `<circle cx="10" cy="10" r="8" fill="${f}"${s}/>`;
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
  const isSelected = layerObj && feature && (function() {
    const idx = layerObj.geojson.features ? layerObj.geojson.features.indexOf(feature) : -1;
    return idx >= 0 && isFeatureSelected(layerObj.id, idx);
  })();
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
  const selClass = isSelected ? ' point-selected' : '';
  const extraSize = isSelected ? 4 : 0;
  if (symbolType === 'custom' && customUrl) {
    return L.marker(latlng, {
      icon: L.icon({ iconUrl: customUrl, iconSize: [dim + extraSize, dim + extraSize], iconAnchor: [size + extraSize / 2, size + extraSize / 2], popupAnchor: [0, -size - extraSize / 2], className: 'gis-custom-point-icon' + selClass }),
      opacity: isSelected ? Math.min(markerOpacity + 0.2, 1) : markerOpacity
    });
  }
  const selStroke = isSelected ? '#00e5ff' : strokeColor;
  const selSw = isSelected ? Math.max(strokeWidth, 3) : strokeWidth;
  return L.marker(latlng, {
    icon: L.divIcon({ className: 'gis-point-symbol-icon' + selClass, html: buildPointSymbolHtml(symbolType, fillColor, selStroke, size + extraSize, selSw), iconSize: [dim + extraSize, dim + extraSize], iconAnchor: [size + extraSize / 2, size + extraSize / 2] }),
    opacity: isSelected ? Math.min(markerOpacity + 0.2, 1) : markerOpacity
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
    const body = template.split('\n').map(line => escapeHtml(replacePopupTokens(line, feature, layer))).join('<br/>');
    return `<div class="gis-feature-popup" style="font-size:12px;font-family:sans-serif;line-height:1.45;"><b style="color:#3b82f6;font-size:13px;display:block;margin-bottom:6px;">${title}</b><div style="color:#f8fafc;">${body}</div></div>`;
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
  if (layerObj.popupEnabled === false) { leafletLayer.unbindPopup(); return; }
  const html = buildFeaturePopupHtml(feature, layerObj);
  if (!html) { leafletLayer.unbindPopup(); return; }
  leafletLayer.bindPopup(html);
}

function refreshLayerPopups(layer) {
  if (!layer?.leafletLayer) return;
  layer.leafletLayer.eachLayer(leafletLayer => {
    const f = leafletLayer.feature;
    if (f) bindFeaturePopup(f, leafletLayer, layer);
  });
}

function evaluateFilterExpression(expr, props) {
  try {
    var keys = Object.keys(props).filter(function(k) { return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(k); });
    var values = keys.map(function(k) { return props[k]; });
    return new Function('p', ...keys, 'return (' + expr + ')').call(null, props, ...values);
  } catch(e) { return false; }
}

function evaluateExpression(expr, props) {
  try {
    var keys = Object.keys(props).filter(function(k) { return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(k); });
    var values = keys.map(function(k) { return props[k]; });
    return new Function('p', ...keys, 'return (' + expr + ')').call(null, props, ...values);
  } catch(e) { return ''; }
}

function getFilteredFeatures(layer) {
  var all = layer.geojson.features || (layer.geojson.type === 'Feature' ? [layer.geojson] : []);
  if (!layer.filterEnabled) return all;
  if (layer.filterMode === 'advanced' && layer.filterExpression) {
    return all.filter(function(f) { return evaluateFilterExpression(layer.filterExpression, f.properties || {}); });
  }
  if (!layer.filterField) return all;
  var op = layer.filterOp || 'equals';
  var val = layer.filterValue || '';
  var field = layer.filterField;
  return all.filter(function(f) {
    var propVal = f.properties ? f.properties[field] : undefined;
    if (propVal === undefined || propVal === null) propVal = '';
    var strVal = String(propVal);
    switch (op) {
      case 'equals': return strVal === val;
      case 'not_equals': return strVal !== val;
      case 'contains': return strVal.indexOf(val) !== -1;
      case 'not_contains': return strVal.indexOf(val) === -1;
      case 'greater': return parseFloat(strVal) > parseFloat(val);
      case 'less': return parseFloat(strVal) < parseFloat(val);
      case 'greater_eq': return parseFloat(strVal) >= parseFloat(val);
      case 'less_eq': return parseFloat(strVal) <= parseFloat(val);
      case 'is_empty': return strVal === '';
      case 'not_empty': return strVal !== '';
      default: return true;
    }
  });
}

function createGeoJsonLayer(layerObj) {
  var filteredFeatures = layerObj.filterEnabled ? getFilteredFeatures(layerObj) : null;
  var geoData = filteredFeatures
    ? { type: 'FeatureCollection', features: filteredFeatures }
    : layerObj.geojson;
  const options = {
    style: (feature) => (isPointFeature(feature) ? {} : getFeatureStyle(layerObj, feature)),
    onEachFeature: (feature, l) => {
      bindFeaturePopup(feature, l, layerObj);
      bindFeatureLabel(feature, l, layerObj);
      l.on('click', function(e) {
        L.DomEvent.stopPropagation(e);
        var src = filteredFeatures || layerObj.geojson.features || [];
        var idx = src.indexOf(feature);
        if (idx < 0 && layerObj.geojson.features) idx = layerObj.geojson.features.indexOf(feature);
        if (idx >= 0) {
          if (e.originalEvent && e.originalEvent.ctrlKey) { toggleSelection(layerObj.id, idx); }
          else { selectOne(layerObj.id, idx); }
        }
      });
    }
  };
  if (layerHasPoints(layerObj)) {
    options.pointToLayer = (feature, latlng) => createPointMarker(feature, latlng, layerObj);
  }
  return L.geoJSON(geoData, options);
}

function bindFeatureLabel(feature, leafletLayer, layerObj) {
  if (!layerObj.labelEnabled || !layerObj.labelField) return;
  const val = feature.properties?.[layerObj.labelField];
  if (val === null || val === undefined || val === '') return;
  leafletLayer.bindTooltip(String(val), { permanent: true, direction: 'center', className: `layer-label label-layer-${layerObj.id}` });
}

function updateLabelStyleTag(layer) {
  const styleId = `label-style-${layer.id}`;
  let styleEl = document.getElementById(styleId);
  if (!layer.labelEnabled || !layer.labelField) { if (styleEl) styleEl.remove(); return; }
  if (!styleEl) { styleEl = document.createElement('style'); styleEl.id = styleId; document.head.appendChild(styleEl); }
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
  var useDeck = window.deck && !layerHasPoints(layer);
  if (useDeck) {
    if (layer.leafletLayer) {
      map.removeLayer(layer.leafletLayer);
      layer.leafletLayer = null;
    }
    if (window.syncDeckLayers) window.syncDeckLayers();
    if (options.renderUI !== false) renderUI();
    return;
  }
  const wasOnMap = layer.visible && map.hasLayer(layer.leafletLayer);
  map.removeLayer(layer.leafletLayer);
  layer.leafletLayer = createGeoJsonLayer(layer);
  if (wasOnMap) layer.leafletLayer.addTo(map);
  syncMapZIndex();
  if (window.syncDeckLayers) window.syncDeckLayers();
  if (options.renderUI !== false) renderUI();
}

function refreshLayerStyle(layer) {
  if (!layer?.leafletLayer) {
    if (window.syncDeckLayers) window.syncDeckLayers();
    return;
  }
  const geomTypes = getLayerGeometryTypes(layer.geojson);
  if (geomTypes.has('point')) {
    const opacity = layer.opacity ?? 0.4;
    layer.leafletLayer.eachLayer(l => { if (l.setOpacity) l.setOpacity(opacity); });
  }
  if (geomTypes.has('line') || geomTypes.has('polygon')) {
    if (layer.leafletLayer.setStyle) layer.leafletLayer.setStyle(layer.leafletLayer.options.style);
  }
}

function needsPointLayerRebuild(key) {
  return ['pointSymbolType', 'pointSize', 'customSymbolUrl', 'pointStrokeColor', 'pointStrokeWidth', 'color', 'strokeColor', 'symbologyType', 'symbologyField', 'classifyMethod', 'classCount', 'classLimits', 'categories'].includes(key);
}

function needsLayerRebuild(key) {
  return needsPointLayerRebuild(key) || ['labelEnabled', 'labelField', 'labelFont', 'labelSize', 'labelColor', 'labelStrokeColor', 'labelStrokeWidth'].includes(key);
}

function scheduleLayerStyleRefresh(layer, key = 'default') {
  const rafKey = `${layer.id}:${key}`;
  if (styleRefreshRaf.has(rafKey)) cancelAnimationFrame(styleRefreshRaf.get(rafKey));
  styleRefreshRaf.set(rafKey, requestAnimationFrame(() => { refreshLayerStyle(layer); styleRefreshRaf.delete(rafKey); }));
}

function createLayer({
  name, geojson, id, color, strokeColor, weight = 2, opacity = 0.4,
  pointSymbolType = 'circle', pointSize = 10, pointStrokeColor = null, pointStrokeWidth = 2, customSymbolUrl = null,
  popupEnabled = false, popupTitle = '', popupFields = null, popupTemplate = '', popupShowLabels = true,
  visible = true, symbologyType = 'single', symbologyField = '', categories = {}, categorySymbols = {},
  categorySortMode = 'asc', categoryOrder = [], classifyMethod = '', classCount = 5, classLimits = [],
  intervals = [], symbologyExpanded = true, settingsExpanded = true,
  labelField = '', labelEnabled = false, labelFont = 'Arial', labelSize = 12, labelColor = '#ffffff',
  labelStrokeColor = '#000000', filterEnabled = false, filterMode = 'simple', filterField = '',
  filterOp = 'equals', filterValue = '', filterExpression = '', labelStrokeWidth = 2,
  colorRamp = '', colorRampReversed = false, customCategoryLabels = {}, hiddenCatKeys = [], showLegend = true,
  categoryNoFill = {}, categoryStroke = {}
}) {
  let layerId = id;
  if (layerId) {
    const num = parseInt(String(layerId).replace('layer_', ''), 10);
    if (!isNaN(num) && num > layerCounter) layerCounter = num;
  } else { layerId = 'layer_' + (++layerCounter); }
  const defaultColor = color || getRandomColor();
  const fields = extractFields(geojson);
  const layerObj = {
    id: layerId, name, geojson, leafletLayer: null, color: defaultColor, strokeColor: strokeColor || defaultColor,
    weight, opacity: opacity ?? 0.4,
    pointSymbolType: pointSymbolType || 'circle', pointSize: pointSize ?? 10,
    pointStrokeColor: pointStrokeColor || null, pointStrokeWidth: pointStrokeWidth ?? 2, customSymbolUrl: customSymbolUrl || null,
    popupEnabled: popupEnabled !== false, popupTitle: popupTitle || '', popupFields: popupFields === undefined ? null : popupFields,
    popupTemplate: popupTemplate || '', popupShowLabels: popupShowLabels !== false, visible,
    fields, geometryTypes: getLayerGeometryTypes(geojson),
    symbologyType, symbologyField, categories: { ...categories },
    categorySymbols: { ...categorySymbols }, categorySortMode: categorySortMode || 'asc', categoryOrder: [...categoryOrder],
    classifyMethod: classifyMethod || '', classCount: classCount || 5,
    classLimits: (classLimits || []).map(v => (v === null || v === '' ? null : Number(v))),
    intervals: intervals.map(i => ({ ...i })), symbologyExpanded, settingsExpanded,
    labelField, labelEnabled: !!labelField, labelFont, labelSize, labelColor, labelStrokeColor, labelStrokeWidth,
    colorRamp: colorRamp || '', colorRampReversed: colorRampReversed || false,
    customCategoryLabels: { ...customCategoryLabels }, categoryNoFill: { ...categoryNoFill },
    categoryStroke: JSON.parse(JSON.stringify(categoryStroke)),
    hiddenCatKeys: hiddenCatKeys ? [...hiddenCatKeys] : [],
    showLegend: showLegend !== false, filterEnabled: filterEnabled !== false,
    filterMode: filterMode === 'advanced' ? 'advanced' : 'simple', filterField: filterField || '',
    filterOp: filterOp || 'equals', filterValue: filterValue || '', filterExpression: filterExpression || ''
  };
  migrateLegacyBreaks(layerObj);
  ensureCategoryOrder(layerObj);
  if (layerObj.symbologyType === 'categorized' && layerObj.symbologyField && layerObj.classifyMethod && Object.keys(layerObj.categories).length === 0) {
    applyLayerClassification(layerObj);
  }
  updateLabelStyleTag(layerObj);
  var useDeckForNew = window.deck && !layerHasPoints(layerObj);
  if (useDeckForNew) {
    layerObj.leafletLayer = null;
  } else {
    layerObj.leafletLayer = createGeoJsonLayer(layerObj);
    if (layerObj.visible) layerObj.leafletLayer.addTo(map);
  }
  layerStore.push(layerObj);
  if (useDeckForNew && window.syncDeckLayers) window.syncDeckLayers();
  renderUI();
  syncMapZIndex();
  return layerObj;
}

function renameLayer(id, newName) {
  const layer = layerStore.find(l => l.id === id);
  if (!layer) return;
  layer.name = newName.trim() || layer.name;
  renderUI();
}

function toggleLayer(id) {
  const layer = layerStore.find(l => l.id === id);
  if (!layer) return;
  layer.visible = !layer.visible;
  if (layer.leafletLayer) {
    if (layer.visible) { layer.leafletLayer.addTo(map); } else { map.removeLayer(layer.leafletLayer); }
  }
  if (window.syncDeckLayers) window.syncDeckLayers();
  renderUI();
  syncMapZIndex();
}

function updateStyle(id, key, value, options = {}) {
  const layer = layerStore.find(l => l.id === id);
  if (!layer) return;
  layer[key] = value;
  if (key === 'symbologyField') { layer.classLimits = []; layer.intervals = []; layer.categories = {}; layer.categoryOrder = []; layer.categorySortMode = 'asc'; }
  if (key === 'symbologyType' && value === 'categorized' && layer.symbologyField) { applyLayerClassification(layer); }
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
  if (key === 'classCount') { ensureClassLimits(layer); applyLayerClassification(layer); }
  if (key === 'classLimits') { applyLayerClassification(layer); }
  if (needsLayerRebuild(key)) {
    updateLabelStyleTag(layer);
    if (!layerHasPoints(layer)) {
      refreshLayerStyle(layer);
      if (options.renderUI !== false) renderUI();
      return;
    }
    if (options.renderUI === false) { rebuildLeafletLayer(layer, { renderUI: false }); return; }
    rebuildLeafletLayer(layer); return;
  }
  if (options.renderUI === false) { scheduleLayerStyleRefresh(layer, key); return; }
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
  if (!file || !file.type.startsWith('image/')) { alert('Please choose an image file (PNG, JPG, SVG, etc.).'); return; }
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
    if (options.renderUI === false) { rebuildLeafletLayer(layer, { renderUI: false }); return; }
    rebuildLeafletLayer(layer); return;
  }
  refreshLayerStyle(layer);
  if (options.renderUI !== false) renderUI();
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

function moveLayer(index, direction) {
  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= layerStore.length) return;
  const temp = layerStore[index];
  layerStore[index] = layerStore[targetIndex];
  layerStore[targetIndex] = temp;
  if (window.syncDeckLayers) window.syncDeckLayers();
  renderUI();
  syncMapZIndex();
}

function syncMapZIndex() {
  layerStore.forEach(layer => {
    if (layer.visible && layer.leafletLayer && layer.leafletLayer.bringToFront) layer.leafletLayer.bringToFront();
  });
}

function deleteLayer(layerId) {
  const idx = layerStore.findIndex(l => l.id === layerId);
  if (idx === -1) return;
  const layer = layerStore[idx];
  if (layer.leafletLayer && map.hasLayer(layer.leafletLayer)) map.removeLayer(layer.leafletLayer);
  layerStore.splice(idx, 1);
  if (window.syncDeckLayers) window.syncDeckLayers();
  renderUI();
  syncMapZIndex();
}