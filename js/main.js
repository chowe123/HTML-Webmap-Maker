const map = L.map('map', { crs: L.CRS.EPSG3857, renderer: L.canvas() }).setView([43.7, -79.4], 10);

map.on('click', function() { if (hasSelection()) clearSelection(); });
map.on('contextmenu', function(e) {
  if (e.originalEvent) e.originalEvent.preventDefault();
  var items = [
    { action: 'clear-selection', icon: '✕', label: 'Clear Selection', handler: function() { clearSelection(); } }
  ];
  showCtxMenu(items, e.originalEvent.clientX, e.originalEvent.clientY);
});

setBasemap('none');

document.getElementById('projectTitle').addEventListener('input', syncProjectMetaFromUI);
document.getElementById('dataNote').addEventListener('input', syncProjectMetaFromUI);
document.getElementById('projectTitle').addEventListener('input', syncInfoPanel);
document.getElementById('dataNote').addEventListener('input', syncInfoPanel);
document.getElementById('infoBtn').addEventListener('click', (e) => {
  e.stopPropagation();
  document.getElementById('infoPanel').classList.toggle('hidden');
});
document.getElementById('infoClose').addEventListener('click', () => {
  document.getElementById('infoPanel').classList.add('hidden');
});
syncInfoPanel();

function syncInfoPanel() {
  const titleEl = document.getElementById('infoPanelTitle');
  const bodyEl = document.getElementById('infoPanelBody');
  if (!titleEl || !bodyEl) return;
  const titleInput = document.getElementById('projectTitle');
  const noteInput = document.getElementById('dataNote');
  const title = (titleInput && titleInput.value.trim()) || 'About this map';
  const note = (noteInput && noteInput.value.trim()) || '';
  titleEl.textContent = title;
  bodyEl.innerHTML = '';
  if (note) {
    bodyEl.textContent = note;
  } else {
    const em = document.createElement('span');
    em.className = 'info-empty';
    em.textContent = 'No data note yet. Add one under Map Settings > Data note.';
    bodyEl.appendChild(em);
  }
}
document.getElementById('fileInput').addEventListener('change', handleFile);


var _basemapChanging = false;
document.getElementById('basemapOptions').addEventListener('change', (e) => {
  if (_basemapChanging) return;
  const label = e.target.closest('.basemap-option');
  if (!label || !e.target.matches('input[type="radio"]')) return;
  const name = e.target.value;
  if (name === 'local' && !localMBLayer) {
    _basemapChanging = true;
    document.querySelectorAll('.basemap-option').forEach(el => el.classList.remove('active'));
    var prevRadio = document.querySelector('input[name="basemap"][value="' + currentBasemap + '"]');
    if (prevRadio) prevRadio.checked = true;
    var prevLabel = document.querySelector('.basemap-option[data-basemap="' + currentBasemap + '"]');
    if (prevLabel) prevLabel.classList.add('active');
    _basemapChanging = false;
    document.getElementById('mbtilesFileInput').click();
    return;
  }
  setBasemap(name);
  document.querySelectorAll('.basemap-option').forEach(el => el.classList.remove('active'));
  label.classList.add('active');
});

document.getElementById('mbtilesFileInput').addEventListener('change', function(e) {
  var file = e.target.files[0];
  if (!file) return;
  e.target.value = '';
  loadLocalMBTiles(file).then(function() {
    setBasemap('local');
    document.querySelectorAll('.basemap-option').forEach(function(el) { el.classList.remove('active'); });
    var lbl = document.querySelector('.basemap-option[data-basemap="local"]');
    if (lbl) lbl.classList.add('active');
  }).catch(function(err) {
    alert('Failed to load mbtiles: ' + (err.message || err));
    setBasemap(currentBasemap);
  });
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

window.addEventListener('beforeunload', (e) => {
  if (layerStore.length > 0 || rasterStore.length > 0 || document.getElementById('projectTitle').value || document.getElementById('dataNote').value) {
    e.preventDefault(); e.returnValue = '';
  }
});

document.addEventListener('contextmenu', function(e) { e.preventDefault(); });
document.querySelector('#attr-table-panel .attr-table-bar').addEventListener('click', toggleAttrTable);
document.getElementById('attr-table-tab').addEventListener('click', function() {
  var panel = document.getElementById('attr-table-panel');
  if (panel && !panel.classList.contains('expanded')) {
    panel.classList.add('expanded');
    updateAttrTableTab();
    if (_attrTableLayer) populateAttrTable(_attrTableLayer);
    setTimeout(function() { if (typeof map !== 'undefined' && map) map.invalidateSize(); }, 50);
  }
});

(function() {
  var panel = document.getElementById('attr-table-panel');
  var handle = panel.querySelector('.attr-resize-handle');
  var startY, startH;
  handle.addEventListener('mousedown', function(e) {
    e.preventDefault();
    e.stopPropagation();
    handle.classList.add('drag');
    startY = e.clientY;
    startH = panel.offsetHeight;
    panel.style.transition = 'none';
    function onMove(ev) {
      var delta = startY - ev.clientY;
      var h = Math.max(100, Math.min(window.innerHeight * 0.7, startH + delta));
      panel.style.maxHeight = h + 'px';
    }
    function onUp() {
      handle.classList.remove('drag');
      panel.style.transition = '';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
})();
document.addEventListener('click', function(e) {
  var menu = document.getElementById('ctxMenu');
  if (menu && !menu.contains(e.target)) closeCtxMenu();
});

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

document.getElementById("exportBtn").addEventListener("click", exportHTML);
document.getElementById("saveProjectBtn").addEventListener("click", saveProject);
document.getElementById("loadProjectBtn").addEventListener("click", () => { document.getElementById("projectInput").click(); });
document.getElementById("projectInput").addEventListener("change", handleProjectFile);

new MapSearchControl().addTo(map);
