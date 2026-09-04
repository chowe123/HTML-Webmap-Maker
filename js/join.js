// =========================
// JOIN: copy table columns onto layer features by matching key values
// =========================
// Generic primitive. Multi-value table keys (e.g. "B-1/B-5") are handled via
// the split-delimiter option; one table row then matches many features.

function normJoinKey(v, ignoreCase) {
  var s = (v === null || v === undefined) ? '' : String(v).trim();
  return ignoreCase ? s.toLowerCase() : s;
}

function computeJoin(layer, table, opts) {
  var layerKey = opts.layerKey;
  var tableKey = opts.tableKey;
  var splitOn = (opts.splitOn || '').trim();
  var ignoreCase = opts.ignoreCase !== false;
  var multi = opts.multi || 'join';
  var sep = opts.separator !== undefined ? opts.separator : ', ';
  var cols = (opts.columns && opts.columns.length ? opts.columns : table.columns.filter(function(c) { return c !== tableKey; }));

  var keyCol = table.columns.indexOf(tableKey);
  var colIdx = cols.map(function(c) { return table.columns.indexOf(c); });
  var index = {};
  table.rows.forEach(function(r, ri) {
    var parts = splitOn ? String(r[keyCol] || '').split(splitOn) : [r[keyCol]];
    parts.forEach(function(p) {
      var k = normJoinKey(p, ignoreCase);
      if (!k) return;
      (index[k] = index[k] || []).push(ri);
    });
  });

  var features = (layer.geojson && layer.geojson.features) || [];
  var mappings = features.map(function(f, fi) {
    var k = normJoinKey(f.properties ? f.properties[layerKey] : '', ignoreCase);
    var rows = (k && index[k]) ? index[k] : [];
    var values = {};
    cols.forEach(function(c, ci) {
      var vals = rows.map(function(ri) { return table.rows[ri][colIdx[ci]] || ''; });
      if (multi === 'first') values[c] = vals.length ? vals[0] : '';
      else values[c] = vals.filter(function(v) { return v !== ''; }).join(sep);
    });
    return { index: fi, key: k, rowIdx: rows, values: values };
  });
  var matched = mappings.filter(function(m) { return m.rowIdx.length > 0; }).length;
  var usedRows = {};
  mappings.forEach(function(m) { m.rowIdx.forEach(function(ri) { usedRows[ri] = true; }); });
  return { mappings: mappings, columns: cols, matched: matched, unmatched: mappings.length - matched, unusedRows: table.rows.length - Object.keys(usedRows).length };
}

function applyJoin(layer, result, blankUnmatched) {
  var features = (layer.geojson && layer.geojson.features) || [];
  result.mappings.forEach(function(m) {
    var props = features[m.index].properties || (features[m.index].properties = {});
    if (!m.rowIdx.length && !blankUnmatched) return;
    result.columns.forEach(function(c) {
      props[c] = m.rowIdx.length ? m.values[c] : '';
    });
  });
  layer.fields = extractFields(layer.geojson);
  rebuildLeafletLayer(layer);
  renderUI();
  if (typeof renderAttrTable === 'function') renderAttrTable();
}

function closeJoinEditor() {
  var overlay = document.getElementById('join-editor-overlay');
  if (overlay) overlay.remove();
}

