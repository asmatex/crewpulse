/* CrewPulse UI. Code written with SI assistance (Claude, Anthropic) and reviewed by the team. */
(function () {
  "use strict";
  const KB = window.CP_KB, I4 = window.I4;
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const COL = ["#12a37f", "#f0a020", "#e0453a"], LBL = ["Fine", "Watch", "Act now"];
  const P = new URLSearchParams(location.search);
  const st = { env: P.get("env") || "moon", day: +(P.get("day") || 30), region: P.get("region") || "heart", trend: P.get("ind") || "hr",
    crew: P.get("crew") || "C003", an: P.get("an") || "WHITE BLOOD CELL COUNT", edits: {} };
  let LOG = [];

  const env = () => KB.ENVS.find(e => e.id === st.env);
  function rebuild() { LOG = window.CP_SIM(env()); }

  // personal baseline from mission days 1-7
  function baseline(k) {
    const v = LOG.slice(0, 7).map(d => d[k]); const m = v.reduce((a, c) => a + c, 0) / v.length;
    const sd = Math.sqrt(v.reduce((a, c) => a + (c - m) ** 2, 0) / (v.length - 1));
    return { m, sd: Math.max(sd, 0.05 * Math.abs(m) || 0.5) };
  }
  const PERSONAL = ["hr", "sys", "dia", "glu", "sleep", "spo2", "temp"];
  function today() { return { ...LOG[st.day - 1], ...(st.edits[st.day] || {}) }; }
  function evalInd(k, v) {
    const I = KB.IND[k]; const pop = I.rule(v); let z = null, pers = 0;
    if (PERSONAL.includes(k) && st.day > 7) { const b = baseline(k); z = (v - b.m) / b.sd; if (Math.abs(z) > 2) pers = 1; }
    return { pop, z, pers, s: Math.max(pop, pers) };
  }
  function regionStatus(r) { const t = today(); return Math.max(...KB.REGIONS[r].inds.map(k => evalInd(k, t[k]).s)); }

  // ---------- mission bar ----------
  function renderBar() {
    $("#envs").innerHTML = KB.ENVS.map(e => `<button data-id="${e.id}" class="${e.id === st.env ? "on" : ""}">${esc(e.name)}</button>`).join("");
    $("#day").value = st.day; $("#dayLbl").textContent = `${st.day} of 30`;
    const e = env();
    $("#delay").innerHTML = `<b>Signal delay to Earth:</b> ${esc(e.delay)}<span class="muted"> | ${esc(e.gravity)}${e.dose ? ` | ${e.dose} mSv/day` : ""}</span>`;
  }
  $("#envs").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; st.env = b.dataset.id; st.edits = {}; rebuild(); all(); });
  $("#day").addEventListener("input", e => { st.day = +e.target.value; all(); });

  // ---------- check-in ----------
  const FORM = ["hr", "sys", "dia", "temp", "spo2", "glu", "sleep", "mood", "exer", "vision", "dose"];
  function renderForm() {
    const t = today();
    $("#form").innerHTML = FORM.map(k => { const I = KB.IND[k]; const ev = evalInd(k, t[k]);
      return `<label class="f"><span>${esc(I.name)}<small>${esc(I.unit)}</small></span>
        <input type="number" data-k="${k}" value="${t[k]}" min="${I.min}" max="${I.max}" step="${I.step}">
        <i class="dot" style="background:${COL[ev.s]}" title="${LBL[ev.s]}"></i></label>`; }).join("");
  }
  $("#form").addEventListener("change", e => { const k = e.target.dataset.k; if (!k) return;
    st.edits[st.day] = { ...(st.edits[st.day] || {}), [k]: +e.target.value }; renderToday(); });

  function renderTasks() {
    const t = today();
    const tasks = [["Morning vitals (HR, BP, temperature, SpO2)", true], ["Fasting glucose", true], ["Exercise 90 minutes or more", t.exer >= 90],
      ["Sleep log", true], ["Mood and vision check", true], ["Read personal dosimeter", true]];
    $("#tasks").innerHTML = tasks.map(([l, ok]) => `<li class="${ok ? "ok" : ""}">${ok ? "&#10003;" : "&#9675;"} ${esc(l)}</li>`).join("");
    let streak = 0; for (let d = st.day; d >= 1; d--) { if (LOG[d - 1].exer >= 90) streak++; else break; }
    const pts = LOG.slice(0, st.day).reduce((a, d) => a + 50 + (d.exer >= 90 ? 30 : 0) + (d.sleep >= 7 ? 20 : 0), 0);
    $("#streak").innerHTML = `<div><b>${streak}</b><span>day countermeasure streak</span></div><div><b>${pts.toLocaleString()}</b><span>mission health points</span></div>`;
  }

  // ---------- body map ----------
  const SPOTS = { brain: [200, 44], eyes: [200, 84], lungs: [168, 170], heart: [222, 178], immune: [252, 232], metabolism: [196, 252], bones: [166, 396], dna: [334, 150] };
  function renderBody() {
    const outline = `<g fill="#e7eef5" stroke="#b9c8d8" stroke-width="2">
      <circle cx="200" cy="68" r="44"/><rect x="186" y="108" width="28" height="22" rx="6"/>
      <path d="M140 132 Q200 118 260 132 L272 300 Q200 318 128 300 Z"/>
      <path d="M140 136 L104 250 L92 345 L112 349 L128 262 L152 190 Z"/><path d="M260 136 L296 250 L308 345 L288 349 L272 262 L248 190 Z"/>
      <path d="M134 298 L150 520 L186 520 L196 320 Z"/><path d="M266 298 L250 520 L214 520 L204 320 Z"/></g>
      <g transform="translate(334 112)"><rect x="-30" y="-18" width="60" height="30" rx="8" fill="#fff" stroke="#b9c8d8" stroke-width="2"/><text y="3" text-anchor="middle" font-size="13" font-weight="700" fill="#51657d">dosimeter</text></g>`;
    const spots = Object.entries(SPOTS).map(([r, [x, y]]) => { const s = regionStatus(r); const on = r === st.region;
      return `<g class="spot ${on ? "on" : ""}" data-r="${r}" tabindex="0" role="button" aria-label="${esc(KB.REGIONS[r].name)}">
        <circle cx="${x}" cy="${y}" r="${on ? 26 : 22}" fill="${COL[s]}" fill-opacity=".18" class="${s ? "pulse" : ""}"/>
        <circle cx="${x}" cy="${y}" r="${on ? 13 : 11}" fill="${COL[s]}" stroke="#fff" stroke-width="3"/></g>`; }).join("");
    const labels = Object.entries(SPOTS).map(([r, [x, y]]) => { const left = x < 200 && r !== "dna"; const name = r === "dna" ? "Radiation dose" : KB.REGIONS[r].name.split(" (")[0].split(":")[0];
      return `<text x="${left ? x - 32 : x + 32}" y="${y + 5}" font-size="13" text-anchor="${left ? "end" : "start"}" fill="#51657d" font-weight="600">${esc(name)}</text>`; }).join("");
    $("#body").innerHTML = outline + spots + labels;
    const counts = [0, 0, 0]; Object.keys(SPOTS).forEach(r => counts[regionStatus(r)]++);
    $("#headline").innerHTML = `<div class="hl ${counts[2] ? "red" : counts[1] ? "amber" : "green"}">${counts[2] ? `${counts[2]} area${counts[2] > 1 ? "s need" : " needs"} action now` : counts[1] ? `${counts[1]} area${counts[1] > 1 ? "s" : ""} to watch` : "All clear today"}</div>
      <div class="muted small">Day ${st.day}, ${esc(env().name)}. ${esc(env().note)}</div>`;
  }
  $("#body").addEventListener("click", e => { const g = e.target.closest(".spot"); if (!g) return; st.region = g.dataset.r; renderToday(); });
  $("#body").addEventListener("keydown", e => { if (e.key === "Enter") { const g = e.target.closest(".spot"); if (g) { st.region = g.dataset.r; renderToday(); } } });

  // ---------- detail ----------
  function spark(k) {
    const v = LOG.slice(0, st.day).map(d => d[k]); if (v.length < 2) return "";
    const lo = Math.min(...v), hi = Math.max(...v), W = 180, H = 36;
    const pts = v.map((x, i) => `${(i / (v.length - 1) * W).toFixed(1)},${(H - (hi === lo ? H / 2 : (x - lo) / (hi - lo) * H)).toFixed(1)}`).join(" ");
    return `<svg viewBox="0 0 ${W} ${H + 4}" class="spark"><polyline points="${pts}" fill="none" stroke="#2a7de1" stroke-width="2"/></svg>`;
  }
  function renderDetail() {
    const R = KB.REGIONS[st.region], t = today(); const e = env();
    const rows = R.inds.map(k => { const I = KB.IND[k]; const ev = evalInd(k, t[k]); const b = PERSONAL.includes(k) && st.day > 7 ? baseline(k) : null;
      const why = ev.pop ? `Outside the healthy range (${LBL[ev.pop].toLowerCase()}).` : ev.pers ? `Inside the population range, but ${ev.z > 0 ? "above" : "below"} your own normal by ${Math.abs(ev.z).toFixed(1)} spreads (your days 1 to 7: ${b.m.toFixed(I.step < 1 ? 1 : 0)} ${I.unit}).` : b ? `Within your personal range (${b.m.toFixed(I.step < 1 ? 1 : 0)} ${I.unit} baseline).` : "Within the healthy range.";
      const acts = ev.s === 0 ? [I.act[0]] : ev.s === 1 ? I.act.slice(0, -1) : I.act;
      return `<div class="ind"><div class="indHead"><span class="chip" style="background:${COL[ev.s]}">${LBL[ev.s]}</span><b>${esc(I.name)}</b><span class="val">${t[k]} <small>${esc(I.unit)}</small></span></div>
        <p class="small">${esc(why)}</p>${spark(k)}
        <p class="small"><b>Why it matters in space:</b> ${esc(I.why)}</p>
        <ul class="acts">${acts.map(a => `<li>${esc(a)}</li>`).join("")}</ul>
        <p class="src">Source: <a href="${esc(KB.SOURCES[I.src].u)}" target="_blank" rel="noopener">${esc(KB.SOURCES[I.src].t)}</a></p></div>`; }).join("");
    const worst = regionStatus(st.region);
    const delayAdvice = worst === 2 ? (e.delaySec > 60 ? `Ground replies take ${e.delay}. Start the on-board protocol now; send this report after.` : `Call the flight surgeon now (delay ${e.delay}).`)
      : worst === 1 ? "Log it and include it in the next medical report." : "No action needed.";
    $("#detail").innerHTML = `<h2>${esc(R.name)}</h2><p class="muted small">NASA hazard: ${esc(R.hazard)}</p>
      <div class="advice s${worst}">${esc(delayAdvice)}</div>${rows}
      ${R.labs ? `<p class="small linkish" data-labs="${esc(R.labs[0])}">See real crew lab data for ${esc(R.labs.join(", ").toLowerCase())} &rarr;</p>` : ""}`;
  }
  $("#detail").addEventListener("click", e => { const l = e.target.closest("[data-labs]"); if (l) { st.an = l.dataset.labs; show("i4"); } });

  // ---------- generic chart ----------
  function chart(svg, xs, ys, opt) {
    const W = opt.W || 1100, H = opt.H || 400, L = 70, R = 20, T = 36, B = 50;
    const all = ys.concat(opt.bands.flatMap(b => [b.lo, b.hi])).filter(v => v != null && isFinite(v));
    let lo = Math.min(...all), hi = Math.max(...all); const pad = (hi - lo) * 0.12 || 1; lo -= pad; hi += pad;
    const X = i => L + (xs.length === 1 ? 0.5 : i / (xs.length - 1)) * (W - L - R), Y = v => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
    let s = "";
    opt.bands.forEach(b => { if (b.lo == null || b.hi == null) return; s += `<rect x="${L}" width="${W - L - R}" y="${Y(b.hi)}" height="${Math.max(2, Y(b.lo) - Y(b.hi))}" fill="${b.c}" fill-opacity="${b.o || .16}"/>`; });
    for (let k = 0; k <= 4; k++) { const v = lo + (hi - lo) * k / 4; s += `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="#e3e9f0"/><text x="${L - 8}" y="${Y(v) + 4}" font-size="13" text-anchor="end" fill="#6b7f96">${(+v.toFixed(v > 50 ? 0 : 1))}</text>`; }
    xs.forEach((x, i) => { if (xs.length < 12 || i % 3 === 0 || i === xs.length - 1) s += `<text x="${X(i)}" y="${H - B + 22}" font-size="13" text-anchor="middle" fill="#6b7f96">${esc(x)}</text>`; });
    if (opt.vline != null) s += `<line x1="${X(opt.vline)}" x2="${X(opt.vline)}" y1="${T}" y2="${H - B}" stroke="#7a8da3" stroke-dasharray="5 5"/><text x="${X(opt.vline) + 6}" y="${T + 14}" font-size="13" fill="#51657d">${esc(opt.vlabel || "")}</text>`;
    s += `<polyline points="${ys.map((v, i) => `${X(i)},${Y(v)}`).join(" ")}" fill="none" stroke="#1f6fd1" stroke-width="3"/>`;
    ys.forEach((v, i) => { s += `<circle cx="${X(i)}" cy="${Y(v)}" r="6" fill="${COL[opt.status ? opt.status(i, v) : 0]}" stroke="#fff" stroke-width="2"/>`; });
    s += `<text x="${L}" y="${H - 8}" font-size="13" fill="#6b7f96">${esc(opt.xlabel || "")}</text><text x="${L}" y="${T - 14}" font-size="13" fill="#6b7f96" font-weight="600">${esc(opt.unit || "")}</text>`;
    svg.innerHTML = s;
  }

  // ---------- trends ----------
  const POP = { hr: [60, 100], sys: [95, 129], dia: [60, 79], temp: [36.1, 37.9], spo2: [95, 100], glu: [70, 99], sleep: [7, 9], mood: [3, 5], exer: [90, 150], vision: [0, 0], dose: [0, 400] };
  function renderTrends() {
    $("#trendInd").innerHTML = Object.entries(KB.IND).map(([k, I]) => `<option value="${k}" ${k === st.trend ? "selected" : ""}>${esc(I.name)}</option>`).join("");
    const k = st.trend, I = KB.IND[k], v = LOG.map(d => d[k]);
    const bands = [{ lo: POP[k][0], hi: POP[k][1], c: "#12a37f" }];
    if (PERSONAL.includes(k)) { const b = baseline(k); bands.push({ lo: b.m - 2 * b.sd, hi: b.m + 2 * b.sd, c: "#1f6fd1", o: .14 }); }
    chart($("#trend"), LOG.map(d => "Day " + d.day), v, { bands, unit: I.unit, xlabel: "Simulated mission log", vline: st.day - 1, vlabel: "today",
      status: (i, x) => { const pop = I.rule(x); if (!PERSONAL.includes(k) || i < 7) return pop; const b = baseline(k); return Math.max(pop, Math.abs((x - b.m) / b.sd) > 2 ? 1 : 0); } });
  }
  $("#trendInd").addEventListener("change", e => { st.trend = e.target.value; renderTrends(); syncURL(); });

  // ---------- Inspiration4 ----------
  function renderI4() {
    const S = I4.meta.summary;
    $("#i4finding").innerHTML = `<div class="big">${Math.round(S.share_inside * 100)}%</div><div><h2>of personal shifts would be missed by a "normal range" check</h2>
      <p>On the day after landing, the four Inspiration4 crew members showed <b>${S.personal_shifts_R1}</b> lab values that moved more than 2 spreads away from their own pre-flight baseline. <b>${S.inside_population_range}</b> of them were still inside the lab's normal range, so a population-range check calls them normal. CrewPulse compares each astronaut with their own baseline, so it flags them.</p>
      <p class="muted small">Rule: ${esc(S.rule)}. ${esc(S.caveat)} Data: <a href="${KB.SOURCES.osdr569.u}" target="_blank" rel="noopener">OSD-569</a>, <a href="${KB.SOURCES.osdr575.u}" target="_blank" rel="noopener">OSD-575</a>.</p></div>`;
    const crews = [...new Set(I4.series.map(r => r.crew))].sort();
    const ans = [...new Set(I4.series.filter(r => r.crew === st.crew).map(r => r.analyte))].sort();
    if (!ans.includes(st.an)) st.an = ans[0];
    $("#i4crew").innerHTML = crews.map(c => `<option ${c === st.crew ? "selected" : ""}>${c}</option>`).join("");
    $("#i4an").innerHTML = ans.map(a => `<option ${a === st.an ? "selected" : ""}>${esc(a)}</option>`).join("");
    const r = I4.series.find(x => x.crew === st.crew && x.analyte === st.an);
    const ts = I4.meta.timepoints.filter(t => t in r.values);
    const bands = [{ lo: r.lo, hi: r.hi, c: "#8a9bb0", o: .18 }];
    if (r.baseline != null) bands.push({ lo: r.baseline - 2 * r.spread, hi: r.baseline + 2 * r.spread, c: "#1f6fd1", o: .16 });
    chart($("#i4chart"), ts, ts.map(t => r.values[t]), { H: 380, bands, unit: r.unit, xlabel: `${r.crew} | ${r.analyte}`, vline: ts.indexOf("R+1") - 0.5, vlabel: "flight",
      status: (i, v) => { const out = r.lo != null && (v < r.lo || v > r.hi); const z = r.z && r.z[ts[i]]; return out ? 2 : (z != null && Math.abs(z) > 2) ? 1 : 0; } });
    $("#i4table").innerHTML = `<table><tr><th>Crew</th><th>Analyte</th><th>Own baseline</th><th>Day after landing</th><th>Shift (spreads)</th><th>Lab normal range</th><th>Range check says</th></tr>${I4.shifts.map(s =>
      `<tr data-c="${s.crew}" data-a="${esc(s.analyte)}"><td>${s.crew}</td><td>${esc(s.analyte.toLowerCase())}</td><td>${s.baseline}</td><td>${s.r1} ${esc(s.unit)}</td><td>${s.z > 0 ? "+" : ""}${s.z}</td><td>${s.lo ?? "?"} to ${s.hi ?? "?"}</td><td class="${s.in_range ? "miss" : "hit"}">${s.in_range ? "Normal (missed)" : "Out of range"}</td></tr>`).join("")}</table>`;
  }
  $("#i4crew").addEventListener("change", e => { st.crew = e.target.value; renderI4(); syncURL(); });
  $("#i4an").addEventListener("change", e => { st.an = e.target.value; renderI4(); syncURL(); });
  $("#i4table").addEventListener("click", e => { const tr = e.target.closest("tr[data-c]"); if (!tr) return; st.crew = tr.dataset.c; st.an = tr.dataset.a; renderI4(); window.scrollTo({ top: 0, behavior: "smooth" }); });

  // ---------- guide ----------
  function renderGuide() {
    $("#guide").innerHTML = `<h2>How CrewPulse decides</h2>
    <p>Every reading gets two checks. <b>Population check:</b> is it inside a standard healthy range (sources below)? <b>Personal check:</b> after day 7, is it more than 2 spreads away from this astronaut's own days 1 to 7 average? (spread = standard deviation, with a floor of 5% of the average.) The worse of the two sets the colour. Guidance then adapts to the signal delay: on the Moon you can call the ground; in Mars transit a reply takes up to 44 minutes round trip, so the tool tells you to start the on-board protocol first.</p>
    <h2>Measurements an astronaut can take on board</h2>
    <table><tr><th>Indicator</th><th>How</th><th>Amber</th><th>Red</th><th>Source</th></tr>
    ${Object.entries(KB.IND).map(([k, I]) => `<tr><td>${esc(I.name)}</td><td>${esc(HOW[k])}</td><td>${esc(I.act[0])}</td><td>${esc(I.act[I.act.length - 1])}</td><td><a href="${esc(KB.SOURCES[I.src].u)}" target="_blank" rel="noopener">${esc(KB.SOURCES[I.src].t)}</a></td></tr>`).join("")}</table>
    <h2>Environments</h2><table><tr><th>Environment</th><th>Signal delay</th><th>Gravity</th><th>Radiation used</th></tr>${KB.ENVS.map(e => `<tr><td>${esc(e.name)}</td><td>${esc(e.delay)}</td><td>${esc(e.gravity)}</td><td>${e.dose ? `${e.dose} mSv/day (<a href="${KB.SOURCES[e.doseSrc].u}" target="_blank" rel="noopener">${esc(KB.SOURCES[e.doseSrc].t)}</a>)` : "Demo assumption 0.4 mSv/day; use the personal dosimeter reading"}</td></tr>`).join("")}</table>
    <h2>All sources</h2><ul>${Object.values(KB.SOURCES).map(s => `<li><a href="${esc(s.u)}" target="_blank" rel="noopener">${esc(s.t)}</a></li>`).join("")}</ul>
    <h2>Limits</h2><p>Educational prototype, not a medical device. Thresholds are general adult reference values and need flight-surgeon tailoring for each astronaut. The 30-day vital-sign log is simulated; the laboratory data is real (NASA OSDR, Inspiration4).</p>`;
  }
  const HOW = { hr: "Wrist or finger sensor at rest, seated", sys: "Cuff on upper arm at heart level", dia: "Same cuff reading", temp: "Ear or oral thermometer", spo2: "Finger pulse oximeter, warm hands", glu: "Finger-stick meter before breakfast", sleep: "Actigraphy watch or sleep log", mood: "One-tap self-rating", exer: "Logged by ARED, treadmill and cycle", vision: "Near-vision card and symptom question", dose: "Personal dosimeter" };

  // ---------- tabs ----------
  $("#tabs").addEventListener("click", e => { const b = e.target.closest("button"); if (b) show(b.dataset.view); });
  function show(v) {
    document.querySelectorAll("#tabs button").forEach(b => b.classList.toggle("on", b.dataset.view === v));
    document.querySelectorAll(".view").forEach(s => s.classList.toggle("on", s.id === "view-" + v));
    if (v === "trends") renderTrends(); if (v === "i4") renderI4(); if (v === "guide") renderGuide();
    st.view = v; syncURL();
  }
  function syncURL() { const p = new URLSearchParams({ env: st.env, day: st.day, region: st.region }); if (st.view && st.view !== "today") p.set("view", st.view); if (st.view === "trends") p.set("ind", st.trend); if (st.view === "i4") { p.set("crew", st.crew); p.set("an", st.an); } history.replaceState(null, "", "?" + p); }
  function renderToday() { renderForm(); renderTasks(); renderBody(); renderDetail(); syncURL(); }
  function all() { renderBar(); renderToday(); if (st.view === "trends") renderTrends(); }

  if (P.get("set")) { st.edits[st.day] = Object.fromEntries(P.get("set").split(",").map(x => x.split(":")).map(([k, v]) => [k, +v])); }
  rebuild(); all(); show(P.get("view") || "today");
})();
