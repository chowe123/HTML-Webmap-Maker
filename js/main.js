const map = L.map('map', { crs: L.CRS.EPSG3857 }).setView([43.7, -79.4], 10);

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
document.getElementById('fileInput').addEventListener('change', handleFile);

document.getElementById('mapRotationSlider').addEventListener('input', function() {
  var val = parseInt(this.value) || 0;
  document.getElementById('mapRotationInput').value = val;
  setMapRotation(val);
});
document.getElementById('mapRotationInput').addEventListener('input', function() {
  var val = parseInt(this.value) || 0;
  if (val < 0) val = 0;
  if (val > 360) val = 360;
  this.value = val;
  document.getElementById('mapRotationSlider').value = val;
  setMapRotation(val);
});

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

window.addEventListener('beforeunload', (e) => {
  if (layerStore.length > 0 || document.getElementById('projectTitle').value || document.getElementById('dataNote').value) {
    e.preventDefault(); e.returnValue = '';
  }
});

document.addEventListener('contextmenu', function(e) { e.preventDefault(); });
document.querySelector('#attr-table-panel .attr-table-bar').addEventListener('click', toggleAttrTable);
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
