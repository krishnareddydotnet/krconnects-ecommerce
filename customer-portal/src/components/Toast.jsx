// Toast: small message at the bottom of the screen ("... added to cart").
// App decides when to show and hide it.
function Toast({ message }) {
  return (
    <div className={message ? 'toast show' : 'toast'} role="status" aria-live="polite">
      {message}
    </div>
  );
}

export default Toast;
