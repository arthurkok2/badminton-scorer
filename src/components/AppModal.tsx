import { type ReactNode, useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';

interface AppModalProps {
  readonly title: string;
  readonly children: ReactNode;
  readonly onClose: () => void;
}

export function AppModal({ title, children, onClose }: AppModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButtonRef.current?.focus();

    return () => {
      previousFocusRef.current?.focus();
    };
  }, []);

  useEffect(() => {
    function handleTabKey(event: KeyboardEvent) {
      if (event.key !== 'Tab') return;

      const focusableElements = getFocusableElements(dialogRef.current);
      if (focusableElements.length === 0) {
        event.preventDefault();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
        return;
      }

      if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
        return;
      }

      handleTabKey(event);
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="modal-backdrop" data-testid="modal-backdrop" onMouseDown={onClose}>
      <section
        ref={dialogRef}
        className="app-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="app-modal-header">
          <h2 id={titleId}>{title}</h2>
          <button
            ref={closeButtonRef}
            type="button"
            className="icon-button app-modal-close"
            aria-label={`Close ${title}`}
            onClick={onClose}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>
        <div className="app-modal-body">{children}</div>
      </section>
    </div>
  );
}

function getFocusableElements(container: HTMLElement | null): HTMLElement[] {
  if (container === null) return [];

  return Array.from(
    container.querySelectorAll<HTMLElement>(
      [
        'a[href]',
        'button:not([disabled])',
        'input:not([disabled])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        '[tabindex]:not([tabindex="-1"])',
      ].join(','),
    ),
  ).filter((element) => !element.hasAttribute('hidden') && element.getAttribute('aria-hidden') !== 'true');
}
