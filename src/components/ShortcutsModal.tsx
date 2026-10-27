import React from 'react';

interface ShortcutsModalProps {
  open: boolean;
  onClose: () => void;
}

const SHORTCUTS: Array<{ keys: string[]; label: string }> = [
  { keys: ['←'], label: 'Previous execution step' },
  { keys: ['→'], label: 'Next execution step' },
  { keys: ['Space'], label: 'Play / pause the trace' },
  { keys: ['Ctrl', 'Enter'], label: 'Run and trace the current program' },
  { keys: ['T'], label: 'Toggle dark / light theme' },
  { keys: ['?'], label: 'Open this shortcut reference' },
  { keys: ['Esc'], label: 'Close dialogs' },
];

const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ open, onClose }) => {
  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className='modal-backdrop'
      role='presentation'
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className='modal' role='dialog' aria-modal='true' aria-labelledby='shortcuts-title'>
        <h2 id='shortcuts-title'>Keyboard shortcuts</h2>
        <p className='modal-sub'>
          Shortcuts are paused while you type in the editor, an input or a select field.
        </p>
        <div className='shortcut-list'>
          {SHORTCUTS.map((shortcut) => (
            <div className='shortcut-row' key={shortcut.label}>
              <span>{shortcut.label}</span>
              <span style={{ display: 'inline-flex', gap: 4 }}>
                {shortcut.keys.map((key) => (
                  <kbd className='kbd' key={key}>
                    {key}
                  </kbd>
                ))}
              </span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <button type='button' className='btn btn-primary' onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShortcutsModal;
