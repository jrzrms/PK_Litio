import React, { useMemo, useRef, useState } from 'react';
import { MeasuredSample, TimeSeriesPoint } from '../types/pk';
import { diffHoursIso, formatIsoShort } from '../pk/unitConversions';

export interface SeriesVisibility {
  motoki: boolean;
  abouAuda: boolean;
  pepin: boolean;
  empirical: boolean;
  scenarioB: boolean;
}

interface PkChartProps {
  points: TimeSeriesPoint[];
  samples: MeasuredSample[];
  refIso: string;
  suspensionIso?: string;
  anchorIso?: string | null;
  restartAIso?: string;
  restartAEnabled?: boolean;
  restartBIso?: string;
  restartBEnabled?: boolean;
  visibility: SeriesVisibility;
  title?: string;
  subtitle?: string;
}

const SERIES_COLORS = {
  motoki: '#2563EB', // Cobalt
  abouAuda: '#0D9488', // Teal
  pepin: '#4F46E5', // Indigo
  empirical: '#EA580C', // Orange
  measured: '#0F172A', // Slate 900
};

export const PkChart: React.FC<PkChartProps> = ({
  points,
  samples,
  refIso,
  suspensionIso,
  anchorIso,
  restartAIso,
  restartAEnabled,
  restartBIso,
  restartBEnabled,
  visibility,
  title = 'Concentración plasmática estimada vs. medida en el tiempo',
  subtitle,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const width = 880;
  const height = 400;
  const pad = { top: 26, right: 28, bottom: 48, left: 60 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const { maxTime, maxY, validSamples } = useMemo(() => {
    let tMax = 72;
    let yMax = 1.8;

    for (const p of points) {
      if (p.timeHoursFromRef > tMax) tMax = p.timeHoursFromRef;
      const vals = [
        visibility.motoki ? p.motokiA : null,
        visibility.abouAuda ? p.abouAudaA : null,
        visibility.pepin ? p.pepinA : null,
        visibility.empirical ? p.empiricalA : null,
        visibility.scenarioB && visibility.motoki ? p.motokiB : null,
        visibility.scenarioB && visibility.abouAuda ? p.abouAudaB : null,
        visibility.scenarioB && visibility.pepin ? p.pepinB : null,
      ];
      for (const v of vals) {
        if (v !== null && v !== undefined && Number.isFinite(v) && v > yMax) {
          yMax = v;
        }
      }
    }

    const mappedSamples = samples
      .filter(
        (s) =>
          s.concentrationMmolL !== null &&
          Number.isFinite(s.concentrationMmolL) &&
          !Number.isNaN(new Date(s.timestampIso).getTime())
      )
      .map((s) => ({
        ...s,
        tHours: diffHoursIso(refIso, s.timestampIso),
      }))
      .filter((s) => Number.isFinite(s.tHours) && s.tHours >= -0.01);

    for (const s of mappedSamples) {
      if (s.tHours > tMax) tMax = s.tHours;
      if (s.concentrationMmolL! > yMax) yMax = s.concentrationMmolL!;
    }

    const niceYMax = Math.max(1.8, Math.ceil((yMax * 1.15) * 4) / 4);
    return { maxTime: Math.max(12, tMax), maxY: niceYMax, validSamples: mappedSamples };
  }, [points, samples, refIso, visibility]);

  const xScale = (t: number) => pad.left + (Math.max(0, Math.min(maxTime, t)) / maxTime) * plotW;
  const yScale = (c: number) => pad.top + plotH - (Math.max(0, Math.min(maxY, c)) / maxY) * plotH;

  const buildPath = (accessor: (p: TimeSeriesPoint) => number | null | undefined) => {
    let d = '';
    let started = false;
    for (const p of points) {
      const v = accessor(p);
      if (v === null || v === undefined || !Number.isFinite(v)) {
        started = false;
        continue;
      }
      const x = xScale(p.timeHoursFromRef).toFixed(1);
      const y = yScale(v).toFixed(1);
      d += started ? ` L ${x} ${y}` : `M ${x} ${y}`;
      started = true;
    }
    return d;
  };

  const yTicks = useMemo(() => {
    const step = maxY > 3 ? 0.5 : 0.3;
    const ticks: number[] = [];
    for (let v = 0; v <= maxY + 0.001; v += step) {
      ticks.push(Number(v.toFixed(2)));
    }
    return ticks;
  }, [maxY]);

  const xTicks = useMemo(() => {
    const rawStep = maxTime <= 48 ? 6 : maxTime <= 120 ? 12 : 24;
    const ticks: number[] = [];
    for (let h = 0; h <= maxTime + 0.001; h += rawStep) {
      ticks.push(h);
    }
    return ticks;
  }, [maxTime]);

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current || points.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * width;
    if (relX < pad.left || relX > width - pad.right) {
      setHoverIdx(null);
      return;
    }
    const targetT = ((relX - pad.left) / plotW) * maxTime;
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < points.length; i++) {
      const dist = Math.abs(points[i].timeHoursFromRef - targetT);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    }
    setHoverIdx(bestIdx);
  };

  const hovered = hoverIdx !== null ? points[hoverIdx] : null;

  const eventMarkers = useMemo(() => {
    const markers: Array<{ label: string; t: number; color: string }> = [];
    if (suspensionIso) {
      const t = diffHoursIso(refIso, suspensionIso);
      if (Number.isFinite(t) && t >= 0 && t <= maxTime) {
        markers.push({ label: 'Suspensión', t, color: '#64748B' });
      }
    }
    if (anchorIso) {
      const t = diffHoursIso(refIso, anchorIso);
      if (Number.isFinite(t) && t >= 0 && t <= maxTime) {
        markers.push({ label: 'Última medida', t, color: '#0F172A' });
      }
    }
    if (restartAEnabled && restartAIso) {
      const t = diffHoursIso(refIso, restartAIso);
      if (Number.isFinite(t) && t >= 0 && t <= maxTime) {
        markers.push({ label: 'Reintro A', t, color: '#2563EB' });
      }
    }
    if (restartBEnabled && restartBIso) {
      const t = diffHoursIso(refIso, restartBIso);
      if (Number.isFinite(t) && t >= 0 && t <= maxTime) {
        markers.push({ label: 'Reintro B', t, color: '#7C3AED' });
      }
    }
    return markers;
  }, [refIso, suspensionIso, anchorIso, restartAEnabled, restartAIso, restartBEnabled, restartBIso, maxTime]);

  if (points.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 text-center">
        <p className="text-sm font-medium text-slate-800">{title}</p>
        <p className="mt-1 text-xs text-slate-500">
          Introduzca los datos clínicos obligatorios y al menos una concentración plasmática medida
          para generar la curva farmacocinética.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
        <div>
          <h3 className="font-display text-sm font-semibold text-slate-900">{title}</h3>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-600">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rotate-45 bg-slate-900" aria-hidden="true" />
            <span>Medida real</span>
          </span>
          {visibility.motoki && (
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-4 bg-blue-600" aria-hidden="true" />
              <span>Estimada Motoki</span>
            </span>
          )}
          {visibility.abouAuda && (
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-4 bg-teal-600" aria-hidden="true" />
              <span>Estimada Abou-Auda</span>
            </span>
          )}
          {visibility.pepin && (
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-4 bg-indigo-600" aria-hidden="true" />
              <span>Estimada Pepin/Stip</span>
            </span>
          )}
          {visibility.empirical && (
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-4 bg-orange-600" aria-hidden="true" />
              <span>Ajuste empírico</span>
            </span>
          )}
          {visibility.scenarioB && (
            <span className="inline-flex items-center gap-1.5">
              <span
                className="inline-block h-0.5 w-4 border-t-2 border-dashed border-slate-600"
                aria-hidden="true"
              />
              <span>Escenario B</span>
            </span>
          )}
        </div>
      </div>

      <div className="relative w-full overflow-x-auto">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          className="w-full min-w-[620px] h-auto select-none cursor-crosshair"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverIdx(null)}
          role="img"
          aria-label="Gráfica de concentración plasmática de litio frente al tiempo"
        >
          {/* Therapeutic window shaded band: 0.60 - 1.20 mmol/L */}
          <rect
            x={pad.left}
            y={yScale(1.2)}
            width={plotW}
            height={Math.max(0, yScale(0.6) - yScale(1.2))}
            fill="rgba(16, 185, 129, 0.09)"
          />
          <text
            x={width - pad.right - 6}
            y={yScale(1.2) + 13}
            textAnchor="end"
            className="fill-emerald-800 text-[10px] font-medium"
          >
            Rango terapéutico (0,60–1,20 mmol/L)
          </text>

          {/* Grid lines & Y-axis ticks */}
          {yTicks.map((tick) => {
            const y = yScale(tick);
            return (
              <g key={tick}>
                <line
                  x1={pad.left}
                  y1={y}
                  x2={width - pad.right}
                  y2={y}
                  stroke="#E2E8F0"
                  strokeWidth={1}
                />
                <text
                  x={pad.left - 8}
                  y={y + 3.5}
                  textAnchor="end"
                  className="fill-slate-500 text-[11px] font-mono tabular-nums"
                >
                  {tick.toFixed(2)}
                </text>
              </g>
            );
          })}

          {/* Toxic threshold line: 1.50 mmol/L */}
          {maxY >= 1.5 && (
            <g>
              <line
                x1={pad.left}
                y1={yScale(1.5)}
                x2={width - pad.right}
                y2={yScale(1.5)}
                stroke="#D97706"
                strokeWidth={1.25}
                strokeDasharray="5 4"
              />
              <text
                x={pad.left + 6}
                y={yScale(1.5) - 5}
                className="fill-amber-700 text-[10px] font-semibold"
              >
                Umbral riesgo tóxico (1,50 mmol/L)
              </text>
            </g>
          )}

          {/* Severe toxicity reference: 2.00 mmol/L */}
          {maxY >= 2.0 && (
            <g>
              <line
                x1={pad.left}
                y1={yScale(2.0)}
                x2={width - pad.right}
                y2={yScale(2.0)}
                stroke="#DC2626"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
              <text
                x={pad.left + 6}
                y={yScale(2.0) - 5}
                className="fill-rose-700 text-[10px] font-semibold"
              >
                Intoxicación relevante (≥ 2,00 mmol/L)
              </text>
            </g>
          )}

          {/* X-axis ticks */}
          {xTicks.map((h) => {
            const x = xScale(h);
            return (
              <g key={h}>
                <line
                  x1={x}
                  y1={pad.top}
                  x2={x}
                  y2={height - pad.bottom}
                  stroke="#F1F5F9"
                  strokeWidth={1}
                />
                <text
                  x={x}
                  y={height - pad.bottom + 16}
                  textAnchor="middle"
                  className="fill-slate-600 text-[11px] font-mono tabular-nums"
                >
                  {h}h
                </text>
              </g>
            );
          })}

          {/* Event vertical markers */}
          {eventMarkers.map((ev, i) => {
            const x = xScale(ev.t);
            return (
              <g key={`${ev.label}-${i}`}>
                <line
                  x1={x}
                  y1={pad.top}
                  x2={x}
                  y2={height - pad.bottom}
                  stroke={ev.color}
                  strokeWidth={1}
                  strokeDasharray="3 3"
                  opacity={0.75}
                />
                <text
                  x={x + 4}
                  y={pad.top + 11 + (i % 2) * 12}
                  className="text-[10px] font-medium"
                  fill={ev.color}
                >
                  {ev.label}
                </text>
              </g>
            );
          })}

          {/* Axes frame */}
          <line
            x1={pad.left}
            y1={pad.top}
            x2={pad.left}
            y2={height - pad.bottom}
            stroke="#94A3B8"
            strokeWidth={1}
          />
          <line
            x1={pad.left}
            y1={height - pad.bottom}
            x2={width - pad.right}
            y2={height - pad.bottom}
            stroke="#94A3B8"
            strokeWidth={1}
          />

          {/* Axis labels */}
          <text
            x={16}
            y={pad.top + plotH / 2}
            transform={`rotate(-90 16 ${pad.top + plotH / 2})`}
            textAnchor="middle"
            className="fill-slate-600 text-[11px] font-medium"
          >
            Litemia (mmol/L)
          </text>
          <text
            x={pad.left + plotW / 2}
            y={height - 10}
            textAnchor="middle"
            className="fill-slate-600 text-[11px] font-medium"
          >
            Tiempo transcurrido desde t₀ (horas)
          </text>

          {/* Scenario B dashed comparison curves */}
          {visibility.scenarioB && visibility.motoki && (
            <path
              d={buildPath((p) => p.motokiB)}
              fill="none"
              stroke={SERIES_COLORS.motoki}
              strokeWidth={1.75}
              strokeDasharray="5 4"
              opacity={0.75}
            />
          )}
          {visibility.scenarioB && visibility.abouAuda && (
            <path
              d={buildPath((p) => p.abouAudaB)}
              fill="none"
              stroke={SERIES_COLORS.abouAuda}
              strokeWidth={1.75}
              strokeDasharray="5 4"
              opacity={0.75}
            />
          )}
          {visibility.scenarioB && visibility.pepin && (
            <path
              d={buildPath((p) => p.pepinB)}
              fill="none"
              stroke={SERIES_COLORS.pepin}
              strokeWidth={1.75}
              strokeDasharray="5 4"
              opacity={0.75}
            />
          )}

          {/* Scenario A / Primary estimated curves */}
          {visibility.motoki && (
            <path
              d={buildPath((p) => p.motokiA)}
              fill="none"
              stroke={SERIES_COLORS.motoki}
              strokeWidth={2.2}
            />
          )}
          {visibility.abouAuda && (
            <path
              d={buildPath((p) => p.abouAudaA)}
              fill="none"
              stroke={SERIES_COLORS.abouAuda}
              strokeWidth={2.2}
            />
          )}
          {visibility.pepin && (
            <path
              d={buildPath((p) => p.pepinA)}
              fill="none"
              stroke={SERIES_COLORS.pepin}
              strokeWidth={2.2}
            />
          )}
          {visibility.empirical && (
            <path
              d={buildPath((p) => p.empiricalA)}
              fill="none"
              stroke={SERIES_COLORS.empirical}
              strokeWidth={2}
              strokeDasharray="2 2"
            />
          )}

          {/* Measured sample diamond markers */}
          {validSamples.map((s) => {
            const cx = xScale(s.tHours);
            const cy = yScale(s.concentrationMmolL!);
            return (
              <g key={s.id}>
                <polygon
                  points={`${cx},${cy - 6} ${cx + 6},${cy} ${cx},${cy + 6} ${cx - 6},${cy}`}
                  fill={SERIES_COLORS.measured}
                  stroke="#FFFFFF"
                  strokeWidth={2}
                />
                <text
                  x={cx}
                  y={cy - 10}
                  textAnchor="middle"
                  className="fill-slate-900 text-[10px] font-mono font-semibold tabular-nums"
                >
                  {s.concentrationMmolL!.toFixed(2)}
                </text>
              </g>
            );
          })}

          {/* Crosshair hover line */}
          {hovered && (
            <line
              x1={xScale(hovered.timeHoursFromRef)}
              y1={pad.top}
              x2={xScale(hovered.timeHoursFromRef)}
              y2={height - pad.bottom}
              stroke="#475569"
              strokeWidth={1}
            />
          )}
        </svg>

        {/* Crosshair HUD readout */}
        {hovered && (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
            <div className="font-mono tabular-nums text-slate-800">
              <span className="font-semibold">t = +{hovered.timeHoursFromRef.toFixed(1)} h</span>
              <span className="mx-2 text-slate-400">·</span>
              <span>{formatIsoShort(hovered.timestampIso)}</span>
            </div>
            <div className="flex flex-wrap items-center gap-4 font-mono tabular-nums">
              {visibility.motoki && hovered.motokiA !== null && hovered.motokiA !== undefined && (
                <span className="text-blue-700">
                  Motoki: <strong>{hovered.motokiA.toFixed(2)}</strong>
                  {visibility.scenarioB && hovered.motokiB !== null && hovered.motokiB !== undefined
                    ? ` (B: ${hovered.motokiB.toFixed(2)})`
                    : ''}{' '}
                  mmol/L
                </span>
              )}
              {visibility.abouAuda && hovered.abouAudaA !== null && hovered.abouAudaA !== undefined && (
                <span className="text-teal-700">
                  Abou-Auda: <strong>{hovered.abouAudaA.toFixed(2)}</strong>
                  {visibility.scenarioB && hovered.abouAudaB !== null && hovered.abouAudaB !== undefined
                    ? ` (B: ${hovered.abouAudaB.toFixed(2)})`
                    : ''}{' '}
                  mmol/L
                </span>
              )}
              {visibility.pepin && hovered.pepinA !== null && hovered.pepinA !== undefined && (
                <span className="text-indigo-700">
                  Pepin: <strong>{hovered.pepinA.toFixed(2)}</strong>
                  {visibility.scenarioB && hovered.pepinB !== null && hovered.pepinB !== undefined
                    ? ` (B: ${hovered.pepinB.toFixed(2)})`
                    : ''}{' '}
                  mmol/L
                </span>
              )}
              {visibility.empirical && hovered.empiricalA !== null && hovered.empiricalA !== undefined && (
                <span className="text-orange-700">
                  Empírico: <strong>{hovered.empiricalA.toFixed(2)}</strong> mmol/L
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
