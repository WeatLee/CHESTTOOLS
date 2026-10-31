/* 肺腺癌治療選擇（畫面）：三步切換；第一步流程圖；第二步三條時間軸比較＋展開細節＋三選二圖；第三步結果分流。
   計算在 logic.js。不記錄、不傳送任何選擇（ADR 0002）。 */
(function (root) {
  'use strict';
  var L = root.TcLogic, TIERS = L.TIERS;
  var $ = function (id) { return document.getElementById(id); };
  var all = function (sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); };
  var cfg = root.SDM_CONFIG || {};
  if (cfg.draft) $('draft').hidden = false;

  var MUTS = [
    ['EGFR', 60, true, '約 60%'], ['ALK', 3.6, true, '約 3.6%'], ['ROS-1', 1, false, '約 1%'],
    ['KRAS G12C', 4.5, false, '4–5%'], ['MET', 3, false, '約 3%'], ['RET', 1.5, false, '1–2%']
  ];

  /* ---------- 步驟切換 ---------- */
  var step = 1;
  function showStep(n) {
    step = n;
    [1, 2, 3].forEach(function (i) { $('s' + i).hidden = i !== n; });
    all('#stepbar button').forEach(function (b) {
      var on = +b.getAttribute('data-step') === n;
      b.className = on ? 'on' : '';
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    $('prev').hidden = n === 1;
    $('next').hidden = n === 3;
    if (n === 2) render();
    root.scrollTo(0, 0);
  }
  all('#stepbar button').forEach(function (b) { b.onclick = function () { showStep(+b.getAttribute('data-step')); }; });
  $('prev').onclick = function () { showStep(step - 1); };
  $('next').onclick = function () { showStep(step + 1); };
  $('backto1').onclick = function () { showStep(1); };

  /* ---------- 第一步：流程圖，點治療方格看說明 ---------- */
  /* 先選「有突變／沒有突變」，該分支後面的治療方格才亮起；沒選的分支變暗 */
  /* 路線圖（電腦橫式、手機直式兩張 SVG，站點同一組資料屬性，一起更新） */
  var br = null, txSel = null;
  function drawTx() {
    all('.metro .seg[data-seg]').forEach(function (s) { setCls(s, 'live', br !== null && s.getAttribute('data-seg') === br); });
    all('.metro .st.br').forEach(function (b) { setCls(b, 'on', br === b.getAttribute('data-br')); });
    all('.metro .st.tx').forEach(function (b) {
      var lit = br !== null && b.getAttribute('data-br') === br;
      setCls(b, 'lit', lit);
      setCls(b, 'dim', !lit);
      setCls(b, 'on', lit && txSel === b.getAttribute('data-tx'));
    });
    ['target', 'immune', 'both', 'chemo'].forEach(function (x) {
      var st = all('.metro .st.tx[data-tx="' + x + '"]')[0];
      $('tx-' + x).hidden = !(txSel === x && st.getAttribute('data-br') === br);
    });
    $('tx-hint').hidden = txSel !== null && !$('tx-' + txSel).hidden;
    $('tx-hint').textContent = br === null ? '請先點路線上的「有突變」或「沒有突變」。' : '請點亮起來的治療站。';
  }
  function onStation(el, fn) {
    el.onclick = fn;
    el.onkeydown = function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } };
  }
  all('.metro .st.br').forEach(function (b) {
    onStation(b, function () { br = b.getAttribute('data-br'); txSel = null; drawTx(); });
  });
  all('.metro .st.tx').forEach(function (b) {
    onStation(b, function () {
      br = b.getAttribute('data-br');           /* 直接點治療站，也會自動選到它的分支 */
      txSel = b.getAttribute('data-tx');
      drawTx();
    });
  });
  drawTx();

  /* ---------- 第三步：結果分流 ---------- */
  function pick(containerId, attr, panelPrefix, keys) {
    var box = $(containerId);
    all('#' + containerId + ' button').forEach(function (b) {
      b.onclick = function () {
        var v = b.getAttribute(attr);
        keys.forEach(function (k) { $(panelPrefix + k).hidden = k !== v; });
        all('#' + containerId + ' button').forEach(function (x) { x.className = x === b ? 'on' : ''; });
      };
    });
  }
  pick('resultpick', 'data-r', 'r-', ['pos', 'neg', 'wait']);
  pick('pdl1pick', 'data-p', 'p-', ['yes', 'no']);

  /* ---------- 第二步：三條時間軸 ---------- */
  var sel = 'all', nOnly = false;
  var stages = [], rh = null, rn = null, treat = false, tier = 'amoy', hist = [];

  function dateOf(w) { var x = new Date(); x.setDate(x.getDate() + w * 7); return (x.getMonth() + 1) + '/' + x.getDate(); }
  function btn(label, fn, main) {
    var b = document.createElement('button');
    b.textContent = label; if (main) b.className = 'primary'; b.onclick = fn; return b;
  }

  /* 三條共用同一條週數軸，手機也不用左右滑 */
  function drawCompare() {
    var rows = L.compareRows(), W = 6, i, ax = '', h = '';
    for (i = 0; i <= W; i++) {
      ax += '<div class="ctick ' + (i === 0 ? 'l' : i === W ? 'r' : 'c') + '" style="left:' + (i / W * 100) + '%">' +
        (i === 0 ? '今天' : i + '週') + '<br>' + dateOf(i) + '</div>';
    }
    h += '<div class="cmpax">' + ax + '</div>';
    rows.forEach(function (r) {
      var cls = 'crow' + (sel === r.key ? ' on' : '') + (sel !== 'all' && sel !== r.key ? ' dim' : '');
      h += '<button class="' + cls + '" data-key="' + r.key + '" aria-pressed="' + (sel === r.key) + '">' +
        '<div class="clab"><b>' + r.label + '</b><span class="ctot">最長約 ' + r.total + ' 週</span></div><div class="ctrack" style="height:' + (r.lanes * 46 + 8) + 'px">';
      for (i = 0; i <= W; i++) h += '<i class="cg" style="left:' + (i / W * 100) + '%"></i>';
      r.bars.forEach(function (b) {
        h += '<div class="cbar ' + b.k + '" style="top:' + (6 + b.lane * 46) + 'px;left:' + (b.s / W * 100) + '%;width:calc(' + ((b.e - b.s) / W * 100) + '% - 3px)">' + b.t + '</div>';
      });
      h += '</div>' + (r.note ? '<div class="cnote">' + r.note + '</div>' : '') + '</button>';
    });
    $('cmp3').innerHTML = h;
    all('#cmp3 .crow').forEach(function (b) { b.onclick = function () { selectRow(b.getAttribute('data-key')); }; });
  }

  function applyPreset() {
    var p = L.preset(sel, nOnly);
    stages = p.stages; rh = p.rh; rn = null; treat = false; hist = [];
  }
  function selectRow(key, force) {
    if (!force && sel === key) { sel = 'all'; render(); return; }
    sel = key; nOnly = false; applyPreset(); render();
  }
  $('nboth').onclick = function () { nOnly = false; applyPreset(); render(); };
  $('nonly').onclick = function () { nOnly = true; applyPreset(); render(); };

  /* ---------- 流程圖與細部時間軸 ---------- */
  function snap() { hist.push(JSON.stringify({ s: stages, rh: rh, rn: rn, treat: treat })); }
  function addStage(type) {
    snap();
    var hasH = stages.some(function (s) { return s.type === 'h' || s.type === 'hn'; });
    stages.push({ type: type, payer: (type === 'n' && hasH && rh === 'neg') ? 'nhi' : 'self' });
    render();
  }
  /* 「一次送兩個」：兩個檢查匯到同一個結果。有突變預設是健保檢查先找到（最早），也可改成 NGS 找到的 */
  function setComb(v) {
    snap();
    if (v === 'pos') { rh = 'pos'; rn = null; } else { rh = 'neg'; rn = 'neg'; }
    treat = false; render();
  }
  function setFound(k) {
    snap();
    if (k === 'h') { rh = 'pos'; rn = null; } else { rh = 'neg'; rn = 'pos'; }
    treat = false; render();
  }
  function setRh(v) {
    snap();
    if (v === 'pos') {
      var i = -1;
      stages.forEach(function (s, idx) { if (i < 0 && (s.type === 'h' || s.type === 'hn')) i = idx; });
      if (i >= 0) stages = stages.slice(0, i + 1);
      rn = null; treat = false;
    }
    rh = v; render();
  }
  function setRn(v) { snap(); rn = v; render(); }
  function setTreat() { snap(); treat = true; render(); }

  /* 「沒有找到突變，接下來要怎麼做？」三個選項可以隨時來回切換（保留前面的健保檢查，改掉後面的步驟） */
  function keepToFirstHealth() {
    var i = -1;
    stages.forEach(function (s, idx) { if (i < 0 && s.type === 'h') i = idx; });
    stages = i >= 0 ? stages.slice(0, i + 1) : stages;
    rn = null;
  }
  function chooseNgs() { snap(); keepToFirstHealth(); stages.push({ type: 'n', payer: 'nhi' }); treat = false; render(); }
  function chooseTreat() { snap(); keepToFirstHealth(); treat = true; render(); }
  function chooseReslice() { snap(); keepToFirstHealth(); stages.push({ type: 'r', payer: 'self' }); stages.push({ type: 'n', payer: 'nhi' }); treat = false; render(); }

  function barLabel(b) {
    if (b.k === 'h') return '健保檢查 最長 2 週';
    if (b.k === 'r') return '重新切片';
    if (b.k === 'a') return '申請健保藥物 約 1–2 週';
    return b.payer === 'nhi' ? 'NGS（健保補助）約 3 週' : '自費 NGS ' + TIERS[tier].name + ' 約 3 週';
  }

  function mutBars() {
    var h = '';
    MUTS.forEach(function (m) {
      h += '<div class="row"><span>' + m[0] + '</span><div class="track"><div class="fill' + (m[2] ? ' nhi' : '') +
        '" style="width:' + Math.min(100, m[1]) + '%"></div></div><span>' + m[3] + '</span></div>';
    });
    $('mutbars').innerHTML = h;
  }

  /* 流程圖：節點隨選擇逐步長出；結果方格可以直接點選換成另一個結果 */
  function boxHtml(cls, t, s, time) {
    return '<div class="fn ' + cls + '"><div class="bx"><b>' + t + '</b>' + (s ? '<span>' + s + '</span>' : '') + '</div>' +
      (time ? '<span class="pill">' + time + '</span>' : '') + '</div>';
  }
  var FORK = '<svg class="fork" viewBox="0 0 40 216" aria-hidden="true"><path d="M0 90 H22 M22 36 V144 M22 36 H30 M22 144 H30" fill="none" stroke="currentColor" stroke-width="3"/><path d="M30 29 L40 36 L30 43 Z M30 137 L40 144 L30 151 Z" fill="currentColor"/></svg>';
  var JOIN = '<svg class="join" viewBox="0 0 40 216" aria-hidden="true"><path d="M0 36 H18 M0 144 H18 M18 36 V144 M18 90 H30" fill="none" stroke="currentColor" stroke-width="3"/><path d="M30 83 L40 90 L30 97 Z" fill="currentColor"/></svg>';

  /* 一次送兩個：健保檢查與 NGS 同時進行，兩條都連到同一個「有突變／沒有突變」，再走到結局 */
  function drawFlowHN(S) {
    var T = TIERS[tier];
    var comb = rh === 'pos' ? 'pos' : (rh === 'neg' && rn === 'pos') ? 'pos' : (rh === 'neg' && rn === 'neg') ? 'neg' : null;
    var found = rh === 'pos' ? 'h' : (rn === 'pos' ? 'n' : null);
    var end = S.outcome === 'target' ? boxHtml('end', '對應標靶藥治療', '申請健保藥物', '約 1–2 週')
      : S.outcome === 'treat' ? boxHtml('end', '接受治療', '免疫治療、化療等', '') : '';
    var pair = '<div class="fn pairbox">' + ['pos', 'neg'].map(function (v) {
      return '<button class="pbtn ' + v + (comb === v ? ' on' : '') + '" data-comb="' + v + '">' + (v === 'pos' ? '有突變' : '沒有突變') + '</button>';
    }).join('') + '</div>';
    var sub = comb === 'pos'
      ? '<div class="fsub"><span>是哪個檢查找到的？</span><button class="pbtn' + (found === 'h' ? ' on pos' : '') + '" data-found="h">健保檢查</button><button class="pbtn' + (found === 'n' ? ' on pos' : '') + '" data-found="n">NGS</button></div>'
      : '';
    return '<div class="fhn">' +
      boxHtml('start', '基因篩檢', '', '') + '<span class="fa" aria-hidden="true"></span>' +
      boxHtml('way', '一次送兩個', '', '') + '<span class="fa fa-m" aria-hidden="true"></span>' + FORK +
      '<div class="ftests">' + boxHtml('h', '健保檢查', 'EGFR、ALK', '最長 2 週') +
      boxHtml('s', '自費 NGS', T.name + '・' + T.genes + '・' + T.price, '約 3 週') + '</div>' +
      '<span class="fa fa-m" aria-hidden="true"></span>' + JOIN +
      '<div class="fres">' + pair + sub + '</div>' +
      (end ? '<span class="fa" aria-hidden="true"></span>' + end : '') + '</div>';
  }

  function drawFlow() {
    if (stages.length && stages[0].type === 'hn') {
      $('flow').innerHTML = drawFlowHN(L.summarize(stages, rh, rn, tier, treat));
      all('#flow [data-comb]').forEach(function (b) { b.onclick = function () { setComb(b.getAttribute('data-comb')); }; });
      all('#flow [data-found]').forEach(function (b) { b.onclick = function () { setFound(b.getAttribute('data-found')); }; });
      return;
    }
    var rows = L.flowRows(stages, rh, rn, tier, treat), h = '';
    rows.forEach(function (row, ri) {
      h += '<div class="frow' + (ri ? ' sub' : '') + '">';
      row.forEach(function (n, i) {
        if (i) h += '<span class="fa" aria-hidden="true"></span>';
        if (n.pair) {
          h += '<div class="fn pairbox">' +
            ['pos', 'neg'].map(function (v) {
              return '<button class="pbtn ' + v + (n.pair.val === v ? ' on' : '') + '" data-which="' + n.pair.which + '" data-val="' + v + '">' + (v === 'pos' ? '有突變' : '沒有突變') + '</button>';
            }).join('') + '</div>';
        } else {
          h += '<div class="fn ' + n.cls + '"><div class="bx"><b>' + n.t + '</b>' + (n.s ? '<span>' + n.s + '</span>' : '') + '</div>' +
            (n.time ? '<span class="pill">' + n.time + '</span>' : '') + '</div>';
        }
      });
      h += '</div>';
    });
    $('flow').innerHTML = h;
    all('#flow .pbtn').forEach(function (b) {
      b.onclick = function () {
        var v = b.getAttribute('data-val');
        if (b.getAttribute('data-which') === 'rh') setRh(v); else setRn(v);
      };
    });
  }

  /* 細部時間軸（橫式）：手機寬度時在框內左右滑動 */
  function drawChart(Ly) {
    var i, ax = '', grid = '', body = '', c = $('chart'), axis = $('axis');
    var MAXW = Math.max(6, Math.ceil(Ly.end));
    var pc = function (w) { return (w / MAXW * 100) + '%'; };
    for (i = 0; i <= MAXW; i++) {
      var tx = i === 0 ? '0' : i === MAXW ? '-100%' : '-50%';
      ax += '<div class="tick" style="left:' + pc(i) + ';transform:translateX(' + tx + ')">' + (i === 0 ? '今天' : '第' + i + '週') + '<br>' + dateOf(i) + '</div>';
      grid += '<div class="grid" style="left:' + pc(i) + '"></div>';
    }
    axis.innerHTML = ax;
    Ly.bars.forEach(function (b) {
      body += '<div class="bar ' + b.k + '" style="top:' + (6 + b.lane * 54) + 'px;left:' + pc(b.s) + ';width:calc(' + pc(b.e - b.s) + ' - 2px)">' + barLabel(b) + '</div>';
    });
    if (Ly.decision !== null) body += '<div class="decline" style="left:' + pc(Ly.decision) + '"></div>';
    c.style.height = (Ly.lanes * 54 + 10) + 'px';
    c.innerHTML = grid + body;
  }

  function renderDetail() {
    var S = L.summarize(stages, rh, rn, tier, treat), Ly = S.layout, last = stages[stages.length - 1];
    $('nchoice').hidden = sel !== 'n';
    $('nboth').className = nOnly ? '' : 'on';
    $('nonly').className = nOnly ? 'on' : '';
    drawFlow();
    drawChart(Ly);

    var D = Ly.decision;
    $('end').innerHTML = !stages.length ? ''
      : Ly.target ? '有突變：最長約 <b>' + D + ' 週</b>（' + dateOf(D) + '）可以決定治療；申請健保藥物約 1 到 2 週，最長約 <b>' + Ly.start + ' 週</b>後可以開始用藥'
      : S.outcome === 'treat' ? '最長約 <b>' + D + ' 週</b>（' + dateOf(D) + '）拿到結果，接著接受治療'
      : '最長約 <b>' + D + ' 週</b>（' + dateOf(D) + '）拿到已送的結果';

    /* 選項一直留著，被選到的亮起來；點別的就換成別的結果，方便比對（使用者 2026-10-31） */
    var btns = $('btns'), ask = $('ask');
    btns.innerHTML = '';
    ask.hidden = true;
    var yn = function (q, cur, f) {
      return { q: q, o: [{ t: '有突變', on: cur === 'pos', f: function () { f('pos'); } }, { t: '沒有突變', on: cur === 'neg', f: function () { f('neg'); } }] };
    };
    var groups = [];
    if (S.hasHN) {
      var comb = (rh === 'pos' || (rh === 'neg' && rn === 'pos')) ? 'pos' : (rh === 'neg' && rn === 'neg') ? 'neg' : null;
      groups.push(yn('假設兩個檢查的結果都出來了，有找到突變嗎？', comb, setComb));
    } else if (S.hasH) {
      groups.push(yn('假設健保檢查的結果出來了，有找到突變嗎？', rh, setRh));
      if (rh === 'neg') {
        groups.push({ q: '沒有找到突變，接下來要怎麼做？', o: [
          { t: '做 NGS（扣 20000 點，餘額自費）', on: S.hasN && !S.hasR && !treat, f: chooseNgs },
          { t: '接受治療（化療、免疫治療等）', on: treat, f: chooseTreat },
          { t: '檢體不夠，需重新切片後做 NGS', on: S.hasN && S.hasR, f: chooseReslice }] });
        if (S.hasN) groups.push(yn('假設 NGS 的結果出來了，有找到突變嗎？', rn, setRn));
      }
    } else if (S.hasN) {
      groups.push(yn('假設 NGS 的結果出來了，有找到突變嗎？', rn, setRn));
    }
    groups.forEach(function (g) {
      var wrap = document.createElement('div'); wrap.className = 'cgrp';
      var q = document.createElement('div'); q.className = 'ask'; q.textContent = g.q; wrap.appendChild(q);
      var row = document.createElement('div'); row.className = 'btns';
      g.o.forEach(function (o) {
        var b = btn(o.t, o.f); if (o.on) b.className = 'on'; b.setAttribute('aria-pressed', o.on ? 'true' : 'false'); row.appendChild(b);
      });
      wrap.appendChild(row); btns.appendChild(wrap);
    });
    var stat = Ly.target ? '有突變，就可以申請藥物、開始治療了'
      : S.outcome === 'treat' ? '沒有找到突變，接下來是接受治療（化療、免疫治療等）' : '';
    if (stat) { var sp = document.createElement('p'); sp.className = 'cstat'; sp.textContent = stat; btns.appendChild(sp); }

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

    var m = '';
    m += '<div class="metric"><div class="lab">等待時間</div><div class="val">約 ' + (Ly.target ? Ly.start : D) + ' 週</div><div class="sub">' +
      (Ly.target ? '結果 ' + D + ' 週，加申請藥物 1–2 週' : '拿到結果') + '</div></div>';
    m += '<div class="metric"><div class="lab">自費</div><div class="val' + (S.nhi && !S.self ? ' sm' : '') + '">' + S.cost + '</div></div>';
    if (S.hasR) m += '<div class="metric bad"><div class="lab">切片</div><div class="val">需重新切片</div><div class="sub">多約 1 週</div></div>';
    $('metrics').innerHTML = m;

    $('pros').innerHTML = S.pros.map(function (x) { return '<div class="li">' + x + '</div>'; }).join('');
    $('cons').innerHTML = S.cons.map(function (x) { return '<div class="li">' + x + '</div>'; }).join('');
  }

  $('undo').onclick = function () {
    if (hist.length) { var o = JSON.parse(hist.pop()); stages = o.s; rh = o.rh; rn = o.rn; treat = o.treat; render(); }
  };

  /* ---------- 三選二圖：要快／要省錢／要資訊多 ---------- */
  var vsel = { fast: false, cheap: false, info: false };
  function setCls(el, name, on) {
    var re = new RegExp('(^|\\s)' + name + '(?=\\s|$)', 'g');
    el.setAttribute('class', (el.getAttribute('class') || '').replace(re, '').trim() + (on ? ' ' + name : ''));
  }
  /* 單選一個圈時，圈內有哪些重疊區的欄位要留著；選兩個或三個時只留那一個 */
  var VLABELS = { fast: ['fastinfo', 'fastcheap'], cheap: ['fastcheap', 'infocheap'], info: ['fastinfo', 'infocheap'] };
  function drawVenn() {
    var m = L.vennMatch(vsel);
    var keep = !m.region ? null : (VLABELS[m.region] || [m.region]);
    all('.venn [data-k]').forEach(function (el) {
      var k = el.getAttribute('data-k');
      setCls(el, 'on', k === m.region);
      /* 沒選到的欄位直接隱藏，以免誤導 */
      if (el.tagName.toLowerCase() === 'text') setCls(el, 'off', !!keep && keep.indexOf(k) < 0);
    });
    all('.venn svg')[0].setAttribute('class', m.region ? 'has' : '');   /* 有選時，沒選到的部分變淡 */
    all('#vpick button').forEach(function (b) { b.className = vsel[b.getAttribute('data-v')] ? 'on' : ''; });
    var h = m.text ? '<p><b>' + m.text + '</b></p>' : '';
    if (m.rows.length) {
      var rows = L.compareRows();
      h += '<div class="btns">' + m.rows.map(function (k) {
        var r = rows.filter(function (x) { return x.key === k; })[0];
        return '<button class="vgo" data-key="' + k + '">看時間軸：' + r.label + '</button>';
      }).join('') + '</div>';
    }
    $('vres').innerHTML = h;
    all('#vres .vgo').forEach(function (b) {
      b.onclick = function () {
        selectRow(b.getAttribute('data-key'), true);
        $('cmp3').scrollIntoView({ block: 'start' });
      };
    });
  }
  all('#vpick button').forEach(function (b) {
    b.onclick = function () { var k = b.getAttribute('data-v'); vsel[k] = !vsel[k]; drawVenn(); };
  });

  function render() {
    drawCompare();
    $('detail').hidden = sel === 'all';
    if (sel !== 'all') renderDetail();
  }

  mutBars();
  drawVenn();
  showStep(1);
})(window);
