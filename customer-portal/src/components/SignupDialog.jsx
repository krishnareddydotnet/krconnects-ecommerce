import { useState } from 'react';
import Modal from './Modal.jsx';

// SignupDialog has 2 steps:
//   Step 1: pick a username
//   Step 2: show the generated user key ONCE
// onSignup is async: it returns { userKey } if it worked, or { error } if not.
function SignupDialog({ onSignup, onCopyKey, onClose }) {
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [userKey, setUserKey] = useState(null); // null = still on step 1
  const [busy, setBusy] = useState(false);       // true while waiting for the Auth API

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const result = await onSignup(username.trim());
    setBusy(false);
    if (result.error) {
      setError(result.error);
    } else {
      setUserKey(result.userKey);  // move to step 2
    }
  }

  // ----- Step 2: show the key -----
  if (userKey) {
    return (
      <Modal titleId="signup-done-title" onClose={onClose}>
        <h2 id="signup-done-title">You're signed up!</h2>
        <p className="hint">This is your user key. <strong>Copy it now</strong> — it won't be shown again.</p>
        <p className="key-box">{userKey}</p>
        <div className="dialog-actions">
          <button className="btn btn-outline" type="button" onClick={() => onCopyKey(userKey)}>Copy key</button>
          <button className="btn btn-primary" type="button" onClick={onClose}>Done</button>
        </div>
      </Modal>
    );
  }

  // ----- Step 1: choose a username -----
  return (
    <Modal titleId="signup-title" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <h2 id="signup-title">Create your account</h2>
        <p className="hint">Just pick a username. We'll give you a private user key to log in with.</p>
        {error && <p className="message error" role="alert">{error}</p>}

        <div className="field">
          <label htmlFor="signup-username">Username</label>
          <input id="signup-username" required minLength={3} maxLength={50} autoComplete="username" autoFocus
            value={username} onChange={(e) => setUsername(e.target.value)} />
        </div>

        <div className="dialog-actions">
          <button className="btn btn-ghost" type="button" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? 'Signing up…' : 'Sign up'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default SignupDialog;
