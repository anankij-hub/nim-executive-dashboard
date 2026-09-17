const state = { page: 'overview', year: null, data: null, routeFilters: { view: 'attention', direction: 'all', metric: 'contribution', sort: 'desc', status: 'all', limit: 10, search: '' }, matrixFilters: { direction: 'all', profitability: 'margin_pct', quadrant: 'all', search: '' }, fleetFilters: { metric: 'revenue', sort: 'desc', limit: 12, search: '', status: 'all' }, serviceFilters: { metric: 'revenue', sort: 'desc', limit: 10, search: '', status: 'all' }, customerFilters: { queueSearch: '', status: 'all', segment: 'all', action: 'all', contribution: 'loss', sortMetric: 'contribution', sortDirection: 'asc', queueLimit: 50, detailSearch: '', detailPage: 1, detailLimit: 50 } };
const $ = id => document.getElementById(id);
const fmt = (v, d = 1) => Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const moneyM = v => `฿ ${fmt((v || 0) / 1e6, 1)}M`;
const pct = v => `${fmt(v || 0, 1)}%`;
const esc = s => String(s ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));

function current() {
  return state.data?.years?.find(x => x.year === Number(state.year)) || state.data?.years?.at(-1);
}

function kpi(label, value, sub = '', icon = '●') {
  return `<div class="kpi"><div class="kpi-label"><span class="kpi-icon">${icon}</span>${label}</div><div class="kpi-value">${value}</div><div class="trend up">${sub || ' '}<small>${state.page === 'customer_credit' ? 'ตามไฟล์ลูกค้ารายคน' : `ปี ${state.year || '—'}`}</small></div></div>`;
}

function customerKpi(label, value, sub, icon, color) {
  return `<div class="customer-kpi ${color}"><span class="customer-kpi-icon">${icon}</span><div><h3>${label}</h3><strong>${value}</strong><small>${sub}</small></div></div>`;
}

function panel(title, sub, body) {
  return `<div class="panel"><div class="panel-head"><div><div class="panel-title">${title}</div>${sub ? `<div class="panel-sub">${sub}</div>` : ''}</div></div>${body}</div>`;
}

function lineChart(rows) {
  if (!rows?.length) return '<div class="empty-state">ไม่มีข้อมูลรายเดือน</div>';
  const w = 760, h = 245, p = 34;
  const vals = rows.flatMap(r => [r.revenue, r.all_costs]);
  const max = Math.max(...vals, 1) * 1.08;
  const xs = rows.map((_, i) => p + i * ((w - 2 * p) / Math.max(rows.length - 1, 1)));
  const y = v => h - p - (v / max) * (h - 2 * p);
  const rev = xs.map((x, i) => `${x},${y(rows[i].revenue)}`).join(' ');
  const cost = xs.map((x, i) => `${x},${y(rows[i].all_costs)}`).join(' ');
  const grids = [0, .25, .5, .75, 1].map(q => {
    const v = max * q;
    return `<line x1="${p}" y1="${y(v)}" x2="${w - p}" y2="${y(v)}" stroke="#e8eef5"/><text x="1" y="${y(v) + 3}" font-size="8" fill="#7d8ba0">${fmt(v / 1e6, 0)}M</text>`;
  }).join('');
  const labels = xs.map((x, i) => `<text x="${x}" y="${h - 7}" text-anchor="middle" font-size="8" fill="#7d8ba0">${esc(rows[i].month)}</text>`).join('');
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="100%">${grids}<polyline fill="none" stroke="#1466d8" stroke-width="3" points="${rev}"/><polyline fill="none" stroke="#ef4d57" stroke-width="3" points="${cost}"/>${labels}</svg>`;
}

function bars(data, key, labelKey = 'route', limit = 8) {
  const arr = [...(data || [])].sort((a, b) => (b[key] || 0) - (a[key] || 0)).slice(0, limit);
  if (!arr.length) return '<div class="empty-state">ยังไม่มีข้อมูลสำหรับกราฟนี้</div>';
  const max = Math.max(...arr.map(x => Math.abs(x[key] || 0)), 1);
  return `<div class="bars">${arr.map(r => `<div class="bar-row"><div title="${esc(r[labelKey])}">${esc(r[labelKey])}</div><div class="bar-bg"><div class="bar-fill" style="width:${Math.max(2, Math.abs(r[key]) / max * 100)}%"></div></div><div class="bar-val">${fmt((r[key] || 0) / 1e6, 1)}M</div></div>`).join('')}</div>`;
}

function overviewPage(y) {
  const o = y.overview || {}, t = o.totals || {}, p = y.profit_summary || {};
  const annual = (state.data.years || []).map(x => ({
    year: x.year,
    revenue: x.profit_summary?.revenue || x.overview?.totals?.revenue || 0,
    profit: x.profit_summary?.profit || 0,
    margin: x.profit_summary?.margin || 0
  }));
  return `<div class="kpi-grid">
    ${kpi('รายได้', moneyM(p.revenue || t.revenue), 'จากข้อมูลที่ประมวลผลแล้ว', '฿')}
    ${kpi('ต้นทุนตามข้อมูล', moneyM(p.cost), 'ตามนิยามต้นทุนของชุดข้อมูล', '▣')}
    ${kpi('ผลตอบแทนจากการดำเนินงาน', moneyM(p.profit), 'Revenue - Cost ตามชุดข้อมูล', '▲')}
    ${kpi('Margin', pct(p.margin), 'อัตราผลตอบแทนจากข้อมูล', '%')}
    ${kpi('ต้นทุนค่าเดินทาง', moneyM(t.travel), 'จากข้อมูลภาพรวม', '🚚')}
    ${kpi('ค่าน้ำมัน', moneyM(t.fuel), 'จากข้อมูลภาพรวม', '⛽')}
    ${kpi('ค่าซ่อม', moneyM(t.repair), 'จากข้อมูลภาพรวม', '⚙')}
    ${kpi('ค่าเช่ารถ', moneyM(t.rental), 'จากข้อมูลภาพรวม', '▤')}
  </div>
  <div class="grid">
    <div class="panel"><div class="panel-head"><div><div class="panel-title">แนวโน้มรายได้และต้นทุนรายเดือน</div><div class="panel-sub">ต้นทุนในกราฟ = ค่าเดินทาง + น้ำมัน + ซ่อม + ค่าเช่ารถ เพื่อดูองค์ประกอบต้นทุน</div></div><div class="legend"><span style="--c:#1466d8">รายได้</span><span style="--c:#ef4d57">ต้นทุน</span></div></div><div class="chart-wrap">${lineChart(o.monthly)}</div></div>
    ${panel('กลุ่มบริการที่สร้างผลตอบแทนสูง', 'แสดงเฉพาะรายการที่ชุดข้อมูลคำนวณผลตอบแทนไว้แล้ว', bars((y.service_groups || []).filter(x => x.revenue > 0), 'profit', 'service', 6))}
  </div>
  <div class="grid">
    <div class="panel"><div class="panel-title">เส้นทางที่สร้างส่วนต่างสูง</div><div class="panel-sub">Revenue - ต้นทุนค่าเดินทาง - ค่าเช่ารถ ตามข้อมูลที่มีระดับเส้นทาง</div>${bars(y.routes, 'contribution', 'route', 7)}</div>
    <div class="panel"><div class="panel-title">ภาพรวมหลายปี</div><table class="simple-table"><thead><tr><th>ปี</th><th>รายได้</th><th>ผลตอบแทน</th><th>Margin</th></tr></thead><tbody>${annual.map(a => `<tr><td>${a.year}</td><td>${moneyM(a.revenue)}</td><td>${moneyM(a.profit)}</td><td>${pct(a.margin)}</td></tr>`).join('')}</tbody></table></div>
  </div>`;
}

const BANGKOK_ROUTE_TERMS = [
  'กรุงเทพ','กทม','พุทธมณฑลสาย 2','พุทธมณฑลสาย 5','ตลาดไท','สี่แยกมหานาค','มหานาค',
  'ร่มเกล้า','สี่มุมเมือง','ปากคลองตลาด','มหาชัย','ราชบุรี'
];
const NORTH_ROUTE_TERMS = [
  'เชียงใหม่','บ้านขุน','เชียงดาว','สันกำแพง','ฝาง','ท่าลี่','ลำพูน','ลำปาง','แพร่','น่าน','พะเยา',
  'เชียงคำ','เชียงราย','เวียงป่าเป้า','แม่สาย','แม่ฮ่องสอน','แม่สะเรียง','ขุนยวม','ปาย',
  'กำแพงเพชร','ตาก','พิษณุโลก','สุโขทัย','อุตรดิตถ์'
];
const routeMetricLabels = {
  revenue: 'รายได้',
  known_cost: 'ต้นทุนที่ทราบ',
  contribution: 'ส่วนต่าง',
  margin_pct: 'Margin (%)',
  return_on_cost_pct: 'ผลตอบแทนต่อต้นทุน (%)'
};

function hasAnyTerm(value, terms) {
  const v = String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
  return terms.some(term => v.includes(term.toLowerCase()));
}
function isBangkokPoint(value) { return hasAnyTerm(value, BANGKOK_ROUTE_TERMS); }
function isNorthPoint(value) { return hasAnyTerm(value, NORTH_ROUTE_TERMS); }
function routeDirection(r) {
  const ob = isBangkokPoint(r.origin), db = isBangkokPoint(r.destination);
  const on = isNorthPoint(r.origin), dn = isNorthPoint(r.destination);
  if (ob && dn) return 'bkk_north';
  if (on && db) return 'north_bkk';
  if (on && dn) return 'north_internal';
  if (ob && db) return 'bkk_internal';
  return 'other';
}
function routeDirectionLabel(code) {
  return ({
    all:'ทุกทิศทาง', bkk_north:'กทม./ปริมณฑล → สายเหนือ', north_bkk:'สายเหนือ → กทม./ปริมณฑล',
    north_internal:'ภายในสายเหนือ', bkk_internal:'ภายใน กทม./ปริมณฑล', other:'อื่น ๆ', compare:'เปรียบเทียบ กทม. ↔ สายเหนือ'
  })[code] || code;
}
function routeRows(y) {
  return [...(y.routes || [])].map(r => {
    const revenue = Number(r.revenue || 0);
    const knownCost = Number(r.known_cost || 0);
    const contribution = Number(r.contribution || 0);
    return {
      ...r,
      revenue,
      known_cost: knownCost,
      contribution,
      margin_pct: revenue > 0 ? contribution / revenue * 100 : null,
      return_on_cost_pct: knownCost > 0 ? contribution / knownCost * 100 : null,
      _direction: routeDirection(r)
    };
  });
}
function filteredRoutes(y) {
  const f = state.routeFilters;
  const q = (f.search || '').trim().toLowerCase();
  let rows = routeRows(y);
  if (f.direction !== 'all' && f.direction !== 'compare') rows = rows.filter(r => r._direction === f.direction);
  if (f.direction === 'compare') rows = rows.filter(r => r._direction === 'bkk_north' || r._direction === 'north_bkk');
  if (q) rows = rows.filter(r => `${r.origin} ${r.destination} ${r.route}`.toLowerCase().includes(q));
  if (f.status === 'positive') rows = rows.filter(r => r.contribution > 0);
  if (f.status === 'negative') rows = rows.filter(r => r.contribution < 0);
  if (f.status === 'margin_low') rows = rows.filter(r => r.margin_pct !== null && r.margin_pct < 10);
  if (f.status === 'roc_low') rows = rows.filter(r => r.return_on_cost_pct !== null && r.return_on_cost_pct < 10);
  if (f.status === 'cost_ready') rows = rows.filter(r => r.known_cost > 0);
  if (f.status === 'cost_missing') rows = rows.filter(r => r.known_cost <= 0);
  const key = f.metric;
  rows.sort((a,b) => {
    const av = a[key], bv = b[key];
    const am = av === null || av === undefined || !Number.isFinite(Number(av));
    const bm = bv === null || bv === undefined || !Number.isFinite(Number(bv));
    if (am && bm) return 0;
    if (am) return 1;
    if (bm) return -1;
    return f.sort === 'asc' ? Number(av)-Number(bv) : Number(bv)-Number(av);
  });
  return rows;
}
function routeMetricText(r, key) {
  const n = r[key];
  if (n === null || n === undefined || !Number.isFinite(Number(n))) return 'N/A';
  if (key === 'margin_pct' || key === 'return_on_cost_pct') return pct(n);
  return moneyM(n);
}
function routeCompareMetricText(n, metric, isDifference=false) {
  if (n === null || n === undefined || !Number.isFinite(Number(n))) return 'N/A';
  if (metric === 'margin_pct' || metric === 'return_on_cost_pct') return isDifference ? `${fmt(n,1)} pp` : pct(n);
  return moneyM(n);
}
function routeCompareRows(routes, metric) {
  const m = new Map();
  for (const raw of routes) {
    const r = raw.margin_pct === undefined ? routeRows({routes:[raw]})[0] : raw;
    const dir = routeDirection(r);
    if (dir !== 'bkk_north' && dir !== 'north_bkk') continue;
    const north = dir === 'bkk_north' ? r.destination : r.origin;
    if (!north) continue;
    if (!m.has(north)) m.set(north, {
      north,
      outbound:{revenue:0,cost:0,contribution:0},
      inbound:{revenue:0,cost:0,contribution:0}
    });
    const side = dir === 'bkk_north' ? m.get(north).outbound : m.get(north).inbound;
    side.revenue += Number(r.revenue || 0);
    side.cost += Number(r.known_cost || 0);
    side.contribution += Number(r.contribution || 0);
  }
  function calc(side) {
    if (metric === 'revenue') return side.revenue;
    if (metric === 'known_cost') return side.cost;
    if (metric === 'contribution') return side.contribution;
    if (metric === 'margin_pct') return side.revenue > 0 ? side.contribution / side.revenue * 100 : null;
    if (metric === 'return_on_cost_pct') return side.cost > 0 ? side.contribution / side.cost * 100 : null;
    return 0;
  }
  return [...m.values()].map(x => {
    const outbound = calc(x.outbound), inbound = calc(x.inbound);
    const difference = outbound === null || inbound === null ? null : inbound - outbound;
    return {north:x.north, outbound, inbound, difference};
  });
}
function routeBarsOrdered(data, key, labelKey = 'route') {
  const arr = [...(data || [])];
  if (!arr.length) return '<div class="empty-state">ยังไม่มีข้อมูลสำหรับกราฟนี้</div>';
  const valid = arr.filter(x => x[key] !== null && x[key] !== undefined && Number.isFinite(Number(x[key])));
  if (!valid.length) return '<div class="empty-state">ไม่มีข้อมูลต้นทุนเพียงพอสำหรับคำนวณตัวชี้วัดนี้</div>';
  const max = Math.max(...valid.map(x => Math.abs(Number(x[key]) || 0)), 1);
  return `<div class="bars">${arr.map(r => {
    const raw = r[key];
    const missing = raw === null || raw === undefined || !Number.isFinite(Number(raw));
    const width = missing ? 0 : Math.max(2, Math.abs(Number(raw)) / max * 100);
    return `<div class="bar-row"><div title="${esc(r[labelKey])}">${esc(r[labelKey])}</div><div class="bar-bg"><div class="bar-fill ${Number(raw)<0?'negative-bar':''}" style="width:${width}%"></div></div><div class="bar-val ${Number(raw)<0?'loss':''}">${routeMetricText(r,key)}</div></div>`;
  }).join('')}</div>`;
}
function routeCompareTable(y) {
  const f = state.routeFilters;
  let rows = routeCompareRows(routeRows(y), f.metric);
  const q = (f.search || '').trim().toLowerCase();
  if (q) rows = rows.filter(r => r.north.toLowerCase().includes(q));
  rows.sort((a,b) => {
    const av=a.difference,bv=b.difference;
    const am=av===null||!Number.isFinite(Number(av)), bm=bv===null||!Number.isFinite(Number(bv));
    if(am&&bm)return 0;if(am)return 1;if(bm)return -1;
    return f.sort === 'asc' ? av-bv : bv-av;
  });
  rows = rows.slice(0, Number(f.limit || 10));
  if (!rows.length) return '<div class="empty-state">ยังไม่มีคู่เส้นทางสำหรับเปรียบเทียบ</div>';
  return `<table class="simple-table route-table"><thead><tr><th>จุดสายเหนือ</th><th>กทม. → เหนือ</th><th>เหนือ → กทม.</th><th>ส่วนต่างขากลับ-ขาไป</th></tr></thead><tbody>${rows.map(r => `<tr><td>${esc(r.north)}</td><td>${routeCompareMetricText(r.outbound,f.metric)}</td><td>${routeCompareMetricText(r.inbound,f.metric)}</td><td class="${r.difference !== null && r.difference < 0 ? 'loss' : r.difference !== null ? 'good' : ''}">${routeCompareMetricText(r.difference,f.metric,true)}</td></tr>`).join('')}</tbody></table>`;
}
function routeFilterControls() {
  const f = state.routeFilters;
  return `<div class="route-filter-bar">
    <label><span>ทิศทางการขนส่ง</span><select data-route-control="direction">
      ${['all','bkk_north','north_bkk','north_internal','other','compare'].map(x => `<option value="${x}" ${f.direction===x?'selected':''}>${routeDirectionLabel(x)}</option>`).join('')}
    </select></label>
    <label><span>ตัวชี้วัด</span><select data-route-control="metric">
      ${Object.entries(routeMetricLabels).map(([k,v]) => `<option value="${k}" ${f.metric===k?'selected':''}>${v}</option>`).join('')}
    </select></label>
    <label><span>เรียงลำดับ</span><select data-route-control="sort"><option value="desc" ${f.sort==='desc'?'selected':''}>มาก → น้อย</option><option value="asc" ${f.sort==='asc'?'selected':''}>น้อย → มาก</option></select></label>
    <label><span>สถานะ</span><select data-route-control="status">
      <option value="all" ${f.status==='all'?'selected':''}>ทั้งหมด</option>
      <option value="positive" ${f.status==='positive'?'selected':''}>ส่วนต่างเป็นบวก</option>
      <option value="negative" ${f.status==='negative'?'selected':''}>ส่วนต่างติดลบ</option>
      <option value="margin_low" ${f.status==='margin_low'?'selected':''}>Margin ต่ำกว่า 10%</option>
      <option value="roc_low" ${f.status==='roc_low'?'selected':''}>ผลตอบแทน/ต้นทุน ต่ำกว่า 10%</option>
      <option value="cost_ready" ${f.status==='cost_ready'?'selected':''}>มีข้อมูลต้นทุน</option>
      <option value="cost_missing" ${f.status==='cost_missing'?'selected':''}>ต้นทุนยังไม่ครบ</option>
    </select></label>
    <label><span>จำนวนที่แสดง</span><select data-route-control="limit">${[10,20,50,100].map(n=>`<option value="${n}" ${Number(f.limit)===n?'selected':''}>${n} เส้นทาง</option>`).join('')}</select></label>
    <label class="route-search"><span>ค้นหาเส้นทาง</span><input data-route-control="search" type="search" value="${esc(f.search)}" placeholder="เช่น เชียงใหม่ / ตลาดไท"></label>
  </div>`;
}

function routesPage(y) {
  const f = state.routeFilters;
  const rows = filteredRoutes(y);
  const visible = rows.slice(0, Number(f.limit || 10));
  const metric = f.metric;
  const totals = rows.reduce((a,r) => ({
    revenue:a.revenue+r.revenue, known_cost:a.known_cost+r.known_cost, contribution:a.contribution+r.contribution
  }), {revenue:0,known_cost:0,contribution:0});
  const totalMargin = totals.revenue > 0 ? totals.contribution / totals.revenue * 100 : null;
  const totalRoc = totals.known_cost > 0 ? totals.contribution / totals.known_cost * 100 : null;
  const directionText = routeDirectionLabel(f.direction);
  const rankingTitle = f.direction === 'compare' ? 'ภาพรวมเส้นทาง กทม. ↔ สายเหนือ' : `Ranking: ${directionText}`;
  const rankingBody = f.direction === 'compare'
    ? routeCompareTable(y)
    : routeBarsOrdered(visible, metric, 'route');

  return `${routeFilterControls()}
  <div class="route-summary">
    <div><span>เส้นทางที่ตรงเงื่อนไข</span><b>${fmt(rows.length,0)}</b></div>
    <div><span>รายได้รวม</span><b>${moneyM(totals.revenue)}</b></div>
    <div><span>ต้นทุนที่ทราบ</span><b>${moneyM(totals.known_cost)}</b></div>
    <div><span>ส่วนต่างรวม</span><b class="${totals.contribution < 0 ? 'loss' : 'good'}">${moneyM(totals.contribution)}</b></div>
    <div><span>Margin รวม</span><b>${totalMargin===null?'N/A':pct(totalMargin)}</b></div>
    <div><span>ผลตอบแทนต่อต้นทุนรวม</span><b>${totalRoc===null?'N/A':pct(totalRoc)}</b></div>
  </div>
  <div class="grid route-analysis-grid">
    <div class="panel"><div class="panel-title">${rankingTitle}</div><div class="panel-sub">จัดอันดับตาม “${routeMetricLabels[metric]}” · ${f.sort==='desc'?'มากไปน้อย':'น้อยไปมาก'}${f.direction==='compare'?' · ตารางเปรียบเทียบรวมทุกสถานีฝั่ง กทม./ปริมณฑล':''}</div>${rankingBody}</div>
    <div class="panel"><div class="panel-title">รายละเอียดเส้นทางตาม Filter</div><div class="panel-sub">Margin = ส่วนต่าง ÷ รายได้ · ผลตอบแทนต่อต้นทุน = ส่วนต่าง ÷ ต้นทุนที่ทราบ</div>${f.direction === 'compare' ? routeCompareTable(y) : `<div class="route-table-wrap"><table class="simple-table route-table route-detail-table"><thead><tr><th>เส้นทาง</th><th>รายได้</th><th>ต้นทุนที่ทราบ</th><th>ส่วนต่าง</th><th>Margin</th><th>ผลตอบแทน/ต้นทุน</th></tr></thead><tbody>${visible.length ? visible.map(r => `<tr><td><b>${esc(r.route)}</b><small>${esc(routeDirectionLabel(r._direction))}</small></td><td>${moneyM(r.revenue)}</td><td>${moneyM(r.known_cost)}</td><td class="${r.contribution < 0 ? 'loss' : 'good'}">${moneyM(r.contribution)}</td><td>${r.margin_pct===null?'N/A':pct(r.margin_pct)}</td><td class="${r.return_on_cost_pct!==null && r.return_on_cost_pct<0?'loss':r.return_on_cost_pct!==null?'good':''}">${r.return_on_cost_pct===null?'N/A':pct(r.return_on_cost_pct)}</td></tr>`).join('') : '<tr><td colspan="6">ไม่พบเส้นทางที่ตรงกับ Filter</td></tr>'}</tbody></table></div>`}</div>
  </div>
  <div class="page-note route-note"><b>ข้อควรตีความ:</b> ผลตอบแทนต่อต้นทุนช่วยชี้ “ความคุ้มค่า” ของเส้นทาง โดยคำนวณจากส่วนต่าง ÷ ต้นทุนที่ทราบ × 100 และควรใช้ควบคู่กับ Margin และยอดรายได้ หากต้นทุนเป็น 0 หรือยังไม่ครบ ระบบจะแสดง N/A แทนการสร้างค่าอนันต์หรืออันดับที่ทำให้เข้าใจผิด</div>`;
}


const matrixQuadrantMeta = {
  star: {
    label: 'ดาวเด่น (Star Trips)',
    short: 'Star Trips',
    meaning: 'ต้นทุนต่ำ + กำไรสูง: เส้นทาง/เที่ยวที่คุ้มค่าที่สุดและควรรักษา/ขยาย',
    recommendation: 'รักษาความถี่และขยายเที่ยวอย่างมีวินัย',
    className: 'matrix-star'
  },
  volume: {
    label: 'กับดักปริมาณ (Volume Trap)',
    short: 'Volume Trap',
    meaning: 'ต้นทุนต่ำ + กำไรต่ำ: มีปริมาณงานมากแต่ yield หรือผลกำไรไม่เพียงพอ',
    recommendation: 'ทบทวนราคา/ขั้นต่ำรายได้ และเพิ่ม Yield ต่อเที่ยว',
    className: 'matrix-volume'
  },
  problem: {
    label: 'ประสิทธิภาพต่ำ (Problem Trips)',
    short: 'Problem Trips',
    meaning: 'ต้นทุนสูง + กำไรต่ำ: เส้นทาง/เที่ยวที่สูญเสียประสิทธิภาพและควรปรับปรุงหรือยกเลิก',
    recommendation: 'ลดต้นทุน ปรับประเภทรถ รวมเที่ยว หรือทบทวนเส้นทาง',
    className: 'matrix-problem'
  },
  niche: {
    label: 'งานเฉพาะทางพรีเมียม (Niche/High Yield)',
    short: 'Niche/High Yield',
    meaning: 'ต้นทุนสูง + กำไรสูง: งานพิเศษหรือ Premium service ที่ให้ผลตอบแทนดีแม้ต้นทุนสูง',
    recommendation: 'รักษาฐานลูกค้าพรีเมียมและขยายอย่างระมัดระวัง',
    className: 'matrix-niche'
  }
};

function median(nums) {
  const a = nums.filter(Number.isFinite).sort((x,b)=>x-b);
  if (!a.length) return null;
  const m = Math.floor(a.length/2);
  return a.length % 2 ? a[m] : (a[m-1]+a[m])/2;
}
function matrixProfitLabel(key) { return key === 'return_on_cost_pct' ? 'ผลตอบแทนต่อต้นทุน (%)' : 'Margin (%)'; }
function matrixBaseRows(y) {
  const f = state.matrixFilters;
  const q = (f.search || '').trim().toLowerCase();
  let rows = routeRows(y).filter(r => r.revenue > 0 && r.known_cost > 0 && Number.isFinite(Number(r[f.profitability])));
  if (f.direction !== 'all') rows = rows.filter(r => r._direction === f.direction);
  if (q) rows = rows.filter(r => `${r.origin} ${r.destination} ${r.route}`.toLowerCase().includes(q));
  return rows;
}
function matrixClassify(rows) {
  const f = state.matrixFilters;
  const xThreshold = median(rows.map(r => r.known_cost));
  const yThreshold = median(rows.map(r => Number(r[f.profitability])));
  const classified = rows.map(r => {
    const highCost = xThreshold !== null && r.known_cost > xThreshold;
    const highProfit = yThreshold !== null && Number(r[f.profitability]) > yThreshold;
    const quadrant = highProfit ? (highCost ? 'niche' : 'star') : (highCost ? 'problem' : 'volume');
    return {...r, quadrant};
  });
  return { rows: classified, xThreshold, yThreshold };
}
function matrixFilterControls() {
  const f = state.matrixFilters;
  return `<div class="matrix-filter-bar">
    <label><span>ทิศทางการขนส่ง</span><select data-matrix-control="direction">
      ${['all','bkk_north','north_bkk','north_internal','other'].map(x=>`<option value="${x}" ${f.direction===x?'selected':''}>${routeDirectionLabel(x)}</option>`).join('')}
    </select></label>
    <label><span>แกนกำไร</span><select data-matrix-control="profitability">
      <option value="margin_pct" ${f.profitability==='margin_pct'?'selected':''}>Margin (%)</option>
      <option value="return_on_cost_pct" ${f.profitability==='return_on_cost_pct'?'selected':''}>ผลตอบแทนต่อต้นทุน (%)</option>
    </select></label>
    <label><span>Quadrant</span><select data-matrix-control="quadrant">
      <option value="all" ${f.quadrant==='all'?'selected':''}>ทั้งหมด</option>
      ${Object.entries(matrixQuadrantMeta).map(([k,v])=>`<option value="${k}" ${f.quadrant===k?'selected':''}>${v.short}</option>`).join('')}
    </select></label>
    <label class="matrix-search"><span>ค้นหาเส้นทาง</span><input data-matrix-control="search" type="search" value="${esc(f.search)}" placeholder="เช่น เชียงใหม่ / ตลาดไท"></label>
  </div>`;
}
function matrixScatterSVG(classified, xThreshold, yThreshold, profitability) {
  if (!classified.length || xThreshold === null || yThreshold === null) return '<div class="empty-state">ยังไม่มีข้อมูลต้นทุนและกำไรเพียงพอสำหรับ Matrix</div>';
  const w=940,h=500,pL=78,pR=32,pT=42,pB=64;
  const xs=classified.map(r=>r.known_cost/1e6);
  const ys=classified.map(r=>Number(r[profitability]));
  const maxX=Math.max(...xs,1)*1.08;
  const minY=Math.min(...ys,0); const maxY=Math.max(...ys,10);
  const padY=Math.max((maxY-minY)*0.08,5); const yMin=minY-padY, yMax=maxY+padY;
  const x=v=>pL+(v/maxX)*(w-pL-pR);
  const y=v=>pT+(yMax-v)/(yMax-yMin)*(h-pT-pB);
  const xT=x(xThreshold/1e6), yT=y(yThreshold);
  const revMax=Math.max(...classified.map(r=>r.revenue),1);
  const colors={star:'#2da56f',volume:'#e7ad35',problem:'#e65b66',niche:'#3b78d8'};
  const rects=`
    <rect x="${pL}" y="${pT}" width="${xT-pL}" height="${yT-pT}" fill="#eaf8f1"/>
    <rect x="${pL}" y="${yT}" width="${xT-pL}" height="${h-pB-yT}" fill="#fff7e5"/>
    <rect x="${xT}" y="${yT}" width="${w-pR-xT}" height="${h-pB-yT}" fill="#fff0f2"/>
    <rect x="${xT}" y="${pT}" width="${w-pR-xT}" height="${yT-pT}" fill="#edf4ff"/>`;
  const qLabels=`
    <text x="${pL+12}" y="${pT+22}" class="matrix-q-label star">STAR TRIPS</text>
    <text x="${pL+12}" y="${h-pB-14}" class="matrix-q-label volume">VOLUME TRAP</text>
    <text x="${xT+12}" y="${h-pB-14}" class="matrix-q-label problem">PROBLEM TRIPS</text>
    <text x="${xT+12}" y="${pT+22}" class="matrix-q-label niche">NICHE / HIGH YIELD</text>`;
  const yTicks=5,xTicks=5;
  let grid='';
  for(let i=0;i<=xTicks;i++){const v=maxX*i/xTicks,xx=x(v);grid+=`<line x1="${xx}" y1="${pT}" x2="${xx}" y2="${h-pB}" stroke="#dfe7f0" stroke-width="1"/><text x="${xx}" y="${h-pB+22}" text-anchor="middle" class="matrix-axis-tick">${fmt(v,1)}M</text>`;}
  for(let i=0;i<=yTicks;i++){const v=yMin+(yMax-yMin)*i/yTicks,yy=y(v);grid+=`<line x1="${pL}" y1="${yy}" x2="${w-pR}" y2="${yy}" stroke="#dfe7f0" stroke-width="1"/><text x="${pL-10}" y="${yy+4}" text-anchor="end" class="matrix-axis-tick">${fmt(v,0)}%</text>`;}
  const dots=classified.map(r=>{
    const cx=x(r.known_cost/1e6), cy=y(Number(r[profitability]));
    const rad=4+Math.sqrt(r.revenue/revMax)*7;
    const c=colors[r.quadrant];
    return `<circle cx="${cx}" cy="${cy}" r="${rad}" fill="${c}" fill-opacity=".82" stroke="#fff" stroke-width="1.5"><title>${esc(r.route)}\nต้นทุนที่ทราบ: ${moneyM(r.known_cost)}\n${matrixProfitLabel(profitability)}: ${pct(r[profitability])}\nรายได้: ${moneyM(r.revenue)}\n${matrixQuadrantMeta[r.quadrant].label}</title></circle>`;
  }).join('');
  return `<div class="matrix-chart-wrap"><svg class="matrix-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="Cost vs Profitability Matrix">${rects}${grid}${qLabels}<line x1="${xT}" y1="${pT}" x2="${xT}" y2="${h-pB}" stroke="#6f8096" stroke-width="2" stroke-dasharray="6 5"/><line x1="${pL}" y1="${yT}" x2="${w-pR}" y2="${yT}" stroke="#6f8096" stroke-width="2" stroke-dasharray="6 5"/>${dots}<text x="${(pL+w-pR)/2}" y="${h-12}" text-anchor="middle" class="matrix-axis-label">ต้นทุนที่ทราบต่อเส้นทาง (ล้านบาท) — Proxy จนกว่าจะมี Cost/Trip หรือ Cost/Ton</text><text x="18" y="${(pT+h-pB)/2}" transform="rotate(-90 18 ${(pT+h-pB)/2})" text-anchor="middle" class="matrix-axis-label">${esc(matrixProfitLabel(profitability))}</text></svg></div>`;
}
function matrixPage(y) {
  const base = matrixBaseRows(y);
  const {rows:classified,xThreshold,yThreshold}=matrixClassify(base);
  const f=state.matrixFilters;
  const visible = f.quadrant==='all' ? classified : classified.filter(r=>r.quadrant===f.quadrant);
  const byQ = Object.fromEntries(Object.keys(matrixQuadrantMeta).map(k=>[k,classified.filter(r=>r.quadrant===k)]));
  const sum=(arr,key)=>arr.reduce((a,r)=>a+Number(r[key]||0),0);
  const cards=Object.entries(matrixQuadrantMeta).map(([k,m])=>{
    const arr=byQ[k], rev=sum(arr,'revenue'), profit=sum(arr,'contribution');
    return `<div class="matrix-q-card ${m.className}"><div><span>${m.label}</span><b>${fmt(arr.length,0)} เส้นทาง</b></div><small>${m.meaning}</small><small>รายได้ ${moneyM(rev)} · ส่วนต่าง ${moneyM(profit)}</small><p>${m.recommendation}</p></div>`;
  }).join('');
  const sorted=[...visible].sort((a,b)=>Number(b[f.profitability])-Number(a[f.profitability]));
  return `${matrixFilterControls()}
    <div class="matrix-threshold-strip"><div><span>เส้นแบ่งต้นทุน (Median)</span><b>${xThreshold===null?'N/A':moneyM(xThreshold)}</b></div><div><span>เส้นแบ่งกำไร (Median)</span><b>${yThreshold===null?'N/A':pct(yThreshold)}</b></div><div><span>จำนวนเส้นทางที่วิเคราะห์</span><b>${fmt(classified.length,0)}</b></div><div><span>เกณฑ์กำไร</span><b>${matrixProfitLabel(f.profitability)}</b></div></div>
    <div class="panel matrix-main-panel"><div class="panel-head"><div><div class="panel-title">Cost vs. Profitability Matrix</div><div class="panel-sub">แบ่งเส้นทางเป็น 4 กลุ่มจากต้นทุนที่ทราบและความสามารถทำกำไร · ขนาดจุดสะท้อนรายได้</div></div><div class="matrix-legend"><span class="star">Star</span><span class="volume">Volume Trap</span><span class="problem">Problem</span><span class="niche">Niche</span></div></div>${matrixScatterSVG(visible,xThreshold,yThreshold,f.profitability)}</div>
    <div class="matrix-quadrant-cards">${cards}</div>
    <div class="panel"><div class="panel-title">รายละเอียดและข้อเสนอเชิงบริหาร</div><div class="panel-sub">เรียงตาม ${matrixProfitLabel(f.profitability)} จากมากไปน้อย · ใช้ Matrix เป็นเครื่องมือคัดกรอง ไม่ใช่ข้อสรุปแทนข้อมูลเชิงปฏิบัติการ</div><div class="matrix-table-wrap"><table class="simple-table matrix-table"><thead><tr><th>เส้นทาง</th><th>กลุ่ม</th><th>รายได้</th><th>ต้นทุนที่ทราบ</th><th>Margin</th><th>ผลตอบแทน/ต้นทุน</th><th>ข้อเสนอเบื้องต้น</th></tr></thead><tbody>${sorted.length?sorted.map(r=>`<tr><td><b>${esc(r.route)}</b><small>${esc(routeDirectionLabel(r._direction))}</small></td><td><span class="matrix-badge ${matrixQuadrantMeta[r.quadrant].className}">${matrixQuadrantMeta[r.quadrant].short}</span></td><td>${moneyM(r.revenue)}</td><td>${moneyM(r.known_cost)}</td><td>${r.margin_pct===null?'N/A':pct(r.margin_pct)}</td><td>${r.return_on_cost_pct===null?'N/A':pct(r.return_on_cost_pct)}</td><td>${matrixQuadrantMeta[r.quadrant].recommendation}</td></tr>`).join(''):'<tr><td colspan="7">ไม่พบเส้นทางที่ตรงกับ Filter</td></tr>'}</tbody></table></div></div>
    <div class="page-note matrix-note"><b>ข้อจำกัดของเวอร์ชันนี้:</b> แกนต้นทุนใช้ “ต้นทุนที่ทราบต่อเส้นทาง” เป็น Proxy เพราะ Prepared Dataset ปัจจุบันยังไม่มีจำนวนเที่ยว น้ำหนัก หรือ Load Factor ในระดับเส้นทางครบถ้วน เมื่ออัปโหลด Trip/Manifest และ Vehicle Capacity แล้ว ควรเปลี่ยนแกน X เป็น Cost/Trip หรือ Cost/Ton เพื่อให้ตรงกับเมทริกซ์ “ต้นทุนต่อหน่วย vs. ผลกำไร” อย่างแท้จริง</div>`;
}

