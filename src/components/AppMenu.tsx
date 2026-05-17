import { useEffect, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Bell, Bluetooth, ClipboardList, MonitorPlay, RotateCcw, Settings, Users } from 'lucide-react';

export type AppMenuAction =
  | 'matchSettings'
  | 'announcementSettings'
  | 'displaySettings'
  | 'remoteControls'
  | 'diagnostics'
  | 'sessionMode'
  | 'newMatch';

interface AppMenuProps {
  readonly onAction: (action: AppMenuAction) => void;
  readonly availableActions?: readonly AppMenuAction[];
}

const items: ReadonlyArray<{ action: AppMenuAction; label: string; icon: LucideIcon }> = [
  { action: 'matchSettings', label: 'Match settings', icon: Users },
  { action: 'announcementSettings', label: 'Announcement settings', icon: Bell },
  { action: 'displaySettings', label: 'Display settings', icon: MonitorPlay },
  { action: 'remoteControls', label: 'Remote controls', icon: Bluetooth },
  { action: 'diagnostics', label: 'Diagnostics', icon: ClipboardList },
  { action: 'sessionMode', label: 'Session mode', icon: Users },
  { action: 'newMatch', label: 'New match', icon: RotateCcw },
];

export function AppMenu({ onAction, availableActions }: AppMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const visibleItems = availableActions === undefined
    ? items
    : items.filter((item) => availableActions.includes(item.action));

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (menuRef.current?.contains(event.target as Node)) return;
      setIsOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false);
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className="app-menu" ref={menuRef}>
      <button
        ref={buttonRef}
        type="button"
        className="app-menu-button"
        aria-label="Settings menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? 'app-menu-dropdown' : undefined}
        onClick={() => setIsOpen((current) => !current)}
      >
        <Settings size={22} aria-hidden="true" />
      </button>

      {isOpen ? (
        <div id="app-menu-dropdown" className="account-dropdown app-menu-dropdown" aria-label="Settings menu tools">
          {visibleItems.map(({ action, label, icon: Icon }) => (
            <button
              key={action}
              type="button"
              className="account-menu-item"
              onClick={() => {
                setIsOpen(false);
                buttonRef.current?.focus();
                onAction(action);
              }}
            >
              <Icon aria-hidden="true" size={16} />
              <span>{label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
