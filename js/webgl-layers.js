import {Deck} from 'https://esm.sh/@deck.gl/core@^9.0.0';
import {_MapboxOverlay as DeckOverlay} from 'https://esm.sh/@deck.gl/mapbox@^9.0.0';
import {GeoJsonLayer} from 'https://esm.sh/@deck.gl/layers@^9.0.0';

window.deck = {Deck, DeckOverlay, GeoJsonLayer};

var _deckOverlay = null;
var _deckLayerInstances = {};

function hexToRgba(hex, alpha) {
  if (!hex) return [0, 0, 0, Math.round(alpha * 255)];
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
  return [parseInt(hex.substr(0,2),16), parseInt(hex.substr(2,2),16), parseInt(hex.substr(4,2),16), Math.round(alpha * 255)];
}

function layerUsesDeck(layer) {
  if (!layer.visible) return false;
  return !layerHasPoints(layer);
}

function buildDeckLayer(layerObj) {
  var features = layerObj.geojson.features || (layerObj.geojson.type === 'Feature' ? [layerObj.geojson] : []);
  if (!features.length) return null;
  var selSet = selectedFeatures[layerObj.id];
  var layerOpacity = layerObj.opacity ?? 0.4;

  var id = 'deck-' + layerObj.id;
  var prev = _deckLayerInstances[id];
  if (prev) prev.finalize();

  var lyr = new GeoJsonLayer({
    id: id,
    data: {type: 'FeatureCollection', features: features},
    pickable: true,
    filled: true,
    stroked: true,
    getFillColor: function(feature) {
      var idx = features.indexOf(feature);
      var isSelected = selSet && selSet.has(idx);
      var style = getFeatureStyle(layerObj, feature);
      var baseAlpha = isSelected ? 1 : (style.fillOpacity != null ? style.fillOpacity : layerOpacity);
      return hexToRgba(style.fillColor, baseAlpha);
    },
    getLineColor: function(feature) {
      var style = getFeatureStyle(layerObj, feature);
      var a = style.opacity != null ? style.opacity : layerOpacity;
      return hexToRgba(style.color, a);
    },
    getLineWidth: function(feature) {
      var style = getFeatureStyle(layerObj, feature);
      return style.weight || 1;
    },
    lineWidthMinPixels: 0.5,
    getPointRadius: 6,
    updateTriggers: {
      getFillColor: [layerObj.id, layerObj.color, layerObj.opacity, layerObj.weight, layerObj.strokeColor, layerObj.noFill, JSON.stringify(layerObj.categories), JSON.stringify(layerObj.categoryNoFill), JSON.stringify(layerObj.categoryStroke), selSet ? selSet.size : 0],
      getLineColor: [layerObj.id, layerObj.strokeColor, layerObj.weight, layerObj.opacity],
      getLineWidth: [layerObj.id, layerObj.weight]
    },
    onClick: function(info) {
      if (!info.object) return;
      var idx = features.indexOf(info.object);
      if (idx < 0) return;
      console.log('deck click', layerObj.name, 'popupEnabled:', layerObj.popupEnabled, 'coordinate:', info.coordinate);
      if (info.sourceEvent && info.sourceEvent.shiftKey) {
        toggleSelection(layerObj.id, idx);
      } else {
        selectOne(layerObj.id, idx);
      }
    }
  });
  _deckLayerInstances[id] = lyr;
  return lyr;
}

window.syncDeckLayers = function() {
  if (!_deckOverlay) return;
  var layers = [];
  for (var i = 0; i < layerStore.length; i++) {
    var l = layerStore[i];
    if (layerUsesDeck(l)) {
      var cfg = buildDeckLayer(l);
      if (cfg) layers.push(cfg);
    }
  }
  _deckOverlay.setProps({layers: layers});
};

window.initDeckOverlay = function() {
  if (_deckOverlay) return;
  _deckOverlay = new DeckOverlay({
    id: 'gis-deck-overlay',
    layers: [],
    interleaved: false
  });
  map.addLayer(_deckOverlay);
  window.syncDeckLayers();
};

window.initDeckOverlay();
