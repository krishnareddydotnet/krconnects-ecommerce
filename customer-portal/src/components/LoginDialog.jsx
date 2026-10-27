import { useState } from 'react';
import Modal from './Modal.jsx';

// LoginDialog: username + user key.
// onLogin is async: it returns an error message (string) if login fails, or null if it worked.
function LoginDialog({ onLogin, onClose }) {
  const [username, setUsername] = useState('');
  const [userKey, setUserKey] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);   // true while waiting for the Auth API

  async function handleSubmit(event) {
    event.preventDefault();               // stop the browser reloading the page
    setBusy(true);
    setError('');
    const result = await onLogin(username.trim(), userKey.trim());
    setBusy(false);
    if (result) setError(result);         // show the error, keep the dialog open
  }

  return (
    <Modal titleId="login-title" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <h2 id="login-title">Log in</h2>
        <p className="hint">Use your username and the user key you got when you signed up.</p>
        {error && <p className="message error" role="alert">{error}</p>}

        <div className="field">
          <label htmlFor="login-username">Username</label>
          <input id="login-username" required autoComplete="username" autoFocus
            value={username} onChange={(e) => setUsername(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="login-key">User key</label>
          <input id="login-key" required autoComplete="current-password"
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            value={userKey} onChange={(e) => setUserKey(e.target.value)} />
        </div>

        <div className="dialog-actions">
          <button className="btn btn-ghost" type="button" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? 'Logging in…' : 'Log in'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default LoginDialog;
