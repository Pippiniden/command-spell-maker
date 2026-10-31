var VB = 400, AX = 200;
var KAKU_COL = { 1: '#e3363e', 2: '#f0923a', 3: '#c95bd0' };
var COLORS = [['血', '#b3121e'], ['紅', '#d4202b'], ['朱', '#e8462a'], ['深紅', '#94111f'], ['紫', '#8d3fd4'], ['蒼', '#2f7de0'], ['金', '#d9a531']];
var PC = (typeof polygonClipping !== 'undefined') ? polygonClipping : null;

function r1(n) { return Math.round(n * 10) / 10; }
function rad(d) { return d * Math.PI / 180; }

/* ---- 線の太り方 ---- */
function prof(kind, t) {
  t = Math.max(0, Math.min(1, t));
  if (kind === 'both') return Math.pow(Math.sin(Math.PI * t), 0.7);
  if (kind === 'sweep') return t < 0.18 ? Math.pow(Math.sin(t / 0.18 * Math.PI / 2), 0.7) : Math.pow(Math.max(0, 1 - (t - 0.18) / 0.82), 1.1);
  if (kind === 'entry') return prof('sweep', 1 - t);
  return Math.max(0, Math.min(1, t / 0.06, (1 - t) / 0.06));
}
/* 中心線から、先細りの輪郭（点の輪）を作る */
function outlinePts(p, w, kind) {
  var n = p.length;
  if (n < 2) return [];
  var L = [0], i;
  for (i = 1; i < n; i++) L[i] = L[i - 1] + Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
  var T = L[n - 1] || 1, A = [], B = [];
  for (i = 0; i < n; i++) {
    var a = p[Math.max(0, i - 1)], b = p[Math.min(n - 1, i + 1)];
    var tx = b[0] - a[0], ty = b[1] - a[1], l = Math.hypot(tx, ty) || 1;
    tx /= l; ty /= l;
    var h = w / 2 * prof(kind, L[i] / T);
    A.push([p[i][0] - ty * h, p[i][1] + tx * h]);
    B.push([p[i][0] + ty * h, p[i][1] - tx * h]);
  }
  return A.concat(B.reverse().slice(1, -1));
}

function resample(p, step) {
  if (p.length < 2) return p.slice();
  var out = [p[0]], prev = p[0], acc = 0;
  for (var i = 1; i < p.length; i++) {
    var cur = p[i], seg = Math.hypot(cur[0] - prev[0], cur[1] - prev[1]);
    while (seg > 0 && acc + seg >= step) {
      var k = (step - acc) / seg;
      var q = [prev[0] + (cur[0] - prev[0]) * k, prev[1] + (cur[1] - prev[1]) * k];
      out.push(q); prev = q; acc = 0;
      seg = Math.hypot(cur[0] - prev[0], cur[1] - prev[1]);
    }
    acc += seg; prev = cur;
  }
  var last = p[p.length - 1], end = out[out.length - 1];
  if (Math.hypot(last[0] - end[0], last[1] - end[1]) > 0.5) out.push(last);
  return out;
}
function smooth(p, passes) {
  for (var k = 0; k < passes; k++) {
    var q = [p[0]];
    for (var i = 1; i < p.length - 1; i++) q.push([(p[i - 1][0] + p[i][0] * 2 + p[i + 1][0]) / 4, (p[i - 1][1] + p[i][1] * 2 + p[i + 1][1]) / 4]);
    q.push(p[p.length - 1]);
    p = q;
  }
  return p;
}
function cub(P, n) {
  var out = [];
  for (var i = 0; i <= n; i++) {
    var t = i / n, u = 1 - t;
    out.push([u * u * u * P[0][0] + 3 * u * u * t * P[1][0] + 3 * u * t * t * P[2][0] + t * t * t * P[3][0],
              u * u * u * P[0][1] + 3 * u * u * t * P[1][1] + 3 * u * t * t * P[2][1] + t * t * t * P[3][1]]);
  }
  return out;
}
function quad(a, c, b, n) {
  var out = [];
  for (var i = 1; i <= n; i++) { var t = i / n, u = 1 - t; out.push([u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]); }
  return out;
}
function bez(P) { return resample(cub(P, 80), 2.5); }
function gen(n, fn) { var o = []; for (var i = 0; i <= n; i++) o.push(fn(i / n)); return o; }
function circle(r, n) { n = n || 72; var o = []; for (var i = 0; i < n; i++) { var a = i / n * Math.PI * 2; o.push([r * Math.cos(a), r * Math.sin(a)]); } return o; }

