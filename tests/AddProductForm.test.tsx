import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AddProductForm } from '@/popup/AddProductForm';

describe('AddProductForm', () => {
  it('rejects submission without a name', async () => {
    const onAdd = vi.fn();
    render(<AddProductForm onAdd={onAdd} />);
    const user = userEvent.setup();

    await user.type(
      screen.getByLabelText(/ingredients/i),
      'Water, Glycerin, Niacinamide',
    );
    await user.click(screen.getByRole('button', { name: /add to routine/i }));

    expect(onAdd).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/product name/i);
  });

  it('rejects submission without ingredients', async () => {
    const onAdd = vi.fn();
    render(<AddProductForm onAdd={onAdd} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/product name/i), 'CeraVe Cleanser');
    await user.click(screen.getByRole('button', { name: /add to routine/i }));

    expect(onAdd).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/ingredient list/i);
  });

  it('parses comma-separated ingredients and submits', async () => {
    const onAdd = vi.fn();
    render(<AddProductForm onAdd={onAdd} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/product name/i), 'CeraVe Cleanser');
    await user.type(
      screen.getByLabelText(/ingredients/i),
      'Water, Glycerin , Niacinamide,Ceramide NP',
    );
    await user.click(screen.getByRole('button', { name: /add to routine/i }));

    expect(onAdd).toHaveBeenCalledTimes(1);
    const entry = onAdd.mock.calls[0][0];
    expect(entry).toMatchObject({
      name: 'CeraVe Cleanser',
      slot: 'both',
      ingredients_inci: ['Water', 'Glycerin', 'Niacinamide', 'Ceramide NP'],
    });
    expect(entry.id).toEqual(expect.any(String));
    expect(entry.added_at).toEqual(expect.any(Number));
  });

  it('also splits on semicolons and newlines', async () => {
    const onAdd = vi.fn();
    render(<AddProductForm onAdd={onAdd} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/product name/i), 'Test');
    await user.type(
      screen.getByLabelText(/ingredients/i),
      'Water;Glycerin{enter}Niacinamide',
    );
    await user.click(screen.getByRole('button', { name: /add to routine/i }));

    const entry = onAdd.mock.calls[0][0];
    expect(entry.ingredients_inci).toEqual([
      'Water',
      'Glycerin',
      'Niacinamide',
    ]);
  });

  it('switches the slot when AM is selected', async () => {
    const onAdd = vi.fn();
    render(<AddProductForm onAdd={onAdd} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/product name/i), 'Vitamin C Serum');
    await user.type(screen.getByLabelText(/ingredients/i), 'Ascorbic Acid');
    await user.click(screen.getByRole('button', { name: 'AM' }));
    await user.click(screen.getByRole('button', { name: /add to routine/i }));

    expect(onAdd.mock.calls[0][0].slot).toBe('AM');
  });

  it('clears inputs after a successful add', async () => {
    const onAdd = vi.fn();
    render(<AddProductForm onAdd={onAdd} />);
    const user = userEvent.setup();

    const nameInput = screen.getByLabelText(/product name/i) as HTMLInputElement;
    const ingInput = screen.getByLabelText(/ingredients/i) as HTMLTextAreaElement;

    await user.type(nameInput, 'Test');
    await user.type(ingInput, 'Water');
    await user.click(screen.getByRole('button', { name: /add to routine/i }));

    expect(nameInput.value).toBe('');
    expect(ingInput.value).toBe('');
  });
});
