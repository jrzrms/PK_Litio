import React, { useMemo, useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, BookOpen, FlaskConical } from 'lucide-react';
import {
  DosingInputs,
  ModelCalculationResult,
  ModelId,
  PatientInputs,
  TimeSeriesPoint,
  VdAssumptionMode,
} from '../types/pk';
import { MODEL_SPECS, calculatePepin } from '../pk/models';
import { buildSingleModelRegimenCurve } from '../pk/simulator';
import { formatIsoShort } from '../pk/unitConversions';
import { PkChart } from './PkChart';

interface ModelDetailViewProps {
  modelId: ModelId;
  patient: PatientInputs;
  dosing: DosingInputs;
  onChangeDosing: (next: DosingInputs) => void;
  result: ModelCalculationResult;
  vdAssumption: VdAssumptionMode;
  manualVdL: number | null;
  onChangeVdAssumption: (mode: VdAssumptionMode, manualVd: number | null) => void;
  onLoadBenchmark: (caseId: string) => void;
}

export const ModelDetailView: React.FC<ModelDetailViewProps> = ({
  modelId,
  patient,
  dosing,
  onChangeDosing,
  result,
  vdAssumption,
  manualVdL,
  onChangeVdAssumption,
  onLoadBenchmark,
}) => {
  const spec = MODEL_SPECS[modelId];
  const pepinBase = useMemo(() => calculatePepin(patient, dosing), [patient, dosing]);

  const [initialConcMmolL, setInitialConcMmolL] = useState<number>(0);
  const [simHorizonHours, setSimHorizonHours] = useState<number>(120);
  const [stopDoseAfterHours, setStopDoseAfterHours] = useState<number | null>(null);
  const [compareDoseMg, setCompareDoseMg] = useState<number | null>(null);

  // Determine effective Vd & ke for single-model time-course simulation
  const { effectiveVdL, effectiveKe, effectiveTHalf, vdNote } = useMemo(() => {
    if (!result.canCalculateClearance || !result.liClLh) {
      return { effectiveVdL: null, effectiveKe: null, effectiveTHalf: null, vdNote: null };
    }
    if (modelId === 'pepin') {
      return {
        effectiveVdL: result.vdL,
        effectiveKe: result.kePerHour,
        effectiveTHalf: result.tHalfHours,
        vdNote: 'V_app nativo de Pepin/Stip (Cl_Li / k)',
      };
    }
    if (vdAssumption === 'manual_vd' && manualVdL && manualVdL > 0) {
      const ke = result.liClLh / manualVdL;
      return {
        effectiveVdL: manualVdL,
        effectiveKe: ke,
        effectiveTHalf: 0.693 / ke,
        vdNote: `Vd manual introducido (${manualVdL.toFixed(1)} L)`,
      };
    }
    if (vdAssumption === 'pepin_vapp' && pepinBase.vdL && pepinBase.vdL > 0) {
      const ke = result.liClLh / pepinBase.vdL;
      return {
        effectiveVdL: pepinBase.vdL,
        effectiveKe: ke,
        effectiveTHalf: 0.693 / ke,
        vdNote: `Vd acoplado a V_app de Pepin/Stip (${pepinBase.vdL.toFixed(1)} L; Motoki/Abou-Auda no derivan Vd propio)`,
      };
    }
    return {
      effectiveVdL: null,
      effectiveKe: null,
      effectiveTHalf: null,
      vdNote: 'Seleccione Vd (V_app de Pepin o Vd manual) para proyectar la curva C(t)',
    };
  }, [modelId, result, vdAssumption, manualVdL, pepinBase.vdL]);

  const { chartPoints, intervalSnapshots } = useMemo(() => {
    if (!effectiveVdL || !effectiveKe || !dosing.dailyDoseMg || dosing.dailyDoseMg <= 0) {
      return { chartPoints: [] as TimeSeriesPoint[], intervalSnapshots: [] as Array<{ hour: number; timestampIso: string; concA: number; concB: number | null }> };
    }
    const baseIso = dosing.lastDoseTimeIso || '2026-11-18T08:00';
    const curveA = buildSingleModelRegimenCurve({
      startIso: baseIso,
      initialConcMmolL,
      dailyDoseMg: dosing.dailyDoseMg,
      intervalHours: dosing.dosingIntervalHours,
      kePerHour: effectiveKe,
      vdL: effectiveVdL,
      totalHours: simHorizonHours,
      stopAfterHours: stopDoseAfterHours,
    });

    const curveB =
      compareDoseMg && compareDoseMg > 0
        ? buildSingleModelRegimenCurve({
            startIso: baseIso,
            initialConcMmolL,
            dailyDoseMg: compareDoseMg,
            intervalHours: dosing.dosingIntervalHours,
            kePerHour: effectiveKe,
            vdL: effectiveVdL,
            totalHours: simHorizonHours,
            stopAfterHours: stopDoseAfterHours,
          })
        : null;

    const pts: TimeSeriesPoint[] = curveA.map((pt, idx) => {
      const bMatch = curveB?.[idx];
      const base: TimeSeriesPoint = {
        timeHoursFromRef: pt.hour,
        timestampIso: pt.timestampIso,
      };
      if (modelId === 'motoki') {
        base.motokiA = pt.conc;
        base.motokiB = bMatch ? bMatch.conc : null;
      } else if (modelId === 'abouAuda') {
        base.abouAudaA = pt.conc;
        base.abouAudaB = bMatch ? bMatch.conc : null;
      } else {
        base.pepinA = pt.conc;
        base.pepinB = bMatch ? bMatch.conc : null;
      }
      return base;
    });

    const targetHours = [0, 6, 12, 24, 36, 48, 72, 96, 120].filter((h) => h <= simHorizonHours);
    const snaps = targetHours.map((h) => {
      const matchA = curveA.find((c) => Math.abs(c.hour - h) < 0.05);
      const matchB = curveB?.find((c) => Math.abs(c.hour - h) < 0.05);
      return {
        hour: h,
        timestampIso: matchA?.timestampIso ?? baseIso,
        concA: matchA?.conc ?? 0,
        concB: matchB ? matchB.conc : null,
      };
    });

    return { chartPoints: pts, intervalSnapshots: snaps };
  }, [effectiveVdL, effectiveKe, dosing, initialConcMmolL, simHorizonHours, stopDoseAfterHours, compareDoseMg, modelId]);

  const benchmarkMap: Record<ModelId, string> = {
    motoki: 'motoki_mean',
    abouAuda: 'abou_auda_inpatient',
    pepin: 'stip_p1',
  };

  return (
    <div className="space-y-6">
      {/* Header block */}
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-slate-500">
              {spec.doiOrJournal} · Ecuación científica original
            </p>
            <h1 className="font-display text-xl sm:text-2xl font-bold text-slate-900">
              {spec.shortTitle}
            </h1>
            <p className="text-sm text-slate-600 max-w-3xl leading-relaxed">
              {spec.populationSummary}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onLoadBenchmark(benchmarkMap[modelId])}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
          >
            <FlaskConical className="h-3.5 w-3.5 text-blue-700" aria-hidden="true" />
            <span>Cargar ejemplo del artículo</span>
          </button>
        </div>

        {/* Original Equations & Variables */}
        <div className="mt-5 grid grid-cols-1 xl:grid-cols-2 gap-4 border-t border-slate-100 pt-4">
          <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
            <h2 className="text-xs font-semibold text-slate-800 mb-2">
              Ecuaciones originales publicadas
            </h2>
            <div className="space-y-1.5 font-mono text-xs text-slate-900 leading-relaxed">
              {spec.originalEquationLines.map((line, i) => (
                <div key={i} className="rounded bg-white px-2.5 py-1.5 border border-slate-200/80">
                  {line}
                </div>
              ))}
            </div>
            <div className="mt-3 space-y-1">
              <p className="text-[11px] font-semibold text-slate-700">
                Verificación dimensional:
              </p>
              {spec.dimensionalCheck.map((d, i) => (
                <p key={i} className="text-[11px] text-slate-600">
                  · {d}
                </p>
              ))}
            </div>
          </div>

          <div className="rounded-md border border-slate-200 bg-white p-4">
            <h2 className="text-xs font-semibold text-slate-800 mb-2">
              Definición de variables y unidades
            </h2>
            <dl className="divide-y divide-slate-100 text-xs">
              {spec.variables.map((v) => (
                <div key={v.symbol} className="py-2 flex items-start justify-between gap-3">
                  <div>
                    <dt className="font-mono font-semibold text-slate-900">
                      {v.symbol}{' '}
                      <span className="font-sans font-normal text-slate-600">({v.name})</span>
                    </dt>
                    <dd className="text-slate-500 mt-0.5">{v.description}</dd>
                  </div>
                  <span className="font-mono text-[11px] text-slate-500 whitespace-nowrap shrink-0">
                    {v.unit}
                  </span>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>

      {/* Missing inputs or Primary PK Outputs */}
      {!result.canCalculateClearance ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <h2 className="text-sm font-semibold text-amber-900">
                Parámetros obligatorios pendientes para {result.modelName}
              </h2>
              <p className="mt-1 text-xs text-amber-800">
                Introduzca los siguientes datos en el panel izquierdo para ejecutar el cálculo
                exacto sin supuestos arbitrarios:{' '}
                <strong>{result.missingForClearance.join(' · ')}</strong>.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* KPI Output Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-500">Aclaramiento de creatinina (CG)</p>
              <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-slate-900">
                {result.crClMlMin?.toFixed(1)}
                <span className="ml-1.5 text-xs font-normal text-slate-500">mL/min</span>
              </p>
              <p className="mt-1 font-mono text-xs tabular-nums text-slate-500">
                {result.crClLh?.toFixed(2)} L/h {result.ibwKg ? `· IBW ${result.ibwKg.toFixed(1)} kg` : '· peso total'}
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-500">Aclaramiento de litio estimado</p>
              <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-blue-700">
                {result.liClMlMin?.toFixed(2)}
                <span className="ml-1.5 text-xs font-normal text-slate-500">mL/min</span>
              </p>
              <p className="mt-1 font-mono text-xs tabular-nums text-slate-500">
                {result.liClLh?.toFixed(3)} L/h · {result.liClLday?.toFixed(1)} L/día
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-500">
                Css estimada (para {dosing.dailyDoseMg ?? '—'} mg/día)
              </p>
              <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-slate-900">
                {result.predictedCssMmolL !== null ? result.predictedCssMmolL.toFixed(2) : '—'}
                <span className="ml-1.5 text-xs font-normal text-slate-500">mmol/L</span>
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {modelId === 'pepin' ? `Valle τ=${dosing.dosingIntervalHours} h` : 'Media en estado estacionario'}
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-500">
                Dosis estimada (para {dosing.targetCssMmolL ?? '—'} mmol/L)
              </p>
              <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-slate-900">
                {result.predictedDailyDoseMg !== null
                  ? Math.round(result.predictedDailyDoseMg)
                  : '—'}
                <span className="ml-1.5 text-xs font-normal text-slate-500">mg/día</span>
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {modelId === 'abouAuda' && result.missingForDoseOrCss.length > 0
                  ? 'Falta BUN: mostrando alternativa'
                  : 'Carbonato de litio (Li₂CO₃)'}
              </p>
            </div>
          </div>

          {/* Secondary metrics if any */}
          {result.secondaryMetrics.length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h3 className="text-xs font-semibold text-slate-700 mb-3">
                Parámetros derivados específicos del modelo
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {result.secondaryMetrics.map((m) => (
                  <div key={m.label} className="rounded-md bg-slate-50 border border-slate-200/80 px-3 py-2">
                    <p className="text-[11px] text-slate-500">{m.label}</p>
                    <p className="font-mono text-base font-semibold tabular-nums text-slate-900 mt-0.5">
                      {m.value}{' '}
                      <span className="text-xs font-normal text-slate-500">{m.unit}</span>
                    </p>
                    {m.note && <p className="text-[11px] text-slate-500 mt-0.5">{m.note}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Regimen & Sensitivity Controls */}
          <div className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h2 className="font-display text-sm font-semibold text-slate-900">
                  Simulación de pauta y comparación de escenarios
                </h2>
                <p className="text-xs text-slate-500">
                  Modifique la dosis, intervalo o concentración inicial para visualizar la evolución temporal estimada.
                </p>
              </div>
              {effectiveTHalf && (
                <div className="font-mono text-xs tabular-nums text-slate-700">
                  t½ = <strong>{effectiveTHalf.toFixed(1)} h</strong> · ke ={' '}
                  <strong>{effectiveKe?.toFixed(4)} h⁻¹</strong> · Vd ={' '}
                  <strong>{effectiveVdL?.toFixed(1)} L</strong>
                </div>
              )}
            </div>

            {modelId !== 'pepin' && (
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 space-y-2">
                <p className="font-semibold text-slate-800">
                  Supuesto explícito para Volumen de Distribución (Vd) en curva C(t):
                </p>
                <p className="text-slate-600">
                  El artículo de {result.modelName} solo deriva CL_Li y Css; no publica ecuación de Vd. Para construir la gráfica temporal C(t), seleccione explícitamente el Vd de referencia:
                </p>
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <label className="inline-flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name={`vd-${modelId}`}
                      checked={vdAssumption === 'pepin_vapp'}
                      onChange={() => onChangeVdAssumption('pepin_vapp', manualVdL)}
                    />
                    <span>
                      Usar V_app de Pepin/Stip ({pepinBase.vdL ? `${pepinBase.vdL.toFixed(1)} L` : 'requiere talla'})
                    </span>
                  </label>
                  <label className="inline-flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name={`vd-${modelId}`}
                      checked={vdAssumption === 'manual_vd'}
                      onChange={() => onChangeVdAssumption('manual_vd', manualVdL)}
                    />
                    <span>Vd manual (L):</span>
                  </label>
                  {vdAssumption === 'manual_vd' && (
                    <input
                      type="number"
                      min={10}
                      max={150}
                      step={1}
                      value={manualVdL ?? ''}
                      onChange={(e) =>
                        onChangeVdAssumption(
                          'manual_vd',
                          e.target.value ? Number(e.target.value) : null
                        )
                      }
                      placeholder="Ej. 45"
                      className="w-24 rounded border border-slate-300 bg-white px-2 py-1 font-mono text-xs tabular-nums"
                    />
                  )}
                </div>
                {vdNote && <p className="text-[11px] text-slate-500">{vdNote}</p>}
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Dosis habitual / Escenario A (mg/día)
                </label>
                <input
                  type="number"
                  min={0}
                  max={3600}
                  step={50}
                  value={dosing.dailyDoseMg ?? ''}
                  onChange={(e) =>
                    onChangeDosing({
                      ...dosing,
                      dailyDoseMg: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  placeholder="Ej. 900"
                  className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm font-mono tabular-nums"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Dosis comparativa B (mg/día)
                </label>
                <input
                  type="number"
                  min={0}
                  max={3600}
                  step={50}
                  value={compareDoseMg ?? ''}
                  onChange={(e) =>
                    setCompareDoseMg(e.target.value ? Number(e.target.value) : null)
                  }
                  placeholder="Opcional"
                  className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm font-mono tabular-nums"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Css objetivo (mmol/L)
                </label>
                <input
                  type="number"
                  min={0.1}
                  max={2.0}
                  step={0.05}
                  value={dosing.targetCssMmolL ?? ''}
                  onChange={(e) =>
                    onChangeDosing({
                      ...dosing,
                      targetCssMmolL: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  placeholder="Ej. 0,80"
                  className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm font-mono tabular-nums"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Intervalo (τ)
                </label>
                <select
                  value={dosing.dosingIntervalHours}
                  onChange={(e) =>
                    onChangeDosing({ ...dosing, dosingIntervalHours: Number(e.target.value) })
                  }
                  className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-mono"
                >
                  <option value={24}>c/ 24 h</option>
                  <option value={12}>c/ 12 h</option>
                  <option value={8}>c/ 8 h</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Litemia inicial t₀ (mmol/L)
                </label>
                <input
                  type="number"
                  min={0}
                  max={6}
                  step={0.05}
                  value={initialConcMmolL}
                  onChange={(e) => setInitialConcMmolL(Number(e.target.value) || 0)}
                  className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm font-mono tabular-nums"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Suspender tras (h, opc.)
                </label>
                <input
                  type="number"
                  min={0}
                  max={240}
                  step={12}
                  value={stopDoseAfterHours ?? ''}
                  onChange={(e) =>
                    setStopDoseAfterHours(e.target.value ? Number(e.target.value) : null)
                  }
                  placeholder="Sin suspensión"
                  className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm font-mono tabular-nums"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 text-xs">
              <span className="text-slate-600">Horizonte de gráfica:</span>
              {[72, 120, 168].map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setSimHorizonHours(h)}
                  className={`px-2.5 py-1 rounded font-mono ${
                    simHorizonHours === h
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {h}h
                </button>
              ))}
            </div>
          </div>

          {/* Chart */}
          <PkChart
            points={chartPoints}
            samples={[]}
            refIso={dosing.lastDoseTimeIso || '2026-11-18T08:00'}
            visibility={{
              motoki: modelId === 'motoki',
              abouAuda: modelId === 'abouAuda',
              pepin: modelId === 'pepin',
              empirical: false,
              scenarioB: Boolean(compareDoseMg && compareDoseMg > 0),
            }}
            title={`Evolución temporal estimada · ${result.modelName}`}
            subtitle={`Pauta A: ${dosing.dailyDoseMg ?? 0} mg/día c/${dosing.dosingIntervalHours} h${
              compareDoseMg ? ` · Pauta B (discontinua): ${compareDoseMg} mg/día` : ''
            }`}
          />

          {/* Interval predictions table */}
          {intervalSnapshots.length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
              <div className="border-b border-slate-200 px-4 py-3">
                <h3 className="font-display text-sm font-semibold text-slate-900">
                  Concentraciones estimadas por intervalo horario
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-2.5 font-medium">Hora</th>
                      <th className="px-4 py-2.5 font-medium">Fecha/hora</th>
                      <th className="px-4 py-2.5 font-medium text-right">
                        Estimada Pauta A (mmol/L)
                      </th>
                      {compareDoseMg ? (
                        <th className="px-4 py-2.5 font-medium text-right">
                          Estimada Pauta B (mmol/L)
                        </th>
                      ) : null}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
                    {intervalSnapshots.map((row) => (
                      <tr key={row.hour} className="hover:bg-slate-50/70">
                        <td className="px-4 py-2 text-slate-900">+{row.hour} h</td>
                        <td className="px-4 py-2 text-slate-600">
                          {formatIsoShort(row.timestampIso)}
                        </td>
                        <td className="px-4 py-2 text-right font-semibold text-slate-900">
                          {row.concA.toFixed(2)}
                        </td>
                        {compareDoseMg ? (
                          <td className="px-4 py-2 text-right text-slate-700">
                            {row.concB !== null ? row.concB.toFixed(2) : '—'}
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Population Validation & Limitations */}
      <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <h2 className="font-display text-sm font-semibold text-slate-900">
            Validación poblacional, criterios y referencia bibliográfica
          </h2>
          {result.canCalculateClearance && (
            <div
              className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                result.isWithinValidatedPopulation ? 'text-emerald-700' : 'text-amber-700'
              }`}
            >
              {result.isWithinValidatedPopulation ? (
                <>
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  <span>Dentro de población validada</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                  <span>Fuera de población validada / requiere cautela</span>
                </>
              )}
            </div>
          )}
        </div>

        {result.validationIssues.length > 0 && (
          <div className="space-y-2">
            {result.validationIssues.map((issue, idx) => (
              <div
                key={`${issue.code}-${idx}`}
                className={`rounded-md border p-3 text-xs flex items-start gap-2.5 ${
                  issue.severity === 'critical'
                    ? 'border-rose-200 bg-rose-50 text-rose-900'
                    : issue.severity === 'warning'
                      ? 'border-amber-200 bg-amber-50 text-amber-900'
                      : 'border-slate-200 bg-slate-50 text-slate-800'
                }`}
              >
                {issue.severity === 'critical' ? (
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-700 mt-0.5" aria-hidden="true" />
                ) : (
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-700 mt-0.5" aria-hidden="true" />
                )}
                <div>
                  <p className="font-semibold">{issue.title}</p>
                  <p className="mt-0.5 opacity-90">{issue.detail}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div>
            <h3 className="font-semibold text-slate-800 mb-1.5">Criterios de inclusión</h3>
            <ul className="space-y-1 text-slate-600 list-disc pl-4">
              {spec.inclusionCriteria.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-slate-800 mb-1.5">Criterios de exclusión</h3>
            <ul className="space-y-1 text-slate-600 list-disc pl-4">
              {spec.exclusionCriteria.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-slate-800 mb-1.5">Limitaciones descritas</h3>
            <ul className="space-y-1 text-slate-600 list-disc pl-4">
              {spec.limitations.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-3 flex items-start gap-2 text-xs text-slate-600">
          <BookOpen className="h-4 w-4 shrink-0 text-slate-500 mt-0.5" aria-hidden="true" />
          <p>
            <strong className="text-slate-800">Referencia bibliográfica:</strong> {spec.fullCitation}{' '}
            <span className="font-mono text-slate-500">({spec.doiOrJournal})</span>
          </p>
        </div>
      </div>
    </div>
  );
};
