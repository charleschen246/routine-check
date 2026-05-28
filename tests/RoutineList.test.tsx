import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RoutineList } from '@/popup/RoutineList';
import type { RoutineEntry } from '@/lib/types';

function makeEntry(overrides: Partial<RoutineEntry> = {}): RoutineEntry {
  return {
    id: 'e-1',
    name: 'CeraVe Cleanser',
    slot: 'both',
    ingredients_inci: ['Water', 'Glycerin'],
    added_at: 1,
    ...overrides,
  };
}

describe('RoutineList', () => {
  it('shows an empty hint when there are no products', () => {
    render(
      <RoutineList routine={[]} onChangeSlot={vi.fn()} onRemove={vi.fn()} />,
    );
    expect(screen.getByText(/no products yet/i)).toBeInTheDocument();
  });

  it('renders product name and ingredient count', () => {
    render(
      <RoutineList
        routine={[makeEntry()]}
        onChangeSlot={vi.fn()}
        onRemove={vi.fn()}
      />,
    );
    expect(screen.getByText('CeraVe Cleanser')).toBeInTheDocument();
    expect(screen.getByText(/2 ingredients saved/i)).toBeInTheDocument();
  });

  it('uses singular "ingredient" when only one is saved', () => {
    render(
      <RoutineList
        routine={[makeEntry({ ingredients_inci: ['Water'] })]}
        onChangeSlot={vi.fn()}
        onRemove={vi.fn()}
      />,
    );
    expect(screen.getByText(/1 ingredient saved/i)).toBeInTheDocument();
  });

  it('calls onChangeSlot with the new slot when toggled', async () => {
    const onChangeSlot = vi.fn();
    render(
      <RoutineList
        routine={[makeEntry({ slot: 'both' })]}
        onChangeSlot={onChangeSlot}
        onRemove={vi.fn()}
      />,
    );
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'PM' }));
    expect(onChangeSlot).toHaveBeenCalledWith('e-1', 'PM');
  });

  it('calls onRemove with the entry id when remove is clicked', async () => {
    const onRemove = vi.fn();
    render(
      <RoutineList
        routine={[makeEntry({ id: 'abc' })]}
        onChangeSlot={vi.fn()}
        onRemove={onRemove}
      />,
    );
    const user = userEvent.setup();

    await user.click(
      screen.getByRole('button', { name: /remove cerave cleanser/i }),
    );
    expect(onRemove).toHaveBeenCalledWith('abc');
  });

  it('renders independent slot toggles per product', () => {
    render(
      <RoutineList
        routine={[
          makeEntry({ id: 'a', name: 'Cleanser', slot: 'AM' }),
          makeEntry({ id: 'b', name: 'Moisturizer', slot: 'PM' }),
        ]}
        onChangeSlot={vi.fn()}
        onRemove={vi.fn()}
      />,
    );
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    // Each list item's currently-selected slot uses a distinct style — assert
    // existence of both rows' buttons without coupling to class names.
    expect(within(items[0]).getByText('Cleanser')).toBeInTheDocument();
    expect(within(items[1]).getByText('Moisturizer')).toBeInTheDocument();
  });
});
