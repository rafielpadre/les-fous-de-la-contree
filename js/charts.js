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

// =====================================================================
//  Graphique multi-joueurs (écran Graphiques)
//  model = { series: [{ id, name, color, values: (n|null)[], played: bool[] }],
//            heads: string[] (titre de chaque point), ticks: string[] (étiquette courte),
//            pct: bool, fmt: (n) => string }
// =====================================================================
const MW = 360, MH = 230, ML = 40, MT = 14, MB = 30;

function niceScale(lo, hi, count = 4) {
  if (lo === hi) { lo = lo - 1; hi = hi + 1; }
  const raw = (hi - lo) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw);
  const min = Math.floor(lo / step) * step;
  const max = Math.ceil(hi / step) * step;
  const ticks = [];
  for (let v = min; v <= max + step / 2; v += step) ticks.push(Math.round(v * 100) / 100);
  return { min, max, ticks };
}

function geometry(model) {
  const n = model.heads.length;
  const labelled = model.series.length <= 4;            // étiquettes en bout de courbe
  const MR = labelled ? 70 : 14;
  const all = model.series.flatMap((s) => s.values.filter((v) => v != null));
  let sc;
  if (model.pct) sc = { min: 0, max: 100, ticks: [0, 25, 50, 75, 100] };
  else if (!all.length) sc = { min: 0, max: 1, ticks: [0, 1] };
  else {
    const lo = model.zeroBase ? 0 : Math.min(...all);
    sc = niceScale(lo, Math.max(...all));
  }
  const x = (i) => ML + (n <= 1 ? (MW - ML - MR) / 2 : (i * (MW - ML - MR)) / (n - 1));
  const y = (v) => MT + (1 - (v - sc.min) / (sc.max - sc.min || 1)) * (MH - MT - MB);
  return { n, MR, sc, x, y, labelled };
}

