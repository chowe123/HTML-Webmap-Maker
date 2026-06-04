var rasterStore = [];
var rasterCounter = 0;

function ensureUint8(band, len) {
  if (band instanceof Uint8Array) return band;
  var result = new Uint8Array(len);
  var min = Infinity, max = -Infinity;
  for (var i = 0; i < len; i++) { var v = band[i]; if (v < min) min = v; if (v > max) max = v; }
  var range = max - min || 1;
  for (var i = 0; i < len; i++) { result[i] = Math.round((band[i] - min) / range * 255); }
  return result;
}

function fillRasterImageData(imageData, rasters, len) {
  var bands = Object.keys(rasters).filter(function(k) { return !isNaN(parseInt(k, 10)); }).length;
  var d = imageData.data;
  if (bands >= 4) {
    var rr = ensureUint8(rasters[0], len), gg = ensureUint8(rasters[1], len);
    var bb = ensureUint8(rasters[2], len), aa = ensureUint8(rasters[3], len);
    for (var i = 0; i < len; i++) { d[i * 4] = rr[i]; d[i * 4 + 1] = gg[i]; d[i * 4 + 2] = bb[i]; d[i * 4 + 3] = aa[i]; }
  } else if (bands >= 3) {
    var r = ensureUint8(rasters[0], len), g = ensureUint8(rasters[1], len), b = ensureUint8(rasters[2], len);
    for (var i = 0; i < len; i++) { d[i * 4] = r[i]; d[i * 4 + 1] = g[i]; d[i * 4 + 2] = b[i]; d[i * 4 + 3] = 255; }
  } else {
    var gray = ensureUint8(rasters[0], len);
    for (var i = 0; i < len; i++) { d[i * 4] = gray[i]; d[i * 4 + 1] = gray[i]; d[i * 4 + 2] = gray[i]; d[i * 4 + 3] = 255; }
  }
}

function addRasterLayer(name, arrayBuffer) {
  return GeoTIFF.fromArrayBuffer(arrayBuffer).then(function(tiff) {
    return tiff.getImage();
  }).then(function(image) {
    var width = image.getWidth();
    var height = image.getHeight();
    var totalPx = width * height;

    return image.readRasters().then(function(rasters) {
      var scale = 1;
      var outW = width, outH = height;
      if (totalPx > 16777216) {
        scale = Math.ceil(Math.sqrt(totalPx / 16777216));
        outW = Math.floor(width / scale);
        outH = Math.floor(height / scale);
      }

      var canvas = document.createElement('canvas');
      canvas.width = outW;
      canvas.height = outH;
      var ctx = canvas.getContext('2d');

      if (scale > 1) {
        var tempC = document.createElement('canvas');
        tempC.width = width;
        tempC.height = height;
        var tCtx = tempC.getContext('2d');
        var td = tCtx.createImageData(width, height);
        fillRasterImageData(td, rasters, totalPx);
        tCtx.putImageData(td, 0, 0);
        ctx.drawImage(tempC, 0, 0, outW, outH);
      } else {
        var id = ctx.createImageData(outW, outH);
        fillRasterImageData(id, rasters, totalPx);
        ctx.putImageData(id, 0, 0);
      }

      var dataUrl = canvas.toDataURL();
      var bbox = image.getBoundingBox();
      var south, west, north, east;

      if (Math.abs(bbox[0]) <= 180 && Math.abs(bbox[1]) <= 90 && Math.abs(bbox[2]) <= 180 && Math.abs(bbox[3]) <= 90) {
        west = bbox[0]; south = bbox[1]; east = bbox[2]; north = bbox[3];
      } else {
        west = (bbox[0] / 20037508.34) * 180;
        var y1 = bbox[1], y2 = bbox[3];
        south = (Math.atan(Math.exp(y1 / 20037508.34 * Math.PI)) * 360 / Math.PI) - 90;
        north = (Math.atan(Math.exp(y2 / 20037508.34 * Math.PI)) * 360 / Math.PI) - 90;
        east = (bbox[2] / 20037508.34) * 180;
      }

      var bounds = L.latLngBounds([south, west], [north, east]);
      var rasterId = 'raster_' + (++rasterCounter);
      var overlay = L.imageOverlay(dataUrl, bounds, { opacity: 1.0 }).addTo(map);

      var rasterObj = {
        id: rasterId,
        name: name,
        overlay: overlay,
        bounds: { south: south, west: west, north: north, east: east },
        dataUrl: dataUrl,
        visible: true,
        opacity: 1.0
      };

      rasterStore.push(rasterObj);
      renderUI();
      syncRasterZIndex();
      return rasterObj;
    });
  }).catch(function(err) {
    alert('Failed to load raster: ' + err.message);
    throw err;
  });
}

function toggleRasterLayer(id) {
  var raster = rasterStore.find(function(r) { return r.id === id; });
  if (!raster) return;
  raster.visible = !raster.visible;
  if (raster.visible) { map.addLayer(raster.overlay); } else { map.removeLayer(raster.overlay); }
  renderUI();
}

function removeRasterLayer(id) {
  var idx = rasterStore.findIndex(function(r) { return r.id === id; });
  if (idx === -1) return;
  var r = rasterStore[idx];
  if (r.overlay && map.hasLayer(r.overlay)) map.removeLayer(r.overlay);
  rasterStore.splice(idx, 1);
  renderUI();
}

function clearAllRasterLayers() {
  rasterStore.forEach(function(r) {
    if (r.overlay && map.hasLayer(r.overlay)) map.removeLayer(r.overlay);
  });
  rasterStore = [];
}

function syncRasterZIndex() {
  rasterStore.forEach(function(r) {
    if (r.visible && r.overlay && map.hasLayer(r.overlay) && r.overlay.bringToFront) {
      r.overlay.bringToFront();
    }
  });
}

function renameRasterLayer(id, newName) {
  var r = rasterStore.find(function(x) { return x.id === id; });
  if (!r) return;
  r.name = newName.trim() || r.name;
  renderUI();
}

function updateRasterOpacity(id, opacity) {
  var r = rasterStore.find(function(x) { return x.id === id; });
  if (!r) return;
  r.opacity = opacity;
  r.overlay.setOpacity(opacity);
}