const fleetMetricLabels = {
  revenue: 'รายได้',
  known_cost: 'ต้นทุนที่ทราบ',
  contribution_after_repair: 'ส่วนต่างหลังต้นทุนที่ทราบ',
  margin_pct: 'Margin (%)',
  return_on_cost_pct: 'ผลตอบแทนต่อต้นทุน (%)'
};

function fleetRows(y) {
  return [...(y.vehicles || [])].map(v => {
    const revenue = Number(v.revenue || 0);
    const knownCost = Number(v.known_cost || 0);
    const contribution = Number(v.contribution_after_repair || 0);
    return {
      ...v,
      revenue,
      known_cost: knownCost,
      contribution_after_repair: contribution,
      margin_pct: revenue > 0 ? contribution / revenue * 100 : null,
      return_on_cost_pct: knownCost > 0 ? contribution / knownCost * 100 : null
    };
  });
}

function filteredFleet(y) {
  const f = state.fleetFilters;
  const q = (f.search || '').trim().toLowerCase();
  let rows = fleetRows(y);
  if (q) rows = rows.filter(v => String(v.vehicle || '').toLowerCase().includes(q));
  if (f.status === 'positive') rows = rows.filter(v => v.contribution_after_repair > 0);
  if (f.status === 'negative') rows = rows.filter(v => v.contribution_after_repair < 0);
  if (f.status === 'cost_ready') rows = rows.filter(v => v.known_cost > 0);
  const key = f.metric;
  rows.sort((a, b) => {
    const av = a[key], bv = b[key];
    const aMissing = av === null || av === undefined || !Number.isFinite(Number(av));
    const bMissing = bv === null || bv === undefined || !Number.isFinite(Number(bv));
    if (aMissing && bMissing) return 0;
    if (aMissing) return 1;
    if (bMissing) return -1;
    return f.sort === 'asc' ? Number(av) - Number(bv) : Number(bv) - Number(av);
  });
  return rows;
}

function fleetMetricText(v, key) {
  const n = v[key];
  if (n === null || n === undefined || !Number.isFinite(Number(n))) return 'N/A';
  if (key === 'margin_pct' || key === 'return_on_cost_pct') return pct(n);
  return moneyM(n);
}

function fleetBarsOrdered(data, key) {
  if (!data?.length) return '<div class="empty-state">ไม่พบชนิดรถที่ตรงกับ Filter</div>';
  const valid = data.filter(v => v[key] !== null && v[key] !== undefined && Number.isFinite(Number(v[key])));
  if (!valid.length) return '<div class="empty-state">ไม่มีข้อมูลต้นทุนเพียงพอสำหรับคำนวณตัวชี้วัดนี้</div>';
  const max = Math.max(...valid.map(v => Math.abs(Number(v[key]) || 0)), 1);
  return `<div class="bars fleet-bars">${data.map(v => {
    const raw = v[key];
    const missing = raw === null || raw === undefined || !Number.isFinite(Number(raw));
    const width = missing ? 0 : Math.max(2, Math.abs(Number(raw)) / max * 100);
    return `<div class="bar-row"><div title="${esc(v.vehicle)}">${esc(v.vehicle)}</div><div class="bar-bg"><div class="bar-fill ${Number(raw)<0?'negative-bar':''}" style="width:${width}%"></div></div><div class="bar-val ${Number(raw)<0?'loss':''}">${fleetMetricText(v,key)}</div></div>`;
  }).join('')}</div>`;
}

function fleetFilterControls() {
  const f = state.fleetFilters;
  return `<div class="fleet-filter-bar">
    <label><span>ตัวชี้วัด</span><select data-fleet-control="metric">
      ${Object.entries(fleetMetricLabels).map(([k,v]) => `<option value="${k}" ${f.metric===k?'selected':''}>${v}</option>`).join('')}
    </select></label>
    <label><span>เรียงลำดับ</span><select data-fleet-control="sort"><option value="desc" ${f.sort==='desc'?'selected':''}>มาก → น้อย</option><option value="asc" ${f.sort==='asc'?'selected':''}>น้อย → มาก</option></select></label>
    <label><span>สถานะ</span><select data-fleet-control="status">
      <option value="all" ${f.status==='all'?'selected':''}>ทั้งหมด</option>
      <option value="positive" ${f.status==='positive'?'selected':''}>ส่วนต่างเป็นบวก</option>
      <option value="negative" ${f.status==='negative'?'selected':''}>ส่วนต่างติดลบ</option>
      <option value="cost_ready" ${f.status==='cost_ready'?'selected':''}>มีข้อมูลต้นทุน</option>
    </select></label>
    <label><span>จำนวนที่แสดง</span><select data-fleet-control="limit">${[10,12,20,50,999].map(n=>`<option value="${n}" ${Number(f.limit)===n?'selected':''}>${n===999?'ทั้งหมด':`${n} รายการ`}</option>`).join('')}</select></label>
    <label class="fleet-search"><span>ค้นหาชนิดรถ</span><input data-fleet-control="search" type="search" value="${esc(f.search)}" placeholder="เช่น รถ 10 ล้อ / หางพ่วง"></label>
  </div>`;
}

function fleetPage(y) {
  const f = state.fleetFilters;
  const rows = filteredFleet(y);
  const visible = rows.slice(0, Number(f.limit || 12));
  const totals = rows.reduce((a,v) => ({revenue:a.revenue+v.revenue, cost:a.cost+v.known_cost, contribution:a.contribution+v.contribution_after_repair}), {revenue:0,cost:0,contribution:0});
  const totalMargin = totals.revenue > 0 ? totals.contribution / totals.revenue * 100 : null;
  const totalRoc = totals.cost > 0 ? totals.contribution / totals.cost * 100 : null;
  const efficiencyRows = [...rows].filter(v => v.return_on_cost_pct !== null).sort((a,b)=>b.return_on_cost_pct-a.return_on_cost_pct).slice(0, Number(f.limit || 12));

  return `${fleetFilterControls()}
  <div class="fleet-summary">
    <div><span>ชนิดรถที่ตรงเงื่อนไข</span><b>${fmt(rows.length,0)}</b></div>
    <div><span>รายได้รวม</span><b>${moneyM(totals.revenue)}</b></div>
    <div><span>ต้นทุนที่ทราบรวม</span><b>${moneyM(totals.cost)}</b></div>
    <div><span>ส่วนต่างรวม</span><b class="${totals.contribution<0?'loss':'good'}">${moneyM(totals.contribution)}</b></div>
    <div><span>Margin รวม</span><b>${totalMargin===null?'N/A':pct(totalMargin)}</b></div>
    <div><span>ผลตอบแทนต่อต้นทุนรวม</span><b>${totalRoc===null?'N/A':pct(totalRoc)}</b></div>
  </div>
  <div class="grid fleet-analysis-grid">
    <div class="panel"><div class="panel-title">Ranking ตาม ${fleetMetricLabels[f.metric]}</div><div class="panel-sub">เรียง${f.sort==='desc'?'มากไปน้อย':'น้อยไปมาก'} · ใช้ข้อมูลต้นทุนที่มีใน Prepared Dataset</div>${fleetBarsOrdered(visible, f.metric)}</div>
    <div class="panel"><div class="panel-title">ความคุ้มค่าต่อต้นทุน</div><div class="panel-sub">ผลตอบแทนต่อต้นทุน = ส่วนต่างหลังต้นทุนที่ทราบ ÷ ต้นทุนที่ทราบ × 100 · รายการต้นทุน 0 จะแสดง N/A และไม่ถูกจัดเป็นอันดับสูงสุด</div>${fleetBarsOrdered(efficiencyRows, 'return_on_cost_pct')}</div>
  </div>
  <div class="panel" style="margin-top:12px"><div class="panel-head"><div><div class="panel-title">รายละเอียดชนิดรถ</div><div class="panel-sub">Margin = ส่วนต่าง ÷ รายได้ · ผลตอบแทนต่อต้นทุน = ส่วนต่าง ÷ ต้นทุนที่ทราบ</div></div></div><div class="fleet-table-wrap"><table class="simple-table fleet-table"><thead><tr><th>ชนิดรถ</th><th>รายได้</th><th>ค่าเดินทาง</th><th>น้ำมัน</th><th>ค่าซ่อม</th><th>ค่าเช่า</th><th>ต้นทุนที่ทราบ</th><th>ส่วนต่าง</th><th>Margin</th><th>ผลตอบแทน/ต้นทุน</th></tr></thead><tbody>${visible.length ? visible.map(v => `<tr><td><b>${esc(v.vehicle)}</b></td><td>${moneyM(v.revenue)}</td><td>${moneyM(v.travel)}</td><td>${moneyM(v.fuel)}</td><td>${moneyM(v.repair)}</td><td>${moneyM(v.rental)}</td><td>${moneyM(v.known_cost)}</td><td class="${v.contribution_after_repair < 0 ? 'loss' : 'good'}">${moneyM(v.contribution_after_repair)}</td><td>${v.margin_pct===null?'N/A':pct(v.margin_pct)}</td><td class="${v.return_on_cost_pct!==null && v.return_on_cost_pct<0?'loss':v.return_on_cost_pct!==null?'good':''}">${v.return_on_cost_pct===null?'N/A':pct(v.return_on_cost_pct)}</td></tr>`).join('') : '<tr><td colspan="10">ไม่พบข้อมูลตาม Filter</td></tr>'}</tbody></table></div></div>
  <div class="page-note fleet-note"><b>ข้อควรตีความ:</b> “ผลตอบแทนต่อต้นทุน” ช่วยเปรียบเทียบความคุ้มค่าของชนิดรถได้ดีกว่าดูยอดส่วนต่างอย่างเดียว แต่ตัวเลขนี้ใช้เฉพาะต้นทุนที่เว็บมีอยู่ (ค่าเดินทาง + น้ำมัน + ค่าซ่อม + ค่าเช่า) จึงยังไม่ใช่กำไรสุทธิหรือ ROA ของรถ และควรใช้ควบคู่กับ Margin และจำนวนงาน/การใช้รถ</div>`;
}

const serviceMetricLabels = {
  revenue: 'รายได้',
  cost: 'ต้นทุนตามข้อมูล',
  profit_metric: 'ผลตอบแทนตามต้นทุนที่มี',
  margin_pct: 'Margin (%)',
  return_on_cost_pct: 'ผลตอบแทนต่อต้นทุน (%)'
};

function serviceCostBasisIsFull(y) {
  return String(y.service_basis || '').includes('ตารางกำไร/ต้นทุน');
}

function serviceRows(y) {
  const fullBasis = serviceCostBasisIsFull(y);
  return [...(y.service_groups || [])].map(g => {
    const revenue = Number(g.revenue || 0);
    const cost = Number(g.cost || 0);
    const rawProfit = Number(g.profit ?? (revenue - cost));
    const hasCost = cost > 0;
    // ถ้าเป็น fallback ที่มีเพียงต้นทุนบางส่วนและต้นทุนเป็น 0
    // ห้ามตีความ Revenue ทั้งก้อนเป็นผลตอบแทน/Margin 100%
    const metricReady = fullBasis || hasCost;
    const profitMetric = metricReady ? rawProfit : null;
    const margin = metricReady && revenue > 0 ? rawProfit / revenue * 100 : null;
    const roc = hasCost ? rawProfit / cost * 100 : null;
    return {
      ...g,
      revenue,
      cost,
      raw_profit: rawProfit,
      profit_metric: profitMetric,
      margin_pct: margin,
      return_on_cost_pct: roc,
      cost_status: fullBasis ? 'prepared' : (hasCost ? 'partial' : 'missing')
    };
  });
}

function filteredServices(y) {
  const f = state.serviceFilters;
  const q = (f.search || '').trim().toLowerCase();
  let rows = serviceRows(y);
  if (q) rows = rows.filter(g => String(g.service || '').toLowerCase().includes(q));
  if (f.status === 'positive') rows = rows.filter(g => g.profit_metric !== null && g.profit_metric > 0);
  if (f.status === 'negative') rows = rows.filter(g => g.profit_metric !== null && g.profit_metric < 0);
  if (f.status === 'cost_ready') rows = rows.filter(g => g.cost > 0);
  if (f.status === 'cost_missing') rows = rows.filter(g => g.cost <= 0 || g.profit_metric === null);
  const key = f.metric;
  rows.sort((a, b) => {
    const av = a[key], bv = b[key];
    const aMissing = av === null || av === undefined || !Number.isFinite(Number(av));
    const bMissing = bv === null || bv === undefined || !Number.isFinite(Number(bv));
    if (aMissing && bMissing) return 0;
    if (aMissing) return 1;
    if (bMissing) return -1;
    return f.sort === 'asc' ? Number(av) - Number(bv) : Number(bv) - Number(av);
  });
  return rows;
}

function serviceMetricText(g, key) {
  const n = g[key];
  if (n === null || n === undefined || !Number.isFinite(Number(n))) return 'N/A';
  if (key === 'margin_pct' || key === 'return_on_cost_pct') return pct(n);
  return moneyM(n);
}

function serviceBarsOrdered(data, key) {
  if (!data?.length) return '<div class="empty-state">ไม่พบกลุ่มบริการที่ตรงกับ Filter</div>';
  const valid = data.filter(g => g[key] !== null && g[key] !== undefined && Number.isFinite(Number(g[key])));
  if (!valid.length) return '<div class="empty-state">ไม่มีข้อมูลต้นทุนเพียงพอสำหรับคำนวณตัวชี้วัดนี้</div>';
  const max = Math.max(...valid.map(g => Math.abs(Number(g[key]) || 0)), 1);
  return `<div class="bars fleet-bars">${data.map(g => {
    const raw = g[key];
    const missing = raw === null || raw === undefined || !Number.isFinite(Number(raw));
    const width = missing ? 0 : Math.max(2, Math.abs(Number(raw)) / max * 100);
    return `<div class="bar-row"><div title="${esc(g.service)}">${esc(g.service)}</div><div class="bar-bg"><div class="bar-fill ${Number(raw)<0?'negative-bar':''}" style="width:${width}%"></div></div><div class="bar-val ${Number(raw)<0?'loss':''}">${serviceMetricText(g,key)}</div></div>`;
  }).join('')}</div>`;
}

function serviceFilterControls() {
  const f = state.serviceFilters;
  return `<div class="fleet-filter-bar service-filter-bar">
    <label><span>ตัวชี้วัด</span><select data-service-control="metric">
      ${Object.entries(serviceMetricLabels).map(([k,v]) => `<option value="${k}" ${f.metric===k?'selected':''}>${v}</option>`).join('')}
    </select></label>
    <label><span>เรียงลำดับ</span><select data-service-control="sort"><option value="desc" ${f.sort==='desc'?'selected':''}>มาก → น้อย</option><option value="asc" ${f.sort==='asc'?'selected':''}>น้อย → มาก</option></select></label>
    <label><span>สถานะ</span><select data-service-control="status">
      <option value="all" ${f.status==='all'?'selected':''}>ทั้งหมด</option>
      <option value="positive" ${f.status==='positive'?'selected':''}>ผลตอบแทนเป็นบวก</option>
      <option value="negative" ${f.status==='negative'?'selected':''}>ผลตอบแทนติดลบ</option>
      <option value="cost_ready" ${f.status==='cost_ready'?'selected':''}>มีข้อมูลต้นทุน</option>
      <option value="cost_missing" ${f.status==='cost_missing'?'selected':''}>ต้นทุนยังไม่พอ</option>
    </select></label>
    <label><span>จำนวนที่แสดง</span><select data-service-control="limit">${[5,10,20,50,999].map(n=>`<option value="${n}" ${Number(f.limit)===n?'selected':''}>${n===999?'ทั้งหมด':`${n} รายการ`}</option>`).join('')}</select></label>
    <label class="fleet-search"><span>ค้นหากลุ่มบริการ</span><input data-service-control="search" type="search" value="${esc(f.search)}" placeholder="เช่น สินค้าทั่วไป / สินค้าแช่เย็น"></label>
  </div>`;
}

function serviceStatusBadge(g) {
  if (g.cost_status === 'prepared') return '<span class="data-status ready">Prepared cost</span>';
  if (g.cost_status === 'partial') return '<span class="data-status partial">ต้นทุนบางส่วน</span>';
  return '<span class="data-status missing">ต้นทุนยังไม่พอ</span>';
}

function serviceAnalysisSection() {
  const years = (state.data?.years || []).filter(y => y.service_groups?.length).sort((a,b) => b.year-a.year);
  const source = years.find(y => y.year === Number(state.serviceYear)) || years.find(y => y.year === Number(state.year)) || years[0];
  if (!source) return panel('วิเคราะห์กลุ่มบริการ', '', '<p>ยังไม่มีข้อมูลกลุ่มบริการจากไฟล์ที่ประมวลผล</p>');
  return `<section class="service-analysis-section"><div class="merged-section-heading"><h3>วิเคราะห์กลุ่มบริการ · Service Analysis</h3><p>แหล่งข้อมูล: ${esc(source.service_source || source.source)} · ปี ${source.year}</p></div><div class="page-note">ส่วนนี้ใช้ข้อมูลกลุ่มบริการปี ${source.year} แยกจากข้อมูลรถและ CM ปี ${state.year} · ${esc(source.service_basis)}<br>กลุ่มที่ไม่มีต้นทุนเพียงพอจะแสดงผลตอบแทนและ Margin เป็น N/A</div><label>ปีข้อมูลกลุ่มบริการ <select id="serviceYearFilter">${years.map(y => `<option value="${y.year}" ${y.year === source.year ? 'selected' : ''}>ปี ${y.year}</option>`).join('')}</select></label>${servicesPage(source)}</section>`;
}