export function multiLineChart(model) {
  const g = geometry(model);
  const { n, sc, x, y } = g;
  if (!n) return '<p class="muted">Aucune partie terminée pour l\'instant : les courbes apparaîtront après la première.</p>';
  if (!model.series.length) return '<p class="muted">Choisissez au moins un joueur.</p>';

  let svg = '';
  // Grille horizontale + axe Y
  for (const t of sc.ticks) {
    svg += `<line x1="${ML}" x2="${MW - g.MR}" y1="${y(t)}" y2="${y(t)}" class="grid"/>`;
    svg += `<text x="${ML - 6}" y="${y(t) + 4}" text-anchor="end" class="ax">${model.fmt(t)}</text>`;
  }
  // Axe X : quelques repères
  const step = Math.max(1, Math.ceil(n / 5));
  for (let i = 0; i < n; i += step) {
    svg += `<text x="${x(i)}" y="${MH - 8}" text-anchor="middle" class="ax">${model.ticks[i]}</text>`;
  }
  // Courbes : un point par partie jouée par le joueur, reliés entre eux
  const ends = [];
  for (const s of model.series) {
    const pts = [];
    s.values.forEach((v, i) => { if (v != null && s.played[i]) pts.push([x(i), y(v), i]); });
    if (!pts.length) continue;
    const d = pts.map((p, k) => `${k ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('');
    svg += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
    const showAll = n <= 16;
    for (const [k, p] of pts.entries()) {
      if (!showAll && k !== pts.length - 1) continue;
      svg += `<circle cx="${p[0]}" cy="${p[1]}" r="4" fill="${s.color}" stroke="var(--card)" stroke-width="2"/>`;
    }
    const last = pts[pts.length - 1];
    ends.push({ y: last[1], x: last[0], name: s.name, color: s.color });
  }
  // Étiquettes directes en bout de courbe (≤ 4 joueurs), écartées pour ne pas se chevaucher
  if (g.labelled) {
    ends.sort((a, b) => a.y - b.y);
    for (let i = 1; i < ends.length; i++) ends[i].y = Math.max(ends[i].y, ends[i - 1].y + 14);
    for (const e of ends) {
      svg += `<text x="${MW - g.MR + 8}" y="${e.y + 4}" class="lbl">${escTxt(e.name.length > 9 ? `${e.name.slice(0, 8)}…` : e.name)}</text>`;
    }
  }
  svg += `<line class="xhair" x1="0" x2="0" y1="${MT}" y2="${MH - MB}" visibility="hidden"/>`;
  svg += `<g class="xdots"></g>`;
  svg += `<rect class="hit" x="${ML - 10}" y="0" width="${MW - ML - g.MR + 20}" height="${MH}" fill="transparent"/>`;

  const legend = model.series.map((s) =>
    `<span class="lg"><i style="background:${s.color}"></i>${escTxt(s.name)}</span>`).join('');

  return `<div class="mchart">
    <svg viewBox="0 0 ${MW} ${MH}" role="img" tabindex="0" aria-label="${escTxt(model.title)}">${svg}</svg>
    <div class="tip" hidden></div>
  </div>
  <div class="legend">${legend}</div>`;
}

/** Réticule + infobulle : on touche ou survole le graphique, on lit toutes les valeurs. */
export function bindMultiLine(root, model) {
  const svg = root.querySelector('.mchart svg');
  if (!svg) return;
  const g = geometry(model);
  const tip = root.querySelector('.tip');
  const xh = svg.querySelector('.xhair');
  const dots = svg.querySelector('.xdots');
  let cur = -1;

  const show = (i) => {
    cur = Math.max(0, Math.min(g.n - 1, i));
    const X = g.x(cur);
    xh.setAttribute('x1', X); xh.setAttribute('x2', X); xh.setAttribute('visibility', 'visible');
    dots.innerHTML = '';
    tip.replaceChildren();
    const h = document.createElement('div');
    h.className = 'tip-h';
    h.textContent = model.heads[cur];
    tip.appendChild(h);
    const rows = model.series
      .map((s) => ({ s, v: s.values[cur] }))
      .sort((a, b) => (b.v ?? -Infinity) - (a.v ?? -Infinity));
    for (const { s, v } of rows) {
      if (v != null) {
        const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        c.setAttribute('cx', X); c.setAttribute('cy', g.y(v)); c.setAttribute('r', 4.5);
        c.setAttribute('fill', s.color); c.setAttribute('stroke', 'var(--card)'); c.setAttribute('stroke-width', 2);
        dots.appendChild(c);
      }
      const row = document.createElement('div');
      row.className = 'tip-r';
      const key = document.createElement('i'); key.style.background = s.color;
      const val = document.createElement('b'); val.textContent = v == null ? '–' : model.fmt(v);
      const nm = document.createElement('span');
      nm.textContent = s.name + (s.played[cur] || v == null ? '' : ' (absent)');
      row.append(key, val, nm);
      tip.appendChild(row);
    }
    tip.hidden = false;
    const box = root.querySelector('.mchart').getBoundingClientRect();
    const px = (X / MW) * box.width;
    const left = px > box.width / 2 ? px - tip.offsetWidth - 12 : px + 12;
    tip.style.left = `${Math.max(0, left)}px`;
  };
  const hide = () => { cur = -1; xh.setAttribute('visibility', 'hidden'); dots.innerHTML = ''; tip.hidden = true; };
  const fromEvent = (ev) => {
    const r = svg.getBoundingClientRect();
    const vx = ((ev.clientX - r.left) / r.width) * MW;
    let best = 0, bd = Infinity;
    for (let i = 0; i < g.n; i++) { const d = Math.abs(g.x(i) - vx); if (d < bd) { bd = d; best = i; } }
    return best;
  };
  svg.addEventListener('pointermove', (ev) => show(fromEvent(ev)));
  svg.addEventListener('pointerdown', (ev) => show(fromEvent(ev)));
  svg.addEventListener('pointerleave', (ev) => { if (ev.pointerType === 'mouse') hide(); });
  svg.addEventListener('keydown', (ev) => {
    if (ev.key === 'ArrowRight') { show(cur < 0 ? 0 : cur + 1); ev.preventDefault(); }
    if (ev.key === 'ArrowLeft') { show(cur < 0 ? g.n - 1 : cur - 1); ev.preventDefault(); }
    if (ev.key === 'Escape') hide();
  });
  svg.addEventListener('blur', hide);
}

function escTxt(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
