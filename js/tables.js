// =========================
// TABLES (non-spatial datasets: CSV / Excel)
// =========================
// A table is { id, name, columns[], rows[][] } — all values stored as strings.
// Tables can be joined onto layer attributes (see js/join.js) and are saved
// inside .gisproject files, but are never drawn on the map or exported.

function parseCSV(text) {
  var rows = [];
  var row = [];
  var field = '';
  var inQuotes = false;
  var i = 0;
  text = String(text).replace(/^\uFEFF/, '');
  while (i < text.length) {
    var c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += c; i++; continue;
    }
    if (c === '"') { inQuotes = true; i++; continue; }
    if (c === ',') { row.push(field); field = ''; i++; continue; }
    if (c === '\r' || c === '\n') {
      row.push(field); field = '';
      rows.push(row); row = [];
      if (c === '\r' && text[i + 1] === '\n') i++;
      i++; continue;
    }
    field += c; i++;
  }
  row.push(field);
  rows.push(row);
  return rows;
}

function tableFromAOA(aoa, name) {
  var grid = (aoa || []).map(function(r) {
    return (r || []).map(function(v) { return v === null || v === undefined ? '' : String(v).trim(); });
  });
  while (grid.length && grid[grid.length - 1].every(function(v) { return v === ''; })) grid.pop();
  if (!grid.length) throw new Error('No data rows found in ' + name);
  var width = Math.max.apply(null, grid.map(function(r) { return r.length; }));
  grid = grid.map(function(r) { while (r.length < width) r.push(''); return r; });
  var columns = grid[0].map(function(h, i) { return h === '' ? ('Column ' + (i + 1)) : h; });
  var seen = {};
  columns = columns.map(function(h) {
    if (!seen[h]) { seen[h] = 1; return h; }
    seen[h]++;
    return h + ' (' + seen[h] + ')';
  });
  var rows = grid.slice(1).filter(function(r) { return r.some(function(v) { return v !== ''; }); });
  if (!rows.length) throw new Error('No data rows found in ' + name);
  return addTable(name, columns, rows);
}

function addTable(name, columns, rows, id) {
  var tableId = id || ('table_' + (++tableCounter));
  if (id) {
    var num = parseInt(String(id).replace('table_', ''), 10);
    if (!isNaN(num) && num > tableCounter) tableCounter = num;
  }
  var table = { id: tableId, name: name, columns: columns.slice(), rows: rows.map(function(r) { return r.slice(); }) };
  tableStore.push(table);
  renderUI();
  return table;
}

function renameTable(id, newName) {
  var t = tableStore.find(function(x) { return x.id === id; });
  if (!t) return;
  t.name = (newName || '').trim() || t.name;
  renderUI();
}

function deleteTable(id) {
  var idx = tableStore.findIndex(function(x) { return x.id === id; });
  if (idx === -1) return;
  tableStore.splice(idx, 1);
  renderUI();
}

function getTablePayload(t) {
  return { id: t.id, name: t.name, columns: t.columns.slice(), rows: t.rows.map(function(r) { return r.slice(); }) };
}

function handleTableFile(file) {
  var name = file.name.toLowerCase();
  var base = file.name.replace(/\.(csv|xlsx|xls)$/i, '') || 'table';
  if (name.endsWith('.csv')) {
    var reader = new FileReader();
    reader.onload = function(ev) {
      try {
        var grid = parseCSV(ev.target.result);
        tableFromAOA(grid, base);
      } catch (err) { alert('Failed to parse CSV: ' + err.message); }
    };
    reader.readAsText(file);
  } else if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    if (typeof XLSX === 'undefined') { alert('Excel support failed to load. Check your internet connection and try again.'); return; }
    var r2 = new FileReader();
    r2.onload = function(ev) {
      try {
        var wb = XLSX.read(ev.target.result, { type: 'array' });
        var wsName = wb.SheetNames[0];
        if (!wsName) throw new Error('Workbook has no sheets');
        var aoa = XLSX.utils.sheet_to_json(wb.Sheets[wsName], { header: 1, raw: true, defval: '' });
        tableFromAOA(aoa, base);
      } catch (err) { alert('Failed to parse Excel file: ' + err.message); }
    };
    r2.readAsArrayBuffer(file);
  }
}

function closeTablePreview() {
  var overlay = document.getElementById('table-preview-overlay');
  if (overlay) overlay.remove();
}

