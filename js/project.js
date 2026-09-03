function syncProjectMetaFromUI() {
  projectTitle = document.getElementById('projectTitle').value.trim();
  dataNote = document.getElementById('dataNote').value.trim();
}

function applyProjectMetaToUI() {
  document.getElementById('projectTitle').value = projectTitle;
  document.getElementById('dataNote').value = dataNote;
  if (typeof syncInfoPanel === 'function') syncInfoPanel();
}

function handleFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  e.target.value = '';

  const name = file.name.toLowerCase();
  const isZip = name.endsWith('.zip');
  const isTif = name.endsWith('.tif') || name.endsWith('.tiff');

  if (isTif) {
    const reader = new FileReader();
    reader.onload = function(ev) {
      addRasterLayer(file.name.replace(/\.tiff?$/i, ''), ev.target.result).catch(function(err) {
        console.error(err);
      });
    };
    reader.readAsArrayBuffer(file);
  } else if (isZip) {
    const reader = new FileReader();
    reader.onload = function(ev) {
      try {
        shp(ev.target.result).then(function(geojson) {
          createLayer({ name: file.name.replace(/\.zip$/, ''), geojson });
        }).catch(function(err) { alert('Failed to parse shapefile: ' + err.message); });
      } catch (err) { alert('Failed to read shapefile: ' + err.message); }
    };
    reader.readAsArrayBuffer(file);
  } else {
    const reader = new FileReader();
    reader.onload = function(ev) {
      try {
        const geojson = JSON.parse(ev.target.result);
        createLayer({ name: file.name, geojson });
      } catch (err) { alert('Failed to parse GeoJSON: ' + err.message); }
    };
    reader.readAsText(file);
  }
}

function getLayerExportPayload(l) {
  return {
    id: l.id, name: l.name, geojson: l.geojson, color: l.color, strokeColor: l.strokeColor || l.color,
      weight: l.weight, opacity: l.opacity ?? 0.4,
    pointSymbolType: l.pointSymbolType || 'circle', pointSize: l.pointSize ?? 10,
    pointStrokeColor: l.pointStrokeColor || null, pointStrokeWidth: l.pointStrokeWidth ?? 2,
    customSymbolUrl: l.customSymbolUrl || null, popupEnabled: l.popupEnabled !== false,
    popupTitle: l.popupTitle || '', popupFields: l.popupFields, popupTemplate: l.popupTemplate || '',
    popupShowLabels: l.popupShowLabels !== false, visible: l.visible,
    symbologyType: l.symbologyType, symbologyField: l.symbologyField, categories: l.categories,
    categorySymbols: l.categorySymbols || {}, categorySortMode: l.categorySortMode || 'asc',
    categoryOrder: l.categoryOrder || [], classifyMethod: l.classifyMethod || 'unique',
    classCount: l.classCount || 5, classLimits: l.classLimits || [], intervals: l.intervals || [],
    labelField: l.labelField || '', labelEnabled: l.labelEnabled || false, labelFont: l.labelFont || 'Arial',
    labelSize: l.labelSize || 12, labelColor: l.labelColor || '#ffffff',
    labelStrokeColor: l.labelStrokeColor || '#000000', labelStrokeWidth: l.labelStrokeWidth ?? 2,
    colorRamp: l.colorRamp || '', colorRampReversed: l.colorRampReversed || false,
    customCategoryLabels: l.customCategoryLabels || {}, categoryNoFill: l.categoryNoFill || {}, categoryStroke: l.categoryStroke || {}, hiddenCatKeys: l.hiddenCatKeys || [],
    showLegend: l.showLegend !== false, filterEnabled: l.filterEnabled !== false,
    filterMode: l.filterMode === 'advanced' ? 'advanced' : 'simple', filterField: l.filterField || '',
    filterOp: l.filterOp || 'equals', filterValue: l.filterValue || '', filterExpression: l.filterExpression || ''
  };
}

function getProjectSnapshot() {
  syncProjectMetaFromUI();
  const center = map.getCenter();
  return {
    version: PROJECT_VERSION, title: projectTitle, dataNote, basemap: currentBasemap, searchMode,
    mapView: { lat: center.lat, lng: center.lng, zoom: map.getZoom() },
    layerCounter, layers: layerStore.map(getLayerExportPayload),
    rasterLayers: rasterStore.map(function(r) {
      return { id: r.id, name: r.name, dataUrl: r.dataUrl, bounds: r.bounds, visible: r.visible, opacity: r.opacity };
    })
  };
}

