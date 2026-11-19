/* RetroCast for iPhone – "Local on the 8s" sequencer, portrait pages, clock, bottom band, red warning crawl,
   swipe navigation, 30-second refresh. */
(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const stage = $('#stage'), pageEl = $('#page'), bottom = $('#bottom'), condEl = $('#cond'), crawlText = $('#crawl-text');
  const LS = k => 'retrocast-ios.' + k;
  const SVG = d => `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">${d}</svg>`;
  const ICON_PAUSE = SVG('<rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/>');
  const ICON_PLAY = SVG('<path d="M6 4v16l14-8z"/>');
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = navigator.standalone || matchMedia('(display-mode: standalone)').matches;

  /* ---------------- settings ---------------- */
  const PAGE_LIST = [
    ['intro', 'Intro'], ['bulletin', 'Weather Bulletin (when alerts)'], ['current', 'Current Conditions'], ['latest', 'Latest Observations'],
    ['local', 'Local Forecast'], ['extended', 'Extended Forecast'], ['week', 'The Week Ahead'],
    ['area', 'Surrounding Cities Forecast'], ['travel', 'Travel Forecast'], ['almanac', 'Almanac']
  ];
  const DEF = { units: 'F', mode: 'loop', speed: 1, music: 1, vol: .45, voice: 0, crt: 1, beep: 1, testalert: 0, pages: {} };
  let S = Object.assign({}, DEF);
  try { Object.assign(S, JSON.parse(localStorage.getItem(LS('settings')) || '{}')); } catch (e) { }
  const save = () => localStorage.setItem(LS('settings'), JSON.stringify(S));

  let D = null, LOC = null;
  try { LOC = JSON.parse(localStorage.getItem(LS('loc')) || 'null'); } catch (e) { }

  /* ---------------- formatting ---------------- */
  const metric = () => S.units === 'C';
  const T = f => f == null || isNaN(f) ? '--' : Math.round(metric() ? (f - 32) * 5 / 9 : f);
  const U = () => metric() ? 'C' : 'F';
  const SPD = m => Math.round(metric() ? m * 1.609344 : m);
  const SU = () => metric() ? 'km/h' : 'mph';
  const DIRS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const DIRW = ['north', 'north northeast', 'northeast', 'east northeast', 'east', 'east southeast', 'southeast', 'south southeast', 'south', 'south southwest', 'southwest', 'west southwest', 'west', 'west northwest', 'northwest', 'north northwest'];
  const dir = d => d == null ? '' : DIRS[Math.round(((d % 360) + 360) % 360 / 22.5) % 16];
  const dirWord = d => DIRW[Math.round(((d % 360) + 360) % 360 / 22.5) % 16];
  const windStr = (sp, d) => sp == null ? 'N/A' : sp < 1 ? 'Calm' : `${dir(d)} ${SPD(sp)}`;
  const pres = h => h == null ? 'N/A' : metric() ? Math.round(h) + ' mb' : (h * 0.02953).toFixed(2);
  const trendArrow = t => t === 'R' ? ' ▲' : t === 'F' ? ' ▼' : '';
  const vis = m => m == null ? 'N/A' : metric() ? Math.round(Math.min(m, 10) * 1.609) + ' km' : (m >= 10 ? 10 : m < 1 ? m.toFixed(1).replace(/^0/, '') : Math.round(m)) + ' mi.';
  const ceil = c => c == null ? 'N/A' : c === 'unl' ? 'Unlimited' : metric() ? Math.round(c * .3048 / 10) * 10 + ' m' : c + ' ft.';
  const tz = () => D?.loc?.tz || undefined;
  const fmt = (d, o) => { try { return new Intl.DateTimeFormat('en-US', { timeZone: tz(), ...o }).format(d); } catch (e) { return new Intl.DateTimeFormat('en-US', o).format(d); } };
  const dayName = (ymd, long) => new Date(ymd + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: long ? 'long' : 'short', timeZone: 'UTC' });
  const monDay = ymd => new Date(ymd + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const hm = iso => { if (!iso) return '--'; const [h, m] = iso.slice(11, 16).split(':').map(Number); return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`; };
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const locName = () => D ? D.loc.name : '';
  const localHour = () => +fmt(new Date(), { hour: 'numeric', hourCycle: 'h23' });

  /* ---------------- stage scaling (portrait TV, kept below the status bar / Dynamic Island) ---------------- */
  const SW = 390, SH = 760;
  function fit() {
    const vp = $('#viewport'), cs = getComputedStyle(vp);
    const pt = parseFloat(cs.paddingTop) || 0, pb = parseFloat(cs.paddingBottom) || 0;
    const w = vp.clientWidth, h = vp.clientHeight - pt - pb;
    const s = Math.min(w / SW, h / SH);
    stage.style.transform = `translate(${(w - SW * s) / 2}px, ${pt}px) scale(${s})`;
  }
  addEventListener('resize', fit); addEventListener('orientationchange', () => setTimeout(fit, 350));
  addEventListener('load', fit); addEventListener('pageshow', fit);
  fit(); setTimeout(fit, 300); setTimeout(fit, 1200); // iOS sometimes reports the safe area a moment after launch
  ['gesturestart', 'gesturechange'].forEach(ev => document.addEventListener(ev, e => e.preventDefault(), { passive: false }));

  /* ---------------- clock ---------------- */
  function tickClock() {
    const n = new Date();
    $('#time').textContent = fmt(n, { hour: 'numeric', minute: '2-digit', second: '2-digit' });
    $('#date').textContent = fmt(n, { weekday: 'short', month: 'short', day: 'numeric' }).replace(',', '').toUpperCase();
  }
  setInterval(tickClock, 1000); tickClock();

  function setTitle(a) { $('#t1').textContent = a[0] || ''; $('#t2').textContent = a[1] || ''; $('#title').classList.toggle('one', !a[1]); }
  function setDots() { $('#dots').innerHTML = inStandby || !D ? '' : seq.map((_, i) => `<i class="${i === si ? 'on' : ''}"></i>`).join(''); }

  /* ---------------- bottom band + red crawl ---------------- */
  let condLines = [], condIdx = 0;
  function buildCond() {
    if (!D) { condLines = ['Please stand by...']; return; }
    const c = D.current;
    condLines = [`Conditions at ${locName()}`, c.text, `Temp: ${T(c.temp)}°${U()}` + (Math.abs((c.feels ?? c.temp) - c.temp) >= 3 ? `   ${c.feels < c.temp ? 'Wind Chill' : 'Heat Index'}: ${T(c.feels)}°` : ''),
      `Humidity: ${Math.round(c.humidity)}%   Dewpoint: ${T(c.dew)}°`, `Barometric Pressure: ${pres(c.pressure)}${trendArrow(c.trend)}`,
      `Wind: ${windStr(c.wind, c.windDir)}${c.wind >= 1 ? ' ' + SU().toUpperCase() : ''}` + (c.gust && c.gust > c.wind + 7 ? `   Gusts to ${SPD(c.gust)}` : ''),
      `Visibility: ${vis(c.vis)}   Ceiling: ${ceil(c.ceiling)}`];
  }
  function rotateCond() { if (!condLines.length) buildCond(); condEl.textContent = condLines[condIdx++ % condLines.length]; }
  setInterval(rotateCond, 4000);

  let lastAlertKey = '';
  function alerts() {
    const a = (D?.alerts || []).slice();
    if (S.testalert) a.unshift({ event: 'Test Warning', headline: 'THIS IS ONLY A TEST of the RetroCast severe weather crawl. Had this been an actual warning, it would be scrolling across your screen right now', severity: 'Severe', area: locName(), desc: 'This is a test of the red warning crawl. No action is needed.', instruction: '', test: true });
    return a;
  }
  function updateCrawl() {
    const a = alerts();
    if (!a.length) { bottom.classList.remove('alert'); crawlText.style.animation = 'none'; lastAlertKey = ''; return; }
    bottom.classList.add('alert');
    const txt = a.map(x => `${x.event.toUpperCase()}  ...  ${x.headline}${x.area && !x.test ? '  ...  FOR ' + x.area.toUpperCase() : ''}`).join('     ●     ');
    const key = a.map(x => x.headline).join('|');
    if (key === lastAlertKey) return;
    const isNew = !lastAlertKey || !a.every(x => lastAlertKey.includes(x.headline));
    lastAlertKey = key;
    crawlText.textContent = txt + '     ●     ';
    crawlText.style.animation = 'none';
    requestAnimationFrame(() => {
      const w = crawlText.scrollWidth;
      crawlText.style.setProperty('--crawl-end', -w + 'px');
      crawlText.style.animation = `crawl ${((SW + w) / 80).toFixed(1)}s linear infinite`;
    });
    if (isNew && S.beep && audioUnlocked) Music.beep();
  }

  /* ---------------- narrator ---------------- */
  function say(text) {
    if (!S.voice || !text || !('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text); u.rate = .95;
    const vs = speechSynthesis.getVoices();
    const v = vs.find(v => /en-US/i.test(v.lang) && /fred|aaron|evan|tom|alex/i.test(v.name)) || vs.find(v => /en-US/i.test(v.lang));
    if (v) u.voice = v;
    u.onstart = () => Music.duck(true); u.onend = () => Music.duck(false);
    speechSynthesis.speak(u);
  }

  /* ---------------- generated local forecast text (non-US / metric) ---------------- */
  function skyPhrase(code, isDay, pop) {
    const p = pop ?? 100;
    const chance = w => p < 30 ? `Mostly cloudy, with a slight chance of ${w}` : p < 60 ? `A chance of ${w}` : `${w[0].toUpperCase() + w.slice(1)} likely`;
    if (code >= 95) return chance('thunderstorms');
    if ([56, 57, 66, 67].includes(code)) return chance('freezing rain');
    if (code >= 71 && code <= 77 || code === 85 || code === 86) return code === 75 || code === 86 ? (p >= 60 ? 'Heavy snow' : chance('snow')) : chance('snow');
    if (code >= 80) return chance('showers');
    if (code >= 61) return code === 65 ? (p >= 60 ? 'Rain, heavy at times' : chance('rain')) : chance('rain');
    if (code >= 51) return chance('drizzle');
    if (code >= 45) return 'Areas of fog';
    return [isDay ? 'Sunny' : 'Clear', isDay ? 'Mostly sunny' : 'Mostly clear', 'Partly cloudy', 'Cloudy'][code] || 'Cloudy';
  }
  function genLocal() {
    const d = D.days, out = [];
    const windTxt = (sp, deg, gust) => sp < 5 ? 'Light and variable wind.' : `${dirWord(deg)[0].toUpperCase() + dirWord(deg).slice(1)} wind ${SPD(Math.max(0, sp - 5))} to ${SPD(sp)} ${SU()}${gust && gust > sp + 10 ? `, with gusts as high as ${SPD(gust)} ${SU()}` : ''}.`;
    const day = (i, name) => {
      const x = d[i]; if (!x) return;
      let t = `${skyPhrase(x.code, true, x.pop)}, with a high near ${T(x.hi)}. ${windTxt(x.windMax * .75, x.windDir, x.gustMax)}`;
      if (x.pop >= 20) t += ` Chance of precipitation is ${Math.round(x.pop / 10) * 10}%.`;
      if (x.snow >= .5) t += metric() ? ` New snow accumulation of around ${Math.round(x.snow * 2.54)} cm possible.` : ` New snow accumulation of around ${Math.round(x.snow)} inch${Math.round(x.snow) === 1 ? '' : 'es'} possible.`;
      out.push({ name, text: t });
    };
    const night = (i, name) => {
      const x = d[i]; if (!x || x.nightLo == null) return;
      let t = `${skyPhrase(x.nightCode, false, x.nightPop)}, with a low around ${T(x.nightLo)}. ${windTxt(x.nightWind, x.nightDir)}`;
      if (x.nightPop >= 20) t += ` Chance of precipitation is ${Math.round(x.nightPop / 10) * 10}%.`;
      out.push({ name, text: t });
    };
    if (localHour() < 15) { day(0, 'TODAY'); night(0, 'TONIGHT'); day(1, dayName(d[1].date, true).toUpperCase()); }
    else { night(0, 'TONIGHT'); day(1, dayName(d[1].date, true).toUpperCase()); night(1, dayName(d[1].date, true).toUpperCase() + ' NIGHT'); }
    return out;
  }

  /* ---------------- moon phases (Meeus ch. 49, main terms) ---------------- */
  function moonPhases(fromMs, count = 4) {
    const rad = Math.PI / 180, res = [];
    const year = new Date(fromMs).getUTCFullYear() + new Date(fromMs).getUTCMonth() / 12;
    const k = Math.floor((year - 2000) * 12.3685) - 1;
    for (let i = 0; res.length < count && i < 40; i++) {
      const q = (i % 4) / 4, kk = k + Math.floor(i / 4) + q, Tc = kk / 1236.85, E = 1 - .002516 * Tc;
      const M = (2.5534 + 29.1053567 * kk) * rad, Mp = (201.5643 + 385.81693528 * kk) * rad, F = (160.7108 + 390.67050284 * kk) * rad;
      const jde = 2451550.09766 + 29.530588861 * kk + .00015437 * Tc * Tc; let c;
      if (q === 0) c = -.4072 * Math.sin(Mp) + .17241 * E * Math.sin(M) + .01608 * Math.sin(2 * Mp) + .01039 * Math.sin(2 * F) + .00739 * E * Math.sin(Mp - M) - .00514 * E * Math.sin(Mp + M);
      else if (q === .5) c = -.40614 * Math.sin(Mp) + .17302 * E * Math.sin(M) + .01614 * Math.sin(2 * Mp) + .01043 * Math.sin(2 * F) + .00734 * E * Math.sin(Mp - M) - .00515 * E * Math.sin(Mp + M);
      else {
        c = -.62801 * Math.sin(Mp) + .17172 * E * Math.sin(M) - .01183 * E * Math.sin(Mp + M) + .00862 * Math.sin(2 * Mp) + .00804 * Math.sin(2 * F) + .00454 * E * Math.sin(Mp - M);
        const w = .00306 - .00038 * E * Math.cos(M) + .00026 * Math.cos(Mp); c += q === .25 ? w : -w;
      }
      const ms = (jde + c - 2440587.5) * 864e5 - 69e3;
      if (ms >= fromMs - 864e5 / 2) res.push({ kind: ['new', 'first', 'full', 'last'][i % 4], ms });
    }
    return res.sort((a, b) => a.ms - b.ms).slice(0, count);
  }

  /* ---------------- scrolling city list (Travel + Surrounding Cities) ---------------- */
  function cityScroller(el, rows, k, withText) {
    el.innerHTML = `<div class="box"></div><div class="inner trv s ${withText ? 'area' : ''}"><div class="th"><span class="c1">City</span><span class="c2">&nbsp;</span><span class="c5">Weather</span><span class="c3">Lo</span><span class="c4">Hi</span></div>
      <div class="list">${rows.map(c => `<div class="tr"><span class="c1">${esc(c.name)}</span><span class="c2">${Icons.html(Icons.fromCode(c.days[k].code, true))}</span><span class="c5">${esc(Icons.textFromCode(c.days[k].code, true))}</span><span class="c3">${T(c.days[k].lo)}</span><span class="c4">${T(c.days[k].hi)}</span></div>`).join('')}</div></div>`;
    const list = el.querySelector('.list');
    const dist = Math.max(0, rows.length * 46 - 494);
    const secs = Math.max(6, dist / 30);
    const anim = list.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(0)', offset: 1.5 / (secs + 3) }, { transform: `translateY(${-dist}px)`, offset: (secs + 1.5) / (secs + 3) }, { transform: `translateY(${-dist}px)` }], { duration: (secs + 3) * 1000 * S.speed, fill: 'forwards' });
    if (paused) anim.pause();
    return { dur: (secs + 3) * 1000, anim };
  }

  /* ---------------- pages ---------------- */
  const iconH = Icons.html;
  const PAGES = {
    intro: {
      title: () => ['Local on', 'the 8s'], dur: 5,
      say: () => `Here's your local forecast for ${locName()}.`,
      render: el => { el.innerHTML = `<div class="box"></div><div class="inner"><div class="intro"><div class="big s">YOUR LOCAL<br>FORECAST</div><div class="bar"></div><div class="city s">${esc(locName().toUpperCase())}${D.loc.admin ? ', ' + esc(D.loc.admin.toUpperCase()) : ''}</div><div class="sub s">${esc(fmt(new Date(), { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase())}</div></div></div>`; }
    },
    bulletin: {
      available: () => alerts().length > 0,
      title: () => ['Weather', 'Bulletin'], dur: 12,
      say: () => { const a = alerts()[0]; return a ? `A ${a.event} is in effect for your area.` : ''; },
      render: el => {
        const list = alerts().slice(0, 3);
        const draw = k => {
          const a = list[k];
          const exp = a.expires ? 'UNTIL ' + fmt(new Date(a.expires), { weekday: 'short', hour: 'numeric', minute: '2-digit' }).toUpperCase() : '';
          let body = (a.desc || '').replace(/\*/g, '').replace(/\s+/g, ' ').trim();
          if (a.instruction) body += ' ' + a.instruction.replace(/\s+/g, ' ');
          if (body.length > 560) body = body.slice(0, 557).replace(/\s\S*$/, '') + '...';
          el.innerHTML = `<div class="box red"></div><div class="bul"><div class="ev s">${esc(a.event.toUpperCase())}</div><div class="meta s">${esc(exp)}${a.area && !a.test ? ' — ' + esc(a.area.slice(0, 80)) : ''}</div><div class="tx s">${esc(body)}</div></div>`;
        };
        draw(0);
        return { steps: list.length, onStep: draw };
      }
    },
    current: {
      title: () => ['Current', 'Conditions'], dur: 10,
      say: () => `Currently in ${locName()}, it's ${T(D.current.temp)} degrees and ${D.current.text.toLowerCase()}.`,
      render: el => {
        const c = D.current;
        const chill = c.feels != null && Math.abs(c.feels - c.temp) >= 3 ? `<div class="kv"><span>${c.feels < c.temp ? 'Wind Chill' : 'Heat Index'}:</span><span>${T(c.feels)}°</span></div>` : '';
        el.innerHTML = `<div class="box"></div><div class="inner s">
          <div class="cc-top"><div class="cc-city">${esc(locName())}</div><div class="cc-temp">${T(c.temp)}°</div><div class="cc-text">${esc(c.text)}</div>${iconH(c.icon)}</div>
          <div class="cc-list">
            <div class="kv"><span>Wind:</span><span>${windStr(c.wind, c.windDir)}${c.gust && c.gust > c.wind + 7 ? ` G${SPD(c.gust)}` : ''}</span></div>
            <div class="kv"><span>Humidity:</span><span>${Math.round(c.humidity)}%</span></div>
            <div class="kv"><span>Dewpoint:</span><span>${T(c.dew)}°</span></div>
            <div class="kv"><span>Ceiling:</span><span>${ceil(c.ceiling)}</span></div>
            <div class="kv"><span>Visibility:</span><span>${vis(c.vis)}</span></div>
            <div class="kv"><span>Pressure:</span><span>${pres(c.pressure)}${trendArrow(c.trend)}</span></div>${chill}</div></div>`;
      }
    },
    latest: {
      available: () => D.near.length >= 3,
      title: () => ['Latest', 'Observations'], dur: 10,
      render: el => {
        const rows = [{ name: locName(), temp: D.current.temp, text: D.current.text, wind: D.current.wind, dir: D.current.windDir },
          ...D.near.slice(0, 8).map(n => ({ name: n.name, temp: n.temp, text: Icons.textFromCode(n.code, n.isDay, n.wind), wind: n.wind, dir: n.dir }))];
        el.innerHTML = `<div class="box"></div><div class="inner"><div class="tbl s"><div class="th"><span class="c1">Location</span><span class="c2">°${U()}</span><span class="c3">Weather</span><span class="c4">Wind</span></div>
          ${rows.map(r => `<div class="tr"><span class="c1">${esc(r.name.slice(0, 12))}</span><span class="c2">${T(r.temp)}</span><span class="c3">${esc(r.text.slice(0, 13))}</span><span class="c4">${r.wind < 1 ? 'Calm' : dir(r.dir) + SPD(r.wind)}</span></div>`).join('')}</div></div>`;
      }
    },
    local: {
      title: () => ['Local', 'Forecast'], dur: 9,
      say: () => { const p = (useNwsText() ? D.localText : genLocal())[0]; return p ? `${p.name.toLowerCase()}, ${p.text}` : ''; },
      render: el => {
        const periods = useNwsText() ? D.localText : genLocal();
        el.innerHTML = `<div class="box"></div><div class="lf s" id="lf"></div>`;
        const box = el.querySelector('#lf');
        const pages = []; let cur = '';
        const probe = document.createElement('div'); probe.className = 'pg'; box.appendChild(probe);
        const words = periods.flatMap((p, i) => [...(i ? ['¶'] : []), ...`${p.name}...${p.text}`.split(/\s+/)]);
        for (const w of words) {
          const next = w === '¶' ? (cur ? cur + '<br>' : '') : cur + (cur && !cur.endsWith('<br>') ? ' ' : '') + esc(w);
          probe.innerHTML = next;
          if (probe.scrollHeight > box.clientHeight + 2 && cur) { pages.push(cur); cur = w === '¶' ? '' : esc(w); }
          else cur = next;
        }
        if (cur.replace(/<br>/g, '').trim()) pages.push(cur);
        const draw = k => { probe.innerHTML = pages[k].replace(/^(<br>)+/, ''); };
        draw(0);
        return { steps: pages.length, onStep: draw };
      }
    },
    extended: {
      title: () => ['Extended', 'Forecast'], dur: 9,
      render: el => {
        const ds = D.days.slice(1, 7);
        const draw = k => {
          el.innerHTML = `<div class="box"></div><div class="inner ext s">${ds.slice(k * 3, k * 3 + 3).map(d => `<div class="d">
            <div class="l"><div class="dn">${dayName(d.date, true)}</div>${iconH(Icons.fromCode(d.code, true, d.windMax))}</div>
            <div class="r"><div class="tx">${esc(Icons.textFromCode(d.code, true, d.windMax))}</div>
              <div class="lh"><div class="lo"><div class="lab">Lo</div><div class="v">${T(d.lo)}</div></div><div class="hi"><div class="lab">Hi</div><div class="v">${T(d.hi)}</div></div></div></div></div>`).join('')}</div>`;
        };
        draw(0);
        return { steps: Math.min(2, Math.ceil(ds.length / 3)), onStep: draw };
      }
    },
    week: {
      title: () => ['The Week', 'Ahead'], dur: 11,
      say: () => 'Here is a look at the week ahead.',
      render: el => {
        el.innerHTML = `<div class="box"></div><div class="inner wk s">${D.days.slice(0, 7).map((d, i) => `<div class="d ${i ? '' : 'today'}">
          <div class="dd"><div class="dn">${i ? dayName(d.date) : 'Today'}</div><div class="dt">${monDay(d.date)}</div></div>
          ${iconH(Icons.fromCode(d.code, true, d.windMax))}<div class="tx">${esc(Icons.textFromCode(d.code, true, d.windMax))}</div>
          <div class="hi">${T(d.hi)}°</div><div class="lo">${T(d.lo)}°</div><div class="pp">${d.pop >= 10 ? '☂' + d.pop + '%' : ''}</div></div>`).join('')}</div>`;
      }
    },
    area: {
      available: () => (D.area || []).some(c => c.days && c.days.length),
      title: () => ['Surrounding Cities', travelDay() ? 'Tomorrow' : 'Today'],
      say: () => 'Here is the forecast for the surrounding area.',
      render: el => { const k = travelDay(); return cityScroller(el, D.area.filter(c => c.days && c.days[k]), k, true); }
    },
    travel: {
      available: () => D.travel.length > 0,
      title: () => { const k = travelDay(); return ['Travel Forecast', 'For ' + (D.travel[0]?.days[k] ? dayName(D.travel[0].days[k].date, true) : '')]; },
      render: el => { const k = travelDay(); return cityScroller(el, D.travel.filter(c => c.days[k]), k, false); }
    },
    almanac: {
      title: () => ['Almanac', ''], dur: 10,
      render: el => {
        const a = D.days[0], b = D.days[1] || a;
        const uv = a.uv == null ? null : Math.round(a.uv);
        const uvw = uv == null ? '' : uv <= 2 ? 'Low' : uv <= 5 ? 'Moderate' : uv <= 7 ? 'High' : uv <= 10 ? 'Very High' : 'Extreme';
        el.innerHTML = `<div class="box"></div><div class="inner alm s">
          <div class="g"><div></div><div class="h">${dayName(a.date, true)}</div><div class="h">${dayName(b.date, true)}</div>
            <div>Sunrise:</div><div class="v">${hm(a.sunrise)}</div><div class="v">${hm(b.sunrise)}</div>
            <div>Sunset:</div><div class="v">${hm(a.sunset)}</div><div class="v">${hm(b.sunset)}</div></div>
          <div class="sec">Moon Phases</div><div class="moons" id="moons"></div>
          ${uv != null ? `<div class="uv">UV Index Today: ${uv} <span class="y">${uvw}</span></div>` : ''}</div>`;
        const m = el.querySelector('#moons');
        moonPhases(Date.now()).forEach(p => {
          const d = document.createElement('div');
          d.innerHTML = `<div class="n">${{ new: 'New', first: 'First', full: 'Full', last: 'Last' }[p.kind]}</div>`;
          d.appendChild(Icons.moonPhase(p.kind));
          const dd = document.createElement('div'); dd.className = 'dd'; dd.textContent = fmt(new Date(p.ms), { month: 'short', day: 'numeric' }); d.appendChild(dd);
          m.appendChild(d);
        });
      }
    }
  };
  const useNwsText = () => D.localText && !metric();
  const travelDay = () => localHour() >= 15 ? 1 : 0;

  /* ---------------- sequencer ---------------- */
  let seq = [], si = -1, timer = null, paused = false, step = 0, steps = 1, stepDur = 0, onStep = null, inStandby = false, curAnim = null;
  function buildSeq() {
    seq = PAGE_LIST.map(p => p[0]).filter(k => S.pages[k] !== false && (!PAGES[k].available || PAGES[k].available()));
    if (!seq.length) seq = ['current'];
  }
  function show(i) {
    if (!D) return;
    inStandby = false; clearTimeout(timer);
    si = ((i % seq.length) + seq.length) % seq.length;
    const P = PAGES[seq[si]];
    setTitle(P.title());
    pageEl.innerHTML = '';
    const r = P.render(pageEl) || {};
    curAnim = r.anim || null; steps = r.steps || 1; onStep = r.onStep || null; step = 0;
    stepDur = (r.dur || P.dur * 1000) * S.speed;
    flash(); setDots();
    if (P.say) say(P.say());
    arm();
  }
  function arm() { clearTimeout(timer); if (!paused) timer = setTimeout(advance, stepDur); }
  function advance() {
    if (step < steps - 1) { step++; onStep && onStep(step); arm(); return; }
    if (S.mode === 'eights' && si === seq.length - 1) { standby(); return; }
    show(si + 1);
  }
  function flash() { const f = $('#flash'); f.classList.remove('on'); void f.offsetWidth; f.classList.add('on'); }

  let sbTimer = null;
  function nextEight() {
    const n = new Date(), m = n.getMinutes(), add = ((8 - (m % 10)) + 10) % 10 || (n.getSeconds() < 2 ? 0 : 10);
    const t = new Date(n); t.setSeconds(0, 0); t.setMinutes(m + add); return t;
  }
  const sbNow = () => `${iconH(D.current.icon)}<span class="now">${T(D.current.temp)}° ${esc(D.current.text)}</span>`;
  function refreshStandby() { const el = $('#sb-now'); if (el) el.innerHTML = sbNow(); }
  function standby() {
    clearTimeout(timer); inStandby = true; setDots();
    setTitle(['Local on', 'the 8s']);
    const nxt = nextEight();
    pageEl.innerHTML = `<div class="box"></div><div class="inner"><div class="sb s"><div class="l1">YOUR NEXT LOCAL FORECAST</div><div class="l2" id="sb-cd">--</div>
      <div class="l3">AT ${esc(fmt(nxt, { hour: 'numeric', minute: '2-digit' }))} · ON THE 8s</div><div id="sb-now">${sbNow()}</div>
      <div class="l3" style="margin-top:28px;font-size:17px">Swipe or tap NEXT to watch now</div></div></div>`;
    clearInterval(sbTimer);
    sbTimer = setInterval(() => {
      if (!inStandby) { clearInterval(sbTimer); return; }
      const ms = nxt - Date.now();
      if (ms <= 0) { clearInterval(sbTimer); buildSeq(); show(0); return; }
      const el = $('#sb-cd'); if (el) el.textContent = `${Math.floor(ms / 6e4)}m ${String(Math.floor(ms / 1e3) % 60).padStart(2, '0')}s`;
    }, 500);
  }

  function loadingScreen(msg) {
    clearTimeout(timer); setTitle(['Please', 'Stand By']); $('#dots').innerHTML = '';
    pageEl.innerHTML = `<div class="box"></div><div class="inner"><div class="loading s"><div>${esc(msg)}<span class="dots"></span></div></div></div>`;
  }
  function errorScreen(msg) {
    clearTimeout(timer); setTitle(['Technical', 'Difficulties']); $('#dots').innerHTML = '';
    pageEl.innerHTML = `<div class="box"></div><div class="inner"><div class="loading s"><div>WE ARE EXPERIENCING<br>TECHNICAL DIFFICULTIES</div><div style="font-size:17px;margin-top:14px;color:#ffe080">${esc(msg)}</div><div style="font-size:17px;margin-top:10px">Retrying shortly. Open Settings → Refresh to retry now.</div></div></div>`;
  }

  /* ---------------- data: 30 s quick refresh, 15 min full refresh ---------------- */
  const QUICK_MS = 30 * 1000, FULL_MS = 15 * 60 * 1000;
  let refreshTimer = null, quickBusy = false, lastFull = 0;
  async function loadData(first) {
    if (!LOC) return;
    if (first && !D) loadingScreen('RETRIEVING YOUR LOCAL FORECAST');
    try {
      D = LOC.demo ? WX.demo() : await WX.load(LOC, D);
      lastFull = Date.now();
      if (!LOC.demo) try { localStorage.setItem(LS('data'), JSON.stringify(D)); } catch (e) { }
      afterData(first);
    } catch (e) {
      console.warn(e);
      if (!D) {
        let c = null; try { c = JSON.parse(localStorage.getItem(LS('data')) || 'null'); } catch (x) { }
        if (c && c.loc && Math.abs(c.loc.lat - LOC.lat) < .01) { D = c; afterData(first); } else errorScreen(navigator.onLine === false ? 'No internet connection.' : String(e.message || e));
      }
      lastFull = Date.now() - FULL_MS + 60 * 1000;
    }
    schedule();
  }
  function schedule() { clearTimeout(refreshTimer); refreshTimer = setTimeout(refreshTick, QUICK_MS); }
  async function refreshTick() {
    if (document.hidden || !LOC) { schedule(); return; }
    if (!D || Date.now() - lastFull >= FULL_MS) { await loadData(false); return; }
    if (!quickBusy && !D.demo) {
      quickBusy = true;
      try { if (await WX.quick(D)) { try { localStorage.setItem(LS('data'), JSON.stringify(D)); } catch (e) { } afterData(false); } } catch (e) { console.warn(e); }
      quickBusy = false;
    }
    schedule();
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { fit(); if (D && LOC) { clearTimeout(refreshTimer); refreshTick(); } } });
  addEventListener('online', () => { if (LOC) loadData(!D); });

  function afterData(first) {
    const curKey = seq[si];
    buildCond(); if (first) condIdx = 0; rotateCond(); updateCrawl(); buildSeq(); tickClock();
    if (first || si < 0) { show(0); return; }
    if (inStandby) { refreshStandby(); return; }
    const k = seq.indexOf(curKey);
    if (k < 0) { show(Math.min(si, seq.length - 1)); return; }
    si = k; setDots();
    if (curKey === 'current') PAGES.current.render(pageEl);
  }

  /* ---------------- location setup ---------------- */
  const setup = $('#setup');
  function openSetup(cancelable) {
    setup.classList.remove('hidden'); $('#setup-cancel').classList.toggle('hidden', !cancelable);
    $('#loc-results').innerHTML = ''; $('#loc-msg').textContent = '';
    $('#a2hs').classList.toggle('hidden', !(isIOS && !standalone));
  }
  function chooseLoc(loc) {
    LOC = loc; localStorage.setItem(LS('loc'), JSON.stringify(loc));
    $('#loc-input').blur();
    setup.classList.add('hidden'); D = null; si = -1;
    unlockAudio();
    loadData(true);
  }
  $('#loc-form').addEventListener('submit', async e => {
    e.preventDefault(); unlockAudio();
    const q = $('#loc-input').value; if (!q.trim()) return;
    $('#loc-input').blur();
    $('#loc-msg').textContent = 'SEARCHING...'; $('#loc-results').innerHTML = '';
    try {
      const r = await WX.geocode(q);
      if (!r.length) { $('#loc-msg').textContent = 'NO MATCHES. TRY "CITY, STATE" OR A ZIP CODE.'; return; }
      if (r.length === 1) { chooseLoc(r[0]); return; }
      $('#loc-msg').textContent = 'SELECT YOUR LOCATION:';
      $('#loc-results').innerHTML = r.slice(0, 8).map((x, i) => `<button data-i="${i}">${esc(x.name)}${x.admin ? ', ' + esc(x.admin) : ''} <span class="small">${esc(x.country)}</span></button>`).join('');
      $('#loc-results').querySelectorAll('button').forEach(b => b.onclick = () => chooseLoc(r[+b.dataset.i]));
    } catch (err) { $('#loc-msg').textContent = 'LOOKUP FAILED — CHECK YOUR CONNECTION.'; }
  });
  $('#geo-btn').onclick = () => {
    unlockAudio();
    if (!navigator.geolocation) { $('#loc-msg').textContent = 'LOCATION NOT AVAILABLE ON THIS DEVICE.'; return; }
    $('#loc-msg').textContent = 'FINDING YOU...';
    navigator.geolocation.getCurrentPosition(async p => {
      chooseLoc(await WX.reverse(+p.coords.latitude.toFixed(4), +p.coords.longitude.toFixed(4)));
    }, () => { $('#loc-msg').textContent = 'LOCATION PERMISSION DENIED. CHECK Settings → Privacy → Location Services → Safari Websites, OR TYPE A CITY.'; }, { timeout: 15000, maximumAge: 6e5 });
  };
  $('#demo-btn').onclick = () => chooseLoc({ demo: true, name: 'Chicago', admin: 'IL', cc: 'US', lat: 41.88, lon: -87.63 });
  $('#setup-cancel').onclick = () => setup.classList.add('hidden');

  /* ---------------- audio / wake lock ---------------- */
  let audioUnlocked = false, wake = null;
  function requestWake() { if ('wakeLock' in navigator && !wake && !document.hidden) navigator.wakeLock.request('screen').then(w => { wake = w; w.addEventListener('release', () => wake = null); }).catch(() => { }); }
  function unlockAudio() {
    if (!audioUnlocked) {
      audioUnlocked = true;
      try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { }
      Music.unlock(); Music.setVolume(+S.vol);
    }
    if (+S.music) Music.start();
    requestWake(); updateButtons();
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden && audioUnlocked) requestWake(); });
  const firstTap = () => { unlockAudio(); removeEventListener('touchend', firstTap); removeEventListener('click', firstTap); };
  addEventListener('touchend', firstTap); addEventListener('click', firstTap);

  /* ---------------- controls: tap to show, swipe to change page ---------------- */
  const ctr = $('#controls'); let ctrTimer;
  function showControls() { ctr.classList.remove('hidden'); clearTimeout(ctrTimer); ctrTimer = setTimeout(() => ctr.classList.add('hidden'), 4000); }
  function updateButtons() { $('#btn-music').classList.toggle('off', !+S.music); $('#btn-pause').innerHTML = paused ? ICON_PLAY : ICON_PAUSE; }
  function act(a) {
    showControls();
    if (a === 'next') { if (inStandby) { buildSeq(); show(0); } else show(si + 1); }
    if (a === 'prev') show(inStandby ? 0 : si - 1);
    if (a === 'pause') { paused = !paused; if (paused) { clearTimeout(timer); curAnim?.pause(); } else { curAnim?.play(); arm(); } updateButtons(); }
    if (a === 'music') { S.music = +S.music ? 0 : 1; save(); +S.music ? unlockAudio() : Music.stop(); updateButtons(); syncSettings(); }
    if (a === 'loc') openSetup(true);
    if (a === 'settings') openSettings();
  }
  ctr.querySelectorAll('button').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); act(b.dataset.act); }));
  let tx0 = 0, ty0 = 0, tt0 = 0;
  const vpEl = $('#viewport');
  vpEl.addEventListener('touchstart', e => { const t = e.touches[0]; tx0 = t.clientX; ty0 = t.clientY; tt0 = Date.now(); }, { passive: true });
  vpEl.addEventListener('touchend', e => {
    const t = e.changedTouches[0];
    let dx = t.clientX - tx0, dy = t.clientY - ty0;
    if (matchMedia('(orientation: landscape) and (pointer: coarse)').matches) [dx, dy] = [-dy, dx];
    if (Math.abs(dx) > 50 && Math.abs(dy) < 80 && Date.now() - tt0 < 800) { if (D) act(dx < 0 ? 'next' : 'prev'); }
    else if (Math.abs(dx) < 10 && Math.abs(dy) < 10) showControls();
  }, { passive: true });
  vpEl.addEventListener('click', () => { if (!('ontouchstart' in window)) showControls(); });
  addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
    const k = e.key.toLowerCase();
    if (k === 'arrowright') act('next'); else if (k === 'arrowleft') act('prev'); else if (k === ' ') { e.preventDefault(); act('pause'); }
  });

  /* ---------------- settings ---------------- */
  const setEl = $('#settings');
  const bind = { units: '#set-units', mode: '#set-mode', speed: '#set-speed', music: '#set-music', vol: '#set-vol', voice: '#set-voice', crt: '#set-crt', beep: '#set-beep', testalert: '#set-testalert' };
  function syncSettings() { Object.entries(bind).forEach(([k, sel]) => { $(sel).value = String(S[k]); }); document.body.classList.toggle('nocrt', !+S.crt); }
  function openSettings() {
    syncSettings();
    $('#set-pages').innerHTML = PAGE_LIST.map(([k, n]) => `<label><input type="checkbox" data-p="${k}" ${S.pages[k] !== false ? 'checked' : ''}>${n}</label>`).join('');
    $('#set-pages').querySelectorAll('input').forEach(i => i.onchange = () => { S.pages[i.dataset.p] = i.checked; save(); buildSeq(); });
    $('#credits').innerHTML = `Data: <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo.com</a> (CC BY 4.0) · US observations, forecast text &amp; alerts: <a href="https://www.weather.gov/" target="_blank" rel="noopener">NOAA / National Weather Service</a>.<br>${D ? `Location: ${esc(D.loc.name)} · Source: ${esc(D.current.source)} · Conditions updated ${fmt(new Date(D.updated || D.fetched), { hour: 'numeric', minute: '2-digit', second: '2-digit' })} (every 30 sec) · Forecast updated ${fmt(new Date(D.fetched), { hour: 'numeric', minute: '2-digit' })} (every 15 min)${D.alertsSupported ? '' : ' · Severe alerts are US only'}` : ''}<br>Swipe left/right to change pages · tap for controls.<br>A fan tribute to 1990s cable weather. Not affiliated with The Weather Channel.`;
    setEl.classList.remove('hidden'); setEl.scrollTop = 0;
  }
  Object.entries(bind).forEach(([k, sel]) => $(sel).addEventListener('input', () => {
    const v = $(sel).value; S[k] = ['units', 'mode'].includes(k) ? v : +v; save();
    if (k === 'crt') document.body.classList.toggle('nocrt', !+S.crt);
    if (k === 'vol') Music.setVolume(+S.vol);
    if (k === 'music') { +S.music ? unlockAudio() : Music.stop(); updateButtons(); }
    if (k === 'testalert') { updateCrawl(); buildSeq(); }
    if (k === 'units') { buildCond(); rotateCond(); }
  }));
  $('#set-close').onclick = () => { setEl.classList.add('hidden'); if (D) { buildSeq(); show(Math.max(0, Math.min(si, seq.length - 1))); } };
  $('#set-refresh').onclick = () => { setEl.classList.add('hidden'); loadData(true); };
  $('#set-loc').onclick = () => { setEl.classList.add('hidden'); openSetup(true); };

  /* ---------------- boot ---------------- */
  syncSettings(); updateButtons();
  if (new URLSearchParams(location.search).has('demo')) LOC = { demo: true, name: 'Chicago', admin: 'IL', cc: 'US', lat: 41.88, lon: -87.63 };
  if (LOC) { setup.classList.add('hidden'); loadData(true); }
  else { setTitle(['Local on', 'the 8s']); pageEl.innerHTML = '<div class="box"></div>'; condEl.textContent = 'Welcome! Enter your location to tune in.'; openSetup(false); }

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => { });
  window.RC = { show, get seq() { return seq; }, get D() { return D; }, S, fit };
})();
