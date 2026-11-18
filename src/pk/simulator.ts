import {
  EmpiricalWashoutFit,
  IntervalRow,
  MeasuredSample,
  ReintroductionScenario,
  TimeSeriesPoint,
} from '../types/pk';
import { addHoursIso, diffHoursIso, mgLi2Co3ToMmol } from './unitConversions';

export interface ModelKineticParams {
  liClLh: number | null;
  vdL: number | null;
  kePerHour: number | null;
  tHalfHours: number | null;
}

/**
 * Fits a monoexponential washout C(t) = C0 * exp(-k * t) via ordinary least squares
 * on ln(C) vs. time (hours) when >= 2 valid post-suspension samples are available.
 */
export function fitEmpiricalWashout(samples: MeasuredSample[]): EmpiricalWashoutFit {
  const valid = samples
    .filter(
      (s) =>
        s.concentrationMmolL !== null &&
        Number.isFinite(s.concentrationMmolL) &&
        s.concentrationMmolL > 0 &&
        !Number.isNaN(new Date(s.timestampIso).getTime())
    )
    .sort((a, b) => new Date(a.timestampIso).getTime() - new Date(b.timestampIso).getTime());

  if (valid.length < 2) {
    return {
      available: false,
      sampleCount: valid.length,
      kePerHour: null,
      tHalfHours: null,
      rSquared: null,
    };
  }

  const t0 = new Date(valid[0].timestampIso).getTime();
  const xs = valid.map((s) => (new Date(s.timestampIso).getTime() - t0) / 3600_000);
  const ys = valid.map((s) => Math.log(s.concentrationMmolL!));

  const n = xs.length;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;

  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    sxx += dx * dx;
    sxy += dx * dy;
    syy += dy * dy;
  }

  if (sxx <= 0) {
    return {
      available: false,
      sampleCount: valid.length,
      kePerHour: null,
      tHalfHours: null,
      rSquared: null,
      warning: 'Las muestras tienen exactamente la misma fecha y hora.',
    };
  }

  const slope = sxy / sxx;
  const kePerHour = -slope;

  if (kePerHour <= 0) {
    return {
      available: false,
      sampleCount: valid.length,
      kePerHour: null,
      tHalfHours: null,
      rSquared: null,
      warning:
        'Las concentraciones medidas no muestran descenso neto (posible absorción retardada, rebote posdiálisis o error temporal).',
    };
  }

  const rSquared = syy > 0 ? (sxy * sxy) / (sxx * syy) : 1;
  const tHalfHours = 0.693 / kePerHour;

  return {
    available: true,
    sampleCount: valid.length,
    kePerHour,
    tHalfHours,
    rSquared,
  };
}

/**
 * Evaluates 1-compartment concentration C(t) at targetIso given:
 * - Anchor sample (tLastIso, cLastMmolL)
 * - Optional reintroduction scenario (if restartTimeIso >= tLastIso or within window)
 * - Model ke (1/h) and Vd (L)
 */
export function evaluateConcentrationAtTime(
  targetIso: string,
  anchorIso: string,
  anchorConcMmolL: number,
  kePerHour: number,
  vdL: number,
  scenario?: ReintroductionScenario | null,
  suspensionIso?: string
): number | null {
  const dtFromAnchor = diffHoursIso(anchorIso, targetIso);
  if (!Number.isFinite(dtFromAnchor)) return null;

  // Do not extrapolate before suspension if suspensionIso is provided
  if (suspensionIso) {
    const dtFromSusp = diffHoursIso(suspensionIso, targetIso);
    if (Number.isFinite(dtFromSusp) && dtFromSusp < -0.001) {
      return null;
    }
  }

  // Washout component anchored at latest measured sample
  let conc = anchorConcMmolL * Math.exp(-kePerHour * dtFromAnchor);

  // Add superposition of reintroduction doses administered strictly <= targetIso
  if (
    scenario &&
    scenario.enabled &&
    scenario.dailyDoseMg !== null &&
    scenario.dailyDoseMg > 0 &&
    scenario.dosingIntervalHours > 0
  ) {
    const dtFromRestart = diffHoursIso(scenario.restartTimeIso, targetIso);
    if (Number.isFinite(dtFromRestart) && dtFromRestart >= 0) {
      const tau = scenario.dosingIntervalHours;
      const dosePerIntervalMg = scenario.dailyDoseMg * (tau / 24);
      const dosePerIntervalMmol = mgLi2Co3ToMmol(dosePerIntervalMg);
      const deltaC = (1.0 * dosePerIntervalMmol) / vdL;

      const maxDoses = Math.floor(dtFromRestart / tau);
      for (let i = 0; i <= maxDoses; i++) {
        const elapsedSinceDose = dtFromRestart - i * tau;
        conc += deltaC * Math.exp(-kePerHour * elapsedSinceDose);
      }
    }
  }

  return Math.max(0, conc);
}

