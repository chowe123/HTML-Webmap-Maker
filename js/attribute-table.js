function updateAttrTableTab() {
  var tab = document.getElementById('attr-table-tab');
  var panel = document.getElementById('attr-table-panel');
  if (!tab || !panel) return;
  if (_attrTableLayer && !panel.classList.contains('expanded')) {
    tab.textContent = 'Attribute Table \u2014 ' + _attrTableLayer.name;
    tab.classList.add('visible');
  } else {
    tab.classList.remove('visible');
  }
}

function toggleAttrTable() {
  const panel = document.getElementById('attr-table-panel');
  if (!panel) return;
  panel.classList.toggle('expanded');
  if (!panel.classList.contains('expanded')) {
    panel.style.maxHeight = '';
  }
  updateAttrTableTab();
  setTimeout(() => { if (typeof map !== 'undefined' && map) map.invalidateSize(); }, 50);
}

function renderAttrTable() {
  const layer = _attrTableLayer;
  if (!layer) return;
  populateAttrTable(layer);
}

function setAttrTableFilter(mode) {
  _attrTableFilterMode = mode;
  if (_attrTableLayer) renderAttrTable();
}

var _attrTableVirtualState = null;
var ROW_HEIGHT = 28;

function populateAttrTable(layer) {
  _attrTableLayer = layer;
  var panel = document.getElementById('attr-table-panel');
  if (!panel) return;
  panel.classList.add('expanded');

  var allFeatures = layer.geojson.features || (layer.geojson.type === 'Feature' ? [layer.geojson] : []);
  var filteredSet = null;
  if (layer.filterEnabled && (layer.filterMode === 'advanced' ? layer.filterExpression : layer.filterField)) {
    filteredSet = {};
    getFilteredFeatures(layer).forEach(function(f) { filteredSet[allFeatures.indexOf(f)] = true; });
  }
  var fields = layer.fields;
  var totalCount = filteredSet ? Object.keys(filteredSet).length : allFeatures.length;
  var selSet = selectedFeatures[layer.id];
  var selCount = selSet ? selSet.size : 0;

  var displayFeatures, displayIndices;
  if (_attrTableFilterMode === 'selected' && selCount > 0) {
    displayFeatures = []; displayIndices = [];
    selSet.forEach(function(idx) {
      if (filteredSet && !filteredSet[idx]) return;
      displayIndices.push(idx); displayFeatures.push(allFeatures[idx]);
    });
  } else {
    displayFeatures = []; displayIndices = [];
    for (var i = 0; i < allFeatures.length; i++) {
      if (filteredSet && !filteredSet[i]) continue;
      displayIndices.push(i); displayFeatures.push(allFeatures[i]);
    }
  }

  var filterBar = '<div class="attr-table-filter-bar" style="display:flex;align-items:center;gap:6px;padding:6px 12px;border-bottom:1px solid var(--border-color);flex-shrink:0;">';
  filterBar += '<span style="font-size:10px;color:var(--text-muted);flex:1;">' + totalCount + ' feature' + (totalCount === 1 ? '' : 's');
  if (selCount > 0) { filterBar += ' <span style="color:var(--accent);">(' + selCount + ' selected)</span>'; }
  filterBar += '</span>';
  filterBar += '<button class="attr-filter-btn" data-mode="all" style="font-size:10px;padding:3px 10px;border-radius:4px;border:1px solid var(--border-color);background:' + (_attrTableFilterMode === 'all' ? 'var(--accent)' : 'transparent') + ';color:' + (_attrTableFilterMode === 'all' ? '#fff' : 'var(--text-muted)') + ';cursor:pointer;">Show all</button>';
  var selDisabled = selCount === 0;
  filterBar += '<button class="attr-filter-btn" data-mode="selected" style="font-size:10px;padding:3px 10px;border-radius:4px;border:1px solid var(--border-color);background:' + (_attrTableFilterMode === 'selected' ? 'var(--accent)' : 'transparent') + ';color:' + (_attrTableFilterMode === 'selected' ? '#fff' : 'var(--text-muted)') + ';cursor:pointer;' + (selDisabled ? 'opacity:0.4;' : '') + '" ' + (selDisabled ? 'disabled' : '') + '>Selected</button>';
  if (selCount > 0) { filterBar += '<button class="attr-clear-btn" style="font-size:10px;padding:3px 10px;border-radius:4px;border:1px solid var(--border-color);background:transparent;color:var(--text-muted);cursor:pointer;">Clear</button>'; }
  filterBar += '<button class="attr-add-col-btn" title="Add column" style="font-size:14px;padding:1px 8px;border-radius:4px;border:1px solid var(--border-color);background:transparent;color:var(--text-muted);cursor:pointer;line-height:1.4;">+</button>';
  filterBar += '</div>';

  var thead = '<table style="width:100%;border-collapse:collapse;font-size:12px;"><thead style="position:sticky;top:0;z-index:1;"><tr><th class="id-col">#</th>';
  for (var fi = 0; fi < fields.length; fi++) { thead += '<th data-field="' + escapeHtml(fields[fi]) + '">' + escapeHtml(fields[fi]) + '</th>'; }
  thead += '</tr></thead></table>';

  var totalH = displayFeatures.length * ROW_HEIGHT;
  var tableBody = panel.querySelector('.attr-table-body');
  tableBody.innerHTML = filterBar + '<div class="attr-virtual-scroll" style="overflow:auto;flex:1;min-height:0;position:relative;">' + thead + '<div class="attr-virtual-spacer" style="height:' + totalH + 'px;position:relative;"></div></div>';
  var scrollContainer = tableBody.querySelector('.attr-virtual-scroll');
  var spacer = tableBody.querySelector('.attr-virtual-spacer');

  panel.querySelector('.attr-table-layer-name').textContent = layer.name;
  panel.querySelector('.feature-count').textContent = totalCount + ' feature' + (totalCount === 1 ? '' : 's');
  updateAttrTableTab();

  _attrTableVirtualState = { layer: layer, displayFeatures: displayFeatures, displayIndices: displayIndices, fields: fields, selSet: selSet, spacer: spacer, scrollContainer: scrollContainer };

  function renderVisibleRows() {
    if (!_attrTableVirtualState) return;
    var scrollTop = scrollContainer.scrollTop;
    var viewH = scrollContainer.clientHeight;
    var startIdx = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - 5);
    var endIdx = Math.min(displayFeatures.length, Math.ceil((scrollTop + viewH) / ROW_HEIGHT) + 5);
    var frag = document.createDocumentFragment();
    for (var di = startIdx; di < endIdx; di++) {
      var feature = displayFeatures[di];
      var idx = displayIndices[di];
      var props = feature.properties || {};
      var isSel = selSet && selSet.has(idx);
      var tr = document.createElement('tr');
      tr.className = 'attr-row' + (isSel ? ' attr-row-selected' : '');
      tr.dataset.fi = idx;
      tr.style.cssText = 'cursor:pointer;height:' + ROW_HEIGHT + 'px;';
      var tdId = document.createElement('td');
      tdId.className = 'id-col';
      tdId.textContent = idx + 1;
      tr.appendChild(tdId);
      for (var fi2 = 0; fi2 < fields.length; fi2++) {
        var val = props[fields[fi2]] !== undefined && props[fields[fi2]] !== null ? String(props[fields[fi2]]) : '';
        var td = document.createElement('td');
        var inp = document.createElement('input');
        inp.className = 'cell-input';
        inp.type = 'text';
        inp.value = val;
        inp.dataset.fi = idx;
        inp.dataset.field = fields[fi2];
        td.appendChild(inp);
        tr.appendChild(td);
      }
      frag.appendChild(tr);
    }
    spacer.innerHTML = '';
    spacer.appendChild(frag);

    spacer.querySelectorAll('.attr-row').forEach(function(row) {
      row.addEventListener('click', function(e) {
        var fi = parseInt(this.dataset.fi, 10);
        if (e.ctrlKey) { toggleSelection(layer.id, fi); } else { selectOne(layer.id, fi); }
      });
    });

    spacer.querySelectorAll('.cell-input').forEach(function(inp) {
      inp.addEventListener('change', function() {
        var fi = parseInt(this.dataset.fi, 10);
        var field = this.dataset.field;
        var raw = this.value;
        var props = displayFeatures[fi] && displayFeatures[fi].properties;
        if (props) { var prev = props[field]; props[field] = raw;
          if (String(prev) !== String(raw)) { rebuildLeafletLayer(layer, { renderUI: false }); }
        }
      });
    });
  }

  scrollContainer.addEventListener('scroll', function() { requestAnimationFrame(renderVisibleRows); });
  renderVisibleRows();

  setTimeout(function() { if (typeof map !== 'undefined' && map) map.invalidateSize(); }, 60);

  panel.querySelectorAll('.attr-filter-btn').forEach(function(btn) { btn.addEventListener('click', function() { setAttrTableFilter(btn.dataset.mode); }); });
  var clearBtn = panel.querySelector('.attr-clear-btn');
  if (clearBtn) { clearBtn.addEventListener('click', function() { clearSelection(); }); }

  var tableBody = panel.querySelector('.attr-table-body');
  if (tableBody) {
    if (!tableBody._ctxBound) {
      tableBody._ctxBound = true;
      tableBody.addEventListener('contextmenu', function(e) {
        e.preventDefault();
        var layer = _attrTableLayer;
        if (!layer) return;
        var selCount = getSelectedCount(layer.id);
        var items = [];
        if (selCount > 0) { items.push({ action: 'delete-selected', icon: '🗑', label: 'Delete Selected (' + selCount + ')', handler: function() { deleteSelectedFeatures(layer); } }); items.push({ separator: true }); }
        items.push({ action: 'clear-selection', icon: '✕', label: 'Clear Selection', handler: function() { clearSelection(); } });
        showCtxMenu(items, e.clientX, e.clientY);
      });
    }
  }

  panel.querySelectorAll('.cell-input').forEach(function(inp) {
    inp.addEventListener('change', function() {
      var fi = parseInt(this.dataset.fi, 10);
      var field = this.dataset.field;
      var raw = this.value;
      var feature = allFeatures[fi];
      if (!feature) return;
      if (feature.properties) {
        var prev = feature.properties[field];
        feature.properties[field] = raw;
        if (String(prev) !== String(raw)) { rebuildLeafletLayer(layer, { renderUI: false }); }
      }
    });
  });

  panel.querySelectorAll('thead th[data-field]').forEach(function(th) {
    th.style.cursor = 'context-menu';
    th.addEventListener('contextmenu', function(e) {
      e.preventDefault(); e.stopPropagation();
      var fieldName = th.dataset.field;
      var items = [
        { action: 'rename-col', icon: '✎', label: 'Rename Column', handler: function() { renameColumn(layer, fieldName); } },
        { action: 'delete-col', icon: '🗑', label: 'Delete Column', handler: function() { deleteColumn(layer, fieldName); } },
        { separator: true },
        { action: 'calc-col', icon: '∑', label: 'Calculate Column', handler: function() { openCalculateColumn(layer, fieldName); } }
      ];
      showCtxMenu(items, e.clientX, e.clientY);
    });
  });

  var addColBtn = panel.querySelector('.attr-add-col-btn');
  if (addColBtn) { addColBtn.addEventListener('click', function() { addColumnToLayer(layer); }); }
}