function servicesPage(y) {
  const f = state.serviceFilters;
  const rows = filteredServices(y);
  const visible = rows.slice(0, Number(f.limit || 10));
  const usable = rows.filter(g => g.profit_metric !== null);
  const totals = usable.reduce((a,g) => ({revenue:a.revenue+g.revenue, cost:a.cost+g.cost, profit:a.profit+(g.profit_metric || 0)}), {revenue:0,cost:0,profit:0});
  const totalMargin = totals.revenue > 0 ? totals.profit / totals.revenue * 100 : null;
  const totalRoc = totals.cost > 0 ? totals.profit / totals.cost * 100 : null;
  const efficiencyRows = [...rows].filter(g => g.return_on_cost_pct !== null).sort((a,b)=>b.return_on_cost_pct-a.return_on_cost_pct).slice(0, Number(f.limit || 10));
  const basis = y.service_basis || 'ไม่พบคำอธิบายฐานต้นทุนของกลุ่มบริการ';
  const fullBasis = serviceCostBasisIsFull(y);

  return `${serviceFilterControls()}
  <div class="fleet-summary service-summary">
    <div><span>กลุ่มบริการที่ตรงเงื่อนไข</span><b>${fmt(rows.length,0)}</b></div>
    <div><span>รายได้รวม</span><b>${moneyM(rows.reduce((a,g)=>a+g.revenue,0))}</b></div>
    <div><span>ต้นทุนตามข้อมูลรวม</span><b>${moneyM(rows.reduce((a,g)=>a+g.cost,0))}</b></div>
    <div><span>ผลตอบแทนที่คำนวณได้</span><b class="${totals.profit<0?'loss':'good'}">${usable.length ? moneyM(totals.profit) : 'N/A'}</b></div>
    <div><span>Margin รวม</span><b>${totalMargin===null?'N/A':pct(totalMargin)}</b></div>
    <div><span>ผลตอบแทนต่อต้นทุนรวม</span><b>${totalRoc===null?'N/A':pct(totalRoc)}</b></div>
  </div>
  <div class="grid fleet-analysis-grid service-analysis-grid">
    <div class="panel"><div class="panel-title">Ranking ตาม ${serviceMetricLabels[f.metric]}</div><div class="panel-sub">เรียง${f.sort==='desc'?'มากไปน้อย':'น้อยไปมาก'} · ${esc(basis)}</div>${serviceBarsOrdered(visible, f.metric)}</div>
    <div class="panel"><div class="panel-title">ความคุ้มค่าต่อต้นทุน</div><div class="panel-sub">ผลตอบแทนต่อต้นทุน = ผลตอบแทนตามต้นทุนที่มี ÷ ต้นทุนตามข้อมูล × 100 · ต้นทุนเป็น 0 จะแสดง N/A</div>${serviceBarsOrdered(efficiencyRows, 'return_on_cost_pct')}</div>
  </div>
  <div class="panel" style="margin-top:12px"><div class="panel-head"><div><div class="panel-title">รายละเอียดกลุ่มบริการ</div><div class="panel-sub">Margin = ผลตอบแทน ÷ รายได้ · ผลตอบแทนต่อต้นทุน = ผลตอบแทน ÷ ต้นทุนตามข้อมูล</div></div></div><div class="fleet-table-wrap"><table class="simple-table fleet-table service-table"><thead><tr><th>กลุ่มบริการ</th><th>รายได้</th><th>ต้นทุนตามข้อมูล</th><th>ผลตอบแทน</th><th>Margin</th><th>ผลตอบแทน/ต้นทุน</th><th>สถานะข้อมูลต้นทุน</th></tr></thead><tbody>${visible.length ? visible.map(g => `<tr><td><b>${esc(g.service)}</b></td><td>${moneyM(g.revenue)}</td><td>${moneyM(g.cost)}</td><td class="${g.profit_metric!==null && g.profit_metric<0?'loss':g.profit_metric!==null?'good':''}">${g.profit_metric===null?'N/A':moneyM(g.profit_metric)}</td><td>${g.margin_pct===null?'N/A':pct(g.margin_pct)}</td><td class="${g.return_on_cost_pct!==null && g.return_on_cost_pct<0?'loss':g.return_on_cost_pct!==null?'good':''}">${g.return_on_cost_pct===null?'N/A':pct(g.return_on_cost_pct)}</td><td>${serviceStatusBadge(g)}</td></tr>`).join('') : '<tr><td colspan="7">ไม่พบข้อมูลตาม Filter</td></tr>'}</tbody></table></div></div>
  <div class="page-note fleet-note service-note"><b>ข้อควรตีความ:</b> ${fullBasis ? 'ปีนี้มีตารางกำไร/ต้นทุนกลุ่มบริการที่เตรียมไว้ ระบบจึงใช้ต้นทุนตามตารางนั้นในการคำนวณ' : 'ปีนี้ข้อมูลกลุ่มบริการที่อ่านได้เป็นต้นทุนบางส่วน (เช่น ค่าเช่ารถ) จึงควรตีความ Margin และผลตอบแทนต่อต้นทุนเป็น “ตามต้นทุนที่มี” ไม่ใช่กำไรสุทธิ'} · ฐานข้อมูล: ${esc(basis)}</div>`;
}

function scenarioDefaults(y) {
  const p = y.profit_summary || {}, t = y.overview?.totals || {};
  const saved = JSON.parse(localStorage.getItem(`nimScenario:${y.year}`) || 'null');
  return saved || {
    targetRevenueM: Number(((p.revenue || t.revenue || 0) / 1e6).toFixed(1)),
    travelReduction: 0,
    fuelReduction: 0,
    repairReduction: 0,
    rentalReduction: 0,
    scaleCosts: true,
    targetProfitM: Number(((p.profit || 0) / 1e6).toFixed(1))
  };
}

function scenarioPage(y) {
  const p = y.profit_summary || {}, t = y.overview?.totals || {};
  const baseRevenue = p.revenue || t.revenue || 0;
  const baseCost = p.cost || t.all_costs || 0;
  const baseProfit = p.profit || (baseRevenue - baseCost);
  const s = scenarioDefaults(y);
  if (!baseRevenue) return '<div class="panel"><div class="panel-title">ยังไม่มีข้อมูลฐานสำหรับ Scenario</div><p>ต้องมี Revenue และ Cost ของปีที่เลือกก่อน</p></div>';
  return `<div class="page-note"><b>Scenario Planning</b> เป็นการจำลองจากสมมติฐานของผู้บริหาร ไม่ใช่ Forecast ที่รับประกันผลลัพธ์ ระบบจะใช้ข้อมูลปี ${y.year} เป็นฐาน และคำนวณผลกระทบแบบ What-if</div>
  <div class="scenario-layout">
    <div class="panel scenario-inputs">
      <div class="panel-title">1. กำหนดสมมติฐาน</div>
      <div class="scenario-field"><label>ยอดขายเป้าหมาย (ล้านบาท)</label><input data-scenario="targetRevenueM" type="number" min="0" step="1" value="${s.targetRevenueM}"></div>
      <div class="scenario-field"><label>ลดต้นทุนค่าเดินทาง (%)</label><div class="scenario-inline"><input data-scenario="travelReduction" type="range" min="0" max="30" step="0.5" value="${s.travelReduction}"><input data-scenario="travelReduction" class="mini-input" type="number" min="0" max="100" step="0.5" value="${s.travelReduction}"></div></div>
      <div class="scenario-field"><label>ลดค่าน้ำมัน (%)</label><div class="scenario-inline"><input data-scenario="fuelReduction" type="range" min="0" max="30" step="0.5" value="${s.fuelReduction}"><input data-scenario="fuelReduction" class="mini-input" type="number" min="0" max="100" step="0.5" value="${s.fuelReduction}"></div></div>
      <div class="scenario-field"><label>ลดค่าซ่อม (%)</label><div class="scenario-inline"><input data-scenario="repairReduction" type="range" min="0" max="30" step="0.5" value="${s.repairReduction}"><input data-scenario="repairReduction" class="mini-input" type="number" min="0" max="100" step="0.5" value="${s.repairReduction}"></div></div>
      <div class="scenario-field"><label>ลดค่าเช่ารถ (%)</label><div class="scenario-inline"><input data-scenario="rentalReduction" type="range" min="0" max="30" step="0.5" value="${s.rentalReduction}"><input data-scenario="rentalReduction" class="mini-input" type="number" min="0" max="100" step="0.5" value="${s.rentalReduction}"></div></div>
      <div class="scenario-field mode-field"><label>พฤติกรรมต้นทุนเมื่อยอดขายเปลี่ยน</label><label class="toggle-row"><input id="scaleCosts" data-scenario="scaleCosts" type="checkbox" ${s.scaleCosts ? 'checked' : ''}><span>ให้ต้นทุนฐานปรับตามสัดส่วนยอดขาย</span></label><small>ปิดตัวเลือกนี้ หากต้องการจำลองว่าต้นทุนฐานคงที่และมีเฉพาะผลจากการลดต้นทุน</small></div>
    </div>
    <div class="panel">
      <div class="panel-title">2. ผลลัพธ์ประมาณการ</div>
      <div id="scenarioResults"></div>
    </div>
  </div>
  <div class="grid scenario-bottom">
    <div class="panel"><div class="panel-title">Current vs Scenario</div><div id="scenarioComparison"></div></div>
    <div class="panel"><div class="panel-title">Reverse Planning</div><div class="panel-sub">กำหนดผลตอบแทนเป้าหมาย แล้วระบบคำนวณยอดขายที่ต้องทำโดยใช้สมมติฐานต้นทุนเดียวกัน</div><div class="scenario-field"><label>ผลตอบแทนเป้าหมาย (ล้านบาท)</label><input data-scenario="targetProfitM" type="number" min="0" step="1" value="${s.targetProfitM}"></div><div id="reverseResult" class="reverse-result"></div></div>
  </div>
  <div class="panel" style="margin-top:12px"><div class="panel-title">ฐานข้อมูลที่ใช้ใน Scenario</div><table class="simple-table"><thead><tr><th>รายการ</th><th>ฐานปัจจุบัน</th></tr></thead><tbody><tr><td>Revenue</td><td>${moneyM(baseRevenue)}</td></tr><tr><td>Cost</td><td>${moneyM(baseCost)}</td></tr><tr><td>ผลตอบแทน</td><td>${moneyM(baseProfit)}</td></tr><tr><td>Travel</td><td>${moneyM(t.travel)}</td></tr><tr><td>Fuel</td><td>${moneyM(t.fuel)}</td></tr><tr><td>Repair</td><td>${moneyM(t.repair)}</td></tr><tr><td>Rental</td><td>${moneyM(t.rental)}</td></tr></tbody></table></div>`;
}

const customerQuadrants = {
  key_profit_generator: { label: 'ลูกค้าหลักที่สร้างผลตอบแทน', short: 'สร้างผลตอบแทนสูง', className: 'customer-q-key', meaning: 'รายได้สูงกว่าค่ามัธยฐานและ Margin เป็นบวก' },
  growth_opportunity: { label: 'โอกาสเติบโต', short: 'โอกาสเติบโต', className: 'customer-q-growth', meaning: 'รายได้ต่ำกว่าหรือเท่าค่ามัธยฐาน แต่ Margin เป็นบวก' },
  margin_leakage: { label: 'รายได้สูงแต่มีส่วนต่างติดลบ', short: 'ส่วนต่างรั่วไหล', className: 'customer-q-leakage', meaning: 'รายได้สูงกว่าค่ามัธยฐาน แต่ Margin ติดลบ' },
  review_renegotiate: { label: 'ทบทวน / เจรจาใหม่', short: 'ทบทวน / เจรจาใหม่', className: 'customer-q-review', meaning: 'รายได้ต่ำกว่าหรือเท่าค่ามัธยฐานและ Margin ติดลบ' }
};

const customerMoney = value => value === null || value === undefined || !Number.isFinite(Number(value)) ? 'N/A' : moneyM(value);
const customerPct = value => value === null || value === undefined || !Number.isFinite(Number(value)) ? 'N/A' : pct(value);
const customerStatusLabel = value => ({ 'Highly Profitable': 'สร้างกำไรสูง', Profitable: 'สร้างกำไร', Watch: 'ต้องเฝ้าระวัง', 'Loss Making': 'ขาดทุน' }[value] || value || 'ไม่มีข้อมูล');
const customerStrategicActionMeta = { PROTECT: ['รักษาฐาน', 'protect'], GROW: ['เพิ่มการเติบโต', 'grow'], MAINTAIN: ['คงระดับ', 'maintain'], REVIEW: ['ทบทวนสัญญา', 'review'] };
const customerStrategicActionLabel = value => (customerStrategicActionMeta[value] || ['ยังไม่มีข้อมูลเพียงพอ', ''])[0];
const customerStrategicActionClass = value => (customerStrategicActionMeta[value] || ['', ''])[1];

function customerData() { return state.data?.customer_summary; }

function customerQueueRows() {
  const summary = customerData(), f = state.customerFilters;
  if (!summary?.ok) return [];
  const q = (f.queueSearch || '').trim().toLowerCase();
  let rows = [...(summary.priority_queue || [])];
  if (q) rows = rows.filter(row => String(row.customer || '').toLowerCase().includes(q));
  if (f.status !== 'all') rows = rows.filter(row => row.profitability_status === f.status);
  if (f.segment !== 'all') rows = rows.filter(row => row.strategy_segment === f.segment);
  if (f.action !== 'all') rows = rows.filter(row => row.management_action === f.action);
  if (f.contribution === 'positive') rows = rows.filter(row => row.contribution > 0);
  if (f.contribution === 'negative') rows = rows.filter(row => row.contribution < 0);
  const key = f.sortMetric;
  rows.sort((a, b) => {
    const av = a[key], bv = b[key];
    if (av === null || av === undefined) return 1;
    if (bv === null || bv === undefined) return -1;
    const result = Number(av) - Number(bv);
    return f.sortDirection === 'asc' ? result : -result;
  });
  return rows;
}

function customerDetailRows() {
  const summary = customerData(), f = state.customerFilters;
  if (!summary?.ok) return [];
  const q = (f.detailSearch || '').trim().toLowerCase();
  let rows = [...(summary.rows || [])];
  if (q) rows = rows.filter(row => String(row.customer || '').toLowerCase().includes(q));
  return rows;
}

function customerFilterControls(summary) {
  const f = state.customerFilters;
  const segments = Object.keys(summary.strategy_segments || {});
  return `<div class="customer-filter-bar">
    <label><span>ค้นหาลูกค้าในคิว</span><input data-customer-control="queueSearch" type="search" value="${esc(f.queueSearch)}" placeholder="รหัสลูกค้า"></label>
    <label><span>สถานะการทำกำไร</span><select data-customer-control="status"><option value="all">ทั้งหมด</option>${['Highly Profitable','Profitable','Watch','Loss Making'].map(x => `<option value="${esc(x)}" ${f.status===x?'selected':''}>${customerStatusLabel(x)}</option>`).join('')}</select></label>
    <label><span>กลยุทธ์ลูกค้า</span><select data-customer-control="segment"><option value="all">ทั้งหมด</option>${segments.map(x => `<option value="${esc(x)}" ${f.segment===x?'selected':''}>${esc(x)}</option>`).join('')}</select></label>
    <label><span>แนวทางดำเนินการ</span><select data-customer-control="action"><option value="all">ทั้งหมด</option>${[['FIX / RENEGOTIATE','แก้ไข / เจรจาใหม่'],['REVIEW','ทบทวน'],['MONITOR','ติดตาม']].map(([x,label]) => `<option value="${x}" ${f.action===x?'selected':''}>${label}</option>`).join('')}</select></label>
    <label><span>สถานะ Contribution</span><select data-customer-control="contribution"><option value="loss" ${f.contribution==='loss'?'selected':''}>เฉพาะคิวขาดทุน</option><option value="negative" ${f.contribution==='negative'?'selected':''}>ติดลบ</option><option value="positive" ${f.contribution==='positive'?'selected':''}>เป็นบวก</option><option value="all" ${f.contribution==='all'?'selected':''}>ทั้งหมด</option></select></label>
    <label><span>เรียงตาม</span><select data-customer-control="sortMetric">${[['contribution','Contribution ติดลบ'],['profit_leakage','ส่วนต่างติดลบ'],['revenue','รายได้'],['margin_pct','Margin %'],['return_on_cost_pct','ผลตอบแทนต่อต้นทุน %']].map(([k,v]) => `<option value="${k}" ${f.sortMetric===k?'selected':''}>${v}</option>`).join('')}</select></label>
    <label><span>ทิศทางการเรียง</span><select data-customer-control="sortDirection"><option value="desc" ${f.sortDirection==='desc'?'selected':''}>มาก → น้อย</option><option value="asc" ${f.sortDirection==='asc'?'selected':''}>น้อย → มาก</option></select></label>
    <label><span>จำนวนคิวที่แสดง</span><select data-customer-control="queueLimit">${[25,50,100].map(n => `<option value="${n}" ${Number(f.queueLimit)===n?'selected':''}>สูงสุด ${n} ราย</option>`).join('')}</select></label>
  </div>`;
}

function customerQueueTable(rows) {
  const visible = rows.slice(0, Number(state.customerFilters.queueLimit || 50));
  return `<div class="customer-table-wrap"><table class="simple-table customer-table"><thead><tr><th>ลำดับ</th><th>ลูกค้า</th><th>รายได้</th><th>ต้นทุนจัดสรร</th><th>Contribution</th><th>Margin %</th><th>ผลตอบแทนต่อต้นทุน %</th><th>ส่วนต่างติดลบ</th><th>สถานะการทำกำไร<br><small>ดูจาก Margin</small></th><th>แนวทาง</th></tr></thead><tbody>${visible.length ? visible.map((row, index) => `<tr><td><b>${index + 1}</b></td><td><b>${esc(row.customer)}</b><small>${esc(row.strategy_segment || 'ไม่มีข้อมูล')}</small></td><td>${customerMoney(row.revenue)}</td><td>${customerMoney(row.allocated_cost)}</td><td class="loss">${customerMoney(row.contribution)}</td><td class="loss">${customerPct(row.margin_pct)}</td><td>${customerPct(row.return_on_cost_pct)}</td><td class="loss">${customerMoney(row.profit_leakage)}</td><td>${esc(customerStatusLabel(row.profitability_status))}</td><td><span class="customer-action ${row.management_action === 'FIX / RENEGOTIATE' ? 'fix' : row.management_action === 'REVIEW' ? 'review' : 'monitor'}">${row.management_action === 'FIX / RENEGOTIATE' ? 'แก้ไข / เจรจาใหม่' : row.management_action === 'REVIEW' ? 'ทบทวน' : 'ติดตาม'}</span></td></tr>`).join('') : '<tr><td colspan="10">ไม่พบลูกค้าที่ตรงกับตัวกรอง</td></tr>'}</tbody></table></div>`;
}

function customerBars(rows, valueKey, titleKey) {
  if (!rows?.length) return '<div class="empty-state">ไม่มีข้อมูล</div>';
  const max = Math.max(...rows.map(row => Math.abs(Number(row[valueKey] || 0))), 1);
  return `<div class="customer-bars ${valueKey === 'profit_leakage' ? 'customer-bars-leakage' : 'customer-bars-contribution'}">${rows.map(row => `<div class="customer-bar-row"><div><b>${esc(row.customer)}</b><small>${customerMoney(row.revenue)} รายได้</small></div><div class="customer-bar-track"><i style="width:${Math.max(3, Math.abs(Number(row[valueKey] || 0)) / max * 100)}%"></i></div><strong>${customerMoney(row[valueKey])}</strong></div>`).join('')}</div>`;
}

function customerMatrixSVG(summary) {
  const rows = (summary.rows || []).filter(row => row.matrix_quadrant && row.revenue !== null && row.margin_pct !== null);
  const threshold = summary.thresholds?.matrix_revenue_median;
  if (!rows.length || threshold === null || threshold === undefined) return '<div class="empty-state">ข้อมูลไม่เพียงพอสำหรับ Customer Profitability Matrix</div>';
  const w = 940, h = 460, pL = 72, pR = 30, pT = 34, pB = 62;
  const maxX = Math.max(...rows.map(row => row.revenue), 1) * 1.08;
  const minY = Math.min(...rows.map(row => row.margin_pct), 0);
  const maxY = Math.max(...rows.map(row => row.margin_pct), 10);
  const padY = Math.max((maxY - minY) * .08, 3);
  const yMin = minY - padY, yMax = maxY + padY;
  const x = value => pL + value / maxX * (w - pL - pR);
  const y = value => pT + (yMax - value) / (yMax - yMin) * (h - pT - pB);
  const xT = x(threshold), yT = y(0);
  const colors = { key_profit_generator: '#2da56f', growth_opportunity: '#e7ad35', margin_leakage: '#e65b66', review_renegotiate: '#3b78d8' };
  let grid = '';
  for (let i = 0; i <= 5; i++) { const value = maxX * i / 5, xx = x(value); grid += `<line x1="${xx}" y1="${pT}" x2="${xx}" y2="${h-pB}" stroke="#dfe7f0"/><text x="${xx}" y="${h-pB+22}" text-anchor="middle" class="customer-axis-tick">${fmt(value/1e6,1)}M</text>`; }
  for (let i = 0; i <= 5; i++) { const value = yMin + (yMax-yMin) * i / 5, yy = y(value); grid += `<line x1="${pL}" y1="${yy}" x2="${w-pR}" y2="${yy}" stroke="#dfe7f0"/><text x="${pL-10}" y="${yy+4}" text-anchor="end" class="customer-axis-tick">${fmt(value,0)}%</text>`; }
  const dots = rows.map(row => `<circle class="customer-matrix-point" role="button" tabindex="0" data-customer-open="${esc(row.customer)}" aria-label="ดูรายละเอียดลูกค้า ${esc(row.customer)}" cx="${x(row.revenue)}" cy="${y(row.margin_pct)}" r="${4 + Math.sqrt(row.revenue / maxX) * 8}" fill="${colors[row.matrix_quadrant]}" fill-opacity=".84" stroke="#fff" stroke-width="1.5"><title>${esc(row.customer)}\nRevenue: ${customerMoney(row.revenue)}\nMargin: ${customerPct(row.margin_pct)}\n${customerQuadrants[row.matrix_quadrant].label}</title></circle>`).join('');
  return `<div class="customer-chart-wrap"><svg class="customer-matrix-svg" viewBox="0 0 ${w} ${h}" role="group" aria-label="เมทริกซ์รายได้และ Margin ลูกค้า"><rect x="${pL}" y="${pT}" width="${xT-pL}" height="${yT-pT}" fill="#fff8e8"/><rect x="${pL}" y="${yT}" width="${xT-pL}" height="${h-pB-yT}" fill="#edf4ff"/><rect x="${xT}" y="${yT}" width="${w-pR-xT}" height="${h-pB-yT}" fill="#fff0f2"/><rect x="${xT}" y="${pT}" width="${w-pR-xT}" height="${yT-pT}" fill="#eaf8f1"/>${grid}<text x="${pL+12}" y="${pT+20}" class="customer-q-label growth">โอกาสเติบโต</text><text x="${xT+12}" y="${pT+20}" class="customer-q-label key">สร้างผลตอบแทนสูง</text><text x="${xT+12}" y="${h-pB-12}" class="customer-q-label leakage">ส่วนต่างรั่วไหล</text><text x="${pL+12}" y="${h-pB-12}" class="customer-q-label review">ทบทวน / เจรจาใหม่</text><line x1="${xT}" y1="${pT}" x2="${xT}" y2="${h-pB}" stroke="#6f8096" stroke-width="2" stroke-dasharray="6 5"/><line x1="${pL}" y1="${yT}" x2="${w-pR}" y2="${yT}" stroke="#6f8096" stroke-width="2" stroke-dasharray="6 5"/>${dots}<text x="${(pL+w-pR)/2}" y="${h-12}" text-anchor="middle" class="customer-axis-label">รายได้ (ล้านบาท) · เส้นแบ่ง = ค่ามัธยฐานรายได้</text><text x="18" y="${(pT+h-pB)/2}" transform="rotate(-90 18 ${(pT+h-pB)/2})" text-anchor="middle" class="customer-axis-label">Margin % · เส้นแบ่ง = จุดคุ้มทุน 0%</text></svg></div>`;
}

function customerPortfolio(summary) {
  return `<div class="customer-portfolio-grid">${Object.entries(customerQuadrants).map(([key, meta]) => { const item = summary.matrix?.[key] || {}; return `<div class="customer-portfolio-card ${meta.className}" role="button" tabindex="0" data-customer-group="${key}" aria-label="ดูรายชื่อลูกค้ากลุ่ม ${meta.label}"><div><span>${meta.label}</span><b>${fmt(item.customer_count,0)} ราย</b></div><small>${meta.meaning}</small><p>รายได้รวมของกลุ่ม ${customerMoney(item.revenue)}<br>Contribution รวมของกลุ่ม ${customerMoney(item.contribution)}</p><strong>${customerPct(item.customer_share_pct)} ของลูกค้าทั้งหมด</strong></div>`; }).join('')}</div>`;
}

function customerDetailTable(summary) {
  const f = state.customerFilters;
  const rows = customerDetailRows();
  const pages = Math.max(1, Math.ceil(rows.length / Number(f.detailLimit || 50)));
  const page = Math.min(Math.max(Number(f.detailPage || 1), 1), pages);
  f.detailPage = page;
  const visible = rows.slice((page - 1) * Number(f.detailLimit || 50), page * Number(f.detailLimit || 50));
  return `<div class="panel customer-detail-panel"><div class="panel-head"><div><div class="panel-title">รายละเอียดลูกค้ารายคน</div><div class="panel-sub">${fmt(rows.length,0)} รายการตามคำค้น · แสดงครั้งละ ${f.detailLimit} รายการ</div></div><div class="customer-detail-controls"><input data-customer-control="detailSearch" type="search" value="${esc(f.detailSearch)}" placeholder="ค้นหารหัสลูกค้า"><select data-customer-control="detailLimit">${[25,50,100].map(n => `<option value="${n}" ${Number(f.detailLimit)===n?'selected':''}>${n} รายการ</option>`).join('')}</select></div></div><div class="customer-table-wrap"><table class="simple-table customer-table detail-table"><thead><tr><th>ลูกค้า</th><th>รายได้</th><th>ต้นทุนจัดสรร</th><th>Contribution</th><th>Margin</th><th>ผลตอบแทนต่อต้นทุน</th><th>กลยุทธ์ลูกค้า</th><th>สถานะการทำกำไร</th><th>แนวทางเชิงกลยุทธ์</th></tr></thead><tbody>${visible.length ? visible.map(row => `<tr><td><b>${esc(row.customer)}</b></td><td>${customerMoney(row.revenue)}</td><td>${customerMoney(row.allocated_cost)}</td><td class="${row.contribution < 0 ? 'loss' : 'good'}">${customerMoney(row.contribution)}</td><td class="${row.margin_pct < 0 ? 'loss' : 'good'}">${customerPct(row.margin_pct)}</td><td>${customerPct(row.return_on_cost_pct)}</td><td>${esc(row.strategy_segment || 'ไม่มีข้อมูล')}</td><td>${esc(customerStatusLabel(row.profitability_status))}</td><td><span class="strategic-action ${customerStrategicActionClass(row.strategic_action)}">${customerStrategicActionLabel(row.strategic_action)}</span></td></tr>`).join('') : '<tr><td colspan="9">ไม่พบลูกค้าที่ตรงกับคำค้น</td></tr>'}</tbody></table></div><div class="customer-pagination"><button data-customer-page="prev" ${page <= 1 ? 'disabled' : ''}>ก่อนหน้า</button><span>หน้า ${page} / ${pages}</span><button data-customer-page="next" ${page >= pages ? 'disabled' : ''}>ถัดไป</button></div></div>`;
}

