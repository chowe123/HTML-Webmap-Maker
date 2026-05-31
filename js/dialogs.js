function closeCtxMenu() {
  const menu = document.getElementById('ctxMenu');
  if (menu) menu.style.display = 'none';
}

function showCtxMenu(items, x, y) {
  closeCtxMenu();
  const menu = document.getElementById('ctxMenu');
  if (!menu) return;
  menu.innerHTML = items.map(function(item) {
    if (item.separator) return '<div class="ctx-separator"></div>';
    return '<div class="ctx-item" data-action="' + item.action + '"><span class="ctx-icon">' + item.icon + '</span> ' + item.label + '</div>';
  }).join('');
  menu.style.display = 'block';
  menu.style.left = Math.min(x, window.innerWidth - menu.offsetWidth - 10) + 'px';
  menu.style.top = Math.min(y, window.innerHeight - menu.offsetHeight - 10) + 'px';
  menu.querySelectorAll('.ctx-item').forEach(function(el) {
    el.addEventListener('click', function() {
      closeCtxMenu();
      var action = el.dataset.action;
      for (var i = 0; i < items.length; i++) {
        if (items[i].action === action && items[i].handler) { items[i].handler(); return; }
      }
    });
  });
}

function showLayerContextMenu(e, layer) {
  var items = [
    { action: 'rename', icon: '✎', label: 'Rename', handler: function() { startLayerRename(layer); } },
    { action: 'attr-table', icon: '⊞', label: 'Attribute Table', handler: function() { populateAttrTable(layer); } },
    { separator: true },
    { action: 'filter-data', icon: '🔍', label: 'Filter Data', handler: function() { openFilterEditor(layer); } },
    { action: 'select-by-attr', icon: '☐', label: 'Select by Attribute', handler: function() { openSelectByAttribute(layer); } },
    { action: 'popup-settings', icon: '💬', label: 'Popup Settings', handler: function() { openPopupSettings(layer); } },
    { action: 'label-settings', icon: 'Aa', label: 'Label Settings', handler: function() { openLabelEditor(layer); } },
    { separator: true },
    { action: 'export-geojson', icon: '⬇', label: 'Export to GeoJSON', handler: function() { exportLayerGeoJSON(layer); } },
    { separator: true },
    { action: 'clear-selection', icon: '✕', label: 'Clear Selection', handler: function() { clearSelection(); } }
  ];
  showCtxMenu(items, e.clientX, e.clientY);
}

function startLayerRename(layer) {
  const layersDiv = document.getElementById('layers');
  const nameSpan = layersDiv.querySelector(`.layer-header[data-layer-id="${layer.id}"] .layer-name-display`);
  if (!nameSpan) return;
  const currentName = nameSpan.textContent;
  const input = document.createElement('input');
  input.type = 'text'; input.className = 'layer-name-input'; input.value = currentName;
  nameSpan.replaceWith(input);
  input.focus(); input.select();
  function finish(confirmed) {
    const newName = confirmed ? input.value.trim() : currentName;
    if (newName && newName !== currentName) renameLayer(layer.id, newName);
    const span = document.createElement('span'); span.className = 'layer-name-display'; span.textContent = newName || currentName;
    input.replaceWith(span);
  }
  input.addEventListener('blur', () => finish(true));
  input.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); input.blur(); } if (ev.key === 'Escape') { ev.preventDefault(); finish(false); } });
}

// =========================
// FILTER EDITOR
// =========================

function closeFilterEditor() {
  var overlay = document.getElementById('filter-editor-overlay');
  if (overlay) overlay.remove();
}

