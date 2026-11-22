/* Planet Hop — artwork. Every picture is drawn here as SVG so the game works
   offline and stays crisp at any size. Each call gets its own id prefix so the
   same planet can appear many times on one page. */
'use strict';

const Art = (() => {
  let uidCounter = 0;
  const R = 80;          // planet radius inside a -100..100 viewBox
  const T = 200;         // width of one repeating surface tile (>= 2R)

  /* ---------- small helpers ---------- */
  function rng(seed) {
    let s = seed >>> 0;
    return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }
  const f = n => Math.round(n * 10) / 10;

  // smooth closed blob through n wobbly points (Catmull-Rom → cubic Bézier)
  function blob(cx, cy, rx, ry, seed, n = 8, wob = 0.28) {
    const rand = rng(seed);
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const k = 1 - wob / 2 + rand() * wob;
      pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
    }
    let d = `M${f(pts[0][0])},${f(pts[0][1])}`;
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += ` C${f(c1[0])},${f(c1[1])} ${f(c2[0])},${f(c2[1])} ${f(p2[0])},${f(p2[1])}`;
    }
    return d + 'Z';
  }

  // horizontal wavy band between y0 and y1, seamless over a T-wide tile
  function band(y0, y1, amp, phase = 0, x0 = -R - 10, w = T + 20) {
    const N = 24, per = T / 2;
    let top = '', bot = '';
    for (let i = 0; i <= N; i++) {
      const x = x0 + (w * i) / N;
      const s = Math.sin(((x + phase) / per) * Math.PI * 2) * amp;
      top += (i ? ' L' : 'M') + f(x) + ',' + f(y0 + s);
    }
    for (let i = N; i >= 0; i--) {
      const x = x0 + (w * i) / N;
      const s = Math.sin(((x + phase + 30) / per) * Math.PI * 2) * amp;
      bot += ' L' + f(x) + ',' + f(y1 + s);
    }
    return top + bot + 'Z';
  }

  // a surface that slides sideways forever, so the planet looks like it spins
  function spinning(inner, cls = '') {
    return `<g class="surface ${cls}">${inner}<g transform="translate(${T},0)">${inner}</g></g>`;
  }

  function face(opts = {}) {
    const y = opts.y ?? 2;
    const sp = opts.spread ?? 27;
    const eye = x => `
      <g class="eye" style="transform-origin:${x}px ${y - 6}px">
        <ellipse cx="${x}" cy="${y - 6}" rx="11.5" ry="13.5" fill="#fff"/>
        <ellipse cx="${x + 1.5}" cy="${y - 4}" rx="8" ry="10" fill="#22143F"/>
        <circle cx="${x + 4.5}" cy="${y - 9}" r="3.4" fill="#fff"/>
        <circle cx="${x - 1}" cy="${y}" r="1.6" fill="#fff" opacity=".8"/>
      </g>`;
    const happyEye = x => `<path d="M${x - 10},${y - 3} Q${x},${y - 17} ${x + 10},${y - 3}" fill="none" stroke="#22143F" stroke-width="5.5" stroke-linecap="round"/>`;
    return `
      <g class="face">
        <ellipse cx="${-sp - 15}" cy="${y + 14}" rx="11" ry="6.5" fill="#FF5C9A" opacity=".45"/>
        <ellipse cx="${sp + 15}" cy="${y + 14}" rx="11" ry="6.5" fill="#FF5C9A" opacity=".45"/>
        <g class="eyes-open">${eye(-sp)}${eye(sp)}</g>
        <g class="eyes-happy">${happyEye(-sp)}${happyEye(sp)}</g>
        <path class="mouth-smile" d="M-13,${y + 14} Q0,${y + 28} 13,${y + 14}" fill="none" stroke="#22143F" stroke-width="5" stroke-linecap="round"/>
        <g class="mouth-open">
          <path d="M-15,${y + 12} Q0,${y + 12} 15,${y + 12} Q14,${y + 34} 0,${y + 34} Q-14,${y + 34} -15,${y + 12}Z" fill="#22143F"/>
          <ellipse cx="0" cy="${y + 29}" rx="8" ry="5" fill="#FF6F8E"/>
        </g>
      </g>`;
  }

  // ring halves for Saturn / Uranus. back = upper arc, front = lower arc.
  function ringHalves(rings, tilt, which) {
    const sweep = which === 'back' ? 1 : 0;
    return `<g transform="rotate(${tilt})">` + rings.map(r =>
      `<path d="M${-r.rx},0 A${r.rx},${r.ry} 0 0 ${sweep} ${r.rx},0" fill="none" stroke="${r.c}" stroke-width="${r.w}" opacity="${r.o ?? 1}" stroke-linecap="round"/>`
    ).join('') + '</g>';
  }

  /* ---------- per-body drawings ---------- */
  const DRAW = {
    sun(id, detail) {
      let rays = '';
      const n = 14;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2, w = Math.PI / n * 0.62;
        const p = (rr, aa) => `${f(Math.cos(aa) * rr)},${f(Math.sin(aa) * rr)}`;
        const tip = i % 2 ? 104 : 116;
        rays += `<polygon points="${p(70, a - w)} ${p(tip, a)} ${p(70, a + w)}" fill="${i % 2 ? '#FF9A1F' : '#FFC93C'}" stroke="${i % 2 ? '#FF9A1F' : '#FFC93C'}" stroke-width="9" stroke-linejoin="round"/>`;
      }
      const spots = [[-50, -30, 14], [10, 40, 18], [60, -20, 12], [100, 30, 16], [-20, -55, 9], [80, 55, 10]]
        .map(([x, y, r], i) => `<path d="${blob(x, y, r, r * .8, 11 + i)}" fill="#FFF3A6" opacity=".55"/>`).join('');
      return {
        back: `<g class="rays">${rays}</g>`,
        base: `<radialGradient id="${id}b" cx="45%" cy="40%" r="65%"><stop offset="0" stop-color="#FFF27A"/><stop offset=".6" stop-color="#FFC52E"/><stop offset="1" stop-color="#FF961E"/></radialGradient>`,
        fill: `url(#${id}b)`,
        surface: spinning(spots),
        shade: false,
        extra: detail ? `
          <g class="fx fx-shades">
            <path d="M-46,-14 h36 q4,0 4,6 q-2,20 -22,20 q-18,0 -22,-20 q0,-6 4,-6Z" fill="#22143F"/>
            <path d="M10,-14 h36 q4,0 4,6 q-2,20 -22,20 q-18,0 -22,-20 q0,-6 4,-6Z" fill="#22143F"/>
            <path d="M-8,-10 q8,-6 18,0" stroke="#22143F" stroke-width="5" fill="none"/>
            <path d="M-38,-8 l10,0" stroke="#7A6CFF" stroke-width="4" stroke-linecap="round"/>
            <path d="M18,-8 l10,0" stroke="#7A6CFF" stroke-width="4" stroke-linecap="round"/>
          </g>` : '',
      };
    },

    mercury(id, detail) {
      const cr = [[-55, -35, 13], [-20, 20, 18], [25, -40, 10], [45, 35, 15], [85, -10, 20], [110, 45, 9], [-60, 50, 9], [70, -55, 8], [5, 62, 8]];
      const craters = cr.map(([x, y, r]) =>
        `<circle cx="${x}" cy="${y}" r="${r}" fill="#9A8470"/><path d="M${x - r * .8},${y + r * .45} A${r},${r} 0 0 0 ${x + r * .8},${y + r * .45}" fill="none" stroke="#D9CBB8" stroke-width="3" stroke-linecap="round"/>`).join('');
      return {
        base: `<radialGradient id="${id}b" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#DACBB9"/><stop offset="1" stop-color="#A8927C"/></radialGradient>`,
        fill: `url(#${id}b)`,
        surface: spinning(craters),
        extra: detail ? `<g class="fx fx-speed">
            <path d="M-120,-40 h-50" /><path d="M-118,0 h-70" /><path d="M-120,40 h-50" /></g>` : '',
      };
    },

    venus(id, detail) {
      const swirls =
        `<path d="${band(-62, -48, 6, 0)}" fill="#FCE3A6" opacity=".8"/>` +
        `<path d="${band(-28, -14, 7, 40)}" fill="#E39E3C" opacity=".55"/>` +
        `<path d="${band(8, 22, 6, 80)}" fill="#FCE3A6" opacity=".8"/>` +
        `<path d="${band(40, 52, 7, 20)}" fill="#E39E3C" opacity=".5"/>` +
        `<path d="${band(66, 76, 5, 60)}" fill="#FCE3A6" opacity=".7"/>`;
      const cloud = (x, y, s, seed) => `<path d="${blob(x, y, 26 * s, 16 * s, seed, 9, .45)}" fill="#FFF4D6" stroke="#F2C46B" stroke-width="3"/>`;
      return {
        base: `<radialGradient id="${id}b" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#FFE29A"/><stop offset="1" stop-color="#EBA640"/></radialGradient>`,
        fill: `url(#${id}b)`,
        surface: spinning(swirls),
        extra: detail ? `<g class="fx fx-clouds">
            <g class="c1">${cloud(-95, -70, 1.1, 3)}</g>
            <g class="c2">${cloud(100, -50, 0.9, 7)}</g>
            <g class="c3">${cloud(-90, 75, 0.8, 9)}</g>
            <g class="c4">${cloud(95, 80, 1.0, 13)}</g></g>` : '',
      };
    },

    earth(id, detail) {
      const land =
        `<path d="${blob(-40, -25, 30, 34, 21, 9, .5)}" fill="#4CC46B"/>` +
        `<path d="${blob(-25, 35, 16, 26, 22, 8, .5)}" fill="#4CC46B"/>` +
        `<path d="${blob(45, -15, 22, 30, 23, 9, .5)}" fill="#4CC46B"/>` +
        `<path d="${blob(55, 40, 18, 14, 24, 8, .5)}" fill="#F2C46B"/>` +
        `<path d="${blob(100, 20, 14, 30, 25, 8, .5)}" fill="#4CC46B"/>` +
        `<path d="${blob(-40, -25, 14, 14, 27, 7, .5)}" fill="#3BA85A"/>` +
        `<path d="M-70,-50 q20,-10 40,0" stroke="#fff" stroke-width="7" fill="none" stroke-linecap="round" opacity=".9"/>` +
        `<path d="M10,10 q22,-9 44,0" stroke="#fff" stroke-width="7" fill="none" stroke-linecap="round" opacity=".9"/>` +
        `<path d="M70,-55 q15,-8 30,0" stroke="#fff" stroke-width="6" fill="none" stroke-linecap="round" opacity=".9"/>` +
        `<path d="M-60,60 q18,-8 36,0" stroke="#fff" stroke-width="6" fill="none" stroke-linecap="round" opacity=".9"/>`;
      return {
        base: `<radialGradient id="${id}b" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#6FB2FF"/><stop offset="1" stop-color="#2566D9"/></radialGradient>`,
        fill: `url(#${id}b)`,
        surface: spinning(land),
        caps: `<ellipse cx="0" cy="-80" rx="34" ry="12" fill="#F4FBFF"/><ellipse cx="0" cy="80" rx="30" ry="11" fill="#F4FBFF"/>`,
        extra: detail ? `<g class="fx fx-moon"><g class="moon" transform="translate(132,0)">
            <circle r="22" fill="#D8D3E6" stroke="#fff" stroke-width="3"/>
            <circle cx="-8" cy="-8" r="5" fill="#B9B2CC"/><circle cx="9" cy="8" r="4" fill="#B9B2CC"/>
            <circle cx="-6" cy="2" r="2.6" fill="#22143F"/><circle cx="6" cy="2" r="2.6" fill="#22143F"/>
            <path d="M-5,9 q5,5 10,0" stroke="#22143F" stroke-width="2.4" fill="none" stroke-linecap="round"/></g></g>` : '',
      };
    },

    mars(id, detail) {
      const marks =
        `<path d="${blob(-45, 10, 26, 16, 31, 9, .5)}" fill="#B8432A" opacity=".75"/>` +
        `<path d="${blob(30, -30, 20, 12, 32, 9, .5)}" fill="#B8432A" opacity=".7"/>` +
        `<path d="${blob(80, 40, 24, 14, 33, 9, .5)}" fill="#B8432A" opacity=".7"/>` +
        `<path d="${blob(-10, 55, 18, 9, 34, 8, .5)}" fill="#F08A5D" opacity=".8"/>` +
        `<g transform="translate(40,20)"><circle r="14" fill="#F08A5D"/><circle r="6" fill="#B8432A"/></g>` +
        `<path d="${blob(-60, -45, 14, 8, 35, 8, .5)}" fill="#F08A5D" opacity=".8"/>`;
      // the rover drives over the top of the planet, Little-Prince style
      const rover = `<g class="fx fx-rover"><g class="rover"><g transform="translate(0,-89)">
          <rect x="-22" y="-18" width="44" height="16" rx="5" fill="#F4F1FF" stroke="#22143F" stroke-width="3"/>
          <rect x="-4" y="-38" width="5" height="20" fill="#22143F"/>
          <rect x="-12" y="-46" width="20" height="11" rx="3" fill="#F4F1FF" stroke="#22143F" stroke-width="3"/>
          <circle cx="3" cy="-40.5" r="3" fill="#5FE0C1"/>
          <rect x="-30" y="-24" width="20" height="5" rx="2" fill="#4E6BFF"/>
          <circle cx="-16" cy="2" r="7" fill="#22143F"/><circle cx="0" cy="2" r="7" fill="#22143F"/><circle cx="16" cy="2" r="7" fill="#22143F"/>
          <circle cx="-16" cy="2" r="2.5" fill="#C9C3DB"/><circle cx="0" cy="2" r="2.5" fill="#C9C3DB"/><circle cx="16" cy="2" r="2.5" fill="#C9C3DB"/>
        </g></g></g>`;
      return {
        base: `<radialGradient id="${id}b" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#FF8F5E"/><stop offset="1" stop-color="#C9472A"/></radialGradient>`,
        fill: `url(#${id}b)`,
        surface: spinning(marks),
        caps: `<ellipse cx="0" cy="-78" rx="30" ry="12" fill="#FFF4EE"/>`,
        extra: detail ? rover : '',
      };
    },

    jupiter(id, detail) {
      const bands =
        `<path d="${band(-70, -56, 3, 0)}" fill="#C98A55"/>` +
        `<path d="${band(-44, -30, 4, 30)}" fill="#B8743F"/>` +
        `<path d="${band(-22, -10, 3, 60)}" fill="#F6E4C4"/>` +
        `<path d="${band(10, 22, 4, 10)}" fill="#C98A55"/>` +
        `<path d="${band(36, 50, 3, 50)}" fill="#B8743F"/>` +
        `<path d="${band(60, 72, 3, 80)}" fill="#E0B07A"/>`;
      const spot = `<g transform="translate(40,30)"><g class="spot">
          <ellipse rx="27" ry="15" fill="#F08A60"/><ellipse rx="19" ry="10" fill="#D9573A"/>
          <path d="M-12,0 q6,-8 14,-3 q6,5 -2,8" stroke="#F7B08F" stroke-width="3" fill="none" stroke-linecap="round"/></g></g>`;
      return {
        base: `<radialGradient id="${id}b" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#F9E6C8"/><stop offset="1" stop-color="#DDB07C"/></radialGradient>`,
        fill: `url(#${id}b)`,
        surface: spinning(bands + spot),
        extra: detail ? `<g class="fx fx-wind">
            <path d="M-130,-60 q-20,40 0,80" /><path d="M130,60 q20,-40 0,-80" /><path d="M-60,-128 q40,-18 80,0"/><path d="M60,128 q-40,18 -80,0"/></g>` : '',
      };
    },

    saturn(id, detail) {
      const bands =
        `<path d="${band(-60, -46, 3, 0)}" fill="#E2BD6E" opacity=".8"/>` +
        `<path d="${band(-26, -14, 3, 40)}" fill="#F7E8BE"/>` +
        `<path d="${band(18, 30, 3, 70)}" fill="#E2BD6E" opacity=".8"/>` +
        `<path d="${band(52, 64, 3, 20)}" fill="#D7AE5B" opacity=".7"/>`;
      const rings = [
        { rx: 148, ry: 34, c: '#F6E7BE', w: 9 },
        { rx: 133, ry: 30, c: '#D9BC7E', w: 11 },
        { rx: 116, ry: 26, c: '#F1DCA3', w: 9, o: .9 },
      ];
      let sparkles = '';
      if (detail) {
        [[-150, -10], [-90, 30], [0, 38], [95, 28], [150, -12], [60, -30]].forEach(([x, y], i) => {
          sparkles += `<path class="sp sp${i}" transform="translate(${x},${y})" d="M0,-12 Q2,-2 12,0 Q2,2 0,12 Q-2,2 -12,0 Q-2,-2 0,-12Z" fill="#FFF6C8"/>`;
        });
      }
      return {
        back: ringHalves(rings, -14, 'back'),
        front: ringHalves(rings, -14, 'front'),
        base: `<radialGradient id="${id}b" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#FBEBC0"/><stop offset="1" stop-color="#DDB662"/></radialGradient>`,
        fill: `url(#${id}b)`,
        surface: spinning(bands),
        extra: detail ? `<g class="fx fx-sparkle" transform="rotate(-14)">${sparkles}</g>` : '',
      };
    },

    uranus(id, detail) {
      const rings = [{ rx: 118, ry: 20, c: '#E6FBFF', w: 4, o: .85 }, { rx: 108, ry: 18, c: '#B5EEF3', w: 3, o: .7 }];
      const streaks = `<path d="${band(-40, -30, 2, 0)}" fill="#A9EEF1" opacity=".6"/><path d="${band(20, 28, 2, 50)}" fill="#5CC6D0" opacity=".45"/>`;
      return {
        back: ringHalves(rings, -78, 'back'),
        front: ringHalves(rings, -78, 'front'),
        base: `<radialGradient id="${id}b" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#B8F3F5"/><stop offset="1" stop-color="#4FBCC8"/></radialGradient>`,
        fill: `url(#${id}b)`,
        surface: spinning(streaks),
      };
    },

    neptune(id, detail) {
      const wisps =
        `<path d="${band(-52, -40, 3, 0)}" fill="#5D79FF" opacity=".7"/>` +
        `<path d="${band(30, 40, 3, 70)}" fill="#2B3FC9" opacity=".7"/>` +
        `<ellipse cx="-30" cy="18" rx="22" ry="11" fill="#1E2B8F"/>` +
        `<path d="M-60,-20 q22,-6 44,0" stroke="#E8EEFF" stroke-width="5" fill="none" stroke-linecap="round"/>` +
        `<path d="M40,-55 q18,-5 36,0" stroke="#E8EEFF" stroke-width="5" fill="none" stroke-linecap="round"/>` +
        `<path d="M60,50 q16,-5 32,0" stroke="#E8EEFF" stroke-width="4" fill="none" stroke-linecap="round"/>`;
      return {
        base: `<radialGradient id="${id}b" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#7C93FF"/><stop offset="1" stop-color="#2B3FC9"/></radialGradient>`,
        fill: `url(#${id}b)`,
        surface: spinning(wisps),
        extra: detail ? `<g class="fx fx-wind">
            <path d="M-170,-50 q60,-20 120,0" /><path d="M-180,10 q70,-20 140,0" /><path d="M-170,70 q60,-20 120,0" /></g>` : '',
      };
    },
  };

  /* Build a planet. opts.detail adds the play-time extras. */
  function planet(key, opts = {}) {
    const id = 'ph' + (++uidCounter) + key.slice(0, 2);
    const d = DRAW[key](id, !!opts.detail);
    const shade = d.shade === false ? '' :
      `<circle r="${R}" fill="url(#${id}s)"/>`;
    return `
<svg class="planet-svg p-${key}" viewBox="-100 -100 200 200" overflow="visible" aria-hidden="true" focusable="false">
  <defs>
    ${d.base}
    <radialGradient id="${id}s" cx="38%" cy="32%" r="75%">
      <stop offset=".55" stop-color="#1A0E3A" stop-opacity="0"/>
      <stop offset="1" stop-color="#1A0E3A" stop-opacity=".38"/>
    </radialGradient>
    <radialGradient id="${id}h" cx="32%" cy="26%" r="40%">
      <stop offset="0" stop-color="#fff" stop-opacity=".55"/>
      <stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </radialGradient>
    <clipPath id="${id}c"><circle r="${R}"/></clipPath>
  </defs>
  <circle class="cut-shadow" cy="7" r="${R}" fill="#120A30" opacity=".5"/>
  ${d.back || ''}
  <g class="body">
    <circle r="${R}" fill="${d.fill}"/>
    <g clip-path="url(#${id}c)">${d.surface || ''}${d.caps || ''}${d.inner || ''}</g>
    ${shade}
    <circle r="${R}" fill="url(#${id}h)"/>
    <circle r="${R - 1.5}" fill="none" stroke="#FFF6E0" stroke-width="3" opacity=".55"/>
    ${face()}
  </g>
  ${d.front || ''}
  ${d.extra || ''}
</svg>`;
  }

  /* The giant Sun on the map: mostly off-screen, so its face sits on the
     visible edge. portrait = face below the centre instead of to the right. */
  function bigSun(radius, portrait) {
    const id = 'bs' + (++uidCounter);
    const n = 44, rr = radius;
    let rays = '';
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, w = Math.PI / n * 0.6;
      const p = (r, aa) => `${f(Math.cos(aa) * r)},${f(Math.sin(aa) * r)}`;
      const tip = rr + (i % 2 ? 48 : 78);
      const c = i % 2 ? '#FF9A1F' : '#FFC93C';
      rays += `<polygon points="${p(rr - 20, a - w)} ${p(tip, a)} ${p(rr - 20, a + w)}" fill="${c}" stroke="${c}" stroke-width="16" stroke-linejoin="round"/>`;
    }
    const fx = portrait ? 0 : rr * 0.62, fy = portrait ? rr * 0.62 : 0;
    const spots = [[.55, -.45, 40], [.35, .55, 55], [.8, .25, 30], [.2, -.75, 34], [.75, -.1, 22]]
      .map(([u, v, s], i) => {
        const x = portrait ? v * rr : u * rr, y = portrait ? u * rr : v * rr;
        return `<path d="${blob(x, y, s, s * .8, 50 + i)}" fill="#FFF3A6" opacity=".5"/>`;
      }).join('');
    const ext = rr + 90;
    return `
<svg class="bigsun-svg" viewBox="${-ext} ${-ext} ${2 * ext} ${2 * ext}" aria-hidden="true" focusable="false">
  <defs><radialGradient id="${id}g" cx="50%" cy="50%" r="50%">
    <stop offset=".55" stop-color="#FFF27A"/><stop offset=".85" stop-color="#FFC52E"/><stop offset="1" stop-color="#FF961E"/></radialGradient>
    <radialGradient id="${id}glow" cx="50%" cy="50%" r="50%">
    <stop offset=".7" stop-color="#FFB21E" stop-opacity=".35"/><stop offset="1" stop-color="#FFB21E" stop-opacity="0"/></radialGradient></defs>
  <circle r="${ext}" fill="url(#${id}glow)"/>
  <g class="bigsun-rays">${rays}</g>
  <circle r="${rr}" fill="url(#${id}g)"/>
  ${spots}
  <circle r="${rr - 4}" fill="none" stroke="#FFF6E0" stroke-width="7" opacity=".5"/>
  <g transform="translate(${fx},${fy}) scale(2.3)">${face()}</g>
</svg>`;
  }

  /* Pip the rocket, nose pointing up. */
  function rocket() {
    return `
<svg class="rocket-svg" viewBox="-60 -90 120 190" overflow="visible" aria-hidden="true" focusable="false">
  <g class="flame">
    <path d="M-16,46 Q-14,80 0,98 Q14,80 16,46Z" fill="#FF8A1E"/>
    <path d="M-9,46 Q-8,70 0,84 Q8,70 9,46Z" fill="#FFE45C"/>
  </g>
  <path d="M-26,18 L-50,52 Q-52,60 -44,60 L-22,48Z" fill="#FF5C9A" stroke="#22143F" stroke-width="4" stroke-linejoin="round"/>
  <path d="M26,18 L50,52 Q52,60 44,60 L22,48Z" fill="#FF5C9A" stroke="#22143F" stroke-width="4" stroke-linejoin="round"/>
  <path d="M0,-84 C30,-60 32,-10 28,48 L-28,48 C-32,-10 -30,-60 0,-84Z" fill="#FFF6E0" stroke="#22143F" stroke-width="4.5" stroke-linejoin="round"/>
  <path d="M0,-84 C14,-73 22,-60 25,-48 L-25,-48 C-22,-60 -14,-73 0,-84Z" fill="#FF5C9A" stroke="#22143F" stroke-width="4.5" stroke-linejoin="round"/>
  <path d="M-27,34 L27,34" stroke="#FFC23C" stroke-width="7"/>
  <rect x="-12" y="44" width="24" height="10" rx="3" fill="#7A6CFF" stroke="#22143F" stroke-width="4"/>
  <circle cx="0" cy="-14" r="19" fill="#5FE0C1" stroke="#22143F" stroke-width="4.5"/>
  <circle cx="-6" cy="-16" r="3" fill="#22143F"/><circle cx="6" cy="-16" r="3" fill="#22143F"/>
  <path d="M-6,-8 Q0,-3 6,-8" stroke="#22143F" stroke-width="3" fill="none" stroke-linecap="round"/>
  <circle cx="-9" cy="-10" r="2.6" fill="#FF5C9A" opacity=".6"/><circle cx="9" cy="-10" r="2.6" fill="#FF5C9A" opacity=".6"/>
  <path d="M-12,-26 a14,14 0 0 1 9,-5" stroke="#fff" stroke-width="3.5" fill="none" stroke-linecap="round" opacity=".9"/>
</svg>`;
  }

  /* A four-point twinkle star. */
  function twinkle(fill = '#FFF4D6') {
    return `<svg viewBox="-12 -12 24 24" aria-hidden="true"><path d="M0,-12 Q2,-2 12,0 Q2,2 0,12 Q-2,2 -12,0 Q-2,-2 0,-12Z" fill="${fill}"/></svg>`;
  }

  return { planet, bigSun, rocket, twinkle, R };
})();
