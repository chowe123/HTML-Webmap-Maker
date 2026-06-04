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
      <div class="layer-header" data-layer-id="${layer.id}">
        <div class="layer-title-wrapper">
          <input type="checkbox" class="layer-checkbox" ${layer.visible ? "checked" : ""} />
          <span class="layer-name-display">${escapeHtml(layer.name)}</span>
          ${layer.filterEnabled && (layer.filterMode === 'advanced' ? layer.filterExpression : layer.filterField) ? '<span style="font-size:9px;color:var(--accent);margin-left:4px;flex-shrink:0;">[filter' + (layer.filterMode === 'advanced' ? '*]' : ']') + '</span>' : ''}
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
              <div class="layer-sym-trigger" style="display:flex; align-items:center; gap:10px; cursor:pointer; padding:8px; border-radius:6px; border:1px solid var(--border-color); background:rgba(15,23,42,0.4); margin-bottom:4px;" title="Click to edit point symbol">
                <div class="layer-sym-preview" style="display:flex; align-items:center; justify-content:center; width:36px; height:36px; background:rgba(0,0,0,0.3); border-radius:6px; flex-shrink:0; overflow:hidden;"></div>
                <div style="flex:1; min-width:0;">
                  <div style="font-size:11px; font-weight:600; color:var(--text-primary);">${SYMBOL_SHAPES.find(s => s.id === (layer.pointSymbolType || 'circle'))?.label || 'Circle'}</div>
                  <div style="font-size:10px; color:var(--text-muted);">${layer.pointSize ?? 10}px · stroke ${layer.pointStrokeWidth ?? 2}px</div>
                </div>
                <span style="font-size:10px; color:var(--text-muted);">✎</span>
              </div>
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
        </div>
        <div>
          <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
            <label>Layer Opacity</label>
            <span class="layer-opacity-value" style="font-size:10px; color:var(--accent); font-weight:bold;">${Math.round((layer.opacity ?? 0.4) * 100)}%</span>
          </div>
          <input type="range" class="layer-opacity" min="0" max="100" value="${Math.round((layer.opacity ?? 0.4) * 100)}" style="width:100%; accent-color:var(--accent);" />
        </div>
          </div>
        </div>

      </div>
    `;

    div.addEventListener('contextmenu', (e) => { e.preventDefault(); e.stopPropagation(); showLayerContextMenu(e, layer); });

    div.querySelector('.layer-checkbox').onchange = () => toggleLayer(layer.id);
    const weightInput = div.querySelector('.layer-weight');
    const weightLabel = div.querySelector('.layer-weight-value');
    let weightRaf = null;
    weightInput.addEventListener('input', (e) => {
      const w = parseInt(e.target.value, 10);
      if (weightLabel) weightLabel.textContent = w ? `${w}px` : 'No border';
      if (weightRaf) cancelAnimationFrame(weightRaf);
      weightRaf = requestAnimationFrame(() => { updateStyle(layer.id, 'weight', w, { renderUI: false }); weightRaf = null; });
    });

    const opacityInput = div.querySelector('.layer-opacity');
    const opacityLabel = div.querySelector('.layer-opacity-value');
    let opacityRaf = null;
    opacityInput.addEventListener('input', (e) => {
      const pct = parseInt(e.target.value, 10);
      if (opacityLabel) opacityLabel.textContent = `${pct}%`;
      if (opacityRaf) cancelAnimationFrame(opacityRaf);
      opacityRaf = requestAnimationFrame(() => { updateStyle(layer.id, 'opacity', pct / 100, { renderUI: false }); opacityRaf = null; });
    });

    const strokeColorInput = div.querySelector('.stroke-color');
    let strokeRaf = null;
    strokeColorInput.addEventListener('input', (e) => {
      if (strokeRaf) cancelAnimationFrame(strokeRaf);
      strokeRaf = requestAnimationFrame(() => { updateStyle(layer.id, 'strokeColor', e.target.value, { renderUI: false }); strokeRaf = null; });
    });
    div.querySelector('.btn-up').onclick = () => moveLayer(i, 1);
    div.querySelector('.btn-down').onclick = () => moveLayer(i, -1);
    div.querySelector('.btn-delete-layer').onclick = () => deleteLayer(layer.id);

    const pointPanel = div.querySelector('.point-symbol-panel');
    if (pointPanel) {
      const symTrigger = pointPanel.querySelector('.layer-sym-trigger');
      const symPreview = pointPanel.querySelector('.layer-sym-preview');
      if (symPreview) {
        const st = layer.pointSymbolType || 'circle';
        const sc = layer.pointStrokeColor || '#ffffff';
        const sw = layer.pointStrokeWidth ?? 2;
        const sz = layer.pointSize ?? 10;
        if (st === 'custom' && layer.customSymbolUrl) {
          symPreview.innerHTML = '<img src="' + layer.customSymbolUrl + '" style="width:28px;height:28px;object-fit:contain;" />';
        } else {
          symPreview.innerHTML = buildPointSymbolHtml(st, layer.color, sc, Math.max(6, sz / 2), sw);
        }
      }
      if (symTrigger) {
        symTrigger.addEventListener('click', () => openLayerSymbolEditor(layer));
      }
    }

    const symbologyHeader = div.querySelector('[data-section="symbology"]');
    if (symbologyHeader) {
      symbologyHeader.addEventListener('click', (e) => { e.stopPropagation(); layer.symbologyExpanded = !layer.symbologyExpanded; renderUI(); });
    }

    const settingsHeader = div.querySelector('[data-section="settings"]');
    if (settingsHeader) {
      settingsHeader.addEventListener('click', (e) => { e.stopPropagation(); layer.settingsExpanded = !layer.settingsExpanded; renderUI(); });
    }

    div.querySelector('.symbology-type').onchange = (e) => updateStyle(layer.id, "symbologyType", e.target.value);
    const singleColorInput = div.querySelector('.single-color');
    if (singleColorInput) {
      singleColorInput.addEventListener('input', (e) => { updateStyle(layer.id, 'color', e.target.value, { renderUI: false }); });
      singleColorInput.addEventListener('change', (e) => { updateStyle(layer.id, 'color', e.target.value); });
    }
    div.querySelector('.symbology-field').onchange = (e) => updateStyle(layer.id, 'symbologyField', e.target.value);

    const classifyOptions = div.querySelector('.classify-options');
    if (classifyOptions) {
      const classifyMethodEl = classifyOptions.querySelector('.classify-method');
      const classCountEl = classifyOptions.querySelector('.class-count');
      const manualLimitsDiv = classifyOptions.querySelector('.manual-class-limits');

      if (classifyMethodEl) { classifyMethodEl.onchange = (e) => updateStyle(layer.id, 'classifyMethod', e.target.value); }
      if (classCountEl) { classCountEl.onchange = (e) => updateStyle(layer.id, 'classCount', parseInt(e.target.value, 10) || 5); }

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

        function rampGradientCSS(stops) { return `linear-gradient(to right, ${stops.join(', ')})`; }

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
            layer.colorRamp = ''; layer.colorRampReversed = false;
            const keys = Object.keys(layer.categories).filter(k => k !== '__non_numeric__');
            keys.forEach(k => { layer.categories[k] = getRandomColor(); });
          }
          updateTrigger(); closeDropdown();
          if (layerHasPoints(layer)) { rebuildLeafletLayer(layer); } else { refreshLayerStyle(layer); renderUI(); }
        }

        function closeDropdown() { dropdown.classList.remove('open'); document.removeEventListener('click', closeOnClickOutside); }
        function closeOnClickOutside(e) { if (!picker.contains(e.target)) closeDropdown(); }

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

        trigger.addEventListener('click', (e) => { e.stopPropagation(); if (dropdown.classList.contains('open')) closeDropdown(); else openDropdown(); });
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

        const colorSwatch = document.createElement('div');
        colorSwatch.style.cssText = 'width:22px; height:18px; border-radius:3px; cursor:pointer; flex-shrink:0; border:1px solid var(--border-color);';
        colorSwatch.style.backgroundColor = layer.categories[catKey];
        colorSwatch.title = 'Click to edit color';
        colorSwatch.addEventListener('click', (e) => {
          e.stopPropagation();
          const existing = document.getElementById('cat-color-popup');
          if (existing) { existing.remove(); return; }
          const popup = document.createElement('div');
          popup.id = 'cat-color-popup';
          popup.style.cssText = 'position:fixed; z-index:10000; background:#0f172a; border:1px solid var(--border-color); border-radius:8px; padding:10px; box-shadow:0 4px 16px rgba(0,0,0,0.4);';
          const rect = colorSwatch.getBoundingClientRect();
          popup.style.left = rect.left + 'px';
          popup.style.top = (rect.bottom + 4) + 'px';
          const ci = document.createElement('input');
          ci.type = 'color';
          ci.value = layer.categories[catKey];
          ci.style.cssText = 'width:100%; height:32px; border:0; padding:0; cursor:pointer; margin-bottom:8px;';
          ci.addEventListener('input', (ev) => {
            colorSwatch.style.backgroundColor = ev.target.value;
            updateCategoryColor(layer.id, catKey, ev.target.value, { renderUI: false });
          });
          ci.addEventListener('change', (ev) => {
            updateCategoryColor(layer.id, catKey, ev.target.value);
          });
          popup.appendChild(ci);
          const nfRow = document.createElement('label');
          nfRow.style.cssText = 'display:flex; align-items:center; gap:6px; font-size:11px; color:var(--text-secondary); cursor:pointer; white-space:nowrap;';
          const nfCheck = document.createElement('input');
          nfCheck.type = 'checkbox';
          nfCheck.checked = !!(layer.categoryNoFill && layer.categoryNoFill[catKey]);
          nfCheck.style.cssText = 'accent-color:var(--accent); cursor:pointer;';
          nfCheck.addEventListener('change', () => {
            if (!layer.categoryNoFill) layer.categoryNoFill = {};
            layer.categoryNoFill[catKey] = nfCheck.checked;
            rebuildLeafletLayer(layer, { renderUI: false });
          });
          nfRow.appendChild(nfCheck);
          nfRow.appendChild(document.createTextNode('Transparent fill'));
          popup.appendChild(nfRow);

          const cs = (layer.categoryStroke && layer.categoryStroke[catKey]) || {};

          const scLabel = document.createElement('div');
          scLabel.style.cssText = 'font-size:10px; color:var(--text-muted); margin-top:6px; margin-bottom:4px;';
          scLabel.textContent = 'Stroke';
          popup.appendChild(scLabel);

          const scColorRow = document.createElement('div');
          scColorRow.style.cssText = 'display:flex; align-items:center; gap:6px; margin-bottom:4px;';
          const scColor = document.createElement('input');
          scColor.type = 'color';
          scColor.value = cs.color || layer.strokeColor || layer.color;
          scColor.style.cssText = 'width:24px; height:20px; border:0; padding:0; cursor:pointer; flex-shrink:0;';
          scColor.addEventListener('input', () => {
            if (!layer.categoryStroke) layer.categoryStroke = {};
            if (!layer.categoryStroke[catKey]) layer.categoryStroke[catKey] = {};
            layer.categoryStroke[catKey].color = scColor.value;
            if (!popup._scRaf) popup._scRaf = requestAnimationFrame(() => { rebuildLeafletLayer(layer, { renderUI: false }); popup._scRaf = null; });
          });
          scColorRow.appendChild(scColor);
          const scHex = document.createElement('span');
          scHex.style.cssText = 'font-size:10px; color:var(--text-muted);';
          scHex.textContent = scColor.value;
          scColor.addEventListener('input', () => { scHex.textContent = scColor.value; });
          scColorRow.appendChild(scHex);
          popup.appendChild(scColorRow);

          const scWidthRow = document.createElement('div');
          scWidthRow.style.cssText = 'display:flex; align-items:center; gap:6px; margin-bottom:4px;';
          const scWidthLabel = document.createElement('span');
          scWidthLabel.style.cssText = 'font-size:10px; color:var(--text-muted); min-width:32px;';
          scWidthLabel.textContent = 'Width';
          scWidthRow.appendChild(scWidthLabel);
          const scWidth = document.createElement('input');
          scWidth.type = 'range'; scWidth.min = 0; scWidth.max = 10; scWidth.step = 0.5;
          scWidth.value = cs.width !== undefined ? cs.width : layer.weight;
          scWidth.style.cssText = 'flex:1; accent-color:var(--accent);';
          scWidth.addEventListener('input', () => {
            if (!layer.categoryStroke) layer.categoryStroke = {};
            if (!layer.categoryStroke[catKey]) layer.categoryStroke[catKey] = {};
            layer.categoryStroke[catKey].width = parseFloat(scWidth.value);
            scWidthVal.textContent = scWidth.value + 'px';
            if (!popup._swRaf) popup._swRaf = requestAnimationFrame(() => { rebuildLeafletLayer(layer, { renderUI: false }); popup._swRaf = null; });
          });
          scWidthRow.appendChild(scWidth);
          const scWidthVal = document.createElement('span');
          scWidthVal.style.cssText = 'font-size:10px; color:var(--text-muted); min-width:30px; text-align:right;';
          scWidthVal.textContent = scWidth.value + 'px';
          scWidthRow.appendChild(scWidthVal);
          popup.appendChild(scWidthRow);

          const scOpRow = document.createElement('div');
          scOpRow.style.cssText = 'display:flex; align-items:center; gap:6px; margin-bottom:2px;';
          const scOpLabel = document.createElement('span');
          scOpLabel.style.cssText = 'font-size:10px; color:var(--text-muted); min-width:32px;';
          scOpLabel.textContent = 'Opacity';
          scOpRow.appendChild(scOpLabel);
          const scOp = document.createElement('input');
          scOp.type = 'range'; scOp.min = 0; scOp.max = 100;
          scOp.value = cs.opacity !== undefined ? Math.round(cs.opacity * 100) : Math.round((layer.opacity ?? 0.4) * 100);
          scOp.style.cssText = 'flex:1; accent-color:var(--accent);';
          scOp.addEventListener('input', () => {
            if (!layer.categoryStroke) layer.categoryStroke = {};
            if (!layer.categoryStroke[catKey]) layer.categoryStroke[catKey] = {};
            layer.categoryStroke[catKey].opacity = parseInt(scOp.value) / 100;
            scOpVal.textContent = scOp.value + '%';
            if (!popup._soRaf) popup._soRaf = requestAnimationFrame(() => { rebuildLeafletLayer(layer, { renderUI: false }); popup._soRaf = null; });
          });
          scOpRow.appendChild(scOp);
          const scOpVal = document.createElement('span');
          scOpVal.style.cssText = 'font-size:10px; color:var(--text-muted); min-width:30px; text-align:right;';
          scOpVal.textContent = scOp.value + '%';
          scOpRow.appendChild(scOpVal);
          popup.appendChild(scOpRow);

          document.body.appendChild(popup);
          setTimeout(() => {
            const closer = (ev) => { if (!popup.contains(ev.target)) { popup.remove(); document.removeEventListener('mousedown', closer); } };
            document.addEventListener('mousedown', closer);
          }, 0);
        });
        catRow.appendChild(colorSwatch);

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
    legendGroup.draggable = true;
    legendGroup.dataset.layerIndex = i;
    if (!layer.showLegend) legendGroup.style.opacity = '0.35';

    const legendItem = document.createElement('div');
    legendItem.className = 'legend-item';
    legendItem.style.cssText = 'display:flex;align-items:center;gap:8px;';
    const eyeBtn = document.createElement('span');
    eyeBtn.style.cssText = 'cursor:pointer;font-size:10px;color:var(--text-muted);flex-shrink:0;line-height:1;';
    eyeBtn.textContent = layer.showLegend ? '👁' : '🚫';
    eyeBtn.title = layer.showLegend ? 'Hide from legend' : 'Show in legend';
    eyeBtn.addEventListener('click', (function(lid, cur) {
      return function() {
        var l = layerStore.find(function(x) { return x.id === lid; });
        if (l) { l.showLegend = !cur; renderUI(); }
      };
    })(layer.id, layer.showLegend));
    legendItem.appendChild(eyeBtn);
    var nameSpan = document.createElement('span');
    nameSpan.textContent = layer.name;
    nameSpan.style.cssText = 'flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
    legendItem.appendChild(nameSpan);
    legendGroup.appendChild(legendItem);

    if (!layer.showLegend) { legendDiv.appendChild(legendGroup); continue; }

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
      const btnLabel = isAsc ? (isNumeric ? '↑ 1→9' : '↑ A→Z') : (isNumeric ? '↓ 9→1' : '↓ Z→A');
      const toggleBtn = document.createElement('button');
      toggleBtn.type = 'button';
      toggleBtn.className = 'legend-sort-btn active';
      toggleBtn.textContent = btnLabel;
      toggleBtn.onclick = () => toggleCategorySort(layer.id);
      sortBar.appendChild(toggleBtn);
      legendGroup.appendChild(sortBar);

      const orderedKeys = getOrderedCategoryKeys(layer);
      var hiddenSet = {};
      layer.hiddenCatKeys.forEach(function(k) { hiddenSet[k] = true; });
      var hiddenCount = layer.hiddenCatKeys.length;
      orderedKeys.forEach(function(catKey) {
        if (hiddenSet[catKey]) return;
        const row = document.createElement('div');
        row.className = 'legend-subitem-row';
        row.draggable = true;

        row.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', catKey); row.classList.add('dragging'); });
        row.addEventListener('dragover', (e) => { e.preventDefault(); row.classList.add('drag-over'); });
        row.addEventListener('dragleave', () => { row.classList.remove('drag-over'); });
        row.addEventListener('drop', (e) => {
          e.preventDefault(); row.classList.remove('drag-over');
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
          document.querySelectorAll('.legend-subitem-row.dragging, .legend-subitem-row.drag-over').forEach(el => el.classList.remove('dragging', 'drag-over'));
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
            } else { labelSpan.style.display = ''; }
            input.remove();
          };
          input.addEventListener('blur', () => finish(true));
          input.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') finish(true); if (ev.key === 'Escape') finish(false); });
          labelSpan.style.display = 'none';
          labelSpan.parentNode.insertBefore(input, labelSpan);
          input.focus(); input.select();
        });

        subItem.appendChild(labelSpan);
        row.appendChild(subItem);

        const delBtn = document.createElement('button');
        delBtn.type = 'button'; delBtn.className = 'legend-del-btn'; delBtn.title = 'Remove category'; delBtn.textContent = '×';
        delBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (!layer.hiddenCatKeys.includes(catKey)) layer.hiddenCatKeys.push(catKey);
          renderUI();
        });
        row.appendChild(delBtn);

        legendGroup.appendChild(row);
      });
      if (hiddenCount > 0) {
        var showAllBtn = document.createElement('div');
        showAllBtn.style.cssText = 'font-size:10px;color:var(--accent);cursor:pointer;padding:4px 8px;margin-top:2px;';
        showAllBtn.textContent = 'Show ' + hiddenCount + ' hidden categor' + (hiddenCount === 1 ? 'y' : 'ies');
        showAllBtn.addEventListener('click', (function(lid) {
          return function() { var l = layerStore.find(function(x) { return x.id === lid; }); if (l) { l.hiddenCatKeys = []; renderUI(); } };
        })(layer.id));
        legendGroup.appendChild(showAllBtn);
      }
    }

    legendGroup.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', String(i)); legendGroup.classList.add('dragging'); });
    legendGroup.addEventListener('dragover', (e) => { e.preventDefault(); legendGroup.classList.add('drag-over'); });
    legendGroup.addEventListener('dragleave', () => { legendGroup.classList.remove('drag-over'); });
    legendGroup.addEventListener('drop', (e) => {
      e.preventDefault(); legendGroup.classList.remove('drag-over');
      const fromIdx = parseInt(e.dataTransfer.getData('text/plain'), 10);
      if (isNaN(fromIdx) || fromIdx === i) return;
      const layer = layerStore.splice(fromIdx, 1)[0];
      layerStore.splice(i, 0, layer);
      renderUI();
      syncMapZIndex();
    });
    legendGroup.addEventListener('dragend', () => {
      legendGroup.classList.remove('dragging');
      document.querySelectorAll('.legend-group.drag-over').forEach(el => el.classList.remove('drag-over'));
    });

    legendDiv.appendChild(legendGroup);
  }

  // Raster layers
  rasterStore.forEach(function(r) {
    var node = document.createElement('div');
    node.className = 'layer-node';
    node.style.borderLeft = '3px solid #64748b';
    node.innerHTML = '<div class="layer-header"><div class="layer-title-wrapper"><input type="checkbox" class="layer-checkbox" ' + (r.visible ? 'checked' : '') + ' /><span class="layer-name-display">' + escapeHtml(r.name) + '</span></div><div class="reorder-btns"><button class="btn-delete-layer" title="Delete raster">✕</button></div></div>'
      + '<div class="layer-controls"><div style="display:flex;justify-content:space-between;margin-bottom:2px;"><label>Opacity</label><span class="raster-opacity-value" style="font-size:10px;color:var(--accent);font-weight:bold;">' + Math.round((r.opacity || 1) * 100) + '%</span></div>'
      + '<input type="range" class="raster-opacity" min="0" max="100" value="' + Math.round((r.opacity || 1) * 100) + '" style="width:100%;accent-color:var(--accent);" /></div>';
    node.querySelector('.layer-checkbox').onchange = function() { toggleRasterLayer(r.id); };
    node.querySelector('.btn-delete-layer').onclick = function() { removeRasterLayer(r.id); };
    var opSlider = node.querySelector('.raster-opacity');
    var opLabel = node.querySelector('.raster-opacity-value');
    opSlider.addEventListener('input', function(e) {
      var pct = parseInt(e.target.value, 10);
      if (opLabel) opLabel.textContent = pct + '%';
      updateRasterOpacity(r.id, pct / 100);
    });
    node.addEventListener('contextmenu', function(e) {
      e.preventDefault(); e.stopPropagation();
      showCtxMenu([
        { action: 'rename', icon: '✎', label: 'Rename', handler: function() { startRasterRename(r); } },
        { action: 'delete', icon: '✕', label: 'Delete', handler: function() { removeRasterLayer(r.id); } }
      ], e.clientX, e.clientY);
    });
    layersDiv.appendChild(node);

    var rg = document.createElement('div');
    rg.className = 'legend-group';
    rg.style.borderLeft = '3px solid #64748b';
    rg.style.paddingLeft = '8px';
    rg.innerHTML = '<div class="legend-item" style="font-size:12px;">🖼 ' + escapeHtml(r.name) + '</div>';
    legendDiv.appendChild(rg);
  });
}