/**
 * Generates high-resolution time-series points from suspension (or earliest sample)
 * up to horizonHours after the last measured sample, preserving exact pre-dose troughs
 * and post-dose peaks at reintroduction times.
 */
export function buildReintroductionTimeSeries(params: {
  suspensionIso: string;
  samples: MeasuredSample[];
  horizonHours: number;
  motoki: ModelKineticParams;
  abouAuda: ModelKineticParams;
  pepin: ModelKineticParams;
  empirical: EmpiricalWashoutFit;
  scenarioA: ReintroductionScenario;
  scenarioB: ReintroductionScenario;
}): {
  points: TimeSeriesPoint[];
  anchorIso: string | null;
  anchorConc: number | null;
  refIso: string;
  sortedSamples: MeasuredSample[];
} {
  const sortedSamples = params.samples
    .filter(
      (s) =>
        s.concentrationMmolL !== null &&
        Number.isFinite(s.concentrationMmolL) &&
        s.concentrationMmolL > 0 &&
        !Number.isNaN(new Date(s.timestampIso).getTime())
    )
    .sort((a, b) => new Date(a.timestampIso).getTime() - new Date(b.timestampIso).getTime());

  if (sortedSamples.length === 0) {
    return {
      points: [],
      anchorIso: null,
      anchorConc: null,
      refIso: params.suspensionIso,
      sortedSamples: [],
    };
  }

  const latest = sortedSamples[sortedSamples.length - 1];
  const anchorIso = latest.timestampIso;
  const anchorConc = latest.concentrationMmolL!;

  const suspTime = new Date(params.suspensionIso).getTime();
  const firstSampleTime = new Date(sortedSamples[0].timestampIso).getTime();
  const refIso =
    Number.isFinite(suspTime) && suspTime <= firstSampleTime
      ? params.suspensionIso
      : sortedSamples[0].timestampIso;

  const startOffset = 0;
  const anchorOffset = Math.max(0, diffHoursIso(refIso, anchorIso));
  const endOffset = anchorOffset + Math.max(24, params.horizonHours);

  // Collect critical timestamps (1h grid + exact sample times + pre/post reintro dose times)
  const offsetsSet = new Set<number>();
  const step = endOffset > 168 ? 2 : 1;
  for (let h = startOffset; h <= endOffset; h += step) {
    offsetsSet.add(Number(h.toFixed(4)));
  }
  offsetsSet.add(Number(endOffset.toFixed(4)));

  for (const s of sortedSamples) {
    const off = diffHoursIso(refIso, s.timestampIso);
    if (Number.isFinite(off) && off >= 0 && off <= endOffset) {
      offsetsSet.add(Number(off.toFixed(4)));
    }
  }

  const addScenarioDoseOffsets = (scen: ReintroductionScenario) => {
    if (!scen.enabled) return;
    const startOff = diffHoursIso(refIso, scen.restartTimeIso);
    if (!Number.isFinite(startOff) || startOff > endOffset) return;
    const tau = scen.dosingIntervalHours || 24;
    for (let doseOff = Math.max(0, startOff); doseOff <= endOffset; doseOff += tau) {
      if (doseOff - 0.01 >= 0) offsetsSet.add(Number((doseOff - 0.01).toFixed(4))); // pre-dose trough
      offsetsSet.add(Number(doseOff.toFixed(4))); // post-dose peak
    }
  };

  addScenarioDoseOffsets(params.scenarioA);
  addScenarioDoseOffsets(params.scenarioB);

  const sortedOffsets = Array.from(offsetsSet).sort((a, b) => a - b);

  // Empirical Vd fallback uses Pepin's Vd if available so empirical curve can also project reintroduction
  const empiricalVd = params.pepin.vdL;

  const points: TimeSeriesPoint[] = sortedOffsets.map((offset) => {
    const timestampIso = addHoursIso(refIso, offset);
    return {
      timeHoursFromRef: offset,
      timestampIso,
      motokiA:
        params.motoki.kePerHour && params.motoki.vdL
          ? evaluateConcentrationAtTime(
              timestampIso,
              anchorIso,
              anchorConc,
              params.motoki.kePerHour,
              params.motoki.vdL,
              params.scenarioA,
              refIso
            )
          : null,
      abouAudaA:
        params.abouAuda.kePerHour && params.abouAuda.vdL
          ? evaluateConcentrationAtTime(
              timestampIso,
              anchorIso,
              anchorConc,
              params.abouAuda.kePerHour,
              params.abouAuda.vdL,
              params.scenarioA,
              refIso
            )
          : null,
      pepinA:
        params.pepin.kePerHour && params.pepin.vdL
          ? evaluateConcentrationAtTime(
              timestampIso,
              anchorIso,
              anchorConc,
              params.pepin.kePerHour,
              params.pepin.vdL,
              params.scenarioA,
              refIso
            )
          : null,
      empiricalA:
        params.empirical.available && params.empirical.kePerHour && empiricalVd
          ? evaluateConcentrationAtTime(
              timestampIso,
              anchorIso,
              anchorConc,
              params.empirical.kePerHour,
              empiricalVd,
              params.scenarioA,
              refIso
            )
          : null,
      motokiB:
        params.scenarioB.enabled && params.motoki.kePerHour && params.motoki.vdL
          ? evaluateConcentrationAtTime(
              timestampIso,
              anchorIso,
              anchorConc,
              params.motoki.kePerHour,
              params.motoki.vdL,
              params.scenarioB,
              refIso
            )
          : null,
      abouAudaB:
        params.scenarioB.enabled && params.abouAuda.kePerHour && params.abouAuda.vdL
          ? evaluateConcentrationAtTime(
              timestampIso,
              anchorIso,
              anchorConc,
              params.abouAuda.kePerHour,
              params.abouAuda.vdL,
              params.scenarioB,
              refIso
            )
          : null,
      pepinB:
        params.scenarioB.enabled && params.pepin.kePerHour && params.pepin.vdL
          ? evaluateConcentrationAtTime(
              timestampIso,
              anchorIso,
              anchorConc,
              params.pepin.kePerHour,
              params.pepin.vdL,
              params.scenarioB,
              refIso
            )
          : null,
      empiricalB:
        params.scenarioB.enabled && params.empirical.available && params.empirical.kePerHour && empiricalVd
          ? evaluateConcentrationAtTime(
              timestampIso,
              anchorIso,
              anchorConc,
              params.empirical.kePerHour,
              empiricalVd,
              params.scenarioB,
              refIso
            )
          : null,
    };
  });

  return { points, anchorIso, anchorConc, refIso, sortedSamples };
}

