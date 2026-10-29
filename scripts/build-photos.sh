#!/usr/bin/env bash
# Rebuild web-sized photos from originals/ (gitignored) into static/img/,
# and write data/photos.yaml for the gallery. Byte-identical duplicates are skipped.
set -euo pipefail
cd "$(dirname "$0")/.."

HERO=91ea34fe-527e-443f-bbfa-db38b388e50a.jpeg
web() { convert "$1" -auto-orient -resize "$2x$2>" -strip -interlace Plane -quality "$3" "$4"; }

rm -rf static/img && mkdir -p static/img/gallery
web "originals/$HERO" 2400 78 static/img/hero-2400.jpg
web "originals/$HERO" 1280 78 static/img/hero-1280.jpg

echo "photos:" > data/photos.yaml
declare -A seen
n=0
for f in originals/*.jpeg; do
  sum=$(md5sum "$f" | cut -d' ' -f1)
  [[ -n "${seen[$sum]:-}" ]] && continue
  seen[$sum]=1
  n=$((n + 1))
  id=$(printf '%02d' "$n")
  web "$f" 1800 80 "static/img/gallery/$id.jpg"
  web "$f" 640 75 "static/img/gallery/$id-sm.jpg"
  read -r w h < <(identify -format '%w %h\n' "static/img/gallery/$id-sm.jpg")
  echo "  - {src: \"img/gallery/$id.jpg\", thumb: \"img/gallery/$id-sm.jpg\", w: $w, h: $h}" >> data/photos.yaml
done
echo "$n photos"