function openFilterEditor(layer) {
  closeFilterEditor();
  var overlay = document.createElement('div');
  overlay.id = 'filter-editor-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;';

  var fieldOpts = '';
  (layer.fields || []).forEach(function(f) { fieldOpts += '<option value="' + escapeHtml(f) + '" ' + (layer.filterField === f ? 'selected' : '') + '>' + escapeHtml(f) + '</option>'; });

  var operators = [
    { value: 'equals', label: 'Equals' }, { value: 'not_equals', label: 'Not equals' },
    { value: 'contains', label: 'Contains' }, { value: 'not_contains', label: 'Does not contain' },
    { value: 'greater', label: 'Greater than' }, { value: 'less', label: 'Less than' },
    { value: 'greater_eq', label: 'Greater or equal' }, { value: 'less_eq', label: 'Less or equal' },
    { value: 'is_empty', label: 'Is empty' }, { value: 'not_empty', label: 'Is not empty' }
  ];
  var opOpts = '';
  operators.forEach(function(o) { opOpts += '<option value="' + o.value + '" ' + (layer.filterOp === o.value ? 'selected' : '') + '>' + o.label + '</option>'; });

  var hideValue = layer.filterOp === 'is_empty' || layer.filterOp === 'not_empty';
  var isAdvanced = layer.filterMode === 'advanced';

  overlay.innerHTML = [
    '<div style="background:var(--bg-sidebar);border:1px solid var(--border-color);border-radius:var(--radius-lg);box-shadow:var(--shadow-lg);width:480px;display:flex;flex-direction:column;">',
      '<div style="display:flex;align-items:center;padding:16px 20px;border-bottom:1px solid var(--border-color);flex-shrink:0;">',
        '<h3 style="font-size:15px;font-weight:700;color:var(--text-primary);flex:1;">Filter Data: ' + escapeHtml(layer.name) + '</h3>',
        '<button class="fe-close" style="background:rgba(255,255,255,0.04);border:1px solid var(--border-color);color:var(--text-muted);width:28px;height:28px;border-radius:6px;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;">&times;</button>',
      '</div>',
      '<div style="padding:16px 20px;overflow-y:auto;">',
        '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px;font-weight:500;color:var(--text-primary);margin-bottom:14px;">',
          '<input type="checkbox" class="fe-enabled" ' + (layer.filterEnabled ? 'checked' : '') + ' style="accent-color:var(--accent);" />',
          'Enable filter',
        '</label>',
        '<div class="fe-settings" style="display:' + (layer.filterEnabled ? 'block' : 'none') + ';">',
          '<div style="display:flex;gap:0;margin-bottom:14px;border:1px solid var(--border-color);border-radius:var(--radius-md);overflow:hidden;">',
            '<button type="button" class="fe-mode-btn" data-mode="simple" style="flex:1;padding:6px 0;font-size:11px;font-weight:500;border:none;cursor:pointer;background:' + (isAdvanced ? 'transparent' : 'var(--accent)') + ';color:' + (isAdvanced ? 'var(--text-muted)' : '#fff') + ';">Simple</button>',
            '<button type="button" class="fe-mode-btn" data-mode="advanced" style="flex:1;padding:6px 0;font-size:11px;font-weight:500;border:none;cursor:pointer;background:' + (isAdvanced ? 'var(--accent)' : 'transparent') + ';color:' + (isAdvanced ? '#fff' : 'var(--text-muted)') + ';">Advanced (JS)</button>',
          '</div>',
          '<div class="fe-simple" style="display:' + (isAdvanced ? 'none' : 'block') + ';">',
            '<div style="margin-bottom:12px;"><label style="display:block;font-size:11px;font-weight:500;color:var(--text-secondary);margin-bottom:4px;">Field</label><select class="fe-field" style="width:100%;padding:7px 10px;background:rgba(0,0,0,0.3);border:1px solid var(--border-color);border-radius:var(--radius-md);color:var(--text-primary);font-size:12px;font-family:inherit;outline:none;">' + fieldOpts + '</select></div>',
            '<div style="margin-bottom:12px;"><label style="display:block;font-size:11px;font-weight:500;color:var(--text-secondary);margin-bottom:4px;">Condition</label><select class="fe-op" style="width:100%;padding:7px 10px;background:rgba(0,0,0,0.3);border:1px solid var(--border-color);border-radius:var(--radius-md);color:var(--text-primary);font-size:12px;font-family:inherit;outline:none;">' + opOpts + '</select></div>',
            '<div class="fe-value-wrap" style="margin-bottom:12px;display:' + (hideValue ? 'none' : 'block') + ';"><label style="display:block;font-size:11px;font-weight:500;color:var(--text-secondary);margin-bottom:4px;">Value</label><input type="text" class="fe-value" value="' + escapeHtml(layer.filterValue || '') + '" placeholder="e.g. Residential" style="width:100%;padding:7px 10px;background:rgba(0,0,0,0.3);border:1px solid var(--border-color);border-radius:var(--radius-md);color:var(--text-primary);font-size:12px;font-family:inherit;outline:none;box-sizing:border-box;" /></div>',
          '</div>',
          '<div class="fe-advanced" style="display:' + (isAdvanced ? 'block' : 'none') + ';">',
            '<div style="margin-bottom:8px;"><label style="display:block;font-size:11px;font-weight:500;color:var(--text-secondary);margin-bottom:4px;">Insert field</label><select class="fe-field-insert" style="width:100%;padding:7px 10px;background:rgba(0,0,0,0.3);border:1px solid var(--border-color);border-radius:var(--radius-md);color:var(--text-primary);font-size:12px;font-family:inherit;outline:none;">' +
              '<option value="">-- select field --</option>' +
              (layer.fields || []).map(function(f) {
                var safe = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(f) ? 'p.' + f : 'p[' + JSON.stringify(f) + ']';
                return '<option value="' + escapeHtml(safe) + '">' + escapeHtml(f) + '</option>';
              }).join('') +
            '</select></div>',
            '<div style="margin-bottom:8px;"><label style="display:block;font-size:11px;font-weight:500;color:var(--text-secondary);margin-bottom:4px;">JavaScript expression</label><textarea class="fe-expression" rows="5" placeholder="e.g. p.ZONING === &#39;Residential&#39; &amp;&amp; p.ACRES &gt; 10" style="width:100%;padding:7px 10px;background:rgba(0,0,0,0.3);border:1px solid var(--border-color);border-radius:var(--radius-md);color:var(--text-primary);font-size:12px;font-family:&#39;Courier New&#39;,monospace;outline:none;resize:vertical;box-sizing:border-box;">' + escapeHtml(layer.filterExpression || '') + '</textarea></div>',
            '<div style="font-size:10px;color:var(--text-muted);line-height:1.5;margin-bottom:4px;">Use <code style="background:rgba(0,0,0,0.3);padding:1px 4px;border-radius:3px;">p</code> for the feature properties object. Click a field above to insert.</div>',
            '<div style="font-size:10px;color:var(--text-muted);line-height:1.5;">Examples:<div style="margin-top:4px;padding:6px 8px;background:rgba(0,0,0,0.2);border-radius:4px;font-family:monospace;white-space:pre-wrap;">p.ZONING === \'Residential\'<br/>p.ACRES &gt; 10<br/>p.TYPE !== \'Excluded\' &amp;&amp; p.VALUE &gt;= 100<br/>Number(p.YEAR) &gt; 2000 || p.STATUS === \'Active\'</div></div>',
          '</div>',
        '</div>',
        '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px;">',
          '<button type="button" class="fe-apply-btn" style="padding:7px 20px;background:var(--accent);color:#fff;border:none;border-radius:var(--radius-md);font-size:12px;font-weight:600;cursor:pointer;">Apply</button>',
          '<button type="button" class="fe-cancel-btn" style="padding:7px 20px;background:rgba(255,255,255,0.06);color:var(--text-secondary);border:1px solid var(--border-color);border-radius:var(--radius-md);font-size:12px;cursor:pointer;">Cancel</button>',
        '</div>',
      '</div>',
    '</div>'
  ].join('');

  overlay.querySelectorAll('.fe-mode-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      overlay.querySelectorAll('.fe-mode-btn').forEach(function(b) { b.style.background = 'transparent'; b.style.color = 'var(--text-muted)'; });
      btn.style.background = 'var(--accent)'; btn.style.color = '#fff';
      var mode = btn.dataset.mode;
      overlay.querySelector('.fe-simple').style.display = mode === 'simple' ? 'block' : 'none';
      overlay.querySelector('.fe-advanced').style.display = mode === 'advanced' ? 'block' : 'none';
    });
  });

  var feFieldInsert = overlay.querySelector('.fe-field-insert');
  if (feFieldInsert) {
    feFieldInsert.addEventListener('change', function() {
      var ta = overlay.querySelector('.fe-expression');
      if (!ta || !feFieldInsert.value) return;
      var insert = feFieldInsert.value;
      var start = ta.selectionStart, end = ta.selectionEnd;
      ta.value = ta.value.substring(0, start) + insert + ta.value.substring(end);
      ta.selectionStart = ta.selectionEnd = start + insert.length;
      ta.focus();
      feFieldInsert.value = '';
    });
  }

  var enabledEl = overlay.querySelector('.fe-enabled');
  var settingsEl = overlay.querySelector('.fe-settings');
  var opEl = overlay.querySelector('.fe-op');
  var valueWrap = overlay.querySelector('.fe-value-wrap');

  enabledEl.addEventListener('change', function() { settingsEl.style.display = enabledEl.checked ? 'block' : 'none'; });
  opEl.addEventListener('change', function() { valueWrap.style.display = (opEl.value === 'is_empty' || opEl.value === 'not_empty') ? 'none' : 'block'; });

  overlay.querySelector('.fe-close').addEventListener('click', closeFilterEditor);
  overlay.querySelector('.fe-cancel-btn').addEventListener('click', closeFilterEditor);
  overlay.querySelector('.fe-apply-btn').addEventListener('click', function() {
    layer.filterEnabled = enabledEl.checked;
    var activeMode = 'simple';
    overlay.querySelectorAll('.fe-mode-btn').forEach(function(b) { if (b.style.background === 'var(--accent)') activeMode = b.dataset.mode; });
    layer.filterMode = activeMode;
    layer.filterField = overlay.querySelector('.fe-field').value;
    layer.filterOp = opEl.value;
    layer.filterValue = overlay.querySelector('.fe-value').value;
    layer.filterExpression = overlay.querySelector('.fe-expression') ? overlay.querySelector('.fe-expression').value : '';
    closeFilterEditor();
    rebuildLeafletLayer(layer);
    renderUI();
    if (typeof renderAttrTable === 'function') renderAttrTable();
  });
  overlay.addEventListener('mousedown', function(e) { if (e.target === overlay) closeFilterEditor(); });

  document.body.appendChild(overlay);
}

