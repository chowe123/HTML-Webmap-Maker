var layoutMode = false;
var layoutElements = [];
var selectedLayoutElementId = null;
var layoutNextId = 1;
var originalMapParent = null;
var originalMapNextSibling = null;
var layoutPaperSize = 'a4-landscape';
var layoutActiveTool = 'select';
var isLayoutDragging = false;
var isLayoutResizing = false;
var isLayoutRotating = false;
var dragElId = null;
var dragStartMouseX, dragStartMouseY;
var dragStartElX, dragStartElY;
var resizeHandle = null;
var resizeStartW, resizeStartH;
var resizeStartX, resizeStartY;
var rotateStartAngle = 0;

var PAPER_SIZES = {
  'a4-portrait': { width: 794, height: 1123 },
  'a4-landscape': { width: 1123, height: 794 },
  'letter-portrait': { width: 816, height: 1056 },
  'letter-landscape': { width: 1056, height: 816 }
};

function getCanvasSize() {
  return PAPER_SIZES[layoutPaperSize] || PAPER_SIZES['a4-landscape'];
}

function getEl(id) {
  return layoutElements.find(function(e) { return e.id === id; });
}

function getSelectedEl() {
  if (selectedLayoutElementId === null) return null;
  return getEl(selectedLayoutElementId);
}

function setLayoutTool(tool) {
  layoutActiveTool = tool;
  document.querySelectorAll('.ltb-btn').forEach(function(b) {
    b.classList.toggle('active', b.dataset.tool === tool);
  });
}

function enterLayoutMode() {
  if (layoutMode) return;
  layoutMode = true;

  var existingMapFrame = null;
  for (var i = 0; i < layoutElements.length; i++) {
    if (layoutElements[i].type === 'map-frame') { existingMapFrame = layoutElements[i]; break; }
  }

  if (!existingMapFrame) {
    var cs = getCanvasSize();
    existingMapFrame = {
      id: 'lf-' + (layoutNextId++),
      type: 'map-frame',
      x: 60, y: 60,
      width: Math.min(cs.width - 120, 500),
      height: Math.min(cs.height - 120, 350),
      rotation: 0, zIndex: 1,
      options: {}
    };
    layoutElements.push(existingMapFrame);
  }

  var mapEl = document.getElementById('map');
  originalMapParent = mapEl.parentNode;
  originalMapNextSibling = mapEl.nextSibling;

  document.getElementById('map-mode').classList.add('hidden');
  document.getElementById('layout-container').classList.add('active');

  renderLayoutCanvas();
  renderLayoutProperties();

  map.dragging.disable();
  map.touchZoom.disable();
  map.doubleClickZoom.disable();
  map.scrollWheelZoom.disable();
  map.boxZoom.disable();
  map.keyboard.disable();

  var zoomCtrl = document.querySelector('.leaflet-control-zoom');
  if (zoomCtrl) zoomCtrl.style.display = 'none';
  var searchCtrl = document.querySelector('.map-search-control');
  if (searchCtrl) searchCtrl.style.display = 'none';

  var toggleBtn = document.getElementById('toggleLayoutMode');
  if (toggleBtn) toggleBtn.textContent = 'In Layout Mode';
  if (toggleBtn) toggleBtn.classList.add('layout-active');
}

function exitLayoutMode() {
  if (!layoutMode) return;
  layoutMode = false;

  var mapEl = document.getElementById('map');
  if (originalMapParent) {
    if (originalMapNextSibling) {
      originalMapParent.insertBefore(mapEl, originalMapNextSibling);
    } else {
      originalMapParent.appendChild(mapEl);
    }
    mapEl.style.width = '';
    mapEl.style.height = '';
    mapEl.style.position = '';
    mapEl.style.left = '';
    mapEl.style.top = '';
    mapEl.style.flex = '';
    mapEl.style.transform = '';
  }

  map.dragging.enable();
  map.touchZoom.enable();
  map.doubleClickZoom.enable();
  map.scrollWheelZoom.enable();
  map.boxZoom.enable();
  map.keyboard.enable();

  var zoomCtrl = document.querySelector('.leaflet-control-zoom');
  if (zoomCtrl) zoomCtrl.style.display = '';
  var searchCtrl = document.querySelector('.map-search-control');
  if (searchCtrl) searchCtrl.style.display = '';

  document.getElementById('map-mode').classList.remove('hidden');
  document.getElementById('layout-container').classList.remove('active');

  document.getElementById('toggleLayoutMode').textContent = 'Layout Mode';
  document.getElementById('toggleLayoutMode').classList.remove('layout-active');

  selectedLayoutElementId = null;
  renderLayoutProperties();

  if (originalMapParent) {
    requestAnimationFrame(function() {
      requestAnimationFrame(function() {
        map.invalidateSize(true);
        if (mapRotation) setMapRotation(mapRotation);
      });
    });
  }
}

