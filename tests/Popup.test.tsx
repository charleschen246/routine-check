import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Popup } from '@/popup/Popup';
import { PRIVACY_URL, TERMS_URL } from '@/lib/links';
import type { RoutineEntry } from '@/lib/types';

const getStoredRoutine = () => globalThis.__testHelpers.getStoredRoutine();
const openOptionsPage = globalThis.__testHelpers.openOptionsPageMock;

async function fillAddForm(opts: { name: string; ingredients: string }) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(/product name/i), opts.name);
  await user.type(screen.getByLabelText(/ingredients/i), opts.ingredients);
  await user.click(screen.getByRole('button', { name: /add to routine/i }));
}

describe('Popup integration', () => {
  it('starts with an empty state and the add form visible', async () => {
    render(<Popup />);
    await waitFor(() =>
      expect(screen.getByText(/no products yet/i)).toBeInTheDocument(),
    );
    expect(screen.getByLabelText(/product name/i)).toBeInTheDocument();
  });

  it('persists a newly added product to chrome.storage', async () => {
    render(<Popup />);
    await waitFor(() =>
      expect(screen.getByLabelText(/product name/i)).toBeInTheDocument(),
    );

    await fillAddForm({
      name: 'CeraVe Hydrating Cleanser',
      ingredients: 'Water, Glycerin, Ceramide NP',
    });

    await waitFor(() =>
      expect(
        screen.getByText('CeraVe Hydrating Cleanser'),
      ).toBeInTheDocument(),
    );

    const stored = getStoredRoutine() as RoutineEntry[];
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      name: 'CeraVe Hydrating Cleanser',
      slot: 'both',
      ingredients_inci: ['Water', 'Glycerin', 'Ceramide NP'],
    });
  });

  it('collapses the add form after a successful add and reopens via the button', async () => {
    render(<Popup />);
    await waitFor(() =>
      expect(screen.getByLabelText(/product name/i)).toBeInTheDocument(),
    );

    await fillAddForm({ name: 'Test Product', ingredients: 'Water' });

    await waitFor(() =>
      expect(screen.queryByLabelText(/product name/i)).not.toBeInTheDocument(),
    );
    expect(
      screen.getByRole('button', { name: /\+ add product/i }),
    ).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /\+ add product/i }));
    expect(screen.getByLabelText(/product name/i)).toBeInTheDocument();
  });

  it('persists a slot change to chrome.storage', async () => {
    render(<Popup />);
    await waitFor(() =>
      expect(screen.getByLabelText(/product name/i)).toBeInTheDocument(),
    );

    await fillAddForm({ name: 'Sunscreen', ingredients: 'Zinc Oxide' });
    await waitFor(() =>
      expect(screen.getByText('Sunscreen')).toBeInTheDocument(),
    );

    const user = userEvent.setup();
    // The first AM button is inside the routine list item (the add form is collapsed now).
    await user.click(screen.getByRole('button', { name: 'AM' }));

    await waitFor(() => {
      const stored = getStoredRoutine() as RoutineEntry[];
      expect(stored[0].slot).toBe('AM');
    });
  });

  it('removes a product and falls back to the empty state', async () => {
    render(<Popup />);
    await waitFor(() =>
      expect(screen.getByLabelText(/product name/i)).toBeInTheDocument(),
    );

    await fillAddForm({ name: 'Removable', ingredients: 'Water' });
    await waitFor(() =>
      expect(screen.getByText('Removable')).toBeInTheDocument(),
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /remove removable/i }));

    await waitFor(() =>
      expect(screen.getByText(/no products yet/i)).toBeInTheDocument(),
    );
    expect((getStoredRoutine() as RoutineEntry[]) ?? []).toHaveLength(0);
  });

  it('opens the options page when Preferences is clicked', async () => {
    render(<Popup />);
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /preferences/i }),
      ).toBeInTheDocument(),
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /preferences/i }));
    expect(openOptionsPage).toHaveBeenCalledTimes(1);
  });

  it('renders the full §16.4 disclaimer verbatim', async () => {
    render(<Popup />);
    await waitFor(() =>
      expect(
        screen.getByText(/not a substitute for consultation/i),
      ).toBeInTheDocument(),
    );
    expect(
      screen.getByText(/we do not diagnose, treat, or prevent/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/always patch test new products/i),
    ).toBeInTheDocument();
  });

  it('renders Privacy Policy and Terms of Service links that open in a new tab', async () => {
    render(<Popup />);

    const privacy = await screen.findByRole('link', {
      name: /privacy policy/i,
    });
    expect(privacy).toHaveAttribute('href', PRIVACY_URL);
    expect(privacy).toHaveAttribute('target', '_blank');
    expect(privacy).toHaveAttribute('rel', expect.stringContaining('noopener'));

    const terms = screen.getByRole('link', { name: /terms of service/i });
    expect(terms).toHaveAttribute('href', TERMS_URL);
    expect(terms).toHaveAttribute('target', '_blank');
    expect(terms).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });
});
