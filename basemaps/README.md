# Peel street basemap

`Peel-StreetMap-z15.mbtiles` — Esri World Street Map clipped to the Region of Peel, zooms 0-15 (70.9 MB).
Stored as `Peel-StreetMap-z15.mbtiles.part00` … `part04` because of GitHub API upload limits.
Reassemble with:

```
cat basemaps/Peel-StreetMap-z15.mbtiles.part* > Peel-StreetMap-z15.mbtiles
```

or run `reassemble-basemap.sh`. Then load it in the maker via **Local MBTiles basemap**.

Attribution: Esri, HERE, Garmin, OpenStreetMap contributors.
