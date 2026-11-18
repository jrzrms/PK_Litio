import React from 'react';
import { Printer } from 'lucide-react';

export type AppTab = 'simulator' | 'motoki' | 'abouAuda' | 'pepin' | 'comparison';

interface TopBarProps {
  activeTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
  onPrintReport: () => void;
}

const NAV_ITEMS: Array<{ id: AppTab; label: string }> = [
  { id: 'simulator', label: 'Reintroducción' },
  { id: 'motoki', label: 'Módulo 1: Motoki' },
  { id: 'abouAuda', label: 'Módulo 2: Abou-Auda' },
  { id: 'pepin', label: 'Módulo 3: Pepin' },
  { id: 'comparison', label: 'Validación' },
];

export const TopBar: React.FC<TopBarProps> = ({ activeTab, onSelectTab, onPrintReport }) => {
  return (
    <header className="no-print sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-8 px-4 py-3 sm:px-6">
        {/* Zone 1: Single-line brand wordmark */}
        <button
          type="button"
          onClick={() => onSelectTab('simulator')}
          className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 hover:text-blue-700 transition-colors focus-visible:outline-2 focus-visible:outline-blue-600 rounded"
        >
          LitioPK
        </button>

        {/* Zone 2: Concise single-line navigation links */}
        <nav aria-label="Navegación principal" className="hidden lg:flex items-center gap-6 overflow-x-auto">
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`relative py-1.5 text-sm font-medium whitespace-nowrap shrink-0 transition-colors focus-visible:outline-2 focus-visible:outline-blue-600 rounded ${
                  isActive ? 'text-blue-700' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {item.label}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 -bottom-[13px] h-0.5 bg-blue-700"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Single primary action */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onPrintReport}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white whitespace-nowrap shrink-0 hover:bg-slate-800 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          >
            <Printer className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Imprimir informe</span>
          </button>
        </div>
      </div>

      {/* Mobile / tablet secondary horizontal nav */}
      <div className="flex lg:hidden items-center gap-4 overflow-x-auto border-t border-slate-100 px-4 py-2">
        {NAV_ITEMS.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-md whitespace-nowrap shrink-0 transition-colors ${
                isActive
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </header>
  );
};