function createLayoutElement(type, clientX, clientY) {
  var canvas = document.getElementById('layout-canvas');
  var canvasRect = canvas.getBoundingClientRect();
  var x = clientX - canvasRect.left + canvas.parentElement.scrollLeft;
  var y = clientY - canvasRect.top + canvas.parentElement.scrollTop;

  var defaults = {
    'map-frame': { w: 400, h: 280 },
    'box': { w: 150, h: 100 },
    'text': { w: 200, h: 50 },
    'picture': { w: 200, h: 150 },
    'scale-bar': { w: 160, h: 36 },
    'north-arrow': { w: 60, h: 60 },
    'legend': { w: 200, h: 250 }
  };
  var d = defaults[type] || { w: 150, h: 100 };

  if (type === 'map-frame') {
    for (var i = 0; i < layoutElements.length; i++) {
      if (layoutElements[i].type === 'map-frame') { return; }
    }
  }

  var maxZ = 0;
  for (var j = 0; j < layoutElements.length; j++) {
    if (layoutElements[j].zIndex > maxZ) maxZ = layoutElements[j].zIndex;
  }

  var el = {
    id: 'lf-' + (layoutNextId++),
    type: type,
    x: Math.max(0, x - d.w / 2),
    y: Math.max(0, y - d.h / 2),
    width: d.w,
    height: d.h,
    rotation: 0,
    zIndex: maxZ + 1,
    options: getDefaultOptions(type)
  };

  layoutElements.push(el);
  renderLayoutCanvas();
  selectElement(el.id);
  renderLayoutProperties();
}

function getDefaultOptions(type) {
  switch (type) {
    case 'box': return { fillColor: '#e0e0e0', borderColor: '#999999', borderWidth: 1 };
    case 'text': return { text: 'Double-click to edit', fontSize: 16, fontColor: '#333333', fontFamily: 'Inter, sans-serif', bold: false, italic: false };
    case 'picture': return { src: '' };
    case 'map-frame': return {};
    case 'scale-bar': return { color: '#333333', barWidth: 100, unit: 'km' };
    case 'north-arrow': return { color: '#333333', size: 40 };
    case 'legend': return { title: 'Legend' };
    default: return {};
  }
}

function deleteLayoutElement(id) {
  var idx = -1;
  for (var i = 0; i < layoutElements.length; i++) {
    if (layoutElements[i].id === id) { idx = i; break; }
  }
  if (idx === -1) return;
  var el = layoutElements[idx];

  if (el.type === 'map-frame') {
    return;
  }

  layoutElements.splice(idx, 1);
  if (selectedLayoutElementId === id) {
    selectedLayoutElementId = null;
    renderLayoutProperties();
  }
  renderLayoutCanvas();
}

function selectElement(id) {
  if (selectedLayoutElementId === id) return;
  selectedLayoutElementId = id;
  var maxZ = 0;
  for (var i = 0; i < layoutElements.length; i++) {
    if (layoutElements[i].zIndex > maxZ) maxZ = layoutElements[i].zIndex;
    if (layoutElements[i].id === id) layoutElements[i].zIndex = maxZ + 1;
  }
  renderLayoutCanvas();
  renderLayoutProperties();
}

function deselectAllElements() {
  selectedLayoutElementId = null;
  renderLayoutCanvas();
  renderLayoutProperties();
}

function bringToFront(id) {
  var el = getEl(id);
  if (!el) return;
  var maxZ = 0;
  for (var i = 0; i < layoutElements.length; i++) {
    if (layoutElements[i].zIndex > maxZ && layoutElements[i].id !== id) maxZ = layoutElements[i].zIndex;
  }
  el.zIndex = maxZ + 1;
  renderLayoutCanvas();
}

function renderLayoutCanvas() {
  var canvas = document.getElementById('layout-canvas');
  var cs = getCanvasSize();
  canvas.style.width = cs.width + 'px';
  canvas.style.height = cs.height + 'px';

  var mapEl = document.getElementById('map');

  layoutElements.sort(function(a, b) { return a.zIndex - b.zIndex; });

  var html = '';
  for (var i = 0; i < layoutElements.length; i++) {
    html += renderElementHTML(layoutElements[i]);
  }
  canvas.innerHTML = html;

  if (layoutMode) {
    var mapFrameEl = null;
    for (var j = 0; j < layoutElements.length; j++) {
      if (layoutElements[j].type === 'map-frame') { mapFrameEl = layoutElements[j]; break; }
    }
    if (mapFrameEl && mapEl) {
      var mfDiv = canvas.querySelector('.lf-element[data-id="' + mapFrameEl.id + '"] .lf-content');
      if (mfDiv) {
        if (mapEl.parentNode !== mfDiv) {
          mfDiv.appendChild(mapEl);
          mapEl.style.position = 'relative';
          mapEl.style.left = 'auto';
          mapEl.style.top = 'auto';
          mapEl.style.flex = 'none';
        }
        mapEl.style.width = '100%';
        mapEl.style.height = '100%';
        if (mapFrameEl.rotation) {
          mapEl.style.transform = 'rotate(' + mapFrameEl.rotation + 'deg)';
        } else {
          mapEl.style.transform = '';
        }
        map.invalidateSize(true);
      }
    }
  }

  initElementEvents();
}

