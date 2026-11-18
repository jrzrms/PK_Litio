import {
  DosingInputs,
  ModelCalculationResult,
  ModelId,
  PatientInputs,
  ValidationIssue,
  VariableDefinition,
} from '../types/pk';
import {
  bunToMgDl,
  bunToMmolL,
  computeBmi,
  computeCockcroftGaultMlMin,
  computePepinIbwKg,
  lhToLday,
  lhToMlMin,
  mgLi2Co3ToMmol,
  mlMinToLday,
  mlMinToLh,
  mmolLiToMgLi2Co3,
  scrToMgDl,
} from './unitConversions';

export interface ModelSpec {
  id: ModelId;
  shortTitle: string;
  fullCitation: string;
  doiOrJournal: string;
  populationSummary: string;
  inclusionCriteria: string[];
  exclusionCriteria: string[];
  limitations: string[];
  originalEquationLines: string[];
  dimensionalCheck: string[];
  variables: VariableDefinition[];
}

export const MODEL_SPECS: Record<ModelId, ModelSpec> = {
  motoki: {
    id: 'motoki',
    shortTitle: 'Módulo 1 · Motoki et al. (2016)',
    fullCitation:
      'Motoki T, Fukuoka N, Yamaguchi K, Watanabe M, Tanaka H, Abe T, Yoshino N, Kosaka S, Houchi H. Calculation of Lithium Clearance for Clinical use Based on Renal Excretion in Japanese Patients. Int J Clin Pharmacol Pharmacother. 2016;1:107.',
    doiOrJournal: 'doi: 10.15344/2456-3501/2016/107',
    populationSummary:
      '72 pacientes psiquiátricos japoneses en tratamiento crónico con carbonato de litio (LIMAS®): 42 hombres y 30 mujeres; 13 hospitalizados y 59 ambulatorios. Edad 51,7 ± 17,0 años (rango 23–80), peso 59,3 ± 13,8 kg (36,0–90,0), SCr 0,80 ± 0,32 mg/dL (0,60–2,70), Ccr 90,4 ± 31,5 mL/min (28,5–170,4), dosis 594,4 ± 246,0 mg/día (200–1200), Css valle 0,59 ± 0,27 mmol/L (0,21–1,82). Validado en cohorte independiente de 44 pacientes.',
    inclusionCriteria: [
      'Pacientes japoneses en tratamiento crónico con carbonato de litio (≥ 5 días para alcanzar estado estacionario).',
      'Muestras valle medidas en estado estacionario (método de ionización de llama).',
      'Adherencia terapéutica confirmada.',
    ],
    exclusionCriteria: [
      'Falta de adherencia al tratamiento.',
      'Administración concomitante de fármacos que alteren la farmacocinética del litio (p. ej., AINE, diuréticos).',
    ],
    limitations: [
      'Análisis retrospectivo con tamaño muestral limitado (n = 72 derivación; n = 44 validación) en población japonesa.',
      'Coeficiente de determinación moderado (R² = 0,326 para Li-CL; R² = 0,555 para Css).',
      'En pacientes obesos (IMC ≥ 25 kg/m²), Ccr con peso total (TBW) tiende a sobreestimar Li-CL; los autores señalan que usar IBW mejora la precisión.',
      'El artículo deriva únicamente Li-CL y Css (1/(C/D)); no publica una ecuación propia para Vd ni t½.',
    ],
    originalEquationLines: [
      'Li-CL (mL/min) = 0,161 × Ccr (mL/min) + 6,47   [Eq. 6; R² = 0,326, P < 0,001]',
      'Ccr (mL/min) = [(140 − Edad) × Peso_TBW (kg)] / [72 × SCr_corr (mg/dL)] × (0,85 si mujer)',
      'Regla SCr: si SCr < 0,6 mg/dL → se corrige a SCr = 0,6 mg/dL',
      'Css (mmol/L) = [Dosis diaria (mg/día) × (8,12 / 300)] / [Li-CL (mL/min) × 1,44]',
    ],
    dimensionalCheck: [
      '0,161 (adimensional) × Ccr (mL/min) + 6,47 (mL/min) → mL/min.',
      'Factor conversión caudal: 1 mL/min × (60 min/h) / (1000 mL/L) = 0,06 L/h; × 24 h/día = 1,44 L/día.',
      'Estequiometría Li₂CO₃: 300 mg = 8,12 mmol Li⁺ → Dosis (mmol/día) = Dosis (mg/día) × (8,12 / 300).',
      'Css = (mmol/día) / (L/día) = mmol/L (equivalente a mEq/L al ser catión monovalente).',
    ],
    variables: [
      { symbol: 'Li-CL', name: 'Aclaramiento renal de litio', unit: 'mL/min', description: 'Variable dependiente calculada como 1/(C/D).' },
      { symbol: 'Ccr', name: 'Aclaramiento de creatinina', unit: 'mL/min', description: 'Ecuación de Cockcroft-Gault con peso corporal total (TBW).' },
      { symbol: 'SCr_corr', name: 'Creatinina sérica corregida', unit: 'mg/dL', description: 'Si SCr < 0,6 mg/dL, Motoki et al. fijan SCr = 0,6 mg/dL.' },
      { symbol: 'Edad', name: 'Edad del paciente', unit: 'años', description: 'Rango validado en la cohorte: 23–80 años.' },
      { symbol: 'TBW', name: 'Peso corporal total', unit: 'kg', description: 'Rango validado: 36,0–90,0 kg.' },
    ],
  },
  abouAuda: {
    id: 'abouAuda',
    shortTitle: 'Módulo 2 · Abou-Auda et al. (2008)',
    fullCitation:
      'Abou-Auda HS, Al-Yamani MJ, Abou-Shaaban RR, Khoshhal SI. A new accurate method for predicting lithium clearance and daily dosage requirements in adult psychiatric patients. Bipolar Disord. 2008;10(3):369–376.',
    doiOrJournal: 'Bipolar Disorders 2008: 10: 369–376',
    populationSummary:
      '60 pacientes psiquiátricos adultos en derivación (34M/26F, 53 de nacionalidad saudí; edad 38,83 ± 9,87 años, rango 21–77; peso 71,39 ± 17,04 kg, rango 33–120) y 60 pacientes en validación, evaluados en ámbito hospitalizado y ambulatorio (dosis 375–1800 mg/día; niveles valle 12–14 h posdosis: 0,06–1,21 mmol/L).',
    inclusionCriteria: [
      'Adultos de 18–80 años en tratamiento con múltiples dosis diarias de carbonato de litio durante ≥ 7 días consecutivos.',
      'Muestra sérica extraída 12–14 h después de la última dosis.',
      'Sin evidencia de anomalías cardíacas, respiratorias, hepáticas o renales.',
    ],
    exclusionCriteria: [
      'Evidencia de alteración renal, cardíaca, respiratoria o hepática.',
      'Dieta restringida en sodio.',
      'Medicación concomitante que afecte a los niveles de litio (diuréticos, IECA, antagonistas del calcio, AINE).',
    ],
    limitations: [
      'Cohorte sin patología renal manifiesta (SCr 0,63–1,37 mg/dL hospitalizados; 0,49–1,86 mg/dL ambulatorios): NO validado en insuficiencia renal aguda ni crónica significativa.',
      'La ecuación multivariable de dosis diaria utiliza BUN en mmol/L, sexo, edad, peso, CLcr (L/h) y uso de antidepresivos tricíclicos (TCA).',
      'El artículo deriva ecuaciones para CL_Li (L/h) y dosis diaria (mg/día), y cita la relación Vd = CL_Li / kd de Pepin al comparar métodos; no deriva una ecuación propia para Vd.',
    ],
    originalEquationLines: [
      'CL_Li (hospitalizados, L/h) = 0,932 + 0,185 × CL_Cr (L/h)',
      'CL_Li (ambulatorios, L/h) = 1,021 + 0,141 × CL_Cr (L/h)',
      'Relación estado estacionario: CL_Li (L/h) = [F × D / (24 × Css)] × (8,12 / 300)',
      'Dosis diaria (hosp., mg) = 350,15 + 289,92(Css) + 0,84(Peso) − 1,76(Edad) + 34,43(TCA) + 62,1(CL_Cr) + 13,1(BUN) + 40,9(Sexo)',
      'Dosis diaria (ambul., mg) = 784,92 + 530,22(Css) + 8,61(Peso) − 12,09(Edad) − 11,14(TCA) − 7,63(CL_Cr) − 42,62(BUN) − 23,43(Sexo)',
      'Dosis simplificada (sin TCA): Dosis (mg) = 382,54 + 348,29(Css) + 67,19(CL_Cr)',
    ],
    dimensionalCheck: [
      'CL_Cr en L/h = Cockcroft-Gault (mL/min) × 0,06 (L/h por mL/min).',
      'CL_Li (L/h) = intercepto (L/h) + pendiente (adimensional) × CL_Cr (L/h) → L/h.',
      'Ecuación de equilibrio: [1,0 × D (mg/día) × (8,12 mmol / 300 mg)] / [24 h/día × Css (mmol/L)] = (mmol/h) / (mmol/L) = L/h.',
      'En las ecuaciones de regresión de dosis diaria: Css en mmol/L, Peso en kg, Edad en años, TCA (1=sí, 0=no), CL_Cr en L/h, BUN en mmol/L (mg/dL ÷ 2,801), Sexo (1=hombre, 0=mujer).',
    ],
    variables: [
      { symbol: 'CL_Cr', name: 'Aclaramiento de creatinina', unit: 'L/h', description: 'Cockcroft-Gault convertido a L/h (mL/min × 0,06).' },
      { symbol: 'Ámbito', name: 'Hospitalizado / Ambulatorio', unit: 'categoría', description: 'Modifica intercepto y pendiente por adherencia, actividad y dieta.' },
      { symbol: 'BUN', name: 'Nitrógeno ureico en sangre', unit: 'mmol/L', description: 'Requerido en la ecuación multivariable de dosis diaria (1 mmol/L = 2,801 mg/dL).' },
      { symbol: 'TCA', name: 'Antidepresivo tricíclico', unit: '1 / 0', description: 'Uso concomitante de antidepresivo tricíclico (sí=1, no=0).' },
      { symbol: 'F', name: 'Biodisponibilidad oral', unit: 'fracción', description: 'F = 1,0 (100%) según el artículo.' },
    ],
  },
  pepin: {
    id: 'pepin',
    shortTitle: 'Módulo 3 · Pepin / Stip et al. (2001)',
    fullCitation:
      'Stip E, Dufresne J, Boulerice B, Elie R. Accuracy of the Pepin method to determine appropriate lithium dosages in healthy volunteers. J Psychiatry Neurosci. 2001;26(4):330–335.',
    doiOrJournal: 'J Psychiatry Neurosci 2001;26(4):330–335',
    populationSummary:
      'Evaluación prospectiva de la fórmula de Pepin et al. (1980) durante 21 días (carbonato de litio de liberación lenta cada 12 h, muestras 12 h posdosis) en 13 voluntarios sanos (7 hombres, 6 mujeres). Edad media 32 años (rango 18–44), talla 1,70 ± 0,06 m (1,57–1,78), peso ideal 64,07 ± 7,51 kg (49,67–73,18), SCr 0,85 ± 0,11 mg/dL (0,66–1,03), dosis Pepin 1567 ± 297 mg/día (1077–1960).',
    inclusionCriteria: [
      'Voluntarios adultos sanos de 18–50 años sin enfermedad cardíaca, tiroidea ni renal.',
      'Sin enfermedad psiquiátrica ni anestesia general en los últimos 6 meses.',
      'Anticoncepción fiable y prueba de embarazo negativa en mujeres en edad fértil.',
    ],
    exclusionCriteria: [
      'Cualquier nefropatía, cardiopatía o patología tiroidea.',
      'Trastornos psiquiátricos, embarazo o cirugía con anestesia reciente.',
      'El estudio concluye explícitamente que se requiere evaluar el método en pacientes con distintos grados de disfunción renal.',
    ],
    limitations: [
      'Tamaño muestral muy pequeño (n = 13) y rango de edad estrecho (18–44 años) en voluntarios sanos con función renal normal.',
      'El 84% de las determinaciones alcanzó rango terapéutico (0,60–1,20 mmol/L), pero la media observada (0,70 mmol/L) fue inferior al objetivo de 0,80 mmol/L (p = 0,034): método seguro pero conservador (infraestima ligeramente la dosis necesaria en sujetos sanos).',
      'Utiliza peso corporal ideal (IBW) derivado de la talla; en obesidad extrema o talla < 1,524 m puede desviarse.',
    ],
    originalEquationLines: [
      'IBW_H = 50 + 90,551 × (Talla_m − 1,524)   |   IBW_M = 45,5 + 90,551 × (Talla_m − 1,524)',
      'Cl_Cr (mL/min) = [(140 − Edad) × IBW] / (72 × Cr_S) × (0,85 si mujer)',
      'Cl_Li (mL/min) = 0,235 × Cl_Cr (mL/min)',
      't½_Li (h) = 24 / {1 − 0,95 × [1 − (Cl_Cr / 100)]}   |   k (h⁻¹) = 0,693 / t½_Li',
      'V_app (L) = Cl_Li (L/h) / k (h⁻¹)',
      'D (mmol) = [Css_min × V_app × (1 − e^(−k·τ))] / [F × e^(−k·τ)]   (con 300 mg = 8,12 mmol, F = 1,0, τ = 24 h)',
    ],
    dimensionalCheck: [
      'Talla en metros: 90,551 kg/m × (m − 1,524 m) + kg = kg (IBW).',
      'Cl_Cr en mL/min → Cl_Li (L/h) = 0,235 × Cl_Cr × 0,06.',
      't½_Li = h / adimensional = h → k = 0,693 / t½_Li = h⁻¹.',
      'V_app = (L/h) / (h⁻¹) = L. Exponente k·τ = (h⁻¹) × (h) = adimensional.',
      'D (mmol) = (mmol/L) × L × adimensional = mmol → D (mg) = D (mmol) × (300 / 8,12).',
    ],
    variables: [
      { symbol: 'IBW', name: 'Peso corporal ideal', unit: 'kg', description: 'Calculado a partir del sexo y la talla en metros.' },
      { symbol: 'Cl_Cr', name: 'Aclaramiento de creatinina (IBW)', unit: 'mL/min', description: 'Cockcroft-Gault usando IBW (no peso real).' },
      { symbol: 't½_Li', name: 'Semivida de eliminación de litio', unit: 'h', description: 'Basada en t½ normal = 24 h y fracción excretada renal Fe = 0,95.' },
      { symbol: 'V_app', name: 'Volumen aparente de distribución', unit: 'L', description: 'Cociente Cl_Li (L/h) / k (h⁻¹).' },
      { symbol: 'Css_min', name: 'Concentración valle objetivo', unit: 'mmol/L', description: 'Concentración mínima en estado estacionario al final del intervalo τ.' },
    ],
  },
};

