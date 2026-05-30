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
          </div>
        </div>

      </div>
    `;

    div.addEventListener('contextmenu', (e) => { e.preventDefault(); e.stopPropagation(); showLayerContextMenu(e, layer); });

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
    if (noFillCheck) { noFillCheck.addEventListener('change', () => updateStyle(layer.id, 'noFill', noFillCheck.checked)); }

    const strokeColorInput = div.querySelector('.stroke-color');
    strokeColorInput.addEventListener('input', (e) => { updateStyle(layer.id, 'strokeColor', e.target.value, { renderUI: false }); });
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

      if (symbolTypeEl) { symbolTypeEl.onchange = (e) => updateStyle(layer.id, 'pointSymbolType', e.target.value); }
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
        pointStrokeColorEl.addEventListener('input', (e) => { updateStyle(layer.id, 'pointStrokeColor', e.target.value, { renderUI: false }); });
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

        const colorInput = document.createElement('input');
        colorInput.type = 'color';
        colorInput.value = layer.categories[catKey];
        colorInput.style.cssText = 'width:22px; height:18px; border:0; padding:0; background:none; cursor:pointer; flex-shrink:0;';
        colorInput.addEventListener('input', (e) => { updateCategoryColor(layer.id, catKey, e.target.value, { renderUI: false }); });
        colorInput.addEventListener('change', (e) => { updateCategoryColor(layer.id, catKey, e.target.value); });
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
}
