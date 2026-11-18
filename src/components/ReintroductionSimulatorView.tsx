import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Plus,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import {
  DosingInputs,
  IntoxicationInputs,
  ModelCalculationResult,
  PatientInputs,
  VdAssumptionMode,
} from '../types/pk';
import {
  buildIntervalTable,
  buildReintroductionTimeSeries,
  fitEmpiricalWashout,
  ModelKineticParams,
} from '../pk/simulator';
import { diffHoursIso, formatIsoShort } from '../pk/unitConversions';
import { PkChart, SeriesVisibility } from './PkChart';

interface ReintroductionSimulatorViewProps {
  patient: PatientInputs;
  dosing: DosingInputs;
  intoxication: IntoxicationInputs;
  onChangeIntoxication: (next: IntoxicationInputs) => void;
  motokiResult: ModelCalculationResult;
  abouAudaResult: ModelCalculationResult;
  pepinResult: ModelCalculationResult;
  onLoadIntoxicationExample: () => void;
}

export const ReintroductionSimulatorView: React.FC<ReintroductionSimulatorViewProps> = ({
  patient,
  intoxication,
  onChangeIntoxication,
  motokiResult,
  abouAudaResult,
  pepinResult,
  onLoadIntoxicationExample,
}) => {
  const [visibility, setVisibility] = useState<SeriesVisibility>({
    motoki: true,
    abouAuda: true,
    pepin: true,
    empirical: true,
    scenarioB: true,
  });

  const empiricalFit = useMemo(
    () => fitEmpiricalWashout(intoxication.samples),
    [intoxication.samples]
  );

  // Resolve Vd and ke for each model based on explicit methodological choice
  const { motokiKinetics, abouAudaKinetics, pepinKinetics } = useMemo(() => {
    const pepinK: ModelKineticParams = {
      liClLh: pepinResult.liClLh,
      vdL: pepinResult.vdL,
      kePerHour: pepinResult.kePerHour,
      tHalfHours: pepinResult.tHalfHours,
    };

    const resolveOther = (res: ModelCalculationResult): ModelKineticParams => {
      if (!res.canCalculateClearance || !res.liClLh) {
        return { liClLh: null, vdL: null, kePerHour: null, tHalfHours: null };
      }
      if (intoxication.vdAssumption === 'manual_vd' && intoxication.manualVdL && intoxication.manualVdL > 0) {
        const ke = res.liClLh / intoxication.manualVdL;
        return { liClLh: res.liClLh, vdL: intoxication.manualVdL, kePerHour: ke, tHalfHours: 0.693 / ke };
      }
      if (intoxication.vdAssumption === 'observed_thalf' && empiricalFit.available && empiricalFit.kePerHour) {
        const derivedVd = res.liClLh / empiricalFit.kePerHour;
        return {
          liClLh: res.liClLh,
          vdL: derivedVd,
          kePerHour: empiricalFit.kePerHour,
          tHalfHours: empiricalFit.tHalfHours,
        };
      }
      // pepin_vapp default coupling
      if (pepinResult.vdL && pepinResult.vdL > 0) {
        const ke = res.liClLh / pepinResult.vdL;
        return { liClLh: res.liClLh, vdL: pepinResult.vdL, kePerHour: ke, tHalfHours: 0.693 / ke };
      }
      return { liClLh: res.liClLh, vdL: null, kePerHour: null, tHalfHours: null };
    };

    return {
      motokiKinetics: resolveOther(motokiResult),
      abouAudaKinetics: resolveOther(abouAudaResult),
      pepinKinetics: pepinK,
    };
  }, [motokiResult, abouAudaResult, pepinResult, intoxication.vdAssumption, intoxication.manualVdL, empiricalFit]);

  const seriesData = useMemo(
    () =>
      buildReintroductionTimeSeries({
        suspensionIso: intoxication.suspensionTimeIso,
        samples: intoxication.samples,
        horizonHours: intoxication.simulationHorizonHours,
        motoki: motokiKinetics,
        abouAuda: abouAudaKinetics,
        pepin: pepinKinetics,
        empirical: empiricalFit,
        scenarioA: intoxication.scenarioA,
        scenarioB: intoxication.scenarioB,
      }),
    [intoxication, motokiKinetics, abouAudaKinetics, pepinKinetics, empiricalFit]
  );

  const intervalRows = useMemo(
    () =>
      buildIntervalTable({
        anchorIso: seriesData.anchorIso,
        anchorConc: seriesData.anchorConc,
        horizonHours: intoxication.simulationHorizonHours,
        sortedSamples: seriesData.sortedSamples,
        motoki: motokiKinetics,
        abouAuda: abouAudaKinetics,
        pepin: pepinKinetics,
        empirical: empiricalFit,
        scenarioA: intoxication.scenarioA,
        scenarioB: intoxication.scenarioB,
      }),
    [seriesData, intoxication, motokiKinetics, abouAudaKinetics, pepinKinetics, empiricalFit]
  );

  const highestMeasured = useMemo(() => {
    const vals = intoxication.samples
      .map((s) => s.concentrationMmolL)
      .filter((v): v is number => v !== null && Number.isFinite(v));
    return vals.length > 0 ? Math.max(...vals) : null;
  }, [intoxication.samples]);

  const latestMeasured =
    seriesData.sortedSamples.length > 0
      ? seriesData.sortedSamples[seriesData.sortedSamples.length - 1]
      : null;

  const hoursSinceSuspension = latestMeasured
    ? diffHoursIso(intoxication.suspensionTimeIso, latestMeasured.timestampIso)
    : null;

  const addSample = () => {
    const last = intoxication.samples[intoxication.samples.length - 1];
    const nextIso = last?.timestampIso || intoxication.suspensionTimeIso;
    onChangeIntoxication({
      ...intoxication,
      samples: [
        ...intoxication.samples,
        {
          id: `sample-${Date.now()}`,
          timestampIso: nextIso,
          concentrationMmolL: null,
          label: `Muestra ${intoxication.samples.length + 1}`,
        },
      ],
    });
  };

  const removeSample = (id: string) => {
    if (intoxication.samples.length <= 1) return;
    onChangeIntoxication({
      ...intoxication,
      samples: intoxication.samples.filter((s) => s.id !== id),
    });
  };

  const updateSample = (id: string, patch: Partial<IntoxicationInputs['samples'][number]>) => {
    onChangeIntoxication({
      ...intoxication,
      samples: intoxication.samples.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    });
  };

  const severeClinicalAlert =
    (highestMeasured !== null && highestMeasured >= 1.5) ||
    patient.flags.acuteKidneyInjury ||
    patient.flags.extracorporealRemoval ||
    patient.flags.severeNeurotoxicity;

  return (
    <div className="space-y-6">
      {/* Clinical Decision Support & Safety Header */}
      <div
        className={`rounded-lg border p-4 sm:p-5 ${
          severeClinicalAlert
            ? 'border-rose-300 bg-rose-50/70'
            : 'border-slate-200 bg-white'
        }`}
      >
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="flex items-start gap-3">
            <ShieldAlert
              className={`h-5 w-5 shrink-0 mt-0.5 ${
                severeClinicalAlert ? 'text-rose-700' : 'text-amber-700'
              }`}
              aria-hidden="true"
            />
            <div className="space-y-1">
              <h1 className="font-display text-lg sm:text-xl font-bold text-slate-900">
                Simulador de lavado tras intoxicación y reintroducción de litio
              </h1>
              <p className="text-xs sm:text-sm text-slate-700 leading-relaxed max-w-4xl">
                <strong>Herramienta exclusivamente de apoyo a la decisión clínica.</strong> No
                sustituye al juicio médico ni farmacéutico hospitalario. Una litemia estimada o
                aislada en rango terapéutico <strong>nunca es criterio suficiente</strong> para
                reiniciar el tratamiento: deben valorarse la resolución completa de la neurotoxicidad,
                la estabilidad de la función renal, el estado hidrosalino, las interacciones
                farmacológicas y el riesgo de rebote intracelular.
              </p>
              {severeClinicalAlert && (
                <p className="text-xs font-semibold text-rose-800 pt-1">
                  Atención clínica prioritaria: presencia de litemia ≥ 1,50 mmol/L, fracaso renal
                  agudo, depuración extracorpórea o clínica neurológica grave. Requiere valoración
                  especializada (Nefrología / Toxicología / Psiquiatría) y determinaciones seriadas
                  reales antes de plantear cualquier reintroducción.
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onLoadIntoxicationExample}
            className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
          >
            Cargar caso clínico de ejemplo
          </button>
        </div>
      </div>

      {/* Intoxication History & Measured Samples */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <div className="xl:col-span-5 rounded-lg border border-slate-200 bg-white p-4 sm:p-5 space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="font-display text-sm font-semibold text-slate-900">
              1. Cronología de suspensión y litemias medidas
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Los puntos introducidos aquí se muestran como determinaciones medidas reales.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Fecha y hora de suspensión del litio
              </label>
              <input
                type="datetime-local"
                value={intoxication.suspensionTimeIso}
                onChange={(e) =>
                  onChangeIntoxication({ ...intoxication, suspensionTimeIso: e.target.value })
                }
                className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm font-mono tabular-nums"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Dosis previa a intoxicación (mg/día)
              </label>
              <input
                type="number"
                min={0}
                max={3600}
                step={50}
                value={intoxication.priorDailyDoseMg ?? ''}
                onChange={(e) =>
                  onChangeIntoxication({
                    ...intoxication,
                    priorDailyDoseMg: e.target.value ? Number(e.target.value) : null,
                  })
                }
                placeholder="Ej. 1200"
                className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm font-mono tabular-nums"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Pauta previa
              </label>
              <select
                value={intoxication.priorIntervalHours}
                onChange={(e) =>
                  onChangeIntoxication({
                    ...intoxication,
                    priorIntervalHours: Number(e.target.value),
                  })
                }
                className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-mono"
              >
                <option value={24}>Cada 24 h</option>
                <option value={12}>Cada 12 h</option>
                <option value={8}>Cada 8 h</option>
              </select>
            </div>
          </div>

          {/* Measured Lithium Levels Table */}
          <div className="space-y-2.5 border-t border-slate-100 pt-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-800">
                Concentraciones plasmáticas medidas (mmol/L)
              </span>
              <button
                type="button"
                onClick={addSample}
                className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-800 hover:bg-slate-50"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Añadir litemia</span>
              </button>
            </div>

            <div className="space-y-2">
              {intoxication.samples.map((s, idx) => (
                <div
                  key={s.id}
                  className="grid grid-cols-12 gap-2 items-center rounded-md border border-slate-200 bg-slate-50/70 p-2"
                >
                  <div className="col-span-6">
                    <label className="block text-[10px] text-slate-500 mb-0.5">
                      Extracción #{idx + 1}
                    </label>
                    <input
                      type="datetime-local"
                      value={s.timestampIso}
                      onChange={(e) => updateSample(s.id, { timestampIso: e.target.value })}
                      className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs font-mono tabular-nums"
                    />
                  </div>
                  <div className="col-span-4">
                    <label className="block text-[10px] text-slate-500 mb-0.5">
                      Litemia (mmol/L)
                    </label>
                    <input
                      type="number"
                      min={0.01}
                      max={10}
                      step={0.01}
                      value={s.concentrationMmolL ?? ''}
                      onChange={(e) =>
                        updateSample(s.id, {
                          concentrationMmolL: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                      placeholder="Ej. 2,15"
                      className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs font-mono tabular-nums"
                    />
                  </div>
                  <div className="col-span-2 flex justify-end pt-3">
                    <button
                      type="button"
                      onClick={() => removeSample(s.id)}
                      disabled={intoxication.samples.length <= 1}
                      aria-label={`Eliminar muestra ${idx + 1}`}
                      className="p-1.5 rounded text-slate-500 hover:text-rose-700 hover:bg-rose-50 disabled:opacity-30"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {empiricalFit.available && (
              <div className="rounded-md border border-orange-200 bg-orange-50/70 p-2.5 text-xs text-orange-900">
                <p className="font-semibold">
                  Cinética empírica observada ({empiricalFit.sampleCount} muestras seriadas):
                </p>
                <p className="font-mono tabular-nums mt-0.5">
                  t½ observado = {empiricalFit.tHalfHours?.toFixed(1)} h · ke_obs ={' '}
                  {empiricalFit.kePerHour?.toFixed(4)} h⁻¹ · R² ={' '}
                  {empiricalFit.rSquared?.toFixed(3)}
                </p>
              </div>
            )}
            {empiricalFit.warning && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900">
                {empiricalFit.warning}
              </div>
            )}
          </div>
        </div>

        {/* Reintroduction Scenarios & Methodological Vd Choice */}
        <div className="xl:col-span-7 rounded-lg border border-slate-200 bg-white p-4 sm:p-5 space-y-4">
          <div className="border-b border-slate-100 pb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-sm font-semibold text-slate-900">
                2. Escenarios de posible reintroducción y supuesto de Vd
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Compare dos fechas o dosis de reinicio simultáneamente en la gráfica y tabla.
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-600">Horizonte:</span>
              {[72, 120, 168].map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => onChangeIntoxication({ ...intoxication, simulationHorizonHours: h })}
                  className={`px-2 py-1 rounded font-mono ${
                    intoxication.simulationHorizonHours === h
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  +{h}h
                </button>
              ))}
            </div>
          </div>

          {/* Scenario A & B side by side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Scenario A */}
            <div className="rounded-md border border-slate-200 p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-blue-800">
                  Escenario A (Principal)
                </span>
                <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={intoxication.scenarioA.enabled}
                    onChange={(e) =>
                      onChangeIntoxication({
                        ...intoxication,
                        scenarioA: { ...intoxication.scenarioA, enabled: e.target.checked },
                      })
                    }
                  />
                  <span>Simular reinicio</span>
                </label>
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">
                  Fecha y hora propuesta de reinicio
                </label>
                <input
                  type="datetime-local"
                  disabled={!intoxication.scenarioA.enabled}
                  value={intoxication.scenarioA.restartTimeIso}
                  onChange={(e) =>
                    onChangeIntoxication({
                      ...intoxication,
                      scenarioA: { ...intoxication.scenarioA, restartTimeIso: e.target.value },
                    })
                  }
                  className="w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs font-mono tabular-nums disabled:bg-slate-100"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Dosis (mg/día)</label>
                  <input
                    type="number"
                    min={0}
                    max={3600}
                    step={50}
                    disabled={!intoxication.scenarioA.enabled}
                    value={intoxication.scenarioA.dailyDoseMg ?? ''}
                    onChange={(e) =>
                      onChangeIntoxication({
                        ...intoxication,
                        scenarioA: {
                          ...intoxication.scenarioA,
                          dailyDoseMg: e.target.value ? Number(e.target.value) : null,
                        },
                      })
                    }
                    placeholder="Ej. 400"
                    className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs font-mono tabular-nums disabled:bg-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Intervalo</label>
                  <select
                    disabled={!intoxication.scenarioA.enabled}
                    value={intoxication.scenarioA.dosingIntervalHours}
                    onChange={(e) =>
                      onChangeIntoxication({
                        ...intoxication,
                        scenarioA: {
                          ...intoxication.scenarioA,
                          dosingIntervalHours: Number(e.target.value),
                        },
                      })
                    }
                    className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-xs font-mono disabled:bg-slate-100"
                  >
                    <option value={24}>c/ 24 h</option>
                    <option value={12}>c/ 12 h</option>
                    <option value={8}>c/ 8 h</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Scenario B */}
            <div className="rounded-md border border-slate-200 p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-violet-800">
                  Escenario B (Comparación)
                </span>
                <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={intoxication.scenarioB.enabled}
                    onChange={(e) =>
                      onChangeIntoxication({
                        ...intoxication,
                        scenarioB: { ...intoxication.scenarioB, enabled: e.target.checked },
                      })
                    }
                  />
                  <span>Activar comparación</span>
                </label>
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">
                  Fecha y hora alternativa
                </label>
                <input
                  type="datetime-local"
                  disabled={!intoxication.scenarioB.enabled}
                  value={intoxication.scenarioB.restartTimeIso}
                  onChange={(e) =>
                    onChangeIntoxication({
                      ...intoxication,
                      scenarioB: { ...intoxication.scenarioB, restartTimeIso: e.target.value },
                    })
                  }
                  className="w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs font-mono tabular-nums disabled:bg-slate-100"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Dosis (mg/día)</label>
                  <input
                    type="number"
                    min={0}
                    max={3600}
                    step={50}
                    disabled={!intoxication.scenarioB.enabled}
                    value={intoxication.scenarioB.dailyDoseMg ?? ''}
                    onChange={(e) =>
                      onChangeIntoxication({
                        ...intoxication,
                        scenarioB: {
                          ...intoxication.scenarioB,
                          dailyDoseMg: e.target.value ? Number(e.target.value) : null,
                        },
                      })
                    }
                    placeholder="Ej. 300"
                    className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs font-mono tabular-nums disabled:bg-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Intervalo</label>
                  <select
                    disabled={!intoxication.scenarioB.enabled}
                    value={intoxication.scenarioB.dosingIntervalHours}
                    onChange={(e) =>
                      onChangeIntoxication({
                        ...intoxication,
                        scenarioB: {
                          ...intoxication.scenarioB,
                          dosingIntervalHours: Number(e.target.value),
                        },
                      })
                    }
                    className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-xs font-mono disabled:bg-slate-100"
                  >
                    <option value={24}>c/ 24 h</option>
                    <option value={12}>c/ 12 h</option>
                    <option value={8}>c/ 8 h</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Transparent Vd Methodological Selector */}
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs space-y-2">
            <p className="font-semibold text-slate-800">
              Transparencia metodológica sobre Vd para proyectar C(t) en Motoki (2016) y Abou-Auda (2008)
            </p>
            <p className="text-slate-600">
              Únicamente Pepin/Stip (Art. 3) define V_app. Para simular lavado y reintroducción con los aclaramiento de Motoki y Abou-Auda sin inventar coeficientes, seleccione el volumen de distribución:
            </p>
            <div className="flex flex-wrap items-center gap-4 pt-1">
              {(
                [
                  {
                    id: 'pepin_vapp' as VdAssumptionMode,
                    label: `V_app de Pepin/Stip (${pepinResult.vdL ? `${pepinResult.vdL.toFixed(1)} L` : 'requiere talla'})`,
                  },
                  {
                    id: 'manual_vd' as VdAssumptionMode,
                    label: 'Vd manual (L)',
                  },
                  {
                    id: 'observed_thalf' as VdAssumptionMode,
                    label: `Vd = CL_Li / ke_obs (${empiricalFit.available ? `t½ obs ${empiricalFit.tHalfHours?.toFixed(1)} h` : 'requiere ≥2 muestras'})`,
                  },
                ]
              ).map((opt) => (
                <label key={opt.id} className="inline-flex items-center gap-1.5 cursor-pointer text-slate-700">
                  <input
                    type="radio"
                    name="sim-vd-mode"
                    checked={intoxication.vdAssumption === opt.id}
                    onChange={() => onChangeIntoxication({ ...intoxication, vdAssumption: opt.id })}
                  />
                  <span>{opt.label}</span>
                </label>
              ))}

              {intoxication.vdAssumption === 'manual_vd' && (
                <input
                  type="number"
                  min={10}
                  max={150}
                  step={1}
                  value={intoxication.manualVdL ?? ''}
                  onChange={(e) =>
                    onChangeIntoxication({
                      ...intoxication,
                      manualVdL: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  placeholder="Vd (L)"
                  className="w-24 rounded border border-slate-300 bg-white px-2 py-1 font-mono text-xs tabular-nums"
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Model Kinetics & Population Validity Strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { res: motokiResult, kin: motokiKinetics, accent: 'text-blue-700' },
          { res: abouAudaResult, kin: abouAudaKinetics, accent: 'text-teal-700' },
          { res: pepinResult, kin: pepinKinetics, accent: 'text-indigo-700' },
        ].map(({ res, kin, accent }) => (
          <div key={res.modelId} className="rounded-lg border border-slate-200 bg-white p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className={`font-display text-sm font-semibold ${accent}`}>{res.modelName}</h3>
              {res.canCalculateClearance ? (
                <span
                  className={`inline-flex items-center gap-1 text-[11px] font-medium ${
                    res.isWithinValidatedPopulation ? 'text-emerald-700' : 'text-amber-700'
                  }`}
                >
                  {res.isWithinValidatedPopulation ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Población validada</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Fuera de validación</span>
                    </>
                  )}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] text-rose-700">
                  <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Faltan datos</span>
                </span>
              )}
            </div>

            {res.canCalculateClearance ? (
              <div className="grid grid-cols-3 gap-2 font-mono tabular-nums text-xs pt-1">
                <div>
                  <span className="block text-[10px] font-sans text-slate-500">CL_Li</span>
                  <span className="font-semibold text-slate-900">
                    {res.liClMlMin?.toFixed(1)} mL/min
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] font-sans text-slate-500">t½ est.</span>
                  <span className="font-semibold text-slate-900">
                    {kin.tHalfHours ? `${kin.tHalfHours.toFixed(1)} h` : '—'}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] font-sans text-slate-500">Vd usado</span>
                  <span className="font-semibold text-slate-900">
                    {kin.vdL ? `${kin.vdL.toFixed(1)} L` : '—'}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                Requiere: {res.missingForClearance.join(', ')}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Series Toggles + Chart */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs">
          <div className="flex flex-wrap items-center gap-4">
            <span className="font-semibold text-slate-700">Series visibles:</span>
            {(
              [
                { key: 'motoki', label: 'Motoki (2016)', color: 'text-blue-700' },
                { key: 'abouAuda', label: 'Abou-Auda (2008)', color: 'text-teal-700' },
                { key: 'pepin', label: 'Pepin / Stip (2001)', color: 'text-indigo-700' },
                { key: 'empirical', label: 'Ajuste empírico (≥2 litemias)', color: 'text-orange-700' },
                { key: 'scenarioB', label: 'Escenario B (discontinua)', color: 'text-slate-700' },
              ] as const
            ).map((item) => (
              <label key={item.key} className={`inline-flex items-center gap-1.5 cursor-pointer font-medium ${item.color}`}>
                <input
                  type="checkbox"
                  checked={visibility[item.key]}
                  onChange={(e) => setVisibility({ ...visibility, [item.key]: e.target.checked })}
                />
                <span>{item.label}</span>
              </label>
            ))}
          </div>
          {latestMeasured && hoursSinceSuspension !== null && Number.isFinite(hoursSinceSuspension) && (
            <span className="font-mono tabular-nums text-slate-600">
              Última litemia medida: {latestMeasured.concentrationMmolL?.toFixed(2)} mmol/L (
              {hoursSinceSuspension >= 0 ? `+${hoursSinceSuspension.toFixed(1)} h` : `${hoursSinceSuspension.toFixed(1)} h`} desde suspensión)
            </span>
          )}
        </div>

        <PkChart
          points={seriesData.points}
          samples={seriesData.sortedSamples}
          refIso={seriesData.refIso}
          suspensionIso={intoxication.suspensionTimeIso}
          anchorIso={seriesData.anchorIso}
          restartAIso={intoxication.scenarioA.restartTimeIso}
          restartAEnabled={intoxication.scenarioA.enabled}
          restartBIso={intoxication.scenarioB.restartTimeIso}
          restartBEnabled={intoxication.scenarioB.enabled}
          visibility={visibility}
          title="Simulación comparativa de lavado y reintroducción de litio"
          subtitle="Marcadores rombo negros = concentraciones MEDIDAS reales · Líneas = concentraciones ESTIMADAS por modelo"
        />
      </div>

      {/* Comparative Hourly Predictions Table */}
      {intervalRows.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          <div className="border-b border-slate-200 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-display text-sm font-semibold text-slate-900">
                Tabla horaria comparativa (Medida vs. Estimada · Escenarios A y B)
              </h3>
              <p className="text-xs text-slate-500">
                Valores en mmol/L (mEq/L). La columna «Medida real» muestra determinaciones de laboratorio cuando coinciden con el tiempo de la fila.
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2.5 font-medium">Desde última muestra</th>
                  <th className="px-3 py-2.5 font-medium">Fecha / hora</th>
                  <th className="px-3 py-2.5 font-medium">Fase</th>
                  <th className="px-3 py-2.5 font-medium text-right">Medida real</th>
                  <th className="px-3 py-2.5 font-medium text-right text-blue-800">Motoki A</th>
                  <th className="px-3 py-2.5 font-medium text-right text-teal-800">Abou-Auda A</th>
                  <th className="px-3 py-2.5 font-medium text-right text-indigo-800">Pepin A</th>
                  {empiricalFit.available && (
                    <th className="px-3 py-2.5 font-medium text-right text-orange-800">Empírico A</th>
                  )}
                  {intoxication.scenarioB.enabled && (
                    <>
                      <th className="px-3 py-2.5 font-medium text-right text-blue-700">Motoki B</th>
                      <th className="px-3 py-2.5 font-medium text-right text-teal-700">Abou-Auda B</th>
                      <th className="px-3 py-2.5 font-medium text-right text-indigo-700">Pepin B</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
                {intervalRows.map((row) => (
                  <tr key={row.timeHoursFromLastSample} className="hover:bg-slate-50/80">
                    <td className="px-3 py-2 text-slate-900 font-medium">
                      +{row.timeHoursFromLastSample} h
                    </td>
                    <td className="px-3 py-2 text-slate-600">{formatIsoShort(row.timestampIso)}</td>
                    <td className="px-3 py-2 font-sans text-slate-700 capitalize">{row.phase}</td>
                    <td className="px-3 py-2 text-right font-semibold text-slate-900 bg-slate-50/70">
                      {row.measuredValue !== null ? `${row.measuredValue.toFixed(2)} (Med)` : '—'}
                    </td>
                    <td className="px-3 py-2 text-right text-blue-700">
                      {row.motokiA !== null ? row.motokiA.toFixed(2) : '—'}
                    </td>
                    <td className="px-3 py-2 text-right text-teal-700">
                      {row.abouAudaA !== null ? row.abouAudaA.toFixed(2) : '—'}
                    </td>
                    <td className="px-3 py-2 text-right text-indigo-700">
                      {row.pepinA !== null ? row.pepinA.toFixed(2) : '—'}
                    </td>
                    {empiricalFit.available && (
                      <td className="px-3 py-2 text-right text-orange-700">
                        {row.empiricalA !== null ? row.empiricalA.toFixed(2) : '—'}
                      </td>
                    )}
                    {intoxication.scenarioB.enabled && (
                      <>
                        <td className="px-3 py-2 text-right text-blue-600">
                          {row.motokiB !== null ? row.motokiB.toFixed(2) : '—'}
                        </td>
                        <td className="px-3 py-2 text-right text-teal-600">
                          {row.abouAudaB !== null ? row.abouAudaB.toFixed(2) : '—'}
                        </td>
                        <td className="px-3 py-2 text-right text-indigo-600">
                          {row.pepinB !== null ? row.pepinB.toFixed(2) : '—'}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