function checkCommonSafetyFlags(patient: PatientInputs, issues: ValidationIssue[]) {
  if (patient.flags.acuteKidneyInjury) {
    issues.push({
      severity: 'critical',
      code: 'AKI',
      title: 'Insuficiencia renal aguda / SCr inestable',
      detail:
        'Cockcroft-Gault presupone creatinina sérica en estado estacionario. En fracaso renal agudo, la fórmula sobreestima el filtrado glomerular real y las ecuaciones de los artículos no predicen con fiabilidad la eliminación instantánea.',
    });
  }
  if (patient.flags.extracorporealRemoval) {
    issues.push({
      severity: 'critical',
      code: 'HD_CRRT',
      title: 'Depuración extracorpórea (Hemodiálisis / TCRR)',
      detail:
        'Los modelos farmacocinéticos publicados NO modelan aclaramiento dialítico ni el fenómeno de rebote plasmático posdiálisis desde el compartimento intracelular. Requiere monitorización seriada post-sesión y valoración nefrológica/toxicológica.',
    });
  }
  if (patient.flags.interactingMedications) {
    issues.push({
      severity: 'warning',
      code: 'INTERACTIONS',
      title: 'Fármacos con interacción renal sobre el litio',
      detail:
        'AINE, diuréticos (tiazidas/asa), IECA o ARA-II reducen el aclaramiento renal de litio y aumentan la reabsorción tubular proximal. Los 3 estudios excluyeron o advirtieron sobre estas interacciones.',
    });
  }
  if (patient.flags.sodiumRestrictedDiet) {
    issues.push({
      severity: 'warning',
      code: 'LOW_NA',
      title: 'Depleción de sodio / Dieta hiposódica',
      detail:
        'La depleción hidrosalina incrementa la reabsorción proximal de litio y prolonga su semivida por encima de lo estimado por Ccr.',
    });
  }
}