// =========================
// SELECT BY ATTRIBUTE
// =========================

function closeSelectByAttribute() {
  var overlay = document.getElementById('select-by-attr-overlay');
  if (overlay) overlay.remove();
}

function openSelectByAttribute(layer) {
  closeSelectByAttribute();
  var overlay = document.createElement('div');
  overlay.id = 'select-by-attr-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;';

  var fieldOpts = '';
  (layer.fields || []).forEach(function(f) { fieldOpts += '<option value="' + escapeHtml(f) + '">' + escapeHtml(f) + '</option>'; });

  var operators = [
    { value: 'equals', label: 'Equals' }, { value: 'not_equals', label: 'Not equals' },
    { value: 'contains', label: 'Contains' }, { value: 'not_contains', label: 'Does not contain' },
    { value: 'greater', label: 'Greater than' }, { value: 'less', label: 'Less than' },
    { value: 'greater_eq', label: 'Greater or equal' }, { value: 'less_eq', label: 'Less or equal' },
    { value: 'is_empty', label: 'Is empty' }, { value: 'not_empty', label: 'Is not empty' }
  ];
  var opOpts = '';
  operators.forEach(function(o) { opOpts += '<option value="' + o.value + '">' + o.label + '</option>'; });

  overlay.innerHTML = [
    '<div style="background:var(--bg-sidebar);border:1px solid var(--border-color);border-radius:var(--radius-lg);box-shadow:var(--shadow-lg);width:480px;display:flex;flex-direction:column;">',
      '<div style="display:flex;align-items:center;padding:16px 20px;border-bottom:1px solid var(--border-color);flex-shrink:0;">',
        '<h3 style="font-size:15px;font-weight:700;color:var(--text-primary);flex:1;">Select by Attribute: ' + escapeHtml(layer.name) + '</h3>',
        '<button class="sba-close" style="background:rgba(255,255,255,0.04);border:1px solid var(--border-color);color:var(--text-muted);width:28px;height:28px;border-radius:6px;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;">&times;</button>',
      '</div>',
      '<div style="padding:16px 20px;overflow-y:auto;">',
        '<div style="display:flex;gap:0;margin-bottom:14px;border:1px solid var(--border-color);border-radius:var(--radius-md);overflow:hidden;">',
          '<button type="button" class="sba-mode-btn" data-mode="simple" style="flex:1;padding:6px 0;font-size:11px;font-weight:500;border:none;cursor:pointer;background:var(--accent);color:#fff;">Simple</button>',
          '<button type="button" class="sba-mode-btn" data-mode="advanced" style="flex:1;padding:6px 0;font-size:11px;font-weight:500;border:none;cursor:pointer;background:transparent;color:var(--text-muted);">Advanced (JS)</button>',
        '</div>',
        '<div class="sba-simple">',
          '<div style="margin-bottom:12px;"><label style="display:block;font-size:11px;font-weight:500;color:var(--text-secondary);margin-bottom:4px;">Field</label><select class="sba-field" style="width:100%;padding:7px 10px;background:rgba(0,0,0,0.3);border:1px solid var(--border-color);border-radius:var(--radius-md);color:var(--text-primary);font-size:12px;font-family:inherit;outline:none;">' + (fieldOpts || '<option value="">No fields available</option>') + '</select></div>',
          '<div style="margin-bottom:12px;"><label style="display:block;font-size:11px;font-weight:500;color:var(--text-secondary);margin-bottom:4px;">Condition</label><select class="sba-op" style="width:100%;padding:7px 10px;background:rgba(0,0,0,0.3);border:1px solid var(--border-color);border-radius:var(--radius-md);color:var(--text-primary);font-size:12px;font-family:inherit;outline:none;">' + opOpts + '</select></div>',
          '<div class="sba-value-wrap" style="margin-bottom:12px;"><label style="display:block;font-size:11px;font-weight:500;color:var(--text-secondary);margin-bottom:4px;">Value</label><input type="text" class="sba-value" value="" placeholder="e.g. Residential" style="width:100%;padding:7px 10px;background:rgba(0,0,0,0.3);border:1px solid var(--border-color);border-radius:var(--radius-md);color:var(--text-primary);font-size:12px;font-family:inherit;outline:none;box-sizing:border-box;" /></div>',
        '</div>',
        '<div class="sba-advanced" style="display:none;">',
          '<div style="margin-bottom:8px;"><label style="display:block;font-size:11px;font-weight:500;color:var(--text-secondary);margin-bottom:4px;">Insert field</label><select class="sba-field-insert" style="width:100%;padding:7px 10px;background:rgba(0,0,0,0.3);border:1px solid var(--border-color);border-radius:var(--radius-md);color:var(--text-primary);font-size:12px;font-family:inherit;outline:none;">' +
            '<option value="">-- select field --</option>' +
            (layer.fields || []).map(function(f) {
              var safe = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(f) ? 'p.' + f : 'p[' + JSON.stringify(f) + ']';
              return '<option value="' + escapeHtml(safe) + '">' + escapeHtml(f) + '</option>';
            }).join('') +
          '</select></div>',
          '<div style="margin-bottom:8px;"><label style="display:block;font-size:11px;font-weight:500;color:var(--text-secondary);margin-bottom:4px;">JavaScript expression</label><textarea class="sba-expression" rows="5" placeholder="e.g. p.ZONING === &#39;Residential&#39; &amp;&amp; p.ACRES &gt; 10" style="width:100%;padding:7px 10px;background:rgba(0,0,0,0.3);border:1px solid var(--border-color);border-radius:var(--radius-md);color:var(--text-primary);font-size:12px;font-family:&#39;Courier New&#39;,monospace;outline:none;resize:vertical;box-sizing:border-box;"></textarea></div>',
          '<div style="font-size:10px;color:var(--text-muted);line-height:1.5;margin-bottom:4px;">Use <code style="background:rgba(0,0,0,0.3);padding:1px 4px;border-radius:3px;">p</code> for the feature properties object. Click a field above to insert.</div>',
          '<div style="font-size:10px;color:var(--text-muted);line-height:1.5;">Examples:<div style="margin-top:4px;padding:6px 8px;background:rgba(0,0,0,0.2);border-radius:4px;font-family:monospace;white-space:pre-wrap;">p.ZONING === \'Residential\'<br/>p.ACRES &gt; 10<br/>p.TYPE !== \'Excluded\' &amp;&amp; p.VALUE &gt;= 100<br/>Number(p.YEAR) &gt; 2000 || p.STATUS === \'Active\'</div></div>',
        '</div>',
        '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px;">',
          '<button type="button" class="sba-apply-btn" style="padding:7px 20px;background:var(--accent);color:#fff;border:none;border-radius:var(--radius-md);font-size:12px;font-weight:600;cursor:pointer;">Select</button>',
          '<button type="button" class="sba-cancel-btn" style="padding:7px 20px;background:rgba(255,255,255,0.06);color:var(--text-secondary);border:1px solid var(--border-color);border-radius:var(--radius-md);font-size:12px;cursor:pointer;">Cancel</button>',
        '</div>',
      '</div>',
    '</div>'
  ].join('');

  overlay.querySelectorAll('.sba-mode-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      overlay.querySelectorAll('.sba-mode-btn').forEach(function(b) { b.classList.remove('sba-active'); b.style.background = 'transparent'; b.style.color = 'var(--text-muted)'; });
      btn.classList.add('sba-active');
      btn.style.background = 'var(--accent)'; btn.style.color = '#fff';
      var mode = btn.dataset.mode;
      overlay.querySelector('.sba-simple').style.display = mode === 'simple' ? 'block' : 'none';
      overlay.querySelector('.sba-advanced').style.display = mode === 'advanced' ? 'block' : 'none';
    });
  });

  var fieldInsertSelect = overlay.querySelector('.sba-field-insert');
  if (fieldInsertSelect) {
    fieldInsertSelect.addEventListener('change', function() {
      var ta = overlay.querySelector('.sba-expression');
      if (!ta || !fieldInsertSelect.value) return;
      var insert = fieldInsertSelect.value;
      var start = ta.selectionStart, end = ta.selectionEnd;
      ta.value = ta.value.substring(0, start) + insert + ta.value.substring(end);
      ta.selectionStart = ta.selectionEnd = start + insert.length;
      ta.focus();
      fieldInsertSelect.value = '';
    });
  }

  var opEl = overlay.querySelector('.sba-op');
  var valueWrap = overlay.querySelector('.sba-value-wrap');
  opEl.addEventListener('change', function() { valueWrap.style.display = (opEl.value === 'is_empty' || opEl.value === 'not_empty') ? 'none' : 'block'; });

  overlay.querySelector('.sba-close').addEventListener('click', closeSelectByAttribute);
  overlay.querySelector('.sba-cancel-btn').addEventListener('click', closeSelectByAttribute);
  overlay.querySelector('.sba-apply-btn').addEventListener('click', function() {
    var activeMode = 'simple';
    overlay.querySelectorAll('.sba-mode-btn').forEach(function(b) { if (b.classList.contains('sba-active')) activeMode = b.dataset.mode; });
    var features = layer.geojson.features || (layer.geojson.type === 'Feature' ? [layer.geojson] : []);
    var matched = [];
    if (activeMode === 'advanced') {
      var expr = overlay.querySelector('.sba-expression').value;
      closeSelectByAttribute();
      if (!expr) return;
      features.forEach(function(f, idx) { if (evaluateFilterExpression(expr, f.properties || {})) matched.push(idx); });
    } else {
      var field = overlay.querySelector('.sba-field').value;
      var op = opEl.value;
      var val = overlay.querySelector('.sba-value').value;
      closeSelectByAttribute();
      if (!field) return;
      features.forEach(function(f, idx) {
        var propVal = f.properties ? f.properties[field] : undefined;
        if (propVal === undefined || propVal === null) propVal = '';
        var strVal = String(propVal);
        var match = false;
        switch (op) {
          case 'equals': match = strVal === val; break;
          case 'not_equals': match = strVal !== val; break;
          case 'contains': match = strVal.indexOf(val) !== -1; break;
          case 'not_contains': match = strVal.indexOf(val) === -1; break;
          case 'greater': match = parseFloat(strVal) > parseFloat(val); break;
          case 'less': match = parseFloat(strVal) < parseFloat(val); break;
          case 'greater_eq': match = parseFloat(strVal) >= parseFloat(val); break;
          case 'less_eq': match = parseFloat(strVal) <= parseFloat(val); break;
          case 'is_empty': match = strVal === ''; break;
          case 'not_empty': match = strVal !== ''; break;
        }
        if (match) matched.push(idx);
      });
    }
    var old = getAllSelected();
    selectedFeatures = {};
    var rebuildLayers = {};
    old.forEach(function(item) { rebuildLayers[item.layerId] = true; });
    rebuildLayers[layer.id] = true;
    var selSet = getSelectedSet(layer.id);
    matched.forEach(function(idx) { selSet.add(idx); });
    for (var lid in rebuildLayers) {
      var l = layerStore.find(function(x) { return x.id === lid; });
      if (l) rebuildLeafletLayer(l, { renderUI: false });
    }
    if (typeof renderAttrTable === 'function') renderAttrTable();
  });
  overlay.addEventListener('mousedown', function(e) { if (e.target === overlay) closeSelectByAttribute(); });
  document.body.appendChild(overlay);
}