function addColumnToLayer(layer) {
  var name = prompt('Enter new column name:');
  if (!name || !name.trim()) return;
  name = name.trim();
  if (layer.fields.indexOf(name) !== -1) { alert('A column named "' + name + '" already exists.'); return; }
  var defaultVal = prompt('Enter default value (blank for empty):');
  var features = layer.geojson.features || (layer.geojson.type === 'Feature' ? [layer.geojson] : []);
  features.forEach(function(f) { if (!f.properties) f.properties = {}; f.properties[name] = defaultVal || ''; });
  layer.fields = extractFields(layer.geojson);
  if (typeof renderAttrTable === 'function') renderAttrTable();
}

function renameColumn(layer, oldName) {
  var newName = prompt('Rename "' + oldName + '" to:', oldName);
  if (!newName || !newName.trim() || newName.trim() === oldName) return;
  newName = newName.trim();
  if (layer.fields.indexOf(newName) !== -1 && newName !== oldName) { alert('A column named "' + newName + '" already exists.'); return; }
  var features = layer.geojson.features || (layer.geojson.type === 'Feature' ? [layer.geojson] : []);
  features.forEach(function(f) { if (f.properties && oldName in f.properties) { f.properties[newName] = f.properties[oldName]; delete f.properties[oldName]; } });
  layer.fields = extractFields(layer.geojson);
  if (typeof renderAttrTable === 'function') renderAttrTable();
}

