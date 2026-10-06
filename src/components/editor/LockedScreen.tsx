import React, { useState, useEffect, useCallback } from 'react';
import { useNotes } from '../../state/NotesContext';
import { Shield, Lock, Delete } from 'lucide-react';

export const LockedScreen: React.FC = () => {
  const { activeNote, unlockNote } = useNotes();
  const [enteredPin, setEnteredPin] = useState('');
  const [pinError, setPinError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleDigit = useCallback(async (digit: string) => {
    if (!activeNote || isSubmitting) return;
    if (enteredPin.length >= 3) return;

    const next = enteredPin + digit;
    setEnteredPin(next);
    setPinError(false);

    if (next.length === 3) {
      setIsSubmitting(true);
      const success = await unlockNote(activeNote.id, next);
      setIsSubmitting(false);

      if (!success) {
        setPinError(true);
        setTimeout(() => {
          setEnteredPin('');
          setPinError(false);
        }, 600);
      }
    }
  }, [activeNote, enteredPin, isSubmitting, unlockNote]);

  const handleDelete = useCallback(() => {
    setEnteredPin(prev => prev.slice(0, -1));
    setPinError(false);
  }, []);

  const handleClear = useCallback(() => {
    setEnteredPin('');
    setPinError(false);
  }, []);

  // Listen to keyboard input for desktop convenience
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if modifier keys are pressed
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        handleDigit(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleDelete();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleClear();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleDigit, handleDelete, handleClear]);

  if (!activeNote) return null;

  return (
    <div className="locked-screen-stage">
      <div className="locked-card">
        <div className="lock-icon-badge">
          <Lock size={28} />
        </div>

        <h2 className="locked-title">Protected Document</h2>
        <p className="locked-doc-name">{activeNote.title.trim() || 'Untitled Document'}</p>

        {/* 3-Digit PIN Indicator Dots */}
        <div className={`pin-dots-row ${pinError ? 'pin-dots-error' : ''}`}>
          {[0, 1, 2].map(idx => (
            <div
              key={idx}
              className={`pin-dot ${enteredPin.length > idx ? 'filled' : ''} ${pinError ? 'error' : ''}`}
            />
          ))}
        </div>

        <p className={`pin-prompt-text ${pinError ? 'error' : ''}`}>
          {pinError ? 'Incorrect PIN. Try again.' : 'Enter 3-digit PIN or use numeric keys'}
        </p>

        {/* Numeric On-Screen Keypad */}
        <div className="keypad-grid">
          {[
            ['1', '2', '3'],
            ['4', '5', '6'],
            ['7', '8', '9'],
            ['Clear', '0', 'del']
          ].map((row, rIdx) => (
            <div key={rIdx} className="keypad-row">
              {row.map(val => (
                <button
                  key={val}
                  type="button"
                  className={`keypad-btn ${val === 'Clear' || val === 'del' ? 'action' : ''}`}
                  onClick={() => {
                    if (val === 'Clear') handleClear();
                    else if (val === 'del') handleDelete();
                    else handleDigit(val);
                  }}
                  disabled={isSubmitting}
                >
                  {val === 'del' ? <Delete size={18} /> : val}
                </button>
              ))}
            </div>
          ))}
        </div>

        <div className="locked-footer-hint">
          <Shield size={13} />
          <span>PaperNotes Client-side Security</span>
        </div>
      </div>
    </div>
  );
};