function renderElementHTML(el) {
  var sel = selectedLayoutElementId === el.id ? ' selected' : '';
  var style = 'left:' + el.x + 'px;top:' + el.y + 'px;width:' + el.width + 'px;height:' + el.height + 'px;z-index:' + el.zIndex + ';';
  if (el.rotation) style += 'transform:rotate(' + el.rotation + 'deg);';

  var content = '';
  var cls = 'lf-element lf-' + el.type + sel;

  switch (el.type) {
    case 'box':
      content = '<div class="lf-content" style="background:' + el.options.fillColor + ';border:' + el.options.borderWidth + 'px solid ' + el.options.borderColor + ';"></div>';
      break;
    case 'text':
      content = '<div class="lf-content" style="font-size:' + el.options.fontSize + 'px;color:' + el.options.fontColor + ';font-family:' + el.options.fontFamily + ';font-weight:' + (el.options.bold ? '700' : '400') + ';font-style:' + (el.options.italic ? 'italic' : 'normal') + ';" contenteditable="true">' + escapeHtml(el.options.text) + '</div>';
      break;
    case 'picture':
      if (el.options.src) {
        content = '<div class="lf-content"><img src="' + el.options.src + '" alt="Picture" draggable="false" /></div>';
      } else {
        content = '<div class="lf-content" style="display:flex;align-items:center;justify-content:center;background:#f0f0f0;color:#999;font-size:11px;">No image</div>';
      }
      break;
    case 'map-frame':
      content = '<div class="lf-content" style="background:#e8e8e8;"></div>';
      break;
    case 'scale-bar':
      content = '<div class="lf-content">' + generateScaleBarSVG(el) + '</div>';
      break;
    case 'north-arrow':
      content = '<div class="lf-content">' + generateNorthArrowSVG(el, getMapFrameRotation()) + '</div>';
      break;
    case 'legend':
      var legendContent = generateLegendHTML();
      content = '<div class="lf-content" style="overflow:auto;background:#fafafa;">';
      if (el.options.title) {
        content += '<div style="font-family:Outfit,sans-serif;font-size:12px;font-weight:700;padding:8px 8px 4px;color:#333;border-bottom:1px solid #e0e0e0;">' + escapeHtml(el.options.title) + '</div>';
      }
      content += legendContent + '</div>';
      break;
  }

  var handles = '<div class="lf-resize-handle nw"></div><div class="lf-resize-handle n"></div><div class="lf-resize-handle ne"></div><div class="lf-resize-handle w"></div><div class="lf-resize-handle e"></div><div class="lf-resize-handle sw"></div><div class="lf-resize-handle s"></div><div class="lf-resize-handle se"></div><div class="lf-rotate-handle"></div>';

  return '<div class="' + cls + '" data-id="' + el.id + '" style="' + style + '">' + content + handles + '</div>';
}

function initElementEvents() {
  var elements = document.querySelectorAll('#layout-canvas .lf-element');
  for (var i = 0; i < elements.length; i++) {
    (function(elDiv) {
      var id = elDiv.dataset.id;
      var el = getEl(id);
      if (!el) return;

      elDiv.addEventListener('mousedown', function(e) {
        if (e.button !== 0) return;
        if (e.target.closest('.lf-resize-handle')) return;
        if (e.target.closest('.lf-rotate-handle')) return;
        e.stopPropagation();
        selectElement(id);
        bringToFront(id);
        startDrag(id, e.clientX, e.clientY);
      });

      elDiv.addEventListener('dblclick', function(e) {
        var cel = getSelectedEl();
        if (!cel) return;
        if (cel.type === 'text') {
          var contentDiv = elDiv.querySelector('.lf-content');
          if (contentDiv && contentDiv.hasAttribute('contenteditable')) {
            var sel2 = window.getSelection();
            var range = document.createRange();
            range.selectNodeContents(contentDiv);
            sel2.removeAllRanges();
            sel2.addRange(range);
          }
        }
      });

      var handles = elDiv.querySelectorAll('.lf-resize-handle');
      for (var j = 0; j < handles.length; j++) {
        (function(h) {
          h.addEventListener('mousedown', function(e) {
            e.stopPropagation();
            e.preventDefault();
            var dir = '';
            if (h.classList.contains('nw')) dir = 'nw';
            else if (h.classList.contains('n')) dir = 'n';
            else if (h.classList.contains('ne')) dir = 'ne';
            else if (h.classList.contains('w')) dir = 'w';
            else if (h.classList.contains('e')) dir = 'e';
            else if (h.classList.contains('sw')) dir = 'sw';
            else if (h.classList.contains('s')) dir = 's';
            else if (h.classList.contains('se')) dir = 'se';
            startResize(id, dir, e.clientX, e.clientY);
          });
        })(handles[j]);
      }

      var rotateHandle = elDiv.querySelector('.lf-rotate-handle');
      if (rotateHandle) {
        rotateHandle.addEventListener('mousedown', function(e) {
          e.stopPropagation();
          e.preventDefault();
          startRotate(id, e.clientX, e.clientY);
        });
      }
    })(elements[i]);
  }
}

