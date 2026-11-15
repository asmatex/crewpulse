/* CrewPulse knowledge base: environments, indicators, thresholds, body regions and guidance.
 * Thresholds are standard clinical reference values or NASA figures, each with a source key (see SOURCES).
 * This is an educational prototype, not a medical device.
 * Code written with SI assistance (Claude, Anthropic) and reviewed by the team. */
window.CP_KB = (function () {
  const SOURCES = {
    hrp_hazards: { t: "NASA Human Research Program: 5 Hazards of Human Spaceflight", u: "https://www.nasa.gov/hrp/hazards/" },
    hrp_risks: { t: "NASA Human Research Program: Risks of Human Spaceflight", u: "https://www.nasa.gov/hrp/risks/" },
    hrp_research: { t: "NASA HRP: Ongoing research in space", u: "https://www.nasa.gov/hrp/ongoing-hrp-research/" },
    std3001: { t: "NASA OCHMO Radiation Protection Technical Brief (NASA-STD-3001 Vol. 1): 600 mSv career effective dose limit", u: "https://www.nasa.gov/wp-content/uploads/2023/03/radiation-protection-technical-brief-ochmo.pdf" },
    csa_rad: { t: "CSA: Monitoring radiation for astronaut health", u: "https://www.asc-csa.gc.ca/eng/news/articles/2026/2026-02-26-monitoring-radiation-astronaut-health.asp" },
    aha_bp: { t: "AHA/ACC 2017 blood pressure categories", u: "https://www.heart.org/en/health-topics/high-blood-pressure/understanding-blood-pressure-readings" },
    aha_hr: { t: "AHA: resting heart rate 60 to 100 bpm", u: "https://www.heart.org/en/health-topics/high-blood-pressure/the-facts-about-high-blood-pressure/all-about-heart-rate-pulse" },
    ada_glu: { t: "ADA: fasting glucose 70 to 99 mg/dL normal, under 70 hypoglycemia", u: "https://diabetes.org/about-diabetes/diagnosis" },
    aasm_sleep: { t: "AASM/SRS consensus: adults need 7 or more hours of sleep", u: "https://aasm.org/resources/pdf/pressroom/adult-sleep-duration-consensus.pdf" },
    iss_ex: { t: "NASA: ISS crews exercise about 2 hours a day; bone loss about 1% per month without countermeasures", u: "https://www.nasa.gov/missions/station/iss-research/" },
    zhang2020: { t: "Zhang et al. 2020, Science Advances: lunar surface dose equivalent 1369 microSv/day (Chang'e-4 LND)", u: "https://doi.org/10.1126/sciadv.aaz1334" },
    zeitlin2013: { t: "Zeitlin et al. 2013, Science: 1.84 mSv/day in Mars cruise (MSL RAD)", u: "https://doi.org/10.1126/science.1235989" },
    hassler2014: { t: "Hassler et al. 2014, Science: 0.64 mSv/day on the Mars surface (MSL RAD)", u: "https://doi.org/10.1126/science.1244797" },
    osdr569: { t: "NASA OSDR OSD-569: Inspiration4 whole blood, complete blood count", u: "https://osdr.nasa.gov/bio/repo/data/studies/OSD-569" },
    osdr575: { t: "NASA OSDR OSD-575: Inspiration4 serum, comprehensive metabolic panel", u: "https://osdr.nasa.gov/bio/repo/data/studies/OSD-575" },
  };

  const ENVS = [
    { id: "iss", name: "Space station (LEO)", delay: "under 1 second", delaySec: 1, dose: null, gravity: "microgravity", note: "Ground flight surgeon reachable in real time. Report amber findings at the next private medical conference." },
    { id: "moon", name: "Lunar base", delay: "about 1.3 seconds", delaySec: 1.3, dose: 1.369, doseSrc: "zhang2020", gravity: "1/6 g", note: "Near-real-time contact, but evacuation to Earth takes days. Treat red findings on board first." },
    { id: "transit", name: "Mars transit", delay: "3 to 22 minutes each way", delaySec: 600, dose: 1.84, doseSrc: "zeitlin2013", gravity: "microgravity", note: "No live conversation with the ground. Follow the on-board protocol first, then send the report." },
    { id: "mars", name: "Mars base", delay: "3 to 22 minutes each way", delaySec: 600, dose: 0.64, doseSrc: "hassler2014", gravity: "3/8 g", note: "Crew medical officer leads. Ground advice arrives as messages, not calls." },
  ];

  // status: 0 green, 1 amber, 2 red. fn(value, ctx) -> {s, msg}
  const IND = {
    hr: { name: "Resting heart rate", unit: "bpm", region: "heart", src: "aha_hr", min: 30, max: 160, step: 1,
      rule: v => v > 120 || v < 40 ? 2 : v > 100 || v < 45 ? 1 : 0,
      why: "Fluid shifts toward the head and deconditioning change heart rate and its response to standing up after flight.",
      act: ["Re-measure after 5 minutes seated and calm.", "Hydrate; check sleep and caffeine.", "If it stays above 120 or below 40, or you feel faint or have chest pain: red, follow cardiac protocol and contact the flight surgeon."] },
    sys: { name: "Blood pressure (systolic)", unit: "mmHg", region: "heart", src: "aha_bp", min: 70, max: 220, step: 1,
      rule: v => v >= 180 || v < 85 ? 2 : v >= 130 || v < 95 ? 1 : 0,
      why: "Spaceflight shifts about 2 litres of fluid toward the head and alters blood pressure regulation (orthostatic intolerance on return).",
      act: ["Measure twice, one minute apart, arm at heart level.", "Systolic 130 to 179 on two days: amber, log it and review salt, fluids and exercise.", "180 or above, or symptoms (headache, vision change): red, contact the flight surgeon now."] },
    dia: { name: "Blood pressure (diastolic)", unit: "mmHg", region: "heart", src: "aha_bp", min: 40, max: 140, step: 1,
      rule: v => v >= 120 || v < 50 ? 2 : v >= 80 ? 1 : 0,
      why: "Diastolic pressure tracks vascular tone, which changes with the head-ward fluid shift.",
      act: ["Diastolic 80 to 119: amber, re-check tomorrow.", "120 or above: red, hypertensive crisis protocol."] },
    temp: { name: "Body temperature", unit: "°C", region: "immune", src: "hrp_risks", min: 34, max: 41.5, step: 0.1,
      rule: v => v >= 39.5 || v < 35 ? 2 : v >= 38 || v < 36 ? 1 : 0,
      why: "Spaceflight alters immune function and can reactivate latent viruses; a closed cabin spreads infection.",
      act: ["38.0 °C or above: amber, rest, fluids, log symptoms, notify crewmates.", "39.5 °C or above, or below 35 °C: red, contact the flight surgeon and isolate if infectious."] },
    spo2: { name: "Blood oxygen (SpO2)", unit: "%", region: "lungs", src: "hrp_risks", min: 80, max: 100, step: 1,
      rule: v => v < 92 ? 2 : v < 95 ? 1 : 0,
      why: "A hostile closed environment means cabin air quality, CO2 build-up and fire products can all lower blood oxygen.",
      act: ["92 to 94%: amber, re-measure with warm hands; check cabin CO2 and O2 readings.", "Below 92%: red, move to clean air, use oxygen mask, alert crew."] },
    glu: { name: "Blood glucose (fasting)", unit: "mg/dL", region: "metabolism", src: "ada_glu", min: 40, max: 300, step: 1,
      rule: v => v < 54 || v > 250 ? 2 : v < 70 || v > 125 ? 1 : 0,
      why: "Spaceflight is linked to insulin resistance, and inadequate nutrition is an HRP risk.",
      act: ["Below 70: eat 15 g of fast carbohydrate, re-test in 15 minutes.", "126 to 250 fasting: amber, review diet and exercise, re-test tomorrow.", "Below 54 or above 250: red, contact the flight surgeon."] },
    sleep: { name: "Sleep last night", unit: "h", region: "brain", src: "aasm_sleep", min: 0, max: 12, step: 0.5,
      rule: v => v < 5 ? 2 : v < 6.5 ? 1 : 0,
      why: "Isolation, noise, light cycles every 90 minutes in orbit and workload cut sleep, which drives errors and mood problems.",
      act: ["Under 6.5 h: amber, protect the next sleep period, limit screens and caffeine late.", "Under 5 h for several nights: red, tell the commander and adjust the schedule."] },
    mood: { name: "Mood (self-rating 1 to 5)", unit: "/5", region: "brain", src: "hrp_hazards", min: 1, max: 5, step: 1,
      rule: v => v <= 1 ? 2 : v <= 2 ? 1 : 0,
      why: "Isolation and confinement are one of NASA's five hazards; behavioural health problems build slowly and are easy to hide.",
      act: ["2 of 5: amber, talk to a crewmate, schedule a private family or psychology conference.", "1 of 5, or thoughts of self-harm: red, tell the crew medical officer now."] },
    exer: { name: "Exercise today", unit: "min", region: "bones", src: "iss_ex", min: 0, max: 180, step: 5,
      rule: v => v < 30 ? 2 : v < 90 ? 1 : 0,
      why: "Without about 2 hours a day of resistance and aerobic exercise, astronauts lose about 1% of hip and spine bone density per month and lose muscle.",
      act: ["Under 90 minutes: amber, add a resistance session.", "Under 30 minutes for 3 days: red, review the countermeasure plan with the crew."] },
    vision: { name: "Vision change or headache", unit: "0 none, 1 mild, 2 marked", region: "eyes", src: "hrp_risks", min: 0, max: 2, step: 1,
      rule: v => v >= 2 ? 2 : v >= 1 ? 1 : 0,
      why: "Spaceflight Associated Neuro-ocular Syndrome (SANS): head-ward fluid shift can swell the optic disc and change vision.",
      act: ["Mild: amber, log it, do the near-vision card test and repeat tomorrow.", "Marked or worsening: red, ultrasound or eye exam per protocol and contact the flight surgeon."] },
    dose: { name: "Cumulative radiation dose", unit: "mSv", region: "dna", src: "std3001", min: 0, max: 700, step: 1,
      rule: v => v >= 600 ? 2 : v >= 400 ? 1 : 0,
      why: "Space radiation raises lifetime cancer risk and can harm the nervous system. NASA's career limit is 600 mSv.",
      act: ["Over 400 mSv (two thirds of the career limit): amber, plan shielded sleep and fewer EVAs.", "During a solar particle event go to the storm shelter regardless of total dose.", "600 mSv: red, the NASA career limit is reached."] },
  };

  const REGIONS = {
    brain: { name: "Brain and behaviour", hazard: "Isolation and confinement", inds: ["sleep", "mood"] },
    eyes: { name: "Eyes (SANS)", hazard: "Altered gravity fields", inds: ["vision"] },
    heart: { name: "Heart and circulation", hazard: "Altered gravity fields", inds: ["hr", "sys", "dia"] },
    lungs: { name: "Lungs and oxygen", hazard: "Hostile closed environment", inds: ["spo2"] },
    immune: { name: "Immune system", hazard: "Hostile closed environment, radiation", inds: ["temp"], labs: ["WHITE BLOOD CELL COUNT", "LYMPHOCYTES", "NEUTROPHILS"] },
    metabolism: { name: "Metabolism and kidneys", hazard: "Distance from Earth (nutrition), altered gravity", inds: ["glu"], labs: ["GLUCOSE", "CREATININE", "CALCIUM"] },
    bones: { name: "Bones and muscles", hazard: "Altered gravity fields", inds: ["exer"], labs: ["CALCIUM", "ALKALINE PHOSPHATASE"] },
    dna: { name: "Whole body: radiation", hazard: "Space radiation", inds: ["dose"] },
  };

  return { SOURCES, ENVS, IND, REGIONS };
})();
