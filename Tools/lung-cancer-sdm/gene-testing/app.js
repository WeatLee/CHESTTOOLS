/* 基因檢測頁：逐步選擇送檢方案，長條圖往後接。
   所有數字為使用者提供，待校對；週數是「約」或「最長」。不記錄、不傳送任何選擇（ADR 0002）。
   窄螢幕（手機）用由上往下的直式時間軸，寬螢幕用橫式。 */
(function (root) {
  'use strict';

  /* 健保三基因最長 2 週；自費與健保 NGS 約 3 週；重新切片約 1 週；之後申請健保藥物約 2 週 */
  var DUR = { h: 2, n: 3, r: 1, apply: 2 };
  var TIERS = {
    amoy: { name: 'AMOY', genes: '11 組基因', price: '約 3 萬', note: '涵蓋主要肺癌基因，自費裡價格最低。' },
    lung: { name: 'ACT Lung', genes: '13 組基因', price: '約 5 萬', note: '肺癌專用的基因檢測。' },
    drug: { name: 'ACT Drug', genes: '約 40 組基因', price: '約 8 萬', note: '多看一些較少見的基因。' },
    onco: { name: 'ACTOnco', genes: '約 440 組基因', price: '約 13 萬', note: '看的基因最多，也可提供預後參考。' }
  };
  var MUTS = [
    ['EGFR', 60, true, '約 60%'], ['ALK', 3.6, true, '約 3.6%'], ['ROS-1', 1, true, '約 1%'],
    ['KRAS G12C', 4.5, false, '4–5%'], ['MET', 3, false, '約 3%'], ['RET', 1.5, false, '1–2%']
  ];

  /* ---- 純計算：給一串階段，算出每段位置與決定治療的時間 ---- */
  /* stage = {type:'h'|'n'|'hn'|'r', payer:'self'|'nhi'}；result = null|'pos'|'neg' */
  function layout(stages, result) {
    var t = 0, bars = [], healthEnd = null;
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
        d = Math.max(d, DUR.n);
      }
      t += d;
    });
    var decision = null, start = null;
    if (stages.length) {
      decision = (result === 'pos' && healthEnd !== null) ? healthEnd : t;
      bars.push({ k: 'a', lane: 0, s: decision, e: decision + DUR.apply });
      start = decision + DUR.apply;
    }
    var end = bars.reduce(function (m, b) { return Math.max(m, b.e); }, 0);
    return {
      bars: bars, decision: decision, start: start, end: end,
      lanes: bars.some(function (b) { return b.lane === 1; }) ? 2 : 1
    };
  }

  function summarize(stages, result, tier) {
    var L = layout(stages, result);
    var hasR = stages.some(function (s) { return s.type === 'r'; });
    var hasHN = stages.some(function (s) { return s.type === 'hn'; });
    var self = stages.some(function (s) { return (s.type === 'n' || s.type === 'hn') && s.payer === 'self'; });
    var nhi = stages.some(function (s) { return s.type === 'n' && s.payer === 'nhi'; });
    var hasH = stages.some(function (s) { return s.type === 'h' || s.type === 'hn'; });
    var hasN = stages.some(function (s) { return s.type === 'n' || s.type === 'hn'; });
    var pos = result === 'pos';
    var pros = [], cons = [];
    if (stages.length) {
      if (hasH) pros.push('健保給付，三個常見基因最長約 2 週有結果');
      if (nhi) pros.push('基因檢測由健保給付（約 20000 點）');
      if (self) pros.push(TIERS[tier].name + '：' + TIERS[tier].genes + '，查得比健保多');
      if (hasHN) pros.push('同時進行，最快拿到完整結果');

      if (pos && self) cons.push('健保已知有突變可開始治療，會有多花錢的感覺');
      else if (self) cons.push('自費' + TIERS[tier].price);
      if (!pos && L.decision >= 5) cons.push('等的時間較久：約 ' + L.decision + ' 週');
      if (hasR) cons.push('需重新切片，多約 1 週，要再接受一次檢查');
      if (hasH && !hasN && result === 'neg') cons.push('只查了三個常見基因，沒找到就沒有更多資訊');
      if (hasHN && !pos && !hasR) cons.push('檢體一次用掉較多，較容易不夠');
    }
    var cost = !stages.length ? '' : self ? TIERS[tier].price : '健保給付';
    return { layout: L, hasR: hasR, self: self, nhi: nhi, pos: pos, pros: pros, cons: cons, cost: cost };
  }

  var api = { layout: layout, summarize: summarize, TIERS: TIERS, DUR: DUR };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }

  /* ---- 畫面 ---- */
  var $ = function (id) { return document.getElementById(id); };
  var stages = [], result = null, tier = 'amoy', hist = [];
  var cfg = root.SDM_CONFIG || {};
  if (cfg.draft) $('draft').hidden = false;
  var mq = root.matchMedia('(max-width: 700px)');

  function dateOf(w) { var x = new Date(); x.setDate(x.getDate() + w * 7); return (x.getMonth() + 1) + '/' + x.getDate(); }
  function snap() { hist.push(JSON.stringify({ s: stages, r: result })); }
  function addStage(type) {
    snap();
    var hasH = stages.some(function (s) { return s.type === 'h' || s.type === 'hn'; });
    stages.push({ type: type, payer: (type === 'n' && hasH && result === 'neg') ? 'nhi' : 'self' });
    render();
  }
  function setResult(v) { snap(); result = v; render(); }
  function btn(label, fn, main) {
    var b = document.createElement('button');
    b.textContent = label; if (main) b.className = 'primary'; b.onclick = fn; return b;
  }
  function barLabel(b) {
    if (b.k === 'h') return '健保 最長 2 週';
    if (b.k === 'r') return '重新切片';
    if (b.k === 'a') return '申請健保藥物 約 2 週';
    return b.payer === 'nhi' ? '基因檢測 約 3 週' : '自費 ' + TIERS[tier].name + ' 約 3 週';
  }

  function mutBars() {
    var h = '';
    MUTS.forEach(function (m) {
      h += '<div class="row"><span>' + m[0] + '</span><div class="track"><div class="fill' + (m[2] ? ' nhi' : '') +
        '" style="width:' + Math.min(100, m[1]) + '%"></div></div><span>' + m[3] + '</span></div>';
    });
    $('mutbars').innerHTML = h;
  }

  /* 橫式：週數在上方。直式：週數在左側由上往下。 */
  function drawChart(L) {
    var vertical = mq.matches, weeks = Math.max(4, Math.ceil(L.end)), i, ax = '', grid = '', body = '';
    var c = $('chart'), axis = $('axis');
    c.className = 'chart' + (vertical ? ' v' : '');
    axis.className = 'axis' + (vertical ? ' hidden' : '');
    if (vertical) {
      var PX = 64;
      c.style.height = (weeks * PX + 44) + 'px';
      for (i = 0; i <= weeks; i++) {
        grid += '<div class="gridv" style="top:' + (i * PX) + 'px"></div>';
        ax += '<div class="tickv" style="top:' + (i * PX - 2) + 'px">' + (i === 0 ? '今天' : '第' + i + '週') + '<br>' + dateOf(i) + '</div>';
      }
      L.bars.forEach(function (b) {
        var w = L.lanes === 2 ? 'calc(50% - 4px)' : '100%';
        body += '<div class="bar v ' + b.k + '" style="top:' + (b.s * PX + 2) + 'px;height:' + ((b.e - b.s) * PX - 4) + 'px;left:' +
          (b.lane === 1 ? '50%' : '0') + ';width:' + w + '">' + barLabel(b) + '</div>';
      });
      if (L.decision !== null) body += '<div class="decv" style="top:' + (L.decision * PX) + 'px"><span>決定治療</span></div>';
      c.innerHTML = '<div class="gutter">' + ax + '</div><div class="lanes">' + grid + body + '</div>';
      return;
    }
    var MAXW = 8;
    function pc(w) { return (w / MAXW * 100) + '%'; }
    for (i = 0; i <= MAXW; i++) {
      var tx = i === 0 ? '0' : i === MAXW ? '-100%' : '-50%';
      ax += '<div class="tick" style="left:' + pc(i) + ';transform:translateX(' + tx + ')">' + (i === 0 ? '今天' : '第' + i + '週') + '<br>' + dateOf(i) + '</div>';
      grid += '<div class="grid" style="left:' + pc(i) + '"></div>';
    }
    axis.innerHTML = ax;
    L.bars.forEach(function (b) {
      body += '<div class="bar ' + b.k + '" style="top:' + (6 + b.lane * 46) + 'px;left:' + pc(b.s) + ';width:calc(' + pc(b.e - b.s) + ' - 2px)">' + barLabel(b) + '</div>';
    });
    if (L.decision !== null) body += '<div class="decline" style="left:' + pc(L.decision) + '"></div>';
    c.style.height = (L.lanes * 46 + 10) + 'px';
    c.innerHTML = grid + body;
  }

  function render() {
    var S = summarize(stages, result, tier), L = S.layout;
    var hasH = stages.some(function (s) { return s.type === 'h' || s.type === 'hn'; });
    var hasN = stages.some(function (s) { return s.type === 'n' || s.type === 'hn'; });
    var last = stages[stages.length - 1];

    drawChart(L);

    $('end').innerHTML = !stages.length ? '請先選一個方案'
      : (S.pos ? '找到突變，最長約 <b>' + L.decision + ' 週</b>（' + dateOf(L.decision) + '）可以決定治療'
               : '最長約 <b>' + L.decision + ' 週</b>（' + dateOf(L.decision) + '）拿到已送的結果') +
        '，再加約 2 週申請健保藥物，約 <b>' + L.start + ' 週</b>後可以開始用藥';

    /* 問題與按鈕 */
    var btns = $('btns'), ask = $('ask');
    btns.innerHTML = '';
    if (!stages.length) {
      ask.textContent = '第一步，您想怎麼送？';
      btns.appendChild(btn('送健保', function () { addStage('h'); }, 1));
      btns.appendChild(btn('送自費', function () { addStage('n'); }, 1));
      btns.appendChild(btn('兩個一起送', function () { addStage('hn'); }, 1));
    } else if (hasH && result === null) {
      ask.textContent = '假設健保的結果出來了，有找到突變嗎？';
      btns.appendChild(btn('找到突變', function () { setResult('pos'); }, 1));
      btns.appendChild(btn('沒找到', function () { setResult('neg'); }, 1));
    } else if (S.pos) {
      ask.textContent = '找到突變，就可以開始討論治療了';
    } else if (hasH && hasN) {
      ask.textContent = '兩種檢查都送完了';
    } else if (last.type === 'r') {
      var nm = hasH ? '基因檢測' : '健保三基因', ty = hasH ? 'n' : 'h';
      ask.textContent = '已重新切片，接著要送' + nm + '嗎？';
      btns.appendChild(btn('送' + nm, function () { addStage(ty); }, 1));
    } else {
      var nm2 = hasH ? '基因檢測' : '健保三基因', ty2 = hasH ? 'n' : 'h';
      ask.textContent = hasH ? '沒找到，還要再送基因檢測嗎？' : '還要再送健保三基因嗎？';
      btns.appendChild(btn('直接送' + nm2, function () { addStage(ty2); }, 1));
      btns.appendChild(btn('檢體不夠，需重新切片', function () { addStage('r'); }));
    }

    /* 自費四檔 */
    $('tierwrap').hidden = !S.self;
    if (S.self) {
      var t = $('tiers'); t.innerHTML = '';
      Object.keys(TIERS).forEach(function (k) {
        var b = btn(TIERS[k].name, function () { tier = k; render(); });
        if (k === tier) b.className = 'on';
        t.appendChild(b);
      });
      $('tiernote').textContent = TIERS[tier].genes + '，' + TIERS[tier].price + '。' + TIERS[tier].note;
    }

    /* 三個數字 */
    var m = '';
    if (stages.length) {
      m += '<div class="metric"><div class="lab">等待時間</div><div class="val">約 ' + L.start + ' 週</div><div class="sub">結果 ' + L.decision + ' 週，加申請藥物 2 週</div></div>';
      m += '<div class="metric"><div class="lab">自費</div><div class="val">' + S.cost + '</div>' +
        (S.nhi && !S.self ? '<div class="sub">基因檢測由健保給付</div>' : '') + '</div>';
      if (S.hasR) m += '<div class="metric bad"><div class="lab">切片</div><div class="val">需重新切片</div><div class="sub">多約 1 週</div></div>';
    }
    $('metrics').innerHTML = m;

    $('pros').innerHTML = S.pros.map(function (x) { return '<div class="li">' + x + '</div>'; }).join('');
    $('cons').innerHTML = S.cons.map(function (x) { return '<div class="li">' + x + '</div>'; }).join('');
  }

  $('undo').onclick = function () { if (hist.length) { var o = JSON.parse(hist.pop()); stages = o.s; result = o.r; render(); } };
  $('reset').onclick = function () { stages = []; result = null; hist = []; render(); };
  if (mq.addEventListener) mq.addEventListener('change', render);
  mutBars();
  render();
})(typeof window !== 'undefined' ? window : this);