export function buildIntervalTable(params: {
  anchorIso: string | null;
  anchorConc: number | null;
  horizonHours: number;
  sortedSamples: MeasuredSample[];
  motoki: ModelKineticParams;
  abouAuda: ModelKineticParams;
  pepin: ModelKineticParams;
  empirical: EmpiricalWashoutFit;
  scenarioA: ReintroductionScenario;
  scenarioB: ReintroductionScenario;
}): IntervalRow[] {
  if (!params.anchorIso || params.anchorConc === null) return [];

  const candidateHours = [0, 6, 12, 24, 36, 48, 60, 72, 96, 120, 144, 168].filter(
    (h) => h <= params.horizonHours
  );

  // Also include pre-reintroduction trough (-0.01h before Scenario A restart) if within horizon
  const restartAHours = params.scenarioA.enabled
    ? diffHoursIso(params.anchorIso, params.scenarioA.restartTimeIso)
    : NaN;

  const hoursList = [...candidateHours];
  if (Number.isFinite(restartAHours) && restartAHours > 0 && restartAHours <= params.horizonHours) {
    const preTrough = Number((restartAHours - 0.01).toFixed(2));
    if (!hoursList.some((h) => Math.abs(h - preTrough) < 0.05)) {
      hoursList.push(preTrough);
    }
  }
  hoursList.sort((a, b) => a - b);

  const empVd = params.pepin.vdL;

  return hoursList.map((h) => {
    const ts = addHoursIso(params.anchorIso!, h);
    const matchingSample = params.sortedSamples.find(
      (s) => Math.abs(diffHoursIso(ts, s.timestampIso)) < 0.05
    );
    const phase: 'suspensión' | 'reintroducción' =
      params.scenarioA.enabled && diffHoursIso(params.scenarioA.restartTimeIso, ts) >= 0
        ? 'reintroducción'
        : 'suspensión';

    return {
      timeHoursFromLastSample: h,
      timestampIso: ts,
      phase,
      measuredValue: matchingSample?.concentrationMmolL ?? null,
      motokiA:
        params.motoki.kePerHour && params.motoki.vdL
          ? evaluateConcentrationAtTime(ts, params.anchorIso!, params.anchorConc!, params.motoki.kePerHour, params.motoki.vdL, params.scenarioA)
          : null,
      abouAudaA:
        params.abouAuda.kePerHour && params.abouAuda.vdL
          ? evaluateConcentrationAtTime(ts, params.anchorIso!, params.anchorConc!, params.abouAuda.kePerHour, params.abouAuda.vdL, params.scenarioA)
          : null,
      pepinA:
        params.pepin.kePerHour && params.pepin.vdL
          ? evaluateConcentrationAtTime(ts, params.anchorIso!, params.anchorConc!, params.pepin.kePerHour, params.pepin.vdL, params.scenarioA)
          : null,
      empiricalA:
        params.empirical.available && params.empirical.kePerHour && empVd
          ? evaluateConcentrationAtTime(ts, params.anchorIso!, params.anchorConc!, params.empirical.kePerHour, empVd, params.scenarioA)
          : null,
      motokiB:
        params.scenarioB.enabled && params.motoki.kePerHour && params.motoki.vdL
          ? evaluateConcentrationAtTime(ts, params.anchorIso!, params.anchorConc!, params.motoki.kePerHour, params.motoki.vdL, params.scenarioB)
          : null,
      abouAudaB:
        params.scenarioB.enabled && params.abouAuda.kePerHour && params.abouAuda.vdL
          ? evaluateConcentrationAtTime(ts, params.anchorIso!, params.anchorConc!, params.abouAuda.kePerHour, params.abouAuda.vdL, params.scenarioB)
          : null,
      pepinB:
        params.scenarioB.enabled && params.pepin.kePerHour && params.pepin.vdL
          ? evaluateConcentrationAtTime(ts, params.anchorIso!, params.anchorConc!, params.pepin.kePerHour, params.pepin.vdL, params.scenarioB)
          : null,
    };
  });
}

