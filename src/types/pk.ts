export type Sex = 'male' | 'female';
export type CareSetting = 'inpatient' | 'outpatient';
export type ScrUnit = 'mg/dL' | 'umol/L';
export type BunUnit = 'mmol/L' | 'mg/dL';
export type ModelId = 'motoki' | 'abouAuda' | 'pepin';
export type VdAssumptionMode = 'pepin_vapp' | 'manual_vd' | 'observed_thalf';

export interface ClinicalFlags {
  acuteKidneyInjury: boolean;
  extracorporealRemoval: boolean;
  severeNeurotoxicity: boolean;
  interactingMedications: boolean; // NSAIDs, diuretics, ACEi/ARB, CCB
  sodiumRestrictedDiet: boolean;
  nonAdherenceSuspected: boolean;
}

export interface PatientInputs {
  age: number | null; // years
  sex: Sex | null;
  weightKg: number | null; // total body weight in kg
  heightCm: number | null; // height in cm
  scrValue: number | null; // raw input
  scrUnit: ScrUnit;
  bunValue: number | null; // raw input
  bunUnit: BunUnit;
  setting: CareSetting;
  concomitantTca: boolean;
  measuredEgfr?: number | null; // optional clinician-supplied CKD-EPI / MDRD for reference only
  flags: ClinicalFlags;
}

export interface DosingInputs {
  dailyDoseMg: number | null; // mg Li2CO3 / day
  targetCssMmolL: number | null; // mmol/L (same as mEq/L)
  dosingIntervalHours: number; // 24, 12, or 8
  lastDoseTimeIso: string; // ISO local datetime string
}

export interface MeasuredSample {
  id: string;
  timestampIso: string;
  concentrationMmolL: number | null;
  label?: string;
}

export interface ReintroductionScenario {
  id: 'A' | 'B';
  name: string;
  enabled: boolean;
  restartTimeIso: string;
  dailyDoseMg: number | null;
  dosingIntervalHours: number; // 24, 12, or 8
}

export interface IntoxicationInputs {
  suspensionTimeIso: string;
  priorDailyDoseMg: number | null;
  priorIntervalHours: number;
  samples: MeasuredSample[];
  vdAssumption: VdAssumptionMode;
  manualVdL: number | null;
  simulationHorizonHours: number; // hours after last measured sample
  scenarioA: ReintroductionScenario;
  scenarioB: ReintroductionScenario;
}

export interface ValidationIssue {
  severity: 'info' | 'warning' | 'critical';
  code: string;
  title: string;
  detail: string;
}

export interface VariableDefinition {
  symbol: string;
  name: string;
  unit: string;
  description: string;
  currentValue?: string;
}

export interface ModelCalculationResult {
  modelId: ModelId;
  modelName: string;
  citationShort: string;
  canCalculateClearance: boolean;
  canCalculateDoseOrCss: boolean;
  missingForClearance: string[];
  missingForDoseOrCss: string[];
  crClMlMin: number | null;
  crClLh: number | null;
  ibwKg: number | null;
  bmiKgM2: number | null;
  scrCorrectedMgDl: number | null;
  liClMlMin: number | null;
  liClLh: number | null;
  liClLday: number | null;
  vdL: number | null;
  vdSourceNote: string | null;
  tHalfHours: number | null;
  kePerHour: number | null;
  predictedCssMmolL: number | null;
  predictedDailyDoseMg: number | null;
  secondaryMetrics: Array<{ label: string; value: string; unit: string; note?: string }>;
  validationIssues: ValidationIssue[];
  isWithinValidatedPopulation: boolean;
}

export interface TimeSeriesPoint {
  timeHoursFromRef: number; // hours relative to reference timestamp (suspension or t0)
  timestampIso: string;
  motokiA?: number | null;
  abouAudaA?: number | null;
  pepinA?: number | null;
  empiricalA?: number | null;
  motokiB?: number | null;
  abouAudaB?: number | null;
  pepinB?: number | null;
  empiricalB?: number | null;
}

export interface EmpiricalWashoutFit {
  available: boolean;
  sampleCount: number;
  kePerHour: number | null;
  tHalfHours: number | null;
  rSquared: number | null;
  warning?: string;
}

export interface IntervalRow {
  timeHoursFromLastSample: number;
  timestampIso: string;
  phase: 'suspensión' | 'reintroducción';
  motokiA: number | null;
  abouAudaA: number | null;
  pepinA: number | null;
  empiricalA: number | null;
  motokiB: number | null;
  abouAudaB: number | null;
  pepinB: number | null;
  measuredValue: number | null;
}
