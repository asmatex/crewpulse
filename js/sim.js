/* Simulated 30-day mission log for the demo astronaut (clearly labelled as simulated in the UI).
 * Deterministic: a seeded generator so every visitor sees the same story.
 * Story: stable first two weeks, then sleep debt, falling mood, creeping resting heart rate
 * (still inside the population range, outside the personal one), skipped exercise and a mild
 * vision complaint late in the mission. Radiation accumulates at the environment's daily rate.
 * Code written with SI assistance (Claude, Anthropic) and reviewed by the team. */
window.CP_SIM = function (env) {
  let s = 20261114;
  const rnd = () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
  const n = (m, sd) => { const u = rnd() || 1e-9, v = rnd(); return m + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const days = [];
  let dose = 0;
  const rate = env.dose || 0.4; // LEO: no fixed published rate used; demo assumes 0.4 mSv/day (labelled assumption)
  for (let d = 1; d <= 30; d++) {
    const late = Math.max(0, (d - 14) / 16); // 0 until day 14, then ramps to 1
    dose += rate + (d === 19 ? 6 : 0);      // simulated solar particle event on day 19
    days.push({
      day: d,
      hr: Math.round(n(61 + 13 * late, 1.6)),
      sys: Math.round(n(117 + 4 * late, 3)),
      dia: Math.round(n(75 + 2 * late, 2)),
      temp: +n(36.7, 0.15).toFixed(1),
      spo2: Math.round(Math.min(100, n(98, 0.6))),
      glu: Math.round(n(88 + 6 * late, 4)),
      sleep: +Math.max(3, n(7.3 - 2.1 * late, 0.35)).toFixed(1),
      mood: Math.max(1, Math.min(5, Math.round(n(4.2 - 2.1 * late, 0.35)))),
      exer: Math.max(0, Math.round(n(125 - 60 * late, 8) / 5) * 5),
      vision: d >= 24 ? 1 : 0,
      dose: +dose.toFixed(1),
    });
  }
  return days;
};