function startDrag(id, mx, my) {
  var el = getEl(id);
  if (!el) return;
  isLayoutDragging = true;
  dragElId = id;
  dragStartMouseX = mx;
  dragStartMouseY = my;
  dragStartElX = el.x;
  dragStartElY = el.y;
}

function startResize(id, dir, mx, my) {
  isLayoutResizing = true;
  dragElId = id;
  resizeHandle = dir;
  resizeStartW = getEl(id).width;
  resizeStartH = getEl(id).height;
  resizeStartX = getEl(id).x;
  resizeStartY = getEl(id).y;
  dragStartMouseX = mx;
  dragStartMouseY = my;
}

function canvasMousePos(clientX, clientY) {
  var canvas = document.getElementById('layout-canvas');
  var cr = canvas.getBoundingClientRect();
  return {
    x: clientX - cr.left + canvas.parentElement.scrollLeft,
    y: clientY - cr.top + canvas.parentElement.scrollTop
  };
}

function startRotate(id, mx, my) {
  var el = getEl(id);
  if (!el) return;
  isLayoutRotating = true;
  dragElId = id;
  var pos = canvasMousePos(mx, my);
  var cx = el.x + el.width / 2;
  var cy = el.y + el.height / 2;
  rotateStartAngle = Math.atan2(pos.y - cy, pos.x - cx) * (180 / Math.PI) - el.rotation;
}

document.addEventListener('mousemove', function(e) {
  if (isLayoutDragging && dragElId) {
    var el = getEl(dragElId);
    if (!el) return;
    var dx = e.clientX - dragStartMouseX;
    var dy = e.clientY - dragStartMouseY;
    el.x = Math.max(0, dragStartElX + dx);
    el.y = Math.max(0, dragStartElY + dy);
    var canvas = document.getElementById('layout-canvas');
    if (el.x + el.width > canvas.offsetWidth) el.x = canvas.offsetWidth - el.width;
    if (el.y + el.height > canvas.offsetHeight) el.y = canvas.offsetHeight - el.height;
    var div = document.querySelector('.lf-element[data-id="' + el.id + '"]');
    if (div) {
      div.style.left = el.x + 'px';
      div.style.top = el.y + 'px';
    }
  }

  if (isLayoutResizing && dragElId) {
    var el = getEl(dragElId);
    if (!el) return;
    var dx = e.clientX - dragStartMouseX;
    var dy = e.clientY - dragStartMouseY;
    var newW = resizeStartW, newH = resizeStartH;
    var newX = resizeStartX, newY = resizeStartY;
    var minS = 20;

    if (resizeHandle.indexOf('e') >= 0) newW = Math.max(minS, resizeStartW + dx);
    if (resizeHandle.indexOf('w') >= 0) { newW = Math.max(minS, resizeStartW - dx); newX = resizeStartX + (resizeStartW - newW); }
    if (resizeHandle.indexOf('s') >= 0) newH = Math.max(minS, resizeStartH + dy);
    if (resizeHandle.indexOf('n') >= 0) { newH = Math.max(minS, resizeStartH - dy); newY = resizeStartY + (resizeStartH - newH); }

    el.width = newW;
    el.height = newH;
    el.x = newX;
    el.y = newY;

    var div = document.querySelector('.lf-element[data-id="' + el.id + '"]');
    if (div) {
      div.style.left = el.x + 'px';
      div.style.top = el.y + 'px';
      div.style.width = el.width + 'px';
      div.style.height = el.height + 'px';
      updateMapFrameContent(el);
    }
  }

  if (isLayoutRotating && dragElId) {
    var el = getEl(dragElId);
    if (!el) return;
    var pos = canvasMousePos(e.clientX, e.clientY);
    var cx = el.x + el.width / 2;
    var cy = el.y + el.height / 2;
    var angle = Math.atan2(pos.y - cy, pos.x - cx) * (180 / Math.PI) - rotateStartAngle;
    el.rotation = angle;
    var div = document.querySelector('.lf-element[data-id="' + el.id + '"]');
    if (div) {
      div.style.transform = 'rotate(' + angle + 'deg)';
      updateMapFrameContent(el);
    }
  }
});

document.addEventListener('mouseup', function(e) {
  if (isLayoutDragging || isLayoutResizing || isLayoutRotating) {
    isLayoutDragging = false;
    isLayoutResizing = false;
    isLayoutRotating = false;
    if (dragElId) {
      var el = getEl(dragElId);
      if (el && el.type === 'map-frame') {
        updateMapFrameContent(el);
      }
      renderLayoutProperties();
    }
    dragElId = null;
  }
});

function updateMapFrameContent(el) {
  if (!el || el.type !== 'map-frame') return;
  var mapEl = document.getElementById('map');
  if (!mapEl) return;
  if (el.rotation) {
    mapEl.style.transform = 'rotate(' + el.rotation + 'deg)';
  } else {
    mapEl.style.transform = '';
  }
  map.invalidateSize(true);
}