/**
 * Generates an exploratory multi-dose concentration-time curve from t=0 to totalHours
 * starting from an initial concentration c0MmolL (for individual model modules 1-3).
 */
export function buildSingleModelRegimenCurve(params: {
  startIso: string;
  initialConcMmolL: number;
  dailyDoseMg: number;
  intervalHours: number;
  kePerHour: number;
  vdL: number;
  totalHours: number;
  stopAfterHours?: number | null;
}): Array<{ hour: number; timestampIso: string; conc: number }> {
  const {
    startIso,
    initialConcMmolL,
    dailyDoseMg,
    intervalHours,
    kePerHour,
    vdL,
    totalHours,
    stopAfterHours,
  } = params;

  const tau = intervalHours > 0 ? intervalHours : 24;
  const dosePerIntMmol = mgLi2Co3ToMmol(dailyDoseMg * (tau / 24));
  const deltaC = dosePerIntMmol / vdL;

  const offsets = new Set<number>();
  for (let h = 0; h <= totalHours; h += 1) {
    offsets.add(h);
  }
  const activeLimit = stopAfterHours !== null && stopAfterHours !== undefined ? stopAfterHours : totalHours;
  for (let d = 0; d <= activeLimit; d += tau) {
    if (d - 0.01 >= 0) offsets.add(Number((d - 0.01).toFixed(4)));
    offsets.add(Number(d.toFixed(4)));
  }

  const sorted = Array.from(offsets).sort((a, b) => a - b);

  return sorted.map((h) => {
    let conc = initialConcMmolL * Math.exp(-kePerHour * h);
    const maxDoseTime = Math.min(h, activeLimit);
    const nDoses = Math.floor(maxDoseTime / tau);
    if (dailyDoseMg > 0) {
      for (let i = 0; i <= nDoses; i++) {
        const doseTime = i * tau;
        if (doseTime <= h && (stopAfterHours === null || stopAfterHours === undefined || doseTime < stopAfterHours)) {
          conc += deltaC * Math.exp(-kePerHour * (h - doseTime));
        }
      }
    }
    return {
      hour: h,
      timestampIso: addHoursIso(startIso, h),
      conc: Math.max(0, conc),
    };
  });
}
