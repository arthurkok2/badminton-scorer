import { type ReactNode, useEffect, useId } from 'react';
import { X } from 'lucide-react';

interface AppModalProps {
  readonly title: string;
  readonly children: ReactNode;
  readonly onClose: () => void;
}

export function AppModal({ title, children, onClose }: AppModalProps) {
  const titleId = useId();

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="modal-backdrop" data-testid="modal-backdrop" onMouseDown={onClose}>
      <section
        className="app-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="app-modal-header">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="icon-button app-modal-close" aria-label={`Close ${title}`} onClick={onClose}>
            <X size={20} aria-hidden="true" />
          </button>
        </header>
        <div className="app-modal-body">{children}</div>
      </section>
    </div>
  );
}
