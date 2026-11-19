/* RetroCast – animated, GIF-style pixel weather icons (drawn live on tiny canvases, then crunched to hard pixels). */
const Icons = (() => {
  const W = 64, H = 48, FPS = 8;
  let frame = 0;

  function fromCode(code, isDay = true, windMph = 0) {
    const d = isDay;
    if ((code === 0 || code === 1 || code === 2 || code === 3) && windMph >= 25) return 'windy';
    switch (code) {
      case 0: return d ? 'sunny' : 'clear-night';
      case 1: return d ? 'mostly-sunny' : 'mostly-clear-night';
      case 2: return d ? 'partly-cloudy' : 'partly-cloudy-night';
      case 3: return 'cloudy';
      case 45: case 48: return 'fog';
      case 51: case 53: return 'drizzle';
      case 55: case 61: case 63: return 'rain';
      case 65: case 82: return 'heavy-rain';
      case 56: case 57: case 66: case 67: return 'frz-rain';
      case 71: case 77: return 'flurries';
      case 73: case 85: return 'snow';
      case 75: case 86: return 'heavy-snow';
      case 80: return d ? 'showers' : 'rain';
      case 81: return 'rain';
      case 95: case 96: case 99: return 'tstorm';
      default: return 'cloudy';
    }
  }
  function textFromCode(code, isDay = true, windMph = 0) {
    if (code <= 3 && windMph >= 25) return 'Windy';
    const T = {
      0: isDay ? 'Sunny' : 'Clear', 1: isDay ? 'Mostly Sunny' : 'Mostly Clear', 2: 'Partly Cloudy', 3: 'Cloudy',
      45: 'Fog', 48: 'Freezing Fog', 51: 'Lgt Drizzle', 53: 'Drizzle', 55: 'Hvy Drizzle', 56: 'Frzg Drizzle', 57: 'Frzg Drizzle',
      61: 'Light Rain', 63: 'Rain', 65: 'Heavy Rain', 66: 'Frzg Rain', 67: 'Frzg Rain', 71: 'Light Snow', 73: 'Snow',
      75: 'Heavy Snow', 77: 'Snow Grains', 80: 'Showers', 81: 'Rain Showers', 82: 'Hvy Showers', 85: 'Snow Showers',
      86: 'Hvy Snow', 95: "T'Storms", 96: "T'Storms", 99: "Svr T'Storms"
    };
    return T[code] || 'Cloudy';
  }
  function fromText(text, isDay = true) {
    const t = (text || '').toLowerCase();
    if (!t) return null;
    if (t.includes('thunder') || t.includes('t-storm') || t.includes("t'storm")) return 'tstorm';
    if (t.includes('freezing')) return 'frz-rain';
    if (t.includes('blowing snow')) return 'blowing-snow';
    if ((t.includes('snow') && t.includes('rain')) || t.includes('sleet') || t.includes('ice pellets') || t.includes('wintry')) return 'mix';
    if (t.includes('heavy snow')) return 'heavy-snow';
    if (t.includes('flurr') || t.includes('light snow')) return 'flurries';
    if (t.includes('snow')) return 'snow';
    if (t.includes('heavy rain')) return 'heavy-rain';
    if (t.includes('shower')) return isDay ? 'showers' : 'rain';
    if (t.includes('rain')) return 'rain';
    if (t.includes('drizzle')) return 'drizzle';
    if (t.includes('fog') || t.includes('mist') || t.includes('haze') || t.includes('smoke') || t.includes('dust')) return 'fog';
    if (t.includes('wind') || t.includes('breezy') || t.includes('blustery')) return 'windy';
    if (t.includes('mostly cloudy') || t.includes('considerable cloud')) return isDay ? 'mostly-cloudy' : 'mostly-cloudy-night';
    if (t.includes('partly') || t.includes('scattered clouds') || t.includes('few clouds')) return isDay ? 'partly-cloudy' : 'partly-cloudy-night';
    if (t.includes('mostly sunny') || t.includes('mostly clear')) return isDay ? 'mostly-sunny' : 'mostly-clear-night';
    if (t.includes('cloudy') || t.includes('overcast')) return 'cloudy';
    if (t.includes('sunny') || t.includes('clear') || t.includes('fair')) return isDay ? 'sunny' : 'clear-night';
    return null;
  }

  const OUT = '#0b1030';
  const rnd = i => { const v = Math.sin(i * 12.9898 + 4.1) * 43758.5453; return v - Math.floor(v); };
  function sun(c, cx, cy, r, t) {
    const rot = t * 0.07, n = 12;
    for (let pass = 0; pass < 2; pass++) {
      c.fillStyle = pass ? '#ffa000' : OUT;
      for (let i = 0; i < n; i++) {
        const a = rot + i * Math.PI * 2 / n;
        const len = r + 6 + (i % 2 ? 2 + 2 * Math.sin(t * 0.6) : 0) + (pass ? 0 : 1.2);
        const w = pass ? 0.16 : 0.24;
        c.beginPath();
        c.moveTo(cx + Math.cos(a - w) * (r - 1), cy + Math.sin(a - w) * (r - 1));
        c.lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len);
        c.lineTo(cx + Math.cos(a + w) * (r - 1), cy + Math.sin(a + w) * (r - 1));
        c.fill();
      }
    }
    c.fillStyle = OUT; c.beginPath(); c.arc(cx, cy, r + 1.3, 0, 7); c.fill();
    const g = c.createRadialGradient(cx - r * .35, cy - r * .35, 1, cx, cy, r);
    g.addColorStop(0, '#ffffc0'); g.addColorStop(.45, '#ffe830'); g.addColorStop(1, '#ff9800');
    c.fillStyle = g; c.beginPath(); c.arc(cx, cy, r, 0, 7); c.fill();
  }
  function moon(c, cx, cy, r) {
    const ix = cx + r * .55, iy = cy - r * .3, ir = r * .85;
    c.save(); c.beginPath(); c.arc(cx, cy, r + 1.4, 0, 7); c.clip();
    c.fillStyle = OUT; c.beginPath(); c.arc(cx, cy, r + 1.4, 0, 7); c.arc(ix, iy, ir - 1.4, 0, 7, true); c.fill('evenodd');
    c.restore();
    c.save(); c.beginPath(); c.arc(cx, cy, r, 0, 7); c.clip();
    const g = c.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
    g.addColorStop(0, '#fffbd8'); g.addColorStop(1, '#e8d070');
    c.fillStyle = g; c.beginPath(); c.arc(cx, cy, r, 0, 7); c.arc(ix, iy, ir, 0, 7, true); c.fill('evenodd');
    c.restore();
  }
  function stars(c, t, pts) {
    pts.forEach(([x, y], i) => {
      const on = ((t + i * 3) % 10) < 6, big = ((t + i * 3) % 10) < 2;
      c.fillStyle = on ? '#ffffff' : '#7088c0';
      c.fillRect(x, y, 1.6, 1.6);
      if (big) { c.fillRect(x - 1.5, y + .3, 4.6, 1); c.fillRect(x + .3, y - 1.5, 1, 4.6); }
    });
  }
  const PUFFS = [[-14, 4, 7], [-6, -3, 9.5], [6, -5, 10], [15, 2, 7.5], [0, 5, 9], [-9, 6, 7], [10, 6, 7.5]];
  function cloud(c, cx, cy, s = 1, tone = 'white') {
    const tones = { white: ['#ffffff', '#d8dce8', '#9aa0b4'], gray: ['#d8d8de', '#a4a8b6', '#6c7084'], dark: ['#9a9cac', '#6a6c80', '#3c3e52'], faint: ['#eef0f6', '#c8ccd8', '#a8acbc'] }[tone];
    const bottom = cy + 11 * s;
    c.save(); c.beginPath(); c.rect(0, 0, W, bottom + 1.3); c.clip();
    c.fillStyle = OUT; PUFFS.forEach(([x, y, r]) => { c.beginPath(); c.arc(cx + x * s, cy + y * s, r * s + 1.3, 0, 7); c.fill(); });
    c.restore();
    c.save(); c.beginPath(); c.rect(0, 0, W, bottom); c.clip();
    const g = c.createLinearGradient(0, cy - 14 * s, 0, bottom);
    g.addColorStop(0, tones[0]); g.addColorStop(.55, tones[1]); g.addColorStop(1, tones[2]);
    c.fillStyle = g; PUFFS.forEach(([x, y, r]) => { c.beginPath(); c.arc(cx + x * s, cy + y * s, r * s, 0, 7); c.fill(); });
    c.restore();
  }
  function rain(c, t, x0, x1, y0, y1, n, speed = 3, color = '#3aa8ff', slant = .35) {
    c.strokeStyle = color; c.lineWidth = 1.6; c.lineCap = 'butt';
    const span = y1 - y0;
    for (let i = 0; i < n; i++) {
      const x = x0 + ((i * 0.618034 + .1) % 1) * (x1 - x0);
      const y = y0 + ((t * speed + rnd(i) * span) % span);
      c.beginPath(); c.moveTo(x - (y - y0) * slant, y); c.lineTo(x - (y - y0) * slant - 1.6, y + 4.5); c.stroke();
    }
  }
  function snow(c, t, x0, x1, y0, y1, n, speed = 1.3, horiz = 0) {
    const span = y1 - y0;
    for (let i = 0; i < n; i++) {
      const baseX = x0 + ((i * 0.618034 + .3) % 1) * (x1 - x0);
      const yy = (t * speed + rnd(i + 50) * span) % span;
      const X = Math.round(baseX + Math.sin((t + i * 4) * .45) * 1.6 + horiz * yy), Y = Math.round(y0 + yy);
      c.fillStyle = OUT; c.fillRect(X - 3, Y - 1, 7, 3); c.fillRect(X - 1, Y - 3, 3, 7);
      c.fillStyle = '#ffffff'; c.fillRect(X - 2, Y, 5, 1); c.fillRect(X, Y - 2, 1, 5); c.fillRect(X - 1, Y - 1, 3, 3);
    }
  }
  function bolt(c, x, y, s = 1) {
    const P = [[4, 0], [12, 0], [8, 7], [13, 7], [3, 20], [6, 10], [1, 10]];
    c.beginPath(); P.forEach(([a, b], i) => { const px = x + a * s, py = y + b * s; i ? c.lineTo(px, py) : c.moveTo(px, py); }); c.closePath();
    c.lineWidth = 2.2; c.strokeStyle = OUT; c.stroke(); c.fillStyle = '#fff23a'; c.fill();
  }
  function fogBars(c, t, y0, n = 4) {
    for (let i = 0; i < n; i++) {
      const off = Math.sin(t * .25 + i * 1.7) * 5, w = 40 - (i % 2) * 8, x = 32 - w / 2 + off;
      c.fillStyle = OUT; c.fillRect(x - 1, y0 + i * 6 - 1, w + 2, 4.2);
      c.fillStyle = i % 2 ? '#c4c8d8' : '#e8eaf2'; c.fillRect(x, y0 + i * 6, w, 2.4);
    }
  }
  function gusts(c, t, y0, n = 3, color = '#ffffff') {
    for (let i = 0; i < n; i++) {
      const x = ((t * 4 + i * 23) % 90) - 22, y = y0 + i * 8;
      const path = () => { c.beginPath(); c.moveTo(x, y); c.lineTo(x + 18, y); c.quadraticCurveTo(x + 25, y, x + 24, y - 4); c.quadraticCurveTo(x + 22, y - 7, x + 19, y - 4); };
      c.strokeStyle = OUT; c.lineWidth = 3.2; path(); c.stroke();
      c.strokeStyle = color; c.lineWidth = 1.5; path(); c.stroke();
    }
  }

  function scene(c, key, t) {
    const drift = Math.sin(t * .09) * 2.2;
    switch (key) {
      case 'sunny': sun(c, 32, 24, 11, t); break;
      case 'clear-night': stars(c, t, [[8, 8], [52, 10], [46, 38], [12, 36], [56, 26], [20, 4]]); moon(c, 32, 24, 13); break;
      case 'mostly-sunny': sun(c, 26, 20, 10, t); cloud(c, 44 + drift, 33, .55); break;
      case 'mostly-clear-night': stars(c, t, [[6, 8], [54, 6], [10, 38], [58, 22]]); moon(c, 26, 20, 11); cloud(c, 44 + drift, 33, .55); break;
      case 'partly-cloudy': sun(c, 22, 17, 10, t); cloud(c, 37 + drift, 29, .85); break;
      case 'partly-cloudy-night': stars(c, t, [[6, 34], [54, 6], [44, 12], [8, 6]]); moon(c, 22, 17, 11); cloud(c, 37 + drift, 29, .85); break;
      case 'mostly-cloudy': sun(c, 19, 15, 8, t); cloud(c, 24 - drift, 20, .7, 'gray'); cloud(c, 37 + drift, 29, .95); break;
      case 'mostly-cloudy-night': stars(c, t, [[54, 6], [6, 36]]); moon(c, 16, 12, 9); cloud(c, 24 - drift, 20, .7, 'gray'); cloud(c, 37 + drift, 29, .95); break;
      case 'cloudy': cloud(c, 22 - drift, 18, .8, 'gray'); cloud(c, 38 + drift, 28, 1); break;
      case 'fog': cloud(c, 32 + drift * .5, 15, .8, 'faint'); fogBars(c, t, 26, 4); break;
      case 'drizzle': cloud(c, 32 + drift * .4, 16, .95, 'gray'); rain(c, t, 18, 50, 26, 48, 6, 2, '#6cc0ff', .2); break;
      case 'rain': cloud(c, 32 + drift * .4, 15, 1, 'gray'); rain(c, t, 18, 54, 25, 48, 11, 3); break;
      case 'heavy-rain': rain(c, t, 14, 60, 22, 48, 18, 4.5, '#2a90ff', .45); cloud(c, 32 + drift * .3, 14, 1.05, 'dark'); break;
      case 'showers': sun(c, 18, 12, 8, t); cloud(c, 36 + drift * .4, 18, .9, 'gray'); rain(c, t, 26, 54, 28, 48, 8, 3); break;
      case 'tstorm': {
        const f = t % 18, flash = f < 2 || f === 4 || f === 5;
        rain(c, t, 14, 58, 24, 48, 12, 4, '#2a90ff', .4);
        cloud(c, 32, 14, 1.05, flash ? 'white' : 'dark');
        if (flash || f === 3) bolt(c, 26, 22, 1);
        break;
      }
      case 'flurries': cloud(c, 32 + drift * .4, 15, .95, 'faint'); snow(c, t, 18, 50, 26, 48, 5, 1); break;
      case 'snow': cloud(c, 32 + drift * .4, 15, 1, 'gray'); snow(c, t, 16, 52, 25, 48, 10, 1.3); break;
      case 'heavy-snow': snow(c, t, 10, 58, 22, 48, 18, 1.9, .15); cloud(c, 32 + drift * .3, 14, 1.05, 'dark'); break;
      case 'mix': cloud(c, 32 + drift * .4, 15, 1, 'gray'); rain(c, t, 18, 52, 25, 48, 6, 3); snow(c, t + 7, 22, 54, 25, 48, 5, 1.3); break;
      case 'frz-rain': cloud(c, 32 + drift * .4, 15, 1, 'gray'); rain(c, t, 18, 52, 25, 48, 9, 2.6, '#b8f4ff', .2);
        c.fillStyle = '#e8ffff'; for (let i = 0; i < 5; i++) c.fillRect(16 + i * 8, 45 - (i % 2), 4, 2); break;
      case 'windy': cloud(c, 34 + ((t * 1.5) % 10) - 5, 15, .75, 'faint'); gusts(c, t, 30, 3); break;
      case 'blowing-snow': gusts(c, t, 16, 2, '#dfe8ff'); snow(c, t, -10, 50, 18, 48, 14, 1.4, .9); break;
      default: cloud(c, 32, 24, 1);
    }
  }

  function crunch(c) {
    const d = c.getImageData(0, 0, W, H), p = d.data;
    for (let i = 0; i < p.length; i += 4) {
      if (p[i + 3] < 100) { p[i + 3] = 0; continue; }
      p[i] = Math.round(p[i] / 17) * 17; p[i + 1] = Math.round(p[i + 1] / 17) * 17; p[i + 2] = Math.round(p[i + 2] / 17) * 17; p[i + 3] = 255;
    }
    c.putImageData(d, 0, 0);
  }
  function paint(cv, key, t) {
    const c = cv.getContext('2d', { willReadFrequently: true });
    c.clearRect(0, 0, W, H); scene(c, key, t); crunch(c);
  }
  function html(key, cls = '') { return `<canvas class="wxicon ${cls}" width="${W}" height="${H}" data-icon="${key}" data-seed="${(Math.random() * 20) | 0}"></canvas>`; }

  function moonPhase(kind) {
    const cv = document.createElement('canvas'); cv.width = 40; cv.height = 40; cv.className = 'moonicon';
    const c = cv.getContext('2d', { willReadFrequently: true });
    const cx = 20, cy = 20, r = 16;
    c.fillStyle = OUT; c.beginPath(); c.arc(cx, cy, r + 1.5, 0, 7); c.fill();
    c.fillStyle = '#2a2f55'; c.beginPath(); c.arc(cx, cy, r, 0, 7); c.fill();
    c.fillStyle = '#fff6c8';
    c.save(); c.beginPath(); c.arc(cx, cy, r, 0, 7); c.clip();
    if (kind === 'full') { c.beginPath(); c.arc(cx, cy, r, 0, 7); c.fill(); c.fillStyle = '#e0d8a0'; [[14, 14, 3], [24, 22, 4], [16, 26, 2]].forEach(([x, y, rr]) => { c.beginPath(); c.arc(x, y, rr, 0, 7); c.fill(); }); }
    else if (kind === 'first') c.fillRect(cx, 0, 40, 40);
    else if (kind === 'last') c.fillRect(0, 0, cx, 40);
    else { c.strokeStyle = '#6a70a0'; c.lineWidth = 2; c.beginPath(); c.arc(cx, cy, r - 1, 0, 7); c.stroke(); }
    c.restore();
    const d = c.getImageData(0, 0, 40, 40), p = d.data; for (let i = 3; i < p.length; i += 4) p[i] = p[i] < 100 ? 0 : 255; c.putImageData(d, 0, 0);
    return cv;
  }

  setInterval(() => {
    if (document.hidden) return; // save battery in the background
    frame++;
    document.querySelectorAll('canvas.wxicon').forEach(cv => paint(cv, cv.dataset.icon, frame + (+cv.dataset.seed || 0)));
  }, 1000 / FPS);

  return { fromCode, textFromCode, fromText, html, moonPhase };
})();