/* ---- パーツ ---- */
var PRESETS = {
  sword:    { label: '剣',   prof: 'both',  w: 12, pts: function () { return gen(44, function (t) { return [0, -56 + 112 * t]; }); } },
  hook:     { label: '鉤',   prof: 'both',  w: 13, pts: function () { return bez([[-8, 52], [-10, -30], [44, -58], [34, -6]]); } },
  crescent: { label: '三日月', prof: 'both', w: 18, pts: function () { return gen(60, function (t) { var a = rad(15 + 150 * t); return [42 * Math.cos(a), 42 * Math.sin(a) - 22]; }); } },
  wing:     { label: '翼',   prof: 'sweep', w: 18, pts: function () { return bez([[-44, 34], [-12, -6], [18, -26], [58, -44]]); } },
  flame:    { label: '炎',   prof: 'sweep', w: 22, pts: function () { return bez([[0, 54], [-36, 12], [30, -12], [2, -58]]); } },
  horn:     { label: '角',   prof: 'sweep', w: 26, pts: function () { return bez([[-22, 50], [-32, 0], [8, -40], [42, -50]]); } },
  fang:     { label: '牙',   prof: 'sweep', w: 20, pts: function () { return bez([[0, -42], [16, -10], [12, 22], [-8, 44]]); } },
  claw:     { label: '爪',   prof: 'sweep', w: 16, pts: function () { return bez([[-38, 32], [-38, -32], [30, -52], [42, 2]]); } },
  arc:      { label: '弧',   prof: 'both',  w: 10, pts: function () { return gen(80, function (t) { var a = rad(135 + 270 * t); return [38 * Math.cos(a), 38 * Math.sin(a)]; }); } },
  scurve:   { label: 'S字',  prof: 'both',  w: 14, pts: function () { return bez([[-30, 52], [62, 20], [-62, -20], [30, -52]]); } },
  spiral:   { label: '渦',   prof: 'entry', w: 11, pts: function () { return resample(gen(120, function (t) { var a = t * 2.3 * Math.PI, r = 4 + 14 * a / Math.PI; return [r * Math.cos(a), r * Math.sin(a)]; }), 2.5); } },
  wave:     { label: '波',   prof: 'both',  w: 10, pts: function () { return gen(60, function (t) { var x = -52 + 104 * t; return [x, 12 * Math.sin(x / 52 * 1.5 * Math.PI)]; }); } },
  bolt:     { label: '稲妻', prof: 'both',  w: 12, pts: function () { return resample([[-22, -52], [10, -12], [-10, 0], [22, 52]], 2.5); } }
};
var PRIMS = {
  ring:    { label: '輪',   w: 7,  g: function (w) { return [[circle(34), circle(Math.max(2, 34 - w)).reverse()]]; } },
  dot:     { label: '点',   w: 9,  g: function (w) { return [[circle(w, 40)]]; } },
  diamond: { label: '菱',   w: 11, g: function (w) { var h = w * 1.6; return [[[[0, -34], [h, 0], [0, 34], [-h, 0]]]]; } },
  leaf:    { label: '葉',   w: 12, g: function (w) { var k = w * 2; return [[[[0, -40]].concat(quad([0, -40], [k, 0], [0, 40], 20), quad([0, 40], [-k, 0], [0, -40], 20).slice(0, -1))]]; } },
  drop:    { label: '雫',   w: 13, g: function (w) { var k = w * 1.6; return [[[[0, -36]].concat(cub([[0, -36], [k * 0.5, -12], [k, 4], [0, 26]], 24).slice(1), cub([[0, 26], [-k, 4], [-k * 0.5, -12], [0, -36]], 24).slice(1, -1))]]; } },
  star:    { label: '星',   w: 8,  g: function (w) { var s = w * 0.5, r = [[0, -40]]; r = r.concat(quad([0, -40], [s, -s], [30, 0], 10), quad([30, 0], [s, s], [0, 40], 10), quad([0, 40], [-s, s], [-30, 0], 10), quad([-30, 0], [-s, -s], [0, -40], 10).slice(0, -1)); return [[r]]; } },
  thorn:   { label: '棘',   w: 14, g: function (w) { var r = [[-w, 30]]; r = r.concat(quad([-w, 30], [-w * 0.3, 0], [0, -36], 16), quad([0, -36], [w * 0.3, 0], [w, 30], 16), quad([w, 30], [0, 22], [-w, 30], 10).slice(0, -1)); return [[r]]; } },
  arrow:   { label: '矢尻', w: 12, g: function (w) { var k = w * 2.2; return [[[[0, -36], [k, 20], [0, 6], [-k, 20]]]]; } },
  tri:     { label: '三角', w: 12, g: function (w) { var k = w * 2.5; return [[[[0, -34], [k, 18], [-k, 18]]]]; } },
  rect:    { label: '四角', w: 15, g: function (w) { var h = w * 2; return [[[[-30, -h], [30, -h], [30, h], [-30, h]]]]; } }
};

/* ---- 形の幾何 ---- */
function mpBBox(mp) {
  var b = [Infinity, Infinity, -Infinity, -Infinity];
  mp.forEach(function (poly) { poly.forEach(function (ring) { ring.forEach(function (p) {
    if (p[0] < b[0]) b[0] = p[0]; if (p[1] < b[1]) b[1] = p[1]; if (p[0] > b[2]) b[2] = p[0]; if (p[1] > b[3]) b[3] = p[1];
  }); }); });
  return b;
}
function bbHit(a, b) { return a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3]; }
function densify(ring, step) {
  var out = [];
  for (var i = 0; i < ring.length; i++) {
    var a = ring[i], b = ring[(i + 1) % ring.length], d = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(d / step));
    for (var k = 0; k < n; k++) out.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]);
  }
  return out;
}
function localGeom(s) {
  if (s.kind === 'merged') return s.geom;
  if (s.kind === 'prim') return PRIMS[s.prim].g(s.w);
  return [[outlinePts(s.pts, s.w, s.prof)]];
}
function hasWarp(s) { return !!(s.warp && s.warp.some(function (d) { return d[0] || d[1]; })); }
/* 9点メッシュ（2次ベジェ曲面）で歪ませる */
function applyWarp(mp, warp, bb) {
  var W = bb[2] - bb[0] || 1, H = bb[3] - bb[1] || 1;
  return mp.map(function (poly) { return poly.map(function (ring) { return densify(ring, 3).map(function (p) {
    var u = (p[0] - bb[0]) / W, v = (p[1] - bb[1]) / H;
    var bu = [(1 - u) * (1 - u), 2 * u * (1 - u), u * u], bv = [(1 - v) * (1 - v), 2 * v * (1 - v), v * v];
    var dx = 0, dy = 0;
    for (var j = 0; j < 3; j++) for (var i = 0; i < 3; i++) { var k = bu[i] * bv[j], d = warp[j * 3 + i]; dx += k * d[0]; dy += k * d[1]; }
    return [p[0] + dx, p[1] + dy];
  }); }); });
}
function xform(s) {
  var c = Math.cos(rad(s.rot)), sn = Math.sin(rad(s.rot)), fx = s.flip ? -s.s : s.s, sy = s.s;
  return function (p) { var x = p[0] * fx, y = p[1] * sy; return [s.x + x * c - y * sn, s.y + x * sn + y * c]; };
}
function mapMP(mp, f) { return mp.map(function (poly) { return poly.map(function (ring) { return ring.map(f); }); }); }
function mirrorMP(mp) { return mapMP(mp, function (p) { return [VB - p[0], p[1]]; }); }
function worldGeom(s) {
  var g = localGeom(s);
  if (hasWarp(s)) g = applyWarp(g, s.warp, mpBBox(g));
  var orig = mapMP(g, xform(s));
  return { orig: orig, mir: s.mirror ? mirrorMP(orig) : null };
}
function ringD(ring) { return 'M' + ring.map(function (p) { return r1(p[0]) + ' ' + r1(p[1]); }).join('L') + 'Z'; }
function mpD(mp) { return mp.map(function (poly) { return poly.map(ringD).join(''); }).join(''); }

/* 描く順に重ね、消しゴムの形でその下の形を削る */
function composite(shapes) {
  var items = [], cuts = [];
  shapes.forEach(function (s) {
    var g = worldGeom(s), all = g.orig.concat(g.mir || []);
    if (s.op === 'cut') {
      var bb = mpBBox(all);
      if (PC) items.forEach(function (it) {
        if (!bbHit(bb, it.bb)) return;
        try { it.mp = PC.difference(it.clipped ? it.mp : PC.union(it.mp), all); it.clipped = true; } catch (e) {}
      });
      cuts.push({ s: s, mp: all });
    } else items.push({ s: s, mp: all, clipped: false, bb: mpBBox(all) });
  });
  return { items: items, cuts: cuts };
}

