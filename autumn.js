/* =========================================================
   AUTUMN SCENE — load this LAST, with defer:
   <script src="https://cdn.jsdelivr.net/npm/lenis@1.1.18/dist/lenis.min.js"></script>
   <script src="autumn.js" defer></script>

   Builds by itself (no images needed):
   sky + clouds, hill, maple tree, falling leaves,
   text + tree that break into dots on scroll,
   Lenis smooth scroll, and a generated ambient sound.
   ========================================================= */
(() => {
    'use strict';

    /* ---------- settings ---------- */
    const AUDIO_FILE = '';            // optional: 'audio/autumn.mp3' to use your own looping track instead
    const SMOOTH = { lerp: 0.06, wheelMultiplier: 0.85, touchMultiplier: 1.4 };
    const LEAF_COUNT = 36;
    const DUSK_MAX = 0.55;            // how orange the sky turns at the bottom of the page (0 = never)
    const MAX_PARTICLES = 7000;
    const CELL = 6;                   // tree dissolve grid size (px) – bigger = faster
    const TEXT_TARGETS = 'h1, h2, .statement, .sub, .mut, .eyebrow, .tag, .sk h3, .sk > p, .steps li h3, .pj h3, .pj p';

    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const rand = (a, b) => a + Math.random() * (b - a);
    const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
    const PAL = ['#6f130d', '#a01c13', '#c8331b', '#df5524', '#ef7a30', '#f59a45', '#fbb85f'];
    const dprOf = () => Math.min(window.devicePixelRatio || 1, 2);

    function mulberry(a) {
        return () => {
            a |= 0; a = (a + 0x6D2B79F5) | 0;
            let t = Math.imul(a ^ (a >>> 15), 1 | a);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    /* realistic maple leaf, built once as a unit-size Path2D */
    const MAPLE = new Path2D(), VEINS = new Path2D();
    (function () {
        const lobes = [[0, 1], [58, .9], [118, .58], [-118, .58], [-58, .9]];
        const tpl = [[.30, -.20], [.48, -.27], [.50, -.14], [.72, -.17], [.70, -.06], [1, 0],
                     [.70, .06], [.72, .17], [.50, .14], [.48, .27], [.30, .20]];
        const pts = [];
        lobes.forEach(([deg, L], i) => {
            const a = deg * Math.PI / 180;
            const ux = Math.sin(a), uy = -Math.cos(a), vx = Math.cos(a), vy = Math.sin(a);
            tpl.forEach(([u, v]) => pts.push([(ux * u + vx * v) * L, (uy * u + vy * v) * L]));
            let nd = lobes[(i + 1) % 5][0]; if (nd < deg) nd += 360;
            const m = (deg + nd) / 2 * Math.PI / 180, r = i === 2 ? .30 : .22;
            pts.push([Math.sin(m) * r, -Math.cos(m) * r]);
            VEINS.moveTo(0, .12); VEINS.lineTo(ux * L * .84, uy * L * .84);
        });
        pts.forEach(([x, y], i) => i ? MAPLE.lineTo(x, y) : MAPLE.moveTo(x, y));
        MAPLE.closePath();
        VEINS.moveTo(0, .1); VEINS.lineTo(0, .62);
    })();

    function maple(ctx, x, y, r, rot) {
        ctx.save();
        ctx.translate(x, y); ctx.rotate(rot); ctx.scale(r, r);
        ctx.fill(MAPLE);
        ctx.restore();
    }

    /* pre-rendered leaf sprite (gradient + veins + stem) for the falling leaves */
    function makeSprite(c1, c2) {
        const s = 96, cv = document.createElement('canvas');
        cv.width = cv.height = s;
        const x = cv.getContext('2d');
        x.translate(s / 2, s * .46); x.scale(s * .46, s * .46);
        const g = x.createRadialGradient(0, -.1, 0, 0, 0, 1);
        g.addColorStop(0, c1); g.addColorStop(1, c2);
        x.lineJoin = 'round'; x.lineCap = 'round';
        x.strokeStyle = '#6b2a10'; x.lineWidth = .06;
        x.beginPath(); x.moveTo(0, .25); x.lineTo(0, .74); x.stroke();
        x.fillStyle = g; x.fill(MAPLE);
        x.strokeStyle = 'rgba(70,8,0,.5)'; x.lineWidth = .03; x.stroke(MAPLE);
        x.strokeStyle = 'rgba(90,12,0,.42)'; x.lineWidth = .035; x.stroke(VEINS);
        return cv;
    }

    function layer(tag, id) {
        const e = document.createElement(tag);
        e.id = id;
        document.body.prepend(e);
        return e;
    }

    /* =========================================================
       SKY
       ========================================================= */
    const sky = layer('div', 'sky');
    const dusk = document.createElement('div'); dusk.className = 'dusk'; sky.appendChild(dusk);
    const sun = document.createElement('div'); sun.className = 'sun'; sky.appendChild(sun);
    for (let i = 0; i < 9; i++) {
        const c = document.createElement('div');
        c.className = 'cloud';
        const w = rand(26, 46);
        c.style.width = w + 'vw';
        c.style.height = w * rand(.22, .34) + 'vw';
        c.style.top = rand(40, 100) + '%';
        c.style.opacity = rand(.55, .95);
        c.style.animationDuration = rand(140, 260) + 's';
        c.style.animationDelay = -rand(0, 260) + 's';
        sky.appendChild(c);
    }
    [[58, 8, 38], [70, 30, 30], [46, 20, 26], [80, 5, 22]].forEach(([l, t, w]) => {
        const s = document.createElement('div');
        s.className = 'streak';
        s.style.left = l + '%'; s.style.top = t + '%'; s.style.width = w + 'vw';
        sky.appendChild(s);
    });

    /* =========================================================
       HILL (static, drawn once per resize)
       ========================================================= */
    const hill = layer('canvas', 'hill');
    function drawHill() {
        const S = dprOf();
        const w = innerWidth + 120, h = Math.max(300, Math.round(innerHeight * 0.42));
        hill.width = w * S; hill.height = h * S;
        hill.style.height = h + 'px';
        hill.style.width = w + 'px'; hill.style.left = '-60px';
        const c = hill.getContext('2d');
        c.setTransform(S, 0, 0, S, 0, 0);
        const R = mulberry(21);
        const surf = x => h * (0.26 + 0.66 * Math.pow(x / w, 1.45));

        const g = c.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, '#d9712a'); g.addColorStop(.45, '#b4491a'); g.addColorStop(1, '#6e2a0e');
        c.fillStyle = g;
        c.beginPath(); c.moveTo(0, h);
        for (let x = 0; x <= w; x += 8) c.lineTo(x, surf(x));
        c.lineTo(w, h); c.closePath(); c.fill();

        const grass = ['#f2b862', '#e9a04a', '#d27a2c', '#b85b1f', '#8d3d14', '#ffd58a'];
        c.lineCap = 'round';
        for (let i = 0; i < 4200; i++) {
            const x = R() * w, y0 = surf(x);
            const y = y0 + Math.pow(R(), 1.8) * (h - y0) - 4;
            const len = 7 + R() * 16, lean = -.5 + R() * .35;
            c.strokeStyle = grass[(R() * grass.length) | 0];
            c.lineWidth = .8 + R() * 1.2;
            c.globalAlpha = .5 + R() * .5;
            c.beginPath(); c.moveTo(x, y);
            c.lineTo(x + lean * len, y - len); c.stroke();
        }
        c.globalAlpha = 1;
        for (let i = 0; i < 260; i++) {
            const x = R() * w, y0 = surf(x);
            const y = y0 + R() * (h - y0) * .9;
            c.fillStyle = PAL[(R() * PAL.length) | 0];
            maple(c, x, y, 3 + R() * 5, R() * 6.28);
        }
        [[.07, .62, 46, 22], [.2, .78, 70, 30], [.5, .88, 90, 34]].forEach(([fx, fy, rx, ry]) => {
            const x = fx * w, y = Math.max(surf(x) + 18, fy * h);
            c.fillStyle = '#d8b88c'; c.beginPath(); c.ellipse(x, y, rx, ry, -.05, 0, 6.28); c.fill();
            c.fillStyle = '#efd9b4'; c.beginPath(); c.ellipse(x - rx * .1, y - ry * .25, rx * .8, ry * .6, -.05, 0, 6.28); c.fill();
        });
    }

    /* =========================================================
       TREE (drawn once, then dissolved cell by cell on scroll)
       ========================================================= */
    const tc = layer('canvas', 'tree');
    const tctx = tc.getContext('2d');
    let base = null, cells = [], TW = 0, TH = 0, TS = 1, treeShown = -1, treePrev = 0;

    function hillSurfY(x) {
        const h = Math.max(300, Math.round(innerHeight * 0.42));
        return innerHeight - h + h * (0.26 + 0.66 * Math.pow(clamp((x + 60) / (innerWidth + 120)), 1.45));
    }

    const LCOL = ['#430a0c', '#6e1013', '#9a1519', '#c52a1c', '#e2461f', '#f2672a', '#f98c33', '#fdb53f', '#ffd75e'];
    const COVER = 2.6;   // leaf density of the canopy (higher = thicker, slower to draw)

    /* The tree is laid out in "reference" pixels (a 1562 x 1250 picture) and scaled to the screen. */
    function drawTree(c, W, H) {
        const R = mulberry(11), S = TS;
        const ux = W / 1562, uy = Math.min(H / 1250, ux * 0.95), ut = (ux + uy) / 2;
        const baseX = W * 0.5, baseY = hillSurfY(baseX) + 12;
        const X = x => baseX + (x - 780) * ux;
        const Y = y => baseY - (1075 - y) * uy;
        const reset = () => c.setTransform(S, 0, 0, S, 0, 0);
        const put = (x, y, r, rot, ci, veins) => {
            const cs = Math.cos(rot) * r * S, sn = Math.sin(rot) * r * S;
            c.setTransform(cs, sn, -sn, cs, x * S, y * S);
            c.fillStyle = LCOL[ci]; c.fill(MAPLE);
            c.lineWidth = .07; c.strokeStyle = 'rgba(45,4,0,.38)'; c.stroke(MAPLE);
            if (veins) { c.lineWidth = .05; c.strokeStyle = 'rgba(110,15,0,.28)'; c.stroke(VEINS); }
        };

        // contact shadow on the hill
        c.fillStyle = 'rgba(40,10,0,.32)';
        c.beginPath(); c.ellipse(baseX, baseY + 2, 170 * ux, 24 * uy, 0, 0, 6.283); c.fill();

        // ----- trunk + limbs: tapered, shaded like a cylinder, lit from the upper left -----
        const bez = (p, t) => {
            const m = 1 - t;
            return [m * m * m * p[0][0] + 3 * m * m * t * p[1][0] + 3 * m * t * t * p[2][0] + t * t * t * p[3][0],
                    m * m * m * p[0][1] + 3 * m * m * t * p[1][1] + 3 * m * t * t * p[2][1] + t * t * t * p[3][1]];
        };
        function limb(p, w0, w1) {
            const N = 54, pts = [];
            for (let i = 0; i <= N; i++) {
                const t = i / N, q = bez(p, t);
                pts.push([X(q[0]), Y(q[1]), (w0 + (w1 - w0) * t) * ut]);
            }
            const pass = (col, f, off, a) => {
                c.globalAlpha = a; c.fillStyle = col;
                for (const [x, y, w] of pts) { c.beginPath(); c.arc(x - w * off, y, w * f / 2, 0, 6.283); c.fill(); }
                c.globalAlpha = 1;
            };
            pass('#26150b', 1, 0, 1);
            pass('#4f3119', .82, .08, 1);
            pass('#7d5430', .46, .22, .85);
            c.lineCap = 'round';
            for (let j = 0; j < 16; j++) {
                const a = Math.floor(R() * (N - 8)), b = Math.min(N, a + 6 + Math.floor(R() * 16)), u = (R() - .5) * .7;
                c.strokeStyle = R() < .75 ? 'rgba(14,6,2,.5)' : 'rgba(210,160,100,.22)';
                c.lineWidth = (1 + R() * 2) * ut * 1.3;
                c.beginPath();
                for (let i = a; i <= b; i++) c.lineTo(pts[i][0] + u * pts[i][2], pts[i][1] + (R() - .5));
                c.stroke();
            }
        }
        limb([[740, 1070], [690, 1075], [665, 1090], [630, 1105]], 70, 10);   // roots
        limb([[820, 1070], [870, 1075], [895, 1090], [930, 1105]], 70, 10);
        limb([[772, 1095], [740, 1010], [762, 930], [790, 850]], 150, 118);   // trunk
        [
            [[[790, 860], [760, 800], [690, 770], [640, 715]], 95, 48],
            [[[800, 850], [790, 790], [740, 740], [705, 700]], 70, 36],
            [[[815, 850], [835, 790], [860, 750], [885, 715]], 62, 30],
            [[[830, 880], [880, 830], [925, 770], [935, 730]], 58, 26],
            [[[850, 960], [900, 935], [1000, 940], [1075, 925]], 40, 8]
        ].forEach(l => limb(l[0], l[1], l[2]));

        // light scars on the bark and a few hanging twigs
        [[722, 858, -.5], [792, 868, .3], [760, 1000, -.2], [824, 952, .4], [800, 920, .1]].forEach(([x, y, r]) => {
            c.fillStyle = 'rgba(214,168,108,.8)';
            c.beginPath(); c.ellipse(X(x), Y(y), 12 * ut, 7 * ut, r, 0, 6.283); c.fill();
        });
        c.strokeStyle = '#3b2314'; c.lineWidth = 2 * ut; c.lineCap = 'round';
        [[940, 940, 925, 990], [970, 938, 985, 985], [905, 945, 890, 975]].forEach(([a, b, d, e]) => {
            c.beginPath(); c.moveTo(X(a), Y(b)); c.lineTo(X(d), Y(e)); c.stroke();
        });

        // fallen leaves piled around the roots
        for (let i = 0; i < 150; i++) {
            const x = baseX + (R() - .5) * 330 * ux, y = baseY + (R() - .75) * 70 * uy;
            put(x, y, (6 + R() * 6) * ut, R() * 6.283, 2 + Math.floor(R() * 5), false);
        }
        reset();

        // ----- canopy: overlapping clusters, dark underlay, lighter leaves painted over it -----
        // cx, cy, rx, ry (reference px), light offset
        const blobs = [
            [250, 520, 230, 170, .05], [330, 780, 150, 130, -.04], [120, 450, 110, 90, .10], [400, 360, 160, 130, .12],
            [640, 330, 200, 190, .02], [860, 350, 200, 150, .05], [1030, 430, 170, 140, 0], [560, 560, 200, 170, -.02],
            [800, 520, 230, 190, -.05], [1050, 640, 200, 170, .20], [1330, 560, 200, 140, -.04], [1380, 730, 170, 140, -.06],
            [1200, 820, 170, 110, 0], [1350, 900, 100, 90, -.06], [680, 660, 140, 70, -.04], [470, 700, 130, 110, 0],
            [1000, 770, 90, 55, .05], [940, 850, 80, 50, -.12], [1250, 880, 110, 70, -.02], [1440, 820, 90, 100, -.08],
            [1150, 700, 130, 100, .08]
        ];
        blobs.forEach(([cx, cy, rx, ry, lo]) => {
            const Xc = X(cx), Yc = Y(cy), rxp = rx * ux, ryp = ry * uy;
            c.fillStyle = 'rgba(46,5,6,.92)';
            c.beginPath(); c.ellipse(Xc, Yc, rxp * .88, ryp * .88, 0, 0, 6.283); c.fill();
            const rbar = 19.5 * ut;
            const n = Math.round(Math.PI * rxp * ryp * COVER / (1.1 * rbar * rbar));
            const arr = [];
            for (let i = 0; i < n; i++) {
                const a = R() * 6.283, r = Math.sqrt(R()) * 1.04;
                const dx = Math.cos(a) * r, dy = Math.sin(a) * r;
                const nx = clamp((cx + dx * rx) / 1562), ny = clamp((cy + dy * ry - 150) / 850);
                const L = 1.05 - .75 * nx - .30 * ny - dy * .14 + lo + (R() - .5) * .34;
                arr.push([Xc + dx * rxp, Yc + dy * ryp, L, (13 + R() * 13) * ut, R() * 6.283]);
            }
            arr.sort((p, q) => p[2] - q[2]);
            for (const [px, py, L, r, rot] of arr) {
                const ci = clamp(Math.round(L * 8), 0, 8);
                put(px, py, r, rot, ci, ci >= 3 && r > 15 * ut);
            }
            reset();
        });

        // sunlight from the upper left, shade lower right (only paints where there is already tree)
        c.globalCompositeOperation = 'source-atop';
        let lg = c.createRadialGradient(W * .12, H * .12, 0, W * .12, H * .12, W * .8);
        lg.addColorStop(0, 'rgba(255,225,120,.30)'); lg.addColorStop(1, 'rgba(255,200,90,0)');
        c.fillStyle = lg; c.fillRect(0, 0, W, H);
        lg = c.createRadialGradient(W * .9, H * .62, 0, W * .9, H * .62, W * .5);
        lg.addColorStop(0, 'rgba(40,0,0,.28)'); lg.addColorStop(1, 'rgba(40,0,0,0)');
        c.fillStyle = lg; c.fillRect(0, 0, W, H);
        c.globalCompositeOperation = 'source-over';
    }

    function buildTree() {
        TS = Math.min(dprOf(), 1.5);
        TH = innerHeight;
        TW = innerWidth;
        base = document.createElement('canvas');
        base.width = TW * TS; base.height = TH * TS;
        const b = base.getContext('2d');
        b.scale(TS, TS);
        drawTree(b, TW, TH);
        tc.width = base.width; tc.height = base.height;
        tc.style.width = TW + 'px'; tc.style.height = TH + 'px';

        const data = b.getImageData(0, 0, base.width, base.height).data;
        cells = [];
        for (let y = 0; y < TH; y += CELL) {
            for (let x = 0; x < TW; x += CELL) {
                const px = Math.floor((x + CELL / 2) * TS), py = Math.floor((y + CELL / 2) * TS);
                const i = (py * base.width + px) * 4;
                if (data[i + 3] > 60) {
                    cells.push({
                        x, y,
                        r: Math.random() * 0.5 + 0.5 * (1 - x / TW),
                        col: `rgb(${data[i] >> 3 << 3},${data[i + 1] >> 3 << 3},${data[i + 2] >> 3 << 3})`
                    });
                }
            }
        }
        treeShown = -1; treePrev = 0;
    }

    function renderTree(t) {
        tctx.globalCompositeOperation = 'source-over';
        tctx.clearRect(0, 0, tc.width, tc.height);
        tctx.drawImage(base, 0, 0);
        if (t <= 0) return;
        tctx.globalCompositeOperation = 'destination-out';
        tctx.beginPath();
        const rr = CELL * TS * 0.8;
        for (const c of cells) {
            if (c.r < t) {
                const px = (c.x + CELL / 2) * TS, py = (c.y + CELL / 2) * TS;
                tctx.moveTo(px + rr, py); tctx.arc(px, py, rr, 0, 6.283);
            }
        }
        tctx.fill();
    }

    /* =========================================================
       FX CANVAS: falling leaves + particles
       ========================================================= */
    const fx = layer('canvas', 'fx');
    const fctx = fx.getContext('2d');
    let FS = 1;
    function sizeFx() {
        FS = dprOf();
        fx.width = innerWidth * FS; fx.height = innerHeight * FS;
    }

    const particles = [];
    function spawn(x, y, color, speed) {
        if (particles.length >= MAX_PARTICLES) return;
        particles.push({
            x, y, color,
            vx: rand(.8, 3.6) * speed, vy: rand(-1.6, 1.1) * speed,
            s: rand(.9, 2.5), life: 1, decay: rand(.006, .016)
        });
    }

    const SPRITES = [
        ['#ffd05a', '#d9461a'], ['#ffa83c', '#b3261a'], ['#f7752a', '#8c140e'],
        ['#e8452a', '#7a1010'], ['#ffb347', '#c2531a'], ['#ffe07a', '#e8761f']
    ].map(([a, b]) => makeSprite(a, b));

    const leaves = [];
    function newLeaf(initial) {
        const big = Math.random() < 0.12;
        return {
            x: rand(-120, innerWidth), y: initial ? rand(-50, innerHeight) : rand(-140, -30),
            vx: rand(.5, 1.5), vy: rand(.8, 2.0), r: big ? rand(24, 38) : rand(9, 18),
            rot: rand(0, 6.28), vr: rand(-.03, .03),
            ph: rand(0, 6.28), f: rand(.01, .03), sw: rand(.4, 1.3),
            spr: SPRITES[(Math.random() * SPRITES.length) | 0],
            z: big ? rand(1.1, 1.5) : rand(.5, 1.1), a: big ? .88 : 1
        };
    }
    for (let i = 0; i < LEAF_COUNT; i++) leaves.push(newLeaf(true));

    /* =========================================================
       TEXT -> DOTS
       ========================================================= */
    const textItems = [...document.querySelectorAll(TEXT_TARGETS)]
        .filter(el => !el.closest('.loader, .top, .hud'))
        .map(el => ({ el, p: 0, lastF: -9999 }));

    function charRects(el) {
        const out = [];
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        const rg = document.createRange();
        let n;
        while ((n = walker.nextNode())) {
            const s = n.nodeValue;
            for (let i = 0; i < s.length; i++) {
                if (/\s/.test(s[i])) continue;
                rg.setStart(n, i); rg.setEnd(n, i + 1);
                const r = rg.getClientRects()[0];
                if (r) out.push(r);
            }
        }
        return out;
    }

    function setMask(el, f, fe) {
        const m = `linear-gradient(90deg, transparent 0, transparent ${f}px, #000 ${f + fe}px)`;
        el.style.webkitMaskImage = m; el.style.maskImage = m;
        el.style.webkitMaskRepeat = 'no-repeat'; el.style.maskRepeat = 'no-repeat';
    }
    function clearMask(el) {
        el.style.webkitMaskImage = ''; el.style.maskImage = '';
    }

    function stepText(sy) {
        const vh = innerHeight;
        for (const it of textItems) {
            const el = it.el;
            const rect = el.getBoundingClientRect();
            const c = rect.top + rect.height / 2;
            const docC = c + sy;
            const startC = Math.min(vh * 0.34, docC);
            const p = clamp((startC - c) / (vh * 0.26));

            if (p === it.p && (p === 0 || p === 1)) continue;
            // skip work for elements far below the screen
            if (rect.top > vh + 200 && it.p === 0) continue;

            const w = rect.width;
            const fe = Math.min(140, Math.max(60, w * 0.18));
            const f = p * (w + fe) - fe;
            const front = f + fe * 0.5;

            if (p <= 0) {
                if (it.p > 0) clearMask(el);
                it.lastF = -9999;
            } else {
                setMask(el, f, fe);
                if (p < 1 && rect.bottom > -20 && rect.top < vh && p > it.p) {
                    if (it.lastF < -9000) it.lastF = front - 4;
                    let emitted = 0;
                    for (const r of charRects(el)) {
                        const rx = r.left + r.width / 2 - rect.left;
                        if (rx > it.lastF && rx <= front && emitted < 500) {
                            for (let k = 0; k < 3; k++) {
                                spawn(r.left + Math.random() * r.width, r.top + Math.random() * r.height,
                                    Math.random() < .6 ? '#fff4e6' : '#ffb06a', 1);
                            }
                            emitted++;
                        }
                    }
                }
                it.lastF = front;
            }
            it.p = p;
        }
    }

    /* =========================================================
       SMOOTH SCROLL (Lenis)
       ========================================================= */
    let lenis = window.__lenis || null;
    if (!lenis && window.Lenis && !reduce) {
        lenis = new window.Lenis(Object.assign({ smoothWheel: true }, SMOOTH));
        window.__lenis = lenis;
    }
    if (lenis) {
        document.querySelectorAll('a[href^="#"]').forEach(a => {
            a.addEventListener('click', e => {
                const id = a.getAttribute('href');
                const t = id.length > 1 ? document.querySelector(id) : null;
                if (t) { e.preventDefault(); lenis.scrollTo(t, { duration: 1.8 }); }
            });
        });
    }

    /* =========================================================
       SOUND (generated with WebAudio — no file needed)
       ========================================================= */
    let actx = null, master = null, windLP = null, built = false, muted = false, audioEl = null;
    const btn = document.createElement('button');
    btn.className = 'snd'; btn.type = 'button';
    btn.textContent = '♪ click for sound';
    document.body.appendChild(btn);

    function label() {
        btn.textContent = !built ? '♪ click for sound' : (muted ? '♪ sound off' : '♪ sound on');
    }
    function applyVolume() {
        if (audioEl) audioEl.volume = muted ? 0 : 0.6;
        if (master) master.gain.setTargetAtTime(muted ? 0 : 0.6, actx.currentTime, 0.6);
    }
    function lfo(rate, depth, param) {
        const o = actx.createOscillator(); o.frequency.value = rate;
        const g = actx.createGain(); g.gain.value = depth;
        o.connect(g); g.connect(param); o.start();
    }

    function buildSynth() {
        built = true;
        master = actx.createGain(); master.gain.value = 0; master.connect(actx.destination);
        const sr = actx.sampleRate;

        // wind = filtered brown noise
        const nb = actx.createBuffer(2, sr * 6, sr);
        for (let ch = 0; ch < 2; ch++) {
            const d = nb.getChannelData(ch); let last = 0;
            for (let i = 0; i < d.length; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
        }
        const wind = actx.createBufferSource(); wind.buffer = nb; wind.loop = true;
        windLP = actx.createBiquadFilter(); windLP.type = 'lowpass'; windLP.frequency.value = 650;
        const wg = actx.createGain(); wg.gain.value = 0.55;
        wind.connect(windLP); windLP.connect(wg); wg.connect(master); wind.start();
        lfo(0.06, 220, windLP.frequency); lfo(0.09, 0.15, wg.gain);

        // soft pad
        const bus = actx.createGain(); bus.gain.value = 0.05;
        const pl = actx.createBiquadFilter(); pl.type = 'lowpass'; pl.frequency.value = 1100;
        bus.connect(pl); pl.connect(master);
        [110, 164.81, 220, 277.18, 329.63].forEach(f => {
            const o = actx.createOscillator(); o.type = 'sine'; o.frequency.value = f; o.detune.value = rand(-6, 6);
            const g = actx.createGain(); g.gain.value = 0.2;
            o.connect(g); g.connect(bus); o.start(); lfo(rand(.03, .08), .1, g.gain);
        });

        // echo + chimes
        const dly = actx.createDelay(1.5); dly.delayTime.value = 0.55;
        const fb = actx.createGain(); fb.gain.value = 0.4;
        dly.connect(fb); fb.connect(dly); dly.connect(master);
        const scale = [659.25, 739.99, 880, 987.77, 1108.73, 1318.51];
        (function chime() {
            if (actx.state === 'running' && !muted) {
                const o = actx.createOscillator(); o.type = 'sine';
                o.frequency.value = scale[(Math.random() * scale.length) | 0];
                const g = actx.createGain(), t = actx.currentTime;
                g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.05, t + 0.02);
                g.gain.exponentialRampToValueAtTime(0.0005, t + 3.2);
                o.connect(g); g.connect(master); g.connect(dly); o.start(t); o.stop(t + 3.3);
            }
            setTimeout(chime, rand(4500, 10000));
        })();

        // leaf rustle
        const wb = actx.createBuffer(1, sr * 2, sr), wd = wb.getChannelData(0);
        for (let i = 0; i < wd.length; i++) wd[i] = Math.random() * 2 - 1;
        (function rustle() {
            if (actx.state === 'running' && !muted) {
                const s = actx.createBufferSource(); s.buffer = wb;
                const bp = actx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = rand(3500, 6500); bp.Q.value = 0.8;
                const g = actx.createGain(), t = actx.currentTime, d = rand(.5, 1.4);
                g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(rand(.03, .07), t + d * .4); g.gain.linearRampToValueAtTime(0, t + d);
                s.connect(bp); bp.connect(g); g.connect(master); s.start(t); s.stop(t + d + .1);
            }
            setTimeout(rustle, rand(1800, 5200));
        })();

        applyVolume(); label();
    }

    function startSound() {
        if (built) { if (actx && actx.state === 'suspended') actx.resume(); return; }
        if (AUDIO_FILE) {
            audioEl = new Audio(AUDIO_FILE); audioEl.loop = true; audioEl.volume = 0.6;
            audioEl.play().then(() => { built = true; label(); }).catch(() => { audioEl = null; });
            return;
        }
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        if (!actx) actx = new AC();
        actx.resume().then(() => { if (actx.state === 'running' && !built) buildSynth(); }).catch(() => {});
    }

    btn.addEventListener('click', () => {
        if (built) { muted = !muted; applyVolume(); label(); }
        else startSound();
    });
    ['pointerdown', 'keydown', 'touchend', 'click'].forEach(ev =>
        window.addEventListener(ev, startSound, { passive: true }));
    document.addEventListener('visibilitychange', () => {
        if (!actx) return;
        document.hidden ? actx.suspend() : (built && actx.resume());
    });
    startSound(); // works instantly if the browser allows autoplay

    /* =========================================================
       3D PARALLAX: scroll zoom + mouse tilt
       ========================================================= */
    const mouse = { x: 0, y: 0 };
    let mx = 0, my = 0, pageSmooth = 0;
    addEventListener('pointermove', e => {
        mouse.x = e.clientX / innerWidth * 2 - 1;
        mouse.y = e.clientY / innerHeight * 2 - 1;
    }, { passive: true });
    tc.style.transformOrigin = '50% 88%';
    hill.style.transformOrigin = '50% 0%';
    sky.style.transformOrigin = '50% 100%';

    function parallax(now, e, p) {
        if (reduce) return { sc: 1, tx: 0, ty: 0 };
        const ee = e * e * (3 - 2 * e);
        const sc = 1 + 0.7 * ee, ty = ee * innerHeight * 0.16, tx = -mx * 14;
        const rot = Math.sin(now / 3200) * 0.22 + mx * 0.25;
        tc.style.transform = `translate3d(${tx}px,${ty - my * 6}px,0) scale(${sc}) rotate(${rot}deg)`;
        hill.style.transform = `translate3d(${-mx * 26}px,${ee * hill.clientHeight * 0.75 - my * 10}px,0) scale(${1 + 0.45 * ee})`;
        sky.style.transform = `translate3d(${-mx * 6}px,${-my * 4}px,0) scale(${1 + 0.1 * ee + 0.14 * p})`;
        dusk.style.opacity = (p * DUSK_MAX).toFixed(3);
        return { sc, tx, ty };
    }

    /* =========================================================
       MAIN LOOP
       ========================================================= */
    let last = performance.now(), lastSy = scrollY, sv = 0, treeSmooth = 0;

    function frame(now) {
        const dt = Math.min(0.05, (now - last) / 1000) * 60;
        last = now;
        if (lenis) lenis.raf(now);

        const sy = window.scrollY;
        sv += ((sy - lastSy) - sv) * 0.2;
        lastSy = sy;

        // tree
        const target = reduce ? 0 : clamp(sy / (innerHeight * 0.95));
        treeSmooth += (target - treeSmooth) * 0.14;
        const maxScroll = Math.max(1, document.documentElement.scrollHeight - innerHeight);
        pageSmooth += (clamp(sy / maxScroll) - pageSmooth) * 0.1;
        mx += (mouse.x - mx) * 0.06; my += (mouse.y - my) * 0.06;
        const tf = parallax(now, treeSmooth, pageSmooth);
        if (Math.abs(treeSmooth - treeShown) > 0.002) {
            if (treeSmooth > treePrev) {
                const ox = TW * 0.5, oy = TH * 0.88;
                for (const c of cells) {
                    if (c.r >= treePrev && c.r < treeSmooth && Math.random() < 0.5) {
                        spawn(ox + (c.x + CELL / 2 - ox) * tf.sc + tf.tx, oy + (c.y + CELL / 2 - oy) * tf.sc + tf.ty, c.col, 1.1);
                    }
                }
            }
            renderTree(treeSmooth);
            treeShown = treeSmooth; treePrev = treeSmooth;
        }

        // text
        if (!reduce) stepText(sy);

        // draw fx
        fctx.setTransform(FS, 0, 0, FS, 0, 0);
        fctx.clearRect(0, 0, innerWidth, innerHeight);

        for (const l of leaves) {
            l.ph += l.f * dt;
            l.x += (l.vx + Math.sin(l.ph) * l.sw) * dt * l.z;
            l.y += (l.vy * l.z - sv * 0.12) * dt;
            l.rot += l.vr * dt;
            if (l.y > innerHeight + 30 || l.x > innerWidth + 60) Object.assign(l, newLeaf(false));
            if (l.y < -140) l.y = innerHeight + 20;
            fctx.save();
            fctx.translate(l.x, l.y);
            fctx.rotate(l.rot);
            fctx.scale(1, Math.cos(l.ph * 1.5) * 0.5 + 0.6);
            fctx.globalAlpha = l.a;
            fctx.drawImage(l.spr, -l.r, -l.r, l.r * 2, l.r * 2);
            fctx.restore();
        }

        let prev = '';
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.vx *= 0.99; p.vy = p.vy * 0.985 - 0.006;
            p.x += p.vx * dt; p.y += (p.vy - sv * 0.1) * dt;
            p.life -= p.decay * dt;
            if (p.life <= 0) { particles[i] = particles[particles.length - 1]; particles.pop(); continue; }
            if (p.color !== prev) { fctx.fillStyle = p.color; prev = p.color; }
            fctx.globalAlpha = p.life;
            fctx.fillRect(p.x, p.y, p.s, p.s);
        }
        fctx.globalAlpha = 1;

        // wind gets louder when you scroll fast
        if (windLP) windLP.frequency.setTargetAtTime(650 + Math.min(900, Math.abs(sv) * 25), actx.currentTime, 0.25);

        requestAnimationFrame(frame);
    }

    /* =========================================================
       INIT
       ========================================================= */
    function layoutAll() { drawHill(); buildTree(); sizeFx(); }
    layoutAll();
    let rz;
    addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(layoutAll, 200); });
    requestAnimationFrame(frame);
})();