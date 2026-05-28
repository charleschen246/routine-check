import type { RoutineEntry } from '@/lib/types';

type Slot = RoutineEntry['slot'];

interface Props {
  routine: RoutineEntry[];
  onChangeSlot: (id: string, slot: Slot) => void;
  onRemove: (id: string) => void;
}

const SLOTS: Slot[] = ['AM', 'PM', 'both'];

export function RoutineList({ routine, onChangeSlot, onRemove }: Props) {
  if (routine.length === 0) {
    return (
      <p className="text-xs text-slate-500">
        No products yet. Add a few of the products you already use so the
        extension can check new ones against them.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {routine.map((r) => (
        <li
          key={r.id}
          className="rounded border border-slate-200 bg-white p-2"
        >
          <div className="mb-1 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-slate-900">
                {r.name}
              </div>
              <div className="text-[11px] text-slate-500">
                {r.ingredients_inci.length} ingredient
                {r.ingredients_inci.length === 1 ? '' : 's'} saved
              </div>
            </div>
            <button
              type="button"
              onClick={() => onRemove(r.id)}
              className="shrink-0 rounded px-2 py-0.5 text-[11px] text-slate-500 hover:bg-slate-100 hover:text-rose-600"
              aria-label={`Remove ${r.name}`}
            >
              Remove
            </button>
          </div>
          <div className="inline-flex overflow-hidden rounded border border-slate-300">
            {SLOTS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onChangeSlot(r.id, s)}
                className={
                  'px-2.5 py-0.5 text-[11px] ' +
                  (r.slot === s
                    ? 'bg-slate-800 text-white'
                    : 'bg-white text-slate-700 hover:bg-slate-50')
                }
              >
                {s === 'both' ? 'Both' : s}
              </button>
            ))}
          </div>
        </li>
      ))}
    </ul>
  );
}