export function calculateMotoki(
  patient: PatientInputs,
  dosing: DosingInputs,
  optionalVdL?: number | null,
  vdNote?: string | null
): ModelCalculationResult {
  const missingForClearance: string[] = [];
  if (patient.age === null || patient.age <= 0) missingForClearance.push('Edad (años)');
  if (!patient.sex) missingForClearance.push('Sexo');
  if (patient.weightKg === null || patient.weightKg <= 0) missingForClearance.push('Peso corporal total (kg)');
  const scrMgDl = scrToMgDl(patient.scrValue, patient.scrUnit);
  if (scrMgDl === null) missingForClearance.push('Creatinina sérica (SCr)');

  const issues: ValidationIssue[] = [];
  checkCommonSafetyFlags(patient, issues);

  const bmi = computeBmi(patient.weightKg, patient.heightCm);

  if (missingForClearance.length > 0) {
    return {
      modelId: 'motoki',
      modelName: 'Motoki et al. (2016)',
      citationShort: 'Motoki et al., Int J Clin Pharmacol Pharmacother 2016',
      canCalculateClearance: false,
      canCalculateDoseOrCss: false,
      missingForClearance,
      missingForDoseOrCss: [],
      crClMlMin: null,
      crClLh: null,
      ibwKg: null,
      bmiKgM2: bmi,
      scrCorrectedMgDl: null,
      liClMlMin: null,
      liClLh: null,
      liClLday: null,
      vdL: null,
      vdSourceNote: null,
      tHalfHours: null,
      kePerHour: null,
      predictedCssMmolL: null,
      predictedDailyDoseMg: null,
      secondaryMetrics: [],
      validationIssues: issues,
      isWithinValidatedPopulation: false,
    };
  }

  const age = patient.age!;
  const sex = patient.sex!;
  const weightKg = patient.weightKg!;
  const scrCorrected = Math.max(scrMgDl!, 0.6);

  if (scrMgDl! < 0.6) {
    issues.push({
      severity: 'info',
      code: 'MOTOKI_SCR_CAP',
      title: 'Corrección de SCr < 0,6 mg/dL aplicada (regla del estudio)',
      detail: `SCr introducida (${scrMgDl!.toFixed(2)} mg/dL) corregida a 0,60 mg/dL según la metodología de Motoki et al. (2016).`,
    });
  }

  const crClMlMin = computeCockcroftGaultMlMin(age, sex, weightKg, scrCorrected);
  const crClLh = mlMinToLh(crClMlMin);
  const liClMlMin = 0.161 * crClMlMin + 6.47;
  const liClLh = mlMinToLh(liClMlMin);
  const liClLday = mlMinToLday(liClMlMin);

  // Population validation checks for Motoki et al. (2016)
  let outOfPop = false;
  if (age < 23 || age > 80) {
    outOfPop = true;
    issues.push({
      severity: 'warning',
      code: 'MOTOKI_AGE',
      title: 'Edad fuera del rango validado (Motoki 2016)',
      detail: `Edad ${age} años fuera del rango de la cohorte japonesa (23–80 años).`,
    });
  }
  if (weightKg < 36 || weightKg > 90) {
    outOfPop = true;
    issues.push({
      severity: 'warning',
      code: 'MOTOKI_WT',
      title: 'Peso fuera del rango validado (Motoki 2016)',
      detail: `Peso ${weightKg.toFixed(1)} kg fuera del rango de estudio (36,0–90,0 kg).`,
    });
  }
  if (scrCorrected > 2.7) {
    outOfPop = true;
    issues.push({
      severity: 'warning',
      code: 'MOTOKI_SCR',
      title: 'Creatinina superior al rango validado (Motoki 2016)',
      detail: `SCr ${scrCorrected.toFixed(2)} mg/dL supera el máximo de la cohorte (2,70 mg/dL).`,
    });
  }
  if (crClMlMin < 28.5 || crClMlMin > 170.4) {
    outOfPop = true;
    issues.push({
      severity: 'warning',
      code: 'MOTOKI_CCR',
      title: 'Ccr fuera del rango validado (Motoki 2016)',
      detail: `Ccr estimado (${crClMlMin.toFixed(1)} mL/min) fuera del rango observado (28,5–170,4 mL/min).`,
    });
  }
  if (bmi !== null && bmi >= 25) {
    issues.push({
      severity: 'warning',
      code: 'MOTOKI_BMI',
      title: 'Sobrepeso/Obesidad (IMC ≥ 25 kg/m²): posible sobreestimación de Li-CL',
      detail: `IMC = ${bmi.toFixed(1)} kg/m². En la discusión de Motoki et al., en sujetos con IMC ≥ 25 kg/m², Cockcroft-Gault con TBW sobreestimó Li-CL respecto a IBW.`,
    });
  }
  if (patient.flags.nonAdherenceSuspected) {
    outOfPop = true;
    issues.push({
      severity: 'warning',
      code: 'MOTOKI_ADH',
      title: 'Criterio de exclusión: sospecha de no adherencia',
      detail: 'Motoki et al. excluyeron a los pacientes con falta de adherencia terapéutica.',
    });
  }

  let predictedCssMmolL: number | null = null;
  if (dosing.dailyDoseMg !== null && dosing.dailyDoseMg > 0) {
    predictedCssMmolL = mgLi2Co3ToMmol(dosing.dailyDoseMg) / liClLday;
    if (dosing.dailyDoseMg < 200 || dosing.dailyDoseMg > 1200) {
      issues.push({
        severity: 'info',
        code: 'MOTOKI_DOSE_RANGE',
        title: 'Dosis fuera del rango observado en Motoki (200–1200 mg/día)',
        detail: `Dosis evaluada: ${dosing.dailyDoseMg} mg/día (rango en Table 1: 200–1200 mg/día).`,
      });
    }
  }

  let predictedDailyDoseMg: number | null = null;
  if (dosing.targetCssMmolL !== null && dosing.targetCssMmolL > 0) {
    predictedDailyDoseMg = mmolLiToMgLi2Co3(dosing.targetCssMmolL * liClLday);
  }

  let vdL: number | null = null;
  let kePerHour: number | null = null;
  let tHalfHours: number | null = null;
  if (optionalVdL && optionalVdL > 0) {
    vdL = optionalVdL;
    kePerHour = liClLh / vdL;
    tHalfHours = 0.693 / kePerHour;
  }

  return {
    modelId: 'motoki',
    modelName: 'Motoki et al. (2016)',
    citationShort: 'Motoki et al., Int J Clin Pharmacol Pharmacother 2016',
    canCalculateClearance: true,
    canCalculateDoseOrCss: predictedCssMmolL !== null || predictedDailyDoseMg !== null,
    missingForClearance: [],
    missingForDoseOrCss: [],
    crClMlMin,
    crClLh,
    ibwKg: null,
    bmiKgM2: bmi,
    scrCorrectedMgDl: scrCorrected,
    liClMlMin,
    liClLh,
    liClLday,
    vdL,
    vdSourceNote: vdNote ?? null,
    tHalfHours,
    kePerHour,
    predictedCssMmolL,
    predictedDailyDoseMg,
    secondaryMetrics: [
      { label: 'SCr aplicada (regla ≥ 0,6)', value: scrCorrected.toFixed(2), unit: 'mg/dL' },
      { label: 'Aclaramiento Li (L/día)', value: liClLday.toFixed(2), unit: 'L/día' },
    ],
    validationIssues: issues,
    isWithinValidatedPopulation: !outOfPop && !patient.flags.acuteKidneyInjury && !patient.flags.extracorporealRemoval && !patient.flags.interactingMedications,
  };
}

