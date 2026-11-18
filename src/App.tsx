import { useMemo, useState } from 'react';
import {
  ARTICLE_BENCHMARK_CASES,
  calculateAbouAuda,
  calculateMotoki,
  calculatePepin,
} from './pk/models';
import {
  DosingInputs,
  IntoxicationInputs,
  PatientInputs,
} from './types/pk';
import { AppTab, TopBar } from './components/TopBar';
import { ClinicalInputPanel } from './components/ClinicalInputPanel';
import { ReintroductionSimulatorView } from './components/ReintroductionSimulatorView';
import { ModelDetailView } from './components/ModelDetailView';
import { ComparisonValidationView } from './components/ComparisonValidationView';

const DEFAULT_PATIENT: PatientInputs = {
  age: 64,
  sex: 'female',
  weightKg: 62,
  heightCm: 162,
  scrValue: 1.65,
  scrUnit: 'mg/dL',
  bunValue: 9.5,
  bunUnit: 'mmol/L',
  setting: 'inpatient',
  concomitantTca: false,
  measuredEgfr: null,
  flags: {
    acuteKidneyInjury: true,
    extracorporealRemoval: false,
    severeNeurotoxicity: false,
    interactingMedications: true,
    sodiumRestrictedDiet: false,
    nonAdherenceSuspected: false,
  },
};

const BLANK_PATIENT: PatientInputs = {
  age: null,
  sex: null,
  weightKg: null,
  heightCm: null,
  scrValue: null,
  scrUnit: 'mg/dL',
  bunValue: null,
  bunUnit: 'mmol/L',
  setting: 'inpatient',
  concomitantTca: false,
  measuredEgfr: null,
  flags: {
    acuteKidneyInjury: false,
    extracorporealRemoval: false,
    severeNeurotoxicity: false,
    interactingMedications: false,
    sodiumRestrictedDiet: false,
    nonAdherenceSuspected: false,
  },
};

const DEFAULT_DOSING: DosingInputs = {
  dailyDoseMg: 800,
  targetCssMmolL: 0.7,
  dosingIntervalHours: 12,
  lastDoseTimeIso: '2026-11-18T08:00',
};

