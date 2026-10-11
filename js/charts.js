// Petit graphique en courbes (SVG), sans bibliothèque.
// series : [{ name, color, values: [nombre|null, ...] }], valeurs en %.
export function lineChart(series, { height = 170, labels = [] } = {}) {
  const W = 340, H = height, L = 38, R = 10, T = 10, B = 24;
  const n = Math.max(0, ...series.map((s) => s.values.length));
  if (n < 2) return '<p class="muted small">La courbe apparaîtra après deux parties terminées.</p>';
  const x = (i) => L + (i * (W - L - R)) / (n - 1);
  const y = (v) => T + (1 - v / 100) * (H - T - B);

  let grid = '';
  for (const v of [0, 50, 100]) {
    grid += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="#dfe2ee" stroke-width="1" ${v === 50 ? 'stroke-dasharray="4 4"' : ''}/>`;
    grid += `<text x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${v} %</text>`;
  }
  const step = Math.ceil(n / 6);
  for (let i = 0; i < n; i += step) {
    grid += `<text x="${x(i)}" y="${H - 6}" text-anchor="middle">${labels[i] ?? i + 1}</text>`;
  }

  let paths = '';
  for (const s of series) {
    const pts = s.values.map((v, i) => (v == null ? null : [x(i), y(v)])).filter(Boolean);
    if (!pts.length) continue;
    const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('');
    paths += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`;
    const last = pts[pts.length - 1];
    paths += `<circle cx="${last[0]}" cy="${last[1]}" r="4" fill="${s.color}" stroke="#fff" stroke-width="2"/>`;
  }

  const legend = series.map((s) =>
    `<span style="display:inline-flex;align-items:center;gap:6px;margin-right:14px"><i style="width:14px;height:4px;border-radius:2px;background:${s.color};display:inline-block"></i>${s.name}</span>`).join('');

  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Évolution">${grid}${paths}</svg>
    <div class="small muted" style="margin-top:6px">${legend}</div>`;
}