function customerPage() {
  const summary = customerData();
  if (!summary?.ok) return `<div class="panel"><div class="panel-title">Customer Profitability ยังไม่พร้อมใช้งาน</div><p>${esc(summary?.errors?.join(' · ') || 'ไม่พบข้อมูลลูกค้าที่ผ่าน schema')}</p></div>`;
  const t = summary.totals || {};
  const queueRows = customerQueueRows();
  return `<div class="customer-page-intro"><div><div class="eyebrow">วิเคราะห์เศรษฐศาสตร์ลูกค้า</div><h2>กำไรลูกค้าและลำดับความสำคัญในการบริหาร</h2><p>วิเคราะห์ความสามารถในการทำกำไรและคัดเลือกลูกค้าที่ผู้บริหารควรดำเนินการก่อน</p></div><span class="customer-source-badge">${esc(summary.source)} · ลูกค้า ${fmt(summary.row_count,0)} ราย</span></div>
  <div class="customer-kpis">${customerKpi('จำนวนลูกค้าทั้งหมด', fmt(t.customer_count,0), 'จากข้อมูลลูกค้ารายคน', '◎','blue')}${customerKpi('รายได้รวม', customerMoney(t.revenue), 'รวมลูกค้าทั้งหมด', '฿','blue')}${customerKpi('ต้นทุนที่จัดสรร', customerMoney(t.allocated_cost), 'ต้นทุนตามข้อมูลลูกค้า', '▣','amber')}${customerKpi('Contribution รวม', customerMoney(t.contribution), 'รายได้ - ต้นทุนจัดสรร', '▲','green')}${customerKpi('Margin รวม', customerPct(t.margin_pct), 'Contribution ÷ รายได้', '%','purple')}${customerKpi('ลูกค้า Contribution ติดลบ', fmt(t.loss_making_count,0), 'เข้าสู่คิวบริหาร', '▼','coral')}${customerKpi('ส่วนต่างติดลบ (Profit Leakage)', customerMoney(t.profit_leakage), 'รวมเฉพาะลูกค้าที่ขาดทุน', '⚠','coral')}${customerKpi('รายได้ที่มีความเสี่ยง', customerMoney(t.revenue_at_risk), 'รายได้ของลูกค้าที่ขาดทุน', '◌','amber')}</div>
  <div class="grid customer-analysis-grid"><div class="panel"><div class="panel-title">ลูกค้าที่สร้าง Contribution สูงสุด</div><div class="panel-sub">10 อันดับแรก เฉพาะลูกค้าที่ Contribution เป็นบวก</div>${customerBars(summary.top_contributors, 'contribution', 'Contribution')}</div><div class="panel"><div class="panel-title">ลูกค้าที่มีส่วนต่างติดลบสูงสุด</div><div class="panel-sub">10 อันดับแรก เรียงตามขนาด Profit Leakage</div>${customerBars(summary.largest_leakage, 'profit_leakage', 'Profit Leakage')}</div></div>
  <div class="panel customer-matrix-panel"><div class="panel-head"><div><div class="panel-title">เมทริกซ์กำไรลูกค้า</div><div class="panel-sub">แกน X = รายได้ · แกน Y = Margin % · เส้นแบ่งรายได้ใช้ค่ามัธยฐาน ${customerMoney(summary.thresholds?.matrix_revenue_median)} · จุดคุ้มทุน = 0%</div></div></div><div class="panel-sub">กดจุดเพื่อดูรายละเอียดลูกค้า · กดการ์ดกลุ่มด้านล่างเพื่อดูรายชื่อ</div>${customerMatrixSVG(summary)}</div>
  ${customerPortfolio(summary)}
  <div class="panel customer-queue-panel"><div class="panel-head"><div><div class="panel-title">ลูกค้าที่มี Contribution ติดลบ</div><div class="panel-sub">เรียงจากยอดขาดทุนมากไปน้อย · พบ ${fmt(queueRows.length,0)} รายการตามตัวกรอง</div></div></div><div class="customer-queue-guide"><b>อ่านตารางนี้อย่างไร?</b><span><strong>Contribution</strong>: ส่วนต่างหลังหักต้นทุนจัดสรรแล้ว ถ้าติดลบแปลว่ารายได้น้อยกว่าต้นทุน</span><span><strong>สถานะการทำกำไร</strong>: จัดกลุ่มจาก Margin เพื่อบอกระดับการทำกำไรหรือขาดทุน</span></div>${customerFilterControls(summary)}${customerQueueTable(queueRows)}</div>
  ${customerDetailTable(summary)}
  <div class="page-note customer-note"><b>หลักการคำนวณ:</b> คะแนนความสำคัญ = 50% คะแนนขนาดส่วนต่างติดลบ + 30% คะแนนรายได้ที่มีความเสี่ยง + 20% คะแนนความรุนแรงของ Margin โดยจัดอันดับ Percentile เฉพาะกลุ่มลูกค้าที่ขาดทุนเท่านั้น · หากข้อมูลไม่พร้อมจะแสดง N/A</div>`;
}

function selectedTripSummary() {
  return state.data?.trip_summaries?.[String(state.year)] || (state.data?.trip_summary?.year === Number(state.year) ? state.data.trip_summary : {});
}

function tripMoney(value) { return value === null || value === undefined || !Number.isFinite(Number(value)) ? 'N/A' : `฿ ${fmt(value, 2)}`; }
function tripPct(value) { return value === null || value === undefined || !Number.isFinite(Number(value)) ? 'N/A' : pct(Number(value) * 100); }
function tripKg(value) { return value === null || value === undefined || !Number.isFinite(Number(value)) ? 'N/A' : `${fmt(value / 1000, 1)} ตัน`; }

function tripDataNotice(trips) {
  const q = trips?.data_quality || {};
  return `<div class="data-quality-strip"><span><b>ข้อมูลปกติ</b> ${fmt(trips?.normal_rows || 0, 0)} แถว</span><span><b>ตัดออก</b> ${fmt(trips?.excluded_rows || 0, 0)} แถว</span><span><b>เที่ยวที่มี Load Factor ใช้ได้</b> ${fmt(q.validated_candidate_trip_loads || trips?.totals?.validated_trip_load_count || 0, 0)}</span><span><b>รายละเอียด Data Quality</b> ดูที่ Data / Settings</span></div>`;
}

function tripRecordTable(trips) {
  const rows = [...(trips?.rows || [])].sort((a, b) => Number(b.contribution || 0) - Number(a.contribution || 0)).slice(0, 100);
  return `<div class="trip-table-wrap"><table class="simple-table trip-table"><thead><tr><th>เที่ยวอ้างอิง</th><th>เส้นทาง</th><th>ทิศทาง</th><th>ชนิดรถ</th><th>น้ำหนัก</th><th>รายได้</th><th>ต้นทุน</th><th>Contribution</th><th>Margin</th><th>Load Factor</th><th>ต้นทุน/ตัน</th></tr></thead><tbody>${rows.length ? rows.map(row => { const margin = row.revenue ? row.contribution / row.revenue * 100 : null; return `<tr><td><b>${esc(row.trip_reference || 'N/A')}</b><small>${row.rows_in_source} source rows</small></td><td>${esc(row.route || 'N/A')}</td><td>${esc(row.direction || 'N/A')}</td><td>${esc(row.vehicle_type || 'N/A')}</td><td>${tripKg(row.weight_kg)}</td><td>${tripMoney(row.revenue)}</td><td>${tripMoney(row.known_cost)}</td><td class="${row.contribution < 0 ? 'loss' : 'good'}">${tripMoney(row.contribution)}</td><td class="${margin !== null && margin < 0 ? 'loss' : 'good'}">${margin === null ? 'N/A' : pct(margin)}</td><td>${tripPct(row.load_factor)}</td><td>${row.cost_per_ton === null || row.cost_per_ton === undefined ? 'N/A' : `฿ ${fmt(row.cost_per_ton, 0)}`}</td></tr>`; }).join('') : '<tr><td colspan="11">ไม่มีข้อมูลเที่ยวที่ผ่านการประมวลผล</td></tr>'}</tbody></table></div>`;
}

function tripAggregateTable(rows, labelKey, labelName) {
  const visible = [...(rows || [])].sort((a, b) => Number(b.contribution || 0) - Number(a.contribution || 0)).slice(0, 100);
  return `<div class="trip-table-wrap"><table class="simple-table trip-table aggregate-trip-table"><thead><tr><th>${labelName}</th><th>จำนวน candidate records</th><th>รายได้</th><th>ต้นทุน</th><th>Contribution</th><th>Load Factor</th><th>รายได้/เที่ยว</th><th>ต้นทุน/เที่ยว</th><th>Contribution/เที่ยว</th><th>ต้นทุน/ตัน</th></tr></thead><tbody>${visible.length ? visible.map(row => `<tr><td><b>${esc(row[labelKey] || 'ไม่ระบุ')}</b></td><td>${fmt(row.trip_count, 0)}</td><td>${tripMoney(row.revenue)}</td><td>${tripMoney(row.known_cost)}</td><td class="${row.contribution < 0 ? 'loss' : 'good'}">${tripMoney(row.contribution)}</td><td>${tripPct(row.load_factor)}</td><td>${tripMoney(row.revenue_per_trip)}</td><td>${tripMoney(row.cost_per_trip)}</td><td>${tripMoney(row.contribution_per_trip)}</td><td>${row.cost_per_ton === null || row.cost_per_ton === undefined ? 'N/A' : `฿ ${fmt(row.cost_per_ton, 0)}`}</td></tr>`).join('') : '<tr><td colspan="10">ไม่มีข้อมูลสรุป</td></tr>'}</tbody></table></div>`;
}

function routeLoadFactorComparison(rows) {
  const visible = [...(rows || [])].filter(row => row.load_factor !== null && row.load_factor !== undefined).sort((a, b) => Number(b.contribution || 0) - Number(a.contribution || 0)).slice(0, 100);
  return `<div class="trip-table-wrap"><table class="simple-table trip-table aggregate-trip-table"><thead><tr><th>เส้นทาง</th><th>จำนวนเที่ยวอ้างอิง</th><th>Contribution รวม</th><th>Load Factor เฉลี่ย</th><th>ต่ำกว่า 70%</th><th>ต่ำกว่าจุดคุ้มทุน</th><th>ต้นทุน/ตัน</th></tr></thead><tbody>${visible.length ? visible.map(row => `<tr><td><b>${esc(row.route || 'ไม่ระบุ')}</b></td><td>${fmt(row.trip_count, 0)}</td><td class="${row.contribution < 0 ? 'loss' : 'good'}">${tripMoney(row.contribution)}</td><td>${tripPct(row.load_factor)}</td><td>${fmt(row.below_70_records, 0)} records</td><td>${fmt(row.below_break_even_records, 0)} records</td><td>${row.cost_per_ton === null || row.cost_per_ton === undefined ? 'N/A' : `฿ ${fmt(row.cost_per_ton, 0)}`}</td></tr>`).join('') : '<tr><td colspan="7">ยังไม่มีเส้นทางที่มี Load Factor ผ่านการตรวจสอบเพียงพอ</td></tr>'}</tbody></table></div>`;
}

function tripRoutePage(y) {
  const trips = selectedTripSummary();
  const rows = filteredRoutes(y);
  const tripRoutes = trips.routes || [];
  const normalizeRoute = value => String(value || '').replace(/→/g, '-').replace(/\s+/g, '').trim();
  const tripMap = new Map(tripRoutes.map(row => [normalizeRoute(row.route), row]));
  const merged = rows.map(row => ({ ...row, trip: tripMap.get(normalizeRoute(row.route)) || null }));
  const revenue = rows.reduce((sum, row) => sum + Number(row.revenue || 0), 0);
  const contribution = rows.reduce((sum, row) => sum + Number(row.contribution || 0), 0);
  // Load Factor is prepared and validated server-side. The workbook's
  // "Load Factor ที่ใช้จริง" may be weight- or volume-based, so never rebuild
  // a global LF in the browser by mixing route weight with only weight capacity.
  const avgLoad = trips.totals?.avg_load_factor ?? null;
  const belowBreakEven = trips.totals?.below_break_even_records ?? tripRoutes.reduce((sum, row) => sum + Number(row.below_break_even_records || 0), 0);
  const ranking = merged.slice(0, 8);
  const routeAction = row => !row.trip?.load_factor && row.contribution >= 0 ? 'Monitor' : row.contribution < 0 ? 'Review Pricing' : row.trip.load_factor < .7 ? 'Improve Load' : 'Efficient';
  const routeActionThai = action => ({ 'Improve Load': 'เพิ่ม Load', 'Review Pricing': 'ทบทวนราคา', Monitor: 'ติดตาม', Efficient: 'มีประสิทธิภาพ' }[action] || action);
  return `<div class="executive-route-page"><div class="merged-page-intro"><div><div class="eyebrow">TRIP ECONOMICS</div><h2>Trip &amp; Route Profitability</h2><p>วิเคราะห์เส้นทางที่ทำกำไร และคัดเส้นทางที่ควรจัดการก่อน</p></div><span class="customer-source-badge">${esc(trips.source || 'ยังไม่มีข้อมูลเที่ยว')}</span></div>${executiveRouteFilterControls()}
  <div class="route-executive-kpis"><div class="route-executive-kpi blue"><span>จำนวนเส้นทางที่วิเคราะห์</span><b>${fmt(rows.length, 0)}</b><small>จากเส้นทางที่ตรงเงื่อนไข</small></div><div class="route-executive-kpi green"><span>Contribution รวม</span><b>${moneyM(contribution)}</b><small>รวมจากเส้นทางที่เลือก</small></div><div class="route-executive-kpi violet"><span>Load Factor เฉลี่ย</span><b>${avgLoad === null ? 'N/A' : tripPct(avgLoad)}</b><small>เฉลี่ยจากเที่ยวที่ผ่าน validation</small></div><div class="route-executive-kpi red"><span>เที่ยวต่ำกว่าจุดคุ้มทุน</span><b>${fmt(belowBreakEven, 0)}</b><small>จากข้อมูลเที่ยวที่ตรวจสอบได้</small></div></div>
  <div class="route-visual-grid"><div class="panel routes-attention-panel"><div class="panel-head"><div><div class="panel-title">Routes Requiring Attention</div><div class="panel-sub">เส้นทางที่ควรจัดการก่อน โดยพิจารณาจาก ${esc(routeMetricLabels[state.routeFilters.metric])}, Load Factor และข้อมูลต้นทุนที่มี</div></div></div><div class="attention-list">${ranking.length ? ranking.map((row, index) => { const action = routeAction(row); return `<div class="attention-row"><div class="attention-route"><b>${esc(row.route)}</b><small>${esc(routeDirectionLabel(row._direction))}</small></div><div class="attention-bar"><i style="width:${Math.max(5, Math.min(100, (index === 0 ? 100 : (ranking.length - index) / ranking.length * 100)))}%"></i></div><strong class="attention-rank">${index + 1}</strong><span class="route-action-chip ${action.toLowerCase().replace(/\s+/g, '-').replace('pricing','pricing')}">${routeActionThai(action)}</span></div>`; }).join('') : '<div class="empty-state">ไม่พบเส้นทางตามตัวกรอง</div>'}</div></div><div class="route-right-stack"><div class="panel route-scatter-panel"><div class="panel-head"><div><div class="panel-title">Profitability vs Load Factor</div><div class="panel-sub">การกระจายของเส้นทางตาม Load Factor และ Contribution ต่อเที่ยว</div></div></div>${routeProfitLoadScatter(tripRoutes.filter(row => !state.routeFilters.search || String(row.route || '').toLowerCase().includes(state.routeFilters.search.toLowerCase())))}</div><div class="panel executive-actions-panel"><div class="panel-title">Executive Actions</div><div class="panel-sub">ข้อเสนอแนะสำคัญสำหรับผู้บริหาร</div>${routeExecutiveActions(merged)}</div></div></div>
  <div class="panel route-diagnostic-panel"><div class="panel-head"><div><div class="panel-title">Route Diagnostic Table</div><div class="panel-sub">รายละเอียดเส้นทางและตัวชี้วัดสำคัญ · แสดง ${Math.min(10, merged.length)} รายการแรก</div></div></div>${routeDiagnosticTable(merged, routeAction, routeActionThai)}</div></div>`;
}

function executiveRouteFilterControls() {
  const f = state.routeFilters;
  return `<div class="executive-route-filters"><label><span>มุมมอง</span><select data-route-control="view"><option value="attention" ${f.view==='attention'?'selected':''}>ต้องจัดการก่อน</option><option value="all" ${f.view==='all'?'selected':''}>ทุกเส้นทาง</option></select></label><label><span>Direction</span><select data-route-control="direction">${['all','bkk_north','north_bkk','north_internal','other'].map(x => `<option value="${x}" ${f.direction===x?'selected':''}>${routeDirectionLabel(x)}</option>`).join('')}</select></label><label><span>Metric</span><select data-route-control="metric">${Object.entries(routeMetricLabels).map(([k,v]) => `<option value="${k}" ${f.metric===k?'selected':''}>${v}</option>`).join('')}</select></label><label><span>Sort</span><select data-route-control="sort"><option value="desc" ${f.sort==='desc'?'selected':''}>มาก → น้อย</option><option value="asc" ${f.sort==='asc'?'selected':''}>น้อย → มาก</option></select></label><label><span>สถานะ</span><select data-route-control="status"><option value="all" ${f.status==='all'?'selected':''}>ทั้งหมด</option><option value="positive" ${f.status==='positive'?'selected':''}>Contribution เป็นบวก</option><option value="negative" ${f.status==='negative'?'selected':''}>Contribution ติดลบ</option><option value="margin_low" ${f.status==='margin_low'?'selected':''}>Margin ต่ำกว่า 10%</option><option value="roc_low" ${f.status==='roc_low'?'selected':''}>ผลตอบแทน/ต้นทุนต่ำ</option></select></label><label><span>จำนวนที่แสดง</span><select data-route-control="limit">${[10,25,50,100].map(n => `<option value="${n}" ${Number(f.limit)===n?'selected':''}>${n} เส้นทาง</option>`).join('')}</select></label><label class="executive-route-search"><span>ค้นหาเส้นทาง</span><input data-route-control="search" type="search" value="${esc(f.search)}" placeholder="ค้นหาเส้นทาง"></label></div>`;
}

function routeProfitLoadScatter(rows) {
  const points = rows.map(row => row.trip ? row : ({ route: row.route, trip: row })).filter(row => row.trip?.load_factor !== null && row.trip?.load_factor !== undefined && Number.isFinite(Number(row.trip?.contribution_per_trip)) && Number.isFinite(Number(row.trip?.load_factor))).slice(0, 80);
  if (!points.length) return '<div class="empty-state">ยังไม่มีข้อมูล Load Factor และ Contribution/เที่ยวที่ผ่าน validation</div>';
  const w = 520, h = 250, pL = 48, pR = 18, pT = 18, pB = 38;
  const maxY = Math.max(...points.map(row => Math.abs(row.trip.contribution_per_trip)), 1) * 1.15;
  const x = value => pL + value * (w - pL - pR);
  const y = value => pT + (maxY - value) / (maxY * 2) * (h - pT - pB);
  const x70 = x(.7), y0 = y(0);
  const dots = points.map(row => { const lf = row.trip.load_factor; const contribution = row.trip.contribution_per_trip; const good = contribution >= 0; const loadGood = lf >= .7; const color = good && loadGood ? '#1aa674' : good ? '#e8ad2f' : '#e75b66'; const label = good && loadGood ? 'Star' : good ? 'Improve Load' : loadGood ? 'Load ดี แต่กำไรต่ำ' : 'Review'; return `<circle cx="${x(lf)}" cy="${y(contribution)}" r="5" fill="${color}" fill-opacity=".88" stroke="#fff" stroke-width="1"><title>${esc(row.route)}\nLoad Factor: ${tripPct(lf)}\nContribution/เที่ยว: ${tripMoney(contribution)}\n${label}</title></circle>`; }).join('');
  return `<div class="route-scatter-wrap"><svg class="route-scatter-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="Profitability versus Load Factor"><rect x="${pL}" y="${pT}" width="${x70-pL}" height="${y0-pT}" fill="#fff7e5"/><rect x="${x70}" y="${pT}" width="${w-pR-x70}" height="${y0-pT}" fill="#eaf8f1"/><rect x="${pL}" y="${y0}" width="${x70-pL}" height="${h-pB-y0}" fill="#fff0f2"/><rect x="${x70}" y="${y0}" width="${w-pR-x70}" height="${h-pB-y0}" fill="#f3f7fb"/> <line x1="${x70}" y1="${pT}" x2="${x70}" y2="${h-pB}" stroke="#9aacc0" stroke-dasharray="5 4"/><line x1="${pL}" y1="${y0}" x2="${w-pR}" y2="${y0}" stroke="#9aacc0"/><text x="${pL+8}" y="${pT+15}" class="route-zone-label amber">Improve Load</text><text x="${x70+8}" y="${pT+15}" class="route-zone-label green">Star</text><text x="${pL+8}" y="${h-pB-8}" class="route-zone-label red">Review</text><text x="${x70+8}" y="${h-pB-8}" class="route-zone-label blue">Load ดี แต่กำไรต่ำ</text><text x="${(pL+w-pR)/2}" y="${h-8}" text-anchor="middle" class="route-axis-label">Load Factor (%)</text><text x="14" y="${(pT+h-pB)/2}" transform="rotate(-90 14 ${(pT+h-pB)/2})" text-anchor="middle" class="route-axis-label">Contribution / Trip</text><text x="${pL}" y="${h-pB+18}" class="route-axis-tick">0</text><text x="${x70-8}" y="${h-pB+18}" class="route-axis-tick">70</text><text x="${w-pR-12}" y="${h-pB+18}" class="route-axis-tick">100</text>${dots}</svg></div>`;
}

function routeExecutiveActions(rows) {
  const lowLoad = rows.filter(row => row.trip?.load_factor !== null && row.trip?.load_factor < .7).length;
  const loss = rows.filter(row => row.contribution < 0).length;
  const highCost = rows.filter(row => row.trip?.cost_per_ton !== null && row.trip?.cost_per_ton > 2000).length;
  const actions = [];
  if (lowLoad) actions.push(`มี ${fmt(lowLoad, 0)} เส้นทางที่ Load Factor ต่ำกว่า 70%`);
  if (loss) actions.push(`มี ${fmt(loss, 0)} เส้นทางที่ Contribution ติดลบ`);
  if (highCost) actions.push(`มี ${fmt(highCost, 0)} เส้นทางที่ต้นทุน/ตันสูงกว่า ฿2,000`);
  actions.push('จัดลำดับการปรับปรุงจาก metric ที่เลือกด้านบน');
  return `<ol class="executive-action-list">${actions.slice(0, 4).map(text => `<li>${esc(text)}</li>`).join('')}</ol>`;
}

function routeDiagnosticTable(rows, routeAction, routeActionThai) {
  const visible = rows.slice(0, 10);
  return `<div class="route-diagnostic-wrap"><table class="simple-table route-diagnostic-table"><thead><tr><th>เส้นทาง</th><th>เที่ยว</th><th>Contribution</th><th>Margin</th><th>Load Factor</th><th>ต่ำกว่า 70%</th><th>ต่ำกว่า BE</th><th>Cost/Trip</th><th>Cost/Ton</th><th>Action</th></tr></thead><tbody>${visible.length ? visible.map(row => { const trip = row.trip; const margin = row.margin_pct; const lowPct = trip?.trip_count ? (trip.below_70_records / trip.trip_count * 100) : null; const bePct = trip?.trip_count ? (trip.below_break_even_records / trip.trip_count * 100) : null; const action = routeAction(row); return `<tr><td><b>${esc(row.route)}</b><small>${esc(routeDirectionLabel(row._direction))}</small></td><td>${trip?.trip_count === undefined ? 'N/A' : fmt(trip.trip_count, 0)}</td><td class="${row.contribution < 0 ? 'loss' : 'good'}">${moneyM(row.contribution)}</td><td class="${margin !== null && margin < 0 ? 'loss' : 'good'}">${margin === null ? 'N/A' : pct(margin)}</td><td class="${trip?.load_factor !== null && trip?.load_factor < .7 ? 'warning-value' : ''}">${tripPct(trip?.load_factor)}</td><td>${lowPct === null ? 'N/A' : `${fmt(lowPct, 1)}%`}</td><td>${bePct === null ? 'N/A' : `${fmt(bePct, 1)}%`}</td><td>${tripMoney(trip?.cost_per_trip)}</td><td>${trip?.cost_per_ton === null || trip?.cost_per_ton === undefined ? 'N/A' : `฿ ${fmt(trip.cost_per_ton, 0)}`}</td><td><span class="route-action-chip ${action.toLowerCase().replace(/\s+/g, '-')}">${routeActionThai(action)}</span></td></tr>`; }).join('') : '<tr><td colspan="10">ไม่พบเส้นทาง</td></tr>'}</tbody></table></div>`;
}

function executiveOverviewPage(y) {
  const trips = selectedTripSummary();
  const customer = state.data?.customer_summary || {};
  const overview = y.overview?.totals || {};
  const validLoadRows = trips.totals?.validated_trip_load_count || trips.data_quality?.validated_candidate_trip_loads || 0;
  const lowLoadRecords = (trips.routes || []).reduce((sum, row) => sum + Number(row.below_70_records || 0), 0);
  const alerts = [
    { title: 'ลูกค้า Contribution ติดลบ', value: fmt(customer.totals?.loss_making_count || 0, 0), detail: 'ตรวจสอบใน Customer Profitability', type: 'warn' },
    { title: 'Load Factor ต่ำกว่า 70%', value: fmt(lowLoadRecords, 0), detail: `${fmt(validLoadRows, 0)} records ผ่าน validation`, type: 'warn' },
    { title: 'ข้อมูลถูกตัดออก', value: fmt(trips.excluded_rows || 0, 0), detail: 'ไม่รวมใน management KPI', type: 'info' },
    { title: 'Credit Risk / Empty Backhaul', value: 'N/A', detail: 'รอ source ที่ยืนยันได้', type: 'muted' }
  ];
  return `<div class="merged-page-intro"><div><div class="eyebrow">EXECUTIVE DECISION SUPPORT</div><h2>Executive Overview</h2><p>สรุปผลการดำเนินงานและประเด็นที่ผู้บริหารควรติดตามในทันที</p></div></div>
  <div class="kpi-grid executive-kpis">${kpi('รายได้', moneyM(overview.revenue), 'จาก Prepared Dataset', '฿')}${kpi('ต้นทุนที่ทราบ', moneyM(overview.all_costs), 'Known Cost', '▣')}${kpi('Contribution', moneyM(overview.operating_surplus), 'Revenue - Known Cost', '▲')}${kpi('Margin', pct(overview.revenue ? overview.operating_surplus / overview.revenue * 100 : null), 'Contribution ÷ Revenue', '%')}${kpi('Candidate trip records', fmt(trips.candidate_trip_count || 0, 0), 'จาก workbook เที่ยว', '⌖')}${kpi('Load Factor validated', fmt(validLoadRows, 0), 'เที่ยวที่ผ่านการตรวจสอบ', '◌')}${kpi('Customer Profit Leakage', customerMoney(customer.totals?.profit_leakage), 'ลูกค้า Contribution ติดลบ', '⚠')}${kpi('Overdue A/R', 'N/A', 'ยังไม่มี A/R dataset', '◷')}</div>
  <div class="panel management-alerts"><div class="panel-head"><div><div class="panel-title">Management Alerts / Key Issues</div><div class="panel-sub">ประเด็นที่มีข้อมูลรองรับในปัจจุบัน และรายการที่ยังรอ source เพิ่มเติม</div></div></div><div class="alert-grid">${alerts.map(alert => `<div class="alert-card ${alert.type}"><b>${esc(alert.value)}</b><strong>${esc(alert.title)}</strong><span>${esc(alert.detail)}</span></div>`).join('')}</div></div>
  ${overviewPage(y)}`;
}


