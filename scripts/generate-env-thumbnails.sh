#!/bin/bash
# Generate placeholder SVG thumbnails for environment presets, then convert to JPG.

set -euo pipefail

OUT_DIR="/Users/fumisan/projects/sns_sumple/public/environments"
mkdir -p "$OUT_DIR"

# ---------- preset definitions ----------
# Format: "name skyColor groundColor [extra]"
PRESETS=(
  "default #87CEEB #228B22"
  "forest #2d5016 #1a3a0a"
  "japan #FFB7C5 #2E8B57"
  "dream #E0B0FF #8B00FF"
  "starry #0c1445 #1a0533 stars"
  "tron #000000 #00FFFF"
  "egypt #F4A460 #DEB887"
  "volcano #8B0000 #FF4500"
  "arches #CD853F #8B4513"
  "osiris #2F4F4F #008080"
  "threetowers #4682B4 #2F4F4F"
  "poison #556B2F #9ACD32"
  "goldmine #DAA520 #B8860B"
  "goaland #87CEEB #90EE90"
  "yavapai #E2725B #CC5500"
  "checkerboard #333333 #CCCCCC"
  "contact #191970 #4B0082"
)

# ---------- helper: darken a hex colour by ~30% ----------
darken() {
  local hex="${1#\#}"
  local r=$((16#${hex:0:2}))
  local g=$((16#${hex:2:2}))
  local b=$((16#${hex:4:2}))
  r=$(( r * 70 / 100 ))
  g=$(( g * 70 / 100 ))
  b=$(( b * 70 / 100 ))
  printf "#%02x%02x%02x" "$r" "$g" "$b"
}

# ---------- helper: pick a readable text colour ----------
text_color() {
  local hex="${1#\#}"
  local r=$((16#${hex:0:2}))
  local g=$((16#${hex:2:2}))
  local b=$((16#${hex:4:2}))
  local lum=$(( (r * 299 + g * 587 + b * 114) / 1000 ))
  if (( lum > 140 )); then
    echo "#222222"
  else
    echo "#f0f0f0"
  fi
}

# ---------- generate SVGs ----------
for entry in "${PRESETS[@]}"; do
  read -r name sky ground extra <<< "$entry"

  silhouette=$(darken "$ground")
  txt=$(text_color "$sky")

  # Vary the mountain silhouette path per preset
  case "$name" in
    default)      path="M0,260 Q75,200 150,240 T300,220 T450,200 T600,250 L600,400 L0,400 Z" ;;
    forest)       path="M0,250 L80,210 L140,240 L200,190 L260,230 L340,200 L400,220 L480,180 L540,210 L600,240 L600,400 L0,400 Z" ;;
    japan)        path="M0,280 Q150,160 300,200 Q350,140 400,200 Q500,240 600,260 L600,400 L0,400 Z" ;;
    dream)        path="M0,270 C100,220 200,300 300,240 C400,180 500,280 600,250 L600,400 L0,400 Z" ;;
    starry)       path="M0,280 L100,260 L200,240 L300,260 L400,250 L500,270 L600,260 L600,400 L0,400 Z" ;;
    tron)         path="M0,300 L100,300 L150,260 L200,260 L250,300 L400,300 L450,270 L500,270 L550,300 L600,300 L600,400 L0,400 Z" ;;
    egypt)        path="M0,300 L150,300 L250,200 L350,300 L420,300 L470,240 L520,300 L600,300 L600,400 L0,400 Z" ;;
    volcano)      path="M0,300 L150,280 L250,180 L280,200 L290,190 L320,200 L350,180 L450,280 L600,300 L600,400 L0,400 Z" ;;
    arches)       path="M0,280 L100,260 Q200,200 300,260 L350,260 Q400,180 500,260 L600,270 L600,400 L0,400 Z" ;;
    osiris)       path="M0,270 L80,250 L160,270 L240,230 L320,260 L400,240 L480,260 L560,250 L600,270 L600,400 L0,400 Z" ;;
    threetowers)  path="M0,290 L120,290 L140,200 L160,200 L180,290 L270,290 L290,180 L310,180 L330,290 L420,290 L440,210 L460,210 L480,290 L600,290 L600,400 L0,400 Z" ;;
    poison)       path="M0,260 C50,250 100,270 150,250 C200,230 250,260 300,240 C350,220 400,250 450,240 C500,230 550,260 600,250 L600,400 L0,400 Z" ;;
    goldmine)     path="M0,280 L60,270 L120,250 L180,270 L200,240 L230,260 L300,230 L370,260 L440,250 L500,270 L560,260 L600,280 L600,400 L0,400 Z" ;;
    goaland)      path="M0,270 C100,260 200,280 300,260 C400,240 500,270 600,260 L600,400 L0,400 Z" ;;
    yavapai)      path="M0,270 L80,250 L160,220 L220,260 L300,200 L380,240 L460,210 L540,250 L600,270 L600,400 L0,400 Z" ;;
    checkerboard) path="M0,280 L150,280 L200,250 L250,280 L400,280 L450,250 L500,280 L600,280 L600,400 L0,400 Z" ;;
    contact)      path="M0,290 L100,280 L200,270 L300,280 L400,270 L500,280 L600,290 L600,400 L0,400 Z" ;;
    *)            path="M0,260 L150,230 L300,250 L450,220 L600,260 L600,400 L0,400 Z" ;;
  esac

  # Optional stars layer for the starry preset
  stars_layer=""
  if [[ "${extra:-}" == "stars" ]]; then
    stars_layer='
    <circle cx="50"  cy="40"  r="2" fill="white" opacity="0.9"/>
    <circle cx="120" cy="80"  r="1.5" fill="white" opacity="0.7"/>
    <circle cx="200" cy="30"  r="2.5" fill="white" opacity="0.8"/>
    <circle cx="280" cy="100" r="1.5" fill="white" opacity="0.6"/>
    <circle cx="350" cy="50"  r="2" fill="white" opacity="0.9"/>
    <circle cx="420" cy="120" r="1.5" fill="white" opacity="0.7"/>
    <circle cx="500" cy="35"  r="2" fill="white" opacity="0.85"/>
    <circle cx="560" cy="90"  r="1.5" fill="white" opacity="0.75"/>
    <circle cx="80"  cy="150" r="1.5" fill="white" opacity="0.65"/>
    <circle cx="170" cy="130" r="2" fill="white" opacity="0.8"/>
    <circle cx="310" cy="160" r="1.5" fill="white" opacity="0.7"/>
    <circle cx="450" cy="70"  r="2" fill="white" opacity="0.9"/>
    <circle cx="530" cy="150" r="1.5" fill="white" opacity="0.6"/>
    <circle cx="30"  cy="110" r="1" fill="white" opacity="0.5"/>
    <circle cx="250" cy="60"  r="1" fill="white" opacity="0.55"/>
    <circle cx="480" cy="170" r="1" fill="white" opacity="0.5"/>
    <circle cx="150" cy="190" r="1.5" fill="white" opacity="0.6"/>
    <circle cx="380" cy="25"  r="1" fill="white" opacity="0.7"/>'
  fi

  # Build and write the SVG
  cat > "$OUT_DIR/${name}.svg" <<SVGEOF
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="${sky}"/>
      <stop offset="100%" stop-color="${ground}"/>
    </linearGradient>
  </defs>
  <!-- sky-to-ground gradient -->
  <rect width="600" height="400" fill="url(#bg)"/>
  <!-- terrain silhouette -->
  <path d="${path}" fill="${silhouette}" opacity="0.85"/>
  ${stars_layer}
  <!-- preset label -->
  <text x="300" y="380" text-anchor="middle" font-family="Helvetica,Arial,sans-serif"
        font-size="20" font-weight="bold" fill="${txt}" opacity="0.8">${name}</text>
</svg>
SVGEOF

  echo "Created SVG: ${name}.svg"
done

echo ""
echo "--- Converting SVGs to JPGs with sips ---"
for entry in "${PRESETS[@]}"; do
  read -r name _ _ _ <<< "$entry"
  svg_file="$OUT_DIR/${name}.svg"
  jpg_file="$OUT_DIR/${name}.jpg"

  # sips on macOS can convert SVG -> JPEG
  sips -s format jpeg -z 400 600 "$svg_file" --out "$jpg_file" 2>&1
  echo "Converted: ${name}.svg -> ${name}.jpg"
done

echo ""
echo "--- Cleaning up SVG files ---"
for entry in "${PRESETS[@]}"; do
  read -r name _ _ _ <<< "$entry"
  rm -f "$OUT_DIR/${name}.svg"
done

echo ""
echo "Done. JPG thumbnails are in $OUT_DIR"
ls -lh "$OUT_DIR"/*.jpg
