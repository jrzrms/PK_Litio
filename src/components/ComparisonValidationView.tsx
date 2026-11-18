import React from 'react';
import { AlertTriangle, BookOpen, CheckCircle2, FlaskConical } from 'lucide-react';
import {
  DosingInputs,
  ModelCalculationResult,
  PatientInputs,
} from '../types/pk';
import {
  ARTICLE_BENCHMARK_CASES,
  calculateAbouAuda,
  calculateMotoki,
  calculatePepin,
  MODEL_SPECS,
} from '../pk/models';

interface ComparisonValidationViewProps {
  patient: PatientInputs;
  dosing: DosingInputs;
  motokiResult: ModelCalculationResult;
  abouAudaResult: ModelCalculationResult;
  pepinResult: ModelCalculationResult;
  onLoadBenchmark: (caseId: string) => void;
}

export const ComparisonValidationView: React.FC<ComparisonValidationViewProps> = ({
  dosing,
  motokiResult,
  abouAudaResult,
  pepinResult,
  onLoadBenchmark,
}) => {
  const results = [motokiResult, abouAudaResult, pepinResult];

  return (
    <div className="space-y-6">
      {/* Side-by-side comparison for current patient */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <div className="border-b border-slate-200 p-4 sm:p-5">
          <h1 className="font-display text-lg sm:text-xl font-bold text-slate-900">
            Comparativa de los tres modelos y verificación con los artículos
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Evaluación simultánea de resultados farmacocinéticos, criterios poblacionales y
            comprobación numérica directa frente a los casos publicados en la literatura.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700">
              <tr>
                <th className="px-4 py-3 font-semibold">Parámetro / Criterio</th>
                <th className="px-4 py-3 font-semibold text-blue-800">Motoki et al. (2016)</th>
                <th className="px-4 py-3 font-semibold text-teal-800">Abou-Auda et al. (2008)</th>
                <th className="px-4 py-3 font-semibold text-indigo-800">Pepin / Stip et al. (2001)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td className="px-4 py-2.5 font-medium text-slate-700">Base de peso en Cockcroft-Gault</td>
                <td className="px-4 py-2.5 text-slate-800">Peso total (TBW) · SCr &lt; 0,6 → 0,6</td>
                <td className="px-4 py-2.5 text-slate-800">Peso total (TBW) · sin tope SCr</td>
                <td className="px-4 py-2.5 text-slate-800">Peso corporal ideal (IBW)</td>
              </tr>
              <tr>
                <td className="px-4 py-2.5 font-medium text-slate-700">Ccr estimado</td>
                {results.map((r) => (
                  <td key={r.modelId} className="px-4 py-2.5 font-mono tabular-nums text-slate-900">
                    {r.crClMlMin !== null ? `${r.crClMlMin.toFixed(1)} mL/min (${r.crClLh?.toFixed(2)} L/h)` : 'Pendiente'}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="px-4 py-2.5 font-medium text-slate-700">CL_Li estimado</td>
                {results.map((r) => (
                  <td key={r.modelId} className="px-4 py-2.5 font-mono tabular-nums font-semibold text-slate-900">
                    {r.liClMlMin !== null ? `${r.liClMlMin.toFixed(2)} mL/min (${r.liClLh?.toFixed(3)} L/h)` : 'Pendiente'}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="px-4 py-2.5 font-medium text-slate-700">
                  Css estimada ({dosing.dailyDoseMg ?? '—'} mg/día)
                </td>
                {results.map((r) => (
                  <td key={r.modelId} className="px-4 py-2.5 font-mono tabular-nums text-slate-900">
                    {r.predictedCssMmolL !== null ? `${r.predictedCssMmolL.toFixed(2)} mmol/L` : '—'}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="px-4 py-2.5 font-medium text-slate-700">
                  Dosis estimada (objetivo {dosing.targetCssMmolL ?? '—'} mmol/L)
                </td>
                {results.map((r) => (
                  <td key={r.modelId} className="px-4 py-2.5 font-mono tabular-nums text-slate-900">
                    {r.predictedDailyDoseMg !== null ? `${Math.round(r.predictedDailyDoseMg)} mg/día` : '—'}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="px-4 py-2.5 font-medium text-slate-700">Vd y t½ propios en el artículo</td>
                <td className="px-4 py-2.5 text-slate-600">No derivados (solo CL_Li y Css)</td>
                <td className="px-4 py-2.5 text-slate-600">No derivados (cita Vd de Pepin)</td>
                <td className="px-4 py-2.5 font-mono tabular-nums text-slate-900">
                  {pepinResult.vdL !== null
                    ? `V_app = ${pepinResult.vdL.toFixed(1)} L · t½ = ${pepinResult.tHalfHours?.toFixed(1)} h`
                    : 'Pendiente'}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-2.5 font-medium text-slate-700">Población original</td>
                <td className="px-4 py-2.5 text-slate-600">72 pacientes psiquiátricos japoneses (23–80 años)</td>
                <td className="px-4 py-2.5 text-slate-600">60 + 60 adultos psiquiátricos saudíes sin nefropatía</td>
                <td className="px-4 py-2.5 text-slate-600">13 voluntarios sanos (18–44 años)</td>
              </tr>
              <tr>
                <td className="px-4 py-2.5 font-medium text-slate-700">Validez en paciente actual</td>
                {results.map((r) => (
                  <td key={r.modelId} className="px-4 py-2.5">
                    {r.canCalculateClearance ? (
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-semibold ${
                          r.isWithinValidatedPopulation ? 'text-emerald-700' : 'text-amber-700'
                        }`}
                      >
                        {r.isWithinValidatedPopulation ? (
                          <>
                            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Dentro de cohorte</span>
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Fuera / precaución</span>
                          </>
                        )}
                      </span>
                    ) : (
                      <span className="text-slate-400">Incompleto</span>
                    )}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Live Article Benchmark Verification */}
      <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
        <div className="border-b border-slate-100 pb-3">
          <h2 className="font-display text-base font-semibold text-slate-900">
            Validación numérica en tiempo real frente a los ejemplos publicados
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">
            Cada tarjeta ejecuta las ecuaciones implementadas sobre los datos exactos de las tablas de los artículos originales y muestra el valor calculado frente al valor publicado.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {ARTICLE_BENCHMARK_CASES.map((bc) => {
            const m = calculateMotoki(bc.patient, bc.dosing);
            const aa = calculateAbouAuda(bc.patient, bc.dosing);
            const p = calculatePepin(bc.patient, bc.dosing);

            return (
              <div key={bc.id} className="rounded-md border border-slate-200 p-4 space-y-3 bg-slate-50/50">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">{bc.title}</h3>
                    <p className="text-xs text-slate-600 mt-0.5">{bc.subtitle}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">{bc.sourcePaper}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onLoadBenchmark(bc.id)}
                    className="inline-flex items-center gap-1.5 rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-100 whitespace-nowrap shrink-0"
                  >
                    <FlaskConical className="h-3.5 w-3.5 text-blue-700" aria-hidden="true" />
                    <span>Cargar caso</span>
                  </button>
                </div>

                <div className="rounded bg-white border border-slate-200 p-2.5 text-xs text-slate-700">
                  <span className="font-semibold text-slate-900">Referencia del artículo: </span>
                  {bc.expectedSummary}
                </div>

                <div className="grid grid-cols-3 gap-2 font-mono tabular-nums text-xs">
                  <div className="rounded bg-white border border-slate-200 px-2.5 py-2">
                    <span className="block text-[10px] font-sans text-blue-700 font-semibold">Motoki</span>
                    <span>{m.liClMlMin?.toFixed(2)} mL/min</span>
                    <span className="block text-[11px] text-slate-500">
                      Css {m.predictedCssMmolL?.toFixed(2)} mmol/L
                    </span>
                  </div>
                  <div className="rounded bg-white border border-slate-200 px-2.5 py-2">
                    <span className="block text-[10px] font-sans text-teal-700 font-semibold">Abou-Auda</span>
                    <span>{aa.liClLh?.toFixed(2)} L/h</span>
                    <span className="block text-[11px] text-slate-500">
                      Dosis {aa.predictedDailyDoseMg ? Math.round(aa.predictedDailyDoseMg) : '—'} mg
                    </span>
                  </div>
                  <div className="rounded bg-white border border-slate-200 px-2.5 py-2">
                    <span className="block text-[10px] font-sans text-indigo-700 font-semibold">Pepin/Stip</span>
                    <span>{p.liClMlMin?.toFixed(2)} mL/min</span>
                    <span className="block text-[11px] text-slate-500">
                      Dosis {p.predictedDailyDoseMg ? Math.round(p.predictedDailyDoseMg) : '—'} mg
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Complete Bibliographic References */}
      <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-3">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
          <BookOpen className="h-4 w-4 text-slate-700" aria-hidden="true" />
          <h2 className="font-display text-sm font-semibold text-slate-900">
            Referencias bibliográficas completas
          </h2>
        </div>
        <ol className="space-y-2.5 text-xs text-slate-700 list-decimal pl-5">
          {(['motoki', 'abouAuda', 'pepin'] as const).map((id) => (
            <li key={id} className="leading-relaxed">
              <span className="font-semibold text-slate-900">{MODEL_SPECS[id].shortTitle}:</span>{' '}
              {MODEL_SPECS[id].fullCitation}{' '}
              <span className="font-mono text-slate-500">[{MODEL_SPECS[id].doiOrJournal}]</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
};
