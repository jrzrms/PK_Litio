import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { BunUnit, CareSetting, PatientInputs, ScrUnit, Sex } from '../types/pk';
import {
  bunToMgDl,
  bunToMmolL,
  computeBmi,
  computeCkdEpi2021,
  scrToMgDl,
} from '../pk/unitConversions';

interface ClinicalInputPanelProps {
  patient: PatientInputs;
  onChange: (next: PatientInputs) => void;
  onResetBlank: () => void;
  highlightMissing?: string[];
}

function parseNum(val: string): number | null {
  if (val.trim() === '') return null;
  const parsed = Number(val);
  return Number.isFinite(parsed) ? parsed : null;
}

export const ClinicalInputPanel: React.FC<ClinicalInputPanelProps> = ({
  patient,
  onChange,
  onResetBlank,
  highlightMissing = [],
}) => {
  const scrMgDl = scrToMgDl(patient.scrValue, patient.scrUnit);
  const bunMmol = bunToMmolL(patient.bunValue, patient.bunUnit);
  const bunMg = bunToMgDl(patient.bunValue, patient.bunUnit);
  const bmi = computeBmi(patient.weightKg, patient.heightCm);
  const ckdEpi =
    patient.age && patient.sex && scrMgDl
      ? computeCkdEpi2021(patient.age, patient.sex, scrMgDl)
      : null;

  const updateField = <K extends keyof PatientInputs>(key: K, value: PatientInputs[K]) => {
    onChange({ ...patient, [key]: value });
  };

  const updateFlag = (key: keyof PatientInputs['flags'], value: boolean) => {
    onChange({
      ...patient,
      flags: {
        ...patient.flags,
        [key]: value,
      },
    });
  };

  const handleScrUnitChange = (newUnit: ScrUnit) => {
    if (newUnit === patient.scrUnit) return;
    if (patient.scrValue === null) {
      updateField('scrUnit', newUnit);
      return;
    }
    const converted =
      newUnit === 'umol/L'
        ? Number((patient.scrValue * 88.42).toFixed(0))
        : Number((patient.scrValue / 88.42).toFixed(2));
    onChange({ ...patient, scrUnit: newUnit, scrValue: converted });
  };

  const handleBunUnitChange = (newUnit: BunUnit) => {
    if (newUnit === patient.bunUnit) return;
    if (patient.bunValue === null) {
      updateField('bunUnit', newUnit);
      return;
    }
    const converted =
      newUnit === 'mg/dL'
        ? Number((patient.bunValue * 2.801).toFixed(1))
        : Number((patient.bunValue / 2.801).toFixed(2));
    onChange({ ...patient, bunUnit: newUnit, bunValue: converted });
  };

  const isInvalidAge = patient.age !== null && (patient.age < 1 || patient.age > 115);
  const isInvalidWeight = patient.weightKg !== null && (patient.weightKg < 15 || patient.weightKg > 300);
  const isInvalidHeight = patient.heightCm !== null && (patient.heightCm < 90 || patient.heightCm > 230);
  const isInvalidScr = scrMgDl !== null && (scrMgDl < 0.1 || scrMgDl > 20);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5 space-y-5">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <h2 className="font-display text-sm font-semibold text-slate-900">
            Datos del paciente y función renal
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Parámetros compartidos entre los tres modelos
          </p>
        </div>
        <button
          type="button"
          onClick={onResetBlank}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
          title="Limpiar campos para introducir un paciente desde cero"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Limpiar</span>
        </button>
      </div>

      {highlightMissing.length > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-700 mt-0.5" aria-hidden="true" />
            <div>
              <p className="font-semibold">Faltan parámetros requeridos</p>
              <p className="mt-0.5 text-amber-800">
                No se asumen valores por defecto sin respaldo clínico. Complete:{' '}
                {highlightMissing.join(', ')}.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Demografía y Antropometría */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-slate-700">Antropometría y demografía</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="pk-age" className="block text-xs font-medium text-slate-700 mb-1">
              Edad (años)
            </label>
            <input
              id="pk-age"
              type="number"
              min={1}
              max={115}
              step={1}
              value={patient.age ?? ''}
              onChange={(e) => updateField('age', parseNum(e.target.value))}
              placeholder="Ej. 52"
              className={`w-full rounded-md border px-2.5 py-2 text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-600 ${
                isInvalidAge ? 'border-rose-400 bg-rose-50' : 'border-slate-300 bg-white'
              }`}
            />
            {isInvalidAge && (
              <p className="mt-1 text-[11px] text-rose-700">Rango permitido: 1–115 años</p>
            )}
          </div>

          <div>
            <span className="block text-xs font-medium text-slate-700 mb-1">Sexo biológico</span>
            <div className="grid grid-cols-2 gap-1 rounded-md bg-slate-100 p-1">
              {(['male', 'female'] as Sex[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => updateField('sex', s)}
                  className={`rounded py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                    patient.sex === s
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {s === 'male' ? 'Hombre' : 'Mujer'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="pk-weight" className="block text-xs font-medium text-slate-700 mb-1">
              Peso total (kg)
            </label>
            <input
              id="pk-weight"
              type="number"
              min={15}
              max={300}
              step={0.1}
              value={patient.weightKg ?? ''}
              onChange={(e) => updateField('weightKg', parseNum(e.target.value))}
              placeholder="Ej. 68,5"
              className={`w-full rounded-md border px-2.5 py-2 text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-600 ${
                isInvalidWeight ? 'border-rose-400 bg-rose-50' : 'border-slate-300 bg-white'
              }`}
            />
            {isInvalidWeight && (
              <p className="mt-1 text-[11px] text-rose-700">Rango permitido: 15–300 kg</p>
            )}
          </div>

          <div>
            <label htmlFor="pk-height" className="block text-xs font-medium text-slate-700 mb-1">
              Talla (cm)
            </label>
            <input
              id="pk-height"
              type="number"
              min={90}
              max={230}
              step={0.5}
              value={patient.heightCm ?? ''}
              onChange={(e) => updateField('heightCm', parseNum(e.target.value))}
              placeholder="Ej. 170"
              className={`w-full rounded-md border px-2.5 py-2 text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-600 ${
                isInvalidHeight ? 'border-rose-400 bg-rose-50' : 'border-slate-300 bg-white'
              }`}
            />
            {isInvalidHeight && (
              <p className="mt-1 text-[11px] text-rose-700">Rango permitido: 90–230 cm</p>
            )}
          </div>
        </div>

        {bmi !== null && (
          <div className="flex items-center justify-between text-xs text-slate-600 bg-slate-50 rounded-md px-2.5 py-1.5 border border-slate-200">
            <span>Índice de masa corporal (IMC)</span>
            <span className="font-mono tabular-nums font-medium text-slate-900">
              {bmi.toFixed(1)} kg/m² {bmi >= 25 ? '· ≥ 25 (Sobrepeso/Obesidad)' : ''}
            </span>
          </div>
        )}
      </div>

      {/* Función Renal */}
      <div className="space-y-3 border-t border-slate-100 pt-4">
        <h3 className="text-xs font-semibold text-slate-700">Función renal</h3>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label htmlFor="pk-scr" className="text-xs font-medium text-slate-700">
              Creatinina sérica (SCr)
            </label>
            <div className="flex items-center gap-1 rounded bg-slate-100 p-0.5">
              {(['mg/dL', 'umol/L'] as ScrUnit[]).map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => handleScrUnitChange(u)}
                  className={`px-2 py-0.5 text-[11px] font-mono rounded transition-colors ${
                    patient.scrUnit === u
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {u === 'umol/L' ? 'µmol/L' : u}
                </button>
              ))}
            </div>
          </div>
          <input
            id="pk-scr"
            type="number"
            min={0.1}
            max={2000}
            step={patient.scrUnit === 'mg/dL' ? 0.01 : 1}
            value={patient.scrValue ?? ''}
            onChange={(e) => updateField('scrValue', parseNum(e.target.value))}
            placeholder={patient.scrUnit === 'mg/dL' ? 'Ej. 1,10' : 'Ej. 97'}
            className={`w-full rounded-md border px-2.5 py-2 text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-600 ${
              isInvalidScr ? 'border-rose-400 bg-rose-50' : 'border-slate-300 bg-white'
            }`}
          />
          {scrMgDl !== null && (
            <p className="mt-1 text-[11px] font-mono tabular-nums text-slate-500">
              Equivalente: {scrMgDl.toFixed(2)} mg/dL · {(scrMgDl * 88.42).toFixed(0)} µmol/L
            </p>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label htmlFor="pk-bun" className="text-xs font-medium text-slate-700">
              BUN / Nitrógeno ureico{' '}
              <span className="font-normal text-slate-500">(ec. dosis Abou-Auda)</span>
            </label>
            <div className="flex items-center gap-1 rounded bg-slate-100 p-0.5">
              {(['mmol/L', 'mg/dL'] as BunUnit[]).map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => handleBunUnitChange(u)}
                  className={`px-2 py-0.5 text-[11px] font-mono rounded transition-colors ${
                    patient.bunUnit === u
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>
          <input
            id="pk-bun"
            type="number"
            min={0.1}
            max={250}
            step={0.1}
            value={patient.bunValue ?? ''}
            onChange={(e) => updateField('bunValue', parseNum(e.target.value))}
            placeholder={patient.bunUnit === 'mmol/L' ? 'Ej. 4,5' : 'Ej. 12,6'}
            className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
          {bunMmol !== null && bunMg !== null && (
            <p className="mt-1 text-[11px] font-mono tabular-nums text-slate-500">
              Equivalente: {bunMmol.toFixed(2)} mmol/L · {bunMg.toFixed(1)} mg/dL
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-2">
          <div>
            <label htmlFor="pk-egfr" className="block text-xs font-medium text-slate-700 mb-1">
              FG informado por laboratorio (mL/min/1,73 m², opcional)
            </label>
            <input
              id="pk-egfr"
              type="number"
              min={1}
              max={200}
              step={1}
              value={patient.measuredEgfr ?? ''}
              onChange={(e) => updateField('measuredEgfr', parseNum(e.target.value))}
              placeholder={ckdEpi ? `CKD-EPI 2021 calc.: ${ckdEpi.toFixed(0)}` : 'Opcional'}
              className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
          {ckdEpi !== null && (
            <p className="text-[11px] text-slate-500">
              Referencia CKD-EPI 2021:{' '}
              <span className="font-mono tabular-nums font-medium text-slate-700">
                {ckdEpi.toFixed(1)} mL/min/1,73 m²
              </span>{' '}
              (los 3 artículos usan Cockcroft-Gault en mL/min o L/h).
            </p>
          )}
        </div>
      </div>

      {/* Ámbito y TCA (Abou-Auda) */}
      <div className="space-y-3 border-t border-slate-100 pt-4">
        <h3 className="text-xs font-semibold text-slate-700">
          Contexto asistencial (Abou-Auda 2008)
        </h3>
        <div className="grid grid-cols-2 gap-1 rounded-md bg-slate-100 p-1">
          {(
            [
              { id: 'inpatient', label: 'Hospitalizado' },
              { id: 'outpatient', label: 'Ambulatorio' },
            ] as Array<{ id: CareSetting; label: string }>
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => updateField('setting', opt.id)}
              className={`rounded py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                patient.setting === opt.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <label className="flex items-start gap-2.5 text-xs text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={patient.concomitantTca}
            onChange={(e) => updateField('concomitantTca', e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
          />
          <span>Tratamiento concomitante con antidepresivo tricíclico (TCA)</span>
        </label>
      </div>

      {/* Banderas de seguridad clínica */}
      <div className="space-y-2.5 border-t border-slate-100 pt-4">
        <h3 className="text-xs font-semibold text-slate-700">
          Condiciones clínicas y exclusiones de los modelos
        </h3>
        <div className="space-y-2">
          {[
            {
              key: 'acuteKidneyInjury' as const,
              label: 'Insuficiencia renal aguda / SCr inestable',
            },
            {
              key: 'extracorporealRemoval' as const,
              label: 'Hemodiálisis o depuración extracorpórea (TCRR)',
            },
            {
              key: 'severeNeurotoxicity' as const,
              label: 'Clínica neurológica grave (ataxia, confusión, mioclonías)',
            },
            {
              key: 'interactingMedications' as const,
              label: 'Fármacos que reducen CL_Li (AINE, diuréticos, IECA/ARA-II)',
            },
            {
              key: 'sodiumRestrictedDiet' as const,
              label: 'Depleción de volumen o dieta hiposódica',
            },
            {
              key: 'nonAdherenceSuspected' as const,
              label: 'Sospecha de falta de adherencia previa',
            },
          ].map((item) => (
            <label
              key={item.key}
              className="flex items-start gap-2.5 text-xs text-slate-700 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={patient.flags[item.key]}
                onChange={(e) => updateFlag(item.key, e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-600"
              />
              <span>{item.label}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
};