function deleteColumn(layer, columnName) {
  if (!confirm('Delete column "' + columnName + '"? This will remove the data for all features. This cannot be undone.')) return;
  var features = layer.geojson.features || (layer.geojson.type === 'Feature' ? [layer.geojson] : []);
  features.forEach(function(f) { if (f.properties) delete f.properties[columnName]; });
  layer.fields = extractFields(layer.geojson);
  rebuildLeafletLayer(layer, { renderUI: false });
  if (typeof renderAttrTable === 'function') renderAttrTable();
}

function openCalculateColumn(layer, targetField) {
  var overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;';
  var fieldOpts = '';
  (layer.fields || []).forEach(function(f) { fieldOpts += '<option value="' + escapeHtml(f) + '" ' + (f === targetField ? 'selected' : '') + '>' + escapeHtml(f) + '</option>'; });
  overlay.innerHTML = [
    '<div style="background:var(--bg-sidebar);border:1px solid var(--border-color);border-radius:var(--radius-lg);box-shadow:var(--shadow-lg);width:480px;display:flex;flex-direction:column;">',
      '<div style="display:flex;align-items:center;padding:16px 20px;border-bottom:1px solid var(--border-color);flex-shrink:0;">',
        '<h3 style="font-size:15px;font-weight:700;color:var(--text-primary);flex:1;">Calculate Column: ' + escapeHtml(layer.name) + '</h3>',
        '<button class="calc-close" style="background:rgba(255,255,255,0.04);border:1px solid var(--border-color);color:var(--text-muted);width:28px;height:28px;border-radius:6px;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;">&times;</button>',
      '</div>',
      '<div style="padding:16px 20px;overflow-y:auto;">',
        '<div style="margin-bottom:12px;">',
          '<label style="display:block;font-size:11px;font-weight:500;color:var(--text-secondary);margin-bottom:4px;">Target column</label>',
          '<select class="calc-target-field" style="width:100%;padding:7px 10px;background:rgba(0,0,0,0.3);border:1px solid var(--border-color);border-radius:var(--radius-md);color:var(--text-primary);font-size:12px;font-family:inherit;outline:none;">' + (fieldOpts || '<option value="">No fields</option>') + '</select>',
        '</div>',
        '<div style="margin-bottom:8px;">',
          '<label style="display:block;font-size:11px;font-weight:500;color:var(--text-secondary);margin-bottom:4px;">Insert field</label>',
          '<select class="calc-field-insert" style="width:100%;padding:7px 10px;background:rgba(0,0,0,0.3);border:1px solid var(--border-color);border-radius:var(--radius-md);color:var(--text-primary);font-size:12px;font-family:inherit;outline:none;">',
            '<option value="">-- select field --</option>',
            (layer.fields || []).map(function(f) {
              var safe = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(f) ? 'p.' + f : 'p[' + JSON.stringify(f) + ']';
              return '<option value="' + escapeHtml(safe) + '">' + escapeHtml(f) + '</option>';
            }).join(''),
          '</select>',
        '</div>',
        '<div style="margin-bottom:8px;">',
          '<label style="display:block;font-size:11px;font-weight:500;color:var(--text-secondary);margin-bottom:4px;">JavaScript expression</label>',
          '<textarea class="calc-expression" rows="5" placeholder="e.g. Number(p.ACRES) * 2" style="width:100%;padding:7px 10px;background:rgba(0,0,0,0.3);border:1px solid var(--border-color);border-radius:var(--radius-md);color:var(--text-primary);font-size:12px;font-family:\'Courier New\',monospace;outline:none;resize:vertical;box-sizing:border-box;"></textarea>',
        '</div>',
        '<div style="font-size:10px;color:var(--text-muted);line-height:1.5;margin-bottom:4px;">Use <code style="background:rgba(0,0,0,0.3);padding:1px 4px;border-radius:3px;">p</code> for the feature properties object. Click a field above to insert. Result is converted to string.</div>',
        '<div style="font-size:10px;color:var(--text-muted);line-height:1.5;">Examples:<div style="margin-top:4px;padding:6px 8px;background:rgba(0,0,0,0.2);border-radius:4px;font-family:monospace;white-space:pre-wrap;">Number(p.ACRES) * 2<br/>p.ZONING + \' - \' + p.AREA<br/>p.STATUS === \'Active\' ? \'Yes\' : \'No\'<br/>typeof p.YEAR === \'undefined\' ? 0 : Number(p.YEAR)</div></div>',
        '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px;">',
          '<button type="button" class="calc-apply-btn" style="padding:7px 20px;background:var(--accent);color:#fff;border:none;border-radius:var(--radius-md);font-size:12px;font-weight:600;cursor:pointer;">Calculate</button>',
          '<button type="button" class="calc-cancel-btn" style="padding:7px 20px;background:rgba(255,255,255,0.06);color:var(--text-secondary);border:1px solid var(--border-color);border-radius:var(--radius-md);font-size:12px;cursor:pointer;">Cancel</button>',
        '</div>',
      '</div>',
    '</div>'
  ].join('');

  var calcFieldInsert = overlay.querySelector('.calc-field-insert');
  if (calcFieldInsert) {
    calcFieldInsert.addEventListener('change', function() {
      var ta = overlay.querySelector('.calc-expression');
      if (!ta || !calcFieldInsert.value) return;
      var insert = calcFieldInsert.value;
      var start = ta.selectionStart, end = ta.selectionEnd;
      ta.value = ta.value.substring(0, start) + insert + ta.value.substring(end);
      ta.selectionStart = ta.selectionEnd = start + insert.length;
      ta.focus();
      calcFieldInsert.value = '';
    });
  }

  overlay.querySelector('.calc-close').addEventListener('click', function() { overlay.remove(); });
  overlay.querySelector('.calc-cancel-btn').addEventListener('click', function() { overlay.remove(); });
  overlay.querySelector('.calc-apply-btn').addEventListener('click', function() {
    var target = overlay.querySelector('.calc-target-field').value;
    var expr = overlay.querySelector('.calc-expression').value;
    overlay.remove();
    if (!target || !expr) return;
    doCalculateColumn(layer, target, expr);
  });
  overlay.addEventListener('mousedown', function(e) { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
}

function doCalculateColumn(layer, targetField, expression) {
  var features = layer.geojson.features || (layer.geojson.type === 'Feature' ? [layer.geojson] : []);
  var hasTarget = layer.fields.indexOf(targetField) !== -1;
  features.forEach(function(f) {
    if (!f.properties) f.properties = {};
    try {
      var result = evaluateExpression(expression, f.properties);
      f.properties[targetField] = result !== undefined && result !== null ? String(result) : '';
    } catch(e) { f.properties[targetField] = ''; }
  });
  if (!hasTarget) layer.fields = extractFields(layer.geojson);
  rebuildLeafletLayer(layer, { renderUI: false });
  if (typeof renderAttrTable === 'function') renderAttrTable();
}