function openTablePreview(table) {
  closeTablePreview();
  var overlay = document.createElement('div');
  overlay.id = 'table-preview-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;';
  var maxRows = 100;
  var head = '<tr>' + table.columns.map(function(c) {
    return '<th style="text-align:left;padding:6px 10px;border-bottom:1px solid var(--border-color);color:var(--text-secondary);font-size:11px;white-space:nowrap;position:sticky;top:0;background:var(--bg-sidebar);">' + escapeHtml(c) + '</th>';
  }).join('') + '</tr>';
  var body = table.rows.slice(0, maxRows).map(function(r) {
    return '<tr>' + table.columns.map(function(c, i) {
      return '<td style="padding:5px 10px;border-bottom:1px solid rgba(255,255,255,0.04);font-size:12px;color:var(--text-primary);white-space:nowrap;max-width:280px;overflow:hidden;text-overflow:ellipsis;">' + escapeHtml(r[i] || '') + '</td>';
    }).join('') + '</tr>';
  }).join('');
  overlay.innerHTML = [
    '<div style="background:var(--bg-sidebar);border:1px solid var(--border-color);border-radius:var(--radius-lg);box-shadow:var(--shadow-lg);width:720px;max-width:92vw;max-height:84vh;display:flex;flex-direction:column;">',
      '<div style="display:flex;align-items:center;padding:14px 18px;border-bottom:1px solid var(--border-color);flex-shrink:0;">',
        '<h3 style="font-size:14px;font-weight:700;color:var(--text-primary);flex:1;">' + escapeHtml(table.name) + ' <span style="font-weight:400;color:var(--text-muted);font-size:12px;">' + table.rows.length + ' rows × ' + table.columns.length + ' columns</span></h3>',
        '<button class="tp-close" style="background:rgba(255,255,255,0.04);border:1px solid var(--border-color);color:var(--text-muted);width:28px;height:28px;border-radius:6px;cursor:pointer;font-size:14px;">&times;</button>',
      '</div>',
      '<div style="padding:14px 18px;overflow:auto;">',
        '<table style="border-collapse:collapse;">' + head + body + '</table>',
        (table.rows.length > maxRows ? '<div style="font-size:11px;color:var(--text-muted);margin-top:8px;">Showing first ' + maxRows + ' of ' + table.rows.length + ' rows.</div>' : ''),
      '</div>',
    '</div>'
  ].join('');
  overlay.querySelector('.tp-close').addEventListener('click', closeTablePreview);
  overlay.addEventListener('mousedown', function(e) { if (e.target === overlay) closeTablePreview(); });
  document.body.appendChild(overlay);
}

function renderTables() {
  var host = document.getElementById('tables');
  if (!host) return;
  host.innerHTML = '';
  if (!tableStore.length) {
    host.innerHTML = '<div style="font-size:11px;color:var(--text-muted);padding:2px 2px 4px;">No tables. Add CSV or Excel files via Add Data.</div>';
    return;
  }
  tableStore.forEach(function(t) {
    var node = document.createElement('div');
    node.className = 'layer-node';
    node.style.borderLeft = '3px solid #8b5cf6';
    node.innerHTML = '<div class="layer-header"><div class="layer-title-wrapper"><span class="layer-name-display" title="' + escapeHtml(t.name) + '">▦ ' + escapeHtml(t.name) + '</span></div><div class="reorder-btns"><button class="btn-delete-layer" title="Delete table">✕</button></div></div>'
      + '<div style="font-size:10px;color:var(--text-muted);padding:2px 0 0 2px;">' + t.rows.length + ' rows × ' + t.columns.length + ' columns</div>';
    node.querySelector('.btn-delete-layer').onclick = function() {
      if (confirm('Delete table "' + t.name + '"? Joined layer data is kept.')) deleteTable(t.id);
    };
    node.querySelector('.layer-name-display').ondblclick = function() { openTablePreview(t); };
    node.addEventListener('contextmenu', function(e) {
      e.preventDefault(); e.stopPropagation();
      showCtxMenu([
        { action: 'preview', icon: '👁', label: 'Preview', handler: function() { openTablePreview(t); } },
        { action: 'rename', icon: '✎', label: 'Rename', handler: function() { var n = prompt('Table name:', t.name); if (n !== null) renameTable(t.id, n); } },
        { action: 'delete', icon: '✕', label: 'Delete', handler: function() { if (confirm('Delete table "' + t.name + '"? Joined layer data is kept.')) deleteTable(t.id); } }
      ], e.clientX, e.clientY);
    });
    host.appendChild(node);
  });
}