function generateLegendHTML() {
  if (!layerStore || layerStore.length === 0) return '<div style="color:#999;font-size:11px;padding:8px;font-family:Inter,sans-serif;">No layers loaded</div>';
  var html = '<div style="font-family:Inter,sans-serif;font-size:11px;padding:8px;line-height:1.5;">';
  for (var i = 0; i < layerStore.length; i++) {
    var l = layerStore[i];
    if (l.visible === false) continue;
    var lname = l.title || l.name || 'Layer';
    html += '<div style="font-weight:700;margin-bottom:4px;margin-top:' + (i > 0 ? '8' : '0') + 'px;color:#333;">' + escapeHtml(lname) + '</div>';
    if (l.categories && l.categories.length > 0) {
      var allHidden = true;
      for (var ci = 0; ci < l.categories.length; ci++) {
        if (!l.hiddenCatKeys || l.hiddenCatKeys.indexOf(l.categories[ci].key) < 0) { allHidden = false; break; }
      }
      if (allHidden) {
        html += '<div style="color:#999;padding:2px 0;">(all categories hidden)</div>';
      } else {
        for (var j = 0; j < l.categories.length; j++) {
          var cat = l.categories[j];
          if (l.hiddenCatKeys && l.hiddenCatKeys.indexOf(cat.key) >= 0) continue;
          var catLabel = (l.customCategoryLabels && l.customCategoryLabels[cat.key]) || cat.key;
          html += '<div style="display:flex;align-items:center;gap:6px;padding:2px 0;">';
          html += '<span style="width:14px;height:14px;display:inline-block;background:' + cat.color + ';border-radius:2px;border:1px solid rgba(0,0,0,0.1);flex-shrink:0;"></span>';
          html += '<span style="color:#555;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escapeHtml(catLabel) + '</span>';
          html += '</div>';
        }
      }
    }
  }
  html += '</div>';
  return html;
}

function getMapScaleBar(widthPx) {
  if (!map || !map.getCenter || map.getCenter() == null) return { pixels: widthPx, label: 'Scale' };
  var center = map.getCenter();
  var zoom = map.getZoom();
  var TILE_SIZE = 256;
  var res = 2 * Math.PI * 6378137 / (TILE_SIZE * Math.pow(2, zoom));
  var metersPerPx = res * Math.cos(center.lat * Math.PI / 180);
  var targetMeters = metersPerPx * widthPx;

  var niceMeters = 0;
  var niceWidth = 0;
  if (targetMeters < 1) {
    niceMeters = 1; niceWidth = Math.round(1 / metersPerPx);
  } else {
    var mult = Math.pow(10, Math.floor(Math.log10(targetMeters)));
    var val = targetMeters / mult;
    var niceVal;
    if (val < 1.5) niceVal = 1;
    else if (val < 3.5) niceVal = 2;
    else if (val < 7.5) niceVal = 5;
    else niceVal = 10;
    niceMeters = niceVal * mult;
    niceWidth = Math.round(niceMeters / metersPerPx);
  }

  var label;
  if (niceMeters >= 1000) label = (niceMeters / 1000) + ' km';
  else label = niceMeters + ' m';

  return { pixels: niceWidth, label: label };
}

function generateScaleBarSVG(el) {
  var color = el.options.color || '#333';
  var barHeight = 4;
  var scaleInfo = getMapScaleBar(el.options.barWidth || 100);
  var w = Math.min(el.width, scaleInfo.pixels);
  var label = scaleInfo.label;

  var svg = '<svg width="' + el.width + '" height="' + el.height + '" viewBox="0 0 ' + el.width + ' ' + el.height + '" xmlns="http://www.w3.org/2000/svg">';
  svg += '<rect x="0" y="' + ((el.height - barHeight) / 2) + '" width="' + (w / 2) + '" height="' + barHeight + '" fill="' + color + '" />';
  svg += '<rect x="' + (w / 2) + '" y="' + ((el.height - barHeight) / 2) + '" width="' + (w / 2) + '" height="' + barHeight + '" fill="none" stroke="' + color + '" stroke-width="1" />';
  svg += '<line x1="0" y1="' + ((el.height - barHeight) / 2) + '" x2="0" y2="' + ((el.height - barHeight) / 2 + 6) + '" stroke="' + color + '" stroke-width="1.5" />';
  svg += '<line x1="' + w + '" y1="' + ((el.height - barHeight) / 2) + '" x2="' + w + '" y2="' + ((el.height - barHeight) / 2 + 6) + '" stroke="' + color + '" stroke-width="1.5" />';
  svg += '<text x="' + (w / 2) + '" y="' + ((el.height - barHeight) / 2 - 4) + '" text-anchor="middle" font-size="10" fill="' + color + '" font-family="Inter, sans-serif">' + escapeHtml(label) + '</text>';
  svg += '</svg>';
  return svg;
}

function getMapFrameRotation() {
  for (var i = 0; i < layoutElements.length; i++) {
    if (layoutElements[i].type === 'map-frame') return layoutElements[i].rotation || 0;
  }
  return 0;
}