function fleetLoadBands(trips) {
  const source = trips?.load_bands || {};
  const total = Number(source.total || 0);
  const bands = [
    { label: '< 50%', count: Number(source.below_50 || 0), className: 'danger' },
    { label: '50–69.9%', count: Number(source.from_50_to_70 || 0), className: 'warn' },
    { label: '≥ 70%', count: Number(source.at_or_above_70 || 0), className: 'good' }
  ];
  const max = Math.max(...bands.map(b => b.count), 1);
  return `<div class="fleet-load-bands">${bands.map(b => `<div class="fleet-load-band"><div><b>${b.label}</b><span>${fmt(b.count,0)} เที่ยว</span></div><div class="fleet-load-track"><i class="${b.className}" style="width:${Math.max(4,b.count/max*100)}%"></i></div><strong>${total ? fmt(b.count/total*100,1) : '0.0'}%</strong></div>`).join('')}</div>`;
}

function fleetDirectionBars(trips) {
  const rows = [...(trips?.direction || [])].filter(row => row.load_factor !== null && row.load_factor !== undefined).sort((a,b) => Number(b.trip_count||0)-Number(a.trip_count||0)).slice(0,8);
  if (!rows.length) return '<div class="empty-state">ยังไม่มีข้อมูลทิศทางที่มี Load Factor ผ่าน validation</div>';
  return `<div class="fleet-direction-list">${rows.map(row => `<div class="fleet-direction-row"><div><b>${esc(row.direction || 'ไม่ระบุ')}</b><small>${fmt(row.trip_count,0)} เที่ยว · Contribution ${tripMoney(row.contribution)}</small></div><div class="fleet-direction-track"><i style="width:${Math.max(2,Math.min(100,Number(row.load_factor)*100))}%"></i></div><strong>${tripPct(row.load_factor)}</strong></div>`).join('')}</div>`;
}

function cmFleetDiagnosticTable(trips, y) {
  const normalize = value => String(value || '').trim().replace(/\s+/g, ' ');
  const financial = new Map(y.vehicles.map(row => [normalize(row.vehicle), row]));
  const rows = [...(trips.fleet || [])];
  const operationalNames = new Set(rows.map(row => normalize(row.vehicle_type)));
  for (const row of y.vehicles) {
    if (!operationalNames.has(normalize(row.vehicle))) rows.push({vehicle_type: row.vehicle});
  }
  rows.sort((a,b) => (b.trip_count || 0) - (a.trip_count || 0));
  return `<div class="page-note">การเงิน: ${esc(y.source)} · ชีท ${esc(y.source_sheet || "CM")} · หารด้วยจำนวนรายการที่ข้อมูลการเงินครบของชนิดรถนั้น<br>การบรรทุก: ${esc(trips.source)} · จำนวนเที่ยวและ Load Factor ใช้ชุดข้อมูลเที่ยว จึงอาจมีจำนวนต่างจาก CM<br>N/A = ไม่มีข้อมูลที่ใช้คำนวณได้ · Cost/Ton ใช้ต้นทุนและน้ำหนักจากไฟล์เที่ยวเท่านั้น</div><div class="fleet-trip-table-wrap"><table class="simple-table fleet-trip-table"><thead><tr><th>ชนิดรถ</th><th>เที่ยวจากไฟล์เที่ยว</th><th>รายการ CM ที่ใช้</th><th>น้ำหนัก</th><th>Load Factor</th><th>ต่ำกว่า 70%</th><th>รายได้/เที่ยว (CM)</th><th>ต้นทุนผันแปร/เที่ยว (CM)</th><th>CM/เที่ยว (บาท)</th><th>Cost/Ton (ไฟล์เที่ยว)</th></tr></thead><tbody>${rows.map(row => {
    const cm = financial.get(normalize(row.vehicle_type));
    const perTrip = key => cm?.trip_count && Number.isFinite(cm[key]) ? cm[key] / cm.trip_count : null;
    const low = row.validated_load_records ? row.below_70_records / row.validated_load_records : null;
    const contribution = perTrip('contribution');
    return `<tr><td><b>${esc(row.vehicle_type || 'ไม่ระบุ')}</b></td><td>${row.trip_count == null ? 'N/A' : fmt(row.trip_count,0)}</td><td>${cm ? fmt(cm.trip_count,0) : 'N/A'}</td><td>${tripKg(row.weight_kg)}</td><td>${tripPct(row.load_factor)}</td><td>${tripPct(low)}</td><td>${tripMoney(perTrip('revenue'))}</td><td>${tripMoney(perTrip('variable_cost'))}</td><td class="${contribution === null ? '' : contribution < 0 ? 'loss' : 'good'}">${tripMoney(contribution)}</td><td>${tripMoney(row.cost_per_ton)}</td></tr>`;
  }).join('')}</tbody></table></div>`;
}

function fleetTripTable(trips) {
  if (current()?.financial_basis === 'contribution_margin') return cmFleetDiagnosticTable(trips, current());
  const rows = [...(trips?.fleet || [])].sort((a,b) => Number(b.trip_count||0)-Number(a.trip_count||0)).slice(0,16);
  return `<div class="fleet-trip-table-wrap"><table class="simple-table fleet-trip-table"><thead><tr><th>ชนิดรถ</th><th>เที่ยว</th><th>น้ำหนัก</th><th>Load Factor</th><th>ต่ำกว่า 70%</th><th>ต่ำกว่า BE</th><th>รายได้/เที่ยว</th><th>ต้นทุน/เที่ยว</th><th>Contribution/เที่ยว</th><th>Cost/Ton</th></tr></thead><tbody>${rows.length ? rows.map(row => { const lowPct = row.validated_load_records ? row.below_70_records/row.validated_load_records*100 : null; const bePct = row.trip_count ? row.below_break_even_records/row.trip_count*100 : null; return `<tr><td><b>${esc(row.vehicle_type || 'ไม่ระบุ')}</b></td><td>${fmt(row.trip_count,0)}</td><td>${tripKg(row.weight_kg)}</td><td class="${row.load_factor !== null && row.load_factor < .7 ? 'warning-value':''}">${tripPct(row.load_factor)}</td><td>${lowPct===null?'N/A':`${fmt(lowPct,1)}%`}</td><td>${bePct===null?'N/A':`${fmt(bePct,1)}%`}</td><td>${tripMoney(row.revenue_per_trip)}</td><td>${tripMoney(row.cost_per_trip)}</td><td class="${Number(row.contribution_per_trip)<0?'loss':'good'}">${tripMoney(row.contribution_per_trip)}</td><td>${row.cost_per_ton===null||row.cost_per_ton===undefined?'N/A':`฿ ${fmt(row.cost_per_ton,0)}`}</td></tr>`; }).join('') : '<tr><td colspan="10">ยังไม่มีข้อมูลชนิดรถจากเที่ยว</td></tr>'}</tbody></table></div>`;
}

function fleetUtilScatter(trips) {
  const rows = [...(trips?.fleet || [])].filter(row => row.load_factor !== null && row.load_factor !== undefined && row.cost_per_trip !== null && row.cost_per_trip !== undefined);
  if (!rows.length) return '<div class="empty-state">ข้อมูลไม่พอสำหรับ Cost/Trip vs Load Factor</div>';
  const w=620,h=300,pL=58,pR=20,pT=24,pB=46;
  const maxCost=Math.max(...rows.map(r=>Number(r.cost_per_trip)||0),1)*1.08;
  const x=v=>pL+Math.max(0,Math.min(1,v))*(w-pL-pR);
  const y=v=>pT+(1-(Number(v)||0)/maxCost)*(h-pT-pB);
  const dots=rows.map(r=>{ const lf=Number(r.load_factor); const cost=Number(r.cost_per_trip); const c=lf>=.7?'#1aa674':lf>=.5?'#e8ad2f':'#e75b66'; return `<circle cx="${x(lf)}" cy="${y(cost)}" r="5" fill="${c}" fill-opacity=".88" stroke="#fff" stroke-width="1"><title>${esc(r.vehicle_type||'ไม่ระบุ')}\nLoad Factor: ${tripPct(lf)}\nCost/Trip: ${tripMoney(cost)}</title></circle>`; }).join('');
  const highCount = rows.filter(r => Number(r.load_factor) >= .7).length;
  const midCount = rows.filter(r => Number(r.load_factor) >= .5 && Number(r.load_factor) < .7).length;
  const lowCount = rows.filter(r => Number(r.load_factor) < .5).length;
  const missingCount = (trips?.fleet || []).length - rows.length;
  return `<div class="page-note">แต่ละจุดคือค่าเฉลี่ยของชนิดรถ · <span style="color:#1aa674">● ≥ 70%: ${highCount} ชนิด</span> · <span style="color:#a87900">● 50–&lt;70%: ${midCount} ชนิด</span> · <span style="color:#e75b66">● &lt;50%: ${lowCount} ชนิด</span><br>${highCount ? '' : 'ไม่มีจุดที่มี Load Factor เฉลี่ย ≥ 70% ในข้อมูลที่แสดง · '}${missingCount} ชนิดไม่แสดงจุดเนื่องจาก Load Factor หรือต้นทุนต่อเที่ยวไม่ครบ</div><div class="fleet-util-scatter-wrap"><svg class="fleet-util-scatter" viewBox="0 0 ${w} ${h}"><line x1="${x(.7)}" y1="${pT}" x2="${x(.7)}" y2="${h-pB}" stroke="#9aacc0" stroke-dasharray="5 4"/><line x1="${pL}" y1="${h-pB}" x2="${w-pR}" y2="${h-pB}" stroke="#cfd8e3"/><text x="${x(.7)}" y="${h-pB+18}" text-anchor="middle" class="route-axis-tick">70%</text><text x="${(pL+w-pR)/2}" y="${h-8}" text-anchor="middle" class="route-axis-label">Load Factor</text><text x="14" y="${(pT+h-pB)/2}" transform="rotate(-90 14 ${(pT+h-pB)/2})" text-anchor="middle" class="route-axis-label">Cost / Trip</text>${dots}</svg></div>`;
}

function fleetUtilizationPage(y, operationsOnly = false) {
  const trips = selectedTripSummary();
  const t = trips.totals || {};
  const q = trips.data_quality || {};
  const totalTrips = Number(trips.candidate_trip_count || 0);
  const totalWeight = t.total_weight_kg === null || t.total_weight_kg === undefined ? 'N/A' : `${fmt(Number(t.total_weight_kg)/1e6,1)}k ตัน`;
  const avgLoad = t.avg_load_factor ?? null;
  const below70 = Number(t.below_70_records || 0);
  const belowBE = Number(t.below_break_even_records || 0);
  const costPerTrip = t.cost_per_trip ?? null;
  return `<div class="merged-page-intro"><div><div class="eyebrow">FLEET &amp; LOAD EFFICIENCY</div><h2>Fleet Utilization &amp; Load Efficiency</h2><p>วิเคราะห์การใช้รถ น้ำหนักบรรทุก และประสิทธิภาพตามชนิดรถ เส้นทาง และทิศทาง</p></div><span class="customer-source-badge">${esc(trips.source || 'ยังไม่มีข้อมูลเที่ยว')}</span></div>
  ${tripDataNotice(trips)}
  <div class="fleet-executive-kpis"><div><span>จำนวนเที่ยว</span><b>${fmt(totalTrips,0)}</b><small>candidate trips จากข้อมูลปกติ</small></div><div><span>น้ำหนักรวม</span><b>${totalWeight}</b><small>ข้อมูลน้ำหนักที่มีอยู่</small></div><div class="violet"><span>Load Factor เฉลี่ย</span><b>${tripPct(avgLoad)}</b><small>${fmt(t.validated_trip_load_count||0,0)} เที่ยวผ่าน validation</small></div><div class="warn"><span>ต่ำกว่า 70%</span><b>${fmt(below70,0)}</b><small>${t.validated_trip_load_count ? fmt(below70/t.validated_trip_load_count*100,1)+'%' : 'N/A'} ของเที่ยวที่มี LF</small></div><div class="warn"><span>ต่ำกว่าจุดคุ้มทุน</span><b>${fmt(belowBE,0)}</b><small>เฉพาะเที่ยวที่เทียบ BE ได้</small></div><div><span>ต้นทุน/เที่ยว</span><b>${costPerTrip===null?'N/A':`฿ ${fmt(costPerTrip,0)}`}</b><small>จากเที่ยวที่มีต้นทุน</small></div></div>
  <div class="fleet-executive-grid"><div class="panel"><div class="panel-title">Load Factor Distribution</div><div class="panel-sub">สัดส่วนเที่ยวที่ผ่าน validation แบ่งตามระดับการใช้ความจุ</div>${fleetLoadBands(trips)}</div><div class="panel"><div class="panel-title">Load Factor ตามทิศทาง</div><div class="panel-sub">เปรียบเทียบการใช้ความจุของแต่ละทิศทางโดยไม่กล่าวเกินข้อมูลว่าเป็น Empty Trip</div>${fleetDirectionBars(trips)}</div></div>
  <div class="panel" style="margin-bottom:12px"><div class="panel-title">Cost / Trip vs Load Factor ตามชนิดรถ</div><div class="panel-sub">สีเขียว ≥ 70% · สีเหลือง 50–&lt;70% · สีแดง &lt;50% · ใช้ค่าเฉลี่ยตามชนิดรถ</div>${fleetUtilScatter(trips)}</div>
  <div class="panel fleet-trip-panel"><div class="panel-head"><div><div class="panel-title">Fleet Diagnostic Table</div><div class="panel-sub">สรุปประสิทธิภาพตามชนิดรถจากข้อมูลเที่ยวจริง</div></div></div>${fleetTripTable(trips)}</div>
  ${operationsOnly ? '' : '<div class="merged-section-heading"><h3>Financial View by Vehicle Type</h3><p>ข้อมูล Prepared Dataset</p></div>'}${operationsOnly ? '' : fleetPage(y)}`;
}

function customerCreditPage() {
  return `<div class="customer-tabs"><button class="customer-tab active" type="button">Profitability</button><button class="customer-tab" type="button" disabled>Credit Risk · Awaiting A/R Dataset</button></div>${customerPage()}<div class="panel credit-unavailable"><div class="panel-title">Credit Risk: Awaiting A/R Dataset</div><p>ยังไม่มีข้อมูลลูกหนี้/การรับชำระ จึงยังไม่แสดง Outstanding A/R, Overdue Amount, DSO หรือ Days Overdue</p><small>ต้องมี Customer Code, Invoice Date, Due Date, Payment Date, Invoice Amount และ Paid Amount</small></div>`;
}

function managementActionPage(y) {
  const trips = selectedTripSummary();
  const customer = state.data?.customer_summary || {};
  const lossCustomers = customer.totals?.loss_making_count || 0;
  const lowLoad = Number(trips.totals?.below_70_records || 0);
  const belowBreakEven = Number(trips.totals?.below_break_even_records || 0);
  const wastedCost = Number.isFinite(Number(trips.totals?.wasted_cost_total)) ? Number(trips.totals.wasted_cost_total) : null;
  const issues = [
    lowLoad > 0 && {title:'เที่ยวที่ Load Factor ต่ำกว่า 70%', value:fmt(lowLoad,0), detail:'เที่ยวที่ผ่าน validation · ควรทบทวนการจัดบรรทุก', status:'High', page:'fleet_util', link:'ดู Fleet Page', color:'coral'},
    belowBreakEven > 0 && {title:'เที่ยวต่ำกว่าจุดคุ้มทุน', value:fmt(belowBreakEven,0), detail:'เที่ยวที่มีเกณฑ์ BE และต่ำกว่าเกณฑ์', status:'High', page:'trip_route', link:'ดู Route Page', color:'coral'},
    lossCustomers > 0 && {title:'ลูกค้าที่ Contribution ติดลบ', value:fmt(lossCustomers,0), detail:'ลูกค้าจากข้อมูล Customer Profitability', status:'Review', page:'customer_credit', link:'ดู Customer Page', color:'amber'},
    wastedCost !== null && wastedCost > 0 && {title:'ต้นทุนสูญเปล่าจาก Load Factor', value:customerMoney(wastedCost), detail:'โอกาสทางปฏิบัติการ · ไม่รวมใน CM Scenario', status:'Review', page:'fleet_util', link:'ดู Fleet Page', color:'amber'}
  ].filter(Boolean).slice(0,4);
  return `<div class="scenario-executive rp-dashboard"><div class="merged-page-intro"><div><div class="eyebrow">DECISION CENTER</div><h2>Management Action &amp; Scenario</h2><p>สรุปประเด็นสำคัญที่ควรดำเนินการ และจำลองผลกระทบทางการเงินจากการปรับรายได้และต้นทุน</p></div></div><section class="scenario-actions"><div class="scenario-section-head"><div><h2>Management Actions</h2><p>ประเด็นสำคัญที่ควรดำเนินการ · แสดงเฉพาะข้อมูลที่มีอยู่จริง</p></div></div><div class="scenario-action-grid">${issues.length ? issues.map(issue => `<article class="scenario-action-card ${issue.color}"><div class="scenario-action-top"><span class="scenario-action-icon">${issue.status==='High'?'!':'◈'}</span><span class="scenario-badge">${issue.status}</span></div><h3>${issue.title}</h3><strong>${issue.value}</strong><p>${issue.detail}</p><button type="button" data-page="${issue.page}">${issue.link} →</button></article>`).join('') : '<div class="scenario-empty">ยังไม่มีประเด็นที่มีข้อมูลเพียงพอสำหรับสรุป</div>'}</div></section>${cmScenarioPage(y)}</div>`;
}

const categoryLabel = {
  cm: 'Contribution Margin (CM)', prepared: 'Prepared Dataset', revenue: 'Revenue / Bill', trip: 'Trip-level Operations', fuel: 'Fuel', maintenance: 'Maintenance', rental: 'Vehicle Rental', vehicle_master: 'Vehicle Master', route_master: 'Route Master', receivables: 'Receivables', customer: 'Customer Profitability', other: 'Other', auto: 'Auto'
};

function sourcesPage() {
  const ds = state.data || {};
  const catalog = ds.source_catalog || [];
  const trip = ds.trip_summary || {};
  const customer = ds.customer_summary || {};
  return `<div class="panel"><div class="panel-title">Data Sources</div><div class="panel-sub">ระบบแยกประเภทไฟล์และระบุว่าไฟล์ใดถูกใช้สร้าง Dashboard ปัจจุบัน</div><table class="simple-table"><thead><tr><th>ไฟล์</th><th>ประเภทข้อมูล</th><th>ปี</th><th>สถานะ</th><th>ขนาด</th></tr></thead><tbody>${catalog.length ? catalog.map(f => `<tr><td>${esc(f.name)}</td><td>${esc(categoryLabel[f.category] || f.category || 'Other')}</td><td>${f.year || '—'}</td><td>${f.used_in_dashboard ? '<span class="status-ready">ใช้ใน Dashboard</span>' : '<span class="status-wait">จัดเก็บ / ยังไม่เชื่อม</span>'}</td><td>${esc(f.size_human || '')}</td></tr>`).join('') : '<tr><td colspan="5">ยังไม่มีไฟล์ใน input/</td></tr>'}</tbody></table></div>
  <div class="grid"><div class="panel"><div class="panel-title">ความพร้อมของ Dashboard 5 หน้า</div><div class="readiness-list"><div><b>Executive Overview</b><span>${ds.years?.length ? 'พร้อมใช้งาน' : 'ยังไม่มี Prepared Dataset'}</span></div><div><b>Trip &amp; Route Profitability</b><span>${trip.ok ? `${fmt(trip.candidate_trip_count || 0, 0)} candidate records` : 'ยังไม่มีข้อมูลเที่ยว'}</span></div><div><b>Fleet Utilization &amp; Load Efficiency</b><span>${trip.ok ? 'พร้อมใช้งานแบบ validated subset' : 'ยังไม่มีข้อมูลเที่ยว'}</span></div><div><b>Customer Profitability</b><span>${customer.ok ? `${fmt(customer.row_count || 0, 0)} customers` : 'ยังไม่มีข้อมูลลูกค้า'}</span></div><div><b>Credit Risk</b><span>รอ A/R dataset</span></div><div><b>Management Action &amp; Scenario</b><span>${ds.years?.length ? 'พร้อมใช้งานจากฐาน Revenue/Cost' : 'ยังไม่มีข้อมูลฐาน'}</span></div></div></div><div class="panel"><div class="panel-title">ข้อมูลที่ยังรอเพิ่มเติม</div><div class="panel-sub">ข้อมูลต่อไปนี้ยังไม่ถูกสร้างเป็นค่าประมาณ และจะแสดง N/A จนกว่าจะมี source ที่ตรวจสอบได้</div><div class="tag-cloud"><span>Distance / km</span><span>Empty Trip</span><span>Empty Backhaul</span><span>Service Group</span><span>Wasted Cost Definition</span><span>A/R / DSO</span></div></div></div>`;
}

function cmNotice(y) {
  const q = y.data_quality;
  return `<div class="page-note"><b>${esc(y.source)} · ชีท ${esc(y.source_sheet || "CM")}</b><br>ช่วงข้อมูล ${esc(y.period.start)} ถึง ${esc(y.period.end)} · ใช้ ${fmt(q.included_rows,0)} จาก ${fmt(q.source_rows,0)} รายการ · ไม่รวม ${fmt(q.excluded_rows,0)} รายการที่ข้อมูลไม่ครบหรือไม่ผ่านการตรวจสอบ<br>ยอดทั้งสามใช้รายการชุดเดียวกัน · ต้นทุนผันแปรติดลบ ${fmt(q.negative_variable_cost_rows,0)} รายการ คงค่าตามต้นฉบับเพื่อรอตรวจสอบ · CM = รายได้ − ต้นทุนผันแปร</div>`;
}

function cmTable(rows, key, label) {
  const perTrip = key === 'vehicle';
  return `<div class="route-diagnostic-wrap"><table class="simple-table"><thead><tr><th>${label}</th><th>รายการ</th><th>รายได้</th><th>ต้นทุนผันแปร</th><th>Contribution Margin</th><th>CM %</th>${perTrip ? '<th>รายได้/เที่ยว (บาท)</th><th>ต้นทุนผันแปร/เที่ยว (บาท)</th><th>CM/เที่ยว (บาท)</th>' : ''}</tr></thead><tbody>${rows.map(r => `<tr><td>${esc(r[key])}</td><td>${fmt(r.trip_count,0)}</td><td>${customerMoney(r.revenue)}</td><td>${customerMoney(r.variable_cost)}</td><td>${customerMoney(r.contribution)}</td><td>${customerPct(r.margin_pct)}</td>${perTrip ? `<td>${tripMoney(r.trip_count ? r.revenue/r.trip_count : null)}</td><td>${tripMoney(r.trip_count ? r.variable_cost/r.trip_count : null)}</td><td>${tripMoney(r.trip_count ? r.contribution/r.trip_count : null)}</td>` : ''}</tr>`).join('')}</tbody></table></div>`;
}

function cmPage(y) {
  const t = y.overview.totals;
  const notice = cmNotice(y);
  const trips = selectedTripSummary();
  const loadSummary = trips.ok ? panel('Load Factor · ข้อมูลเที่ยวปี ' + y.year, esc(trips.source), `<div class="kpi-grid">${kpi('Load Factor เฉลี่ย', tripPct(trips.totals?.avg_load_factor), 'เฉพาะเที่ยวที่ผ่าน validation')}${kpi('เที่ยวที่มี Load Factor ใช้ได้', fmt(trips.data_quality?.validated_candidate_trip_loads, 0))}</div>`) : '';
  if (state.page === 'action_scenario') return notice + cmScenarioPage(y);
  const kpis = `<div class="kpi-grid">${kpi('รายได้', customerMoney(t.revenue), 'รวมรายได้', '฿')}${kpi('ต้นทุนผันแปร', customerMoney(t.variable_cost), 'จากชีท CM', '▣')}${kpi('Contribution Margin', customerMoney(t.contribution), 'ส่วนต่างหลังต้นทุนผันแปร', '▲')}${kpi('CM %', customerPct(t.margin_pct), 'CM ÷ รายได้ × 100', '%')}</div>`;
  if (state.page === 'overview') return notice + kpis + panel('รายได้และต้นทุนผันแปรรายเดือน', 'เฉพาะช่วงที่มีข้อมูล', lineChart(y.overview.monthly)) + panel('สรุปรายเดือน', 'หน่วยล้านบาท', cmTable(y.overview.monthly, 'month', 'เดือน')) + loadSummary;
  const fleet = state.page === 'fleet_util';
  const rows = fleet ? y.vehicles : y.routes;
  const key = fleet ? 'vehicle' : 'route';
  const filter = state.cmFilter || {search: '', sort: 'contribution'};
  const visible = rows.filter(r => r[key].toLowerCase().includes(filter.search.toLowerCase())).sort((a,b) => b[filter.sort] - a[filter.sort]);
  return notice + kpis + panel(fleet ? 'ผลตอบแทนตามชนิดรถ' : 'ผลตอบแทนตามเส้นทาง', 'เรียงมากไปน้อย · หน่วยล้านบาท · จำนวนรายการตามเลขที่ใบรายการที่ไม่ซ้ำ', `<div class="route-filters"><input id="cmSearch" placeholder="ค้นหา" value="${esc(filter.search)}"><select id="cmSort">${[['contribution','Contribution Margin'],['revenue','รายได้'],['variable_cost','ต้นทุนผันแปร'],['margin_pct','CM %']].map(([v,l]) => `<option value="${v}" ${filter.sort===v?'selected':''}>${l}</option>`).join('')}</select></div>${cmTable(visible,key,fleet?'ชนิดรถ':'เส้นทาง')}`) + (trips.ok ? (fleet ? fleetUtilizationPage(y, true) : loadSummary + panel('Load Factor ตามเส้นทาง', esc(trips.source), tripAggregateTable(trips.routes, 'route', 'เส้นทาง'))) : panel('ข้อมูลการบรรทุก', 'ยังไม่มีข้อมูลเที่ยวที่ผ่านการตรวจสอบของปีที่เลือก', '<p>Load Factor / Cost per Ton / Empty Trip: N/A</p>'));
}

