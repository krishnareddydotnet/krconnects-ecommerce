import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Footer from '../src/components/Footer.jsx';
import { version } from '../package.json';

describe('Footer', () => {
  it('shows the app version from package.json', () => {
    render(<Footer />);

    // e.g. "v1.7.0": proves which release is running
    expect(screen.getByText(`· v${version}`, { exact: false })).toBeInTheDocument();
  });

  it('shows release 1.11.0 (search suggestions)', () => {
    render(<Footer />);

    expect(screen.getByText('· v1.11.0', { exact: false })).toBeInTheDocument();
  });
});