function generateNorthArrowSVG(el, mapRotation) {
  var s = el.options.size || 40;
  var color = el.options.color || '#333';
  var cx = el.width / 2;
  var cy = el.height / 2;
  var half = s / 2;
  var rot = -(mapRotation || 0);

  var svg = '<svg width="' + el.width + '" height="' + el.height + '" viewBox="0 0 ' + el.width + ' ' + el.height + '" xmlns="http://www.w3.org/2000/svg">';
  svg += '<g transform="translate(' + cx + ',' + cy + ') rotate(' + rot + ') translate(' + (-cx) + ',' + (-cy) + ')">';
  svg += '<polygon points="' + cx + ',' + (cy - half) + ' ' + (cx - half * 0.6) + ',' + (cy + half * 0.4) + ' ' + cx + ',' + (cy + half * 0.15) + ' ' + (cx + half * 0.6) + ',' + (cy + half * 0.4) + '" fill="' + color + '" />';
  svg += '<polygon points="' + cx + ',' + (cy + half) + ' ' + (cx - half * 0.6) + ',' + (cy - half * 0.4) + ' ' + cx + ',' + (cy - half * 0.15) + ' ' + (cx + half * 0.6) + ',' + (cy - half * 0.4) + '" fill="none" stroke="' + color + '" stroke-width="1.5" />';
  svg += '<text x="' + cx + '" y="' + (cy - half - 4) + '" text-anchor="middle" font-size="9" fill="' + color + '" font-family="Inter, sans-serif" font-weight="bold">N</text>';
  svg += '</g></svg>';
  return svg;
}

