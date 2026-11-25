/*
 * Hero animation: Hodge decomposition of an edge flow on a cell complex
 * drawn inside a sagittal brain silhouette.
 *
 *   f = B1^T phi  (gradient: node potentials, non-zero divergence)
 *     + B2 psi    (curl: circulation around triangles and polygons)
 *     + h         (harmonic: flow around the holes, divergence- and curl-free)
 *
 * plus its divergence B1 f, which marks the sources (+, expanding ripples) and
 * sinks (−, contracting ripples) of the flow at the nodes.
 *
 * The three components are computed exactly from the incidence matrices of the
 * complex, so faces only light up when the flow has curl and nodes only glow
 * when it has divergence.
 */
(function () {
  "use strict";

  var root = document.querySelector("[data-hero-complex]");
  if (!root) return;
  var canvas = root.querySelector("canvas");
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext("2d");

  var W = 340;
  var H = 260;
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------------------------------------------------------------- utils */

  function mulberry32(seed) {
    return function () {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  var rand = mulberry32(20261124);

  function dist(a, b) {
    return Math.hypot(a[0] - b[0], a[1] - b[1]);
  }

  // Catmull-Rom spline through the points, as a Path2D
  function smoothPath(pts, closed) {
    var p = new Path2D();
    var n = pts.length;
    function at(i) {
      if (closed) return pts[(i + n) % n];
      return pts[Math.max(0, Math.min(n - 1, i))];
    }
    p.moveTo(pts[0][0], pts[0][1]);
    var last = closed ? n : n - 1;
    for (var i = 0; i < last; i++) {
      var p0 = at(i - 1),
        p1 = at(i),
        p2 = at(i + 1),
        p3 = at(i + 2);
      p.bezierCurveTo(
        p1[0] + (p2[0] - p0[0]) / 6,
        p1[1] + (p2[1] - p0[1]) / 6,
        p2[0] - (p3[0] - p1[0]) / 6,
        p2[1] - (p3[1] - p1[1]) / 6,
        p2[0],
        p2[1]
      );
    }
    if (closed) p.closePath();
    return p;
  }

  /* -------------------------------------------------------- brain shape */

  // Lateral (sagittal) view of the left hemisphere, frontal pole on the left.
  // Cerebrum with a temporal pole under the Sylvian notch; cerebellum and brainstem below.
  var CEREBRUM = [
    [56, 153],
    [38, 140],
    [31, 118],
    [35, 92],
    [48, 68],
    [68, 49],
    [95, 34],
    [128, 24],
    [164, 19],
    [200, 21],
    [235, 30],
    [265, 47],
    [289, 71],
    [305, 101],
    [311, 130],
    [304, 153],
    [287, 168],
    [262, 175],
    [236, 178],
    [214, 184],
    [190, 194],
    [162, 199],
    [133, 198],
    [108, 192],
    [89, 182],
    [80, 171],
    [84, 162],
    [72, 158],
  ];
  // cerebellum and brainstem are tucked under the cerebrum (overlap hidden when drawn)
  var CEREBELLUM = [
    [222, 176],
    [250, 167],
    [280, 162],
    [301, 171],
    [309, 190],
    [299, 210],
    [274, 222],
    [247, 221],
    [228, 210],
    [218, 194],
  ];
  var BRAINSTEM = [
    [188, 184],
    [214, 182],
    [225, 198],
    [224, 220],
    [217, 242],
    [208, 257],
    [196, 256],
    [194, 236],
    [184, 216],
    [181, 198],
  ];
  // Main sulci (central, pre/postcentral, Sylvian, frontal, parietal, temporal, occipital)
  var SULCI = [
    [
      [178, 21],
      [170, 50],
      [176, 78],
      [162, 108],
      [156, 130],
    ],
    [
      [150, 24],
      [142, 54],
      [146, 82],
      [134, 112],
      [128, 136],
    ],
    [
      [204, 23],
      [198, 54],
      [202, 82],
      [190, 110],
      [182, 134],
    ],
    [
      [86, 170],
      [126, 156],
      [168, 146],
      [206, 136],
      [232, 128],
    ],
    [
      [206, 136],
      [218, 150],
      [214, 164],
    ],
    [
      [58, 70],
      [88, 58],
      [118, 50],
      [140, 44],
    ],
    [
      [44, 110],
      [74, 100],
      [104, 96],
      [130, 94],
    ],
    [
      [208, 80],
      [238, 88],
      [266, 104],
      [292, 118],
    ],
    [
      [236, 40],
      [244, 62],
      [262, 72],
    ],
    [
      [110, 182],
      [148, 176],
      [186, 168],
      [222, 158],
      [252, 152],
    ],
    [
      [282, 72],
      [288, 98],
      [300, 120],
    ],
  ];

  // Catmull-Rom samples, used to give the sulci a gyral wiggle
  function sampleSpline(pts, perSeg) {
    var out = [];
    var n = pts.length;
    function at(i) {
      return pts[Math.max(0, Math.min(n - 1, i))];
    }
    for (var i = 0; i < n - 1; i++) {
      var p0 = at(i - 1),
        p1 = at(i),
        p2 = at(i + 1),
        p3 = at(i + 2);
      for (var s = 0; s < perSeg; s++) {
        var t = s / perSeg,
          t2 = t * t,
          t3 = t2 * t;
        out.push(
          [0, 1].map(function (k) {
            return (
              0.5 *
              (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3)
            );
          })
        );
      }
    }
    out.push(pts[n - 1].slice());
    return out;
  }
  function wigglyPath(pts, amp, wavelength, phase) {
    var d = sampleSpline(pts, 14);
    var len = 0;
    for (var i = 1; i < d.length; i++) len += dist(d[i - 1], d[i]);
    var p = new Path2D();
    var s = 0;
    for (var j = 0; j < d.length; j++) {
      if (j > 0) s += dist(d[j - 1], d[j]);
      var a = d[Math.max(0, j - 1)],
        b = d[Math.min(d.length - 1, j + 1)];
      var tl = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      var nx = -(b[1] - a[1]) / tl,
        ny = (b[0] - a[0]) / tl;
      var taper = Math.sin((Math.PI * s) / len);
      var off = amp * taper * Math.sin((2 * Math.PI * s) / wavelength + phase);
      var x = d[j][0] + nx * off,
        y = d[j][1] + ny * off;
      if (j === 0) p.moveTo(x, y);
      else p.lineTo(x, y);
    }
    return p;
  }

  var brain = smoothPath(CEREBRUM, true);
  var outsideBrain = new Path2D();
  outsideBrain.rect(-20, -20, W + 40, H + 40);
  outsideBrain.addPath(brain);
  var cerebellum = smoothPath(CEREBELLUM, true);
  var brainstem = smoothPath(BRAINSTEM, true);
  var sulci = SULCI.map(function (s, i) {
    return wigglyPath(s, 1.8, 16 + (i % 3) * 3, i * 1.7);
  });

  var probe = document.createElement("canvas").getContext("2d");
  function inside(x, y) {
    return probe.isPointInPath(brain, x, y);
  }
  function insideInset(x, y, r) {
    if (!inside(x, y)) return false;
    for (var k = 0; k < 8; k++) {
      var a = (k * Math.PI) / 4;
      if (!inside(x + r * Math.cos(a), y + r * Math.sin(a))) return false;
    }
    return true;
  }

  /* ------------------------------------------------------- the complex */

  // Nodes: Poisson-disk-like sampling inside the silhouette
  var P = [];
  for (var tries = 0; P.length < 36 && tries < 8000; tries++) {
    var cand = [30 + rand() * 280, 20 + rand() * 230];
    if (!insideInset(cand[0], cand[1], 10)) continue;
    var ok = true;
    for (var q = 0; q < P.length; q++) {
      if (dist(P[q], cand) < 30) {
        ok = false;
        break;
      }
    }
    if (ok) P.push(cand);
  }
  var N = P.length;

  // Delaunay triangulation (Bowyer-Watson)
  function circumcircle(A, B, C) {
    var d = 2 * (A[0] * (B[1] - C[1]) + B[0] * (C[1] - A[1]) + C[0] * (A[1] - B[1]));
    var a2 = A[0] * A[0] + A[1] * A[1];
    var b2 = B[0] * B[0] + B[1] * B[1];
    var c2 = C[0] * C[0] + C[1] * C[1];
    var ux = (a2 * (B[1] - C[1]) + b2 * (C[1] - A[1]) + c2 * (A[1] - B[1])) / d;
    var uy = (a2 * (C[0] - B[0]) + b2 * (A[0] - C[0]) + c2 * (B[0] - A[0])) / d;
    return [ux, uy, (A[0] - ux) * (A[0] - ux) + (A[1] - uy) * (A[1] - uy)];
  }
  function delaunay(pts) {
    var all = pts.concat([
      [-2000, -2000],
      [2400, -2000],
      [170, 2600],
    ]);
    var n = pts.length;
    var tris = [[n, n + 1, n + 2]];
    for (var i = 0; i < n; i++) {
      var p = all[i];
      var keep = [];
      var edges = {};
      for (var t = 0; t < tris.length; t++) {
        var T = tris[t];
        var c = circumcircle(all[T[0]], all[T[1]], all[T[2]]);
        if ((p[0] - c[0]) * (p[0] - c[0]) + (p[1] - c[1]) * (p[1] - c[1]) < c[2]) {
          for (var k = 0; k < 3; k++) {
            var a = T[k],
              b = T[(k + 1) % 3];
            var key = Math.min(a, b) + "-" + Math.max(a, b);
            if (edges[key]) edges[key].count++;
            else edges[key] = { a: a, b: b, count: 1 };
          }
        } else keep.push(T);
      }
      Object.keys(edges).forEach(function (key) {
        var e = edges[key];
        if (e.count === 1) keep.push([e.a, e.b, i]);
      });
      tris = keep;
    }
    return tris.filter(function (T) {
      return T[0] < n && T[1] < n && T[2] < n;
    });
  }

  function area2(cycle) {
    var s = 0;
    for (var i = 0; i < cycle.length; i++) {
      var a = P[cycle[i]],
        b = P[cycle[(i + 1) % cycle.length]];
      s += a[0] * b[1] - b[0] * a[1];
    }
    return s;
  }
  function minAngle(T) {
    var m = Math.PI;
    for (var k = 0; k < 3; k++) {
      var A = P[T[k]],
        B = P[T[(k + 1) % 3]],
        C = P[T[(k + 2) % 3]];
      var v1 = [B[0] - A[0], B[1] - A[1]],
        v2 = [C[0] - A[0], C[1] - A[1]];
      var ang = Math.acos(Math.max(-1, Math.min(1, (v1[0] * v2[0] + v1[1] * v2[1]) / (Math.hypot(v1[0], v1[1]) * Math.hypot(v2[0], v2[1])))));
      m = Math.min(m, ang);
    }
    return m;
  }
  function edgeInside(a, b) {
    for (var s = 1; s < 4; s++) {
      var t = s / 4;
      if (!inside(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)) return false;
    }
    return true;
  }

  var tris = delaunay(P).filter(function (T) {
    for (var k = 0; k < 3; k++) {
      var a = P[T[k]],
        b = P[T[(k + 1) % 3]];
      if (dist(a, b) > 72 || !edgeInside(a, b)) return false;
    }
    return minAngle(T) > 0.3;
  });
  // Orient every triangle visually clockwise (positive area with y pointing down)
  tris.forEach(function (T) {
    if (area2(T) < 0) T.reverse();
  });

  // Merge triangle pairs/triples into quadrilaterals and pentagons (2-cells of a cell complex)
  var faces = tris.map(function (T) {
    return { v: T.slice(), alive: true, merged: 0 };
  });
  function findNeighbour(F) {
    for (var k = 0; k < F.v.length; k++) {
      var a = F.v[k],
        b = F.v[(k + 1) % F.v.length];
      for (var g = 0; g < faces.length; g++) {
        var G = faces[g];
        if (G === F || !G.alive || G.v.length !== 3 || G.merged) continue;
        var j = G.v.indexOf(b);
        if (j !== -1 && G.v[(j + 1) % 3] === a) {
          var c = G.v[(j + 2) % 3];
          if (F.v.indexOf(c) === -1) return { G: G, at: k, c: c };
        }
      }
    }
    return null;
  }
  var order = faces.map(function (_, i) {
    return i;
  });
  for (var s = order.length - 1; s > 0; s--) {
    var r = Math.floor(rand() * (s + 1));
    var tmp = order[s];
    order[s] = order[r];
    order[r] = tmp;
  }
  order.forEach(function (fi) {
    var F = faces[fi];
    if (!F.alive || F.merged || rand() > 0.5) return;
    var steps = rand() < 0.35 ? 2 : 1;
    for (var st = 0; st < steps; st++) {
      var nb = findNeighbour(F);
      if (!nb) break;
      F.v.splice(nb.at + 1, 0, nb.c);
      nb.G.alive = false;
      F.merged++;
    }
  });
  faces = faces.filter(function (F) {
    return F.alive;
  });

  // Edges of the complex (interior edges of merged cells disappear)
  var E = [];
  var edgeIndex = {};
  var edgeFaces = [];
  faces.forEach(function (F, fi) {
    for (var k = 0; k < F.v.length; k++) {
      var a = F.v[k],
        b = F.v[(k + 1) % F.v.length];
      var key = Math.min(a, b) + "-" + Math.max(a, b);
      if (edgeIndex[key] === undefined) {
        edgeIndex[key] = E.length;
        E.push([Math.min(a, b), Math.max(a, b)]);
        edgeFaces.push([]);
      }
      edgeFaces[edgeIndex[key]].push(fi);
    }
  });
  var M = E.length;

  // Geometry per face: centroid, signed incidences, glyph radius
  faces.forEach(function (F) {
    var cx = 0,
      cy = 0;
    F.v.forEach(function (i) {
      cx += P[i][0];
      cy += P[i][1];
    });
    F.c = [cx / F.v.length, cy / F.v.length];
    F.inc = [];
    var rmin = Infinity;
    for (var k = 0; k < F.v.length; k++) {
      var a = F.v[k],
        b = F.v[(k + 1) % F.v.length];
      F.inc.push([edgeIndex[Math.min(a, b) + "-" + Math.max(a, b)], a < b ? 1 : -1]);
      var A = P[a],
        B = P[b];
      var len = dist(A, B);
      var d = Math.abs((B[0] - A[0]) * (A[1] - F.c[1]) - (A[0] - F.c[0]) * (B[1] - A[1])) / len;
      rmin = Math.min(rmin, d);
    }
    F.r = Math.max(3.5, Math.min(9, rmin * 0.55));
    F.angle = rand() * Math.PI * 2;
    F.phase = F.c[0] * 0.025 + rand() * 1.5;
  });

  // Holes: two interior cells are left unfilled -> non-trivial 1-cycles
  function interior(F) {
    return F.inc.every(function (ie) {
      return edgeFaces[ie[0]].length === 2;
    });
  }
  var holes = [];
  [
    [118, 108],
    [236, 104],
  ].forEach(function (target) {
    var best = null,
      bd = Infinity;
    faces.forEach(function (F) {
      if (F.hole || !interior(F)) return;
      var d = dist(F.c, target);
      if (d < bd) {
        bd = d;
        best = F;
      }
    });
    if (best) {
      best.hole = true;
      holes.push(best);
    }
  });
  var cells = faces.filter(function (F) {
    return !F.hole;
  });
  var K = cells.length;

  /* --------------------------------------------- harmonic component (exact) */

  // h = c - B2 (B2^T B2)^{-1} B2^T c, where c is the boundary cycle of each hole
  function solve(A, b) {
    var n = b.length;
    for (var i = 0; i < n; i++) {
      var piv = i;
      for (var r2 = i + 1; r2 < n; r2++) if (Math.abs(A[r2][i]) > Math.abs(A[piv][i])) piv = r2;
      var t1 = A[i];
      A[i] = A[piv];
      A[piv] = t1;
      var t2 = b[i];
      b[i] = b[piv];
      b[piv] = t2;
      if (Math.abs(A[i][i]) < 1e-12) continue;
      for (var r3 = i + 1; r3 < n; r3++) {
        var f = A[r3][i] / A[i][i];
        if (!f) continue;
        for (var c3 = i; c3 < n; c3++) A[r3][c3] -= f * A[i][c3];
        b[r3] -= f * b[i];
      }
    }
    var x = new Array(n).fill(0);
    for (var i2 = n - 1; i2 >= 0; i2--) {
      if (Math.abs(A[i2][i2]) < 1e-12) continue;
      var sum = b[i2];
      for (var j = i2 + 1; j < n; j++) sum -= A[i2][j] * x[j];
      x[i2] = sum / A[i2][i2];
    }
    return x;
  }
  var cellOfEdge = [];
  for (var e0 = 0; e0 < M; e0++) cellOfEdge.push([]);
  cells.forEach(function (F, k) {
    F.inc.forEach(function (ie) {
      cellOfEdge[ie[0]].push([k, ie[1]]);
    });
  });
  var gram = [];
  for (var k1 = 0; k1 < K; k1++) gram.push(new Array(K).fill(0));
  cellOfEdge.forEach(function (list) {
    list.forEach(function (u) {
      list.forEach(function (v) {
        gram[u[0]][v[0]] += u[1] * v[1];
      });
    });
  });
  var harmonic = new Array(M).fill(0);
  holes.forEach(function (Hf, hi) {
    var cyc = new Array(M).fill(0);
    Hf.inc.forEach(function (ie) {
      cyc[ie[0]] = ie[1];
    });
    var rhs = cells.map(function (F) {
      return F.inc.reduce(function (acc, ie) {
        return acc + ie[1] * cyc[ie[0]];
      }, 0);
    });
    var x = solve(
      gram.map(function (row) {
        return row.slice();
      }),
      rhs
    );
    var w = hi === 0 ? 1 : -0.85;
    for (var e = 0; e < M; e++) {
      var proj = 0;
      cellOfEdge[e].forEach(function (u) {
        proj += u[1] * x[u[0]];
      });
      harmonic[e] += w * (cyc[e] - proj);
    }
  });
  var hMax = Math.max.apply(null, harmonic.map(Math.abs)) || 1;
  harmonic = harmonic.map(function (v) {
    return v / hMax;
  });

  /* --------------------------------------------------------- dynamics */

  var MODES = ["grad", "div", "curl", "harm", "all"];
  var TARGET = {
    grad: [1, 0, 0],
    div: [1, 0, 0],
    curl: [0, 1, 0],
    harm: [0, 0, 1],
    all: [0.8, 0.8, 0.8],
  };
  // how strongly sources / sinks (divergence B1 f) are emphasised in each mode
  var DIV_EMPHASIS = { grad: 0.2, div: 1, curl: 0, harm: 0, all: 0.45 };
  // how strongly the edge signal itself (colour, glow, pulses, arrows) is emphasised
  var EDGE_EMPHASIS = { grad: 1, div: 0.15, curl: 0.4, harm: 0.55, all: 0.55 };
  var MODE_SECONDS = 6;
  var mode = reduceMotion ? "all" : "grad";
  var pinned = reduceMotion;
  var modeClock = 0;
  var weights = TARGET[mode].slice();
  var divEmph = DIV_EMPHASIS[mode];
  var edgeEmph = EDGE_EMPHASIS[mode];
  var nodePhase = P.map(function () {
    return rand();
  });

  var phi = new Array(N).fill(0);
  var psi = new Array(K).fill(0);
  var flow = new Array(M).fill(0);
  var grad = new Array(M).fill(0);
  var curlF = new Array(M).fill(0);
  var dashPhase = new Array(M).fill(0);
  var div = new Array(N).fill(0);
  var curlOf = new Array(K).fill(0);
  var time = 0;

  function normalise(arr) {
    var m = 0;
    for (var i = 0; i < arr.length; i++) m = Math.max(m, Math.abs(arr[i]));
    if (m < 1e-9) return;
    for (var j = 0; j < arr.length; j++) arr[j] /= m;
  }

  function step(dt) {
    time += dt;

    // gradient: two travelling waves of node potential
    for (var v = 0; v < N; v++) {
      var x = P[v][0],
        y = P[v][1];
      phi[v] = Math.sin(0.032 * x - 1.15 * time) + 0.6 * Math.sin(0.04 * y + 0.022 * x + 0.8 * time + 1.3);
    }
    for (var e = 0; e < M; e++) grad[e] = phi[E[e][1]] - phi[E[e][0]];
    normalise(grad);

    // curl: oscillating face potentials pushed onto edges by B2
    for (var k = 0; k < K; k++) psi[k] = Math.sin(1.05 * time + cells[k].phase);
    curlF.fill(0);
    cells.forEach(function (F, k2) {
      F.inc.forEach(function (ie) {
        curlF[ie[0]] += ie[1] * psi[k2];
      });
    });
    normalise(curlF);

    var pulse = 0.85 + 0.15 * Math.sin(0.9 * time);
    for (var e2 = 0; e2 < M; e2++) {
      flow[e2] = weights[0] * grad[e2] + weights[1] * curlF[e2] + weights[2] * pulse * harmonic[e2];
      dashPhase[e2] += flow[e2] * dt * 26;
    }

    // divergence (B1 f) at nodes and curl (B2^T f) on cells
    div.fill(0);
    for (var e3 = 0; e3 < M; e3++) {
      div[E[e3][1]] += flow[e3];
      div[E[e3][0]] -= flow[e3];
    }
    cells.forEach(function (F, k3) {
      var c = 0;
      F.inc.forEach(function (ie) {
        c += ie[1] * flow[ie[0]];
      });
      curlOf[k3] = c / F.inc.length;
      F.angle += curlOf[k3] * dt * 4.5;
    });
  }

  /* --------------------------------------------------------- rendering */

  var POS = [120, 174, 237];
  var NEG = [160, 146, 255];
  var SOURCE = [158, 201, 255];
  var SINK = [176, 160, 255];
  var EDGE_COLD = [96, 150, 230];
  var EDGE_HOT = [228, 242, 255];
  var NAVY = "#0b1b33";

  function rgba(c, a) {
    return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + Math.max(0, a).toFixed(3) + ")";
  }
  function mix(c1, c2, t) {
    return [0, 1, 2].map(function (k) {
      return Math.round(c1[k] + (c2[k] - c1[k]) * t);
    });
  }
  function facePath(F) {
    var p = new Path2D();
    F.v.forEach(function (i, k) {
      if (k === 0) p.moveTo(P[i][0], P[i][1]);
      else p.lineTo(P[i][0], P[i][1]);
    });
    p.closePath();
    return p;
  }
  faces.forEach(function (F) {
    F.path = facePath(F);
  });

  var scale = 1;

  // The brain itself never changes, so it is painted once per size into two layers:
  // a back layer (body, cerebellum, brainstem, gyri) and a front layer (glowing outline).
  var backLayer = null;
  var frontLayer = null;
  function makeLayer() {
    var c = document.createElement("canvas");
    c.width = canvas.width;
    c.height = canvas.height;
    var g = c.getContext("2d");
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    g.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
    g.lineCap = "round";
    g.lineJoin = "round";
    return { c: c, g: g, dpr: dpr };
  }
  function buildBrainLayers() {
    if (!canvas.width) return;
    var B = makeLayer(),
      g = B.g;

    // brainstem with transverse pontine fibres (only the part outside the cerebrum)
    g.save();
    g.clip(outsideBrain, "evenodd");
    g.fillStyle = "rgba(53,132,228,0.09)";
    g.fill(brainstem);
    g.save();
    g.clip(brainstem);
    g.strokeStyle = "rgba(158,201,255,0.13)";
    g.lineWidth = 0.8;
    for (var yy = 204; yy < 252; yy += 5.5) {
      g.beginPath();
      g.moveTo(186, yy);
      g.quadraticCurveTo(208, yy + 4, 232, yy);
      g.stroke();
    }
    g.restore();

    // cerebellum with folia
    var cg = g.createRadialGradient(266, 204, 4, 266, 204, 46);
    cg.addColorStop(0, "rgba(130,140,255,0.18)");
    cg.addColorStop(1, "rgba(53,132,228,0.05)");
    g.fillStyle = cg;
    g.fill(cerebellum);
    g.save();
    g.clip(cerebellum);
    g.strokeStyle = "rgba(176,170,255,0.24)";
    g.lineWidth = 0.9;
    for (var r = 8; r <= 60; r += 5.5) {
      g.beginPath();
      g.arc(266, 238, r, Math.PI * 1.02, Math.PI * 1.98);
      g.stroke();
    }
    g.restore();
    g.restore(); // outsideBrain clip

    // cerebrum: soft body with depth
    var rg = g.createRadialGradient(150, 92, 8, 170, 112, 175);
    rg.addColorStop(0, "rgba(80,150,240,0.17)");
    rg.addColorStop(0.65, "rgba(53,132,228,0.07)");
    rg.addColorStop(1, "rgba(53,132,228,0.03)");
    g.fillStyle = rg;
    g.fill(brain);

    // gyri: each sulcus is a dark groove with a faint highlight on its lip
    g.save();
    g.clip(brain);
    sulci.forEach(function (s) {
      g.strokeStyle = "rgba(4,12,30,0.4)";
      g.lineWidth = 2.8;
      g.stroke(s);
      g.strokeStyle = "rgba(158,201,255,0.2)";
      g.lineWidth = 0.9;
      g.stroke(s);
    });
    // inner rim light
    g.strokeStyle = "rgba(158,201,255,0.09)";
    g.lineWidth = 8;
    g.stroke(brain);
    g.restore();
    backLayer = B.c;

    var Fl = makeLayer(),
      f = Fl.g;
    var lg = f.createLinearGradient(30, 0, 312, 0);
    lg.addColorStop(0, "rgba(158,201,255,0.9)");
    lg.addColorStop(0.5, "rgba(130,176,255,0.8)");
    lg.addColorStop(1, "rgba(186,168,255,0.9)");
    f.shadowColor = "rgba(120,174,237,0.8)";
    f.shadowBlur = 9 * Fl.dpr * scale;
    f.strokeStyle = lg;
    f.lineWidth = 1.6;
    f.stroke(brain);
    // cerebellum / brainstem outlines only outside the cerebrum, so they read as tucked under it
    f.save();
    f.clip(outsideBrain, "evenodd");
    f.lineWidth = 1.2;
    f.stroke(cerebellum);
    f.stroke(brainstem);
    f.restore();
    f.shadowBlur = 0;
    f.strokeStyle = "rgba(235,244,255,0.35)";
    f.lineWidth = 0.6;
    f.stroke(brain);
    frontLayer = Fl.c;
  }

  function edgeLine(e) {
    ctx.beginPath();
    ctx.moveTo(P[E[e][0]][0], P[E[e][0]][1]);
    ctx.lineTo(P[E[e][1]][0], P[E[e][1]][1]);
  }

  function draw() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (backLayer) ctx.drawImage(backLayer, 0, 0);
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // 2-cells coloured by the curl of the current flow
    var cMax = 0;
    for (var k = 0; k < K; k++) cMax = Math.max(cMax, Math.abs(curlOf[k]));
    cMax = Math.max(cMax, 0.35);
    cells.forEach(function (F, k2) {
      var c = curlOf[k2] / cMax;
      ctx.fillStyle = rgba(c >= 0 ? POS : NEG, 0.07 + 0.42 * Math.abs(c));
      ctx.fill(F.path);
    });

    // holes: glow while the harmonic component is visible
    holes.forEach(function (Hf) {
      var g = ctx.createRadialGradient(Hf.c[0], Hf.c[1], 0, Hf.c[0], Hf.c[1], 26);
      g.addColorStop(0, "rgba(230,240,255," + (0.22 * weights[2]).toFixed(3) + ")");
      g.addColorStop(1, "rgba(230,240,255,0)");
      ctx.fillStyle = g;
      ctx.fill(Hf.path);
      if (weights[2] > 0.05) {
        ctx.strokeStyle = "rgba(230,240,255," + (0.45 * weights[2]).toFixed(3) + ")";
        ctx.lineWidth = 1.4;
        ctx.stroke(Hf.path);
      }
    });

    /* ---- edge signals: colour, width, glow, travelling pulses and arrows encode f */
    var dimEdges = 1 - 0.55 * divEmph;
    ctx.setLineDash([]);
    ctx.strokeStyle = rgba([158, 201, 255], 0.2 * (1 - 0.3 * divEmph));
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (var e = 0; e < M; e++) {
      ctx.moveTo(P[E[e][0]][0], P[E[e][0]][1]);
      ctx.lineTo(P[E[e][1]][0], P[E[e][1]][1]);
    }
    ctx.stroke();

    // glow around strong signals
    if (edgeEmph > 0.05) {
      for (var eg = 0; eg < M; eg++) {
        var mg = Math.min(1, Math.abs(flow[eg]));
        if (mg < 0.2) continue;
        ctx.strokeStyle = rgba(EDGE_HOT, 0.18 * mg * edgeEmph * dimEdges);
        ctx.lineWidth = 2 + 6 * mg * edgeEmph;
        edgeLine(eg);
        ctx.stroke();
      }
    }

    // signal strokes: colour and width grow with |f|
    for (var es = 0; es < M; es++) {
      var ms = Math.min(1, Math.abs(flow[es]));
      if (ms < 0.04) continue;
      ctx.strokeStyle = rgba(mix(EDGE_COLD, EDGE_HOT, ms), (0.15 + 0.5 * ms) * (0.5 + 0.5 * edgeEmph) * dimEdges);
      ctx.lineWidth = 0.7 + (0.6 + 1.6 * edgeEmph) * ms;
      edgeLine(es);
      ctx.stroke();
    }

    // travelling pulses (dashes that become dots when edges are emphasised)
    var dashLen = 4 * (1 - edgeEmph) + 0.1;
    ctx.setLineDash([dashLen, 9 - 1.5 * edgeEmph]);
    for (var ep = 0; ep < M; ep++) {
      var mp = Math.min(1, Math.abs(flow[ep]));
      if (mp < 0.04) continue;
      ctx.strokeStyle = rgba(mix([158, 201, 255], EDGE_HOT, mp * edgeEmph), (0.25 + 0.75 * mp) * dimEdges);
      ctx.lineWidth = 0.9 + (1.4 + 1.2 * edgeEmph) * mp;
      ctx.lineDashOffset = -dashPhase[ep];
      edgeLine(ep);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // direction arrows at mid-edge
    if (edgeEmph > 0.2) {
      for (var ea = 0; ea < M; ea++) {
        var ma = Math.min(1, Math.abs(flow[ea]));
        if (ma < 0.3) continue;
        var A = P[E[ea][0]],
          Bp = P[E[ea][1]];
        var len = dist(A, Bp);
        var sgn = flow[ea] > 0 ? 1 : -1;
        var ux = ((Bp[0] - A[0]) / len) * sgn,
          uy = ((Bp[1] - A[1]) / len) * sgn;
        var mx = (A[0] + Bp[0]) / 2,
          my = (A[1] + Bp[1]) / 2;
        var hs = 2.6 + 3.2 * ma;
        ctx.fillStyle = rgba(EDGE_HOT, edgeEmph * (0.35 + 0.65 * ma) * dimEdges);
        ctx.beginPath();
        ctx.moveTo(mx + ux * hs, my + uy * hs);
        ctx.lineTo(mx - ux * hs * 0.7 - uy * hs * 0.75, my - uy * hs * 0.7 + ux * hs * 0.75);
        ctx.lineTo(mx - ux * hs * 0.7 + uy * hs * 0.75, my - uy * hs * 0.7 - ux * hs * 0.75);
        ctx.closePath();
        ctx.fill();
      }
    }

    // rotating arrows inside the cells (sense and speed = curl)
    cells.forEach(function (F, k3) {
      var c = curlOf[k3] / cMax;
      var a = Math.abs(c);
      if (a < 0.12) return;
      var span = 4.2;
      var start = F.angle,
        end = F.angle + span;
      ctx.strokeStyle = rgba(c >= 0 ? [214, 232, 255] : [222, 214, 255], 0.2 + 0.7 * a);
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.arc(F.c[0], F.c[1], F.r, start, end);
      ctx.stroke();
      var tip = c >= 0 ? end : start;
      var dir = c >= 0 ? tip + Math.PI / 2 : tip - Math.PI / 2;
      var tx = F.c[0] + F.r * Math.cos(tip),
        ty = F.c[1] + F.r * Math.sin(tip);
      var hs2 = 2.6;
      ctx.fillStyle = ctx.strokeStyle;
      ctx.beginPath();
      ctx.moveTo(tx + hs2 * Math.cos(dir), ty + hs2 * Math.sin(dir));
      ctx.lineTo(tx + hs2 * Math.cos(dir + 2.5), ty + hs2 * Math.sin(dir + 2.5));
      ctx.lineTo(tx + hs2 * Math.cos(dir - 2.5), ty + hs2 * Math.sin(dir - 2.5));
      ctx.closePath();
      ctx.fill();
    });

    /* ---- node signals: divergence B1 f.
       Sources (net outflow): "+", stems pointing up, expanding ripples.
       Sinks (net inflow): "−", stems pointing down, contracting ripples. */
    var dMax = 0;
    for (var v = 0; v < N; v++) dMax = Math.max(dMax, Math.abs(div[v]));
    dMax = Math.max(dMax, 0.6);
    var outv = new Array(N);
    for (var v1 = 0; v1 < N; v1++) outv[v1] = -div[v1] / dMax;

    for (var v2 = 0; v2 < N; v2++) {
      var x = P[v2][0],
        y = P[v2][1];
      var out = outv[v2];
      var a2 = Math.min(1, Math.abs(out));
      if (a2 < 0.08) continue;
      var col = out >= 0 ? SOURCE : SINK;

      ctx.fillStyle = rgba(col, (0.2 + 0.25 * divEmph) * a2);
      ctx.beginPath();
      ctx.arc(x, y, 3 + (5 + 4 * divEmph) * a2, 0, Math.PI * 2);
      ctx.fill();

      if (divEmph > 0.05 && a2 > 0.2) {
        ctx.lineWidth = 1;
        for (var ring = 0; ring < 3; ring++) {
          var fr = (time * 0.6 + ring / 3 + nodePhase[v2]) % 1;
          var grow = out >= 0 ? fr : 1 - fr;
          ctx.strokeStyle = rgba(col, divEmph * a2 * (out >= 0 ? 1 - fr : fr) * 0.8);
          ctx.beginPath();
          ctx.arc(x, y, 3.5 + 17 * a2 * grow, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      // graph-signal stem plot: height = divergence at the node
      if (divEmph > 0.05) {
        var h = 32 * out * divEmph;
        ctx.strokeStyle = rgba(col, divEmph * (0.45 + 0.55 * a2));
        ctx.lineWidth = 1.7;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y - h);
        ctx.stroke();
        ctx.fillStyle = rgba(mix(col, [240, 246, 255], 0.4), divEmph * (0.45 + 0.55 * a2));
        ctx.beginPath();
        ctx.arc(x, y - h, 1.8 + 2 * a2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    for (var v3 = 0; v3 < N; v3++) {
      var x3 = P[v3][0],
        y3 = P[v3][1];
      var o3 = outv[v3];
      var a3 = Math.min(1, Math.abs(o3));
      var rn = 2.4 + 3 * divEmph * a3;
      ctx.fillStyle = a3 > 0.08 && divEmph > 0.3 ? rgba(mix([240, 246, 255], o3 >= 0 ? SOURCE : SINK, 0.35 * a3), 1) : "#e6f0ff";
      ctx.beginPath();
      ctx.arc(x3, y3, rn, 0, Math.PI * 2);
      ctx.fill();

      if (divEmph > 0.3 && a3 > 0.3) {
        var sz = rn * 0.55;
        ctx.strokeStyle = NAVY;
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(x3 - sz, y3);
        ctx.lineTo(x3 + sz, y3);
        if (o3 >= 0) {
          ctx.moveTo(x3, y3 - sz);
          ctx.lineTo(x3, y3 + sz);
        }
        ctx.stroke();
      }
    }

    // glowing silhouette on top
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (frontLayer) ctx.drawImage(frontLayer, 0, 0);
  }

  /* ------------------------------------------------------ legend / modes */

  var buttons = root.querySelectorAll("[data-mode]");
  var caption = root.querySelector("[data-hodge-caption]");
  function syncLegend() {
    for (var i = 0; i < buttons.length; i++) {
      var on = buttons[i].getAttribute("data-mode") === mode;
      buttons[i].classList.toggle("is-active", on);
      buttons[i].setAttribute("aria-pressed", on && pinned ? "true" : "false");
    }
    if (caption) caption.textContent = root.getAttribute("data-caption-" + mode) || "";
  }
  function setMode(m) {
    mode = m;
    modeClock = 0;
    if (reduceMotion) {
      weights = TARGET[m].slice();
      divEmph = DIV_EMPHASIS[m];
      edgeEmph = EDGE_EMPHASIS[m];
    }
    syncLegend();
  }
  for (var b = 0; b < buttons.length; b++) {
    buttons[b].addEventListener("click", function (ev) {
      var m = ev.currentTarget.getAttribute("data-mode");
      if (pinned && m === mode && !reduceMotion) {
        pinned = false; // click the active mode again to resume the tour
      } else {
        pinned = true;
        setMode(m);
      }
      syncLegend();
      if (reduceMotion) {
        step(0);
        draw();
      }
    });
  }

  /* ------------------------------------------------------------- loop */

  function resize() {
    var w = canvas.clientWidth || root.clientWidth;
    if (!w) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    scale = w / W;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(w * (H / W) * dpr);
    buildBrainLayers();
    if (!running) draw();
  }

  var running = false;
  var visible = true;
  var last = 0;
  function frame(now) {
    if (!running) return;
    var dt = Math.min(0.05, (now - (last || now)) / 1000);
    last = now;
    if (!pinned) {
      modeClock += dt;
      if (modeClock > MODE_SECONDS) setMode(MODES[(MODES.indexOf(mode) + 1) % MODES.length]);
    }
    var tgt = TARGET[mode];
    var ease = Math.min(1, dt * 2.2);
    for (var i = 0; i < 3; i++) weights[i] += (tgt[i] - weights[i]) * ease;
    divEmph += (DIV_EMPHASIS[mode] - divEmph) * ease;
    edgeEmph += (EDGE_EMPHASIS[mode] - edgeEmph) * ease;
    step(dt);
    draw();
    requestAnimationFrame(frame);
  }
  function start() {
    if (running || reduceMotion || !visible || document.hidden) return;
    running = true;
    last = 0;
    requestAnimationFrame(frame);
  }
  function stop() {
    running = false;
  }

  root.classList.add("is-live");
  syncLegend();
  if (window.ResizeObserver) new ResizeObserver(resize).observe(root);
  else window.addEventListener("resize", resize);
  resize();

  // first frame (also the only one when reduced motion is requested)
  step(reduceMotion ? 1.7 : 0);
  draw();

  if (window.IntersectionObserver) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      if (visible) start();
      else stop();
    }).observe(root);
  }
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) stop();
    else start();
  });
  start();
})();
