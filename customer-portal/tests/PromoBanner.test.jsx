import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import PromoBanner from '../src/components/PromoBanner.jsx';

describe('PromoBanner', () => {
  it('shows the current offer', () => {
    render(<PromoBanner />);

    // The banner is findable by its accessible name
    const banner = screen.getByRole('region', { name: 'Current offer' });
    expect(banner).toBeInTheDocument();

    // ...and it shows the v2 offer text (canary release)
    expect(banner).toHaveTextContent('NEW: Free delivery on all orders this week - v2');
  });
});