export function calculateAbouAuda(
  patient: PatientInputs,
  dosing: DosingInputs,
  optionalVdL?: number | null,
  vdNote?: string | null
): ModelCalculationResult {
  const missingForClearance: string[] = [];
  if (patient.age === null || patient.age <= 0) missingForClearance.push('Edad (años)');
  if (!patient.sex) missingForClearance.push('Sexo');
  if (patient.weightKg === null || patient.weightKg <= 0) missingForClearance.push('Peso corporal total (kg)');
  const scrMgDl = scrToMgDl(patient.scrValue, patient.scrUnit);
  if (scrMgDl === null) missingForClearance.push('Creatinina sérica (SCr)');

  const bunMmolL = bunToMmolL(patient.bunValue, patient.bunUnit);
  const bunMgDl = bunToMgDl(patient.bunValue, patient.bunUnit);
  const missingForDoseOrCss: string[] = [];
  if (bunMmolL === null) missingForDoseOrCss.push('BUN (requerido para ecuación multivariable de dosis diaria)');

  const issues: ValidationIssue[] = [];
  checkCommonSafetyFlags(patient, issues);
  const bmi = computeBmi(patient.weightKg, patient.heightCm);

  if (missingForClearance.length > 0) {
    return {
      modelId: 'abouAuda',
      modelName: 'Abou-Auda et al. (2008)',
      citationShort: 'Abou-Auda et al., Bipolar Disord 2008;10:369–376',
      canCalculateClearance: false,
      canCalculateDoseOrCss: false,
      missingForClearance,
      missingForDoseOrCss,
      crClMlMin: null,
      crClLh: null,
      ibwKg: null,
      bmiKgM2: bmi,
      scrCorrectedMgDl: null,
      liClMlMin: null,
      liClLh: null,
      liClLday: null,
      vdL: null,
      vdSourceNote: null,
      tHalfHours: null,
      kePerHour: null,
      predictedCssMmolL: null,
      predictedDailyDoseMg: null,
      secondaryMetrics: [],
      validationIssues: issues,
      isWithinValidatedPopulation: false,
    };
  }

  const age = patient.age!;
  const sex = patient.sex!;
  const weightKg = patient.weightKg!;
  const isInpatient = patient.setting === 'inpatient';

  const crClMlMin = computeCockcroftGaultMlMin(age, sex, weightKg, scrMgDl!);
  const crClLh = mlMinToLh(crClMlMin);

  // Combined sex equations (L/h)
  const liClLh = isInpatient ? 0.932 + 0.185 * crClLh : 1.021 + 0.141 * crClLh;
  const liClMlMin = lhToMlMin(liClLh);
  const liClLday = lhToLday(liClLh);

  // Sex-specific regressions also reported on p. 372
  const liClSexSpecificLh = isInpatient
    ? sex === 'male'
      ? 1.415 + 0.124 * crClLh
      : 0.534 + 0.228 * crClLh
    : sex === 'male'
      ? 1.055 + 0.137 * crClLh
      : 0.979 + 0.148 * crClLh;

  // Population criteria checks for Abou-Auda et al. (2008)
  let outOfPop = false;
  if (age < 18 || age > 80) {
    outOfPop = true;
    issues.push({
      severity: 'warning',
      code: 'AA_AGE',
      title: 'Edad fuera del criterio de inclusión (18–80 años)',
      detail: `Edad ${age} años fuera del rango de inclusión de Abou-Auda et al. (cohorte real: 21–77 años).`,
    });
  }
  if (weightKg < 33 || weightKg > 120) {
    outOfPop = true;
    issues.push({
      severity: 'warning',
      code: 'AA_WT',
      title: 'Peso fuera del rango observado (33–120 kg)',
      detail: `Peso ${weightKg.toFixed(1)} kg fuera del rango de la cohorte (33–120 kg).`,
    });
  }
  const maxScr = isInpatient ? 1.37 : 1.86;
  const minScr = isInpatient ? 0.63 : 0.49;
  if (scrMgDl! < minScr || scrMgDl! > maxScr) {
    outOfPop = true;
    issues.push({
      severity: 'critical',
      code: 'AA_RENAL_EXCL',
      title: 'Posible exclusión por función renal (Abou-Auda 2008)',
      detail: `SCr ${scrMgDl!.toFixed(2)} mg/dL fuera del rango de pacientes sin anomalía renal del estudio (${minScr}–${maxScr} mg/dL). Abou-Auda et al. excluyeron explícitamente a pacientes con anomalías renales, cardíacas, respiratorias o hepáticas.`,
    });
  }
  if (bunMgDl !== null && (bunMgDl < 4.76 || bunMgDl > 22.13)) {
    outOfPop = true;
    issues.push({
      severity: 'warning',
      code: 'AA_BUN',
      title: 'BUN fuera del rango de la cohorte (4,76–22,13 mg/dL)',
      detail: `BUN ${bunMgDl.toFixed(1)} mg/dL (${bunMmolL!.toFixed(2)} mmol/L) fuera del rango observado en Abou-Auda et al.`,
    });
  }
  if (patient.flags.sodiumRestrictedDiet || patient.flags.interactingMedications) {
    outOfPop = true;
  }

  // Css from CL_Li relationship: CL_Li = (F * D) / (24 * Css) * (8.12 / 300)
  let predictedCssFromCl: number | null = null;
  if (dosing.dailyDoseMg !== null && dosing.dailyDoseMg > 0) {
    predictedCssFromCl = (1.0 * dosing.dailyDoseMg * (8.12 / 300)) / (24 * liClLh);
  }

  // Daily dosage requirements (multivariable full regression + simplified + CL-derived)
  const tcaNum = patient.concomitantTca ? 1 : 0;
  const sexMaleNum = sex === 'male' ? 1 : 0;

  let predictedDailyDoseFullMg: number | null = null;
  let predictedDailyDoseSimplifiedMg: number | null = null;
  let predictedDailyDoseFromClMg: number | null = null;

  if (dosing.targetCssMmolL !== null && dosing.targetCssMmolL > 0) {
    const cDes = dosing.targetCssMmolL;
    predictedDailyDoseFromClMg = (cDes * 24 * liClLh * 300) / 8.12;
    if (!patient.concomitantTca) {
      predictedDailyDoseSimplifiedMg = 382.54 + 348.29 * cDes + 67.19 * crClLh;
    }
    if (bunMmolL !== null) {
      predictedDailyDoseFullMg = isInpatient
        ? 350.15 +
          289.92 * cDes +
          0.84 * weightKg -
          1.76 * age +
          34.43 * tcaNum +
          62.1 * crClLh +
          13.1 * bunMmolL +
          40.9 * sexMaleNum
        : 784.92 +
          530.22 * cDes +
          8.61 * weightKg -
          12.09 * age -
          11.14 * tcaNum -
          7.63 * crClLh -
          42.62 * bunMmolL -
          23.43 * sexMaleNum;
    }
  }

  const secondaryMetrics: Array<{ label: string; value: string; unit: string; note?: string }> = [
    {
      label: `CL_Li específico por sexo (${isInpatient ? 'hosp.' : 'ambul.'})`,
      value: liClSexSpecificLh.toFixed(3),
      unit: 'L/h',
      note: 'Ecuación estratificada p. 372',
    },
  ];

  if (predictedDailyDoseFromClMg !== null) {
    secondaryMetrics.push({
      label: 'Dosis desde relación CL_Li',
      value: Math.round(predictedDailyDoseFromClMg).toString(),
      unit: 'mg/día',
    });
  }
  if (predictedDailyDoseSimplifiedMg !== null) {
    secondaryMetrics.push({
      label: 'Dosis simplificada (sin TCA)',
      value: Math.round(predictedDailyDoseSimplifiedMg).toString(),
      unit: 'mg/día',
    });
  }

  let vdL: number | null = null;
  let kePerHour: number | null = null;
  let tHalfHours: number | null = null;
  if (optionalVdL && optionalVdL > 0) {
    vdL = optionalVdL;
    kePerHour = liClLh / vdL;
    tHalfHours = 0.693 / kePerHour;
  }

  return {
    modelId: 'abouAuda',
    modelName: 'Abou-Auda et al. (2008)',
    citationShort: 'Abou-Auda et al., Bipolar Disord 2008;10:369–376',
    canCalculateClearance: true,
    canCalculateDoseOrCss: predictedCssFromCl !== null || predictedDailyDoseFullMg !== null || predictedDailyDoseFromClMg !== null,
    missingForClearance: [],
    missingForDoseOrCss,
    crClMlMin,
    crClLh,
    ibwKg: null,
    bmiKgM2: bmi,
    scrCorrectedMgDl: scrMgDl,
    liClMlMin,
    liClLh,
    liClLday,
    vdL,
    vdSourceNote: vdNote ?? null,
    tHalfHours,
    kePerHour,
    predictedCssMmolL: predictedCssFromCl,
    predictedDailyDoseMg: predictedDailyDoseFullMg ?? predictedDailyDoseSimplifiedMg ?? predictedDailyDoseFromClMg,
    secondaryMetrics,
    validationIssues: issues,
    isWithinValidatedPopulation:
      !outOfPop &&
      !patient.flags.acuteKidneyInjury &&
      !patient.flags.extracorporealRemoval &&
      !patient.flags.interactingMedications &&
      !patient.flags.sodiumRestrictedDiet,
  };
}

