import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../src/App.jsx';
import { fakeFetch } from './fakeApi.js';

// The search box lives in the header, so we render the whole App
// (with the fake backend) and type into the box like a user would.
function renderApp(url = '/') {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <App />
    </MemoryRouter>
  );
}

// The suggestion rows (scoped to the dropdown, because the sort <select> also has options)
async function findSuggestions() {
  const list = await screen.findByRole('listbox', { name: 'Search suggestions' });
  return within(list).getAllByRole('option');
}

function typeInSearch(text) {
  fireEvent.change(screen.getByPlaceholderText('Search by name or category'), {
    target: { value: text }
  });
}

describe('SearchBox (search suggestions)', () => {
  beforeEach(() => {
    global.fetch = vi.fn(fakeFetch);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows suggestions with category and price after typing 2+ letters', async () => {
    renderApp();
    await screen.findByText('Wireless Mouse');

    typeInSearch('desk');

    const [option] = await findSuggestions();
    expect(option).toHaveTextContent('Standing Desk');
    expect(option).toHaveTextContent('Furniture');
    expect(option).toHaveTextContent('₹5,199.00');
  });

  it('asks the API for only 5 suggestions', async () => {
    renderApp();
    await screen.findByText('Wireless Mouse');

    typeInSearch('gadget');

    expect(await findSuggestions()).toHaveLength(5);
    expect(global.fetch).toHaveBeenCalledWith('/catalog-api/products/paged?page=1&pageSize=5&sort=featured&search=gadget');
    expect(screen.getByRole('button', { name: /See all 26 results/ })).toBeInTheDocument();
  });

  it('does not suggest for a single letter', async () => {
    renderApp();
    await screen.findByText('Wireless Mouse');

    typeInSearch('d');

    // wait longer than the 300 ms pause, then check nothing was shown
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('opens the product page when a suggestion is clicked', async () => {
    renderApp();
    await screen.findByText('Wireless Mouse');

    typeInSearch('desk');
    const [option] = await findSuggestions();
    fireEvent.mouseDown(option);

    // product details page shows the product name as the main heading
    expect(await screen.findByRole('heading', { level: 1, name: 'Standing Desk' })).toBeInTheDocument();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('arrow down + Enter opens the highlighted suggestion', async () => {
    renderApp();
    await screen.findByText('Wireless Mouse');

    typeInSearch('desk');
    const [option] = await findSuggestions();

    const input = screen.getByPlaceholderText('Search by name or category');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(option).toHaveAttribute('aria-selected', 'true');

    fireEvent.keyDown(input, { key: 'Enter' });
    expect(await screen.findByRole('heading', { level: 1, name: 'Standing Desk' })).toBeInTheDocument();
  });

  it('Escape closes the suggestions', async () => {
    renderApp();
    await screen.findByText('Wireless Mouse');

    typeInSearch('desk');
    await screen.findByRole('listbox');

    fireEvent.keyDown(screen.getByPlaceholderText('Search by name or category'), { key: 'Escape' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});
