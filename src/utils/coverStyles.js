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
}
