import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import PromoBanner from '../src/components/PromoBanner.jsx';

describe('PromoBanner', () => {
  it('shows the current offer', () => {
    render(<PromoBanner />);

    // The banner is findable by its accessible name
    const banner = screen.getByRole('region', { name: 'Current offer' });
    expect(banner).toBeInTheDocument();

    // ...and it shows the offer text with a version label (v1, v2 ... used for canary practice)
    expect(banner).toHaveTextContent(/^NEW: Free delivery on all orders this week - v\d+$/);
  });
});
