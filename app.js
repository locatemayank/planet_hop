/* Planet Hop — game logic.
   Screens: intro (blast off) → map (solar system) → detail (one planet). */
'use strict';
(() => {
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ORDER = BODIES.map(b => b.key);
  const flyName = k => (k === 'sun' ? 'the Sun' : BY_KEY[k].name);

  /* ---------------- saved progress ---------------- */
  const STORE = 'planetHop.v1';
  const save = { stickers: [], heard: {}, muted: false, allDone: false };
  try { Object.assign(save, JSON.parse(localStorage.getItem(STORE) || '{}')); } catch (e) { /* private mode */ }
  const persist = () => { try { localStorage.setItem(STORE, JSON.stringify(save)); } catch (e) { /* ignore */ } };
  const heardOf = k => (save.heard[k] = save.heard[k] || []);

  /* ---------------- input: instant taps, first finger only ---------------- */
  function onTap(el, fn) {
    let last = 0;
    el.addEventListener('pointerdown', e => {
      if (e.button > 0 || !e.isPrimary) return;
      last = Date.now();
      Sfx.unlock();
      fn(e);
    });
    el.addEventListener('click', e => {           // keyboard / assistive tech
      if (Date.now() - last < 900) return;
      fn(e);
    });
  }
  document.addEventListener('gesturestart', e => e.preventDefault());
  document.addEventListener('contextmenu', e => e.preventDefault());

  /* ---------------- sound effects (made on the fly, no files) ---------------- */
  const Sfx = (() => {
    let ctx = null, master = null, noiseBuf = null;
    function unlock() {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        // iPhone/iPad: let sound play even when the ringer switch is on silent (iOS 17+)
        try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { /* */ }
        ctx = new AC();
        master = ctx.createGain(); master.gain.value = 0.22; master.connect(ctx.destination);
        noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1.5, ctx.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    }
    function tone(freq, t0, dur, type = 'sine', vol = 1, freqEnd) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t0);
      if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + dur + 0.05);
    }
    function noise(t0, dur, f0, f1, vol = 1) {
      const src = ctx.createBufferSource(); src.buffer = noiseBuf;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.1;
      bp.frequency.setValueAtTime(f0, t0); bp.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + dur * 0.3);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(bp); bp.connect(g); g.connect(master); src.start(t0); src.stop(t0 + dur + 0.05);
    }
    function play(name) {
      if (save.muted || !unlock()) return;
      const t = ctx.currentTime + 0.01;
      switch (name) {
        case 'tap': tone(520, t, 0.14, 'sine', 0.8, 900); break;
        case 'pop': tone(760, t, 0.16, 'triangle', 0.9, 200); break;
        case 'boing': tone(170, t, 0.5, 'sine', 1, 560); tone(340, t + 0.05, 0.3, 'triangle', 0.3, 700); break;
        case 'sparkle': [1047, 1319, 1568, 2093].forEach((f, i) => tone(f, t + i * 0.07, 0.28, 'triangle', 0.45)); break;
        case 'star': tone(1568, t, 0.18, 'triangle', 0.5); tone(2093, t + 0.08, 0.3, 'triangle', 0.45); break;
        case 'count': tone(440, t, 0.22, 'square', 0.18); break;
        case 'whoosh': noise(t, 0.9, 300, 2600, 1.4); break;
        case 'blast': noise(t, 1.4, 1600, 120, 1.6); tone(110, t, 1.2, 'sawtooth', 0.15, 40); break;
        case 'fanfare':
          [523, 659, 784, 1047].forEach((f, i) => tone(f, t + i * 0.13, i === 3 ? 0.8 : 0.22, 'triangle', 0.7));
          [1319, 1568].forEach((f, i) => tone(f, t + 0.55 + i * 0.1, 0.5, 'sine', 0.35));
          break;
      }
    }
    return { play, unlock, ctx: () => ctx };
  })();

  /* ---------------- read-aloud voice ---------------- */
  const Voice = (() => {
    const synth = window.speechSynthesis;
    const keep = [];
    let voice = null, token = 0;
    const PREF = [/Samantha/i, /Google US English/i, /Aria/i, /Jenny/i, /Ava/i, /Allison/i, /Karen/i,
      /Moira/i, /Tessa/i, /Google UK English Female/i, /Serena/i, /Zira/i, /Susan/i];
    function pick() {
      if (!synth) return;
      const vs = synth.getVoices().filter(v => /^en/i.test(v.lang));
      if (!vs.length) return;
      for (const re of PREF) { const v = vs.find(x => re.test(x.name)); if (v) { voice = v; return; } }
      voice = vs.find(v => /en[-_]US/i.test(v.lang)) || vs[0];
    }
    if (synth) { pick(); if (synth.addEventListener) synth.addEventListener('voiceschanged', pick); else synth.onvoiceschanged = pick; }

    // recorded clips (voice/<id>.mp3) are played through WebAudio; decoded clips are kept in memory
    const LINES = window.VOICE_LINES || {};
    const bufs = {}, loading = {};
    let src = null, analyser = null, levelData = null, el = null;
    function load(id, cb) {
      if (bufs[id]) { cb(bufs[id]); return; }
      (loading[id] = loading[id] || []).push(cb);
      if (loading[id].length > 1) return;
      const done = b => { const l = loading[id] || []; delete loading[id]; if (b) bufs[id] = b; l.forEach(f => f(b)); };
      const ctx = Sfx.ctx();
      if (!ctx) { done(null); return; }
      const x = new XMLHttpRequest();                 // XHR + callback decode: works on old Safari too
      x.open('GET', 'voice/' + id + '.mp3'); x.responseType = 'arraybuffer';
      x.onload = () => {
        if (x.status && x.status !== 200) { done(null); return; }
        try {
          const p = ctx.decodeAudioData(x.response, done, () => done(null));
          if (p && p.catch) p.catch(() => done(null));
        } catch (e) { done(null); }
      };
      x.onerror = () => done(null);
      x.send();
    }
    // which clip(s) say this text: one clip, or two back to back ("Hi! I'm Saturn!" + "Tap a bubble…")
    function clipsFor(text) {
      if (LINES[text]) return [LINES[text]];
      for (let i = text.indexOf(' '); i > 0; i = text.indexOf(' ', i + 1)) {
        const a = LINES[text.slice(0, i)], b = LINES[text.slice(i + 1)];
        if (a && b) return [a, b];
      }
      return null;
    }
    // warm up the clips we are about to need (e.g. while the rocket flies)
    function preload(texts) {
      if (Sfx.ctx()) texts.forEach(t => (clipsFor(t) || []).forEach(id => load(id, () => {})));
    }

    function stopClip() {
      if (src) { try { src.onended = null; src.stop(); } catch (e) { /* already stopped */ } src = null; }
      if (el) { el.onended = el.onerror = null; try { el.pause(); } catch (e) { /* */ } }
    }
    function playBuffer(buf, finish) {
      const ctx = Sfx.ctx();
      if (!analyser) {
        analyser = ctx.createAnalyser(); analyser.fftSize = 512;
        levelData = new Uint8Array(analyser.fftSize);
        analyser.connect(ctx.destination);
      }
      src = ctx.createBufferSource(); src.buffer = buf;
      src.connect(analyser);
      src.onended = finish;
      src.start(0);
    }
    // no WebAudio at all (very old browser): plain <audio>
    function playElement(id, finish, fail) {
      if (!el) el = new Audio();
      el.onended = finish; el.onerror = fail;
      el.src = 'voice/' + id + '.mp3';
      const p = el.play();
      if (p && p.catch) p.catch(fail);
    }
    // mouth opening 0..1 from the clip's loudness (null when we can't measure it)
    function level() {
      if (!src || !analyser) return null;
      analyser.getByteTimeDomainData(levelData);
      let s = 0;
      for (let i = 0; i < levelData.length; i++) { const v = (levelData[i] - 128) / 128; s += v * v; }
      return Math.sqrt(s / levelData.length);
    }

    function synthSpeak(text, finish, est) {
      try {
        synth.cancel(); synth.resume();
        const u = new SpeechSynthesisUtterance(text);
        if (voice) { u.voice = voice; u.lang = voice.lang; } else u.lang = 'en-US';
        u.rate = 0.9; u.pitch = 1.15; u.volume = 1;
        u.onend = finish; u.onerror = finish;
        keep.push(u); if (keep.length > 6) keep.shift();   // stop Chrome dropping callbacks
        synth.speak(u);
        return true;
      } catch (e) { return false; }
    }

    function speak(text, onEnd) {
      const my = ++token;
      let fired = false, timer;
      const finish = () => {
        if (fired) return; fired = true; clearTimeout(timer);
        if (my === token) { src = null; Talk.stop(); if (onEnd) onEnd(); }
      };
      const est = 700 + text.length * 62;
      stopClip(); if (synth) synth.cancel();
      if (save.muted) { timer = setTimeout(finish, est); return; }
      timer = setTimeout(finish, est + 6000);           // safety net if no "ended" ever arrives
      const fallback = () => {
        if (my !== token || fired) return;
        clearTimeout(timer);
        if (synth && synthSpeak(text, finish)) timer = setTimeout(finish, est + 5000);
        else timer = setTimeout(finish, est);
      };
      const ids = clipsFor(text);
      if (!ids) { fallback(); return; }
      if (Sfx.ctx()) {
        const got = [];
        let left = ids.length;
        ids.forEach((id, i) => load(id, buf => {
          got[i] = buf;
          if (--left || my !== token || fired) return;
          if (got.some(b => !b)) { fallback(); return; }
          clearTimeout(timer);
          timer = setTimeout(finish, got.reduce((s, b) => s + b.duration, 0) * 1000 + 1500);
          let k = 0;
          const next = () => {
            if (my !== token || fired) return;
            if (k === got.length) { finish(); return; }
            try { playBuffer(got[k++], () => setTimeout(next, k < got.length ? 180 : 0)); } catch (e) { fallback(); }
          };
          next();
        }));
      } else {
        let k = 0;
        const next = () => {
          if (my !== token || fired) return;
          if (k === ids.length) { finish(); return; }
          try { playElement(ids[k++], next, fallback); } catch (e) { fallback(); }
        };
        next();
      }
    }
    function stop() { token++; stopClip(); Talk.stop(); if (synth) synth.cancel(); }
    return { speak, stop, preload, level };
  })();

  /* make the close-up planet "talk" while the voice speaks */
  const Talk = (() => {
    let iv = null, svg = null;
    function start(s) {
      stop(); svg = s; if (!svg || reduceMotion) return;
      let n = 0, open = false;
      iv = setInterval(() => {
        const lv = Voice.level();
        // with a recorded clip the mouth follows the voice; otherwise it just flaps
        const want = lv == null ? (n++ % 4 < 2) : (open ? lv > 0.035 : lv > 0.06);
        if (want !== open) { open = want; svg.classList.toggle('happy-mouth', open); }
      }, 60);
    }
    function stop() { clearInterval(iv); iv = null; if (svg) svg.classList.remove('happy-mouth'); }
    return { start, stop };
  })();

  /* say something with the close-up planet's mouth moving */
  function planetSays(text, onEnd) {
    const svg = $('#bigplanet .planet-svg');
    setCaption(text);
    Voice.speak(text, onEnd);
    if (screen === 'detail') Talk.start(svg);
  }

  /* ---------------- icons ---------------- */
  const ICON = {
    home: `<svg viewBox="0 0 48 48"><ellipse cx="24" cy="25" rx="21" ry="9" fill="none" stroke="#22143F" stroke-width="4" transform="rotate(-18 24 25)"/><circle cx="24" cy="25" r="9.5" fill="#FF5C9A" stroke="#22143F" stroke-width="4"/><circle cx="41" cy="17" r="4" fill="#22143F"/></svg>`,
    prev: `<svg viewBox="0 0 48 48"><path d="M30 8 L12 24 L30 40" fill="none" stroke="#FFF4D6" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    next: `<svg viewBox="0 0 48 48"><path d="M18 8 L36 24 L18 40" fill="none" stroke="#FFF4D6" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    sound: `<svg viewBox="0 0 48 48"><g class="on-i"><path d="M8 18h8l11-9v30l-11-9H8z" fill="#FFF4D6"/><path d="M33 17q5 7 0 14M38 12q9 12 0 24" fill="none" stroke="#FFF4D6" stroke-width="4" stroke-linecap="round"/></g><g class="off"><path d="M8 18h8l11-9v30l-11-9H8z" fill="#FFF4D6" opacity=".6"/><path d="M33 18l10 12M43 18L33 30" stroke="#FF5C9A" stroke-width="5" stroke-linecap="round"/></g></svg>`,
    book: `<svg viewBox="0 0 48 48"><path d="M7 10q9-4 17 2q8-6 17-2v28q-9-4-17 2q-8-6-17-2z" fill="#FFF4D6" stroke="#22143F" stroke-width="3.5" stroke-linejoin="round"/><path d="M24 12v28" stroke="#22143F" stroke-width="3"/><path d="M15 17l1.6 3.4 3.6.4-2.7 2.4.8 3.6-3.3-1.9-3.3 1.9.8-3.6-2.7-2.4 3.6-.4z" fill="#FFC23C"/></svg>`,
    close: `<svg viewBox="0 0 48 48"><path d="M13 13l22 22M35 13L13 35" stroke="#FFF4D6" stroke-width="7" stroke-linecap="round"/></svg>`,
  };
  $$('.btn-home').forEach(b => (b.innerHTML = ICON.home));
  $('#prevBtn').innerHTML = ICON.prev;
  $('#nextBtn').innerHTML = ICON.next;
  $$('[data-sound]').forEach(b => (b.innerHTML = ICON.sound));
  $$('[data-open-book]').forEach(b => (b.innerHTML = ICON.book + '<span class="count"></span>'));
  $('#bookClose').innerHTML = ICON.close;

  /* ---------------- sky ---------------- */
  function buildSky() {
    const sky = $('#sky');
    let r = 7;
    const rand = () => ((r = (r * 16807) % 2147483647) / 2147483647);
    const sh = [];
    for (let i = 0; i < 160; i++) {
      sh.push(`${(rand() * 100).toFixed(2)}vw ${(rand() * 100).toFixed(2)}vh 0 ${(rand() * 1.4).toFixed(1)}px rgba(255,244,214,${(0.25 + rand() * 0.6).toFixed(2)})`);
    }
    const dots = document.createElement('div'); dots.className = 'dots'; dots.style.boxShadow = sh.join(','); sky.appendChild(dots);
    const cols = ['#FFF4D6', '#FFC23C', '#5FE0C1', '#FF9DC4'];
    for (let i = 0; i < 16; i++) {
      const t = document.createElement('div'); t.className = 'tw';
      t.style.left = (rand() * 96).toFixed(1) + 'vw'; t.style.top = (rand() * 96).toFixed(1) + 'vh';
      t.style.animationDelay = (-rand() * 3.2).toFixed(2) + 's';
      const sz = 1.6 + rand() * 2.4; t.style.width = t.style.height = sz.toFixed(1) + 'vmin';
      t.innerHTML = Art.twinkle(cols[i % cols.length]);
      sky.appendChild(t);
    }
  }
  buildSky();

  /* ---------------- screens ---------------- */
  let screen = 'intro';
  let busy = false;
  function show(name) {
    screen = name;
    $$('.screen').forEach(s => s.classList.toggle('on', s.id === name));
    hideHand();
  }

  /* ---------------- confetti of little stars ---------------- */
  function confetti(x, y, n = 26, spread = 1) {
    if (reduceMotion) return;
    const cols = ['#FFC23C', '#FF5C9A', '#5FE0C1', '#FFF4D6', '#7A6CFF'];
    const vm = Math.min(innerWidth, innerHeight) / 100;
    for (let i = 0; i < n; i++) {
      const c = document.createElement('div'); c.className = 'confetti';
      c.innerHTML = Art.twinkle(cols[i % cols.length]);
      document.body.appendChild(c);
      const a = Math.random() * Math.PI * 2, dist = (18 + Math.random() * 32) * vm * spread;
      const dx = Math.cos(a) * dist, dy = Math.sin(a) * dist;
      const s = 0.6 + Math.random() * 0.9;
      c.animate([
        { transform: `translate(${x}px,${y}px) scale(.2) rotate(0deg)`, opacity: 1 },
        { transform: `translate(${x + dx}px,${y + dy}px) scale(${s}) rotate(${200 * (Math.random() - 0.5)}deg)`, opacity: 1, offset: 0.6 },
        { transform: `translate(${x + dx}px,${y + dy + 12 * vm}px) scale(${s * 0.6}) rotate(${300 * (Math.random() - 0.5)}deg)`, opacity: 0 },
      ], { duration: 1300 + Math.random() * 700, easing: 'cubic-bezier(.2,.7,.4,1)' }).onfinish = () => c.remove();
    }
  }
  const centerOf = el => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, r }; };

  /* ---------------- pointing-hand hints ---------------- */
  const hand = $('#hand');
  let idleT = null, hintsSpoken = { map: 0, detail: 0 };
  function pointAt(el) {
    if (!el) return;
    const { x, y, r } = centerOf(el);
    const hw = hand.offsetWidth || 80;
    hand.style.display = 'block';
    hand.style.left = (x - hw * 0.42) + 'px';
    hand.style.top = Math.min(innerHeight - hw, y + r.height * 0.22) + 'px';
  }
  function hideHand() { hand.style.display = 'none'; }
  function resetIdle() {
    clearTimeout(idleT); hideHand();
    idleT = setTimeout(idleHint, 9000);
  }
  document.addEventListener('pointerdown', resetIdle, true);
  function idleHint() {
    if (busy || $('#book').classList.contains('on') || $('#sticker').classList.contains('on')) { resetIdle(); return; }
    if (screen === 'map') {
      const k = ORDER.find(k => k !== 'sun' && !save.stickers.includes(k)) || 'earth';
      pointAt(planetEls[k]);
      if (hintsSpoken.map++ < 2) Voice.speak("Tap a planet, and let's fly there!");
    } else if (screen === 'detail') {
      const unheard = $$('.orb').find(o => !o.classList.contains('heard'));
      if (unheard) {
        pointAt(unheard);
        if (hintsSpoken.detail++ < 3) planetSays('Tap a bubble to hear about me!');
      } else {
        pointAt($('#nextBtn'));
        if (hintsSpoken.detail++ < 3) planetSays("Tap the arrow to fly to the next planet!");
      }
    }
    clearTimeout(idleT);
    idleT = setTimeout(idleHint, 15000);
  }

  /* ---------------- sound button + book counts ---------------- */
  function syncMute() { document.body.classList.toggle('muted', !!save.muted); }
  syncMute();
  $$('[data-sound]').forEach(b => onTap(b, () => {
    save.muted = !save.muted; persist(); syncMute();
    if (save.muted) Voice.stop(); else { Sfx.play('tap'); Voice.speak('Sound on!'); }
  }));
  function syncCounts() {
    $$('.btn-book .count').forEach(c => (c.textContent = save.stickers.length));
    BODIES.forEach(b => planetEls[b.key] && planetEls[b.key].classList.toggle('has-sticker', save.stickers.includes(b.key)));
  }

  /* =========================================================
     1. INTRO
     ========================================================= */
  const WORD = 'Planet Hop';
  const WCOL = ['#FFC23C', '#FF5C9A', '#5FE0C1', '#FF8F5E', '#7EDCE2', '#FFC23C', null, '#7A9BFF', '#FF5C9A', '#5FE0C1'];
  $('.wordmark').innerHTML = [...WORD].map((ch, i) => ch === ' ' ? '<span class="gap"></span>' :
    `<span style="--c:${WCOL[i]};--r:${(i % 2 ? 4 : -4)}deg;--y:${i % 3 === 0 ? '-.05em' : '.03em'}">${ch}</span>`).join('');
  const pad = $('#launchpad');
  pad.insertAdjacentHTML('beforeend', Art.rocket());
  let launched = false;

  onTap(pad, () => {
    if (launched) return;
    launched = true;
    maybeFullscreen();
    const cd = $('#countdown');
    Voice.speak('Three, two, one. Blast off!');
    Voice.preload(["Here is our solar system! Tap a planet, and let's fly there!",
      "Hi! I'm Pip, your rocket! Tap a planet, and I'll fly you there!", "Tap a planet, and let's fly there!"]);
    pad.classList.add('shake');
    let n = 3;
    const step = () => {
      if (n > 0) {
        cd.innerHTML = `<span>${n}</span>`; Sfx.play('count'); n--;
        setTimeout(step, reduceMotion ? 300 : 820);
      } else {
        cd.innerHTML = '';
        pad.classList.remove('shake'); pad.classList.add('launch');
        Sfx.play('blast'); puffs();
        setTimeout(enterMap, reduceMotion ? 200 : 1000);
      }
    };
    step();
  });

  function puffs() {
    if (reduceMotion) return;
    const { x, r } = centerOf(pad);
    for (let i = 0; i < 14; i++) {
      const p = document.createElement('div'); p.className = 'puff';
      const s = 20 + Math.random() * 40;
      p.style.width = p.style.height = s + 'px';
      p.style.left = (x - s / 2) + 'px'; p.style.top = (r.bottom - s / 2) + 'px';
      p.style.position = 'fixed';
      document.body.appendChild(p);
      const dx = (Math.random() - 0.5) * 300, dy = 20 + Math.random() * 60;
      p.animate([{ transform: 'scale(.3)', opacity: 0.9 }, { transform: `translate(${dx}px,${dy}px) scale(1.6)`, opacity: 0 }],
        { duration: 1100 + Math.random() * 500, easing: 'ease-out' }).onfinish = () => p.remove();
    }
  }

  function maybeFullscreen() {
    const coarse = matchMedia('(pointer: coarse)').matches;
    const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    const el = document.documentElement;
    if (coarse && !standalone && el.requestFullscreen && !document.fullscreenElement) {
      el.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
    }
  }

  /* =========================================================
     2. SOLAR SYSTEM MAP
     ========================================================= */
  const stage = $('#stage');
  const planetEls = {};
  const rocketEl = $('#maprocket');
  rocketEl.innerHTML = Art.rocket();
  const M = { portrait: null, W: 1600, H: 900, s: 1, ox: 0, oy: 0, P: {}, frozen: null, flying: false,
    rocket: { x: 0, y: 0, at: 'home' } };
  const RW = 90, RH = 142;                 // rocket box on the map
  const tr = (x, y) => (M.portrait ? { x: y, y: x } : { x, y });   // landscape → current

  // build planets once
  BODIES.slice(1).forEach(b => {
    const m = MAP.planets[b.key];
    const el = document.createElement('div');
    el.className = `mp p-${b.key}`;
    el.style.width = el.style.height = m.d + 'px';
    el.setAttribute('role', 'button'); el.setAttribute('tabindex', '0'); el.setAttribute('aria-label', b.name);
    el.innerHTML = `<div class="hit"></div>${Art.planet(b.key)}<div class="label">${b.name}</div><div class="badge">${Art.twinkle('#FFC23C')}</div>`;
    $('#planets').appendChild(el);
    planetEls[b.key] = el;
    onTap(el, () => pickBody(b.key));
    el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pickBody(b.key); } });
  });
  const bigsun = $('#bigsun');
  onTap(bigsun, () => pickBody('sun'));
  bigsun.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pickBody('sun'); } });
  planetEls.sun = bigsun;

  onTap(rocketEl, () => {
    if (busy || M.flying) return;
    Sfx.play('boing');
    rocketEl.animate([{ transform: rocketEl.style.transform }, { transform: rocketEl.style.transform + ' rotate(-14deg) scale(1.15)' },
      { transform: rocketEl.style.transform + ' rotate(12deg)' }, { transform: rocketEl.style.transform }], { duration: 700 });
    Voice.speak("Hi! I'm Pip, your rocket! Tap a planet, and I'll fly you there!");
  });

  function setStageT(X, Y, S, px, py) {
    stage.style.transform = `translate(${X}px,${Y}px) scale(${S}) translate(${-px}px,${-py}px)`;
  }
  const setStageNormal = () => setStageT(M.ox, M.oy, M.s, 0, 0);

  /* The stage is 1600 long (away from the Sun) × 900 across. Screens wider
     than 16:9 stretch the orbits outward; squarer screens fan the planets
     out across a taller stage. Either way the map fills the screen. */
  function orbitR(m) { return m.r + (m.r - MAP.sun.r) / (1650 - MAP.sun.r) * (M.L - 1600); }
  function layoutMap() {
    const portrait = innerHeight > innerWidth * 1.05;
    const q = portrait ? innerHeight / innerWidth : innerWidth / innerHeight;   // long ÷ short
    const L = Math.round(Math.min(1950, Math.max(1600, 900 * q)));
    const A = Math.round(Math.min(1250, Math.max(900, 1600 / q)));
    const rebuild = portrait !== M.portrait || L !== M.L || A !== M.A;
    M.portrait = portrait; M.L = L; M.A = A;
    M.k = A / 900;                                   // angle fan-out
    M.cy = A / 2;                                    // Sun centre (across axis)
    M.W = portrait ? A : L; M.H = portrait ? L : A;
    M.s = Math.min(innerWidth / M.W, innerHeight / M.H);
    M.ox = (innerWidth - M.W * M.s) / 2; M.oy = (innerHeight - M.H * M.s) / 2;
    stage.style.width = M.W + 'px'; stage.style.height = M.H + 'px';
    stage.classList.remove('zooming');
    setStageNormal();
    // small screens: grow planets so Earth is at least ~62px for little fingers
    M.g = Math.min(1.5, Math.max(1, 62 / (M.s * MAP.planets.earth.d)));
    BODIES.slice(1).forEach(b => {
      const d = MAP.planets[b.key].d * M.g;
      planetEls[b.key].style.width = planetEls[b.key].style.height = d + 'px';
    });
    // keep planets out from under the corner buttons (in stage units)
    const hr = $('.map-hud').getBoundingClientRect();
    M.hud = { x0: (hr.left - M.ox) / M.s - 12, y1: (hr.bottom - M.oy) / M.s + 12 };
    if (rebuild) {
      const sc = tr(MAP.sun.cx, M.cy);
      const orb = $('#orbits');
      orb.setAttribute('width', M.W); orb.setAttribute('height', M.H);
      orb.innerHTML = Object.values(MAP.planets).map(p => `<circle cx="${sc.x}" cy="${sc.y}" r="${orbitR(p).toFixed(1)}"/>`).join('');
      const ext = MAP.sun.r + 90;
      bigsun.style.left = (sc.x - ext) + 'px'; bigsun.style.top = (sc.y - ext) + 'px';
      bigsun.style.width = bigsun.style.height = (2 * ext) + 'px';
      bigsun.innerHTML = Art.bigSun(MAP.sun.r, portrait);
      placePlanets(performance.now());
      placeRocketParked();
    }
  }

  function placePlanets(t) {
    BODIES.slice(1).forEach((b, i) => {
      if (M.frozen === b.key && M.P[b.key]) return;
      const m = MAP.planets[b.key];
      const sway = reduceMotion ? 0 : 2.4 * Math.sin(t / (4200 + i * 650) + i * 1.7);
      const r = orbitR(m);
      // upright screens are narrow: zig-zag the planets out toward both sides
      const base = M.portrait
        ? Math.sign(m.a) * Math.asin(Math.min(0.6 * r, 0.6 * M.A / 2) / r) * 180 / Math.PI
        : m.a * M.k;
      const a = (base + sway) * Math.PI / 180;
      const p = tr(MAP.sun.cx + r * Math.cos(a), M.cy + r * Math.sin(a));
      const d = m.d * M.g, h = d / 2;
      const ringW = b.key === 'saturn' ? h * 0.55 : 0;          // rings stick out sideways
      if (M.portrait) {                                        // keep labels on screen
        const lo = Math.max(h + ringW, 95) + 10;
        p.x = Math.min(M.A - lo, Math.max(lo, p.x));
        p.y = Math.min(M.L - h - 84, p.y);
      } else {
        let lo = h + 14;
        if (p.x + h + ringW > M.hud.x0) lo = Math.max(lo, M.hud.y1 + h);
        const hi = M.A - h - (b.key === 'saturn' ? 34 : 18) - 56;  // room for the name tag
        p.y = Math.min(hi, Math.max(lo, p.y));
      }
      M.P[b.key] = { x: p.x, y: p.y, d };
      planetEls[b.key].style.transform = `translate(${p.x - h}px,${p.y - h}px)`;
    });
  }

  // where Pip parks: beside a planet (on the Sun side), or on the Sun's rim
  function parkPoint(key) {
    if (key === 'home' || key === 'sun') {
      const a = 34 * Math.PI / 180, rr = MAP.sun.r + 95;
      return tr(MAP.sun.cx + rr * Math.cos(a), M.cy + rr * Math.sin(a));
    }
    const p = M.P[key], sc = tr(MAP.sun.cx, M.cy);
    const dx = sc.x - p.x, dy = sc.y - p.y, L = Math.hypot(dx, dy);
    const off = (key === 'saturn' ? p.d * 0.78 : p.d / 2) + 62;
    return { x: p.x + dx / L * off, y: p.y + dy / L * off };
  }
  function setRocket(x, y, rot) {
    M.rocket.x = x; M.rocket.y = y;
    rocketEl.style.transform = `translate(${x - RW / 2}px,${y - RH / 2}px) rotate(${rot}deg)`;
  }
  function placeRocketParked() {
    if (M.flying) return;
    const p = parkPoint(M.rocket.at);
    setRocket(p.x, p.y, 0);
  }

  function frame(t) {
    requestAnimationFrame(frame);
    if (screen !== 'map') return;
    placePlanets(t);
    placeRocketParked();
  }
  requestAnimationFrame(frame);
  addEventListener('resize', () => { layoutMap(); });

  function enterMap() {
    layoutMap();
    syncCounts();
    show('map');
    Voice.speak("Here is our solar system! Tap a planet, and let's fly there!");
    resetIdle();
  }

  // every recorded line a planet's close-up can say (fetched ahead so it plays instantly)
  function bodyLines(key) {
    const b = BY_KEY[key];
    return [b.hello, b.hello + ' Tap a bubble to hear about me!', b.play, ...b.facts.map(f => f.text),
      `Yay! You got the ${flyName(key)} sticker!`, `Let's fly to ${flyName(key)}!`];
  }

  function pickBody(key) {
    if (busy || screen !== 'map') return;
    busy = true; hideHand(); clearTimeout(idleT);
    Sfx.play('tap');
    Voice.speak(`Let's fly to ${flyName(key)}!`);
    Voice.preload(bodyLines(key));
    const el = planetEls[key];
    el.classList.remove('picked'); void el.offsetWidth; el.classList.add('picked');
    if (key === 'sun') {
      const svg = bigsun.querySelector('svg'); svg.classList.add('happy');
      setTimeout(() => svg.classList.remove('happy'), 1600);
    }
    M.frozen = key;
    flyRocketTo(key, () => zoomInto(key, () => {
      openDetail(key, { fromMap: true });
      el.classList.remove('picked');
      M.frozen = null;
      busy = false;
    }));
  }

  function flyRocketTo(key, done) {
    const from = { x: M.rocket.x, y: M.rocket.y };
    const to = parkPoint(key);
    const dx = to.x - from.x, dy = to.y - from.y, dist = Math.hypot(dx, dy);
    if (dist < 30 || reduceMotion) { M.rocket.at = key; placeRocketParked(); setTimeout(done, 250); return; }
    const bend = (M.portrait ? -1 : 1) * 0.28;
    const c = { x: (from.x + to.x) / 2 - dy * bend, y: (from.y + to.y) / 2 + dx * bend };
    const dur = Math.min(1500, 650 + dist * 0.55);
    M.flying = true;
    rocketEl.classList.remove('idle'); rocketEl.classList.add('flying');
    Sfx.play('whoosh');
    const cols = ['#FFC23C', '#FF5C9A', '#5FE0C1', '#FFF4D6'];
    const t0 = performance.now();
    let lastTrail = 0, n = 0;
    const ease = u => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2);
    const step = now => {
      const u = Math.min(1, (now - t0) / dur), e = ease(u);
      const x = (1 - e) * (1 - e) * from.x + 2 * (1 - e) * e * c.x + e * e * to.x;
      const y = (1 - e) * (1 - e) * from.y + 2 * (1 - e) * e * c.y + e * e * to.y;
      const tx = 2 * (1 - e) * (c.x - from.x) + 2 * e * (to.x - c.x);
      const ty = 2 * (1 - e) * (c.y - from.y) + 2 * e * (to.y - c.y);
      const rot = Math.atan2(ty, tx) * 180 / Math.PI + 90;
      setRocket(x, y, u > 0.92 ? rot * (1 - (u - 0.92) / 0.08) : rot);
      if (now - lastTrail > 38 && u < 0.97) {
        lastTrail = now;
        const L = Math.hypot(tx, ty) || 1;
        const d = document.createElement('div'); d.className = 'trail';
        d.style.background = cols[n++ % cols.length];
        const bx = x - tx / L * 70, by = y - ty / L * 70;
        d.style.left = bx + 'px'; d.style.top = by + 'px';
        stage.appendChild(d);
        d.animate([{ transform: 'scale(1)', opacity: 0.95 }, { transform: 'scale(.1)', opacity: 0 }], { duration: 650, easing: 'ease-out' }).onfinish = () => d.remove();
      }
      if (u < 1) requestAnimationFrame(step);
      else {
        M.flying = false; M.rocket.at = key;
        rocketEl.classList.remove('flying'); rocketEl.classList.add('idle');
        setRocket(to.x, to.y, 0);
        done();
      }
    };
    requestAnimationFrame(step);
  }

  function focusPoint(key) {
    if (key === 'sun') return tr(MAP.sun.cx + MAP.sun.r * 0.62, M.cy);
    return M.P[key];
  }
  function zoomFactor(key) {
    const target = Math.min(innerHeight * 0.58, innerWidth * 0.4);
    const d = key === 'sun' ? 260 : M.P[key].d;
    return Math.max(1.6, target / (M.s * d));
  }
  function zoomInto(key, done) {
    const p = focusPoint(key), z = zoomFactor(key);
    stage.classList.remove('zooming');
    setStageT(M.ox + M.s * p.x, M.oy + M.s * p.y, M.s, p.x, p.y);
    void stage.offsetWidth;
    if (!reduceMotion) stage.classList.add('zooming');
    setStageT(innerWidth / 2, innerHeight / 2, M.s * z, p.x, p.y);
    setTimeout(done, reduceMotion ? 50 : 480);
  }
  function zoomOutFrom(key) {
    const p = focusPoint(key), z = zoomFactor(key);
    stage.classList.remove('zooming');
    setStageT(innerWidth / 2, innerHeight / 2, M.s * z, p.x, p.y);
    void stage.offsetWidth;
    if (!reduceMotion) stage.classList.add('zooming');
    setStageT(M.ox + M.s * p.x, M.oy + M.s * p.y, M.s, p.x, p.y);
    setTimeout(() => { stage.classList.remove('zooming'); setStageNormal(); }, 800);
  }

  /* =========================================================
     3. PLANET CLOSE-UP
     ========================================================= */
  let cur = null, playing = false;
  const big = $('#bigplanet');

  function setCaption(text) {
    const c = $('#caption');
    c.textContent = text;
    c.classList.remove('talk'); void c.offsetWidth; c.classList.add('talk');
  }

  function renderStars() {
    const n = heardOf(cur).length;
    $$('#dstars i').forEach((s, i) => s.classList.toggle('lit', i < n));
  }

  function openDetail(key, opts = {}) {
    cur = key;
    const b = BY_KEY[key];
    document.documentElement.style.setProperty('--pc', b.color);
    $('#detail').setAttribute('aria-label', b.name);
    const nm = $('#dname');
    nm.classList.remove('drop');
    nm.innerHTML = [...b.name].map((ch, i) => `<span style="--i:${i}">${ch}</span>`).join('');
    void nm.offsetWidth; nm.classList.add('drop');
    $('#dstars').innerHTML = b.facts.map(() => `<i>${Art.twinkle()}</i>`).join('');
    big.innerHTML = Art.planet(key, { detail: true });
    big.setAttribute('aria-label', `Tap ${b.name}`);
    big.className = '';
    if (opts.pop) { void big.offsetWidth; big.classList.add('pop'); }
    const heard = heardOf(key);
    const orb = (f, i) => `<button class="orb${heard.includes(i) ? ' heard' : ''}" style="--i:${i}" data-i="${i}" aria-label="Fact ${i + 1}">${f.icon}<span class="tick">${Art.twinkle('#FFC23C')}</span></button>`;
    $('#factsL').innerHTML = b.facts.slice(0, 2).map((f, i) => orb(f, i)).join('');
    $('#factsR').innerHTML = b.facts.slice(2).map((f, i) => orb(f, i + 2)).join('');
    $$('.orb').forEach(o => onTap(o, () => tellFact(+o.dataset.i)));
    renderStars();
    playing = false;
    if (screen !== 'detail') show('detail');
    const first = heard.length === 0;
    planetSays(b.hello + (first ? ' Tap a bubble to hear about me!' : ''));
    Voice.preload(bodyLines(key));
    const ni = ORDER.indexOf(key);           // neighbours, ready for the arrows
    Voice.preload(bodyLines(ORDER[(ni + 1) % ORDER.length]).slice(0, 2));
    resetIdle();
  }

  function tellFact(i) {
    if (busy || $('#sticker').classList.contains('on')) return;
    const b = BY_KEY[cur];
    const f = b.facts[i];
    Sfx.play('pop');
    $$('.orb').forEach(o => o.classList.remove('talking'));
    const el = $(`.orb[data-i="${i}"]`);
    el.classList.add('talking');
    const heard = heardOf(cur);
    const isNew = !heard.includes(i);
    if (isNew) {
      heard.push(i); persist();
      el.classList.add('heard');
      setTimeout(() => { Sfx.play('star'); renderStars(); }, 250);
      const s = centerOf(el); confetti(s.x, s.y, 8, 0.35);
    }
    const key = cur;
    planetSays(f.text, () => {
      el.classList.remove('talking');
      if (key === cur && heard.length === b.facts.length && !save.stickers.includes(cur)) giveSticker(cur);
    });
  }

  onTap(big, () => {
    if (playing || busy || !cur) return;
    const svg = big.querySelector('.planet-svg');
    playing = true;
    svg.classList.add('play', 'happy');
    Sfx.play('boing');
    if (cur === 'saturn') setTimeout(() => Sfx.play('sparkle'), 300);
    if (cur === 'neptune' || cur === 'jupiter' || cur === 'mercury') setTimeout(() => Sfx.play('whoosh'), 150);
    planetSays(BY_KEY[cur].play);
    setTimeout(() => { svg.classList.remove('play', 'happy'); playing = false; }, 2700);
  });
  big.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); big.dispatchEvent(new MouseEvent('click')); } });

  function step(dir) {
    if (busy || !cur) return;
    busy = true;
    Voice.stop();
    const idx = (ORDER.indexOf(cur) + dir + ORDER.length) % ORDER.length;
    const next = ORDER[idx];
    Sfx.play('whoosh');
    big.className = dir > 0 ? 'out-l' : 'out-r';
    setTimeout(() => {
      M.rocket.at = next;
      openDetail(next, { pop: true });
      busy = false;
    }, reduceMotion ? 20 : 340);
  }
  onTap($('#prevBtn'), () => step(-1));
  onTap($('#nextBtn'), () => step(1));

  onTap($('#homeBtn'), () => {
    if (busy) return;
    busy = true;
    Voice.stop();
    Sfx.play('tap');
    const from = cur;
    M.rocket.at = from;
    layoutMap();
    placePlanets(performance.now());
    placeRocketParked();
    syncCounts();
    zoomOutFrom(from);
    show('map');
    setTimeout(() => {
      busy = false;
      if (save.stickers.length === ORDER.length && !save.allDone) celebrateAll();
      resetIdle();
    }, 650);
  });

  /* ---------------- stickers ---------------- */
  let stickerTimer = null;
  function giveSticker(key) {
    if (save.stickers.includes(key)) return;
    save.stickers.push(key); persist();
    const ov = $('#sticker');
    $('#stickerDisc').innerHTML = Art.planet(key);
    $('#stickerDisc').style.animation = 'none'; void ov.offsetWidth; $('#stickerDisc').style.animation = '';
    $('#stickerText').textContent = `${BY_KEY[key].name} sticker!`;
    ov.classList.add('on');
    Sfx.play('fanfare');
    setTimeout(() => confetti(innerWidth / 2, innerHeight * 0.42, 36, 1.2), 150);
    let spoken = false, minTime = false;
    const tryClose = () => { if (spoken && minTime) stickerAway(); };
    Voice.speak(`Yay! You got the ${flyName(key)} sticker!`, () => { spoken = true; tryClose(); });
    stickerTimer = setTimeout(() => { minTime = true; tryClose(); }, 2200);
  }
  function stickerAway() {
    const ov = $('#sticker');
    if (!ov.classList.contains('on') || ov.dataset.leaving) return;
    ov.dataset.leaving = '1';
    clearTimeout(stickerTimer);
    const disc = $('#stickerDisc');
    const target = $$('.btn-book').find(b => b.offsetParent && b.closest('.screen.on')) || $$('.btn-book')[0];
    const a = disc.getBoundingClientRect(), t = target.getBoundingClientRect();
    const dx = t.left + t.width / 2 - (a.left + a.width / 2), dy = t.top + t.height / 2 - (a.top + a.height / 2);
    const finish = () => {
      ov.classList.remove('on'); delete ov.dataset.leaving;
      syncCounts();
      target.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.35)' }, { transform: 'scale(1)' }], { duration: 450 });
      Sfx.play('sparkle');
      resetIdle();
    };
    if (reduceMotion) { finish(); return; }
    disc.animate([{ transform: 'rotate(-6deg)' }, { transform: `translate(${dx}px,${dy}px) scale(.12) rotate(200deg)` }],
      { duration: 700, easing: 'cubic-bezier(.5,0,.6,1)', fill: 'forwards' }).onfinish = () => {
      finish();
      disc.getAnimations().forEach(an => an.cancel());
    };
  }
  onTap($('#sticker'), () => stickerAway());

  function celebrateAll() {
    save.allDone = true; persist();
    Sfx.play('fanfare');
    ORDER.forEach((k, i) => setTimeout(() => {
      const el = planetEls[k];
      el.classList.remove('picked'); void el.offsetWidth; el.classList.add('picked');
      const c = centerOf(el); confetti(c.x, c.y, 10, 0.5);
    }, i * 160));
    Voice.speak('Wow! You visited the whole solar system! You are a super space explorer!');
  }

  /* ---------------- sticker book ---------------- */
  const book = $('#book');
  $$('[data-open-book]').forEach(b => onTap(b, openBook));
  function openBook() {
    if (busy) return;
    Sfx.play('tap');
    const rot = [-6, 4, -3, 7, -5, 3, -7, 5, -2];
    $('#bookGrid').innerHTML = BODIES.map((b, i) => {
      const got = save.stickers.includes(b.key);
      return `<button class="slot ${got ? 'got' : 'empty'}" style="--r:${rot[i]}deg" data-k="${b.key}" aria-label="${b.name}${got ? ' sticker' : ''}">${Art.planet(b.key)}</button>`;
    }).join('');
    $$('#bookGrid .slot').forEach(s => onTap(s, () => {
      const k = s.dataset.k;
      closeBook();
      if (screen === 'map') pickBody(k);
      else if (screen === 'detail' && k !== cur) { M.rocket.at = k; Voice.stop(); openDetail(k, { pop: true }); }
    }));
    book.classList.add('on');
    const n = save.stickers.length;
    Voice.speak(n === 0 ? 'Your sticker book is empty. Visit a planet to get a sticker!'
      : n === ORDER.length ? 'You have all the stickers! Hooray!'
        : `You have ${n} sticker${n > 1 ? 's' : ''}!`);
  }
  function closeBook() { book.classList.remove('on'); Voice.stop(); }
  onTap($('#bookClose'), () => { Sfx.play('tap'); closeBook(); });
  onTap(book, e => { if (e.target === book) closeBook(); });

  // grown-up reset: press and hold for 2 seconds
  const reset = $('#resetBtn');
  let holdT = null;
  reset.addEventListener('pointerdown', e => {
    e.stopPropagation();
    reset.classList.add('holding');
    holdT = setTimeout(() => {
      reset.classList.remove('holding');
      save.stickers = []; save.heard = {}; save.allDone = false; persist();
      syncCounts(); closeBook(); openBook();
      Voice.speak("All clean! Let's explore again!");
    }, 2000);
  });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => reset.addEventListener(ev, () => { clearTimeout(holdT); reset.classList.remove('holding'); }));

  /* ---------------- shooting star ---------------- */
  const shoot = $('#shooting');
  shoot.innerHTML = `<svg viewBox="0 0 260 120"><defs><linearGradient id="ssg" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#FFF4D6" stop-opacity="0"/><stop offset="1" stop-color="#FFF4D6"/></linearGradient></defs><path d="M10,20 L222,96" stroke="url(#ssg)" stroke-width="10" stroke-linecap="round"/><g transform="translate(228,98)"><path d="M0,-22 Q4,-4 22,0 Q4,4 0,22 Q-4,4 -22,0 Q-4,-4 0,-22Z" fill="#FFC23C"/></g></svg>`;
  let shootAnim = null;
  function shootingStar() {
    setTimeout(shootingStar, 16000 + Math.random() * 12000);
    if (reduceMotion || busy || (screen !== 'map' && screen !== 'detail') || book.classList.contains('on')) return;
    const x0 = innerWidth * (0.1 + Math.random() * 0.4), y0 = innerHeight * (0.02 + Math.random() * 0.15);
    shoot.style.display = 'block';
    shootAnim = shoot.animate([
      { transform: `translate(${x0}px,${y0}px)`, opacity: 0 },
      { opacity: 1, offset: 0.15 },
      { opacity: 1, offset: 0.8 },
      { transform: `translate(${x0 + innerWidth * 0.45}px,${y0 + innerHeight * 0.22}px)`, opacity: 0 },
    ], { duration: 2600, easing: 'linear' });
    shootAnim.onfinish = () => { shoot.style.display = 'none'; };
  }
  setTimeout(shootingStar, 12000);
  onTap(shoot, () => {
    const c = centerOf(shoot);
    if (shootAnim) shootAnim.cancel();
    shoot.style.display = 'none';
    Sfx.play('sparkle');
    confetti(c.x + c.r.width * 0.35, c.y + c.r.height * 0.3, 22, 0.8);
    Voice.speak('A shooting star! Make a wish!');
  });

  /* ---------------- housekeeping ---------------- */
  document.addEventListener('visibilitychange', () => { if (document.hidden) Voice.stop(); });

  // test hook (used by automated checks only)
  window.__ph = { save, M, pickBody, openDetail, tellFact, get screen() { return screen; }, get busy() { return busy; } };
})();
