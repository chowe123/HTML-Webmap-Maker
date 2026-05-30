const BASEMAPS = {
  none: { type: 'none', url: '', attribution: '' },
  dark: { type: 'vector', url: 'https://tiles.openfreemap.org/styles/dark', attribution: 'OpenFreeMap &copy; OpenMapTiles Data from OpenStreetMap' },
  light: { type: 'vector', url: 'https://tiles.openfreemap.org/styles/positron', attribution: 'OpenFreeMap &copy; OpenMapTiles Data from OpenStreetMap' },
  streets: { type: 'vector', url: 'https://tiles.openfreemap.org/styles/liberty', attribution: 'OpenFreeMap &copy; OpenMapTiles Data from OpenStreetMap' },
  bright: { type: 'vector', url: 'https://tiles.openfreemap.org/styles/bright', attribution: 'OpenFreeMap &copy; OpenMapTiles Data from OpenStreetMap' },
  satellite: { type: 'raster', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attribution: '&copy; Esri, Maxar, Earthstar Geographics' }
};

const COLOR_RAMPS = {
  'white-red':       { name: 'White to Red',      stops: ['#ffffff', '#ef5350'] },
  'lightred-darkred':{ name: 'Light→Dark Red',    stops: ['#ffcdd2', '#e53935', '#b71c1c'] },
  'red-green':       { name: 'Red→Green',         stops: ['#d32f2f', '#f5f5f5', '#388e3c'] },
  'blue-red':        { name: 'Blue→Red',          stops: ['#1565c0', '#f5f5f5', '#c62828'] },
  'blue-green':      { name: 'Blue→Green',        stops: ['#1565c0', '#43a047'] },
  'yellow-orange-red':{ name:'Yellow→Orange→Red', stops: ['#fff9c4', '#ff9800', '#d32f2f'] },
  'lightblue-darkblue':{ name:'Light→Dark Blue',  stops: ['#bbdefb', '#1565c0'] },
  'green-blue-purple':{ name:'Green→Blue→Purple', stops: ['#66bb6a', '#42a5f5', '#7e57c2'] },
  'grey-black':      { name: 'Grey to Black',     stops: ['#bdbdbd', '#212121'] },
  'purple-orange':   { name: 'Purple→Orange',     stops: ['#7b1fa2', '#f5f5f5', '#e65100'] },
};

const SYMBOL_SHAPES = [
  { id: 'circle', label: 'Circle' }, { id: 'square', label: 'Square' }, { id: 'triangle', label: 'Triangle' },
  { id: 'diamond', label: 'Diamond' }, { id: 'pentagon', label: 'Pentagon' }, { id: 'hexagon', label: 'Hexagon' },
  { id: 'star', label: 'Star' }, { id: 'cross', label: 'Cross' }, { id: 'crosshair', label: 'Crosshair' },
  { id: 'pin', label: 'Pin' }, { id: 'arrow', label: 'Arrow' }, { id: 'teardrop', label: 'Teardrop' },
  { id: 'ring', label: 'Ring' }, { id: 'custom', label: 'Custom Image' },
];

const PROJECT_VERSION = 1;
