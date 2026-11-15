#!/usr/bin/env python3
"""Download Inspiration4 crew blood panels from NASA OSDR and compute the personal-baseline analysis.

Sources (public, no login):
  OSD-569  LSDS-7_Complete_Blood_Count_CBC.upload_SUBMITTED.csv
  OSD-575  LSDS-8_Comprehensive_Metabolic_Panel_CMP.upload_SUBMITTED.csv
Writes data/i4_labs.json and js/data.js.

Personal-baseline rule (same rule the app uses):
  baseline = mean of the three pre-flight draws (L-92, L-44, L-3)
  spread   = max(sample SD of those draws, 5% of the baseline mean)   <- floor is a stated assumption
  z        = (value - baseline) / spread ; |z| > 2 is a personal shift
Code written with SI assistance (Claude, Anthropic) and reviewed by the team.
"""
import csv, io, json, statistics as st, urllib.request, pathlib, collections, datetime

ROOT = pathlib.Path(__file__).resolve().parents[1]
BASE = "https://osdr.nasa.gov/geode-py/ws/studies/{osd}/download?source=datamanager&file={f}"
SRC = [("OSD-569", "LSDS-7_Complete_Blood_Count_CBC.upload_SUBMITTED.csv", "TEST_DATE", "CBC"),
       ("OSD-575", "LSDS-8_Comprehensive_Metabolic_Panel_CMP.upload_SUBMITTED.csv", "timepoint", "CMP")]
PRE = ["L-92", "L-44", "L-3"]
ORDER = ["L-92", "L-44", "L-3", "R+1", "R+45", "R+82", "R+194"]


def fetch(osd, f):
    url = BASE.format(osd=osd, f=f)
    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "CrewPulse-SpaceApps2026"}), timeout=60) as r:
        return r.read().decode("utf-8-sig"), url


def main():
    rows, sources = [], []
    for osd, f, tcol, panel in SRC:
        text, url = fetch(osd, f)
        (ROOT / "data" / "raw").mkdir(parents=True, exist_ok=True)
        (ROOT / "data" / "raw" / f).write_text(text)
        sources.append({"osd": osd, "file": f, "url": url})
        for r in csv.DictReader(io.StringIO(text)):
            try:
                v = float(r["VALUE"])
            except (ValueError, TypeError):
                continue
            def num(x):
                try: return float(x)
                except (ValueError, TypeError): return None
            rows.append({"crew": r["SUBJECT_ID"], "sex": r["SEX"], "panel": panel, "analyte": r["ANALYTE"].strip(),
                         "t": r[tcol].strip(), "v": v, "lo": num(r["RANGE_MIN"]), "hi": num(r["RANGE_MAX"]), "unit": r["UNITS"]})

    # collapse duplicates (one crew/time has two CBC draws): keep the mean
    g = collections.defaultdict(list)
    for r in rows:
        g[(r["crew"], r["analyte"], r["t"])].append(r)
    series = collections.defaultdict(dict)
    meta = {}
    for (c, a, t), rs in g.items():
        series[(c, a)][t] = round(st.mean(x["v"] for x in rs), 3)
        meta[(c, a)] = {k: rs[0][k] for k in ("lo", "hi", "unit", "panel", "sex")}

    out, shifts = [], []
    for (c, a), tv in sorted(series.items()):
        m = meta[(c, a)]
        rec = {"crew": c, "analyte": a, **m, "values": {t: tv[t] for t in ORDER if t in tv}}
        if all(p in tv for p in PRE):
            b = [tv[p] for p in PRE]
            mu = st.mean(b); sd = max(st.stdev(b), 0.05 * abs(mu) if mu else 0.01)
            rec["baseline"] = round(mu, 3); rec["spread"] = round(sd, 3)
            rec["z"] = {t: round((tv[t] - mu) / sd, 2) for t in ORDER if t in tv and t not in PRE}
            if "R+1" in tv:
                z = rec["z"]["R+1"]; inr = m["lo"] is not None and m["hi"] is not None and m["lo"] <= tv["R+1"] <= m["hi"]
                if abs(z) > 2:
                    shifts.append({"crew": c, "analyte": a, "baseline": rec["baseline"], "r1": tv["R+1"], "z": z,
                                   "in_range": inr, "lo": m["lo"], "hi": m["hi"], "unit": m["unit"]})
        out.append(rec)

    n_pairs = sum(1 for r in out if "z" in r and "R+1" in r["z"])
    inside = [s for s in shifts if s["in_range"]]
    summary = {"pairs_tested": n_pairs, "personal_shifts_R1": len(shifts), "inside_population_range": len(inside),
               "share_inside": round(len(inside) / len(shifts), 3) if shifts else None,
               "rule": "baseline = mean(L-92, L-44, L-3); spread = max(SD, 5% of mean); shift if |z| > 2 at R+1",
               "caveat": "4 crew, 3-day orbital flight, 3 baseline draws each; illustrative, not a clinical validation."}
    data = {"meta": {"generated_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
                     "sources": sources, "timepoints": ORDER, "summary": summary},
            "series": out, "shifts": sorted(shifts, key=lambda s: -abs(s["z"]))}
    (ROOT / "data" / "i4_labs.json").write_text(json.dumps(data, indent=1))
    (ROOT / "js" / "data.js").write_text("window.I4=" + json.dumps(data) + ";\n")
    print(json.dumps(summary, indent=1))


if __name__ == "__main__":
    main()
