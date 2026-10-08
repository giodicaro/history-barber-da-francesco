// Builds every app icon from one SVG design (gold scissors on dark):
//   icons/icon.svg            source, also used as the SVG favicon
//   icons/icon-192.png        manifest, purpose "any"
//   icons/icon-512.png        manifest, purpose "any"
//   icons/maskable-512.png    manifest, purpose "maskable" (mark inside the 40% safe-zone radius)
//   icons/apple-touch-icon.png 180×180, iOS Home screen
//   icons/favicon-32.png      PNG favicon fallback
//   icons/badge-72.png        monochrome notification badge (Android status bar)
// Usage: npm run icons

import sharp from "sharp";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const out = fileURLToPath(new URL("../public/icons/", import.meta.url));
mkdirSync(out, { recursive: true });

const BG = "#121212";

// One scissor arm: blade above the pivot, shank and finger ring below.
// The pivot is at (256, 256); `angle` tilts the arm around it.
const arm = (angle, fill, stroke) => `
  <g transform="rotate(${angle} 256 256)">
    <path d="M244 268 C247 196 251 128 257 82 C265 128 269 196 270 268 Z" fill="${fill}"/>
    <path d="M249 262 L249 360 L263 360 L263 262 Z" fill="${fill}"/>
    <circle cx="256" cy="396" r="30" fill="none" stroke="${stroke}" stroke-width="13"/>
  </g>`;

// The full mark, centred on the canvas (its bounding box is about 300 px tall).
const mark = (fill, stroke, screw) => `
  <g transform="translate(0 -10)">
    ${arm(-21, fill, stroke)}
    ${arm(21, fill, stroke)}
    <circle cx="256" cy="256" r="11" fill="${screw}" stroke="${stroke}" stroke-width="5"/>
  </g>`;

const defs = `
  <defs>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#F0D58A"/>
      <stop offset="0.55" stop-color="#D4AF37"/>
      <stop offset="1" stop-color="#A67C1E"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.42" r="0.65">
      <stop offset="0" stop-color="#262019"/>
      <stop offset="1" stop-color="${BG}"/>
    </radialGradient>
  </defs>`;

// "any": vintage badge, double gold ring around the scissors.
const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${defs}
  <rect width="512" height="512" fill="url(#glow)"/>
  <circle cx="256" cy="256" r="226" fill="none" stroke="url(#gold)" stroke-width="7"/>
  <circle cx="256" cy="256" r="210" fill="none" stroke="url(#gold)" stroke-width="2" opacity="0.7"/>
  <g transform="translate(256 256) scale(0.86) translate(-256 -256)">${mark("url(#gold)", "url(#gold)", BG)}</g>
</svg>`;

// "maskable": full-bleed background, mark scaled into the safe zone (a circle
// of radius 0.4 × size): launchers may crop the icon to any shape.
const maskableSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${defs}
  <rect width="512" height="512" fill="url(#glow)"/>
  <g transform="translate(256 256) scale(0.9) translate(-256 -256)">${mark("url(#gold)", "url(#gold)", BG)}</g>
</svg>`;

// Badge: Android uses only the alpha channel, so white on transparent.
const badgeSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <g transform="translate(256 256) scale(1.2) translate(-256 -256)">${mark("#fff", "#fff", "#fff")}</g>
</svg>`;

const png = (svg, size, file) =>
  sharp(Buffer.from(svg), { density: 384 }).resize(size, size).png({ compressionLevel: 9 }).toFile(out + file);

writeFileSync(out + "icon.svg", iconSvg.replace(/\n\s*/g, " "));
await Promise.all([
  png(iconSvg, 192, "icon-192.png"),
  png(iconSvg, 512, "icon-512.png"),
  png(maskableSvg, 512, "maskable-512.png"),
  png(iconSvg, 180, "apple-touch-icon.png"),
  png(iconSvg, 32, "favicon-32.png"),
  png(badgeSvg, 72, "badge-72.png"),
]);
console.log("Icons written to public/icons/");
