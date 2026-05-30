function getSelectedSet(layerId) {
  if (!selectedFeatures[layerId]) selectedFeatures[layerId] = new Set();
  return selectedFeatures[layerId];
}

function hasSelection() {
  for (var k in selectedFeatures) {
    if (selectedFeatures[k].size > 0) return true;
  }
  return false;
}

function getSelectedCount(layerId) {
  var s = selectedFeatures[layerId];
  return s ? s.size : 0;
}

function getAllSelected() {
  var result = [];
  for (var k in selectedFeatures) {
    selectedFeatures[k].forEach(function(idx) {
      result.push({ layerId: k, featureIndex: idx });
    });
  }
  return result;
}

function selectOne(layerId, featureIndex) {
  var old = getAllSelected();
  selectedFeatures = {};
  getSelectedSet(layerId).add(featureIndex);
  var rebuildLayers = {};
  old.forEach(function(item) { rebuildLayers[item.layerId] = true; });
  rebuildLayers[layerId] = true;
  for (var lid in rebuildLayers) {
    var l = layerStore.find(function(x) { return x.id === lid; });
    if (l) rebuildLeafletLayer(l, { renderUI: false });
  }
  if (typeof renderAttrTable === 'function') renderAttrTable();
}

function toggleSelection(layerId, featureIndex) {
  var s = getSelectedSet(layerId);
  if (s.has(featureIndex)) {
    s.delete(featureIndex);
    if (s.size === 0) delete selectedFeatures[layerId];
  } else {
    s.add(featureIndex);
  }
  redrawFeature(layerId, featureIndex);
  if (typeof renderAttrTable === 'function') renderAttrTable();
}

function clearSelectionInternal(redraw) {
  var all = getAllSelected();
  selectedFeatures = {};
  if (redraw !== false) {
    var touched = {};
    all.forEach(function(item) { touched[item.layerId] = true; });
    for (var lid in touched) {
      var l = layerStore.find(function(x) { return x.id === lid; });
      if (l) rebuildLeafletLayer(l, { renderUI: false });
    }
    if (typeof renderAttrTable === 'function') renderAttrTable();
  }
}

function clearSelection() { clearSelectionInternal(true); }

function isFeatureSelected(layerId, featureIndex) {
  var s = selectedFeatures[layerId];
  return s ? s.has(featureIndex) : false;
}

function redrawFeature(layerId, featureIndex) {
  var layer = layerStore.find(function(l) { return l.id === layerId; });
  if (!layer) return;
  rebuildLeafletLayer(layer, { renderUI: false });
}

function isPointFeature(feature) {
  const t = feature?.geometry?.type;
  return t === 'Point' || t === 'MultiPoint';
}

function deleteSelectedFeatures(layer) {
  var selSet = selectedFeatures[layer.id];
  if (!selSet || selSet.size === 0) return;
  var indices = [];
  selSet.forEach(function(idx) { indices.push(idx); });
  indices.sort(function(a, b) { return b - a; });
  var features = layer.geojson.features;
  if (!features) return;
  indices.forEach(function(idx) { features.splice(idx, 1); });
  layer.fields = extractFields(layer.geojson);
  selectedFeatures = {};
  rebuildLeafletLayer(layer);
  renderUI();
  if (typeof renderAttrTable === 'function') renderAttrTable();
}