function cmScenarioPage(y) {
  const p = y.profit_summary;
  if (!p || !Number.isFinite(Number(p.revenue)) || !Number.isFinite(Number(p.cost)) || !Number.isFinite(Number(p.profit))) return '<section class="scenario-panel"><div class="scenario-empty">ข้อมูล CM ของปีที่เลือกยังไม่เพียงพอสำหรับ Scenario</div></section>';
  const saved = state.simpleScenarios?.[y.year] || JSON.parse(localStorage.getItem(`nimSimpleScenario:${y.year}`) || 'null') || {revenueGrowth:0,costReduction:0};
  const control = (key,label,min,max) => `<div class="simple-control"><div class="simple-control-head"><label for="${key}Range">${label}</label><div><input id="${key}Number" data-cm-scenario="${key}" type="number" min="${min}" max="${max}" step="1" value="${saved[key] ?? 0}"><span>%</span></div></div><input id="${key}Range" data-cm-scenario="${key}" type="range" min="${min}" max="${max}" step="1" value="${saved[key] ?? 0}"><div class="simple-control-scale"><span>${min}%</span><span>${max}%</span></div></div>`;
  return `<section class="scenario-panel scenario-model"><div class="scenario-section-head"><div><h2>Simple What-if Scenario</h2><p>ถ้ารายได้เปลี่ยน และเราลดต้นทุนผันแปรได้ ผลตอบแทนจะเปลี่ยนไปเท่าไร?</p></div><span class="scenario-source">CM ${y.year} · ${esc(y.source || 'CM Dataset')}</span></div><div class="scenario-main-grid"><div class="scenario-controls">${control('revenueGrowth','รายได้เปลี่ยนแปลง',-20,30)}${control('costReduction','ลดต้นทุนผันแปร',0,20)}<div class="scenario-presets"><span>Scenario assumptions</span><button type="button" data-cm-preset="base">Base Case</button><button type="button" data-cm-preset="optimistic">Optimistic</button><button type="button" data-cm-preset="stress">Stress Case</button></div></div><div id="cmScenarioResults" class="scenario-result-panel"></div></div><div id="scenarioComparison" class="scenario-comparison"></div><div class="scenario-chart-wrap"><h3>Current vs Scenario <small>เปรียบเทียบผลลัพธ์</small></h3><div id="scenarioChart"></div></div><details class="scenario-advanced"><summary>Advanced Assumptions</summary><p>Scenario นี้ใช้ Revenue และ Variable Cost จาก CM Dataset โดยตรง และไม่รวม Wasted Cost จาก Load Factor เพื่อหลีกเลี่ยงการนับต้นทุนซ้ำ</p></details></section><section class="scenario-opportunity"><div><span class="scenario-opportunity-label">Operational Opportunity · โอกาสทางปฏิบัติการ</span><h3>ต้นทุนสูญเปล่าจาก Load Factor</h3></div><strong>${wastedCostValue(selectedTripSummary())}</strong><small>แสดงแยกจาก CM Scenario · ไม่ได้นำไปรวมใน Contribution Margin</small></section>`;
}

function wastedCostValue(trips) {
  const value = Number(trips?.totals?.wasted_cost_total);
  return Number.isFinite(value) && value > 0 ? customerMoney(value) : 'N/A';
}

function calculateSimpleScenario(y, s) {
  const revenue = Number(y.profit_summary?.revenue), variableCost = Number(y.profit_summary?.cost), contribution = Number(y.profit_summary?.profit);
  if (![revenue,variableCost,contribution,s.revenueGrowth,s.costReduction].every(Number.isFinite) || revenue < 0 || variableCost < 0) return {error:'ข้อมูล CM ของปีที่เลือกไม่พร้อม'};
  if (s.revenueGrowth === 0 && s.costReduction === 0) return {revenue,variableCost,contribution,cmRatio:revenue ? contribution/revenue*100 : null,projectedRevenue:revenue,projectedCost:variableCost,projectedContribution:contribution,projectedRatio:revenue ? contribution/revenue*100 : null,improvement:0};
  const projectedRevenue = revenue * (1 + s.revenueGrowth / 100);
  const baselineRatio = revenue ? variableCost / revenue : null;
  const projectedCostBeforeEfficiency = baselineRatio === null ? null : projectedRevenue * baselineRatio;
  const projectedCost = projectedCostBeforeEfficiency === null ? null : projectedCostBeforeEfficiency * (1 - s.costReduction / 100);
  const projectedContribution = projectedRevenue - projectedCost;
  const projectedRatio = projectedRevenue ? projectedContribution / projectedRevenue * 100 : null;
  return {revenue,variableCost,contribution,cmRatio:revenue ? contribution/revenue*100 : null,projectedRevenue,projectedCost,projectedContribution,projectedRatio,improvement:projectedContribution-contribution};
}

function calculateCostScenario(y, s) {
  const keys = ['revenue','target','depreciation','repairShare','travelShare','fuelShare','repairReduction','travelReduction','fuelReduction'];
  if (!keys.every(k => Number.isFinite(s[k]) && s[k] >= 0)) return {error: 'กรุณากรอกตัวเลขทุกช่องให้ครบ และไม่น้อยกว่า 0'};
  if (keys.filter(k => k.endsWith('Share') || k.endsWith('Reduction')).some(k => s[k] > 100)) return {error: 'สัดส่วนและการลดต้นทุนต้องอยู่ระหว่าง 0–100%'};
  if (Math.abs(s.repairShare+s.travelShare+s.fuelShare-100) > .000001) return {error: 'สัดส่วนค่าซ่อม + ค่าเดินทาง + ค่าน้ำมัน ต้องรวมเท่ากับ 100%'};
  const revenue = s.revenue*1e6, baseRevenue = y.profit_summary.revenue, baseCost = y.profit_summary.cost;
  if (!(baseRevenue > 0) || !Number.isFinite(baseCost)) return {error:'ข้อมูลต้นทุนฐานไม่พร้อม'};
  const categories = ['repair','travel','fuel'].map(key => { const base = baseCost*s[key+'Share']/100; return {key, base, projected: base*revenue/baseRevenue*(1-s[key+'Reduction']/100)}; });
  const cost = categories.reduce((sum,r) => sum+r.projected,0), cm = revenue-cost, depreciation = s.depreciation*1e6;
  return {revenue,cost,cm,depreciation,result:cm-depreciation,categories,margin:revenue ? cm/revenue*100 : null,required:null};
}

function updateCMScenario() {
  const y = current(), output = $('cmScenarioResults');
  if (!output) return;
  const values = Object.fromEntries([...document.querySelectorAll('[data-cm-scenario]')].map(el => [el.dataset.cmScenario, Number(el.value)]));
  const s = {revenueGrowth:Number.isFinite(values.revenueGrowth) ? Math.max(-20,Math.min(30,values.revenueGrowth)) : 0,costReduction:Number.isFinite(values.costReduction) ? Math.max(0,Math.min(20,values.costReduction)) : 0};
  state.simpleScenarios ||= {}; state.simpleScenarios[y.year] = s; localStorage.setItem(`nimSimpleScenario:${y.year}`,JSON.stringify(s));
  document.querySelectorAll('[data-cm-scenario]').forEach(el => { el.value = s[el.dataset.cmScenario]; });
  const result = calculateSimpleScenario(y,s);
  if (result.error) { output.innerHTML = `<p>${esc(result.error)}</p>`; return; }
  const changeLabel = result.improvement >= 0 ? 'CM เพิ่มขึ้น' : 'CM ลดลง';
  output.innerHTML = `<div class="scenario-result-heading"><span>Projected Result</span><strong class="${result.improvement >= 0 ? 'good' : 'loss'}">${changeLabel}<br>${result.improvement >= 0 ? '+' : ''}${moneyM(result.improvement)}</strong></div><p class="scenario-sentence">หากรายได้${s.revenueGrowth >= 0 ? 'เพิ่ม' : 'ลด'} ${Math.abs(s.revenueGrowth)}% และลดต้นทุนผันแปรได้ ${s.costReduction}%<br>Contribution Margin จะ${result.improvement >= 0 ? 'เพิ่มขึ้น' : 'ลดลง'}ประมาณ ${moneyM(Math.abs(result.improvement))}</p>`;
  $('scenarioComparison').innerHTML = `<table class="simple-table"><thead><tr><th>Metric</th><th>Current</th><th>Scenario</th></tr></thead><tbody><tr><td>Revenue</td><td>${moneyM(result.revenue)}</td><td>${moneyM(result.projectedRevenue)}</td></tr><tr><td>Variable Cost</td><td>${moneyM(result.variableCost)}</td><td>${moneyM(result.projectedCost)}</td></tr><tr><td>Contribution Margin</td><td>${moneyM(result.contribution)}</td><td>${moneyM(result.projectedContribution)}</td></tr><tr><td>CM Ratio</td><td>${customerPct(result.cmRatio)}</td><td>${customerPct(result.projectedRatio)}</td></tr></tbody></table>`;
  const valuesForChart = [['Revenue',result.revenue,result.projectedRevenue],['Variable Cost',result.variableCost,result.projectedCost],['Contribution Margin',result.contribution,result.projectedContribution]];
  const max = Math.max(1,...valuesForChart.flatMap(row => row.slice(1).map(value => Math.abs(value))));
  $('scenarioChart').innerHTML = `<div class="scenario-chart-legend"><span><i class="current"></i>Current</span><span><i class="projected"></i>Scenario</span></div><div class="scenario-bars">${valuesForChart.map(([label,currentValue,scenarioValue]) => `<div class="scenario-bar-group"><div class="scenario-bar-pair"><i class="current" style="height:${Math.max(2,Math.abs(currentValue)/max*100)}%"><b>${moneyM(currentValue)}</b></i><i class="projected" style="height:${Math.max(2,Math.abs(scenarioValue)/max*100)}%"><b>${moneyM(scenarioValue)}</b></i></div><span>${label}</span></div>`).join('')}</div>`;
}


const rpMetrics = {contribution:'Contribution Margin', revenue:'รายได้', variable_cost:'ต้นทุนผันแปร', margin_pct:'CM %'};
const rpColors = ['#2878d4','#26b98d','#eeae38','#aa85d9','#e66c78'];
function rpDirectionColor(direction) {
  const labels=[...new Set(rpRows(current()).map(r=>r.direction))].sort();
  return rpColors[Math.max(0,labels.indexOf(direction))%rpColors.length];
}
function rpFilters() { return state.routePortfolio ||= {direction:'all', route:'all', search:'', metric:'contribution', sort:'desc', limit:10, page:1, alert:'all', scatterScale:'focus'}; }
function rpRows(y) {
  const cm = y.financial_basis === 'contribution_margin';
  return (y.routes || []).map(r => {
    const revenue = r.revenue ?? null, cost = cm ? r.variable_cost : r.known_cost;
    const contribution = r.contribution ?? null;
    return {...r, revenue, variable_cost:cost ?? null, contribution,
      margin_pct: revenue && contribution != null ? contribution/revenue*100 : null,
      direction: r.operations?.direction || 'ไม่ระบุ/หลายทิศทาง',
      revenue_per_trip: r.trip_count && revenue != null ? revenue/r.trip_count : null,
      cost_per_trip: r.trip_count && cost != null ? cost/r.trip_count : null,
      cm_per_trip: r.trip_count && contribution != null ? contribution/r.trip_count : null};
  });
}
function rpSum(rows,key) { return rows.length && rows.every(r => Number.isFinite(r[key])) ? rows.reduce((s,r)=>s+r[key],0) : null; }
function rpBaseRows(y) {
  const f=rpFilters();
  return rpRows(y).filter(r => (f.direction==='all'||r.direction===f.direction) && (f.route==='all'||r.route===f.route) && r.route.toLowerCase().includes(f.search.trim().toLowerCase()));
}
function rpThresholds(rows) {
  const med = key => { const values=rows.map(r=>r[key]).filter(Number.isFinite); return values.length ? median(values) : null; };
  return {revenue:med('revenue'),margin:med('margin_pct'),cost:med('cost_per_trip')};
}
function rpAlerts(rows,t) {
  const defs=[
    ['low_margin','CM % ต่ำกว่ามัธยฐาน',r=>r.margin_pct!==null&&t.margin!==null&&r.margin_pct<t.margin],
    ['high_revenue','รายได้สูง แต่ CM % ต่ำ',r=>t.revenue!==null&&t.margin!==null&&r.revenue>=t.revenue&&r.margin_pct!==null&&r.margin_pct<t.margin],
    ['high_cost','ต้นทุน/เที่ยวสูงกว่ามัธยฐาน',r=>t.cost!==null&&r.cost_per_trip!==null&&r.cost_per_trip>t.cost],
    ['low_load','Load Factor ต่ำกว่า 70%',r=>r.operations?.load_factor!=null&&r.operations.load_factor<.7],
    ['below_be','มีเที่ยวต่ำกว่าจุดคุ้มทุน',r=>r.operations?.below_break_even_pct>0],
    ['coverage','ข้อมูล Load Factor ไม่พร้อม',r=>r.operations?.load_factor==null]
  ];
  return defs.filter(([id]) => id!=='high_cost'||t.cost!==null).filter(([id]) => id!=='below_be'||rows.some(r=>r.operations?.below_break_even_pct!=null)).map(([id,label,test])=>({id,label,test,count:rows.filter(test).length}));
}
function rpVisibleRows(y) {
  const base=rpBaseRows(y), f=rpFilters(), alerts=rpAlerts(base,rpThresholds(base));
  const chosen=alerts.find(a=>a.id===f.alert);
  return chosen ? base.filter(chosen.test) : base;
}
function rpHeaderControls(y) {
  const f=rpFilters(), rows=rpRows(y);
  const directions=[...new Set(rows.map(r=>r.direction))].sort();
  return `<select data-rp="direction" aria-label="ทิศทาง"><option value="all">ทุกทิศทาง</option>${directions.map(d=>`<option ${f.direction===d?'selected':''} value="${esc(d)}">${esc(d)}</option>`).join('')}</select><select data-rp="route" aria-label="เส้นทาง"><option value="all">ทุกเส้นทาง</option>${rows.map(r=>`<option ${f.route===r.route?'selected':''} value="${esc(r.route)}">${esc(r.route)}</option>`).join('')}</select>`;
}
function rpCard(label,value,helper,icon,color) {
  return `<div class="rp-kpi ${color}"><span class="rp-icon">${icon}</span><div><h3>${label}</h3><strong>${value}</strong><small>${helper}</small></div></div>`;
}
function rpRanking(rows) {
  const f=rpFilters(), key=f.metric;
  const ranked=[...rows].filter(r=>Number.isFinite(r[key])).sort((a,b)=>b[key]-a[key]||a.route.localeCompare(b.route)).slice(0,10);
  const max=Math.max(1,...ranked.flatMap(r=>[Math.abs(r[key]),key==='contribution'?Math.abs(r.revenue):0]));
  return `<div class="rp-rank-legend"><span>● ${rpMetrics[key]}</span>${key==='contribution'?'<span>● รายได้</span>':''}${key!=='margin_pct'?'<span>CM %</span>':''}</div><div class="rp-ranking">${ranked.map(r=>`<div class="rp-rank-row"><button data-rp-route="${esc(r.route)}" title="${esc(r.route)}">${esc(r.route.replace(/\s+-\s+/g,' → '))}</button><div class="rp-bar-pair">${key==='contribution'?`<div class="rp-bar secondary" style="width:${Math.abs(r.revenue)/max*100}%"></div>`:''}<div class="rp-bar primary ${r[key]<0?'negative':''}" style="width:${Math.abs(r[key])/max*100}%"></div>${key!=='margin_pct'?`<b>${customerMoney(r[key])}</b>`:''}</div><span>${customerPct(r.margin_pct)}</span></div>`).join('') || '<p class="rp-empty">ไม่มีข้อมูลตามตัวกรอง</p>'}</div>`;
}
function rpScatter(rows,t) {
  const valid=rows.filter(r=>Number.isFinite(r.revenue)&&Number.isFinite(r.margin_pct));
  if(!valid.length)return '<p class="rp-empty">ไม่มีข้อมูล Revenue และ CM % ที่ใช้ได้</p>';
  const groups=[
    ['รักษาและต่อยอด',r=>r.revenue>=t.revenue&&r.margin_pct>=t.margin,'portfolio-grow','รายได้สูง · CM % สูง'],
    ['โอกาสขยาย',r=>r.revenue<t.revenue&&r.margin_pct>=t.margin,'portfolio-opportunity','รายได้ยังไม่สูง · CM % ดี'],
    ['เร่งปรับปรุง',r=>r.revenue>=t.revenue&&r.margin_pct<t.margin,'portfolio-review','รายได้สูง · CM % ต่ำ'],
    ['ควรทบทวน',r=>r.revenue<t.revenue&&r.margin_pct<t.margin,'portfolio-risk','รายได้ต่ำ · CM % ต่ำ']
  ];
  return `<div class="portfolio-guide"><span>แบ่งกลุ่มจากค่ามัธยฐานของเส้นทางที่กรอง</span><b>รายได้ ${customerMoney(t.revenue)} · CM % ${customerPct(t.margin)}</b></div><div class="portfolio-quadrants">${groups.map(([label,test,cls,detail])=>{const items=valid.filter(test),cm=items.reduce((sum,r)=>sum+(r.contribution||0),0),top=items.sort((a,b)=>(b.contribution||0)-(a.contribution||0)).slice(0,3);return `<article class="portfolio-quadrant ${cls}"><div class="portfolio-quadrant-head"><div><h3>${label}</h3><small>${detail}</small></div><strong>${fmt(items.length,0)} เส้นทาง</strong></div><div class="portfolio-quadrant-metric"><span>CM รวม</span><b>${customerMoney(cm)}</b></div><div class="portfolio-route-list">${top.map(r=>`<button data-rp-route="${esc(r.route)}"><span>${esc(r.route.replace(/\s+-\s+/g,' → '))}</span><b>${customerMoney(r.contribution)} · ${customerPct(r.margin_pct)}</b></button>`).join('')||'<small class="rp-empty">ไม่มีเส้นทางในกลุ่มนี้</small>'}</div></article>`;}).join('')}</div><p class="rp-muted portfolio-footnote">กดชื่อเส้นทางเพื่อดูรายละเอียดด้านล่าง · กลุ่มนี้ใช้เพื่อช่วยจัดลำดับการตัดสินใจ ไม่ใช่การจัดอันดับกำไรสุทธิ</p>`;
}
function rpDistribution(rows,overall) {
  const labels=['< 0%','0–<20%','20–<40%','40–<60%','60–<80%','≥80%'];
  const counts=Array(6).fill(0);rows.filter(r=>Number.isFinite(r.margin_pct)).forEach(r=>{const v=r.margin_pct;counts[v<0?0:v<20?1:v<40?2:v<60?3:v<80?4:5]++;});
  const max=Math.max(1,...counts);
  return `<div class="rp-band-note">CM % รวม <b>${customerPct(overall)}</b> · จำนวนเส้นทางในแต่ละช่วง</div><div class="rp-histogram">${counts.map((n,i)=>`<div><span>${n}</span><i style="height:${Math.max(n?3:0,n/max*120)}px"></i><small>${labels[i]}</small></div>`).join('')}</div><small class="rp-muted">ไม่มี CM %: ${rows.filter(r=>r.margin_pct==null).length} เส้นทาง</small>`;
}
function rpDirectionChart(rows) {
  const groups=new Map();rows.forEach(r=>{if(Number.isFinite(r.contribution))groups.set(r.direction,(groups.get(r.direction)||0)+r.contribution);});
  const entries=[...groups.entries()].sort((a,b)=>b[1]-a[1]),total=entries.reduce((sum,[,n])=>sum+n,0);
  if(!entries.length)return '<p class="rp-empty">ไม่มีข้อมูล</p>';
  const signed=entries.some(([,v])=>v<0)||total<=0;
  let acc=0;const stops=entries.map(([d,v],i)=>{const start=acc;acc+=v/total*100;return `${rpDirectionColor(d)} ${start}% ${acc}%`;});
  return `<div class="rp-direction-content">${signed?'<p class="rp-muted">มี CM ติดลบ แสดงยอดตามทิศทางแทนสัดส่วนวงกลม</p>':`<div class="rp-donut" style="background:conic-gradient(${stops.join(',')})"><div><b>${customerMoney(total)}</b><small>CM รวม</small></div></div>`}<div class="rp-direction-values">${entries.map(([d,n],i)=>`<div><i style="background:${rpDirectionColor(d)}"></i><span>${esc(d)}<small>${tripMoney(n)}</small></span><b>${total>0?customerPct(n/total*100):'N/A'}</b></div>`).join('')}</div></div>`;
}
function routePortfolioPage(y) {
  const f=rpFilters(),base=rpBaseRows(y),rows=rpVisibleRows(y),t=rpThresholds(rows);
  const revenue=rpSum(rows,'revenue'),cost=rpSum(rows,'variable_cost'),cm=rpSum(rows,'contribution'),ratio=revenue&&cm!=null?cm/revenue*100:null;
  const cmBasis=y.financial_basis==='contribution_margin', costLabel=cmBasis?'ต้นทุนผันแปร':'ต้นทุนตามข้อมูล';
  const alerts=rpAlerts(base,rpThresholds(base)),quality=y.data_quality||{};
  const ordered=[...rows].sort((a,b)=>{const av=a[f.metric],bv=b[f.metric];return av==null?1:bv==null?-1:(f.sort==='asc'?av-bv:bv-av)||a.route.localeCompare(b.route);});
  const size=f.limit==='all'?Math.max(1,ordered.length):Number(f.limit),pages=Math.max(1,Math.ceil(ordered.length/size));f.page=Math.min(f.page,pages);
  const visible=ordered.slice((f.page-1)*size,f.page*size),ops=rows.some(r=>r.operations?.load_factor!=null);
  const metricOptions=Object.entries(rpMetrics).map(([key,label])=>`<option value="${key}" ${f.metric===key?'selected':''}>${!cmBasis&&key==='variable_cost'?costLabel:label}</option>`).join('');
  return `<div class="rp-dashboard"><div class="rp-kpis">${rpCard('รายได้',customerMoney(revenue),'ตามเส้นทางที่เลือก','▥','blue')}${rpCard(costLabel,customerMoney(cost),'จากข้อมูลการเงิน','▤','coral')}${rpCard('Contribution Margin',customerMoney(cm),'รายได้ − '+costLabel,'฿','green')}${rpCard('CM %',customerPct(ratio),'CM ÷ รายได้','%','purple')}${rpCard('จำนวนเส้นทาง',fmt(rows.length,0),'ตามตัวกรองปัจจุบัน','⌘','amber')}</div>
  <div class="rp-main-grid"><section class="rp-panel"><div class="rp-panel-head"><h2>Top 10 เส้นทางตาม ${rpMetrics[f.metric]}</h2><select data-rp="metric" aria-label="ตัวชี้วัดอันดับ">${metricOptions}</select></div>${rpRanking(rows)}</section><section class="rp-panel"><div class="rp-panel-head"><h2>Portfolio วิเคราะห์เส้นทาง</h2>${f.route!=='all'?'<button class="rp-back-overview" type="button" data-rp-reset="route">← กลับภาพรวมทั้งหมด</button>':''}</div>${f.route!=='all'?`<p class="rp-filter-context">กำลังดู: <b>${esc(f.route.replace(/\s+-\s+/g,' → '))}</b></p>`:''}${rpScatter(rows,t)}</section></div>
  <div class="rp-secondary-grid"><section class="rp-panel"><h2>Contribution Margin Distribution</h2>${rpDistribution(rows,ratio)}</section><section class="rp-panel"><h2>สัดส่วน Contribution Margin ตามทิศทาง</h2>${rpDirectionChart(rows)}</section><section class="rp-panel rp-attention"><div class="rp-panel-head"><h2>เส้นทางที่ควรให้ความสนใจ</h2><button data-rp-alert="all">ดูทั้งหมด</button></div>${alerts.map((a,i)=>`<button class="rp-alert ${f.alert===a.id?'active':''}" data-rp-alert="${a.id}"><span class="rp-alert-symbol">${['↓','△','↗','◌','!','i'][i]}</span><span>${a.label}</span><b>${a.count}</b></button>`).join('')}<small class="rp-muted">การเงินอ้างอิงมัธยฐานของตัวกรองหลัก · Load Factor ใช้เกณฑ์ 70%</small></section></div>
  <section class="rp-panel rp-details" id="rpDetails"><div class="rp-panel-head"><h2>รายละเอียดเส้นทาง</h2><input data-rp="search" type="search" value="${esc(f.search)}" placeholder="ค้นหาเส้นทาง…" aria-label="ค้นหาเส้นทาง"><div class="rp-table-controls"><select data-rp="metric" aria-label="เรียงตาม">${metricOptions}</select><select data-rp="sort" aria-label="ลำดับ"><option value="desc" ${f.sort==='desc'?'selected':''}>มาก → น้อย</option><option value="asc" ${f.sort==='asc'?'selected':''}>น้อย → มาก</option></select><select data-rp="limit" aria-label="จำนวนแถว">${[10,25,50,'all'].map(n=>`<option value="${n}" ${String(f.limit)===String(n)?'selected':''}>${n==='all'?'ทั้งหมด':n+' รายการ'}</option>`).join('')}</select></div></div>${f.alert!=='all'?`<button class="rp-filter-chip" data-rp-alert="all">${esc(alerts.find(a=>a.id===f.alert)?.label||'ตัวกรอง')} ×</button>`:''}<div class="rp-table-scroll"><table><thead><tr><th>เส้นทาง</th><th>เที่ยว CM</th><th>รายได้ (บาท)</th><th>${costLabel} (บาท)</th><th>CM (บาท)</th><th>CM %</th><th>รายได้/เที่ยว</th><th>ต้นทุน/เที่ยว</th><th>CM/เที่ยว</th>${ops?'<th>Load Factor</th><th>ต่ำกว่า 70%</th><th>ต่ำกว่า BE</th>':''}</tr></thead><tbody>${visible.map(r=>`<tr><td>${esc(r.route.replace(/\s+-\s+/g,' → '))}</td><td>${r.trip_count==null?'N/A':fmt(r.trip_count,0)}</td><td>${rpNumber(r.revenue)}</td><td>${rpNumber(r.variable_cost)}</td><td class="${r.contribution<0?'rp-loss':''}">${rpNumber(r.contribution)}</td><td>${customerPct(r.margin_pct)}</td><td>${rpNumber(r.revenue_per_trip)}</td><td>${rpNumber(r.cost_per_trip)}</td><td>${rpNumber(r.cm_per_trip)}</td>${ops?`<td>${tripPct(r.operations?.load_factor)}</td><td>${customerPct(r.operations?.below_70_pct)}</td><td>${customerPct(r.operations?.below_break_even_pct)}</td>`:''}</tr>`).join('')||`<tr><td colspan="${ops?12:9}">ไม่พบเส้นทางตามตัวกรอง</td></tr>`}</tbody></table></div><div class="rp-table-footer"><span>${ordered.length} เส้นทาง · ยอด KPI และกราฟใช้ทุกแถวที่ผ่านตัวกรอง</span><div><button data-rp-page="${f.page-1}" ${f.page<=1?'disabled':''}>‹</button><span>หน้า ${f.page} / ${pages}</span><button data-rp-page="${f.page+1}" ${f.page>=pages?'disabled':''}>›</button></div></div></section>
  <details class="rp-coverage"><summary>CM Coverage: ${quality.included_rows==null?'N/A':fmt(quality.included_rows,0)} / ${quality.source_rows==null?'N/A':fmt(quality.source_rows,0)} records · แหล่งข้อมูลและความครอบคลุม</summary><p>${esc(y.source)} · ${esc(y.source_sheet||'Prepared Dataset')} · ${esc(y.period?.start||'')} ถึง ${esc(y.period?.end||'')}<br>ข้อมูลเที่ยว: ${esc(y.route_join?.operational_source||'ยังไม่มี')} · จับคู่ ${y.route_join?.matched_routes??0}/${y.routes?.length||0} เส้นทาง<br>การเงินและข้อมูลเที่ยวรวมแยกก่อนเชื่อมตามชื่อเส้นทางที่คงทิศทางไว้ จำนวนเที่ยว CM ใช้เลขที่ใบรายการที่ไม่ซ้ำและการเงินครบ ยอดทั้งหมดไม่รวม ${quality.excluded_rows==null?'N/A':fmt(quality.excluded_rows,0)} รายการที่ไม่ผ่านการตรวจสอบ<br>Load Factor ใช้เฉพาะรายการปกติที่ผ่าน validation; ถ้าเป็นฐานน้ำหนักเดียวกันใช้ความจุถ่วงน้ำหนัก ถ้าปะปนหน่วยใช้ค่าเฉลี่ยที่ผ่าน validation ไม่บวกความจุต่างหน่วย · กลุ่มทิศทางมาจาก Flag ของไฟล์เที่ยว หากขัดแย้งหรือเชื่อมไม่ได้แสดง “ไม่ระบุ/หลายทิศทาง”</p></details></div>`;
}
function rpNumber(value) { return Number.isFinite(value)?fmt(value,0):'N/A'; }
function rpHandleChange(event) {
  const el=event.target.closest('[data-rp]');if(!el)return;
  const f=rpFilters();f[el.dataset.rp]=el.value;f.page=1;
  if(['direction','route','search'].includes(el.dataset.rp))f.alert='all';
  const focusKey=el.dataset.rp,selection=el.selectionStart;
  render();
  if(focusKey==='search'){const input=document.querySelector('[data-rp="search"]');input?.focus();if(selection!=null)input?.setSelectionRange(selection,selection);}
}