function glowLevel(st) { var g = st.glow; return g === true || g == null ? 2 : g === false ? 0 : g; }
/* 仕上げの効果：まだらな質感、近くの光、大きく広がる光 */
function effects(st) {
  var lv = glowLevel(st), tex = st.texture !== false;
  if (!lv && !tex) return '';
  var f = '<filter id="gl" filterUnits="userSpaceOnUse" x="0" y="0" width="400" height="400" color-interpolation-filters="sRGB">', src = 'SourceGraphic';
  if (tex) {
    f += '<feTurbulence type="fractalNoise" baseFrequency="0.025" numOctaves="3" seed="11" result="n"/>' +
      '<feColorMatrix in="n" type="saturate" values="0" result="ng"/>' +
      '<feComponentTransfer in="ng" result="nt"><feFuncR type="linear" slope="0.75" intercept="0.5"/><feFuncG type="linear" slope="0.75" intercept="0.5"/><feFuncB type="linear" slope="0.75" intercept="0.5"/><feFuncA type="linear" slope="0" intercept="1"/></feComponentTransfer>' +
      '<feComposite in="nt" in2="SourceAlpha" operator="in" result="nm"/>' +
      '<feBlend in="SourceGraphic" in2="nm" mode="multiply" result="body"/>';
    src = 'body';
  }
  var merge = '';
  if (lv >= 2) {
    f += '<feGaussianBlur in="' + src + '" stdDeviation="30" result="h"/><feComponentTransfer in="h" result="h2"><feFuncA type="linear" slope="5"/></feComponentTransfer>' +
      '<feGaussianBlur in="' + src + '" stdDeviation="10" result="m"/><feComponentTransfer in="m" result="m2"><feFuncA type="linear" slope="1.7"/></feComponentTransfer>';
    merge += '<feMergeNode in="h2"/><feMergeNode in="m2"/>';
  }
  if (lv >= 1) {
    f += '<feGaussianBlur in="' + src + '" stdDeviation="' + (lv >= 2 ? 4 : 5) + '" result="b"/><feComponentTransfer in="b" result="b2"><feFuncA type="linear" slope="0.9"/></feComponentTransfer>';
    merge += '<feMergeNode in="b2"/>';
  }
  return f + '<feMerge>' + merge + '<feMergeNode in="' + src + '"/></feMerge></filter>';
}

/* opts.screen: 画面用（当たり判定、消しゴムの輪郭）。opts.used: 使った画を薄く */
function sealMarkup(shapes, st, opts) {
  var comp = composite(shapes), body = '';
  comp.items.forEach(function (it) {
    var s = it.s, col = opts.screen && st.byKaku ? KAKU_COL[s.kaku] : st.color;
    var gone = opts.used && opts.used[s.kaku - 1];
    var hit = opts.screen ? ' stroke="transparent" stroke-width="10" vector-effect="non-scaling-stroke"' : '';
    var line = st.outline !== false;
    var P = function (d, rule) {
      return '<path d="' + d + '" fill="' + col + '" fill-rule="' + rule + '"' + hit + '/>' +
        (line ? '<path d="' + d + '" fill="none" stroke="#ffd9d0" stroke-opacity="0.55" stroke-width="0.45" stroke-linejoin="round" pointer-events="none"/>' : '');
    };
    var paths;
    if (it.clipped) paths = it.mp.length ? P(mpD(it.mp), 'evenodd') : '';
    else paths = it.mp.map(function (poly) { return P(mpD([poly]), s.kind === 'stroke' ? 'nonzero' : 'evenodd'); }).join('');
    var g = '<g' + (opts.screen ? ' data-id="' + s.id + '"' : '') + (gone ? ' opacity="0.07"' : '') + '>' + paths + '</g>';
    body += g;
  });
  var fx = effects(st);
  var out = fx ? '<defs>' + fx + '</defs><g filter="url(#gl)">' + body + '</g>' : '<g>' + body + '</g>';
  if (opts.screen && opts.showCuts) {
    out += '<g>' + comp.cuts.map(function (c) {
      var d = mpD(c.mp);
      return '<g data-id="' + c.s.id + '"><path d="' + d + '" fill="none" stroke="transparent" stroke-width="12" vector-effect="non-scaling-stroke" pointer-events="stroke"/>' +
        '<path d="' + d + '" fill="rgba(143,196,255,0.05)" stroke="#8fc4ff" stroke-width="1.2" stroke-dasharray="4 3" vector-effect="non-scaling-stroke" opacity="0.8" pointer-events="none"/></g>';
    }).join('') + '</g>';
  }
  return out;
}

function bgMarkup(bg, screen) {
  if (bg === 'ink') return '<rect width="400" height="400" fill="#120c0e"/>';
  if (bg === 'paper') return '<rect width="400" height="400" fill="#f4efea"/>';
  if (bg === 'skin') return '<defs><radialGradient id="sk" cx="50%" cy="44%" r="72%"><stop offset="0" stop-color="#eccbaf"/><stop offset="1" stop-color="#c8957a"/></radialGradient></defs><rect width="400" height="400" fill="url(#sk)"/>';
  if (!screen) return '';
  return '<defs><pattern id="chk" width="20" height="20" patternUnits="userSpaceOnUse"><rect width="20" height="20" fill="#2a2a2a"/><rect width="10" height="10" fill="#333"/><rect x="10" y="10" width="10" height="10" fill="#333"/></pattern></defs><rect width="400" height="400" fill="url(#chk)"/>';
}

var nextId = 1;
function makeShape(kind, key, o) {
  var s = { id: 's' + (nextId++), kind: kind === 'prim' ? 'prim' : 'stroke', op: 'add', x: AX, y: 200, rot: 0, s: 1, flip: false, mirror: true, kaku: 1, warp: null };
  if (s.kind === 'prim') { s.prim = key; s.w = PRIMS[key].w; }
  else { var P = PRESETS[key]; s.pts = P.pts().map(function (q) { return [r1(q[0]), r1(q[1])]; }); s.prof = P.prof; s.w = P.w; }
  for (var k in o) s[k] = o[k];
  return s;
}
/* ---- デフォルトの令呪 ----
   座標は元絵（1536×1024）の画素位置で書き、キャンバスの400単位に写す */
