// Shared cover-style definitions used in both the modal preview and pdf.js
// Each blob: { cx, cy, r } — fractions of canvas width/height
// color: 'c1' | 'c2' | 'mix'
// alpha: peak opacity at center

export const COVER_STYLES = {
  corners: {
    label: 'Esquinas',
    blobs: [
      { cx: 0.18, cy: 0.28, r: 0.55, color: 'c1',  alpha: 0.55 },
      { cx: 0.82, cy: 0.78, r: 0.50, color: 'c2',  alpha: 0.45 },
      { cx: 0.50, cy: 0.50, r: 0.35, color: 'mix', alpha: 0.10 },
    ],
  },
  aurora: {
    label: 'Aurora',
    blobs: [
      { cx: 0.10, cy: 0.50, r: 0.48, color: 'c1',  alpha: 0.50 },
      { cx: 0.50, cy: 0.44, r: 0.40, color: 'mix', alpha: 0.42 },
      { cx: 0.90, cy: 0.52, r: 0.48, color: 'c2',  alpha: 0.45 },
    ],
  },
  vortex: {
    label: 'Vórtice',
    blobs: [
      { cx: 0.08, cy: 0.10, r: 0.52, color: 'c1',  alpha: 0.42 },
      { cx: 0.92, cy: 0.10, r: 0.52, color: 'c2',  alpha: 0.38 },
      { cx: 0.08, cy: 0.90, r: 0.52, color: 'c2',  alpha: 0.35 },
      { cx: 0.92, cy: 0.90, r: 0.52, color: 'c1',  alpha: 0.42 },
      { cx: 0.50, cy: 0.50, r: 0.28, color: 'mix', alpha: 0.18 },
    ],
  },
  sweep: {
    label: 'Sweep',
    blobs: [
      { cx: -0.05, cy: 1.05, r: 0.85, color: 'c1',  alpha: 0.60 },
      { cx:  1.05, cy: -0.05, r: 0.80, color: 'c2', alpha: 0.55 },
      { cx:  0.50, cy:  0.50, r: 0.30, color: 'mix', alpha: 0.08 },
    ],
  },
  bloom: {
    label: 'Bloom',
    blobs: [
      { cx: 0.50, cy: 0.05, r: 0.68, color: 'c1',  alpha: 0.48 },
      { cx: 0.50, cy: 0.15, r: 0.42, color: 'mix', alpha: 0.30 },
      { cx: 0.50, cy: 1.00, r: 0.45, color: 'c2',  alpha: 0.22 },
    ],
  },
  spotlight: {
    label: 'Spotlight',
    blobs: [
      { cx: 0.14, cy: 0.10, r: 0.42, color: 'c1',  alpha: 0.65 },
      { cx: 0.24, cy: 0.20, r: 0.28, color: 'c2',  alpha: 0.45 },
    ],
  },
  mesh: {
    label: 'Mesh',
    blobs: [
      { cx: 0.12, cy: 0.15, r: 0.32, color: 'c1',  alpha: 0.45 },
      { cx: 0.55, cy: 0.05, r: 0.30, color: 'mix', alpha: 0.35 },
      { cx: 0.88, cy: 0.30, r: 0.34, color: 'c2',  alpha: 0.40 },
      { cx: 0.20, cy: 0.85, r: 0.30, color: 'c2',  alpha: 0.30 },
      { cx: 0.80, cy: 0.90, r: 0.32, color: 'c1',  alpha: 0.30 },
    ],
  },
}
