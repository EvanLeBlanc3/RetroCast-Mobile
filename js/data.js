/* RetroCast – weather data layer.
   Primary: Open-Meteo (global, free, no key). US enrichment: National Weather Service (api.weather.gov) for
   real station observations, NWS forecast text and official severe weather alerts. */
const WX = (() => {
  const OM = 'https://api.open-meteo.com/v1/forecast';
  const NWS = 'https://api.weather.gov';

  async function getJSON(url, { timeout = 15000, headers = {} } = {}) {
    const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), timeout);
    try {
      const r = await fetch(url, { signal: ctl.signal, headers, cache: 'no-store' });
      if (!r.ok) throw new Error(`${r.status} ${url}`);
      return await r.json();
    } finally { clearTimeout(tm); }
  }
  const nws = url => getJSON(url, { headers: { Accept: 'application/geo+json' } });

  async function geocode(q) {
    q = q.trim();
    const zip = q.match(/^(\d{5})(?:-\d{4})?$/);
    if (zip) {
      const d = await getJSON(`https://api.zippopotam.us/us/${zip[1]}`);
      return d.places.map(p => ({ name: p['place name'], admin: p['state abbreviation'], country: 'United States', cc: 'US', lat: +p.latitude, lon: +p.longitude }));
    }
    let name = q, hint = null;
    const parts = q.split(',').map(s => s.trim()).filter(Boolean);
    if (parts.length > 1) { name = parts[0]; hint = parts.slice(1).join(' ').toLowerCase(); }
    const d = await getJSON(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=12&language=en&format=json`);
    let res = (d.results || []).map(r => ({
      name: r.name, admin: r.country_code === 'US' ? (US_STATES[r.admin1] || r.admin1 || '') : (r.admin1 || ''),
      country: r.country || '', cc: r.country_code || '', lat: r.latitude, lon: r.longitude
    }));
    if (hint) {
      const f = res.filter(r => r.admin.toLowerCase() === hint || r.admin.toLowerCase().startsWith(hint) ||
        r.country.toLowerCase().startsWith(hint) || r.cc.toLowerCase() === hint ||
        Object.entries(US_STATES).some(([n, a]) => a === r.admin && n.toLowerCase().startsWith(hint)));
      if (f.length) res = f;
    }
    return res;
  }

  async function reverse(lat, lon) {
    try {
      const p = await nws(`${NWS}/points/${lat.toFixed(4)},${lon.toFixed(4)}`);
      const rl = p.properties.relativeLocation.properties;
      return { name: rl.city, admin: rl.state, country: 'United States', cc: 'US', lat, lon };
    } catch (e) { }
    try {
      const d = await getJSON(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`);
      return { name: d.city || d.locality || 'Your Location', admin: d.principalSubdivisionCode?.split('-')[1] || d.principalSubdivision || '', country: d.countryName || '', cc: d.countryCode || '', lat, lon };
    } catch (e) { return { name: 'Your Location', admin: '', country: '', cc: '', lat, lon }; }
  }

  function hav(a, b, c, d) {
    const R = 3958.8, r = Math.PI / 180, dl = (c - a) * r, dn = (d - b) * r;
    const x = Math.sin(dl / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin(dn / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x));
  }
  function nearestCities(lat, lon, n = 14, maxMi = 400) {
    return CITIES.map(c => ({ ...c, dist: hav(lat, lon, c.lat, c.lon) }))
      .filter(c => c.dist > 6 && c.dist < maxMi).sort((a, b) => a.dist - b.dist).slice(0, n);
  }
  const cToF = c => c == null ? null : c * 9 / 5 + 32;
  const kmhToMph = k => k == null ? null : k / 1.609344;

  const CUR_VARS = 'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m,dew_point_2m,visibility';
  async function openMeteo(lat, lon) {
    const hourly = 'temperature_2m,weather_code,pressure_msl,precipitation_probability,wind_speed_10m,wind_direction_10m,is_day';
    const daily = 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset,uv_index_max,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant,precipitation_sum,snowfall_sum';
    return getJSON(`${OM}?latitude=${lat}&longitude=${lon}&current=${CUR_VARS}&hourly=${hourly}&daily=${daily}&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch&timezone=auto&forecast_days=9&past_days=1`);
  }
  async function multiCurrent(list) {
    if (!list.length) return [];
    const d = await getJSON(`${OM}?latitude=${list.map(c => c.lat).join(',')}&longitude=${list.map(c => c.lon).join(',')}&current=temperature_2m,weather_code,wind_speed_10m,wind_direction_10m,is_day&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto`);
    const arr = Array.isArray(d) ? d : [d];
    return list.map((c, i) => { const x = arr[i].current; return { ...c, temp: x.temperature_2m, code: x.weather_code, wind: x.wind_speed_10m, dir: x.wind_direction_10m, isDay: !!x.is_day }; });
  }
  async function multiDaily(list) {
    if (!list.length) return [];
    const d = await getJSON(`${OM}?latitude=${list.map(c => c.lat).join(',')}&longitude=${list.map(c => c.lon).join(',')}&daily=weather_code,temperature_2m_max,temperature_2m_min&temperature_unit=fahrenheit&timezone=auto&forecast_days=3`);
    const arr = Array.isArray(d) ? d : [d];
    return list.map((c, i) => { const x = arr[i].daily; return { ...c, days: x.time.map((t, k) => ({ date: t, code: x.weather_code[k], hi: x.temperature_2m_max[k], lo: x.temperature_2m_min[k] })) }; });
  }

  async function nwsBundle(lat, lon) {
    const p = await nws(`${NWS}/points/${lat.toFixed(4)},${lon.toFixed(4)}`);
    const pr = p.properties;
    const [fc, st, al] = await Promise.allSettled([
      nws(pr.forecast),
      nws(pr.observationStations).then(async s => {
        for (const f of s.features.slice(0, 3)) {
          const id = f.properties.stationIdentifier;
          try {
            const o = await nws(`${NWS}/stations/${id}/observations/latest`);
            const age = (Date.now() - new Date(o.properties.timestamp)) / 36e5;
            if (age < 2.5 && o.properties.temperature.value != null) return { id, name: f.properties.name, obs: o.properties };
          } catch (e) { }
        }
        return null;
      }),
      nws(`${NWS}/alerts/active?point=${lat.toFixed(4)},${lon.toFixed(4)}`)
    ]);
    return {
      periods: fc.status === 'fulfilled' ? fc.value.properties.periods : null,
      station: st.status === 'fulfilled' ? st.value : null,
      alerts: al.status === 'fulfilled' ? al.value.features.map(f => f.properties) : null
    };
  }

  function makeCurrent(c, cu, p3, station) {
    const visMi = c.visibility == null ? null : (cu.visibility === 'ft' ? c.visibility / 5280 : c.visibility / 1609.34);
    const cur = {
      temp: c.temperature_2m, feels: c.apparent_temperature, humidity: c.relative_humidity_2m, dew: c.dew_point_2m,
      pressure: c.pressure_msl, trend: p3 == null ? 'S' : c.pressure_msl - p3 > .6 ? 'R' : c.pressure_msl - p3 < -.6 ? 'F' : 'S',
      windDir: c.wind_direction_10m, wind: c.wind_speed_10m, gust: c.wind_gusts_10m, vis: visMi, ceiling: null,
      cloud: c.cloud_cover, code: c.weather_code, isDay: !!c.is_day, text: null, icon: null, source: 'Open-Meteo'
    };
    const o = station?.obs;
    if (o) {
      const v = k => o[k]?.value;
      if (v('temperature') != null) cur.temp = cToF(v('temperature'));
      if (v('dewpoint') != null) cur.dew = cToF(v('dewpoint'));
      if (v('relativeHumidity') != null) cur.humidity = v('relativeHumidity');
      if (v('windSpeed') != null) cur.wind = kmhToMph(v('windSpeed'));
      if (v('windDirection') != null) cur.windDir = v('windDirection');
      cur.gust = v('windGust') != null ? kmhToMph(v('windGust')) : null;
      if (v('barometricPressure') != null) cur.pressure = v('barometricPressure') / 100;
      if (v('visibility') != null) cur.vis = v('visibility') / 1609.34;
      const layers = (o.cloudLayers || []).filter(l => ['BKN', 'OVC', 'VV'].includes(l.amount) && l.base?.value != null);
      cur.ceiling = layers.length ? Math.round(Math.min(...layers.map(l => l.base.value)) * 3.28084 / 100) * 100 : 'unl';
      if (o.textDescription) { cur.text = o.textDescription; cur.icon = Icons.fromText(o.textDescription, cur.isDay); }
      cur.source = 'NWS ' + station.id;
      if (v('heatIndex') != null) cur.feels = cToF(v('heatIndex')); else if (v('windChill') != null) cur.feels = cToF(v('windChill'));
    }
    if (cur.ceiling == null && cur.cloud != null && cur.cloud < 50) cur.ceiling = 'unl';
    if (!cur.text) cur.text = Icons.textFromCode(cur.code, cur.isDay, cur.wind);
    if (!cur.icon) cur.icon = Icons.fromCode(cur.code, cur.isDay, cur.wind);
    return cur;
  }
  const sevRank = s => ({ Extreme: 4, Severe: 3, Moderate: 2, Minor: 1 })[s] || 0;
  const mapAlerts = list => (list || []).map(a => ({
    event: a.event, headline: a.headline || a.event, desc: a.description || '', instruction: a.instruction || '', severity: a.severity,
    expires: a.ends || a.expires, area: a.areaDesc || ''
  })).sort((a, b) => sevRank(b.severity) - sevRank(a.severity));
  const avg = a => a.reduce((x, y) => x + y, 0) / (a.length || 1);
  function worst(codes) {
    const rank = c => c >= 95 ? 9 : (c >= 71 && c <= 77) || c === 85 || c === 86 ? 8 : (c >= 56 && c <= 67) || (c >= 80 && c <= 82) ? 7 : c >= 51 ? 6 : c >= 45 ? 5 : c;
    return codes.reduce((a, b) => rank(b) > rank(a) ? b : a, codes[0]);
  }

  function build(loc, om, nwsB, near, travel, area) {
    const c = om.current, cu = om.current_units || {}, h = om.hourly, d = om.daily;
    let hi = h.time.findIndex(t => t.startsWith(c.time.slice(0, 13))); if (hi < 0) hi = 0;
    const p3 = h.pressure_msl[Math.max(0, hi - 3)];
    const cur = makeCurrent(c, cu, p3, nwsB?.station);
    const today = c.time.slice(0, 10);
    const days = d.time.map((t, i) => ({
      date: t, code: d.weather_code[i], hi: d.temperature_2m_max[i], lo: d.temperature_2m_min[i], pop: d.precipitation_probability_max[i],
      sunrise: d.sunrise[i], sunset: d.sunset[i], uv: d.uv_index_max[i], windMax: d.wind_speed_10m_max[i], gustMax: d.wind_gusts_10m_max[i],
      windDir: d.wind_direction_10m_dominant[i], precip: d.precipitation_sum[i], snow: d.snowfall_sum[i]
    })).filter(x => x.date >= today);
    days.forEach((dd, i) => {
      const next = days[i + 1]; if (!next) return;
      const idx = h.time.map((t, k) => (t >= dd.date + 'T18' && t <= next.date + 'T08') ? k : -1).filter(k => k >= 0);
      if (idx.length) {
        dd.nightLo = Math.min(...idx.map(k => h.temperature_2m[k]));
        dd.nightCode = worst(idx.map(k => h.weather_code[k]));
        dd.nightPop = Math.max(...idx.map(k => h.precipitation_probability[k] ?? 0));
        dd.nightWind = avg(idx.map(k => h.wind_speed_10m[k])); dd.nightDir = h.wind_direction_10m[idx[(idx.length / 2) | 0]];
      }
    });
    const localText = nwsB?.periods?.length ? nwsB.periods.slice(0, 4).map(p => ({ name: p.name.toUpperCase(), text: p.detailedForecast })) : null;
    return {
      loc: { ...loc, tz: om.timezone, isUS: loc.cc === 'US' || !!nwsB },
      current: cur, days, localText, near: near || [], travel: travel || [], area: area || [],
      alerts: mapAlerts(nwsB?.alerts), alertsSupported: !!nwsB, fetched: Date.now(), updated: Date.now(),
      _om: { current: c, units: cu, p3, at: Date.now() },
      _station: nwsB?.station ? { id: nwsB.station.id, name: nwsB.station.name, obs: nwsB.station.obs } : null
    };
  }

  async function load(loc, prev) {
    const isUSGuess = loc.cc === 'US';
    const same = prev && !prev.demo && Math.abs(prev.loc.lat - loc.lat) < .001 && Math.abs(prev.loc.lon - loc.lon) < .001;
    const fresh = (key, mins) => same && prev[key]?.length && Date.now() - (prev._at?.[key] || 0) < mins * 6e4;
    const near = nearestCities(loc.lat, loc.lon, 8, 400);
    const travelList = (isUSGuess ? TRAVEL_US : TRAVEL_WORLD).map(n => CITIES.find(c => c.name === n)).filter(Boolean);
    const areaList = nearestCities(loc.lat, loc.lon, 12, 250);
    const [om, nwsB, nearR, travR, areaR] = await Promise.allSettled([
      openMeteo(loc.lat, loc.lon),
      isUSGuess || (loc.lat > 17 && loc.lat < 72 && loc.lon < -60 && loc.lon > -180) ? nwsBundle(loc.lat, loc.lon) : Promise.reject('non-US'),
      fresh('near', 14) ? Promise.resolve(prev.near) : multiCurrent(near),
      fresh('travel', 60) ? Promise.resolve(prev.travel) : multiDaily(travelList),
      fresh('area', 30) ? Promise.resolve(prev.area) : multiDaily(areaList)
    ]);
    if (om.status !== 'fulfilled') throw new Error('Weather service unreachable: ' + (om.reason?.message || om.reason));
    const pick = (r, key) => r.status === 'fulfilled' ? r.value : (same ? prev[key] || [] : []);
    const D = build(loc, om.value, nwsB.status === 'fulfilled' ? nwsB.value : null, pick(nearR, 'near'), pick(travR, 'travel'), pick(areaR, 'area'));
    D._at = {};
    [['near', nearR], ['travel', travR], ['area', areaR]].forEach(([k, r]) => {
      D._at[k] = r.status === 'fulfilled' && same && r.value === prev[k] ? prev._at[k] : r.status === 'fulfilled' ? Date.now() : (prev?._at?.[k] || 0);
    });
    return D;
  }

  /* 30-second quick refresh: current conditions + alerts, updated in place. */
  async function quick(D) {
    if (!D || D.demo) return false;
    const { lat, lon } = D.loc, now = Date.now();
    const needOM = !D._station || now - (D._om?.at || 0) > 5 * 6e4;
    const [om, obs, al] = await Promise.allSettled([
      needOM ? getJSON(`${OM}?latitude=${lat}&longitude=${lon}&current=${CUR_VARS}&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto`) : Promise.resolve(null),
      D._station ? nws(`${NWS}/stations/${D._station.id}/observations/latest`) : Promise.resolve(null),
      D.alertsSupported ? nws(`${NWS}/alerts/active?point=${lat.toFixed(4)},${lon.toFixed(4)}`) : Promise.resolve(null)
    ]);
    let changed = false;
    if (om.status === 'fulfilled' && om.value?.current) { D._om = { ...D._om, current: om.value.current, units: om.value.current_units || {}, at: now }; changed = true; }
    if (obs.status === 'fulfilled' && obs.value?.properties) {
      const o = obs.value.properties;
      if ((now - new Date(o.timestamp)) / 36e5 < 2.5 && o.temperature?.value != null) { D._station.obs = o; changed = true; }
    }
    if (changed && D._om) {
      const st = D._station?.obs && (now - new Date(D._station.obs.timestamp)) / 36e5 < 2.5 ? D._station : null;
      const trend = D.current.trend;
      D.current = makeCurrent(D._om.current, D._om.units, D._om.p3, st);
      if (st) D.current.trend = trend;
    }
    if (al.status === 'fulfilled' && al.value?.features) { D.alerts = mapAlerts(al.value.features.map(f => f.properties)); changed = true; }
    if (changed) D.updated = now;
    return changed;
  }

  function demo() {
    const loc = { name: 'Chicago', admin: 'IL', country: 'United States', cc: 'US', lat: 41.88, lon: -87.63 };
    const now = new Date(); const pad = n => String(n).padStart(2, '0');
    const ymd = dt => `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
    const codes = [71, 73, 3, 2, 0, 61, 95, 2, 1];
    const days = codes.map((code, i) => {
      const dt = new Date(now.getTime() + i * 864e5);
      return { date: ymd(dt), code, hi: [34, 29, 31, 38, 45, 52, 61, 48, 44][i], lo: [24, 18, 20, 27, 33, 41, 46, 35, 31][i], pop: [70, 80, 20, 10, 0, 60, 70, 20, 10][i],
        sunrise: ymd(dt) + 'T06:' + pad(48 + (i % 5)), sunset: ymd(dt) + 'T16:' + pad(22 - (i % 5)), uv: 2, windMax: 18, gustMax: 30, windDir: 300, precip: .2, snow: i < 2 ? 2.1 : 0,
        nightLo: [22, 17, 19, 26, 31, 40, 44, 34, 30][i], nightCode: [73, 71, 2, 1, 3, 63, 80, 1, 0][i], nightPop: [80, 40, 10, 0, 20, 70, 50, 10, 0][i], nightWind: 12, nightDir: 315 };
    });
    const near = nearestCities(loc.lat, loc.lon, 8, 400).map((c, i) => ({ ...c, temp: 30 - (i % 5) * 2 + (i % 3), code: [71, 73, 3, 2, 71, 0, 3, 45][i % 8], wind: 8 + i, dir: (i * 40) % 360, isDay: true }));
    const travel = TRAVEL_US.map(n => CITIES.find(c => c.name === n)).filter(Boolean).map((c, i) => ({ ...c, days: [0, 1, 2].map(k => ({ date: days[k].date, code: [0, 2, 3, 61, 71, 95, 1, 45][(i + k) % 8], hi: Math.round(40 + 45 * Math.cos((c.lat - 25) / 30) - k), lo: Math.round(25 + 40 * Math.cos((c.lat - 25) / 30) - k) })) }));
    const area = nearestCities(loc.lat, loc.lon, 12, 250).map((c, i) => ({ ...c, days: [0, 1, 2].map(k => ({ date: days[k].date, code: [71, 73, 3, 2, 0, 71, 45, 3][(i + k) % 8], hi: 33 - (i % 4) + k, lo: 22 - (i % 3) + k })) }));
    return {
      loc: { ...loc, tz: Intl.DateTimeFormat().resolvedOptions().timeZone, isUS: true },
      current: { temp: 31, feels: 22, humidity: 84, dew: 27, pressure: 1004.6, trend: 'F', windDir: 320, wind: 16, gust: 29, vis: 2.5, ceiling: 1800, cloud: 100, code: 73, isDay: now.getHours() > 6 && now.getHours() < 17, text: 'Light Snow', icon: 'snow', source: 'Demo' },
      days, near, travel, area,
      localText: [
        { name: 'TONIGHT', text: 'Snow. Areas of blowing snow after midnight. Low around 22. Northwest wind 15 to 20 mph, with gusts as high as 35 mph. Chance of precipitation is 80%. New snow accumulation of 3 to 5 inches possible.' },
        { name: 'SATURDAY', text: 'Snow likely before noon, then a chance of flurries. Mostly cloudy and blustery, with a high near 29. Wind chill values as low as 8. Northwest wind around 20 mph. Chance of precipitation is 70%.' },
        { name: 'SATURDAY NIGHT', text: 'Partly cloudy, with a low around 18. West wind 10 to 15 mph.' },
        { name: 'SUNDAY', text: 'Mostly sunny and cold, with a high near 31. Southwest wind around 10 mph.' }
      ],
      alerts: [{ event: 'Winter Storm Warning', headline: 'Winter Storm Warning issued for Cook County until 6:00 AM Saturday', severity: 'Severe', area: 'Cook; DuPage; Lake IL', expires: new Date(now.getTime() + 9 * 36e5).toISOString(),
        desc: 'Heavy snow expected. Total snow accumulations of 5 to 8 inches. Winds gusting as high as 35 mph will cause areas of blowing and drifting snow.', instruction: 'If you must travel, keep an extra flashlight, food, and water in your vehicle in case of an emergency.' }],
      alertsSupported: true, fetched: Date.now(), updated: Date.now(), demo: true
    };
  }

  return { geocode, reverse, load, quick, demo };
})();