export function calculatePepin(
  patient: PatientInputs,
  dosing: DosingInputs
): ModelCalculationResult {
  const missingForClearance: string[] = [];
  if (patient.age === null || patient.age <= 0) missingForClearance.push('Edad (años)');
  if (!patient.sex) missingForClearance.push('Sexo');
  if (patient.heightCm === null || patient.heightCm <= 0) missingForClearance.push('Talla (cm) para IBW');
  const scrMgDl = scrToMgDl(patient.scrValue, patient.scrUnit);
  if (scrMgDl === null) missingForClearance.push('Creatinina sérica (SCr)');

  const issues: ValidationIssue[] = [];
  checkCommonSafetyFlags(patient, issues);
  const bmi = computeBmi(patient.weightKg, patient.heightCm);

  if (missingForClearance.length > 0) {
    return {
      modelId: 'pepin',
      modelName: 'Pepin / Stip et al. (2001)',
      citationShort: 'Stip et al., J Psychiatry Neurosci 2001;26(4):330–335',
      canCalculateClearance: false,
      canCalculateDoseOrCss: false,
      missingForClearance,
      missingForDoseOrCss: [],
      crClMlMin: null,
      crClLh: null,
      ibwKg: null,
      bmiKgM2: bmi,
      scrCorrectedMgDl: null,
      liClMlMin: null,
      liClLh: null,
      liClLday: null,
      vdL: null,
      vdSourceNote: null,
      tHalfHours: null,
      kePerHour: null,
      predictedCssMmolL: null,
      predictedDailyDoseMg: null,
      secondaryMetrics: [],
      validationIssues: issues,
      isWithinValidatedPopulation: false,
    };
  }

  const age = patient.age!;
  const sex = patient.sex!;
  const heightCm = patient.heightCm!;
  const heightM = heightCm / 100;

  if (heightM < 1.524) {
    issues.push({
      severity: 'warning',
      code: 'PEPIN_HEIGHT_LOW',
      title: 'Talla < 1,524 m en fórmula de peso ideal de Pepin',
      detail: `Talla ${heightM.toFixed(2)} m es inferior a 1,524 m (60 pulgadas); la fórmula lineal de IBW de Devine/Pepin puede subestimar el peso ideal.`,
    });
  }

  const ibwKg = computePepinIbwKg(sex, heightCm);
  const crClMlMin = computeCockcroftGaultMlMin(age, sex, ibwKg, scrMgDl!);
  const crClLh = mlMinToLh(crClMlMin);
  const liClMlMin = 0.235 * crClMlMin;
  const liClLh = mlMinToLh(liClMlMin);
  const liClLday = mlMinToLday(liClMlMin);

  // t1/2_Li = 24 / {1 - 0.95 * [1 - (Cl_Cr / 100)]}
  const denom = Math.max(1 - 0.95 * (1 - crClMlMin / 100), 0.05);
  const tHalfHours = 24 / denom;
  const kePerHour = 0.693 / tHalfHours;
  const vdL = liClLh / kePerHour;

  // Population criteria checks for Stip et al. (2001)
  let outOfPop = false;
  if (age < 18 || age > 50) {
    outOfPop = true;
    issues.push({
      severity: 'warning',
      code: 'PEPIN_AGE',
      title: 'Edad fuera del criterio de Stip et al. (18–50 años)',
      detail: `Edad ${age} años fuera del rango de inclusión de los voluntarios sanos (18–50 años; muestra real 18–44 años).`,
    });
  }
  if (heightM < 1.57 || heightM > 1.78) {
    issues.push({
      severity: 'info',
      code: 'PEPIN_HEIGHT',
      title: 'Talla fuera del rango observado en Stip et al. (1,57–1,78 m)',
      detail: `Talla ${heightM.toFixed(2)} m fuera del rango observado en los 13 voluntarios.`,
    });
  }
  if (scrMgDl! < 0.66 || scrMgDl! > 1.03) {
    outOfPop = true;
    issues.push({
      severity: 'critical',
      code: 'PEPIN_RENAL',
      title: 'SCr fuera del rango sano de Stip et al. (0,66–1,03 mg/dL)',
      detail: `SCr ${scrMgDl!.toFixed(2)} mg/dL indica posible alteración renal o valor fuera de la muestra de voluntarios sanos. Stip et al. señalan que el método requiere evaluación en disfunción renal.`,
    });
  }

  const tau = dosing.dosingIntervalHours || 24;
  const expKTau = Math.exp(-kePerHour * tau);

  let predictedDailyDoseMg: number | null = null;
  if (dosing.targetCssMmolL !== null && dosing.targetCssMmolL > 0) {
    const dMmolPerInterval = (dosing.targetCssMmolL * vdL * (1 - expKTau)) / (1.0 * expKTau);
    const dMgPerInterval = mmolLiToMgLi2Co3(dMmolPerInterval);
    predictedDailyDoseMg = dMgPerInterval * (24 / tau);
  }

  let predictedCssMmolL: number | null = null;
  if (dosing.dailyDoseMg !== null && dosing.dailyDoseMg > 0) {
    const dosePerIntervalMmol = mgLi2Co3ToMmol(dosing.dailyDoseMg * (tau / 24));
    predictedCssMmolL = (1.0 * dosePerIntervalMmol * expKTau) / (vdL * (1 - expKTau));
  }

  return {
    modelId: 'pepin',
    modelName: 'Pepin / Stip et al. (2001)',
    citationShort: 'Stip et al., J Psychiatry Neurosci 2001;26(4):330–335',
    canCalculateClearance: true,
    canCalculateDoseOrCss: predictedCssMmolL !== null || predictedDailyDoseMg !== null,
    missingForClearance: [],
    missingForDoseOrCss: [],
    crClMlMin,
    crClLh,
    ibwKg,
    bmiKgM2: bmi,
    scrCorrectedMgDl: scrMgDl,
    liClMlMin,
    liClLh,
    liClLday,
    vdL,
    vdSourceNote: 'V_app nativo de Pepin = Cl_Li (L/h) / k (h⁻¹)',
    tHalfHours,
    kePerHour,
    predictedCssMmolL,
    predictedDailyDoseMg,
    secondaryMetrics: [
      { label: 'Peso ideal (IBW)', value: ibwKg.toFixed(2), unit: 'kg' },
      { label: 'V_app (Pepin)', value: vdL.toFixed(2), unit: 'L' },
      { label: 't½ eliminado', value: tHalfHours.toFixed(2), unit: 'h' },
      { label: 'k (0,693 / t½)', value: kePerHour.toFixed(5), unit: 'h⁻¹' },
    ],
    validationIssues: issues,
    isWithinValidatedPopulation:
      !outOfPop &&
      !patient.flags.acuteKidneyInjury &&
      !patient.flags.extracorporealRemoval &&
      !patient.flags.interactingMedications,
  };
}

