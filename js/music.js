/* RetroCast – procedurally generated early-90s "smooth jazz" for Local on the 8s. No audio files needed. */
const Music = (() => {
  let ac = null, master, bus, verb, running = false, timer = null, nextTime = 0, step = 0, vol = 0.5, noiseBuf = null;
  const BPM = 86, EIGHTH = 60 / BPM / 2, SWING = 0.17;
  const PROG = [[43, [10, 14, 15, 19]], [36, [10, 14, 16, 21]], [41, [11, 14, 16, 19]], [38, [10, 14, 15, 19]],
    [46, [11, 14, 16, 19]], [45, [10, 14, 15, 19]], [43, [10, 14, 15, 17]], [36, [10, 14, 17, 21]]];
  const SCALE = [65, 67, 69, 72, 74, 77, 79, 81, 84];
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

  function init() {
    if (ac) return;
    ac = new (window.AudioContext || window.webkitAudioContext)();
    master = ac.createGain(); master.gain.value = 0;
    const comp = ac.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 3;
    master.connect(comp); comp.connect(ac.destination);
    bus = ac.createGain(); bus.connect(master);
    verb = ac.createConvolver();
    const len = ac.sampleRate * 2.6, ir = ac.createBuffer(2, len, ac.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
    verb.buffer = ir;
    const vg = ac.createGain(); vg.gain.value = 0.32; verb.connect(vg); vg.connect(master);
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const nd = noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  }
  const out = (node, wet = .3) => { node.connect(bus); if (wet) { const g = ac.createGain(); g.gain.value = wet; node.connect(g); g.connect(verb); } };
  function ep(t, midi, dur, vel = .14) {
    const f = mtof(midi), car = ac.createOscillator(), mod = ac.createOscillator(), mg = ac.createGain(), amp = ac.createGain();
    car.frequency.value = f; mod.frequency.value = f;
    mg.gain.setValueAtTime(f * 2.2, t); mg.gain.exponentialRampToValueAtTime(f * .25, t + .9);
    mod.connect(mg); mg.connect(car.frequency);
    amp.gain.setValueAtTime(0, t); amp.gain.linearRampToValueAtTime(vel, t + .006);
    amp.gain.exponentialRampToValueAtTime(vel * .35, t + .7); amp.gain.exponentialRampToValueAtTime(.0008, t + dur + .5);
    car.connect(amp); out(amp, .35);
    car.start(t); mod.start(t); car.stop(t + dur + .6); mod.stop(t + dur + .6);
  }
  function pad(t, midi, dur) {
    const o = ac.createOscillator(), o2 = ac.createOscillator(), lp = ac.createBiquadFilter(), a = ac.createGain();
    o.type = o2.type = 'sawtooth'; o.frequency.value = mtof(midi); o2.frequency.value = mtof(midi) * 1.004;
    lp.type = 'lowpass'; lp.frequency.value = 900;
    a.gain.setValueAtTime(0, t); a.gain.linearRampToValueAtTime(.022, t + .8); a.gain.setValueAtTime(.022, t + dur - .4); a.gain.linearRampToValueAtTime(0, t + dur + .4);
    o.connect(lp); o2.connect(lp); lp.connect(a); out(a, .5);
    o.start(t); o2.start(t); o.stop(t + dur + .5); o2.stop(t + dur + .5);
  }
  function bass(t, midi, dur) {
    const o = ac.createOscillator(), s = ac.createOscillator(), lp = ac.createBiquadFilter(), a = ac.createGain();
    o.type = 'triangle'; s.frequency.value = mtof(midi);
    o.frequency.setValueAtTime(mtof(midi) * .985, t); o.frequency.linearRampToValueAtTime(mtof(midi), t + .06);
    lp.type = 'lowpass'; lp.frequency.value = 700;
    a.gain.setValueAtTime(0, t); a.gain.linearRampToValueAtTime(.3, t + .02); a.gain.exponentialRampToValueAtTime(.12, t + dur * .8); a.gain.linearRampToValueAtTime(0, t + dur + .05);
    o.connect(lp); s.connect(lp); lp.connect(a); out(a, .08);
    o.start(t); s.start(t); o.stop(t + dur + .1); s.stop(t + dur + .1);
  }
  function noise(t, dur, type, freq, vel, wet = .15) {
    const n = ac.createBufferSource(), f = ac.createBiquadFilter(), a = ac.createGain();
    n.buffer = noiseBuf; f.type = type; f.frequency.value = freq;
    a.gain.setValueAtTime(vel, t); a.gain.exponentialRampToValueAtTime(.0008, t + dur);
    n.connect(f); f.connect(a); out(a, wet); n.start(t, Math.random() * .5); n.stop(t + dur + .02);
  }
  function kick(t) {
    const o = ac.createOscillator(), a = ac.createGain();
    o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(45, t + .12);
    a.gain.setValueAtTime(.28, t); a.gain.exponentialRampToValueAtTime(.001, t + .28);
    o.connect(a); out(a, 0); o.start(t); o.stop(t + .3);
  }
  function lead(t, midi, dur) {
    const o = ac.createOscillator(), o2 = ac.createOscillator(), lp = ac.createBiquadFilter(), a = ac.createGain(), vib = ac.createOscillator(), vg = ac.createGain();
    o.type = 'sawtooth'; o2.type = 'square'; o.frequency.value = mtof(midi); o2.frequency.value = mtof(midi) * .5;
    vib.frequency.value = 5.2; vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(mtof(midi) * .006, t + dur * .7);
    vib.connect(vg); vg.connect(o.frequency);
    lp.type = 'lowpass'; lp.Q.value = 2; lp.frequency.setValueAtTime(700, t); lp.frequency.linearRampToValueAtTime(2000, t + .12); lp.frequency.linearRampToValueAtTime(1300, t + dur);
    const g2 = ac.createGain(); g2.gain.value = .25; o2.connect(g2); g2.connect(lp);
    a.gain.setValueAtTime(0, t); a.gain.linearRampToValueAtTime(.06, t + .05); a.gain.setValueAtTime(.055, t + dur - .06); a.gain.linearRampToValueAtTime(0, t + dur + .08);
    o.connect(lp); lp.connect(a); out(a, .45);
    [o, o2, vib].forEach(x => { x.start(t); x.stop(t + dur + .1); });
  }
  let leadNote = 72;
  function schedule(t, s) {
    const bar = Math.floor(s / 8) % PROG.length, e = s % 8, [root, tones] = PROG[bar];
    const nextRoot = PROG[(bar + 1) % PROG.length][0];
    const tt = t + ((e % 2) ? EIGHTH * SWING : 0);
    const voicing = tones.map(x => { let m = root + x; while (m < 55) m += 12; while (m > 74) m -= 12; return m; });
    if (e === 0) { voicing.forEach((m, i) => ep(t + i * .012, m, EIGHTH * 3)); pad(t, root + 24 - (root + 24 > 70 ? 12 : 0), EIGHTH * 8); }
    if (e === 3 && Math.random() < .7) voicing.forEach((m, i) => ep(tt + i * .01, m, EIGHTH * 1.6, .09));
    if (e === 6 && Math.random() < .4) voicing.slice(1).forEach((m, i) => ep(t + i * .01, m, EIGHTH, .07));
    if (e === 0) bass(t, root, EIGHTH * 2.8);
    if (e === 3) bass(tt, root + 7, EIGHTH * 1.4);
    if (e === 4 && Math.random() < .5) bass(t, root + 12, EIGHTH * 1.4);
    if (e === 6) bass(t, root + (Math.random() < .5 ? 7 : 10), EIGHTH * .9);
    if (e === 7) bass(tt, nextRoot + (Math.random() < .5 ? -1 : 1), EIGHTH * .8);
    noise(tt, .05, 'highpass', 7500, e % 2 ? .05 : .08, .1);
    if (e === 2 || e === 6) noise(t, .16, 'bandpass', 1900, .11, .25);
    if (e === 0 || (e === 5 && Math.random() < .5)) kick(t);
    if (Math.floor(s / 32) % 3 !== 0 && Math.random() < (e % 2 ? .3 : .42)) {
      let idx = SCALE.indexOf(leadNote); if (idx < 0) idx = 3;
      idx = Math.max(0, Math.min(SCALE.length - 1, idx + [-2, -1, -1, 1, 1, 2][(Math.random() * 6) | 0]));
      leadNote = SCALE[idx];
      lead(tt, leadNote, EIGHTH * (Math.random() < .35 ? 3 : 1.4));
    }
  }
  function tick() { while (nextTime < ac.currentTime + .25) { schedule(nextTime, step); step++; nextTime += EIGHTH; } }
  function start() {
    init(); if (ac.state !== 'running') ac.resume();
    if (running) return;
    running = true; step = 0; nextTime = ac.currentTime + .1;
    master.gain.cancelScheduledValues(ac.currentTime);
    master.gain.setValueAtTime(0, ac.currentTime); master.gain.linearRampToValueAtTime(vol, ac.currentTime + 1.5);
    timer = setInterval(tick, 40);
  }
  function stop() {
    if (!ac || !running) return;
    running = false; clearInterval(timer);
    master.gain.cancelScheduledValues(ac.currentTime);
    master.gain.setValueAtTime(master.gain.value, ac.currentTime); master.gain.linearRampToValueAtTime(0, ac.currentTime + .6);
  }
  function setVolume(v) { vol = v; if (ac && running) master.gain.setTargetAtTime(v, ac.currentTime, .1); }
  function duck(on) { if (ac && running) master.gain.setTargetAtTime(on ? vol * .35 : vol, ac.currentTime, .2); }
  function beep() {
    init(); if (ac.state !== 'running') ac.resume();
    const t = ac.currentTime + .05;
    [[853, 0], [960, 0], [853, .5], [960, .5]].forEach(([f, d]) => {
      const o = ac.createOscillator(), a = ac.createGain(); o.frequency.value = f;
      a.gain.setValueAtTime(0, t + d); a.gain.linearRampToValueAtTime(.08, t + d + .02); a.gain.setValueAtTime(.08, t + d + .4); a.gain.linearRampToValueAtTime(0, t + d + .45);
      o.connect(a); a.connect(ac.destination); o.start(t + d); o.stop(t + d + .5);
    });
  }
  // iOS suspends audio when the app is backgrounded / screen locks; resume on return
  function unlock() { init(); if (ac.state !== 'running') ac.resume(); }
  document.addEventListener('visibilitychange', () => { if (!document.hidden && ac && running && ac.state !== 'running') ac.resume(); });
  return { start, stop, setVolume, duck, beep, unlock, get running() { return running; } };
})();