function openJoinEditor(layer) {
  closeJoinEditor();
  if (!tableStore.length) { alert('Import a CSV or Excel table first (Add Data), then join it to this layer.'); return; }
  var overlay = document.createElement('div');
  overlay.id = 'join-editor-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;';

  var tableOpts = tableStore.map(function(t, i) {
    return '<option value="' + escapeHtml(t.id) + '"' + (i === 0 ? ' selected' : '') + '>' + escapeHtml(t.name) + ' (' + t.rows.length + ' rows)</option>';
  }).join('');
  var layerFieldOpts = (layer.fields || []).map(function(f) {
    return '<option value="' + escapeHtml(f) + '">' + escapeHtml(f) + '</option>';
  }).join('');
  var sel = 'width:100%;padding:7px 10px;background:rgba(0,0,0,0.3);border:1px solid var(--border-color);border-radius:var(--radius-md);color:var(--text-primary);font-size:12px;font-family:inherit;outline:none;';
  var lab = 'display:block;font-size:11px;font-weight:500;color:var(--text-secondary);margin-bottom:4px;';
  var row = 'margin-bottom:12px;';

  overlay.innerHTML = [
    '<div style="background:var(--bg-sidebar);border:1px solid var(--border-color);border-radius:var(--radius-lg);box-shadow:var(--shadow-lg);width:520px;max-width:94vw;max-height:88vh;display:flex;flex-direction:column;">',
      '<div style="display:flex;align-items:center;padding:16px 20px;border-bottom:1px solid var(--border-color);flex-shrink:0;">',
        '<h3 style="font-size:15px;font-weight:700;color:var(--text-primary);flex:1;">Join Table to: ' + escapeHtml(layer.name) + '</h3>',
        '<button class="je-close" style="background:rgba(255,255,255,0.04);border:1px solid var(--border-color);color:var(--text-muted);width:28px;height:28px;border-radius:6px;cursor:pointer;font-size:14px;">&times;</button>',
      '</div>',
      '<div style="padding:16px 20px;overflow-y:auto;">',
        '<div style="' + row + '"><label style="' + lab + '">Source table</label><select class="je-table" style="' + sel + '">' + tableOpts + '</select></div>',
        '<div style="display:flex;gap:10px;">',
          '<div style="flex:1;' + row + '"><label style="' + lab + '">Layer key field</label><select class="je-layer-key" style="' + sel + '">' + layerFieldOpts + '</select></div>',
          '<div style="flex:1;' + row + '"><label style="' + lab + '">Table key column</label><select class="je-table-key" style="' + sel + '"></select></div>',
        '</div>',
        '<div style="' + row + '"><label style="' + lab + '">Columns to copy (default: all except key)</label><div class="je-columns" style="display:flex;flex-wrap:wrap;gap:6px;"></div></div>',
        '<div style="display:flex;gap:10px;">',
          '<div style="flex:1;' + row + '"><label style="' + lab + '">Split table keys on (for multi-value cells)</label><input type="text" class="je-split" placeholder="e.g. /  (blank = exact match)" style="' + sel + 'box-sizing:border-box;" /></div>',
          '<div style="flex:1;' + row + '"><label style="' + lab + '">Multiple matches</label><select class="je-multi" style="' + sel + '"><option value="join">Join with separator</option><option value="first">First match only</option></select></div>',
        '</div>',
        '<div style="display:flex;gap:10px;">',
          '<div style="flex:1;' + row + '"><label style="' + lab + '">Join separator</label><input type="text" class="je-sep" value=", " style="' + sel + 'box-sizing:border-box;" /></div>',
          '<div style="flex:1;' + row + '"><label style="' + lab + '">Unmatched features</label><select class="je-blank" style="' + sel + '"><option value="keep">Keep existing values</option><option value="blank">Set to empty</option></select></div>',
        '</div>',
        '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px;color:var(--text-primary);margin-bottom:12px;"><input type="checkbox" class="je-nocase" checked style="accent-color:var(--accent);" /> Ignore upper/lower case when matching</label>',
        '<div class="je-preview" style="font-size:12px;color:var(--text-secondary);background:rgba(0,0,0,0.25);border:1px solid var(--border-color);border-radius:var(--radius-md);padding:10px 12px;line-height:1.6;">Choose a table and keys to preview the match.</div>',
        '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px;">',
          '<button type="button" class="je-apply-btn" style="padding:7px 20px;background:var(--accent);color:#fff;border:none;border-radius:var(--radius-md);font-size:12px;font-weight:600;cursor:pointer;">Apply Join</button>',
          '<button type="button" class="je-cancel-btn" style="padding:7px 20px;background:rgba(255,255,255,0.06);color:var(--text-secondary);border:1px solid var(--border-color);border-radius:var(--radius-md);font-size:12px;cursor:pointer;">Cancel</button>',
        '</div>',
      '</div>',
    '</div>'
  ].join('');

  function curTable() {
    var id = overlay.querySelector('.je-table').value;
    return tableStore.find(function(t) { return t.id === id; });
  }
  function refreshTableKeys() {
    var t = curTable();
    overlay.querySelector('.je-table-key').innerHTML = (t ? t.columns : []).map(function(c) {
      return '<option value="' + escapeHtml(c) + '">' + escapeHtml(c) + '</option>';
    }).join('');
    overlay.querySelector('.je-columns').innerHTML = (t ? t.columns : []).map(function(c) {
      return '<label style="display:flex;align-items:center;gap:4px;font-size:11px;color:var(--text-secondary);cursor:pointer;"><input type="checkbox" class="je-col" value="' + escapeHtml(c) + '" checked style="accent-color:var(--accent);" />' + escapeHtml(c) + '</label>';
    }).join('');
    refreshPreview();
  }
  function readOpts() {
    var t = curTable();
    var cols = Array.prototype.map.call(overlay.querySelectorAll('.je-col:checked'), function(el) { return el.value; });
    return {
      table: t,
      layerKey: overlay.querySelector('.je-layer-key').value,
      tableKey: overlay.querySelector('.je-table-key').value,
      splitOn: overlay.querySelector('.je-split').value,
      multi: overlay.querySelector('.je-multi').value,
      separator: overlay.querySelector('.je-sep').value,
      blankUnmatched: overlay.querySelector('.je-blank').value === 'blank',
      ignoreCase: overlay.querySelector('.je-nocase').checked,
      columns: cols
    };
  }
  function refreshPreview() {
    var o = readOpts();
    var box = overlay.querySelector('.je-preview');
    if (!o.table || !o.layerKey || !o.tableKey) { box.textContent = 'Choose a table and keys to preview the match.'; return null; }
    var res;
    try { res = computeJoin(layer, o.table, o); }
    catch (err) { box.textContent = 'Error: ' + err.message; return null; }
    var sample = res.mappings.filter(function(m) { return m.rowIdx.length; }).slice(0, 4).map(function(m) {
      return escapeHtml(String(m.key)) + ' → ' + escapeHtml(res.columns.map(function(c) { return c + ': ' + m.values[c]; }).join(' | ').slice(0, 120));
    }).join('<br/>');
    box.innerHTML = '<b style="color:var(--text-primary);">' + res.matched + ' of ' + res.mappings.length + ' features matched</b>'
      + ' · ' + res.unmatched + ' unmatched · ' + res.unusedRows + ' unused table rows'
      + (sample ? '<div style="margin-top:6px;font-size:11px;">' + sample + '</div>' : '');
    return res;
  }
  overlay.querySelector('.je-table').addEventListener('change', refreshTableKeys);
  overlay.querySelectorAll('.je-layer-key,.je-table-key,.je-multi,.je-blank').forEach(function(el) {
    el.addEventListener('change', refreshPreview);
  });
  overlay.querySelectorAll('.je-split,.je-sep').forEach(function(el) {
    el.addEventListener('input', refreshPreview);
  });
  overlay.querySelector('.je-nocase').addEventListener('change', refreshPreview);
  overlay.querySelector('.je-columns').addEventListener('change', refreshPreview);

  overlay.querySelector('.je-close').addEventListener('click', closeJoinEditor);
  overlay.querySelector('.je-cancel-btn').addEventListener('click', closeJoinEditor);
  overlay.querySelector('.je-apply-btn').addEventListener('click', function() {
    var o = readOpts();
    if (!o.table || !o.layerKey || !o.tableKey) { alert('Pick a table, layer key and table key first.'); return; }
    var cols = o.columns.filter(function(c) { return c !== o.tableKey; });
    if (!cols.length) { alert('Tick at least one column to copy.'); return; }
    o.columns = cols;
    var res = computeJoin(layer, o.table, o);
    if (!res.matched) { if (!confirm('No features matched. Apply anyway?')) return; }
    applyJoin(layer, res, o.blankUnmatched);
    closeJoinEditor();
  });
  overlay.addEventListener('mousedown', function(e) { if (e.target === overlay) closeJoinEditor(); });

  document.body.appendChild(overlay);
  refreshTableKeys();
}