function renderLayoutProperties() {
  var panel = document.getElementById('layout-props');
  var el = getSelectedEl();

  if (!el) {
    panel.innerHTML = '<h3>Properties</h3><div class="lp-empty">Select an element on the canvas to edit its properties</div>';
    return;
  }

  var html = '<h3>Properties</h3>';

  html += '<div class="lp-row">';
  html += '<div class="lp-group"><label>X</label><input type="number" class="lp-prop-x" value="' + Math.round(el.x) + '" step="1" /></div>';
  html += '<div class="lp-group"><label>Y</label><input type="number" class="lp-prop-y" value="' + Math.round(el.y) + '" step="1" /></div>';
  html += '</div>';

  html += '<div class="lp-row">';
  html += '<div class="lp-group"><label>Width</label><input type="number" class="lp-prop-w" value="' + Math.round(el.width) + '" step="1" min="20" /></div>';
  html += '<div class="lp-group"><label>Height</label><input type="number" class="lp-prop-h" value="' + Math.round(el.height) + '" step="1" min="20" /></div>';
  html += '</div>';

  html += '<div class="lp-group"><label>Rotation (&deg;)</label><input type="number" class="lp-prop-rot" value="' + Math.round(el.rotation || 0) + '" step="1" /></div>';

  html += '<div class="lp-group"><label>Type</label><div style="font-size:12px;color:#a6adc8;text-transform:capitalize;">' + el.type.replace('-', ' ') + '</div></div>';

  if (el.type === 'box') {
    html += '<div class="lp-section-title">Appearance</div>';
    html += '<div class="lp-row">';
    html += '<div class="lp-group"><label>Fill</label><input type="color" class="lp-prop-fill" value="' + (el.options.fillColor || '#e0e0e0') + '" /></div>';
    html += '<div class="lp-group"><label>Border</label><input type="color" class="lp-prop-border" value="' + (el.options.borderColor || '#999999') + '" /></div>';
    html += '</div>';
    html += '<div class="lp-group"><label>Border Width</label><input type="number" class="lp-prop-border-width" value="' + (el.options.borderWidth || 1) + '" step="1" min="0" max="20" /></div>';
  }

  if (el.type === 'text') {
    html += '<div class="lp-section-title">Text Style</div>';
    html += '<div class="lp-group"><label>Text</label><input type="text" class="lp-prop-text" value="' + escapeHtml(el.options.text || '') + '" /></div>';
    html += '<div class="lp-row">';
    html += '<div class="lp-group"><label>Font Size</label><input type="number" class="lp-prop-fontsize" value="' + (el.options.fontSize || 16) + '" min="8" max="120" /></div>';
    html += '<div class="lp-group"><label>Color</label><input type="color" class="lp-prop-fontcolor" value="' + (el.options.fontColor || '#333333') + '" /></div>';
    html += '</div>';
    html += '<div class="lp-group"><label>Font Family</label><select class="lp-prop-fontfamily">';
    var fonts = ['Inter, sans-serif', 'Outfit, sans-serif', 'Georgia, serif', 'Courier New, monospace'];
    for (var fi = 0; fi < fonts.length; fi++) {
      var sel = el.options.fontFamily === fonts[fi] ? ' selected' : '';
      html += '<option value="' + fonts[fi] + '"' + sel + '>' + fonts[fi].split(',')[0] + '</option>';
    }
    html += '</select></div>';
  }

  if (el.type === 'scale-bar') {
    html += '<div class="lp-section-title">Scale Bar</div>';
    html += '<div class="lp-group"><label>Color</label><input type="color" class="lp-prop-sb-color" value="' + (el.options.color || '#333333') + '" /></div>';
    html += '<div class="lp-group"><label>Bar Width (px)</label><input type="number" class="lp-prop-sb-width" value="' + (el.options.barWidth || 100) + '" min="20" max="' + el.width + '" /></div>';
  }

  if (el.type === 'north-arrow') {
    html += '<div class="lp-section-title">North Arrow</div>';
    html += '<div class="lp-group"><label>Color</label><input type="color" class="lp-prop-na-color" value="' + (el.options.color || '#333333') + '" /></div>';
    html += '<div class="lp-group"><label>Size</label><input type="number" class="lp-prop-na-size" value="' + (el.options.size || 40) + '" min="10" max="200" /></div>';
  }

  if (el.type === 'legend') {
    html += '<div class="lp-section-title">Legend</div>';
    html += '<div class="lp-group"><label>Title</label><input type="text" class="lp-prop-legend-title" value="' + escapeHtml(el.options.title || '') + '" /></div>';
    html += '<button class="lp-delete-btn" id="lpRefreshLegendBtn" style="background:rgba(137,180,250,0.1);border-color:rgba(137,180,250,0.2);color:#89b4fa;margin-bottom:8px;">Refresh Legend from Map</button>';
  }

  if (el.type !== 'map-frame') {
    html += '<button class="lp-delete-btn" id="lpDeleteBtn">Delete Element</button>';
  }

  panel.innerHTML = html;

  panel.querySelectorAll('.lp-prop-x, .lp-prop-y, .lp-prop-w, .lp-prop-h, .lp-prop-rot').forEach(function(inp) {
    inp.addEventListener('change', function() {
      var e2 = getSelectedEl();
      if (!e2) return;
      e2.x = parseInt(panel.querySelector('.lp-prop-x').value) || 0;
      e2.y = parseInt(panel.querySelector('.lp-prop-y').value) || 0;
      e2.width = Math.max(20, parseInt(panel.querySelector('.lp-prop-w').value) || 20);
      e2.height = Math.max(20, parseInt(panel.querySelector('.lp-prop-h').value) || 20);
      e2.rotation = parseFloat(panel.querySelector('.lp-prop-rot').value) || 0;
      renderLayoutCanvas();
    });
  });

  var fillInput = panel.querySelector('.lp-prop-fill');
  if (fillInput) {
    fillInput.addEventListener('input', function() {
      var e2 = getSelectedEl();
      if (e2) { e2.options.fillColor = this.value; renderLayoutCanvas(); }
    });
  }

  var borderInput = panel.querySelector('.lp-prop-border');
  if (borderInput) {
    borderInput.addEventListener('input', function() {
      var e2 = getSelectedEl();
      if (e2) { e2.options.borderColor = this.value; renderLayoutCanvas(); }
    });
  }

  var bwInput = panel.querySelector('.lp-prop-border-width');
  if (bwInput) {
    bwInput.addEventListener('change', function() {
      var e2 = getSelectedEl();
      if (e2) { e2.options.borderWidth = parseInt(this.value) || 0; renderLayoutCanvas(); }
    });
  }

  var textInput = panel.querySelector('.lp-prop-text');
  if (textInput) {
    textInput.addEventListener('change', function() {
      var e2 = getSelectedEl();
      if (e2) { e2.options.text = this.value; renderLayoutCanvas(); }
    });
  }

  var fsInput = panel.querySelector('.lp-prop-fontsize');
  if (fsInput) {
    fsInput.addEventListener('change', function() {
      var e2 = getSelectedEl();
      if (e2) { e2.options.fontSize = parseInt(this.value) || 16; renderLayoutCanvas(); }
    });
  }

  var fcInput = panel.querySelector('.lp-prop-fontcolor');
  if (fcInput) {
    fcInput.addEventListener('input', function() {
      var e2 = getSelectedEl();
      if (e2) { e2.options.fontColor = this.value; renderLayoutCanvas(); }
    });
  }

  var ffInput = panel.querySelector('.lp-prop-fontfamily');
  if (ffInput) {
    ffInput.addEventListener('change', function() {
      var e2 = getSelectedEl();
      if (e2) { e2.options.fontFamily = this.value; renderLayoutCanvas(); }
    });
  }

  var sbColorInput = panel.querySelector('.lp-prop-sb-color');
  if (sbColorInput) {
    sbColorInput.addEventListener('input', function() {
      var e2 = getSelectedEl();
      if (e2) { e2.options.color = this.value; renderLayoutCanvas(); }
    });
  }

  var sbWidthInput = panel.querySelector('.lp-prop-sb-width');
  if (sbWidthInput) {
    sbWidthInput.addEventListener('change', function() {
      var e2 = getSelectedEl();
      if (e2) { e2.options.barWidth = parseInt(this.value) || 50; renderLayoutCanvas(); }
    });
  }

  var naColorInput = panel.querySelector('.lp-prop-na-color');
  if (naColorInput) {
    naColorInput.addEventListener('input', function() {
      var e2 = getSelectedEl();
      if (e2) { e2.options.color = this.value; renderLayoutCanvas(); }
    });
  }

  var naSizeInput = panel.querySelector('.lp-prop-na-size');
  if (naSizeInput) {
    naSizeInput.addEventListener('change', function() {
      var e2 = getSelectedEl();
      if (e2) { e2.options.size = parseInt(this.value) || 20; renderLayoutCanvas(); }
    });
  }

  var legendTitleInput = panel.querySelector('.lp-prop-legend-title');
  if (legendTitleInput) {
    legendTitleInput.addEventListener('change', function() {
      var e2 = getSelectedEl();
      if (e2) { e2.options.title = this.value; renderLayoutCanvas(); }
    });
  }

  var refreshLegendBtn = panel.querySelector('#lpRefreshLegendBtn');
  if (refreshLegendBtn) {
    refreshLegendBtn.addEventListener('click', function() {
      var e2 = getSelectedEl();
      if (e2) { renderLayoutCanvas(); }
    });
  }

  var delBtn = panel.querySelector('#lpDeleteBtn');
  if (delBtn) {
    delBtn.addEventListener('click', function() {
      var e2 = getSelectedEl();
      if (e2) deleteLayoutElement(e2.id);
    });
  }
}

