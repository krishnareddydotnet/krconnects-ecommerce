import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../src/App.jsx';
import { fakeFetch, KEY } from './fakeApi.js';

function renderApp() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <App />
    </MemoryRouter>
  );
}

describe('Sign up and log in (Auth API)', () => {
  beforeEach(() => {
    localStorage.clear();
    global.fetch = vi.fn(fakeFetch);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('signs up a new user and shows the user key from the API', async () => {
    renderApp();
    await screen.findByText('Wireless Mouse');

    fireEvent.click(screen.getByRole('button', { name: 'Sign up' }));
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'krishna' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Sign up' }).at(-1)); // the dialog's button

    expect(await screen.findByText(KEY)).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith('/api/auth/signup', expect.objectContaining({ method: 'POST' }));
  });

  it('shows an error when the username already exists', async () => {
    renderApp();
    await screen.findByText('Wireless Mouse');

    fireEvent.click(screen.getByRole('button', { name: 'Sign up' }));
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'taken' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Sign up' }).at(-1)); // the dialog's button

    expect(await screen.findByText('That username is already taken.')).toBeInTheDocument();
  });

  it('logs in, saves the token and shows the username', async () => {
    renderApp();
    await screen.findByText('Wireless Mouse');

    fireEvent.click(screen.getByRole('button', { name: 'Log in' }));
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'krishna' } });
    fireEvent.change(screen.getByLabelText('User key'), { target: { value: KEY } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Log in' }).at(-1));

    expect(await screen.findByText('Hi, krishna')).toBeInTheDocument();
    expect(localStorage.getItem('krconnects_token')).toBe('test-token');
  });

  it('shows an error for a wrong user key', async () => {
    renderApp();
    await screen.findByText('Wireless Mouse');

    fireEvent.click(screen.getByRole('button', { name: 'Log in' }));
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'krishna' } });
    fireEvent.change(screen.getByLabelText('User key'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Log in' }).at(-1));

    expect(await screen.findByText('Invalid username or user key.')).toBeInTheDocument();
  });

  it('stays logged in after a refresh when a valid token is saved', async () => {
    localStorage.setItem('krconnects_token', 'test-token'); // like a previous login

    renderApp();

    expect(await screen.findByText('Hi, krishna')).toBeInTheDocument();
  });

  it('forgets an invalid saved token', async () => {
    localStorage.setItem('krconnects_token', 'expired-token');

    renderApp();
    await screen.findByText('Wireless Mouse');

    await vi.waitFor(() => expect(localStorage.getItem('krconnects_token')).toBeNull());
    expect(screen.getByRole('button', { name: 'Log in' })).toBeInTheDocument();
  });

  it('log out removes the token', async () => {
    localStorage.setItem('krconnects_token', 'test-token');
    renderApp();
    await screen.findByText('Hi, krishna');

    fireEvent.click(screen.getByRole('button', { name: 'Log out' }));

    expect(localStorage.getItem('krconnects_token')).toBeNull();
    expect(screen.getByRole('button', { name: 'Log in' })).toBeInTheDocument();
  });
});
