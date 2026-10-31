/* 肺腺癌治療選擇：基因檢測流程與時間軸的純計算（不碰畫面，方便測試）。
   數字皆為使用者提供，待校對；「最長」「約」。測試見 ../../tests/treatment-choice.test.cjs。 */
(function (root) {
  'use strict';

  /* 健保給付檢查（EGFR、ALK）最長 2 週；NGS 約 3 週；重新切片約 1 週；申請健保藥物約 1–2 週（取最長 2 週畫） */
  var DUR = { h: 2, n: 3, r: 1, apply: 2 };
  var NHI_NGS_COST = '原價扣 20000 點，餘額自費';
  var TIERS = {
    amoy: { name: 'AMOY', genes: '11 組基因', price: '約 3 萬', note: '涵蓋主要肺癌基因，自費裡價格最低。' },
    lung: { name: 'ACT Lung', genes: '13 組基因', price: '約 5 萬', note: '肺癌專用的基因檢測。' },
    drug: { name: 'ACT Drug', genes: '約 40 組基因', price: '約 8 萬', note: '多看一些較少見的基因。' },
    onco: { name: 'ACTOnco', genes: '約 440 組基因', price: '約 13 萬', note: '看的基因最多，也可提供預後參考。' }
  };

  /* 狀態：stages 為已送的步驟；rh = 健保結果、rn = NGS 結果（null|'pos'|'neg'）；treat = 沒突變後選擇直接接受治療。
     stage = {type:'h'|'n'|'hn'|'r', payer:'self'|'nhi'}。
     規則（使用者 2026-10-31）：先送自費 NGS 時，結果出來後不再送健保（NGS 比健保準）。 */
  function layout(stages, rh, rn) {
    var t = 0, bars = [], healthEnd = null, ngsEnd = null, ngsLane = 0;
    stages.forEach(function (st) {
      var s = t, d = 0;
      if (st.type === 'r') {
        bars.push({ k: 'r', lane: 0, s: s, e: s + DUR.r });
        d = DUR.r;
      }
      if (st.type === 'h' || st.type === 'hn') {
        bars.push({ k: 'h', lane: 0, s: s, e: s + DUR.h });
        healthEnd = s + DUR.h;
        d = Math.max(d, DUR.h);
      }
      if (st.type === 'n' || st.type === 'hn') {
        bars.push({ k: st.payer === 'nhi' ? 'g' : 's', lane: st.type === 'hn' ? 1 : 0, s: s, e: s + DUR.n, ngs: true, payer: st.payer });
        ngsEnd = s + DUR.n;
        ngsLane = st.type === 'hn' ? 1 : 0;
        d = Math.max(d, DUR.n);
      }
      t += d;
    });
    var target = (rh === 'pos' && healthEnd !== null) || (rn === 'pos' && ngsEnd !== null);
    var decision = null, start = null;
    if (stages.length) {
      decision = (rh === 'pos' && healthEnd !== null) ? healthEnd : (rn === 'pos' && ngsEnd !== null) ? ngsEnd : t;
      if (target) {
        /* 有突變才出現：申請健保藥物 */
        /* 申請健保藥物接在「找到突變的那個檢查」之後：健保找到畫在健保那一列，NGS 找到畫在 NGS 那一列 */
        var viaHealth = rh === 'pos' && healthEnd !== null;
        bars.push({ k: 'a', lane: viaHealth ? 0 : ngsLane, s: decision, e: decision + DUR.apply });
        start = decision + DUR.apply;
      }
    }
    var end = bars.reduce(function (m, b) { return Math.max(m, b.e); }, 0);
    return { bars: bars, decision: decision, start: start, end: end, target: target,
      lanes: bars.some(function (b) { return b.lane === 1; }) ? 2 : 1 };
  }

  function summarize(stages, rh, rn, tier, treat) {
    var L = layout(stages, rh, rn);
    var has = function (f) { return stages.some(f); };
    var hasR = has(function (s) { return s.type === 'r'; });
    var hasHN = has(function (s) { return s.type === 'hn'; });
    var hasH = has(function (s) { return s.type === 'h' || s.type === 'hn'; });
    var hasN = has(function (s) { return s.type === 'n' || s.type === 'hn'; });
    var self = has(function (s) { return (s.type === 'n' || s.type === 'hn') && s.payer === 'self'; });
    var nhi = has(function (s) { return s.type === 'n' && s.payer === 'nhi'; });
    var T = TIERS[tier];
    var pros = [], cons = [];
    if (stages.length) {
      if (hasH) pros.push('健保給付檢查不用額外費用，檢查時間短（最長約 2 週）');
      if (self) pros.push('自費 NGS（' + T.name + '）：' + T.genes + '，資訊比健保多');
      if (nhi) pros.push('健保補助約 20000 點');
      if (hasHN) pros.push('同時進行，最快拿到完整結果');

      if (hasH) cons.push('只限兩項（EGFR、ALK）');
      if (rh === 'pos' && self) cons.push('健保已知有突變可開始治療，會有多花錢的感覺');
      else if (self) cons.push('自費' + T.price);
      if (nhi) cons.push('扣掉補助後，還有自費');
      if (!L.target && L.decision >= 5) cons.push('等的時間較久：約 ' + L.decision + ' 週');
      if (hasR) cons.push('需重新切片，多約 1 週，要再接受一次檢查');
      if (hasHN && !L.target && !hasR) cons.push('檢體一次用掉較多，較容易不夠');
    }
    var cost = !stages.length ? '' : self ? T.price : nhi ? NHI_NGS_COST : '不用額外費用';
    var outcome = L.target ? 'target' : (treat || rn === 'neg') ? 'treat' : null;
    return { layout: L, hasR: hasR, hasH: hasH, hasN: hasN, hasHN: hasHN, self: self, nhi: nhi,
      pros: pros, cons: cons, cost: cost, outcome: outcome };
  }

  /* 流程圖節點（階段式一路點下來）。回傳多條橫列，每列是節點陣列。 */
  function flowRows(stages, rh, rn, tier, treat) {
    var S = summarize(stages, rh, rn, tier, treat), T = TIERS[tier];
    var rows = [[{ t: '基因篩檢', cls: 'start' }]];
    if (!stages.length) return rows;
    var first = stages[0].type;
    var main = rows[0];
    main.push({ t: first === 'hn' ? '一次送兩個' : first === 'h' ? '先送健保' : '先送自費 NGS', cls: 'way' });
    var hNode = { t: '健保檢查', s: 'EGFR、ALK', time: '最長 2 週', cls: 'h' };
    var res = function (v, which) { return { t: v === 'pos' ? '有突變' : '沒有突變', cls: v === 'pos' ? 'pos' : 'neg', pair: { which: which, val: v } }; };
    var nNode = function (st) {
      return st.payer === 'nhi'
        ? { t: 'NGS（健保補助）', s: '原價扣 20000 點', time: '約 3 週', cls: 'g' }
        : { t: '自費 NGS', s: T.name + '・' + T.genes + '・' + T.price, time: '約 3 週', cls: 's' };
    };
    stages.forEach(function (st) {
      if (st.type === 'r') main.push({ t: '重新切片', time: '多約 1 週', cls: 'r' });
      else if (st.type === 'h') { main.push(hNode); if (rh) main.push(res(rh, 'rh')); }
      else if (st.type === 'n') { main.push(nNode(st)); if (rn) main.push(res(rn, 'rn')); }
      else if (st.type === 'hn') {
        main.push(hNode); if (rh) main.push(res(rh, 'rh'));
        var row2 = [nNode(st)]; if (rn) row2.push(res(rn, 'rn'));
        rows.push(row2);
      }
    });
    var endNode = S.outcome === 'target'
      ? { t: '對應標靶藥治療', s: '申請健保藥物', time: '約 1–2 週', cls: 'end' }
      : S.outcome === 'treat' ? { t: '接受治療', s: '化療、免疫治療等', cls: 'end' } : null;
    if (endNode) rows[rows.length - 1].push(endNode);
    return rows;
  }

  /* 三條比較（假設都沒有找到突變，最長的那種情況）：送健保／先健保後送 NGS／NGS（或一起送）。
     使用者 2026-10-31 的順序與分法。 */
  function compareRows() {
    return [
      { key: 'h', label: '送健保', total: DUR.h, bars: [{ k: 'h', lane: 0, s: 0, e: DUR.h, t: '健保 ' + DUR.h + ' 週' }], lanes: 1, note: '' },
      { key: 'seq', label: '先健保，若沒有驗到，再送 NGS', total: DUR.h + DUR.n, lanes: 1, note: '',
        bars: [{ k: 'h', lane: 0, s: 0, e: DUR.h, t: '健保 ' + DUR.h + ' 週' }, { k: 'g', lane: 0, s: DUR.h, e: DUR.h + DUR.n, t: 'NGS ' + DUR.n + ' 週' }] },
      /* 一起送：同時兩條（健保、NGS），健保先有結果 */
      { key: 'n', label: '健保、NGS 一起送', total: DUR.n, lanes: 2, note: '健保第 ' + DUR.h + ' 週先有結果',
        bars: [{ k: 'h', lane: 0, s: 0, e: DUR.h, t: '健保 ' + DUR.h + ' 週' }, { k: 's', lane: 1, s: 0, e: DUR.n, t: 'NGS ' + DUR.n + ' 週' }] }
    ];
  }

  /* 選到某一條後的起始狀態（之後病人仍可在流程圖裡繼續點）。nOnly＝只送 NGS（不一起送健保）。 */
  function preset(key, nOnly) {
    if (key === 'h') return { stages: [{ type: 'h', payer: 'self' }], rh: null };
    if (key === 'seq') return { stages: [{ type: 'h', payer: 'self' }, { type: 'n', payer: 'nhi' }], rh: 'neg' };
    return { stages: [{ type: nOnly ? 'n' : 'hn', payer: 'self' }], rh: null };
  }

  /* 三選二：要快／要省錢／要資訊多 → 對應哪幾條。三個都要＝空集合。 */
  function vennMatch(sel) {
    var f = !!sel.fast, c = !!sel.cheap, i = !!sel.info, n = (f ? 1 : 0) + (c ? 1 : 0) + (i ? 1 : 0);
    if (n === 0) return { region: '', rows: [], text: '' };
    if (n === 3) return { region: 'center', rows: [], text: '三個都要：沒有符合的送法' };
    if (n === 2) {
      if (f && c) return { region: 'fastcheap', rows: ['h'], text: '快又省錢：送健保（只查 EGFR、ALK 兩項）' };
      if (f && i) return { region: 'fastinfo', rows: ['n'], text: '快又資訊多：健保、NGS 一起送（要自費）' };
      return { region: 'infocheap', rows: ['seq'], text: '資訊多又省錢：先健保，沒找到再做 NGS（要等）' };
    }
    if (f) return { region: 'fast', rows: ['h', 'n'], text: '要快：送健保，或健保、NGS 一起送' };
    if (c) return { region: 'cheap', rows: ['h', 'seq'], text: '要省錢：送健保，或先健保，若沒有驗到再送 NGS' };
    return { region: 'info', rows: ['n', 'seq'], text: '要資訊多：健保、NGS 一起送，或先健保，若沒有驗到再送 NGS' };
  }

  var api = { layout: layout, summarize: summarize, flowRows: flowRows, compareRows: compareRows, preset: preset, vennMatch: vennMatch,
    TIERS: TIERS, DUR: DUR, NHI_NGS_COST: NHI_NGS_COST };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TcLogic = api;
})(typeof window !== 'undefined' ? window : this);