// =========================
// POPUP SETTINGS
// =========================

function closePopupSettings() {
  const overlay = document.getElementById('popup-settings-overlay');
  if (overlay) overlay.remove();
}

function openPopupSettings(layer) {
  closePopupSettings();
  const overlay = document.createElement('div');
  overlay.id = 'popup-settings-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;';

  const selectedFields = new Set(Array.isArray(layer.popupFields) ? layer.popupFields : (layer.fields || []));
  let fieldCheckboxes = '';
  (layer.fields || []).forEach(f => {
    const checked = selectedFields.has(f) ? 'checked' : '';
    fieldCheckboxes += `<label style="display:flex;align-items:center;gap:6px;font-size:11px;margin-bottom:4px;cursor:pointer;color:var(--text-secondary);"><input type="checkbox" class="ps-field-cb" value="${escapeHtml(f)}" ${checked} style="accent-color:var(--accent);"/> <span>${escapeHtml(f)}</span></label>`;
  });

  overlay.innerHTML = `
    <div class="popup-settings-panel" style="background:var(--bg-sidebar);border:1px solid var(--border-color);border-radius:var(--radius-lg);box-shadow:var(--shadow-lg);width:480px;max-height:80vh;display:flex;flex-direction:column;">
      <div style="display:flex;align-items:center;padding:16px 20px;border-bottom:1px solid var(--border-color);flex-shrink:0;">
        <h3 style="font-size:15px;font-weight:700;color:var(--text-primary);flex:1;">Popup Settings: ${escapeHtml(layer.name)}</h3>
        <button class="ps-close" style="background:rgba(255,255,255,0.04);border:1px solid var(--border-color);color:var(--text-muted);width:28px;height:28px;border-radius:6px;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;">&times;</button>
      </div>
      <div style="flex:1;overflow-y:auto;padding:16px 20px;">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px;font-weight:500;color:var(--text-primary);margin-bottom:14px;">
          <input type="checkbox" class="ps-enabled" ${layer.popupEnabled !== false ? 'checked' : ''} style="accent-color:var(--accent);" />
          Show popup on click
        </label>
        <div class="ps-settings" style="display:${layer.popupEnabled !== false ? 'block' : 'none'};">
          <div style="margin-bottom:12px;">
            <label style="display:block;font-size:11px;font-weight:500;color:var(--text-secondary);margin-bottom:4px;">Popup title</label>
            <input type="text" class="ps-title" value="${escapeHtml(layer.popupTitle || '')}" placeholder="${escapeHtml(layer.name)} or {fieldName}" style="width:100%;padding:7px 10px;background:rgba(0,0,0,0.3);border:1px solid var(--border-color);border-radius:var(--radius-md);color:var(--text-primary);font-size:12px;font-family:inherit;outline:none;box-sizing:border-box;" />
            <span style="font-size:10px;color:var(--text-muted);margin-top:2px;display:block;">Leave blank for layer name. Use {attribute} for feature values.</span>
          </div>
          <div style="margin-bottom:12px;">
            <label style="display:block;font-size:11px;font-weight:500;color:var(--text-secondary);margin-bottom:4px;">Attributes to show</label>
            <select class="ps-field-mode" style="width:100%;padding:7px 10px;background:rgba(0,0,0,0.3);border:1px solid var(--border-color);border-radius:var(--radius-md);color:var(--text-primary);font-size:12px;font-family:inherit;outline:none;">
              <option value="all" ${!Array.isArray(layer.popupFields) ? 'selected' : ''}>All attributes</option>
              <option value="selected" ${Array.isArray(layer.popupFields) ? 'selected' : ''}>Selected only</option>
            </select>
            <div class="ps-field-list" style="display:${Array.isArray(layer.popupFields) ? 'block' : 'none'};margin-top:6px;max-height:100px;overflow-y:auto;border:1px solid var(--border-color);border-radius:var(--radius-md);padding:6px;background:rgba(0,0,0,0.2);">${fieldCheckboxes}</div>
          </div>
          <div style="margin-bottom:12px;">
            <label style="display:block;font-size:11px;font-weight:500;color:var(--text-secondary);margin-bottom:4px;">Custom template (optional)</label>
            <textarea class="ps-template" rows="3" placeholder="e.g. Name: {name}&#10;Population: {pop}" style="width:100%;padding:7px 10px;background:rgba(0,0,0,0.3);border:1px solid var(--border-color);border-radius:var(--radius-md);color:var(--text-primary);font-size:12px;font-family:inherit;outline:none;resize:vertical;box-sizing:border-box;">${escapeHtml(layer.popupTemplate || '')}</textarea>
            <span style="font-size:10px;color:var(--text-muted);margin-top:2px;display:block;">Overrides attribute list. One line per row. Use {fieldName} tokens.</span>
          </div>
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:11px;color:var(--text-primary);">
            <input type="checkbox" class="ps-show-labels" ${layer.popupShowLabels !== false ? 'checked' : ''} style="accent-color:var(--accent);" />
            Show attribute labels
          </label>
        </div>
      </div>
    </div>
  `;

  const enabledEl = overlay.querySelector('.ps-enabled');
  const settingsEl = overlay.querySelector('.ps-settings');
  const titleEl = overlay.querySelector('.ps-title');
  const modeEl = overlay.querySelector('.ps-field-mode');
  const fieldListEl = overlay.querySelector('.ps-field-list');
  const templateEl = overlay.querySelector('.ps-template');
  const labelsEl = overlay.querySelector('.ps-show-labels');

  enabledEl.addEventListener('change', () => { settingsEl.style.display = enabledEl.checked ? 'block' : 'none'; updateLayerPopup(layer.id, { popupEnabled: enabledEl.checked }); });
  titleEl.addEventListener('input', () => { updateLayerPopup(layer.id, { popupTitle: titleEl.value }, { renderUI: false }); });
  modeEl.addEventListener('change', () => {
    if (modeEl.value === 'all') { fieldListEl.style.display = 'none'; updateLayerPopup(layer.id, { popupFields: null }); }
    else { fieldListEl.style.display = 'block'; layer.fields.forEach(f => selectedFields.add(f)); renderFieldList(); updateLayerPopup(layer.id, { popupFields: [...selectedFields] }); }
  });
  templateEl.addEventListener('input', () => { updateLayerPopup(layer.id, { popupTemplate: templateEl.value }, { renderUI: false }); });
  labelsEl.addEventListener('change', () => { updateLayerPopup(layer.id, { popupShowLabels: labelsEl.checked }); });

  function renderFieldList() {
    fieldListEl.innerHTML = '';
    (layer.fields || []).forEach(f => {
      const label = document.createElement('label');
      label.style.cssText = 'display:flex;align-items:center;gap:6px;font-size:11px;margin-bottom:4px;cursor:pointer;color:var(--text-secondary);';
      const checked = selectedFields.has(f) ? 'checked' : '';
      label.innerHTML = '<input type="checkbox" class="ps-field-cb" value="' + escapeHtml(f) + '" ' + checked + ' style="accent-color:var(--accent);"/> <span>' + escapeHtml(f) + '</span>';
      label.querySelector('input').addEventListener('change', (e) => {
        if (e.target.checked) selectedFields.add(f); else selectedFields.delete(f);
        updateLayerPopup(layer.id, { popupFields: [...selectedFields] }, { renderUI: false });
      });
      fieldListEl.appendChild(label);
    });
  }

  overlay.querySelector('.ps-close').addEventListener('click', closePopupSettings);
  overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) closePopupSettings(); });
  document.body.appendChild(overlay);
}