export interface BenchmarkCase {
  id: string;
  title: string;
  subtitle: string;
  sourcePaper: string;
  expectedSummary: string;
  patient: PatientInputs;
  dosing: DosingInputs;
}

export const ARTICLE_BENCHMARK_CASES: BenchmarkCase[] = [
  {
    id: 'stip_p1',
    title: 'Stip et al. (2001) — Paciente 1 (Tabla 1)',
    subtitle: 'Voluntario sano varón · 31 años · 1,76 m · SCr 0,87 mg/dL',
    sourcePaper: 'Stip et al. (2001), Table 1, Subject #1 (p. 333)',
    expectedSummary:
      'IBW esperado: 71,37 kg · Cl_Li esperado: 29,18 mL/min · Dosis Pepin (Css 0,8 mmol/L, τ=24 h): 1960 mg/día',
    patient: {
      age: 31,
      sex: 'male',
      weightKg: 71.37,
      heightCm: 176,
      scrValue: 0.87,
      scrUnit: 'mg/dL',
      bunValue: 4.5,
      bunUnit: 'mmol/L',
      setting: 'outpatient',
      concomitantTca: false,
      flags: {
        acuteKidneyInjury: false,
        extracorporealRemoval: false,
        severeNeurotoxicity: false,
        interactingMedications: false,
        sodiumRestrictedDiet: false,
        nonAdherenceSuspected: false,
      },
    },
    dosing: {
      dailyDoseMg: 1950,
      targetCssMmolL: 0.8,
      dosingIntervalHours: 24,
      lastDoseTimeIso: '2026-11-18T08:00',
    },
  },
  {
    id: 'stip_p8',
    title: 'Stip et al. (2001) — Paciente 8 (Tabla 1)',
    subtitle: 'Voluntaria sana mujer · 29 años · 1,70 m · SCr 0,87 mg/dL',
    sourcePaper: 'Stip et al. (2001), Table 1, Subject #8 (p. 333)',
    expectedSummary:
      'IBW esperado: 61,44 kg · Cl_Li esperado: 21,75 mL/min · Dosis Pepin (Css 0,8 mmol/L, τ=24 h): 1299 mg/día',
    patient: {
      age: 29,
      sex: 'female',
      weightKg: 61.44,
      heightCm: 170,
      scrValue: 0.87,
      scrUnit: 'mg/dL',
      bunValue: 4.2,
      bunUnit: 'mmol/L',
      setting: 'outpatient',
      concomitantTca: false,
      flags: {
        acuteKidneyInjury: false,
        extracorporealRemoval: false,
        severeNeurotoxicity: false,
        interactingMedications: false,
        sodiumRestrictedDiet: false,
        nonAdherenceSuspected: false,
      },
    },
    dosing: {
      dailyDoseMg: 1350,
      targetCssMmolL: 0.8,
      dosingIntervalHours: 24,
      lastDoseTimeIso: '2026-11-18T08:00',
    },
  },
  {
    id: 'motoki_mean',
    title: 'Motoki et al. (2016) — Perfil medio cohorte (Tabla 1)',
    subtitle: 'Varón 52 años · 59,3 kg · SCr 0,80 mg/dL · Ccr ≈ 90,4 mL/min',
    sourcePaper: 'Motoki et al. (2016), Table 1 & Eq. 6 (p. 2–3)',
    expectedSummary:
      'Ccr ≈ 90,6 mL/min → Li-CL = 0,161×Ccr + 6,47 ≈ 21,06 mL/min (cohorte: Ccr 90,4 mL/min → 21,02 mL/min; Css medio 0,59 mmol/L con ~594 mg/día)',
    patient: {
      age: 52,
      sex: 'male',
      weightKg: 59.3,
      heightCm: 168,
      scrValue: 0.8,
      scrUnit: 'mg/dL',
      bunValue: 4.1,
      bunUnit: 'mmol/L',
      setting: 'outpatient',
      concomitantTca: false,
      flags: {
        acuteKidneyInjury: false,
        extracorporealRemoval: false,
        severeNeurotoxicity: false,
        interactingMedications: false,
        sodiumRestrictedDiet: false,
        nonAdherenceSuspected: false,
      },
    },
    dosing: {
      dailyDoseMg: 600,
      targetCssMmolL: 0.6,
      dosingIntervalHours: 12,
      lastDoseTimeIso: '2026-11-18T08:00',
    },
  },
  {
    id: 'abou_auda_inpatient',
    title: 'Abou-Auda et al. (2008) — Perfil típico hospitalizado',
    subtitle: 'Varón 39 años · 71,4 kg · SCr 0,92 mg/dL · BUN 4,06 mmol/L (11,36 mg/dL)',
    sourcePaper: 'Abou-Auda et al. (2008), p. 371 & 373 (cohort averages)',
    expectedSummary:
      'CL_Cr ≈ 108,8 mL/min (6,53 L/h) → CL_Li (hosp.) = 0,932 + 0,185×6,53 = 2,14 L/h (media observada en estudio: 2,09 L/h; dosis media ~1016 mg/día)',
    patient: {
      age: 39,
      sex: 'male',
      weightKg: 71.4,
      heightCm: 173,
      scrValue: 0.92,
      scrUnit: 'mg/dL',
      bunValue: 4.06,
      bunUnit: 'mmol/L',
      setting: 'inpatient',
      concomitantTca: false,
      flags: {
        acuteKidneyInjury: false,
        extracorporealRemoval: false,
        severeNeurotoxicity: false,
        interactingMedications: false,
        sodiumRestrictedDiet: false,
        nonAdherenceSuspected: false,
      },
    },
    dosing: {
      dailyDoseMg: 1000,
      targetCssMmolL: 0.6,
      dosingIntervalHours: 12,
      lastDoseTimeIso: '2026-11-18T08:00',
    },
  },
];
