import { useState } from 'react';
import type { RoutineEntry } from '@/lib/types';

type Slot = RoutineEntry['slot'];

interface Props {
  onAdd: (entry: RoutineEntry) => Promise<void> | void;
}

function parseIngredients(raw: string): string[] {
  return raw
    .split(/[,\n;]/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function AddProductForm({ onAdd }: Props) {
  const [name, setName] = useState('');
  const [ingredients, setIngredients] = useState('');
  const [slot, setSlot] = useState<Slot>('both');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    const parsed = parseIngredients(ingredients);
    if (!trimmedName) {
      setError('Add a product name.');
      return;
    }
    if (parsed.length === 0) {
      setError('Paste the ingredient list from the product page.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await onAdd({
        id: newId(),
        name: trimmedName,
        slot,
        ingredients_inci: parsed,
        added_at: Date.now(),
      });
      setName('');
      setIngredients('');
      setSlot('both');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <div>
        <label
          htmlFor="rc-name"
          className="mb-1 block text-xs font-medium text-slate-700"
        >
          Product name
        </label>
        <input
          id="rc-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. CeraVe Hydrating Cleanser"
          className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
        />
      </div>

      <div>
        <label
          htmlFor="rc-ingredients"
          className="mb-1 block text-xs font-medium text-slate-700"
        >
          Ingredients
        </label>
        <textarea
          id="rc-ingredients"
          value={ingredients}
          onChange={(e) => setIngredients(e.target.value)}
          placeholder="Paste the full ingredient list from the product page. Commas between ingredients."
          rows={4}
          className="w-full resize-none rounded border border-slate-300 px-2 py-1.5 text-xs leading-snug focus:border-slate-500 focus:outline-none"
        />
        <p className="mt-1 text-[11px] text-slate-500">
          Tip: on a Sephora page, open the &ldquo;Ingredients&rdquo; section and
          copy the whole list.
        </p>
      </div>

      <div>
        <span className="mb-1 block text-xs font-medium text-slate-700">
          When do you use it?
        </span>
        <div className="inline-flex overflow-hidden rounded border border-slate-300">
          {(['AM', 'PM', 'both'] as Slot[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSlot(s)}
              className={
                'px-3 py-1 text-xs ' +
                (slot === s
                  ? 'bg-slate-800 text-white'
                  : 'bg-white text-slate-700 hover:bg-slate-50')
              }
            >
              {s === 'both' ? 'Both' : s}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="text-xs text-rose-600" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
      >
        {busy ? 'Adding…' : 'Add to routine'}
      </button>
    </form>
  );
}