function handleCanvasClick(e) {
  if (layoutActiveTool !== 'select') {
    createLayoutElement(layoutActiveTool, e.clientX, e.clientY);
    return;
  }
  if (!e.target.closest('.lf-element')) {
    deselectAllElements();
  }
}

function exportLayoutPNG() {
  if (!layoutMode) return;
  var canvas = document.getElementById('layout-canvas');
  html2canvas(canvas, { scale: 2, useCORS: true, backgroundColor: '#ffffff' }).then(function(renderedCanvas) {
    var link = document.createElement('a');
    link.download = 'map-layout.png';
    link.href = renderedCanvas.toDataURL('image/png');
    link.click();
  });
}

function exportLayoutPDF() {
  if (!layoutMode) return;
  var canvas = document.getElementById('layout-canvas');
  var cs = getCanvasSize();
  var mmW = cs.width * 0.2646;
  var mmH = cs.height * 0.2646;

  html2canvas(canvas, { scale: 2, useCORS: true, backgroundColor: '#ffffff' }).then(function(renderedCanvas) {
    var imgData = renderedCanvas.toDataURL('image/png');
    var pdf = new jspdf.jsPDF({
      orientation: mmW > mmH ? 'landscape' : 'portrait',
      unit: 'mm',
      format: [mmW, mmH]
    });
    pdf.addImage(imgData, 'PNG', 0, 0, mmW, mmH);
    pdf.save('map-layout.pdf');
  });
}

function initLayoutMode() {
  var canvas = document.getElementById('layout-canvas');
  canvas.addEventListener('mousedown', handleCanvasClick);

  document.querySelectorAll('.ltb-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      setLayoutTool(this.dataset.tool);
    });
  });

  document.getElementById('layoutExportPNG').addEventListener('click', exportLayoutPNG);
  document.getElementById('layoutExportPDF').addEventListener('click', exportLayoutPDF);

  document.getElementById('layoutBackBtn').addEventListener('click', exitLayoutMode);

  document.getElementById('toggleLayoutMode').addEventListener('click', function() {
    if (layoutMode) { exitLayoutMode(); } else { enterLayoutMode(); }
  });

  document.addEventListener('keydown', function(e) {
    if (!layoutMode) return;
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (document.activeElement && document.activeElement.getAttribute('contenteditable') === 'true') return;
      var el = getSelectedEl();
      if (el) deleteLayoutElement(el.id);
    }
    if (e.key === 'Escape') {
      deselectAllElements();
    }
  });

  document.getElementById('layout-canvas').addEventListener('blur', function(e) {
    var ce = e.target.closest('.lf-element.lf-text .lf-content[contenteditable]');
    if (!ce) return;
    var elDiv = ce.closest('.lf-element');
    if (!elDiv) return;
    var el = getEl(elDiv.dataset.id);
    if (!el || el.type !== 'text') return;
    el.options.text = ce.textContent;
  }, true);

  document.getElementById('layout-canvas').addEventListener('dblclick', function(e) {
    var elDiv = e.target.closest('.lf-element');
    if (!elDiv) return;
    var el = getEl(elDiv.dataset.id);
    if (!el) return;

    if (el.type === 'picture') {
      var input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.addEventListener('change', function(ev) {
        var file = ev.target.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function(ev2) {
          el.options.src = ev2.target.result;
          renderLayoutCanvas();
        };
        reader.readAsDataURL(file);
      });
      input.click();
    }
  });

  document.querySelectorAll('input[name="searchMode"]').forEach(function(el) {
    el.addEventListener('change', function(e) {
      if (!e.target.checked) return;
      if (layoutMode) {
        var mapEl = document.getElementById('map');
        if (mapEl) {
          map.invalidateSize(true);
        }
      }
    });
  });

  map.on('zoomend', function() {
    if (layoutMode) renderLayoutCanvas();
  });
}

initLayoutMode();