var REF = { cx: 768, top: 22, k: 0.39 };
function imgPt(p) { return [AX + (p[0] - REF.cx) * REF.k, 10 + (p[1] - REF.top) * REF.k]; }
function localize(pts) {
  var b = mpBBox([[pts]]), cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2;
  return { cx: cx, cy: cy, pts: pts.map(function (q) { return [r1(q[0] - cx), r1(q[1] - cy)]; }) };
}
function sampleShapes() {
  /* 元画像の座標（1536×1024）をキャンバス（400×400）へ写す */
  var K = 0.37;
  function T(p) { return [AX + (p[0] - 767.5) * K, 20 + (p[1] - 22) * K]; }
  function base(o) {
    var s = { id: 's' + (nextId++), op: 'add', rot: 0, s: 1, flip: false, mirror: true, kaku: 1, warp: null };
    for (var k in o) s[k] = o[k];
    return s;
  }
  function centered(ring, o) {
    var b = mpBBox([[ring]]), cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2;
    o.x = r1(cx); o.y = r1(cy);
    return { cx: cx, cy: cy, pts: ring.map(function (q) { return [r1(q[0] - cx), r1(q[1] - cy)]; }) };
  }
  function spine(P, w, prof, o) {
    var pts = P.length === 4 ? bez(P.map(T)) : resample(P.map(T), 2.5);
    o.kind = 'stroke'; o.prof = prof; o.w = r1(w * K);
    o.pts = centered(pts, o).pts;
    return base(o);
  }
  /* 角（c=true）の間をなめらかな曲線でつないだ輪郭 */
  function traced(P, o) {
    var n = P.length, idx = [], ring = [];
    P.forEach(function (p, i) { if (p[2]) idx.push(i); });
    idx.forEach(function (a, k) {
      var b = idx[(k + 1) % idx.length], chain = [];
      for (var i = a; ; i = (i + 1) % n) { chain.push(T(P[i])); if (i === b) break; }
      for (var j = 0; j < chain.length - 1; j++) {
        var p0 = chain[Math.max(0, j - 1)], p1 = chain[j], p2 = chain[j + 1], p3 = chain[Math.min(chain.length - 1, j + 2)];
        for (var s = 0; s < 6; s++) {
          var t = s / 6, t2 = t * t, t3 = t2 * t;
          ring.push([0, 1].map(function (d) {
            return 0.5 * (2 * p1[d] + (-p0[d] + p2[d]) * t + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * t2 + (-p0[d] + 3 * p1[d] - 3 * p2[d] + p3[d]) * t3);
          }));
        }
      }
    });
    o.kind = 'merged';
    o.geom = [[centered(ring, o).pts]];
    return base(o);
  }
  /* 中央の四芒星：上・下・左右で長さが違うので輪郭を直接作る */
  function star() {
    var c = T([767.5, 340]), t = 68 * K, bt = 105 * K, sd = 72 * K, q = 7 * K;
    var top = [0, -t], rt = [sd, 0], bot = [0, bt], lf = [-sd, 0];
    var ring = [top].concat(quad(top, [q, -q], rt, 18), quad(rt, [q, q], bot, 24), quad(bot, [-q, q], lf, 24), quad(lf, [-q, -q], top, 18).slice(0, -1));
    return base({ kind: 'merged', geom: [[ring.map(function (p) { return [r1(p[0]), r1(p[1])]; })]], x: r1(c[0]), y: r1(c[1]), mirror: false, kaku: 1 });
  }
  var C = true;
  return [
    /* 一画：矢じり・軸・四芒星 */
    makeShape('prim', 'arrow', { x: AX, y: 47.8, s: 0.77, w: 6.3, mirror: false, kaku: 1 }),
    spine([[767.5, 122], [767.5, 300]], 32, 'sweep', { mirror: false, kaku: 1 }),
    star(),
    /* 二画：棘のある外側の弧、内側の弧 */
    traced([[708, 134, C], [670, 160], [637, 200], [610, 240], [590, 277], [577, 313, C], [593, 289], [613, 279, C], [618, 290], [622, 320], [630, 360], [647, 390], [673, 422, C],
            [653, 387], [642, 337], [639, 287], [643, 247], [657, 207], [680, 170]], { kaku: 2 }),
    spine([[656, 315], [668, 370], [700, 410], [752, 437]], 34, 'entry', { kaku: 2 }),
    /* 三画：棘のある横の刃、付け根の鉤、下の菱と剣、下の刃 */
    traced([[503, 466, C], [557, 443], [610, 405, C], [612, 423], [630, 433], [657, 435], [683, 430, C], [707, 443], [722, 462], [728, 487, C],
            [705, 476], [677, 463], [640, 447], [600, 442], [550, 449]], { kaku: 3 }),
    spine([[668, 447], [716, 452], [714, 497], [680, 503]], 24, 'sweep', { kaku: 3 }),
    spine([[767.5, 456], [767.5, 752]], 52, 'sweep', { mirror: false, kaku: 3 }),
    spine([[694, 476], [712, 600], [735, 760], [766, 996]], 42, 'sweep', { kaku: 3 })
  ];
}

