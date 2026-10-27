import { useEffect } from 'react';

// Modal: dark backdrop + white box. Used by LoginDialog and SignupDialog.
// Closes when you click the backdrop or press the Escape key.
function Modal({ titleId, onClose, children }) {
  // Listen for the Escape key while the modal is open
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown); // clean up when it closes
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      {/* stopPropagation: clicks inside the box must NOT close the modal */}
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

export default Modal;