function fleetViewFilters() { return state.fleetView ||= {search:'',metric:'load_factor',sort:'desc',limit:10,page:1}; }
function fleetExecutiveRows(y,trips) {
  const normalize=v=>String(v||'').trim().replace(/\s+/g,' ');
  const cm=y.financial_basis==='contribution_margin';
  const finance=new Map((cm ? y.vehicles : []).map(r=>[normalize(r.vehicle),r]));
  const operational=new Map((trips.fleet||[]).map(r=>[normalize(r.vehicle_type),r]));
  const names=[...new Set([...operational.keys(),...finance.keys()])];
  return names.map(name=>{
    const op=operational.get(name)||{},fin=finance.get(name);
    const per=key=>fin?.trip_count&&Number.isFinite(fin[key])?fin[key]/fin.trip_count:null;
    const count=op.validated_load_records;
    return {vehicle_type:name,trip_count:op.trip_count??null,weight_kg:op.weight_kg??null,load_factor:op.load_factor??null,
      validated_load_records:count??null,below_70_records:count ? op.below_70_records : null,
      below_70_pct:count ? op.below_70_records/count*100 : null,
      revenue_per_trip:cm?per('revenue'):op.revenue_per_trip??null,
      cost_per_trip:cm?per('variable_cost'):op.cost_per_trip??null,
      contribution_per_trip:cm?per('contribution'):op.contribution_per_trip??null,
      cm_trip_count:fin?.trip_count??null,cost_per_ton:op.cost_per_ton??null,
      wasted_cost_total:op.wasted_cost_total??null,wasted_cost_per_trip:op.wasted_cost_per_trip??null,wasted_cost_valid_trips:op.wasted_cost_valid_trips??null,below_break_even_pct:op.below_break_even_pct??null,
      status:op.load_factor==null?'Load Factor ไม่พร้อม':op.load_factor<.7?'Load Factor ต่ำกว่า 70%':'Load Factor ≥ 70%'};
  });
}
const fleetViewMetrics={wasted_cost_total:'ต้นทุนสูญเปล่ารวม',wasted_cost_per_trip:'ต้นทุนสูญเปล่า/เที่ยว',load_factor:'Load Factor เฉลี่ย',trip_count:'จำนวนเที่ยว',weight_kg:'น้ำหนักรวม',below_70_pct:'สัดส่วนต่ำกว่า 70%',revenue_per_trip:'รายได้/เที่ยว',cost_per_trip:'ต้นทุน/เที่ยว',contribution_per_trip:'CM/เที่ยว'};
function fleetViewRows(y,trips) {
  const f=fleetViewFilters();
  return fleetExecutiveRows(y,trips).filter(r=>r.vehicle_type.toLowerCase().includes(f.search.trim().toLowerCase())).sort((a,b)=>{
    const av=a[f.metric],bv=b[f.metric];if(av==null&&bv==null)return a.vehicle_type.localeCompare(b.vehicle_type);if(av==null)return 1;if(bv==null)return -1;
    return (f.sort==='asc'?av-bv:bv-av)||a.vehicle_type.localeCompare(b.vehicle_type);
  });
}
function fleetMetricValue(row,key) {
  if(row[key]==null)return 'N/A';
  if(key==='load_factor')return tripPct(row[key]);
  if(key==='below_70_pct')return customerPct(row[key]);
  if(key==='weight_kg')return tripKg(row[key]);
  if(key==='trip_count')return fmt(row[key],0);
  return tripMoney(row[key]);
}
function fleetTruckIcon() {
  return '<svg viewBox="0 0 40 28" aria-hidden="true"><path d="M3 5h23v15H3zM26 11h7l5 6v3H26z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="10" cy="22" r="3" fill="currentColor"/><circle cx="30" cy="22" r="3" fill="currentColor"/></svg>';
}
function fleetVehicleComparison(y,trips) {
  const f=fleetViewFilters(),rows=fleetViewRows(y,trips),visible=rows.slice(0,5);
  const max=f.metric==='load_factor'?1:Math.max(1,...rows.map(r=>Math.abs(r[f.metric]??0)));
  return `<div class="rp-panel-head"><div><h2>ภาพรวมตามชนิดรถ</h2><p class="rp-muted">5 อันดับตามตัวชี้วัด · กดชนิดรถเพื่อดูรายละเอียด</p></div><select data-fv="metric" aria-label="ตัวชี้วัดชนิดรถ">${Object.entries(fleetViewMetrics).map(([k,v])=>`<option value="${k}" ${f.metric===k?'selected':''}>${v}</option>`).join('')}</select></div><div class="fv-vehicle-bars">${visible.map(r=>`<button class="fv-vehicle-row" data-fv-vehicle="${esc(r.vehicle_type)}" title="ดูรายละเอียด ${esc(r.vehicle_type)}"><span class="fv-truck">${fleetTruckIcon()}</span><span class="fv-vehicle-name"><b>${esc(r.vehicle_type)}</b><small>${r.trip_count==null?'N/A':fmt(r.trip_count,0)} เที่ยว · ${tripKg(r.weight_kg)}</small></span><span class="fv-track"><i style="width:${r[f.metric]==null?0:Math.min(100,Math.abs(r[f.metric])/max*100)}%" class="${r[f.metric]<0?'negative':''}"></i></span><strong>${fleetMetricValue(r,f.metric)}</strong></button>`).join('')||'<p class="rp-empty">ไม่พบชนิดรถตามคำค้น</p>'}</div>`;
}
function fleetServiceSource(y) {
  const candidates=(state.data?.years||[]).filter(r=>r.service_groups?.length).sort((a,b)=>b.year-a.year);
  return candidates.find(r=>r.year===Number(state.serviceYear))||candidates.find(r=>r.year===y.year)||candidates[0];
}
function fleetServiceIcon(kind) {
  const shapes={general:'<path d="M20 34V17M20 25C5 27 4 11 5 7c12 0 18 8 15 18ZM20 20C20 7 30 4 36 5c0 10-6 17-16 15"/>',chilled:'<rect x="9" y="3" width="24" height="36" rx="3"/><path d="M9 15h24M14 8v3M14 20v8"/>',frozen:'<path d="M21 2v38M4 11l34 20M4 31l34-20M15 5l6 5 6-5M15 37l6-5 6 5M4 18l7-3-1-7M32 34l-1-7 7-3M4 24l7 3-1 7M32 8l-1 7 7 3"/>',invoice:'<path d="M10 3h16l9 9v27H10ZM26 3v10h9M15 20h15M15 26h15M15 32h11"/>'};
  return `<svg viewBox="0 0 42 42" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${shapes[kind]}</svg>`;
}
function fleetServiceSnapshot(y) {
  const source=fleetServiceSource(y),groups=source?serviceRows(source):[];
  const standard=[['สินค้าทั่วไป','▧','general'],['สินค้าแช่เย็น','▣','chilled'],['สินค้าแช่แข็ง','❄','frozen'],['บิลเคลียร์','▤','invoice']];
  const ratioFor = name => groups.find(r => r.service === name)?.return_on_cost_pct;
  standard.sort(([a],[b]) => {
    const av=ratioFor(a), bv=ratioFor(b);
    if(!Number.isFinite(av)&&!Number.isFinite(bv))return 0;
    if(!Number.isFinite(av))return 1;
    if(!Number.isFinite(bv))return -1;
    return bv-av;
  });
  const available=(state.data?.years||[]).filter(r=>r.service_groups?.length);
  return `<div class="rp-panel-head"><div><h2>ภาพรวมกลุ่มบริการ</h2><p class="rp-muted">${source?`${esc(source.service_source||source.source)} · ปี ${source.year}`:'ยังไม่มีข้อมูลกลุ่มบริการ'} · เรียงผลตอบแทนต่อต้นทุนมาก → น้อย</p></div>${source?`<select id="fleetServiceYear" aria-label="ปีข้อมูลกลุ่มบริการ">${available.map(r=>`<option value="${r.year}" ${r.year===source.year?'selected':''}>ปี ${r.year}</option>`).join('')}</select>`:''}</div><div class="fv-service-grid">${standard.map(([name,icon,cls])=>{
    const g=groups.find(r=>r.service===name);const cost=g?.cost_status==='missing'?null:g?.cost;
    return `<article class="fv-service-card ${cls}"><div class="fv-service-title"><span aria-hidden="true">${fleetServiceIcon(cls)}</span><h3>${name}</h3></div><dl>${[['รายได้',customerMoney(g?.revenue)],['ต้นทุนตามข้อมูล',customerMoney(cost)],['Contribution',customerMoney(g?.profit_metric)],['Margin',customerPct(g?.margin_pct)],['ผลตอบแทนต่อต้นทุน',customerPct(g?.return_on_cost_pct)]].map(([label,value])=>`<div><dt>${label}</dt><dd>${value}</dd></div>`).join('')}</dl><small>${!g?'ยังไม่มีข้อมูล':g.cost_status==='missing'?'ต้นทุนยังไม่ครบ':g.cost_status==='partial'?'ต้นทุนบางส่วนตาม PQ':'ตามตารางต้นทุนที่เตรียมไว้'}</small></article>`;
  }).join('')}</div><p class="fv-source-note">${esc(source?.service_basis||'รอข้อมูล')} · ตัวเลขกลุ่มบริการไม่ใช่ยอด CM ตามชนิดรถ</p>${groups.some(g=>!standard.some(([n])=>n===g.service))?'<p class="rp-muted">มีกลุ่มอื่นเพิ่มเติม ดูในรายละเอียดกลุ่มบริการด้านล่าง</p>':''}`;
}
function fleetDistribution(trips) {
  const bands=trips.load_bands,total=bands?.total;
  const rows=[['below_50','< 50%','#f27d81'],['from_50_to_70','50–69.9%','#efbd48'],['at_or_above_70','≥ 70%','#3296ee']];
  if(!total)return '<p class="rp-empty">ยังไม่มี Load Factor ที่ผ่านการตรวจสอบ</p>';
  let position=0;const stops=rows.map(([key,,color])=>{const start=position;position+=bands[key]/total*100;return `${color} ${start}% ${position}%`;});
  return `<div class="fv-distribution"><div class="rp-donut" style="background:conic-gradient(${stops.join(',')})"><div><b>${fmt(total,0)}</b><small>เที่ยวที่มี LF</small></div></div><div class="fv-band-list">${rows.map(([key,label,color])=>`<div><div><span><i style="background:${color}"></i>${label}</span><b>${fmt(bands[key],0)} เที่ยว</b><strong>${customerPct(bands[key]/total*100)}</strong></div><div class="fv-band-track"><i style="width:${bands[key]/total*100}%;background:${color}"></i></div></div>`).join('')}</div></div>`;
}
function fleetDirections(trips) {
  const labels={'กทม.-เหนือ':'กทม./ปริมณฑล → สายเหนือ','เหนือ-กทม':'สายเหนือ → กทม./ปริมณฑล','อื่นๆ':'อื่น ๆ'};
  const rows=[...(trips.direction||[])].sort((a,b)=>(b.load_factor??-1)-(a.load_factor??-1));
  return `<div class="fv-direction-bars">${rows.map(r=>`<div><div><b>${esc(labels[r.direction]||r.direction||'ไม่ระบุ')}</b><span>${tripPct(r.load_factor)}</span></div><div class="fv-track"><i style="width:${r.load_factor==null?0:r.load_factor*100}%"></i></div><small>${r.trip_count==null?'N/A':fmt(r.trip_count,0)} รายการเที่ยว · มี LF ${r.validated_load_records==null?'N/A':fmt(r.validated_load_records,0)} รายการ</small></div>`).join('')||'<p class="rp-empty">ยังไม่มีข้อมูลทิศทาง</p>'}</div>`;
}
function fleetDiagnosticSection(y,trips) {
  const f=fleetViewFilters(),rows=fleetViewRows(y,trips),cm=y.financial_basis==='contribution_margin';
  const size=f.limit==='all'?Math.max(rows.length,1):Number(f.limit),pages=Math.max(1,Math.ceil(rows.length/size));f.page=Math.min(f.page,pages);
  const visible=rows.slice((f.page-1)*size,f.page*size);
  return `<div class="rp-panel-head"><h2>Fleet Diagnostic Table</h2><input type="search" data-fv="search" value="${esc(f.search)}" placeholder="ค้นหาชนิดรถ…" aria-label="ค้นหาชนิดรถ"><div class="rp-table-controls"><select data-fv="metric" aria-label="จัดเรียงชนิดรถ">${Object.entries(fleetViewMetrics).map(([k,v])=>`<option value="${k}" ${f.metric===k?'selected':''}>${v}</option>`).join('')}</select><select data-fv="sort" aria-label="ลำดับชนิดรถ"><option value="desc" ${f.sort==='desc'?'selected':''}>มาก → น้อย</option><option value="asc" ${f.sort==='asc'?'selected':''}>น้อย → มาก</option></select><select data-fv="limit" aria-label="จำนวนชนิดรถที่แสดง">${[5,10,25,50,'all'].map(n=>`<option value="${n}" ${String(f.limit)===String(n)?'selected':''}>${n==='all'?'ทั้งหมด':n+' รายการ'}</option>`).join('')}</select></div></div><p class="rp-muted">ตารางและอันดับชนิดรถใช้ตัวกรองเดียวกัน · KPI ด้านบนเป็นภาพรวมปี · การเงิน${cm?'จาก CM หารด้วยรายการ CM ที่ครบ':'จากไฟล์เที่ยว'} · น้ำหนักและ Cost/Ton จากไฟล์เที่ยว</p><div class="rp-table-scroll"><table><thead><tr><th>ชนิดรถ</th><th>เที่ยว</th>${cm?'<th>รายการ CM</th>':''}<th>น้ำหนักรวม</th><th>Load Factor</th><th>ต่ำกว่า 70%</th><th>ต่ำกว่า BE</th><th>ต้นทุนสูญเปล่ารวม</th><th>ต้นทุนสูญเปล่า/เที่ยว</th><th>รายได้/เที่ยว</th><th>${cm?'ต้นทุนผันแปร':'ต้นทุน'}/เที่ยว</th><th>${cm?'CM':'Contribution'}/เที่ยว</th><th>Cost/Ton</th><th>สถานะ</th></tr></thead><tbody>${visible.map(r=>`<tr><td><b>${esc(r.vehicle_type)}</b></td><td>${r.trip_count==null?'N/A':fmt(r.trip_count,0)}</td>${cm?`<td>${r.cm_trip_count==null?'N/A':fmt(r.cm_trip_count,0)}</td>`:''}<td>${tripKg(r.weight_kg)}</td><td>${tripPct(r.load_factor)}</td><td>${customerPct(r.below_70_pct)}</td><td>${customerPct(r.below_break_even_pct)}</td><td>${tripMoney(r.wasted_cost_total)}</td><td title="หารด้วย ${r.wasted_cost_valid_trips??0} เที่ยวที่มีค่าตัวเลข">${tripMoney(r.wasted_cost_per_trip)}</td><td>${tripMoney(r.revenue_per_trip)}</td><td>${tripMoney(r.cost_per_trip)}</td><td>${tripMoney(r.contribution_per_trip)}</td><td>${tripMoney(r.cost_per_ton)}</td><td><span class="fv-status ${r.load_factor==null?'unknown':r.load_factor>=.7?'ready':'watch'}">${r.status}</span></td></tr>`).join('')||`<tr><td colspan="${cm?14:13}">ไม่พบชนิดรถตามคำค้น</td></tr>`}</tbody></table></div><div class="rp-table-footer"><span>${rows.length} ชนิดรถ · เงินต่อเที่ยวแสดงเป็นบาท</span><div><button data-fv-page="${f.page-1}" ${f.page<=1?'disabled':''}>‹</button><span>หน้า ${f.page} / ${pages}</span><button data-fv-page="${f.page+1}" ${f.page>=pages?'disabled':''}>›</button></div></div>`;
}
function fleetWastedCard(trips) {
  const t=trips.totals||{},ready=t.wasted_cost_valid_trips>0;
  return rpCard('ต้นทุนสูญเปล่าจาก Load Factor',customerMoney(t.wasted_cost_total),ready?`เกิดใน ${fmt(t.wasted_cost_positive_trips,0)} เที่ยว · ${customerPct(t.wasted_cost_positive_pct)} ของเที่ยวที่ตรวจสอบได้`:'ยังไม่มีค่าตัวเลขที่ตรวจสอบได้','!','coral');
}
function wastedCostRank(trips,group,label) {
  const key=group==='fleet'?'vehicle_type':'route';
  const rows=[...(trips[group]||[])].filter(r=>Number.isFinite(r.wasted_cost_total)).sort((a,b)=>b.wasted_cost_total-a.wasted_cost_total).slice(0,10);
  const max=Math.max(1,...rows.map(r=>Math.abs(r.wasted_cost_total)));
  return `<section class="rp-panel"><h2>${label}</h2><p class="rp-muted">Top 10 ตามมูลค่าต้นทุนสูญเปล่าจาก Load Factor · มาก → น้อย</p><div class="wc-ranking">${rows.map(r=>`<div class="wc-rank-row"><div class="wc-rank-heading"><b title="${esc(r[key])}">${esc(r[key])}</b><strong>${tripMoney(r.wasted_cost_total)}</strong></div><div class="wc-track"><i style="width:${Math.abs(r.wasted_cost_total)/max*100}%"></i></div><small>${fmt(r.wasted_cost_valid_trips,0)} เที่ยวที่มีค่า · ${tripMoney(r.wasted_cost_per_trip)}/เที่ยว · LF ${tripPct(r.load_factor)}${group==='routes'?` · ต่ำกว่า 70% ${r.validated_load_records?customerPct(r.below_70_records/r.validated_load_records*100):'N/A'} · ต่ำกว่า BE ${customerPct(r.below_break_even_pct)}`:''}</small></div>`).join('')||'<p class="rp-empty">ยังไม่มีข้อมูลต้นทุนสูญเปล่าที่ตรวจสอบได้</p>'}</div></section>`;
}
function fleetWastedSection(trips) {
  const t=trips.totals||{},source=trips.wasted_cost_source||{};
  const top=group=>[...(trips[group]||[])].filter(r=>Number.isFinite(r.wasted_cost_total)).sort((a,b)=>b.wasted_cost_total-a.wasted_cost_total)[0];
  const vehicle=top('fleet'),route=top('routes');
  const insights=[];
  if(vehicle)insights.push(`ชนิดรถที่มียอดสูงสุด: ${esc(vehicle.vehicle_type)} · ${tripMoney(vehicle.wasted_cost_total)}`);
  if(route)insights.push(`เส้นทางที่มียอดสูงสุด: ${esc(route.route)} · ${tripMoney(route.wasted_cost_total)}`);
  if(t.wasted_cost_valid_trips)insights.push(`เกิดต้นทุนสูญเปล่าใน ${fmt(t.wasted_cost_positive_trips,0)} จาก ${fmt(t.wasted_cost_valid_trips,0)} เที่ยวที่มีข้อมูล (${customerPct(t.wasted_cost_positive_pct)})`);
  return `<section class="wc-section"><div class="wc-summary"><h2>ต้นทุนสูญเปล่าจาก Load Factor</h2><b>เฉลี่ย ${tripMoney(t.wasted_cost_per_trip)} / เที่ยวที่มีข้อมูล</b></div><p class="fv-source-note" title="ใช้ค่าจาก Excel โดยตรง ไม่คำนวณสูตรใหม่">อ้างอิงคอลัมน์ ‘ต้นทุนสูญเปล่า factor’ ในชีท ‘${esc(source.sheet||trips.sheet||'รวม')}’ ของ ${esc(trips.source||'ไฟล์สรุปเที่ยว')} · เฉพาะสถานะปกติ<br>ตัวหาร ${t.wasted_cost_valid_trips==null?'N/A':fmt(t.wasted_cost_valid_trips,0)} คีย์เที่ยวที่มีค่าตัวเลข · ${source.missing_normal_rows==null?'N/A':fmt(source.missing_normal_rows,0)} แถวปกติไม่มีค่า จึงไม่เติมเป็น 0</p>${insights.length?`<div class="wc-insights">${insights.map(s=>`<div>${s}</div>`).join('')}</div>`:''}<div class="fv-middle-grid">${wastedCostRank(trips,'fleet','ต้นทุนสูญเปล่าตามชนิดรถ')}${wastedCostRank(trips,'routes','เส้นทางที่มีต้นทุนสูญเปล่าสูง')}</div></section>`;
}

function fleetExecutivePage(y) {
  const trips=selectedTripSummary(),t=trips.totals||{},cm=y.financial_basis==='contribution_margin';
  const known=trips.ok,rows=fleetExecutiveRows(y,trips),vehicleCount=rows.filter(r=>!['0','ไม่ระบุ','ยังไม่ได้ระบุ',''].includes(r.vehicle_type)).length;
  const cmCount=y.overview?.totals?.trip_count,cmValue=y.overview?.totals?.contribution;
  const financial=cm?(cmCount&&Number.isFinite(cmValue)?cmValue/cmCount:null):t.cost_per_trip;
  const lowPct=t.validated_trip_load_count? t.below_70_records/t.validated_trip_load_count*100:null;
  return `<div class="fv-dashboard rp-dashboard"><div class="fv-status-strip"><span>ข้อมูลปกติ <b>${known?fmt(trips.normal_rows,0):'N/A'}</b></span><span>ตัดออก <b>${known?fmt(trips.excluded_rows,0):'N/A'}</b></span><span>มี Load Factor ใช้ได้ <b>${t.validated_trip_load_count==null?'N/A':fmt(t.validated_trip_load_count,0)}</b></span><span>ชนิดรถ <b>${known||cm?vehicleCount:'N/A'}</b></span><span>ต่ำกว่า 70% <b>${t.below_70_records==null?'N/A':fmt(t.below_70_records,0)}</b></span><span class="fv-unverified">Empty Trip / Backhaul ยังไม่ยืนยัน</span></div><div class="fv-kpis">${rpCard('จำนวนเที่ยว',known?fmt(trips.candidate_trip_count,0):'N/A','รายการเที่ยวที่ระบบจัดกลุ่ม','▰','blue')}${rpCard('น้ำหนักบรรทุก',tripKg(t.total_weight_kg),'รวมเฉพาะรายการที่มีน้ำหนัก','▣','blue')}${rpCard('Load Factor เฉลี่ย',tripPct(t.avg_load_factor),'เฉพาะเที่ยวที่ผ่าน validation','▥','green')}${rpCard('ต่ำกว่า 70%',customerPct(lowPct),t.below_70_records==null?'ยังไม่มีข้อมูล':fmt(t.below_70_records,0)+' เที่ยวที่มี LF','◔','purple')}${rpCard('ต่ำกว่าจุดคุ้มทุน',t.below_break_even_records==null?'N/A':fmt(t.below_break_even_records,0),'จำนวนรายการตามเกณฑ์ BE เดิม','△','coral')}${rpCard(cm?'CM เฉลี่ย/เที่ยว':'ต้นทุนเฉลี่ย/เที่ยว',tripMoney(financial),cm?'ฐานรายการ CM ที่ครบ':'ฐานเที่ยวที่มีต้นทุน','฿','amber')}</div>
  <div class="fv-middle-grid"><section class="rp-panel"><h2>Load Factor Distribution</h2><p class="rp-muted">สัดส่วนจากเที่ยวที่มี Load Factor ผ่าน validation</p>${fleetDistribution(trips)}</section><section class="rp-panel"><h2>Load Factor ตามทิศทาง</h2><p class="rp-muted">เทียบค่าเฉลี่ยและจำนวนรายการเที่ยว</p>${fleetDirections(trips)}</section></div>
  <div class="fv-top-grid"><section class="rp-panel">${fleetVehicleComparison(y,trips)}</section><section class="rp-panel">${fleetServiceSnapshot(y)}</section></div>
  ${fleetWastedSection(trips)}
  <section class="rp-panel rp-details" id="fleetExecutiveDetails">${fleetDiagnosticSection(y,trips)}</section>
  <div class="fv-source-note">การบรรทุก: ${esc(trips.source||'ยังไม่มีข้อมูลเที่ยวของปีนี้')} · การเงินชนิดรถ: ${esc(cm?y.source:trips.source||'ยังไม่มี')}<br>${cm?'CM และจำนวนเที่ยวปฏิบัติการเป็นคนละชุดข้อมูล จึงแสดงจำนวนที่ใช้หารแยกกัน · ':''}Load Factor ใช้ค่าเฉลี่ยที่ผ่านการตรวจสอบตามระบบเดิม · Cost/Ton แสดงเมื่อยอดต้นทุนและน้ำหนักในไฟล์เที่ยวครบ</div>
  <details class="fv-more"><summary>รายละเอียดกลุ่มบริการและตัวกรองเพิ่มเติม</summary>${serviceAnalysisSection()}</details>
  <details class="fv-more"><summary>Cost / Trip vs Load Factor ตามชนิดรถ</summary><div class="rp-panel"><p class="rp-muted">ใช้ต้นทุนต่อเที่ยวจากไฟล์เที่ยวและ Load Factor ที่ผ่านการตรวจสอบ</p>${fleetUtilScatter(trips)}</div></details>
  </div>`;
}
function fleetViewChange(e) {
  const el=e.target.closest('[data-fv]');if(!el)return;
  const f=fleetViewFilters();f[el.dataset.fv]=el.value;f.page=1;
  const search=el.dataset.fv==='search',pos=el.selectionStart;render();
  if(search){const input=document.querySelector('[data-fv="search"]');input?.focus();if(pos!=null)input?.setSelectionRange(pos,pos);}
}