if (typeof document !== 'undefined') (function () {
  var $ = function (id) { return document.getElementById(id); };
  var cv = $('cv');
  var KEY = 'reiju-designer-v1';
  var doc = { shapes: [], st: { color: '#b3121e', bg: 'ink', glow: 2, outline: true, texture: true, byKaku: false, name: 'わたしの令呪' } };
  var ui = { mode: 'select', sel: [], multi: false, warp: false, newOp: 'add', newKaku: 1, newMirror: true, brushW: 14, brushP: 'sweep', guides: true, showCuts: true, used: [false, false, false] };
  var hist = [], redo = [];

  try {
    var saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (saved && Array.isArray(saved.shapes)) { doc = saved; nextId = saved.nextId || 1000; }
  } catch (e) {}
  if (!doc.shapes.length && !doc.cleared) doc.shapes = sampleShapes();

  var saveT;
  function persist() {
    clearTimeout(saveT);
    saveT = setTimeout(function () { try { doc.nextId = nextId; localStorage.setItem(KEY, JSON.stringify(doc)); } catch (e) {} }, 300);
  }
  function snap() { hist.push(JSON.stringify(doc)); if (hist.length > 120) hist.shift(); redo = []; }
  function find(id) { for (var i = 0; i < doc.shapes.length; i++) if (doc.shapes[i].id === id) return doc.shapes[i]; return null; }
  function selShapes() { return doc.shapes.filter(function (s) { return ui.sel.indexOf(s.id) >= 0; }); }
  function one() { return ui.sel.length === 1 ? find(ui.sel[0]) : null; }
  function setSel(ids) { ui.sel = ids; if (ids.length !== 1) ui.warp = false; }

  function svgPt(e) { var p = new DOMPoint(e.clientX, e.clientY).matrixTransform(cv.getScreenCTM().inverse()); return [p.x, p.y]; }

  function guidesMarkup() {
    if (!ui.guides) return '';
    var c = doc.st.bg === 'paper' || doc.st.bg === 'skin' ? 'rgba(60,20,20,0.22)' : 'rgba(255,235,225,0.13)';
    return '<g fill="none" stroke="' + c + '" stroke-width="1" pointer-events="none">' +
      '<line x1="200" y1="0" x2="200" y2="400" stroke-dasharray="4 5"/><line x1="0" y1="200" x2="400" y2="200" stroke-dasharray="1 6"/>' +
      '<circle cx="200" cy="200" r="60" stroke-dasharray="1 6"/><circle cx="200" cy="200" r="120" stroke-dasharray="1 6"/><circle cx="200" cy="200" r="180" stroke-dasharray="1 6"/></g>';
  }

  /* 9点メッシュのハンドル位置（ワールド座標） */
  function handles(s) {
    var bb = mpBBox(localGeom(s)), f = xform(s), out = [];
    var w = s.warp || [];
    for (var j = 0; j < 3; j++) for (var i = 0; i < 3; i++) {
      var d = w[j * 3 + i] || [0, 0];
      out.push(f([bb[0] + (bb[2] - bb[0]) * i / 2 + d[0], bb[1] + (bb[3] - bb[1]) * j / 2 + d[1]]));
    }
    return out;
  }

  function overlayMarkup() {
    var out = '';
    selShapes().forEach(function (s, n) {
      var g = worldGeom(s), col = s.op === 'cut' ? '#8fc4ff' : '#ffd2c8';
      [g.orig, g.mir].forEach(function (mp, i) {
        if (!mp) return;
        var b = mpBBox(mp);
        out += '<rect x="' + r1(b[0] - 5) + '" y="' + r1(b[1] - 5) + '" width="' + r1(b[2] - b[0] + 10) + '" height="' + r1(b[3] - b[1] + 10) + '" fill="none" stroke="' + col + '" stroke-width="1.2" stroke-dasharray="' + (i ? '2 4' : '5 4') + '" opacity="' + (i ? 0.45 : 0.9) + '" pointer-events="none"/>';
      });
    });
    var s = one();
    if (s && ui.warp) {
      var h = handles(s), lines = '';
      for (var j = 0; j < 3; j++) for (var i = 0; i < 3; i++) {
        var k = j * 3 + i;
        if (i < 2) lines += 'M' + r1(h[k][0]) + ' ' + r1(h[k][1]) + 'L' + r1(h[k + 1][0]) + ' ' + r1(h[k + 1][1]);
        if (j < 2) lines += 'M' + r1(h[k][0]) + ' ' + r1(h[k][1]) + 'L' + r1(h[k + 3][0]) + ' ' + r1(h[k + 3][1]);
      }
      out += '<path d="' + lines + '" fill="none" stroke="#ffd2c8" stroke-width="1" opacity="0.6" pointer-events="none"/>';
      h.forEach(function (p, k) {
        out += '<g data-h="' + k + '"><circle cx="' + r1(p[0]) + '" cy="' + r1(p[1]) + '" r="13" fill="transparent"/>' +
          '<circle cx="' + r1(p[0]) + '" cy="' + r1(p[1]) + '" r="5.5" fill="#1a1316" stroke="#ffd2c8" stroke-width="1.6"/></g>';
      });
    }
    return out;
  }

  function render() {
    cv.innerHTML = bgMarkup(doc.st.bg, true) + guidesMarkup() +
      '<g id="seal">' + sealMarkup(doc.shapes, doc.st, { screen: true, used: ui.used, showCuts: ui.showCuts }) + '</g>' +
      '<g id="live" pointer-events="none"></g><g id="overlay">' + overlayMarkup() + '</g>';
    syncUI();
    persist();
  }

  function seg(sel, attr, val) { document.querySelectorAll(sel + ' button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset[attr] === String(val))); }); }

  function syncUI() {
    var left = ui.used.filter(function (u) { return !u; }).length;
    $('remain').textContent = left ? '残り ' + left + ' 画' : '令呪は全て消えた';
    $('use').disabled = !left;
    $('restore').disabled = left === 3;
    var c = [0, 0, 0], cuts = 0;
    doc.shapes.forEach(function (s) { if (s.op === 'cut') cuts++; else c[s.kaku - 1]++; });
    $('counts').textContent = '一画 ' + c[0] + ' / 二画 ' + c[1] + ' / 三画 ' + c[2] + (cuts ? ' / 消しゴム ' + cuts : '');
    $('undo').disabled = !hist.length;
    $('redo').disabled = !redo.length;
    $('m-select').setAttribute('aria-pressed', String(ui.mode === 'select'));
    $('m-draw').setAttribute('aria-pressed', String(ui.mode === 'draw'));
    $('multi').setAttribute('aria-pressed', String(ui.multi));
    cv.classList.toggle('draw', ui.mode === 'draw');
    seg('#newkaku', 'k', ui.newKaku);
    seg('#newop', 'op', ui.newOp);
    document.querySelectorAll('.parts').forEach(function (p) { p.classList.toggle('cutmode', ui.newOp === 'cut'); });
    $('ophint').textContent = ui.newOp === 'cut' ? '置いた形と重なった部分が消えます。消しゴムの形は青い点線で表示され、あとから動かせます。' : 'パーツや筆の線を、そのまま赤い形として置きます。';
    seg('#bgseg', 'bg', doc.st.bg);
    document.querySelectorAll('#swatches .sw').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.c.toLowerCase() === doc.st.color.toLowerCase())); });
    $('custom').value = doc.st.color;
    seg('#glowseg', 'g', glowLevel(doc.st)); $('outline').checked = doc.st.outline !== false; $('texture').checked = doc.st.texture !== false;
    $('bykaku').checked = doc.st.byKaku; $('guides').checked = ui.guides; $('showcuts').checked = ui.showCuts;
    if (document.activeElement !== $('dname')) $('dname').value = doc.st.name || '';

    var n = ui.sel.length, s = one();
    $('nosel').hidden = n > 0;
    $('multiprops').hidden = n < 2;
    $('props').hidden = !s;
    if (n >= 2) {
      $('multicount').textContent = n + '個を選択中';
      $('merge').disabled = !PC;
      var ks = selShapes().filter(function (x) { return x.op !== 'cut'; }).map(function (x) { return x.kaku; });
      seg('#m-kaku', 'k', ks.length && ks.every(function (k) { return k === ks[0]; }) ? ks[0] : 0);
    }
    if (!s) return;
    seg('#p-op', 'op', s.op || 'add');
    seg('#p-kaku', 'k', s.kaku);
    $('p-kaku').hidden = s.op === 'cut';
    setRange('p-rot', s.rot, Math.round(s.rot) + '°');
    setRange('p-size', s.s, Math.round(s.s * 100) + '%');
    $('p-w-wrap').hidden = s.kind === 'merged';
    if (s.kind !== 'merged') setRange('p-w', s.w, r1(s.w));
    $('p-prof-wrap').hidden = s.kind !== 'stroke';
    if (s.kind === 'stroke') $('p-prof').value = s.prof;
    $('p-mirror').checked = s.mirror;
    $('p-warp').setAttribute('aria-pressed', String(ui.warp));
    $('p-unwarp').disabled = !hasWarp(s);
    $('warphint').hidden = !ui.warp;
  }
  function setRange(id, v, label) { if (document.activeElement !== $(id)) $(id).value = v; $(id + '-o').textContent = label; }

  /* パーツの一覧 */
  function thumb(mp, rule) { return '<svg viewBox="-62 -62 124 124" aria-hidden="true"><path d="' + mpD(mp) + '" fill="currentColor" fill-rule="' + rule + '"/></svg>'; }
  Object.keys(PRESETS).forEach(function (k) {
    var P = PRESETS[k];
    $('parts-line').insertAdjacentHTML('beforeend', '<button type="button" class="part" data-kind="stroke" data-key="' + k + '">' + thumb([[outlinePts(P.pts(), P.w, P.prof)]], 'nonzero') + '<span>' + P.label + '</span></button>');
  });
  Object.keys(PRIMS).forEach(function (k) {
    $('parts-fill').insertAdjacentHTML('beforeend', '<button type="button" class="part" data-kind="prim" data-key="' + k + '">' + thumb(PRIMS[k].g(PRIMS[k].w), 'evenodd') + '<span>' + PRIMS[k].label + '</span></button>');
  });
  function addPart(e) {
    var b = e.target.closest('.part'); if (!b) return;
    snap();
    var off = (doc.shapes.length % 5) * 6;
    var s = makeShape(b.dataset.kind, b.dataset.key, { op: ui.newOp, kaku: ui.newKaku, mirror: ui.newMirror, x: (ui.newMirror ? 236 : 200) + off, y: 200 + off });
    doc.shapes.push(s); setSel([s.id]); ui.mode = 'select';
    render();
  }
  $('parts-line').addEventListener('click', addPart);
  $('parts-fill').addEventListener('click', addPart);

  /* キャンバス操作 */
  var drag = null, drawing = null, hdrag = null;
  cv.addEventListener('pointerdown', function (e) {
    if (e.button !== undefined && e.button !== 0) return;
    var p = svgPt(e);
    cv.setPointerCapture(e.pointerId);
    var h = e.target.closest('[data-h]');
    if (h && one()) {
      var s0 = one();
      hdrag = { k: +h.dataset.h, p: p, orig: (s0.warp || []).length === 9 ? s0.warp.map(function (d) { return d.slice(); }) : gen(8, function () { return [0, 0]; }), moved: false };
      return;
    }
    if (ui.mode === 'draw') { drawing = [p]; return; }
    var g = e.target.closest('[data-id]');
    var additive = ui.multi || e.shiftKey || e.metaKey || e.ctrlKey;
    if (!g) { if (ui.sel.length && !additive) { setSel([]); render(); } return; }
    var id = g.dataset.id;
    if (additive) {
      var i = ui.sel.indexOf(id);
      setSel(i >= 0 ? ui.sel.filter(function (x) { return x !== id; }) : ui.sel.concat(id));
      if (i >= 0) { render(); return; }
    } else if (ui.sel.indexOf(id) < 0) setSel([id]);
    var s = find(id);
    var side = s.mirror && (p[0] - AX) * (s.x - AX) < 0;
    drag = { side: side, p: p, origs: selShapes().map(function (x) { return { s: x, x: x.x, y: x.y }; }), moved: false };
    render();
  });
  cv.addEventListener('pointermove', function (e) {
    if (hdrag) {
      var s = one(); if (!s) return;
      var q = svgPt(e), dx = q[0] - hdrag.p[0], dy = q[1] - hdrag.p[1];
      if (!hdrag.moved) { if (Math.hypot(dx, dy) < 1) return; snap(); hdrag.moved = true; }
      var c = Math.cos(rad(s.rot)), sn = Math.sin(rad(s.rot));
      var lx = (dx * c + dy * sn) / (s.flip ? -s.s : s.s), ly = (-dx * sn + dy * c) / s.s;
      var w = hdrag.orig.map(function (d) { return d.slice(); });
      w[hdrag.k] = [r1(w[hdrag.k][0] + lx), r1(w[hdrag.k][1] + ly)];
      s.warp = w;
      render();
      return;
    }
    if (drawing) {
      var p = svgPt(e), last = drawing[drawing.length - 1];
      if (Math.hypot(p[0] - last[0], p[1] - last[1]) < 1.5) return;
      drawing.push(p);
      var d = ringD(outlinePts(smooth(resample(drawing, 2.5), 2), ui.brushW, ui.brushP));
      var cut = ui.newOp === 'cut';
      var attr = cut ? 'fill="rgba(143,196,255,0.2)" stroke="#8fc4ff" stroke-dasharray="4 3" vector-effect="non-scaling-stroke"' : 'fill="' + (doc.st.byKaku ? KAKU_COL[ui.newKaku] : doc.st.color) + '" opacity="0.85"';
      $('live').innerHTML = '<path d="' + d + '" ' + attr + '/>' + (ui.newMirror ? '<path transform="translate(400 0) scale(-1 1)" d="' + d + '" ' + attr + '/>' : '');
      return;
    }
    if (!drag) return;
    var q2 = svgPt(e), ddx = q2[0] - drag.p[0], ddy = q2[1] - drag.p[1];
    if (!drag.moved) { if (Math.hypot(ddx, ddy) < 2) return; snap(); drag.moved = true; }
    drag.origs.forEach(function (o) { o.s.x = o.x + (drag.side ? -ddx : ddx); o.s.y = o.y + ddy; });
    render();
  });
  function endPointer() {
    if (drawing) {
      var raw = drawing; drawing = null;
      var pts = resample(smooth(resample(raw, 2), 4), 3);
      var len = 0; for (var i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      if (pts.length < 3 || len < 12) { $('live').innerHTML = ''; return; }
      var b = mpBBox([[pts]]), cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2;
      snap();
      var s = { id: 's' + (nextId++), kind: 'stroke', op: ui.newOp, pts: pts.map(function (q) { return [r1(q[0] - cx), r1(q[1] - cy)]; }), prof: ui.brushP, w: ui.brushW, x: cx, y: cy, rot: 0, s: 1, flip: false, mirror: ui.newMirror, kaku: ui.newKaku, warp: null };
      doc.shapes.push(s); setSel([s.id]);
      render();
    }
    drag = null; hdrag = null;
  }
  cv.addEventListener('pointerup', endPointer);
  cv.addEventListener('pointercancel', endPointer);

  /* ツールバー */
  $('m-select').onclick = function () { ui.mode = 'select'; syncUI(); };
  $('m-draw').onclick = function () { ui.mode = 'draw'; ui.warp = false; render(); };
  $('multi').onclick = function () { ui.multi = !ui.multi; ui.mode = 'select'; syncUI(); };
  function restoreDoc(json) { doc = JSON.parse(json); setSel(ui.sel.filter(function (id) { return find(id); })); render(); }
  function undo() { if (!hist.length) return; var r = redo; r.push(JSON.stringify(doc)); var j = hist.pop(); redo = r; restoreDoc(j); }
  function doRedo() { if (!redo.length) return; hist.push(JSON.stringify(doc)); var r = redo, j = r.pop(); restoreDoc(j); redo = r; syncUI(); }
  $('undo').onclick = undo;
  $('redo').onclick = doRedo;
  var clearArm = 0;
  $('clear').onclick = function () {
    if (!clearArm) {
      $('clear').textContent = 'もう一度押すと消去';
      clearArm = setTimeout(function () { clearArm = 0; $('clear').textContent = '全て消す'; }, 3000);
      return;
    }
    clearTimeout(clearArm); clearArm = 0; $('clear').textContent = '全て消す';
    snap(); doc.shapes = []; doc.cleared = true; setSel([]); render();
  };
  $('loaddef').onclick = function () { snap(); doc.shapes = sampleShapes(); doc.cleared = false; ui.used = [false, false, false]; setSel([]); render(); };
  $('use').onclick = function () { for (var k = 2; k >= 0; k--) if (!ui.used[k]) { ui.used[k] = true; break; } render(); };
  $('restore').onclick = function () { ui.used = [false, false, false]; render(); };

  /* 新しい形の設定 */
  $('newop').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; ui.newOp = b.dataset.op; syncUI(); });
  $('newkaku').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; ui.newKaku = +b.dataset.k; syncUI(); });
  $('newmirror').onchange = function () { ui.newMirror = this.checked; };
  $('brushw').oninput = function () { ui.brushW = +this.value; $('brushw-o').textContent = this.value; };
  $('brushp').onchange = function () { ui.brushP = this.value; };

  /* 選んだ形（ひとつ） */
  var txn = false;
  function live(id, fn) {
    $(id).addEventListener('input', function () { var s = one(); if (!s) return; if (!txn) { snap(); txn = true; } fn(s, +this.value); render(); });
    $(id).addEventListener('change', function () { txn = false; syncUI(); });
  }
  live('p-rot', function (s, v) { s.rot = v; });
  live('p-size', function (s, v) { s.s = v; });
  live('p-w', function (s, v) { s.w = v; });
  function edit(fn) { var s = one(); if (!s) return; snap(); fn(s); render(); }
  $('p-op').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; edit(function (s) { s.op = b.dataset.op; }); });
  $('p-kaku').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; edit(function (s) { s.kaku = +b.dataset.k; }); });
  $('p-prof').onchange = function () { var v = this.value; edit(function (s) { s.prof = v; }); };
  $('p-mirror').onchange = function () { var v = this.checked; edit(function (s) { s.mirror = v; }); };
  $('p-flip').onclick = function () { edit(function (s) { s.flip = !s.flip; }); };
  $('p-warp').onclick = function () { ui.warp = !ui.warp; ui.mode = 'select'; render(); };
  $('p-unwarp').onclick = function () { edit(function (s) { s.warp = null; }); };
  function dup() {
    var ss = selShapes(); if (!ss.length) return; snap();
    var ids = ss.map(function (s) { var c = JSON.parse(JSON.stringify(s)); c.id = 's' + (nextId++); c.x += 14; c.y += 14; doc.shapes.push(c); return c.id; });
    setSel(ids); render();
  }
  $('p-dup').onclick = dup; $('m-dup').onclick = dup;
  function move(dir) {
    var s = one(); if (!s) return;
    var i = doc.shapes.indexOf(s), j = dir > 0 ? doc.shapes.length - 1 : 0; if (i === j) return;
    snap(); doc.shapes.splice(i, 1);
    if (dir > 0) doc.shapes.push(s); else doc.shapes.unshift(s);
    render();
  }
  $('p-front').onclick = function () { move(1); };
  $('p-back').onclick = function () { move(-1); };
  function del() { if (!ui.sel.length) return; snap(); doc.shapes = doc.shapes.filter(function (s) { return ui.sel.indexOf(s.id) < 0; }); setSel([]); render(); }
  $('p-del').onclick = del; $('m-del').onclick = del;
  $('p-desel').onclick = $('m-desel').onclick = function () { setSel([]); render(); };

  /* 選んだ形（複数） */
  $('m-kaku').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b || !ui.sel.length) return;
    snap(); selShapes().forEach(function (s) { s.kaku = +b.dataset.k; }); render();
  });
  $('merge').onclick = function () {
    var ss = selShapes(); if (ss.length < 2 || !PC) return;
    var allMirror = ss.every(function (s) { return s.mirror; });
    var adds = [], cuts = [];
    ss.forEach(function (s) { var g = worldGeom(s), mp = allMirror ? g.orig : g.orig.concat(g.mir || []); (s.op === 'cut' ? cuts : adds).push(mp); });
    var res;
    try {
      res = PC.union.apply(null, adds.length ? adds : cuts);
      if (adds.length && cuts.length) res = PC.difference.apply(null, [res].concat(cuts));
    } catch (err) { $('mergemsg').textContent = 'この組み合わせは合体できませんでした。形を少し動かしてから試してください。'; return; }
    if (!res.length) { $('mergemsg').textContent = '消しゴムで全部消えてしまうため、合体できません。'; return; }
    var b = mpBBox(res), cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2;
    var firstAdd = ss.filter(function (s) { return s.op !== 'cut'; })[0];
    var m = { id: 's' + (nextId++), kind: 'merged', op: adds.length ? 'add' : 'cut', geom: mapMP(res, function (p) { return [r1(p[0] - cx), r1(p[1] - cy)]; }),
      x: cx, y: cy, rot: 0, s: 1, flip: false, mirror: allMirror, kaku: firstAdd ? firstAdd.kaku : 1, warp: null };
    snap();
    var last = -1;
    doc.shapes.forEach(function (s, i) { if (ui.sel.indexOf(s.id) >= 0) last = i; });
    var out = [];
    doc.shapes.forEach(function (s, i) { if (ui.sel.indexOf(s.id) < 0) out.push(s); if (i === last) out.push(m); });
    doc.shapes = out; setSel([m.id]);
    $('mergemsg').textContent = '';
    render();
  };

  document.addEventListener('keydown', function (e) {
    var tag = (e.target.tagName || '').toLowerCase();
    var typing = (tag === 'input' && e.target.type === 'text') || tag === 'textarea';
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { if (typing) return; e.preventDefault(); if (e.shiftKey) doRedo(); else undo(); return; }
    if (typing || tag === 'select' || tag === 'input') return;
    if (!ui.sel.length) return;
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); del(); return; }
    if (e.key === 'Escape') { setSel([]); render(); return; }
    var step = e.shiftKey ? 10 : 1, mv = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (mv) { e.preventDefault(); snap(); selShapes().forEach(function (s) { s.x += mv[0]; s.y += mv[1]; }); render(); }
  });

  /* 仕上げ */
  var sw = $('swatches');
  COLORS.forEach(function (c) { sw.insertAdjacentHTML('beforeend', '<button type="button" class="sw" data-c="' + c[1] + '" title="' + c[0] + '" aria-label="' + c[0] + '" style="background:' + c[1] + '"></button>'); });
  sw.insertAdjacentHTML('beforeend', '<input id="custom" type="color" value="#d4202b" aria-label="好きな色を選ぶ">');
  sw.addEventListener('click', function (e) { var b = e.target.closest('.sw'); if (!b) return; doc.st.color = b.dataset.c; render(); });
  $('custom').addEventListener('input', function () { doc.st.color = this.value; render(); });
  $('bgseg').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; doc.st.bg = b.dataset.bg; render(); });
  $('glowseg').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; doc.st.glow = +b.dataset.g; render(); });
  $('outline').onchange = function () { doc.st.outline = this.checked; render(); };
  $('texture').onchange = function () { doc.st.texture = this.checked; render(); };
  $('guides').onchange = function () { ui.guides = this.checked; render(); };
  $('showcuts').onchange = function () { ui.showCuts = this.checked; render(); };
  $('bykaku').onchange = function () { doc.st.byKaku = this.checked; render(); };
  $('dname').oninput = function () { doc.st.name = this.value; persist(); };

  /* 書き出し */
  var dl = null;
  function msg(t) { $('msg').textContent = t; }
  function fileBase() { return ((doc.st.name || '').trim() || '令呪').replace(/[\\/:*?"<>|]/g, '_'); }
  function exportSVG() {
    var st = { color: doc.st.color, glow: glowLevel(doc.st), outline: doc.st.outline !== false, texture: doc.st.texture !== false, byKaku: false };
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="1200" height="1200">' + bgMarkup(doc.st.bg, false) + sealMarkup(doc.shapes, st, { screen: false }) + '</svg>';
  }
  function toPNG() {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () {
        var c = document.createElement('canvas'); c.width = c.height = 1200;
        c.getContext('2d').drawImage(img, 0, 0, 1200, 1200);
        c.toBlob(function (b) { if (b) resolve(b); else reject(new Error('png')); }, 'image/png');
      };
      img.onerror = reject;
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(exportSVG());
    });
  }
  function showPreview(blob) {
    var pv = $('preview');
    pv.innerHTML = '<img alt="書き出した令呪" src="' + URL.createObjectURL(blob) + '"><p class="hint">画像を長押し、または右クリックして保存できます。</p>';
    pv.hidden = false;
  }
  function save(filename, data, blobForPreview) {
    if (!dl) {
      try {
        var url = URL.createObjectURL(data instanceof Blob ? data : new Blob([data]));
        var a = document.createElement('a');
        a.href = url; a.download = filename;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
        msg(filename + ' を保存しました。');
      } catch (e) {
        if (blobForPreview) { showPreview(blobForPreview); msg('直接保存できないため、下に画像を表示しました。'); }
        else msg('直接保存できません。「SVGのコードをコピー」を使ってください。');
      }
      return;
    }
    msg('保存の確認を表示しています…');
    dl.save({ filename: filename, data: data }).then(function () { msg(filename + ' を保存しました。'); }, function (err) {
      var code = err && err.code;
      if (code === 'declined') msg('保存を取りやめました。');
      else if (code === 'rate_limited') msg('保存の確認がまだ開いています。閉じてからもう一度押してください。');
      else { if (blobForPreview) showPreview(blobForPreview); msg('保存できませんでした。' + (blobForPreview ? '下の画像を長押しか右クリックで保存してください。' : '')); }
    });
  }
  $('x-png').onclick = function () { toPNG().then(function (b) { save(fileBase() + '.png', b, b); }, function () { msg('PNGを作れませんでした。SVGで保存してください。'); }); };
  $('x-svg').onclick = function () { save(fileBase() + '.svg', new Blob([exportSVG()], { type: 'image/svg+xml' })); };
  $('x-copy').onclick = function () {
    var text = exportSVG();
    var fallback = function () {
      var pv = $('preview');
      pv.innerHTML = '<textarea id="svgtext" readonly></textarea><p class="hint">コードを選択しました。コピーして使ってください。</p>';
      pv.hidden = false; $('svgtext').value = text; $('svgtext').select(); msg('');
    };
    try { navigator.clipboard.writeText(text).then(function () { msg('SVGのコードをコピーしました。'); }, fallback); } catch (e) { fallback(); }
  };

  if (!PC) $('mergemsg').textContent = '図形を合成する部品を読み込めなかったため、消しゴムと合体は使えません。ページを開き直してください。';
  render();
  try { if (window.claude && window.claude.use) window.claude.use('downloads').then(function (d) { dl = d; }, function () {}); } catch (e) {}
})();