// =========================
// LABEL EDITOR
// =========================

function closeLabelEditor() {
  const overlay = document.getElementById('label-editor-overlay');
  if (overlay) { overlay.remove(); renderUI(); }
}

function openLabelEditor(layer) {
  closeLabelEditor();
  const overlay = document.createElement('div');
  overlay.id = 'label-editor-overlay';
  let fieldOptions = '<option value="">-- No label --</option>';
  layer.fields.forEach(f => { fieldOptions += `<option value="${f}" ${layer.labelField === f ? 'selected' : ''}>${escapeHtml(f)}</option>`; });

  overlay.innerHTML = `
    <div class="label-editor-panel">
      <h3>Label Settings: ${escapeHtml(layer.name)}</h3>
      <div class="form-group"><label>Label field</label><select id="le-field">${fieldOptions}</select></div>
      <div class="form-group"><label>Font</label><select id="le-font">
        <option value="Arial" ${layer.labelFont === 'Arial' ? 'selected' : ''}>Arial</option>
        <option value="Helvetica" ${layer.labelFont === 'Helvetica' ? 'selected' : ''}>Helvetica</option>
        <option value="Verdana" ${layer.labelFont === 'Verdana' ? 'selected' : ''}>Verdana</option>
        <option value="Tahoma" ${layer.labelFont === 'Tahoma' ? 'selected' : ''}>Tahoma</option>
        <option value="Georgia" ${layer.labelFont === 'Georgia' ? 'selected' : ''}>Georgia</option>
        <option value="'Courier New', monospace" ${layer.labelFont === "'Courier New', monospace" ? 'selected' : ''}>Courier New</option>
        <option value="monospace" ${layer.labelFont === 'monospace' ? 'selected' : ''}>Monospace</option>
      </select></div>
      <div class="form-group"><label>Size: <span id="le-size-val">${layer.labelSize}</span>px</label><input type="range" id="le-size" min="8" max="32" value="${layer.labelSize}" /></div>
      <div class="form-group"><div class="color-row"><label>Text color</label><input type="color" id="le-color" value="${layer.labelColor}" /></div></div>
      <div class="form-group"><div class="color-row"><label>Stroke (halo) color</label><input type="color" id="le-stroke-color" value="${layer.labelStrokeColor}" /></div></div>
      <div class="form-group"><label>Stroke width: <span id="le-stroke-width-val">${layer.labelStrokeWidth}</span>px</label><input type="range" id="le-stroke-width" min="0" max="6" step="0.5" value="${layer.labelStrokeWidth}" /></div>
      <div class="btn-row"><button class="btn-cancel" id="le-cancel">Cancel</button><button class="btn-apply" id="le-apply">Apply</button></div>
    </div>
  `;

  overlay.querySelector('#le-size').addEventListener('input', (e) => { overlay.querySelector('#le-size-val').textContent = e.target.value; });
  overlay.querySelector('#le-stroke-width').addEventListener('input', (e) => { overlay.querySelector('#le-stroke-width-val').textContent = parseFloat(e.target.value).toFixed(1); });
  overlay.querySelector('#le-cancel').addEventListener('click', () => closeLabelEditor());
  overlay.querySelector('#le-apply').addEventListener('click', () => {
    const field = overlay.querySelector('#le-field').value;
    layer.labelField = field; layer.labelEnabled = !!field;
    layer.labelFont = overlay.querySelector('#le-font').value;
    layer.labelSize = parseInt(overlay.querySelector('#le-size').value, 10);
    layer.labelColor = overlay.querySelector('#le-color').value;
    layer.labelStrokeColor = overlay.querySelector('#le-stroke-color').value;
    layer.labelStrokeWidth = parseFloat(overlay.querySelector('#le-stroke-width').value);
    updateLabelStyleTag(layer);
    rebuildLeafletLayer(layer);
    closeLabelEditor();
  });
  overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) closeLabelEditor(); });
  document.body.appendChild(overlay);
}