function clearAllLayers() {
  layerStore.forEach(layer => { if (layer.leafletLayer) map.removeLayer(layer.leafletLayer); });
  layerStore = [];
  if (searchMarker) { map.removeLayer(searchMarker); searchMarker = null; }
  clearAllRasterLayers();
  localMBFilename = '';
  if (window.syncDeckLayers) window.syncDeckLayers();
}

function loadProjectSnapshot(snapshot) {
  if (!snapshot || !Array.isArray(snapshot.layers)) { throw new Error('Invalid project file'); }
  clearAllLayers();
  localMBFilename = '';
  layerCounter = snapshot.layerCounter || 0;
  projectTitle = snapshot.title || '';
  dataNote = snapshot.dataNote || '';
  applyProjectMetaToUI();

  snapshot.layers.forEach(layerData => {
    createLayer({
      id: layerData.id, name: layerData.name, geojson: layerData.geojson, color: layerData.color,
      strokeColor: layerData.strokeColor || layerData.color, weight: layerData.weight,
      opacity: layerData.opacity ?? 0.4,
      pointSymbolType: layerData.pointSymbolType || 'circle', pointSize: layerData.pointSize ?? 10,
      pointStrokeColor: layerData.pointStrokeColor || null, pointStrokeWidth: layerData.pointStrokeWidth ?? 2,
      customSymbolUrl: layerData.customSymbolUrl || null, popupEnabled: layerData.popupEnabled !== false,
      popupTitle: layerData.popupTitle || '', popupFields: layerData.popupFields,
      popupTemplate: layerData.popupTemplate || '', popupShowLabels: layerData.popupShowLabels !== false,
      visible: layerData.visible !== false, symbologyType: layerData.symbologyType || 'single',
      symbologyField: layerData.symbologyField || '', categories: layerData.categories || {},
      categorySymbols: layerData.categorySymbols || {}, categorySortMode: layerData.categorySortMode || 'asc',
      categoryOrder: layerData.categoryOrder || [], classifyMethod: layerData.classifyMethod || 'unique',
      classCount: layerData.classCount || 5, classLimits: layerData.classLimits || layerData.manualBreaks || [],
      intervals: layerData.intervals || [], labelField: layerData.labelField || '',
      labelFont: layerData.labelFont || 'Arial', labelSize: layerData.labelSize || 12,
      labelColor: layerData.labelColor || '#ffffff', labelStrokeColor: layerData.labelStrokeColor || '#000000',
      labelStrokeWidth: layerData.labelStrokeWidth ?? 2, colorRamp: layerData.colorRamp || '',
      colorRampReversed: layerData.colorRampReversed || false,
      customCategoryLabels: layerData.customCategoryLabels || {}, categoryNoFill: layerData.categoryNoFill || {},
      categoryStroke: layerData.categoryStroke || {},
      hiddenCatKeys: layerData.hiddenCatKeys || [], categoryNoFill: layerData.categoryNoFill || {},
      showLegend: layerData.showLegend !== false, filterEnabled: layerData.filterEnabled !== false,
      filterMode: layerData.filterMode === 'advanced' ? 'advanced' : 'simple',
      filterField: layerData.filterField || '', filterOp: layerData.filterOp || 'equals',
      filterValue: layerData.filterValue || '', filterExpression: layerData.filterExpression || ''
    });
  });

  if (snapshot.mapView) { map.setView([snapshot.mapView.lat, snapshot.mapView.lng], snapshot.mapView.zoom || 10); }

  if (snapshot.basemap && BASEMAPS[snapshot.basemap]) {
    var target = (snapshot.basemap === 'local' && !localMBLayer) ? 'none' : snapshot.basemap;
    setBasemap(target);
    document.querySelectorAll('.basemap-option').forEach(el => el.classList.remove('active'));
    const lbl = document.querySelector(`.basemap-option[data-basemap="${target}"]`);
    if (lbl) lbl.classList.add('active');
  }

  if (snapshot.rasterLayers && Array.isArray(snapshot.rasterLayers)) {
    snapshot.rasterLayers.forEach(function(rd) {
      var bounds = L.latLngBounds([rd.bounds.south, rd.bounds.west], [rd.bounds.north, rd.bounds.east]);
      var overlay = L.imageOverlay(rd.dataUrl, bounds, { opacity: rd.opacity || 1.0 }).addTo(map);
      if (rd.visible === false) map.removeLayer(overlay);
      var ro = { id: rd.id || 'raster_' + (++rasterCounter), name: rd.name, overlay: overlay, bounds: rd.bounds, dataUrl: rd.dataUrl, visible: rd.visible !== false, opacity: rd.opacity || 1.0 };
      rasterStore.push(ro);
    });
    syncRasterZIndex();
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
          dd.innerHTML = ''; dd.style.display = '';
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
  const a = document.createElement('a'); a.href = url; a.download = `${baseName}.gisproject`; a.click();
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
    } catch (err) { alert('Could not open project file. Make sure it is a valid .gisproject file.'); console.error(err); }
    e.target.value = '';
  };
  reader.readAsText(file);
}

