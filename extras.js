/* Ampliaciones: catálogo editable, escenarios, partidas automáticas, totales y PDF.
   Se carga antes de app.js; usa sus globales (p, save, render, $, fmt, money, num, attr) solo dentro de funciones. */
const CAT_KEY = 'trebol-solar-catalog-v1';
function getCatalog() { try { const c = JSON.parse(localStorage.getItem(CAT_KEY)); if (Array.isArray(c) && c.length) return c; } catch {} return SolarMath.factoryCatalog(); }
function saveCatalog(c) { try { localStorage.setItem(CAT_KEY, JSON.stringify(c)); } catch {} }
function migrate() {
  const d = defaults();
  Object.values(projects.items).forEach(x => {
    Object.keys(d).forEach(k => { if (!(k in x) && k !== 'materials') x[k] = d[k]; });
    // Merge legacy fields only once; an intentionally cleared field stays empty.
    if (!Object.prototype.hasOwnProperty.call(x, 'pdfText')) {
      x.pdfText = [x.pdfNotes, x.pdfConditions, x.pdfScope]
        .filter(text => typeof text === 'string' && text.trim()).join('\n\n');
    }
    x.materials = (x.materials || []).map(m => ({ id: crypto.randomUUID(), on: true, ...m, rule: m.rule || 'manual', manual: m.rule ? !!m.manual : true }));
  });
  save();
}
const slug = () => (p().name || 'cotizacion').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w]+/g, '-').toLowerCase().replace(/^-|-$/g, '') || 'cotizacion';
const nf = (v, d = 2) => Number.isFinite(v) ? v.toLocaleString('es-MX', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—';
const pc = v => nf(v * 100, 1) + ' %';

function renderCalc(x, c) {
  const bad = SolarMath.validate(x);
  $$('[data-field]').forEach(el => el.classList.toggle('bad', bad.includes(el.dataset.field)));
  const items = [['Consumo anual actual', `${nf(c.annual, 0)} kWh/año`], [`Meta con +${nf(num(x.growthPct), 0)}%`, `${nf(c.future, 0)} kWh/año`],
    ['Potencia DC objetivo', `${nf(c.kwp, 3)} kWp`], ['Paneles mínimos', `${c.n} × ${nf(num(x.panelW), 0)} W`],
    [`Escenario · ${c.scenario} paneles`, `${nf(c.scenarioKwp, 2)} kWp`], ['Generación diaria / anual', `${nf(c.gen / 365)} kWh · ${nf(c.gen, 0)} kWh`],
    ['Cobertura vs. meta / vs. actual', `${pc(c.coverage)} / ${pc(c.coverageNow)}`], ['Área de azotea (módulos + holgura)', `${nf(c.roofArea, 1)} m²`],
    ['Inversor elegido · DC/AC real', `${nf(c.inverterKw, 1)} kW · ${nf(c.dcacActual, 2)}`], [`Inversor para DC/AC ${nf(num(x.dcac, 1), 2)}`, `${nf(c.dcac, 2)} kW`],
    ['Ruta de cable por cadena', `${c.cable} m (azotea +${nf(num(x.roofHeight), 1)} m)`]];
  $('#calcDetails').innerHTML = items.map(a => `<div class="calc-item"><span>${a[0]}</span><strong>${a[1]}</strong></div>`).join('');
  const w = [...c.warn]; if (c.scenario < c.n) w.push(`Con ${c.scenario} paneles no se cubre la meta proyectada (mínimo ${c.n}).`);
  if (bad.length) w.unshift('Revisa los campos marcados en rojo: deben ser mayores que cero.');
  $('#calcWarn').innerHTML = w.map(t => `<p class="warn">${t}</p>`).join('');
  $('#formulaText').innerHTML = `Consumo anual = ${nf(num(x.billKwh), 0)} kWh ÷ ${nf(num(x.periodDays), 0)} d × 365 = ${nf(c.annual, 1)} kWh/año.<br>
  Meta = ${nf(c.annual, 1)} × (1 + ${nf(num(x.growthPct), 0)}%) = ${nf(c.future, 1)} kWh/año.<br>
  Potencia objetivo = ${nf(c.future, 1)} ÷ (${nf(num(x.yield), 2)} × 365) = ${nf(c.kwp, 3)} kWp.<br>
  Paneles mínimos = techo(${nf(c.kwp * 1000, 0)} W ÷ ${nf(num(x.panelW), 0)} W) = techo(${nf(c.kwp * 1000 / num(x.panelW, 1), 2)}) = ${c.n}.<br>
  Generación = ${c.scenario} × ${nf(num(x.panelW), 0)} W ÷ 1,000 × ${nf(num(x.yield), 2)} × 365 = ${nf(c.gen, 0)} kWh/año.<br>
  Área = ${c.scenario} × ${nf(num(x.panelArea), 2)} m² × (1 + ${nf(num(x.clearancePct), 0)}%) = ${nf(c.roofArea, 1)} m².<br>
  DC/AC real = ${nf(c.scenarioKwp, 2)} kWp ÷ ${nf(c.inverterKw, 1)} kW = ${nf(c.dcacActual, 2)}.<br>
  Cable por cadena = 2 × (${nf(num(x.roofHeight), 1)} + ${nf(num(x.cableExtra), 0)}) m × (1 + ${nf(num(x.slackPct, 20), 0)}% de reserva) = ${c.cable} m.<br>
  Cable CC total = cable por cadena × ${nf(num(x.strings, 2), 0)} cadenas. Cable CA = ${nf(num(x.runAC), 0)} m × reserva × 3 conductores. Canalización = azotea + ruta CC + ruta CA, con reserva.<br>
  El rendimiento específico resume pérdidas; no es una simulación del sitio. La cobertura es energía anual indicativa: no predice cargos, excedentes ni ahorro en el recibo CFE. Valida strings, voltajes, conductores, protecciones, estructura e interconexión con fichas técnicas y un profesional.`;
}
// Costo capturado por escenario (por número de paneles); vacío = calculado.
function manualScenarioCost(x, count) { return num((x.scenarioCosts || {})[count]); }
function finalPrice(x) {
  const manual = num(x.finalPrice);
  if (manual > 0) return manual;
  const sel = manualScenarioCost(x, num(x.scenarioPanels));
  return sel > 0 ? sel : SolarMath.boq(x).total;
}
function scenarioCost(x, count) {
  const manual = manualScenarioCost(x, count);
  if (manual > 0) return manual;
  return num(count) === num(x.scenarioPanels) ? finalPrice(x) : SolarMath.boq(x, count).total;
}
function renderTotals(x) {
  const b = SolarMath.boq(x);
  const fp = $('#finalPrice'), manual = num(x.finalPrice) > 0;
  fp.placeholder = String(Math.round(finalPrice(x)));
  if (!manual && document.activeElement !== fp) fp.value = '';
  $('#finalPriceHint').textContent = manual
    ? `El PDF mostrará ${money(x.finalPrice)} como costo final (total estimado: ${money(b.total)}).`
    : `Vacío: el PDF usa el costo del escenario seleccionado (${num(x.scenarioPanels)} paneles), ${money(finalPrice(x))}. Escribe otra cantidad para cambiarlo.`;
  $('#finalPriceHint').textContent += x.ivaOn ? ` En el PDF dirá "IVA incluido (${fmt(num(x.ivaPct, 16), 0)}%)".` : ' En el PDF dirá "No incluye IVA".';
  $('#finalPriceReset').hidden = !manual;
  $('#contOn').checked = x.contingencyOn !== false; $('#ivaOn').checked = !!x.ivaOn;
  $('#totals').innerHTML = `Subtotal materiales: ${money(b.subtotal)}<br>${x.contingencyOn !== false ? `Contingencia (${fmt(num(x.contingencyPct), 0)}%): ${money(b.contingency)}<br>` : ''}${x.ivaOn ? `IVA (${fmt(num(x.ivaPct, 16), 0)}%): ${money(b.iva)}<br>` : ''}<strong>Total estimado: ${money(b.total)}</strong>`;
  $('#provNote').innerHTML = `<span class="flag">${b.provisional} de ${b.count} precios provisionales</span> Son referencias editables, no precios de mercado vigentes ni cotizaciones. Marca "Verificado" solo con fuente (URL) y fecha de revisión.`;
}
function renderMaterialRows(x) {
  const b = SolarMath.boq(x);
  $('#materialsBody').innerHTML = b.lines.map((m, i) => `<tr><td><input class="name-input" data-mi="${i}" data-m="name" value="${attr(m.name)}"></td>
  <td><input class="qty-input" type="number" min="0" step="any" data-mi="${i}" data-m="qty" value="${m.qty}">${m.rule !== 'manual' ? `<small class="auto">${m.manual ? `<a href="#" data-auto="${i}">volver a automática</a>` : 'automática'}</small>` : ''}</td>
  <td><input class="unit-input" data-mi="${i}" data-m="unit" value="${attr(m.unit)}"></td><td><input class="price-input" type="number" min="0" step=".01" data-mi="${i}" data-m="price" value="${m.price}"></td><td>${money(m.amount)}</td>
  <td><select data-mi="${i}" data-m="status"><option ${m.status !== 'Verificado' ? 'selected' : ''}>Referencia editable</option><option ${m.status === 'Verificado' ? 'selected' : ''}>Verificado</option></select>
  <input class="source-input" data-mi="${i}" data-m="url" placeholder="URL de proveedor" value="${attr(m.url)}"><input type="date" data-mi="${i}" data-m="checked" value="${attr(m.checked)}" title="Última revisión"></td>
  <td><button class="remove-line" data-remove="${i}" title="Eliminar partida">×</button></td></tr>`).join('');
}
function renderScenarios(x) {
  const c = SolarMath.calculate(x);
  $('#scenarioBody').innerHTML = (x.scenarios || []).map((n, i) => { const s = SolarMath.scenarioStats(x, n), b = SolarMath.boq(x, n);
    return `<tr class="${n === num(x.scenarioPanels) ? 'sel' : ''}"><td><input class="qty-input" type="number" min="1" step="1" data-sc="${i}" value="${n}"></td><td>${nf(s.kWp, 2)}</td><td>${nf(s.genYear, 0)}</td>
    <td>${pc(s.coverage)}<div class="cov"><i style="width:${Math.min(100, s.coverage * 100)}%"></i></div></td><td>${nf(s.margin, 0)}</td><td>${nf(s.roofArea, 1)}</td><td>${nf(s.dcacActual, 2)}</td><td>${money(b.subtotal)}</td>
    <td><input class="price-input" type="number" min="0" step="1" data-scost="${n}" placeholder="${Math.round(scenarioCost({ ...x, scenarioCosts: {} , finalPrice: n === num(x.scenarioPanels) ? x.finalPrice : '' }, n))}" value="${manualScenarioCost(x, n) > 0 ? manualScenarioCost(x, n) : ''}" title="Vacío = costo calculado"></td>
    <td><span class="flag ${s.covers ? 'ok' : ''}">${s.covers ? 'cubre' : 'no cubre'}</span></td><td class="nowrap"><button class="btn ghost" data-use="${n}">Usar</button> <button class="remove-line" data-rmsc="${i}" title="Quitar">×</button></td></tr>`; }).join('');
  $('#scenarioHint').textContent = `Mínimo calculado: ${c.n} paneles. El costo recalcula las cantidades automáticas; las manuales se conservan.`;
}
function renderCatalog() {
  const cat = getCatalog();
  $('#catalogBody').innerHTML = cat.map((m, i) => `<tr><td><input class="name-input" data-cf="name" data-ci="${i}" value="${attr(m.name)}"></td><td><input class="unit-input" data-cf="unit" data-ci="${i}" value="${attr(m.unit)}"></td>
  <td><select data-cf="rule" data-ci="${i}">${Object.entries(SolarMath.RULES).map(([k, v]) => `<option value="${k}" ${m.rule === k ? 'selected' : ''}>${v}</option>`).join('')}</select></td>
  <td><input class="price-input" type="number" min="0" step=".01" data-cf="price" data-ci="${i}" value="${m.price}"></td>
  <td><select data-cf="status" data-ci="${i}"><option ${m.status !== 'Verificado' ? 'selected' : ''}>Referencia editable</option><option ${m.status === 'Verificado' ? 'selected' : ''}>Verificado</option></select><input class="source-input" data-cf="url" data-ci="${i}" placeholder="URL" value="${attr(m.url)}"><input type="date" data-cf="checked" data-ci="${i}" value="${attr(m.checked)}"></td>
  <td><button class="remove-line" data-crm="${i}" title="Quitar del catálogo">×</button></td></tr>`).join('');
  $('#addFromCat').innerHTML = '<option value="">Agregar desde catálogo…</option>' + cat.map((m, i) => `<option value="${i}">${attr(m.name)}</option>`).join('');
}

function initExtras() {
  const q = s => document.querySelector(s);
  q('#greenBoldBtn').onclick = () => {
    const ta = q('#pdfText'), a = ta.selectionStart, b = ta.selectionEnd, sel = ta.value.slice(a, b);
    const inner = sel || 'texto';
    ta.focus();
    ta.setRangeText('**' + inner + '**', a, b, 'end');
    if (!sel) ta.setSelectionRange(a + 2, a + 2 + inner.length);
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  };
  q('#finalPriceReset').onclick = () => { p().finalPrice = ''; save(); render(); };
  q('#contOn').onchange = e => { p().contingencyOn = e.target.checked; save(); render(); };
  q('#ivaOn').onchange = e => { p().ivaOn = e.target.checked; save(); render(); };
  q('#addSc').onclick = () => { const x = p(); x.scenarios.push(Math.max(...x.scenarios, num(x.scenarioPanels)) + 1); save(); render(); };
  q('#scenarioBody').addEventListener('change', e => { if (e.target.dataset.sc === undefined) return; p().scenarios[+e.target.dataset.sc] = Math.max(1, Math.round(num(e.target.value, 1))); save(); render(); });
  q('#scenarioBody').addEventListener('change', e => { const n = e.target.dataset.scost; if (n === undefined) return; const x = p(), v = num(e.target.value);
    x.scenarioCosts = x.scenarioCosts || {}; if (v > 0) x.scenarioCosts[n] = v; else delete x.scenarioCosts[n]; save(); render(); });
  q('#scenarioBody').addEventListener('click', e => { const x = p(), d = e.target.dataset;
    if (d.use) { x.scenarioPanels = +d.use; save(); setDefaults(); } else if (d.rmsc !== undefined) { x.scenarios.splice(+d.rmsc, 1); save(); render(); } });
  q('#materialsBody').addEventListener('click', e => { const a = e.target.closest('[data-auto]'); if (!a) return; e.preventDefault(); p().materials[+a.dataset.auto].manual = false; save(); render(); });
  q('#addFromCat').onchange = e => { if (e.target.value === '') return; p().materials.push({ ...getCatalog()[+e.target.value], id: crypto.randomUUID(), manual: false, on: true }); e.target.value = ''; save(); render(); };
  q('#syncPrices').onclick = () => { const cat = getCatalog(); p().materials.forEach(m => { const c = cat.find(c => c.id === m.id); if (c) Object.assign(m, { price: c.price, status: c.status, url: c.url, checked: c.checked }); }); save(); render(); };
  q('#catalogBody').addEventListener('change', e => { const d = e.target.dataset; if (d.cf === undefined) return; const cat = getCatalog(); cat[+d.ci][d.cf] = d.cf === 'price' ? num(e.target.value) : e.target.value; saveCatalog(cat); renderCatalog(); });
  q('#catalogBody').addEventListener('click', e => { const b = e.target.closest('[data-crm]'); if (!b) return; const cat = getCatalog(); cat.splice(+b.dataset.crm, 1); saveCatalog(cat); renderCatalog(); });
  q('#addCatLine').onclick = () => { const cat = getCatalog(); cat.push({ id: crypto.randomUUID(), name: 'Material nuevo', unit: 'pza', rule: 'manual', qty: 1, manual: true, price: 0, status: 'Referencia editable', url: '', checked: '', on: true }); saveCatalog(cat); renderCatalog(); };
  q('#resetCat').onclick = () => { if (confirm('¿Restaurar los conceptos y precios originales del catálogo?')) { saveCatalog(SolarMath.factoryCatalog()); renderCatalog(); } };
}
document.addEventListener('DOMContentLoaded', initExtras);

function makePDF() {
  const x = p(), c = SolarMath.calculate(x), s = SolarMath.scenarioStats(x, num(x.scenarioPanels));
  if (SolarMath.validate(x).length) return alert('Corrige los campos marcados en rojo antes de exportar.');
  const d = new window.jspdf.jsPDF({ unit: 'mm', format: 'letter' }), W = 215.9, M = 18, R = W - M, CW = W - M * 2, BOTTOM = 256;
  const C = { green: '#4A5B3C', gold: '#B9A06A', pale: '#F5F4F1', text: '#252821', muted: '#696D65', line: '#DDDCD5' };
  const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const fill = h => d.setFillColor(...rgb(h)), ink = h => d.setTextColor(...rgb(h)), ln = h => d.setDrawColor(...rgb(h));
  let y;
  const font = (size, style = 'normal', color = C.text) => { d.setFont('helvetica', style); d.setFontSize(size); ink(color); };
  const head = () => {
    fill(C.green); d.rect(0, 0, W, 2, 'F');
    if (x.logo) {
      try {
        const pr = d.getImageProperties(x.logo), scale = Math.min(36 / pr.width, 14 / pr.height);
        d.addImage(x.logo, M, 8, pr.width * scale, pr.height * scale);
      } catch {}
    } else {
      font(11, 'bold', C.green); d.text('TRÉBOL SOLAR', M, 14);
      font(7, 'normal', C.muted); d.text('ENERGÍA RESIDENCIAL · PV', M, 19);
    }
    font(8, 'bold', C.green); d.text('REPORTE TÉCNICO', R, 10, { align: 'right' });
    font(11); d.text('Dimensionamiento solar fotovoltaico', R, 16, { align: 'right' });
    font(7.5, 'normal', C.muted);
    d.text(x.date || new Date().toISOString().slice(0, 10), R, 22, { align: 'right' });
    ln(C.line); d.setLineWidth(0.3); d.line(M, 29, R, 29); y = 37;
  };
  const nextPage = () => { d.addPage(); head(); };
  const need = h => { if (y + h > BOTTOM) nextPage(); };
  const title = text => {
    font(10, 'bold', C.green); d.text(text, M, y);
    ln(C.gold); d.setLineWidth(0.4); d.line(M, y + 2.5, R, y + 2.5); y += 9;
  };
  const paragraph = (text, size = 9) => {
    font(size);
    const lines = d.splitTextToSize(String(text), CW), lineH = size * 0.3528 * 1.3;
    lines.forEach(line => { need(lineH + 2); font(size); d.text(line, M, y); y += lineH; });
    y += 4;
  };
  head();
  font(17, 'bold', C.green);
  const nameLines = d.splitTextToSize(x.name || 'Proyecto solar', CW);
  nameLines.forEach(line => { need(8); font(17, 'bold', C.green); d.text(line, M, y); y += 8; });
  y += 2;
  const details = [
    ['Cliente / referencia', x.client || '—'], ['Ubicación', x.location || '—'],
    ['Cubierta y altura', `${x.roof} · +${nf(num(x.roofHeight), 1)} m`], ['Sombreado / A/C', `${x.shade} · ${x.ac}`],
    ['Módulo / rendimiento', `${nf(num(x.panelW), 0)} Wp · ${nf(num(x.panelArea), 2)} m² · ${nf(num(x.yield), 2)} kWh/kWp/día`],
    ['Inversor / DC/AC deseada', `${nf(c.inverterKw, 1)} kW CA · ${nf(num(x.dcac, 1), 2)}`],
    ['Rutas de cable', `CC +${nf(num(x.cableExtra), 0)} m más azotea · CA ${nf(num(x.runAC), 0)} m`],
    ['Reserva / cadenas', `${nf(num(x.slackPct, 20), 0)}% · ${nf(num(x.strings, 2), 0)} cadenas`],
  ];
  const cellW = (CW - 8) / 2;
  for (let i = 0; i < details.length; i += 2) {
    font(8.5);
    const row = details.slice(i, i + 2).map(([label, value]) => ({ label, lines: d.splitTextToSize(String(value), cellW) }));
    const h = 7 + Math.max(...row.map(item => item.lines.length)) * 4;
    need(h + 2);
    row.forEach((item, col) => {
      const left = M + col * (cellW + 8);
      font(7, 'bold', C.muted); d.text(item.label.toUpperCase(), left, y);
      font(8.5); d.text(item.lines, left, y + 4.5, { lineHeightFactor: 1.2 });
    });
    y += h;
  }
  y += 3;
  need(43); title('Resultado del escenario');
  const metrics = [
    ['PANELES SELECCIONADOS', `${c.scenario} paneles`], ['POTENCIA DC', `${nf(c.scenarioKwp, 2)} kWp`],
    ['GENERACIÓN ANUAL', `${nf(c.gen, 0)} kWh`], ['COBERTURA DE LA META', pc(c.coverage)],
    ['COBERTURA DEL CONSUMO ACTUAL', pc(c.coverageNow)], ['ÁREA DE AZOTEA', `${nf(c.roofArea, 1)} m²`],
  ];
  fill(C.pale); d.rect(M, y - 2, CW, 30, 'F'); fill(C.gold); d.rect(M, y - 2, 1, 30, 'F');
  metrics.forEach(([label, value], i) => {
    const left = M + 4 + (i % 3) * CW / 3, top = y + Math.floor(i / 3) * 14;
    font(6.1, 'normal', C.muted); d.text(label, left, top + 2);
    font(12, 'bold', C.green); d.text(value, left, top + 8);
  });
  y += 35;
  const calculations = [
    ['Consumo diario actual', `${nf(num(x.billKwh), 0)} kWh / ${nf(num(x.periodDays), 0)} d`, `${nf(c.daily)} kWh/d`],
    ['Consumo anual actual', `${nf(num(x.billKwh), 0)} x 365 / ${nf(num(x.periodDays), 0)}`, `${nf(c.annual, 0)} kWh`],
    [`Meta con +${nf(num(x.growthPct), 0)}%`, `${nf(c.annual, 0)} x ${nf(1 + num(x.growthPct) / 100, 2)}`, `${nf(c.future, 0)} kWh`],
    ['Potencia requerida', `${nf(c.future, 0)} / (${nf(num(x.yield), 2)} x 365)`, `${nf(c.kwp, 3)} kWp`],
    ['Paneles mínimos', `ceil(${nf(c.kwp * 1000, 0)} W / ${nf(num(x.panelW), 0)} W)`, String(c.n)],
    ['Generación anual estimada', `${nf(c.scenarioKwp, 2)} x ${nf(num(x.yield), 2)} x 365`, `${nf(c.gen, 0)} kWh`],
    ['Margen vs. meta', `${nf(c.gen, 0)} - ${nf(c.future, 0)}`, `${nf(s.margin, 0)} kWh`],
    ['Área de azotea', `${c.scenario} x ${nf(num(x.panelArea), 2)} x ${nf(1 + num(x.clearancePct) / 100, 2)}`, `${nf(c.roofArea, 1)} m²`],
    ['Relación DC/AC', `${nf(c.scenarioKwp, 2)} kWp / ${nf(c.inverterKw, 1)} kW`, nf(c.dcacActual, 2)],
  ];
  need(12 + calculations.length * 8.5); title('Cálculos y fórmulas');
  calculations.forEach(([label, equation, result]) => {
    font(8.5); d.text(label, M, y);
    font(8, 'normal', C.muted); d.text(equation, M + 62, y);
    font(9, 'bold', C.green); d.text(result, R, y, { align: 'right' });
    ln(C.line); d.setLineWidth(0.2); d.line(M, y + 3, R, y + 3); y += 8.5;
  });
  y += 4;
  // Tarjetas de resumen, iguales a las de la app.
  const cards = [
    ['PANELES MÍNIMOS', `${c.n} módulos`, `${nf(c.n * num(x.panelW) / 1000, 2)} kWp instalados`, C.green, '#FFFFFF'],
    ['CONSUMO PROYECTADO', `${nf(c.future, 0)} kWh/año`, `${nf(c.daily, 1)} kWh/día promedio actual`, '#3D4934', '#FFFFFF'],
    [`ESCENARIO · ${c.scenario} PANELES`, `${nf(c.gen, 0)} kWh/año`, `${c.margin >= 0 ? '+' : ''}${nf(c.margin * 100, 0)}% margen estimado`, '#6E765F', '#FFFFFF'],
    ['ÁREA ESTIMADA DE MÓDULOS', `${nf(c.roofArea, 1)} m²`, `incluye holgura de ${nf(num(x.clearancePct), 0)}%`, '#E9E7E2', C.text],
  ];
  const gap = 3, cardW = (CW - gap * 3) / 4, cardH = 25;
  need(cardH + 6);
  cards.forEach(([label, value, sub, bg, color], i) => {
    const left = M + i * (cardW + gap);
    fill(bg); d.roundedRect(left, y - 2, cardW, cardH, 1.5, 1.5, 'F');
    font(5.6, 'normal', color); d.text(d.splitTextToSize(label, cardW - 7)[0], left + 3.5, y + 3.5);
    font(12.5, 'bold', color); d.text(value, left + 3.5, y + 12);
    font(6.3, 'normal', color); d.text(d.splitTextToSize(sub, cardW - 7)[0], left + 3.5, y + 18.5);
  });
  y += cardH + 6;
  const scenarios = x.scenarios || [], widths = [22, 26, 32, 36, 28, CW - 144];
  need(Math.min(20 + scenarios.length * 8, BOTTOM - 37)); title('Escenarios comparados');
  const tableHead = () => {
    fill(C.pale); d.rect(M, y - 4, CW, 9, 'F');
    let left = M;
    font(8, 'bold', C.green);
    ['Paneles', 'kWp', 'kWh/año', 'Cobertura meta', 'Azotea m²'].forEach((text, i) => {
      d.text(text, left + 3, y + 1); left += widths[i];
    });
    d.text('Costo', R - 3, y + 1, { align: 'right' });
    y += 9;
  };
  tableHead();
  scenarios.forEach(count => {
    if (y + 8 > BOTTOM) { nextPage(); title('Escenarios comparados · continuación'); tableHead(); }
    const q = SolarMath.scenarioStats(x, count), selected = num(count) === num(x.scenarioPanels);
    if (selected) { fill('#EEF0EA'); d.rect(M, y - 4, CW, 8, 'F'); }
    font(8.5, selected ? 'bold' : 'normal');
    let left = M;
    [count, nf(q.kWp, 2), nf(q.genYear, 0), pc(q.coverage), nf(q.roofArea, 1)].forEach((value, i) => {
      d.text(String(value), left + 3, y + 1); left += widths[i];
    });
    d.text(money(scenarioCost(x, count)), R - 3, y + 1, { align: 'right' });
    ln(C.line); d.setLineWidth(0.2); d.line(M, y + 4, R, y + 4); y += 8;
  });
  font(7.5, 'normal', C.muted);
  d.text(`Costos en moneda nacional · ${x.ivaOn ? `IVA incluido (${nf(num(x.ivaPct, 16), 0)}%)` : 'No incluyen IVA'}`, R - 3, y + 1, { align: 'right' });
  y += 10;
  need(36); title('Costo final');
  fill(C.pale); d.rect(M, y - 2, CW, 25, 'F'); fill(C.gold); d.rect(M, y - 2, 1, 25, 'F');
  font(7, 'bold', C.muted); d.text('COSTO FINAL DEL SISTEMA', M + 5, y + 4);
  font(8, 'normal', C.muted);
  d.text(`${c.scenario} paneles · ${nf(c.scenarioKwp, 2)} kWp · moneda nacional`, M + 5, y + 13);
  font(20, 'bold', C.green); d.text(money(finalPrice(x)), R - 5, y + 10, { align: 'right' });
  // Leyenda de IVA según la casilla "IVA" de la lista de materiales.
  font(8.5, 'bold', x.ivaOn ? C.green : C.muted);
  d.text(x.ivaOn ? `IVA incluido (${nf(num(x.ivaPct, 16), 0)}%)` : 'No incluye IVA', R - 5, y + 17.5, { align: 'right' });
  y += 31;
  const projectText = typeof x.pdfText === 'string' ? x.pdfText : '';
  if (projectText.trim()) {
    nextPage();
    const size = 9, lineH = size * 0.3528 * 1.3;
    const heading = 'NOTAS, CONDICIONES Y ALCANCE';
    // **texto** se imprime en verde y negritas; un ** sin cerrar se deja tal cual.
    const runFont = bold => font(size, bold ? 'bold' : 'normal', bold ? C.green : C.text);
    const width = (text, bold) => { runFont(bold); return d.getTextWidth(text); };
    const parseRuns = line => {
      const parts = line.split('**');
      if (parts.length % 2 === 0) parts.splice(-2, 2, parts[parts.length - 2] + '**' + parts[parts.length - 1]);
      return parts.map((text, i) => ({ text, bold: i % 2 === 1 })).filter(r => r.text);
    };
    const wrapRuns = runs => {
      const out = []; let cur = [], w = 0;
      const push = () => {
        while (cur.length && !cur[cur.length - 1].text.trim()) cur.pop();
        out.push(cur.reduce((acc, r) => { const prev = acc[acc.length - 1]; if (prev && prev.bold === r.bold) prev.text += r.text; else acc.push({ ...r }); return acc; }, []));
        cur = []; w = 0;
      };
      runs.forEach(({ text, bold }) => text.split(/(\s+)/).filter(Boolean).forEach(token => {
        const space = !token.trim();
        if (space && !cur.length) return;
        runFont(bold);
        const pieces = space ? [token] : d.splitTextToSize(token, CW);
        pieces.forEach(piece => {
          const pw = width(piece, bold);
          if (!space && cur.length && w + pw > CW) push();
          cur.push({ text: piece, bold }); w += pw;
        });
      }));
      if (cur.length || !out.length) push();
      return out;
    };
    const lines = projectText.replace(/\r\n?/g, '\n').split('\n')
      .flatMap(line => line.trim() ? wrapRuns(parseRuns(line)) : [[]]);
    while (lines.length && !lines[0].length) lines.shift();
    while (lines.length && !lines[lines.length - 1].length) lines.pop();
    title(heading);
    lines.forEach(line => {
      if (!line.length && y + lineH + 2 > BOTTOM) return;
      if (y + lineH + 2 > BOTTOM) {
        nextPage();
        title(`${heading} · continuación`);
      }
      let left = M;
      line.forEach(({ text, bold }) => { runFont(bold); d.text(text, left, y); left += d.getTextWidth(text); });
      y += lineH;
    });
  }
  const pageCount = d.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    d.setPage(i); ln(C.line); d.setLineWidth(0.3); d.line(M, 265, R, 265);
    font(7, 'normal', C.muted); d.text('Trébol Solar · Dimensionamiento solar preliminar', M, 271);
    d.text(`Página ${i} de ${pageCount}`, R, 271, { align: 'right' });
  }
  d.save(slug() + '.pdf');
}
