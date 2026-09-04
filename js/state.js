let layerStore = [];
let layerCounter = 0;
let tableStore = [];
let tableCounter = 0;
let directoryConfig = null;
let projectTitle = '';
let dataNote = '';

let searchMarker = null;
let debounceTimer = null;
let searchMode = 'pin';

var selectedFeatures = {};

var _attrTableLayer = null;
var _attrTableFilterMode = 'all';

const styleRefreshRaf = new Map();

let currentBasemap = 'none';
let tileLayer = null;
