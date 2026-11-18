import { BunUnit, ScrUnit, Sex } from '../types/pk';

// Stoichiometry of Lithium Carbonate (Li2CO3):
// 300 mg Li2CO3 = 8.12 mmol (mEq) of Li+ (Stip et al. 2001 p. 332; Abou-Auda et al. 2008 p. 371)
export const LI2CO3_MMOL_PER_300MG = 8.12;
export const LI2CO3_MMOL_PER_MG = LI2CO3_MMOL_PER_300MG / 300; // 0.0270667 mmol/mg
export const LI2CO3_MG_PER_MMOL = 300 / LI2CO3_MMOL_PER_300MG; // 36.9458 mg/mmol

// Unit conversion constants
const SCR_UMOL_PER_MGDL = 88.42; // 1 mg/dL creatinine = 88.42 umol/L
const BUN_MGDL_PER_MMOL = 2.801; // 1 mmol/L BUN = 2.801 mg/dL (MW of N2 = 28.01 g/mol)

export function mgLi2Co3ToMmol(mg: number): number {
  return mg * LI2CO3_MMOL_PER_MG;
}

export function mmolLiToMgLi2Co3(mmol: number): number {
  return mmol * LI2CO3_MG_PER_MMOL;
}

export function scrToMgDl(value: number | null, unit: ScrUnit): number | null {
  if (value === null || !Number.isFinite(value) || value <= 0) return null;
  return unit === 'mg/dL' ? value : value / SCR_UMOL_PER_MGDL;
}

export function bunToMmolL(value: number | null, unit: BunUnit): number | null {
  if (value === null || !Number.isFinite(value) || value <= 0) return null;
  return unit === 'mmol/L' ? value : value / BUN_MGDL_PER_MMOL;
}

export function bunToMgDl(value: number | null, unit: BunUnit): number | null {
  if (value === null || !Number.isFinite(value) || value <= 0) return null;
  return unit === 'mg/dL' ? value : value * BUN_MGDL_PER_MMOL;
}

export function mlMinToLh(mlMin: number): number {
  return mlMin * 0.06;
}

export function lhToMlMin(lh: number): number {
  return lh / 0.06;
}

export function mlMinToLday(mlMin: number): number {
  return mlMin * 1.44;
}

export function lhToLday(lh: number): number {
  return lh * 24;
}

export function computeBmi(weightKg: number | null, heightCm: number | null): number | null {
  if (!weightKg || !heightCm || weightKg <= 0 || heightCm <= 0) return null;
  const hM = heightCm / 100;
  return weightKg / (hM * hM);
}

/**
 * Pepin / Stip et al. (2001) Ideal Body Weight formula (height in meters):
 * Men: IBW = 50 + 90.551 * (height_m - 1.524)
 * Women: IBW = 45.5 + 90.551 * (height_m - 1.524)
 */
export function computePepinIbwKg(sex: Sex, heightCm: number): number {
  const heightM = heightCm / 100;
  const base = sex === 'male' ? 50 : 45.5;
  return base + 90.551 * (heightM - 1.524);
}

/**
 * Cockcroft-Gault (1976) equation:
 * Men: ((140 - age) * weight_kg) / (72 * SCr_mg_dL)
 * Women: 0.85 * ((140 - age) * weight_kg) / (72 * SCr_mg_dL)
 */
export function computeCockcroftGaultMlMin(
  age: number,
  sex: Sex,
  weightKg: number,
  scrMgDl: number
): number {
  const sexFactor = sex === 'female' ? 0.85 : 1.0;
  return (sexFactor * (140 - age) * weightKg) / (72 * scrMgDl);
}

/**
 * CKD-EPI 2021 (race-free) eGFR in mL/min/1.73m2 for clinical context reference only.
 * Not used inside the 3 published lithium equations (which all use Cockcroft-Gault).
 */
export function computeCkdEpi2021(age: number, sex: Sex, scrMgDl: number): number {
  const kappa = sex === 'female' ? 0.7 : 0.9;
  const alpha = sex === 'female' ? -0.241 : -0.302;
  const sexMult = sex === 'female' ? 1.012 : 1.0;
  const ratio = scrMgDl / kappa;
  return (
    142 *
    Math.pow(Math.min(ratio, 1), alpha) *
    Math.pow(Math.max(ratio, 1), -1.2) *
    Math.pow(0.9938, age) *
    sexMult
  );
}

export function addHoursIso(baseIso: string, hours: number): string {
  const t = new Date(baseIso).getTime();
  if (!Number.isFinite(t)) return baseIso;
  const target = new Date(t + hours * 3600_000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(target.getDate())}T${pad(
    target.getHours()
  )}:${pad(target.getMinutes())}`;
}

export function diffHoursIso(fromIso: string, toIso: string): number {
  const t1 = new Date(fromIso).getTime();
  const t2 = new Date(toIso).getTime();
  if (!Number.isFinite(t1) || !Number.isFinite(t2)) return NaN;
  return (t2 - t1) / 3600_000;
}

export function formatIsoShort(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
