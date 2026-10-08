#!/bin/bash
# Reassemble Peel-StreetMap-z15.mbtiles from its parts:
#   cat basemaps/Peel-StreetMap-z15.mbtiles.part* > Peel-StreetMap-z15.mbtiles
set -e
cd "$(dirname "$0")/basemaps"
cat Peel-StreetMap-z15.mbtiles.part* > Peel-StreetMap-z15.mbtiles
sha256sum Peel-StreetMap-z15.mbtiles
