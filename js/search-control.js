const MapSearchControl = L.Control.extend({
  options: { position: 'topright' },
  onAdd: function(map) {
    const container = L.DomUtil.create('div', 'leaflet-bar map-search-control');
    const inner = L.DomUtil.create('div', 'map-search-inner', container);
    inner.innerHTML = `
      <input type="text" id="mapSearchBox" placeholder="Search places\u2026" />
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

    if (searchMode === 'off') { container.style.display = 'none'; }
    if (searchMode === 'pin' && toggleBtn) { toggleBtn.style.display = 'none'; setPinnedMode(); }
    if (toggleBtn) {
      toggleBtn.addEventListener('click', function() {
        setMode(searchMode !== 'pin');
        var radio = document.querySelector('input[name="searchMode"][value="' + searchMode + '"]');
        if (radio) radio.checked = true;
      });
    }

    function setPinnedMode() {
      isPinMode = true; searchMode = 'pin';
      input.placeholder = 'lat, lon (e.g. 43.86, -79.29)';
      searchBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>';
      searchBtn.title = 'Place pin';
      dropdown.style.display = 'block';
      dropdown.innerHTML = '<div class="map-pin-hint">Enter coordinates as <b>lat, lon</b> then press Enter or click the pin button.</div>';
      input.value = '';
    }

    function setSearchMode() {
      isPinMode = false; searchMode = 'both';
      input.placeholder = 'Search places\u2026';
      searchBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';
      searchBtn.title = 'Search';
      dropdown.innerHTML = ''; dropdown.style.display = '';
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
      if (searchMode === 'pin') {
        const parts = input.value.split(',').map(s => s.trim());
        if (parts.length === 2) {
          const lat = parseFloat(parts[0]), lon = parseFloat(parts[1]);
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
        fetch(url).then(r => r.json()).then(data => {
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
        }).catch(() => {});
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
