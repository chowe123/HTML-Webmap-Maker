var localMBLayer = null;
var localMBLoaded = false;
var localMBFilename = '';
var localMBBuffer = null;

function queryTileData(db, z, x, y) {
  var tmsY = Math.pow(2, z) - 1 - y;
  var stmt = db.prepare("SELECT tile_data FROM tiles WHERE zoom_level = ? AND tile_column = ? AND tile_row = ?");
  stmt.bind([z, x, tmsY]);
  if (stmt.step()) { var row = stmt.getAsObject(); stmt.free(); return row.tile_data; }
  stmt.free();
  stmt = db.prepare("SELECT tile_data FROM tiles WHERE zoom_level = ? AND tile_column = ? AND tile_row = ?");
  stmt.bind([z, x, y]);
  if (stmt.step()) { var row2 = stmt.getAsObject(); stmt.free(); return row2.tile_data; }
  stmt.free();
  return null;
}

function loadLocalMBTiles(file) {
  return new Promise(function(resolve, reject) {
    var reader = new FileReader();
    reader.onload = function(ev) {
      localMBBuffer = ev.target.result;
      initSqlJs({
        locateFile: function(f) { return 'https://cdn.jsdelivr.net/npm/sql.js@1.10.3/dist/' + f; }
      }).then(function(SQL) {
        try {
          var db = new SQL.Database(new Uint8Array(ev.target.result));
          var metadata = {};
          var mStmt = db.prepare("SELECT name, value FROM metadata");
          while (mStmt.step()) { var row = mStmt.getAsObject(); metadata[row.name] = row.value; }
          mStmt.free();
          var format = (metadata.format || 'png').replace(/^image\//, '');
          if (format === 'pbf') { throw new Error('Vector tile MBTiles (PBF) is not supported. Only image tile MBTiles (PNG/JPEG) are supported.'); }
          var minZoom = parseInt(metadata.minzoom, 10);
          if (isNaN(minZoom)) minZoom = 0;
          var maxZoom = parseInt(metadata.maxzoom, 10);
          if (isNaN(maxZoom)) maxZoom = 18;
          if (localMBLayer && map.hasLayer(localMBLayer)) { map.removeLayer(localMBLayer); }
          var MBTilesGrid = L.GridLayer.extend({
            createTile: function(coords, done) {
              var tile = L.DomUtil.create('img', 'leaflet-tile');
              tile.alt = '';
              var z = coords.z, x = coords.x, y = coords.y;
              try {
                var tileData = queryTileData(db, z, x, y);
                if (tileData) {
                  var mime = (format === 'jpg' || format === 'jpeg') ? 'image/jpeg' : 'image/png';
                  var blob = new Blob([tileData], { type: mime });
                  var url = URL.createObjectURL(blob);
                  tile.addEventListener('load', function() { URL.revokeObjectURL(url); done(null, tile); });
                  tile.addEventListener('error', function() { URL.revokeObjectURL(url); done(null, tile); });
                  tile.src = url;
                } else {
                  done(null, tile);
                }
              } catch (e) { done(null, tile); }
              return tile;
            }
          });
          var layer = new MBTilesGrid({
            minZoom: 0,
            maxZoom: 22,
            maxNativeZoom: maxZoom,
            tileSize: 256,
            noWrap: true,
            attribution: metadata.attribution || 'Local MBTiles'
          });
          localMBLayer = layer;
          localMBLoaded = true;
          localMBFilename = file.name;
          resolve(metadata);
        } catch (err) { reject(err); }
      }).catch(reject);
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}