// =========================
// CATEGORY SYMBOL EDITOR
// =========================

function closeCategorySymbolEditor() {
  const overlay = document.getElementById('sym-editor-overlay');
  if (overlay) { overlay.remove(); renderUI(); }
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
      s.pointSymbolType = curType; s.pointSize = curSize; s.pointStrokeColor = curStrokeColor; s.pointStrokeWidth = curStrokeWidth;
      if (curCustomUrl) s.customSymbolUrl = curCustomUrl; else delete s.customSymbolUrl;
    }
    rebuildLeafletLayer(layer, { renderUI: false });
  }

  function updatePreview() {
    const container = overlay.querySelector('.sym-preview-main');
    container.innerHTML = '';
    if (curType === 'custom' && curCustomUrl) {
      const img = document.createElement('img'); img.src = curCustomUrl;
      img.style.cssText = 'max-width:80px;max-height:80px;object-fit:contain;border-radius:4px;';
      container.appendChild(img);
    } else {
      const type = curType === 'custom' ? 'circle' : curType;
      container.innerHTML = buildPointSymbolHtml(type, curColor, curStrokeColor, Math.max(6, curSize / 2), curStrokeWidth);
    }
  }

  function openFilePicker() {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
    inp.onchange = () => {
      const file = inp.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => { curCustomUrl = e.target.result; applySettings(); updatePreview(); updateCustomRow(); };
      reader.readAsDataURL(file);
    };
    inp.click();
  }

  const overlay = document.createElement('div');
  overlay.id = 'sym-editor-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;';
  overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) closeCategorySymbolEditor(); });

  const panel = document.createElement('div');
  panel.style.cssText = 'background:var(--panel-bg,#1e293b);border:1px solid var(--border-color,#334155);border-radius:12px;padding:20px;max-width:420px;width:90%;max-height:90vh;overflow-y:auto;box-shadow:0 8px 32px rgba(0,0,0,0.5);';

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

  const previewRow = document.createElement('div');
  previewRow.style.cssText = 'display:flex;justify-content:center;margin-bottom:16px;';
  const previewMain = document.createElement('div');
  previewMain.className = 'sym-preview-main';
  previewMain.style.cssText = 'display:flex;align-items:center;justify-content:center;width:90px;height:90px;background:rgba(0,0,0,0.3);border-radius:8px;border:1px solid var(--border-color,#334155);';
  previewRow.appendChild(previewMain);
  panel.appendChild(previewRow);

  const shapeLabel = document.createElement('div');
  shapeLabel.style.cssText = 'font-size:12px;color:var(--text-secondary,#94a3b8);margin-bottom:6px;';
  shapeLabel.textContent = 'Shape';
  panel.appendChild(shapeLabel);

  const shapeGrid = document.createElement('div');
  shapeGrid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(44px,1fr));gap:4px;margin-bottom:14px;';
  SYMBOL_SHAPES.forEach(sh => {
    const btn = document.createElement('button');
    btn.dataset.shape = sh.id; btn.title = sh.label;
    btn.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;padding:4px 2px;cursor:pointer;border:2px solid transparent;border-radius:6px;background:rgba(15,23,42,0.6);transition:all 0.15s;';
    if (sh.id === curType) btn.style.borderColor = '#3b82f6';
    if (sh.id === 'custom') {
      btn.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg><span style="font-size:7px;margin-top:2px;color:var(--text-secondary,#94a3b8)">Image</span>';
    } else {
      btn.innerHTML = buildPointSymbolHtml(sh.id, curColor, curStrokeColor, 6, curStrokeWidth) + '<span style="font-size:7px;margin-top:2px;color:var(--text-secondary,#94a3b8)">' + sh.label + '</span>';
    }
    btn.addEventListener('click', () => {
      shapeGrid.querySelectorAll('button').forEach(b => b.style.borderColor = 'transparent');
      btn.style.borderColor = '#3b82f6'; curType = sh.id; updateCustomRow(); applySettings(); updatePreview();
    });
    shapeGrid.appendChild(btn);
  });
  panel.appendChild(shapeGrid);

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
    clearBtn.addEventListener('click', () => { curCustomUrl = ''; applySettings(); updatePreview(); updateCustomRow(); });
    customRow.appendChild(clearBtn);
  }
  function updateCustomRow() { customRow.style.display = curType === 'custom' ? 'block' : 'none'; sizeRow.style.display = curType === 'custom' ? 'none' : 'flex'; colorRow.style.display = curType === 'custom' ? 'none' : 'flex'; }
  panel.appendChild(customRow);

  const sizeRow = document.createElement('div');
  sizeRow.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:12px;';
  const sizeLabel = document.createElement('label'); sizeLabel.style.cssText = 'font-size:12px;color:var(--text-secondary,#94a3b8);flex-shrink:0;'; sizeLabel.textContent = 'Size';
  sizeRow.appendChild(sizeLabel);
  const sizeSlider = document.createElement('input');
  sizeSlider.type = 'range'; sizeSlider.min = 4; sizeSlider.max = 48; sizeSlider.value = curSize;
  sizeSlider.style.cssText = 'flex:1;accent-color:#3b82f6;';
  sizeSlider.addEventListener('input', () => { curSize = parseInt(sizeSlider.value); sizeVal.textContent = curSize + 'px'; applySettings(); updatePreview(); });
  sizeRow.appendChild(sizeSlider);
  const sizeVal = document.createElement('span');
  sizeVal.style.cssText = 'font-size:12px;color:var(--text-primary,#e2e8f0);min-width:32px;text-align:right;';
  sizeVal.textContent = curSize + 'px';
  sizeRow.appendChild(sizeVal);
  panel.appendChild(sizeRow);

  const colorRow = document.createElement('div');
  colorRow.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:12px;';
  const colorLabel = document.createElement('label'); colorLabel.style.cssText = 'font-size:12px;color:var(--text-secondary,#94a3b8);flex-shrink:0;'; colorLabel.textContent = 'Color';
  colorRow.appendChild(colorLabel);
  const colorPicker = document.createElement('input');
  colorPicker.type = 'color'; colorPicker.value = curColor;
  colorPicker.style.cssText = 'width:32px;height:28px;border:0;padding:0;background:none;cursor:pointer;';
  colorPicker.addEventListener('input', () => { curColor = colorPicker.value; layer.categories[catKey] = curColor; updateCategoryColor(layer.id, catKey, curColor, { renderUI: false }); updatePreview(); updateShapeGridColors(); });
  colorRow.appendChild(colorPicker);
  panel.appendChild(colorRow);

  const scRow = document.createElement('div');
  scRow.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:12px;';
  const scLabel = document.createElement('label'); scLabel.style.cssText = 'font-size:12px;color:var(--text-secondary,#94a3b8);flex-shrink:0;'; scLabel.textContent = 'Stroke';
  scRow.appendChild(scLabel);
  const scPicker = document.createElement('input');
  scPicker.type = 'color'; scPicker.value = curStrokeColor;
  scPicker.style.cssText = 'width:32px;height:28px;border:0;padding:0;background:none;cursor:pointer;';
  scPicker.addEventListener('input', () => { curStrokeColor = scPicker.value; applySettings(); updatePreview(); updateShapeGridColors(); });
  scRow.appendChild(scPicker);
  const swSlider = document.createElement('input');
  swSlider.type = 'range'; swSlider.min = 0; swSlider.max = 6; swSlider.step = 0.5; swSlider.value = curStrokeWidth;
  swSlider.style.cssText = 'flex:1;accent-color:#3b82f6;';
  swSlider.addEventListener('input', () => { curStrokeWidth = parseFloat(swSlider.value); swVal.textContent = curStrokeWidth + 'px'; applySettings(); updatePreview(); updateShapeGridColors(); });
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

