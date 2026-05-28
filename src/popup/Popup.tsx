import { useEffect, useState } from 'react';
import type { RoutineEntry } from '@/lib/types';
import { getRoutine, setRoutine } from '@/lib/storage';
import { PRIVACY_URL, TERMS_URL } from '@/lib/links';
import { AddProductForm } from './AddProductForm';
import { RoutineList } from './RoutineList';

type Slot = RoutineEntry['slot'];

export function Popup() {
  const [routine, setRoutineState] = useState<RoutineEntry[] | null>(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    getRoutine().then((r) => {
      setRoutineState(r);
      setShowForm(r.length === 0);
    });
  }, []);

  async function persist(next: RoutineEntry[]) {
    setRoutineState(next);
    await setRoutine(next);
  }

  async function handleAdd(entry: RoutineEntry) {
    const next = [...(routine ?? []), entry];
    await persist(next);
    setShowForm(false);
  }

  async function handleChangeSlot(id: string, slot: Slot) {
    if (!routine) return;
    await persist(routine.map((r) => (r.id === id ? { ...r, slot } : r)));
  }

  async function handleRemove(id: string) {
    if (!routine) return;
    await persist(routine.filter((r) => r.id !== id));
  }

  function openOptions() {
    if (chrome?.runtime?.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    }
  }

  return (
    <div className="w-[360px] p-4 font-sans text-sm text-slate-800">
      <header className="mb-3">
        <h1 className="text-lg font-semibold text-slate-900">Routine Check</h1>
        <p className="text-xs text-slate-500">
          Know if a skincare product fits your current routine.
        </p>
      </header>

      <section className="mb-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Your routine
          </h2>
          {routine && routine.length > 0 && (
            <button
              type="button"
              onClick={() => setShowForm((s) => !s)}
              className="text-xs font-medium text-slate-700 hover:text-slate-900"
            >
              {showForm ? 'Close' : '+ Add product'}
            </button>
          )}
        </div>

        {routine === null ? (
          <p className="text-xs text-slate-500">Loading…</p>
        ) : (
          <>
            {showForm && (
              <div className="mb-3 rounded border border-slate-200 bg-slate-50 p-3">
                <AddProductForm onAdd={handleAdd} />
              </div>
            )}
            <RoutineList
              routine={routine}
              onChangeSlot={handleChangeSlot}
              onRemove={handleRemove}
            />
          </>
        )}
      </section>

      <footer className="space-y-2 border-t border-slate-200 pt-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-slate-700">
          <button
            type="button"
            onClick={openOptions}
            className="underline-offset-2 hover:text-slate-900 hover:underline"
          >
            Preferences
          </button>
          <a
            href={PRIVACY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="underline-offset-2 hover:text-slate-900 hover:underline"
          >
            Privacy Policy
          </a>
          <a
            href={TERMS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="underline-offset-2 hover:text-slate-900 hover:underline"
          >
            Terms of Service
          </a>
        </div>
        <p className="text-[11px] leading-snug text-slate-500">
          This extension provides general information about cosmetic
          ingredients and product compatibility based on published cosmetic
          science. It is not medical advice and is not a substitute for
          consultation with a dermatologist or other qualified healthcare
          professional. We do not diagnose, treat, or prevent any skin
          condition. Individual reactions vary; always patch test new products.
        </p>
      </footer>
    </div>
  );
}