function render() {
  const c = $('content');
  document.body?.classList.toggle('route-portfolio-view', state.page === 'trip_route');
  document.body?.classList.toggle('fleet-executive-view', state.page === 'fleet_util');
  document.body?.classList.toggle('scenario-executive-view', state.page === 'action_scenario');
  if (!state.data?.ok) {
    c.innerHTML = `<div class="panel"><div class="panel-title">ยังไม่มีข้อมูลพร้อมสร้าง Dashboard</div><p>อัปโหลดหรือวางไฟล์ Prepared Dataset เช่น PQ67/PQ68/PQ69 ใน <code>input/</code> แล้วกด “ประมวลผลข้อมูล”</p>${state.data?.errors?.length ? `<pre>${esc(JSON.stringify(state.data.errors, null, 2))}</pre>` : ''}</div>`;
    return;
  }
  const y = current();
  if (!y) return;
  const title = { overview: 'Executive Overview', trip_route: 'Trip & Route Profitability', fleet_util: 'Fleet Utilization & Load Efficiency', customer_credit: 'Customer Profitability & Credit Risk', action_scenario: 'Management Action & Scenario', sources: 'Data / Settings' };
  $('pageTitle').textContent = ['trip_route','fleet_util'].includes(state.page) ? title[state.page] : `NIM Executive Analytics · ${title[state.page]}`;
  if ($('routeHeaderControls')) $('routeHeaderControls').innerHTML = state.page === 'trip_route' ? rpHeaderControls(y) : '';
  $('pageSubtitle').textContent = state.page === 'fleet_util' ? 'วิเคราะห์การใช้รถ น้ำหนักบรรทุก และประสิทธิภาพตามชนิดรถ เส้นทาง และทิศทาง' : state.page === 'trip_route' ? 'วิเคราะห์ความสามารถในการทำกำไรของแต่ละเส้นทาง' : state.page === 'customer_credit' ? 'วิเคราะห์กำไรลูกค้าและตรวจสอบความเสี่ยงด้านเครดิตเมื่อมีข้อมูลลูกหนี้' : state.page === 'action_scenario' ? 'สรุปประเด็นที่ผู้บริหารควรดำเนินการ และจำลองผลกระทบทางการเงินจากการปรับรายได้และต้นทุน' : 'ระบบวิเคราะห์ข้อมูลเพื่อสนับสนุนการตัดสินใจของผู้บริหาร';
  const pages = { overview: executiveOverviewPage, trip_route: tripRoutePage, fleet_util: fleetUtilizationPage, customer_credit: () => customerCreditPage(), action_scenario: managementActionPage };
  $('yearFilter').disabled = state.page === 'customer_credit';
  $('yearFilter').title = state.page === 'customer_credit' ? 'หน้านี้ใช้ข้อมูลทั้งหมดจากไฟล์ลูกค้ารายคน ไม่ได้กรองตามปีของ CM' : '';
  c.innerHTML = state.page === 'sources' ? sourcesPage() : state.page === 'trip_route' ? routePortfolioPage(y) : state.page === 'fleet_util' ? fleetExecutivePage(y) : state.page === 'customer_credit' ? customerCreditPage() : y.financial_basis === 'contribution_margin' ? cmPage(y) : pages[state.page](y);
  if (state.page === 'fleet_util') {
    $('fleetServiceYear')?.addEventListener('change', e => { state.serviceYear = Number(e.target.value); render(); });
    $('serviceYearFilter')?.addEventListener('change', e => { state.serviceYear = Number(e.target.value); render(); });
  }
  if (y.financial_basis === 'contribution_margin' || state.page === 'action_scenario') {
    if ($('cmSearch')) $('cmSearch').addEventListener('change', e => { state.cmFilter = {...(state.cmFilter || {sort: 'contribution'}), search: e.target.value}; render(); });
    if ($('cmSort')) $('cmSort').addEventListener('change', e => { state.cmFilter = {...(state.cmFilter || {search: ''}), sort: e.target.value}; render(); });
    document.querySelectorAll('[data-cm-scenario]').forEach(el => el.addEventListener('input', updateCMScenario));
  }
  if (state.page === 'action_scenario') updateScenario();
}

async function loadData() {
  const c = $('content');
  c.innerHTML = '<div class="panel"><b>กำลังโหลดข้อมูลที่ประมวลผลแล้ว...</b></div>';
  try {
    const r = await fetch('/api/dashboard', { cache: 'no-store' });
    state.data = await r.json();
    const ys = $('yearFilter');
    ys.innerHTML = '';
    const availableYears = [...(state.data.available_years || [])].sort((a, b) => b - a);
    availableYears.forEach(y => ys.add(new Option(`ปี ${y}`, y)));
    if (!state.year || !availableYears.includes(Number(state.year))) state.year = availableYears[0] || null;
    ys.value = state.year || '';
    $('lastUpdated').textContent = state.data.generated_at ? new Date(state.data.generated_at).toLocaleString('th-TH') : '—';
    if (state.data.needs_process) {
      c.innerHTML = `<div class="panel"><div class="panel-title">ต้องประมวลผลข้อมูลก่อน</div><p>${esc(state.data.message || 'กรุณากดประมวลผลข้อมูล')}</p><button class="upload-btn" onclick="document.getElementById('reloadDataBtn').click()">⚙ ประมวลผลข้อมูลตอนนี้</button></div>`;
      return;
    }
    render();
  } catch (e) {
    c.innerHTML = `<div class="panel"><b>เชื่อม Local Server ไม่ได้</b><p>${esc(e.message)}</p></div>`;
  }
}

async function processData() {
  const c = $('content'), btn = $('reloadDataBtn');
  btn.disabled = true;
  btn.textContent = 'กำลังประมวลผล...';
  c.innerHTML = '<div class="panel"><div class="panel-title">กำลังประมวลผลข้อมูล</div><p>ระบบกำลังตรวจไฟล์ สร้าง Data Catalog และอัปเดต Dashboard Cache</p></div>';
  try {
    const r = await fetch('/api/process', { method: 'POST' });
    const d = await r.json();
    if (!r.ok) throw Error(d.error || 'process error');
    await loadData();
  } catch (e) {
    c.innerHTML = `<div class="panel"><b>ประมวลผลไม่สำเร็จ</b><p>${esc(e.message)}</p></div>`;
  } finally {
    btn.disabled = false;
    btn.textContent = '⚙ ประมวลผลข้อมูล';
  }
}

function readScenarioInputs() {
  const y = current();
  if (!y) return null;
  const get = key => document.querySelector(`[data-scenario="${key}"]`);
  const values = {
    targetRevenueM: Number(get('targetRevenueM')?.value || 0),
    travelReduction: Number(get('travelReduction')?.value || 0),
    fuelReduction: Number(get('fuelReduction')?.value || 0),
    repairReduction: Number(get('repairReduction')?.value || 0),
    rentalReduction: Number(get('rentalReduction')?.value || 0),
    scaleCosts: !!get('scaleCosts')?.checked,
    targetProfitM: Number(get('targetProfitM')?.value || 0)
  };
  return values;
}

function syncScenarioPair(key, source) {
  document.querySelectorAll(`[data-scenario="${key}"]`).forEach(el => { if (el !== source && el.type !== 'checkbox') el.value = source.value; });
}

function updateScenario() {
  if (state.page === 'action_scenario') { updateCMScenario(); return; }
  if (state.page !== 'action_scenario') return;
  const y = current();
  if (!y) return;
  const p = y.profit_summary || {}, t = y.overview?.totals || {};
  const baseRevenue = p.revenue || t.revenue || 0;
  const baseCost = p.cost || t.all_costs || 0;
  const baseProfit = p.profit || (baseRevenue - baseCost);
  const s = readScenarioInputs();
  if (!s || !baseRevenue) return;
  localStorage.setItem(`nimScenario:${y.year}`, JSON.stringify(s));

  const targetRevenue = s.targetRevenueM * 1e6;
  const ratio = baseRevenue ? targetRevenue / baseRevenue : 1;
  const comp = {
    travel: t.travel || 0,
    fuel: t.fuel || 0,
    repair: t.repair || 0,
    rental: t.rental || 0
  };
  const knownBase = comp.travel + comp.fuel + comp.repair + comp.rental;
  const otherBase = baseCost - knownBase;
  const scale = s.scaleCosts ? ratio : 1;
  const projected = {
    travel: comp.travel * scale * (1 - s.travelReduction / 100),
    fuel: comp.fuel * scale * (1 - s.fuelReduction / 100),
    repair: comp.repair * scale * (1 - s.repairReduction / 100),
    rental: comp.rental * scale * (1 - s.rentalReduction / 100),
    other: otherBase * scale
  };
  const projectedCost = projected.travel + projected.fuel + projected.repair + projected.rental + projected.other;
  const projectedProfit = targetRevenue - projectedCost;
  const projectedMargin = targetRevenue ? projectedProfit / targetRevenue * 100 : 0;
  const profitDelta = projectedProfit - baseProfit;
  const marginDelta = projectedMargin - (baseRevenue ? baseProfit / baseRevenue * 100 : 0);
  const savingsVsScaledBase = (baseCost * scale) - projectedCost;

  $('scenarioResults').innerHTML = `<div class="scenario-kpis"><div><span>Projected Revenue</span><b>${moneyM(targetRevenue)}</b></div><div><span>Projected Cost</span><b>${moneyM(projectedCost)}</b></div><div><span>Projected Result</span><b class="${projectedProfit < 0 ? 'loss' : 'good'}">${moneyM(projectedProfit)}</b></div><div><span>Projected Margin</span><b>${pct(projectedMargin)}</b></div></div><div class="impact-strip"><div><span>ผลตอบแทนเปลี่ยนแปลง</span><b class="${profitDelta < 0 ? 'loss' : 'good'}">${profitDelta >= 0 ? '+' : ''}${moneyM(profitDelta).replace('฿ ', '฿ ')}</b></div><div><span>Margin เปลี่ยนแปลง</span><b class="${marginDelta < 0 ? 'loss' : 'good'}">${marginDelta >= 0 ? '+' : ''}${fmt(marginDelta, 1)} pp</b></div><div><span>ประหยัดต้นทุนจาก Efficiency</span><b class="good">${moneyM(Math.max(0, savingsVsScaledBase))}</b></div></div><div class="scenario-warning">${Math.abs(otherBase) > Math.max(1e6, baseCost * .02) ? `หมายเหตุ: ต้นทุนรวมตามข้อมูลต่างจากผลรวม 4 หมวดหลักอยู่ ${moneyM(otherBase)} ระบบจึงเก็บส่วนต่างนี้เป็น “Other cost” ใน Scenario` : 'ต้นทุนฐานสามารถ reconcile กับหมวดต้นทุนหลักได้ในระดับที่เหมาะสม'}</div>`;

  $('scenarioComparison').innerHTML = `<table class="simple-table"><thead><tr><th>Metric</th><th>Current</th><th>Scenario</th><th>Change</th></tr></thead><tbody><tr><td>Revenue</td><td>${moneyM(baseRevenue)}</td><td>${moneyM(targetRevenue)}</td><td>${moneyM(targetRevenue - baseRevenue)}</td></tr><tr><td>Cost</td><td>${moneyM(baseCost)}</td><td>${moneyM(projectedCost)}</td><td>${moneyM(projectedCost - baseCost)}</td></tr><tr><td>Result</td><td>${moneyM(baseProfit)}</td><td>${moneyM(projectedProfit)}</td><td class="${profitDelta < 0 ? 'loss' : 'good'}">${moneyM(profitDelta)}</td></tr><tr><td>Margin</td><td>${pct(baseRevenue ? baseProfit / baseRevenue * 100 : 0)}</td><td>${pct(projectedMargin)}</td><td>${fmt(marginDelta, 1)} pp</td></tr></tbody></table>`;

  const adjustedBaseCost = comp.travel * (1 - s.travelReduction / 100) + comp.fuel * (1 - s.fuelReduction / 100) + comp.repair * (1 - s.repairReduction / 100) + comp.rental * (1 - s.rentalReduction / 100) + otherBase;
  const targetProfit = s.targetProfitM * 1e6;
  let requiredRevenue = 0;
  if (s.scaleCosts) {
    const scenarioCostRate = adjustedBaseCost / baseRevenue;
    const scenarioMarginRate = 1 - scenarioCostRate;
    requiredRevenue = scenarioMarginRate > 0 ? targetProfit / scenarioMarginRate : Infinity;
  } else {
    requiredRevenue = targetProfit + adjustedBaseCost;
  }
  $('reverseResult').innerHTML = Number.isFinite(requiredRevenue) ? `<span>ยอดขายที่ต้องทำประมาณ</span><b>${moneyM(requiredRevenue)}</b><small>ภายใต้สมมติฐานลดต้นทุนปัจจุบัน</small>` : '<span class="loss">ไม่สามารถคำนวณได้ เพราะโครงสร้างต้นทุนทำให้ Margin ภายใต้ Scenario ไม่เป็นบวก</span>';
}

function showCustomerDrilldown(customerId, quadrant) {
  const summary=customerData();
  const row=customerId == null ? null : summary?.rows?.find(r=>r.customer===customerId);
  if(customerId != null && !row)return;
  if(quadrant && !customerQuadrants[quadrant])return;
  let dialog=$('customerDrilldown');
  if(!dialog){
    dialog=document.createElement('dialog');dialog.id='customerDrilldown';dialog.className='customer-drilldown';
    dialog.setAttribute('aria-labelledby','customerDrilldownTitle');document.body.appendChild(dialog);
    dialog.addEventListener('click',e=>{if(e.target===dialog || e.target.closest('[data-customer-close]'))dialog.close();});
  }
  const title=row ? `ลูกค้า ${row.customer}` : customerQuadrants[quadrant].label;
  const groupRows=(summary?.rows||[]).filter(r=>r.matrix_quadrant===quadrant).sort((a,b)=>(b.contribution??-Infinity)-(a.contribution??-Infinity));
  dialog.innerHTML=`<header><div><h2 id="customerDrilldownTitle">${esc(title)}</h2><small>ข้อมูลจาก ${esc(summary.source)}</small></div><button type="button" data-customer-close aria-label="ปิดรายละเอียด">✕</button></header>${row ? `<div class="customer-drilldown-values">${[['รายได้',tripMoney(row.revenue)],['ต้นทุนจัดสรร',tripMoney(row.allocated_cost)],['Contribution',tripMoney(row.contribution)],['Margin',customerPct(row.margin_pct)],['ผลตอบแทนต่อต้นทุน',customerPct(row.return_on_cost_pct)],['กลุ่มเมทริกซ์',esc(customerQuadrants[row.matrix_quadrant]?.label||'N/A')],['สถานะ',esc(customerStatusLabel(row.profitability_status))],['กลยุทธ์ลูกค้า',esc(row.strategy_segment||'ไม่มีข้อมูล')]].map(([label,value])=>`<div><span>${label}</span><strong>${value}</strong></div>`).join('')}</div>${row.matrix_quadrant?`<button class="customer-drilldown-group" data-customer-group="${esc(row.matrix_quadrant)}">ดูลูกค้าทั้งหมดในกลุ่มนี้</button>`:''}` : `<p>${groupRows.length} ราย · กดรหัสลูกค้าเพื่อดูรายละเอียด</p><div class="customer-table-wrap"><table class="simple-table"><thead><tr><th>ลูกค้า</th><th>รายได้ (บาท)</th><th>Contribution (บาท)</th><th>Margin</th></tr></thead><tbody>${groupRows.map(r=>`<tr><td><button class="customer-drilldown-link" data-customer-open="${esc(r.customer)}">${esc(r.customer)}</button></td><td>${tripMoney(r.revenue)}</td><td>${tripMoney(r.contribution)}</td><td>${customerPct(r.margin_pct)}</td></tr>`).join('')||'<tr><td colspan="4">ไม่มีลูกค้าในกลุ่มนี้</td></tr>'}</tbody></table></div>`}`;
  if(!dialog.open)dialog.showModal();
  dialog.querySelector('[data-customer-close]').focus();
}
function customerDrilldownClick(e) {
  const point=e.target.closest('[data-customer-open]'),group=e.target.closest('[data-customer-group]');
  if(point)showCustomerDrilldown(point.dataset.customerOpen,null);
  else if(group)showCustomerDrilldown(null,group.dataset.customerGroup);
}
document.addEventListener('click',customerDrilldownClick);
$('content').addEventListener('input', e => { if(e.target.matches('[data-fv="search"]'))fleetViewChange(e); });
$('content').addEventListener('change', e => { if(!e.target.matches('[data-fv="search"]'))fleetViewChange(e); });
$('content').addEventListener('click', e => {
  const vehicle=e.target.closest('[data-fv-vehicle]'),page=e.target.closest('[data-fv-page]');
  if(!vehicle&&!page)return;
  const f=fleetViewFilters();
  if(vehicle){f.search=vehicle.dataset.fvVehicle;f.page=1;}else f.page=Number(page.dataset.fvPage);
  render();
  if(vehicle)$('fleetExecutiveDetails')?.scrollIntoView({behavior:'smooth',block:'start'});
});

document.addEventListener('keydown',e=>{
  if((e.key==='Enter'||e.key===' ') && e.target.matches('[role="button"][data-customer-open], [role="button"][data-customer-group]')){e.preventDefault();customerDrilldownClick(e);}
});

$('routeHeaderControls').addEventListener('change', rpHandleChange);
$('content').addEventListener('change', e => { if (!e.target.matches('[data-rp="search"]')) rpHandleChange(e); });
$('content').addEventListener('input', e => { if (e.target.matches('[data-rp="search"]')) rpHandleChange(e); });
function rpClick(event) {
  const route=event.target.closest('[data-rp-route]'), alert=event.target.closest('[data-rp-alert]'), page=event.target.closest('[data-rp-page]'), reset=event.target.closest('[data-rp-reset]');
  if(!route&&!alert&&!page&&!reset)return;
  const f=rpFilters();
  if(reset){f[reset.dataset.rpReset]='all';f.page=1;f.alert='all';render();return;}
  if(route){f.route=route.dataset.rpRoute;f.page=1;f.alert='all';}
  if(alert){f.alert=alert.dataset.rpAlert;f.page=1;}
  if(page)f.page=Number(page.dataset.rpPage);
  render();
}
$('content').addEventListener('click', rpClick);
$('content').addEventListener('click', e => {
  const page = e.target.closest('[data-page]');
  const preset = e.target.closest('[data-cm-preset]');
  if (page) {
    document.querySelectorAll('.nav-item').forEach(x => x.classList.remove('active'));
    document.querySelector(`.nav-item[data-page="${page.dataset.page}"]`)?.classList.add('active');
    state.page = page.dataset.page;
    render();
    return;
  }
  if (preset) {
    const presets = {base:{revenueGrowth:0,costReduction:0},optimistic:{revenueGrowth:5,costReduction:3},stress:{revenueGrowth:-5,costReduction:0}};
    const values = presets[preset.dataset.cmPreset];
    if (!values) return;
    document.querySelectorAll('[data-cm-scenario]').forEach(el => { el.value = values[el.dataset.cmScenario]; });
    updateCMScenario();
  }
});
$('content').addEventListener('keydown', e => { if(e.target.matches('[data-rp-route]') && (e.key==='Enter'||e.key===' ')){e.preventDefault();rpClick(e);} });
$('nav').addEventListener('click', e => {
  const b = e.target.closest('[data-page]');
  if (!b) return;
  document.querySelectorAll('.nav-item').forEach(x => x.classList.remove('active'));
  b.classList.add('active');
  state.page = b.dataset.page;
  render();
});
$('yearFilter').addEventListener('change', e => { state.year = Number(e.target.value); state.serviceYear = null; state.routePortfolio = null; render(); });
$('reloadDataBtn').addEventListener('click', processData);
$('dataSourcesBtn').addEventListener('click', () => {
  document.querySelectorAll('.nav-item').forEach(x => x.classList.remove('active'));
  state.page = 'sources';
  render();
});
$('content').addEventListener('input', e => {
  const el = e.target.closest('[data-route-control]');
  if (!el) return;
  const key = el.dataset.routeControl;
  state.routeFilters[key] = el.type === 'search' ? el.value : el.value;
  if (state.page === 'trip_route') render();
});
$('content').addEventListener('change', e => {
  const el = e.target.closest('[data-route-control]');
  if (!el) return;
  const key = el.dataset.routeControl;
  state.routeFilters[key] = key === 'limit' ? Number(el.value) : el.value;
  if (key === 'view') state.routeFilters.status = 'all';
  if (state.page === 'trip_route') render();
});
$('content').addEventListener('input', e => {
  const el = e.target.closest('[data-matrix-control]');
  if (!el) return;
  const key = el.dataset.matrixControl;
  state.matrixFilters[key] = el.value;
  if (state.page === 'trip_route' && el.type === 'search') render();
});
$('content').addEventListener('change', e => {
  const el = e.target.closest('[data-matrix-control]');
  if (!el) return;
  const key = el.dataset.matrixControl;
  state.matrixFilters[key] = el.value;
  if (state.page === 'trip_route') render();
});
$('content').addEventListener('input', e => {
  const el = e.target.closest('[data-fleet-control]');
  if (!el) return;
  const key = el.dataset.fleetControl;
  state.fleetFilters[key] = el.value;
  if (state.page === 'fleet_util' && el.type === 'search') render();
});
$('content').addEventListener('change', e => {
  const el = e.target.closest('[data-fleet-control]');
  if (!el) return;
  const key = el.dataset.fleetControl;
  state.fleetFilters[key] = key === 'limit' ? Number(el.value) : el.value;
  if (state.page === 'fleet_util') render();
});
$('content').addEventListener('input', e => {
  const el = e.target.closest('[data-service-control]');
  if (!el) return;
  const key = el.dataset.serviceControl;
  state.serviceFilters[key] = el.value;
  if (state.page === 'fleet_util' && el.type === 'search') render();
});
$('content').addEventListener('change', e => {
  const el = e.target.closest('[data-service-control]');
  if (!el) return;
  const key = el.dataset.serviceControl;
  state.serviceFilters[key] = key === 'limit' ? Number(el.value) : el.value;
  if (state.page === 'fleet_util') render();
});
$('content').addEventListener('input', e => {
  const el = e.target.closest('[data-customer-control]');
  if (!el) return;
  state.customerFilters[el.dataset.customerControl] = el.value;
  if (el.dataset.customerControl === 'detailSearch') state.customerFilters.detailPage = 1;
  if (state.page === 'customer_credit') render();
});
$('content').addEventListener('change', e => {
  const el = e.target.closest('[data-customer-control]');
  if (!el) return;
  const key = el.dataset.customerControl;
  state.customerFilters[key] = ['queueLimit', 'detailLimit'].includes(key) ? Number(el.value) : el.value;
  if (key === 'detailLimit') state.customerFilters.detailPage = 1;
  if (state.page === 'customer_credit') render();
});
$('content').addEventListener('click', e => {
  const button = e.target.closest('[data-customer-page]');
  if (!button || button.disabled) return;
  state.customerFilters.detailPage += button.dataset.customerPage === 'next' ? 1 : -1;
  render();
});
$('content').addEventListener('input', e => {
  const el = e.target.closest('[data-scenario]');
  if (!el) return;
  if (el.type !== 'checkbox') syncScenarioPair(el.dataset.scenario, el);
  updateScenario();
});
$('content').addEventListener('change', e => {
  if (e.target.closest('[data-scenario]')) updateScenario();
});

// Upload modal
(() => {
  let selected = [], backendReady = false;
  const modal = $('uploadModal'), openBtn = $('uploadDataBtn'), closeBtn = $('closeUploadModal'), cancelBtn = $('cancelUploadBtn'), drop = $('dropZone'), input = $('dataFileInput'), sel = $('selectedFiles'), server = $('serverFiles'), count = $('selectedCount'), refresh = $('refreshFilesBtn'), upload = $('uploadAndProcessBtn'), notice = $('backendNotice'), pw = $('uploadProgressWrap'), pt = $('uploadProgressText'), pp = $('uploadProgressPct'), pb = $('uploadProgressBar'), res = $('processResult'), typeSelect = $('dataTypeSelect');

  function badge(name) {
    const ext = name.split('.').pop()?.toUpperCase() || 'FILE';
    return ext.slice(0, 4);
  }
  function filesView() {
    count.textContent = `${selected.length} ไฟล์`;
    sel.className = 'file-list' + (selected.length ? '' : ' empty-state');
    sel.innerHTML = selected.length ? selected.map((f, i) => `<div class="file-row"><div class="file-badge">${badge(f.name)}</div><div class="file-meta"><b>${esc(f.name)}</b><span>${(f.size / 1024 / 1024).toFixed(1)} MB</span></div><button class="file-remove" data-i="${i}">×</button></div>`).join('') : 'ยังไม่ได้เลือกไฟล์';
    upload.disabled = !selected.length || !backendReady;
  }
  async function refreshFiles() {
    try {
      const r = await fetch('/api/files', { cache: 'no-store' });
      if (!r.ok) throw Error();
      const d = await r.json();
      backendReady = true;
      notice.classList.add('hidden');
      server.className = 'file-list' + (d.files?.length ? '' : ' empty-state');
      server.innerHTML = d.files?.length ? d.files.map(f => `<div class="file-row"><div class="file-badge">${badge(f.name)}</div><div class="file-meta"><b>${esc(f.name)}</b><span>${esc(categoryLabel[f.category] || f.category || 'Other')} · ${f.size_human}</span></div></div>`).join('') : 'ยังไม่มีไฟล์';
    } catch (e) {
      backendReady = false;
      notice.classList.remove('hidden');
      notice.classList.add('error');
      notice.textContent = 'ต้องเปิดเว็บด้วย python server.py';
      server.innerHTML = 'Local server ไม่พร้อม';
    }
    filesView();
  }
  function add(fs) {
    const okExt = ['.xlsx', '.xls', '.csv', '.zip'];
    for (const f of fs) {
      const lower = f.name.toLowerCase();
      if (!okExt.some(x => lower.endsWith(x))) continue;
      if (!selected.some(x => x.name === f.name && x.size === f.size)) selected.push(f);
    }
    filesView();
  }
  openBtn.onclick = () => { modal.classList.remove('hidden'); refreshFiles(); };
  closeBtn.onclick = cancelBtn.onclick = () => modal.classList.add('hidden');
  refresh.onclick = refreshFiles;
  input.onchange = e => { add(e.target.files); e.target.value = ''; };
  sel.onclick = e => { const b = e.target.closest('[data-i]'); if (b) { selected.splice(Number(b.dataset.i), 1); filesView(); } };
  ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('dragover'); }));
  ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('dragover'); }));
  drop.addEventListener('drop', e => add(e.dataTransfer.files));

  async function one(f) {
    const r = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream', 'X-Filename': encodeURIComponent(f.name), 'X-Data-Type': typeSelect.value },
      body: f
    });
    const d = await r.json();
    if (!r.ok) throw Error(d.error || 'upload error');
  }

  upload.onclick = async () => {
    upload.disabled = true;
    pw.classList.remove('hidden');
    res.classList.add('hidden');
    try {
      for (let i = 0; i < selected.length; i++) {
        pt.textContent = `กำลังอัปโหลด ${selected[i].name}`;
        const q = Math.round(i / selected.length * 75);
        pp.textContent = q + '%';
        pb.style.width = q + '%';
        await one(selected[i]);
      }
      pt.textContent = 'กำลังประมวลผลข้อมูล...';
      pp.textContent = '85%';
      pb.style.width = '85%';
      const r = await fetch('/api/process', { method: 'POST' });
      const d = await r.json();
      if (!r.ok) throw Error(d.error || 'process error');
      pp.textContent = '100%';
      pb.style.width = '100%';
      pt.textContent = 'เสร็จแล้ว';
      res.classList.remove('hidden');
      res.innerHTML = '<b>✓ อัปเดต Data Catalog และ Dashboard Cache แล้ว</b>';
      selected = [];
      filesView();
      await refreshFiles();
      await loadData();
    } catch (e) {
      res.classList.remove('hidden');
      res.classList.add('error');
      res.innerHTML = `<b>ไม่สำเร็จ</b><br>${esc(e.message)}`;
    } finally {
      filesView();
    }
  };
})();

loadData();