// ========================
// LAYER SYMBOL EDITOR
// ========================

function closeLayerSymbolEditor() {
  const overlay = document.getElementById('layer-sym-editor-overlay');
  if (overlay) { overlay.remove(); renderUI(); }
}

function openLayerSymbolEditor(layer) {
  closeLayerSymbolEditor();

  let curType = layer.pointSymbolType || 'circle';
  let curSize = layer.pointSize ?? 10;
  let curStrokeColor = layer.pointStrokeColor || '#ffffff';
  let curStrokeWidth = layer.pointStrokeWidth ?? 2;
  let curCustomUrl = layer.customSymbolUrl || '';

  function applySettings() {
    layer.pointSymbolType = curType;
    layer.pointSize = curSize;
    layer.pointStrokeColor = curStrokeColor;
    layer.pointStrokeWidth = curStrokeWidth;
    layer.customSymbolUrl = curCustomUrl || '';
    rebuildLeafletLayer(layer, { renderUI: false });
  }

  function updatePreview() {
    const container = overlay.querySelector('.lsym-preview-main');
    container.innerHTML = '';
    if (curType === 'custom' && curCustomUrl) {
      const img = document.createElement('img'); img.src = curCustomUrl;
      img.style.cssText = 'max-width:80px;max-height:80px;object-fit:contain;border-radius:4px;';
      container.appendChild(img);
    } else {
      const type = curType === 'custom' ? 'circle' : curType;
      container.innerHTML = buildPointSymbolHtml(type, layer.color, curStrokeColor, Math.max(6, curSize / 2), curStrokeWidth);
    }
  }

  function updateCustomRow() {
    customRow.style.display = curType === 'custom' ? 'block' : 'none';
    sizeRow.style.display = curType === 'custom' ? 'none' : 'flex';
    scRow.style.display = curType === 'custom' ? 'none' : 'flex';
  }

  function openFilePicker() {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
    inp.onchange = () => {
      const file = inp.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => { curCustomUrl = e.target.result; applySettings(); updatePreview(); updateCustomRow(); };
      reader.readAsDataURL(file);
    };
    inp.click();
  }

  const overlay = document.createElement('div');
  overlay.id = 'layer-sym-editor-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;';
  overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) closeLayerSymbolEditor(); });

  const panel = document.createElement('div');
  panel.style.cssText = 'background:var(--panel-bg,#1e293b);border:1px solid var(--border-color,#334155);border-radius:12px;padding:20px;max-width:420px;width:90%;max-height:90vh;overflow-y:auto;box-shadow:0 8px 32px rgba(0,0,0,0.5);';

  const header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;';
  const title = document.createElement('div');
  title.style.cssText = 'font-weight:600;font-size:14px;color:var(--text-primary,#e2e8f0);';
  title.textContent = 'Point Symbol';
  header.appendChild(title);
  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = '\u2715';
  closeBtn.style.cssText = 'background:none;border:none;color:var(--text-secondary,#94a3b8);font-size:18px;cursor:pointer;padding:2px 6px;border-radius:4px;';
  closeBtn.addEventListener('click', closeLayerSymbolEditor);
  closeBtn.addEventListener('mouseenter', () => closeBtn.style.background = 'rgba(255,255,255,0.1)');
  closeBtn.addEventListener('mouseleave', () => closeBtn.style.background = 'none');
  header.appendChild(closeBtn);
  panel.appendChild(header);

  const previewRow = document.createElement('div');
  previewRow.style.cssText = 'display:flex;justify-content:center;margin-bottom:16px;';
  const previewMain = document.createElement('div');
  previewMain.className = 'lsym-preview-main';
  previewMain.style.cssText = 'display:flex;align-items:center;justify-content:center;width:90px;height:90px;background:rgba(0,0,0,0.3);border-radius:8px;border:1px solid var(--border-color,#334155);';
  previewRow.appendChild(previewMain);
  panel.appendChild(previewRow);

  const shapeLabel = document.createElement('div');
  shapeLabel.style.cssText = 'font-size:12px;color:var(--text-secondary,#94a3b8);margin-bottom:6px;';
  shapeLabel.textContent = 'Shape';
  panel.appendChild(shapeLabel);

  const shapeGrid = document.createElement('div');
  shapeGrid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(44px,1fr));gap:4px;margin-bottom:14px;';
  SYMBOL_SHAPES.forEach(sh => {
    const btn = document.createElement('button');
    btn.dataset.shape = sh.id; btn.title = sh.label;
    btn.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;padding:4px 2px;cursor:pointer;border:2px solid transparent;border-radius:6px;background:rgba(15,23,42,0.6);transition:all 0.15s;';
    if (sh.id === curType) btn.style.borderColor = '#3b82f6';
    if (sh.id === 'custom') {
      btn.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg><span style="font-size:7px;margin-top:2px;color:var(--text-secondary,#94a3b8)">Image</span>';
    } else {
      btn.innerHTML = buildPointSymbolHtml(sh.id, layer.color, curStrokeColor, 6, curStrokeWidth) + '<span style="font-size:7px;margin-top:2px;color:var(--text-secondary,#94a3b8)">' + sh.label + '</span>';
    }
    btn.addEventListener('click', () => {
      shapeGrid.querySelectorAll('button').forEach(b => b.style.borderColor = 'transparent');
      btn.style.borderColor = '#3b82f6'; curType = sh.id; updateCustomRow(); applySettings(); updatePreview();
    });
    shapeGrid.appendChild(btn);
  });
  panel.appendChild(shapeGrid);

  const customRow = document.createElement('div');
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
    clearBtn.addEventListener('click', () => { curCustomUrl = ''; applySettings(); updatePreview(); updateCustomRow(); });
    customRow.appendChild(clearBtn);
  }
  panel.appendChild(customRow);

  const sizeRow = document.createElement('div');
  sizeRow.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:12px;';
  const sizeLabelEl = document.createElement('label'); sizeLabelEl.style.cssText = 'font-size:12px;color:var(--text-secondary,#94a3b8);flex-shrink:0;'; sizeLabelEl.textContent = 'Size';
  sizeRow.appendChild(sizeLabelEl);
  const sizeSlider = document.createElement('input');
  sizeSlider.type = 'range'; sizeSlider.min = 4; sizeSlider.max = 48; sizeSlider.value = curSize;
  sizeSlider.style.cssText = 'flex:1;accent-color:#3b82f6;';
  sizeSlider.addEventListener('input', () => { curSize = parseInt(sizeSlider.value); sizeVal.textContent = curSize + 'px'; applySettings(); updatePreview(); });
  sizeRow.appendChild(sizeSlider);
  const sizeVal = document.createElement('span');
  sizeVal.style.cssText = 'font-size:12px;color:var(--text-primary,#e2e8f0);min-width:32px;text-align:right;';
  sizeVal.textContent = curSize + 'px';
  sizeRow.appendChild(sizeVal);
  panel.appendChild(sizeRow);

  const scRow = document.createElement('div');
  scRow.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:12px;';
  const scLabel = document.createElement('label'); scLabel.style.cssText = 'font-size:12px;color:var(--text-secondary,#94a3b8);flex-shrink:0;'; scLabel.textContent = 'Stroke';
  scRow.appendChild(scLabel);
  const scPicker = document.createElement('input');
  scPicker.type = 'color'; scPicker.value = curStrokeColor;
  scPicker.style.cssText = 'width:32px;height:28px;border:0;padding:0;background:none;cursor:pointer;';
  scPicker.addEventListener('input', () => { curStrokeColor = scPicker.value; applySettings(); updatePreview(); updateShapeGridColors(); });
  scRow.appendChild(scPicker);
  const swSlider = document.createElement('input');
  swSlider.type = 'range'; swSlider.min = 0; swSlider.max = 6; swSlider.step = 0.5; swSlider.value = curStrokeWidth;
  swSlider.style.cssText = 'flex:1;accent-color:#3b82f6;';
  swSlider.addEventListener('input', () => { curStrokeWidth = parseFloat(swSlider.value); swVal.textContent = curStrokeWidth + 'px'; applySettings(); updatePreview(); updateShapeGridColors(); });
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
        btn.innerHTML = buildPointSymbolHtml(st, layer.color, curStrokeColor, 6, curStrokeWidth) + '<span style="font-size:7px;margin-top:2px;color:var(--text-secondary,#94a3b8)">' + (SYMBOL_SHAPES.find(s => s.id === st)?.label || st) + '</span>';
      }
    });
  }

  overlay.appendChild(panel);
  document.body.appendChild(overlay);
  updatePreview();
  updateCustomRow();
}
