import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Options } from '@/options/Options';
import { PRIVACY_URL, TERMS_URL } from '@/lib/links';

describe('Options page', () => {
  it('renders the §16.4 disclaimer verbatim', () => {
    render(<Options />);
    expect(
      screen.getByText(/not a substitute for consultation/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/we do not diagnose, treat, or prevent/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/always patch test new products/i),
    ).toBeInTheDocument();
  });

  it('renders Privacy Policy and Terms of Service links that open in a new tab', () => {
    render(<Options />);

    const privacy = screen.getByRole('link', { name: /privacy policy/i });
    expect(privacy).toHaveAttribute('href', PRIVACY_URL);
    expect(privacy).toHaveAttribute('target', '_blank');
    expect(privacy).toHaveAttribute('rel', expect.stringContaining('noopener'));

    const terms = screen.getByRole('link', { name: /terms of service/i });
    expect(terms).toHaveAttribute('href', TERMS_URL);
    expect(terms).toHaveAttribute('target', '_blank');
    expect(terms).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });
});