const DEFAULT_INTOXICATION: IntoxicationInputs = {
  suspensionTimeIso: '2026-11-17T20:00',
  priorDailyDoseMg: 1000,
  priorIntervalHours: 12,
  samples: [
    {
      id: 'sample-1',
      timestampIso: '2026-11-18T04:00',
      concentrationMmolL: 1.92,
      label: 'Ingreso Urgencias',
    },
    {
      id: 'sample-2',
      timestampIso: '2026-11-18T16:00',
      concentrationMmolL: 1.48,
      label: 'Control +12h',
    },
  ],
  vdAssumption: 'pepin_vapp',
  manualVdL: 42,
  simulationHorizonHours: 120,
  scenarioA: {
    id: 'A',
    name: 'Escenario A',
    enabled: true,
    restartTimeIso: '2026-11-20T08:00',
    dailyDoseMg: 400,
    dosingIntervalHours: 12,
  },
  scenarioB: {
    id: 'B',
    name: 'Escenario B',
    enabled: true,
    restartTimeIso: '2026-11-20T20:00',
    dailyDoseMg: 300,
    dosingIntervalHours: 24,
  },
};

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('simulator');
  const [patient, setPatient] = useState<PatientInputs>(DEFAULT_PATIENT);
  const [dosing, setDosing] = useState<DosingInputs>(DEFAULT_DOSING);
  const [intoxication, setIntoxication] = useState<IntoxicationInputs>(DEFAULT_INTOXICATION);

  const pepinResult = useMemo(() => calculatePepin(patient, dosing), [patient, dosing]);

  const sharedVdForOtherModels = useMemo(() => {
    if (intoxication.vdAssumption === 'manual_vd' && intoxication.manualVdL) {
      return { vd: intoxication.manualVdL, note: `Vd manual (${intoxication.manualVdL} L)` };
    }
    if (intoxication.vdAssumption === 'pepin_vapp' && pepinResult.vdL) {
      return {
        vd: pepinResult.vdL,
        note: `V_app acoplado de Pepin/Stip (${pepinResult.vdL.toFixed(1)} L)`,
      };
    }
    return { vd: null, note: null };
  }, [intoxication.vdAssumption, intoxication.manualVdL, pepinResult.vdL]);

  const motokiResult = useMemo(
    () =>
      calculateMotoki(
        patient,
        dosing,
        sharedVdForOtherModels.vd,
        sharedVdForOtherModels.note
      ),
    [patient, dosing, sharedVdForOtherModels]
  );

  const abouAudaResult = useMemo(
    () =>
      calculateAbouAuda(
        patient,
        dosing,
        sharedVdForOtherModels.vd,
        sharedVdForOtherModels.note
      ),
    [patient, dosing, sharedVdForOtherModels]
  );

  const missingSummary = useMemo(() => {
    const set = new Set<string>([
      ...motokiResult.missingForClearance,
      ...abouAudaResult.missingForClearance,
      ...pepinResult.missingForClearance,
    ]);
    return Array.from(set);
  }, [motokiResult, abouAudaResult, pepinResult]);

  const handleLoadBenchmark = (caseId: string) => {
    const found = ARTICLE_BENCHMARK_CASES.find((c) => c.id === caseId);
    if (!found) return;
    setPatient(found.patient);
    setDosing(found.dosing);
  };

  const handleLoadIntoxicationExample = () => {
    setPatient(DEFAULT_PATIENT);
    setDosing(DEFAULT_DOSING);
    setIntoxication(DEFAULT_INTOXICATION);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <TopBar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onPrintReport={() => window.print()}
      />

      <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 sm:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Control Column */}
          <aside className="lg:col-span-4 xl:col-span-3 lg:sticky lg:top-[76px]">
            <ClinicalInputPanel
              patient={patient}
              onChange={setPatient}
              onResetBlank={() => setPatient(BLANK_PATIENT)}
              highlightMissing={missingSummary}
            />
          </aside>

          {/* Main Clinical Viewport */}
          <section className="lg:col-span-8 xl:col-span-9 min-w-0">
            {activeTab === 'simulator' && (
              <ReintroductionSimulatorView
                patient={patient}
                dosing={dosing}
                intoxication={intoxication}
                onChangeIntoxication={setIntoxication}
                motokiResult={motokiResult}
                abouAudaResult={abouAudaResult}
                pepinResult={pepinResult}
                onLoadIntoxicationExample={handleLoadIntoxicationExample}
              />
            )}

            {activeTab === 'motoki' && (
              <ModelDetailView
                modelId="motoki"
                patient={patient}
                dosing={dosing}
                onChangeDosing={setDosing}
                result={motokiResult}
                vdAssumption={intoxication.vdAssumption}
                manualVdL={intoxication.manualVdL}
                onChangeVdAssumption={(mode, manualVd) =>
                  setIntoxication({ ...intoxication, vdAssumption: mode, manualVdL: manualVd })
                }
                onLoadBenchmark={handleLoadBenchmark}
              />
            )}

            {activeTab === 'abouAuda' && (
              <ModelDetailView
                modelId="abouAuda"
                patient={patient}
                dosing={dosing}
                onChangeDosing={setDosing}
                result={abouAudaResult}
                vdAssumption={intoxication.vdAssumption}
                manualVdL={intoxication.manualVdL}
                onChangeVdAssumption={(mode, manualVd) =>
                  setIntoxication({ ...intoxication, vdAssumption: mode, manualVdL: manualVd })
                }
                onLoadBenchmark={handleLoadBenchmark}
              />
            )}

            {activeTab === 'pepin' && (
              <ModelDetailView
                modelId="pepin"
                patient={patient}
                dosing={dosing}
                onChangeDosing={setDosing}
                result={pepinResult}
                vdAssumption={intoxication.vdAssumption}
                manualVdL={intoxication.manualVdL}
                onChangeVdAssumption={(mode, manualVd) =>
                  setIntoxication({ ...intoxication, vdAssumption: mode, manualVdL: manualVd })
                }
                onLoadBenchmark={handleLoadBenchmark}
              />
            )}

            {activeTab === 'comparison' && (
              <ComparisonValidationView
                patient={patient}
                dosing={dosing}
                motokiResult={motokiResult}
                abouAudaResult={abouAudaResult}
                pepinResult={pepinResult}
                onLoadBenchmark={(id) => {
                  handleLoadBenchmark(id);
                  if (id.startsWith('stip')) setActiveTab('pepin');
                  else if (id.startsWith('motoki')) setActiveTab('motoki');
                  else setActiveTab('abouAuda');
                }}
              />
            )}
          </section>
        </div>
      </main>

      <footer className="no-print border-t border-slate-200 bg-white py-4 px-4 sm:px-6">
        <div className="mx-auto max-w-[1440px] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-slate-500">
          <span>
            LitioPK · Herramienta de apoyo a la decisión en Farmacia Hospitalaria y Farmacología Clínica
          </span>
          <span>
            Basada en Motoki et al. (2016) · Abou-Auda et al. (2008) · Stip / Pepin et al. (2001)
          </span>
        </div>
      </footer>
    </div>
  );
}