function exportLayerGeoJSON(layer) {
  var json = JSON.stringify(layer.geojson, null, 2);
  var blob = new Blob([json], { type: 'application/geo+json' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a'); a.href = url; a.download = (layer.name || 'layer').replace(/[^\w\-]+/g, '-') + '.geojson'; a.click();
  URL.revokeObjectURL(url);
}

function exportHTML() {
  syncProjectMetaFromUI();
  const center = map.getCenter();
  const exportData = {
    title: projectTitle, dataNote, searchMode, basemap: currentBasemap,
    mbtilesFilename: currentBasemap === 'local' ? localMBFilename : '',
    mapView: { lat: center.lat, lng: center.lng, zoom: map.getZoom() },
    layers: layerStore.map(l => ({
      name: l.name, geojson: l.geojson, color: l.color, strokeColor: l.strokeColor || l.color,
    weight: l.weight, opacity: l.opacity ?? 0.4,
      pointSymbolType: l.pointSymbolType || 'circle', pointSize: l.pointSize ?? 10,
      pointStrokeColor: l.pointStrokeColor || null, pointStrokeWidth: l.pointStrokeWidth ?? 2,
      customSymbolUrl: l.customSymbolUrl || null, popupEnabled: l.popupEnabled !== false,
      popupTitle: l.popupTitle || '', popupFields: l.popupFields, popupTemplate: l.popupTemplate || '',
      popupShowLabels: l.popupShowLabels !== false, symbologyType: l.symbologyType,
      symbologyField: l.symbologyField, categories: l.categories, categorySymbols: l.categorySymbols || {},
      categorySortMode: l.categorySortMode || 'asc', categoryOrder: l.categoryOrder || [],
      classifyMethod: l.classifyMethod || 'unique', classCount: l.classCount || 5,
      classLimits: l.classLimits || [], intervals: l.intervals || [],
      labelField: l.labelField || '', labelEnabled: l.labelEnabled || false, labelFont: l.labelFont || 'Arial',
      labelSize: l.labelSize || 12, labelColor: l.labelColor || '#ffffff',
      labelStrokeColor: l.labelStrokeColor || '#000000', labelStrokeWidth: l.labelStrokeWidth ?? 2,
      colorRamp: l.colorRamp || '', colorRampReversed: l.colorRampReversed || false,
      customCategoryLabels: l.customCategoryLabels || {}, categoryNoFill: l.categoryNoFill || {}, categoryStroke: l.categoryStroke || {}
    })),
    rasterLayers: rasterStore.map(function(r) {
      return { name: r.name, dataUrl: r.dataUrl, bounds: r.bounds, visible: r.visible, opacity: r.opacity };
    })
  };

  const html = generateHTML(exportData);
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const baseName = (projectTitle || 'my-interactive-map').replace(/[^\w\-]+/g, '-').replace(/^-+|-+$/g, '') || 'my-interactive-map';
  const a = document.createElement("a"); a.href = url; a.download = `${baseName}.html`; a.click();
  URL.revokeObjectURL(url);
}
