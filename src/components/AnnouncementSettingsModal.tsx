import { Volume2, VolumeX } from 'lucide-react';
import type { AnnouncementMode, SpeechStatus } from '../speech/announcer';

interface AnnouncementSettingsModalProps {
  readonly autoAnnounce: boolean;
  readonly announcementMode: AnnouncementMode;
  readonly speechStatus: SpeechStatus;
  readonly onAutoAnnounceChange: (enabled: boolean) => void;
  readonly onAnnouncementModeChange: (mode: AnnouncementMode) => void;
}

export function AnnouncementSettingsModal({
  autoAnnounce,
  announcementMode,
  speechStatus,
  onAutoAnnounceChange,
  onAnnouncementModeChange,
}: AnnouncementSettingsModalProps) {
  return (
    <div className="settings-panel">
      <button
        className={autoAnnounce ? 'toggle-button is-on' : 'toggle-button'}
        type="button"
        role="switch"
        aria-checked={autoAnnounce}
        aria-label="Auto announce"
        onClick={() => onAutoAnnounceChange(!autoAnnounce)}
      >
        {autoAnnounce ? <Volume2 size={20} aria-hidden="true" /> : <VolumeX size={20} aria-hidden="true" />}
        Auto announce
      </button>

      <div className="mode-toggle" role="group" aria-label="Announcement mode">
        <button
          type="button"
          className={announcementMode === 'full' ? 'mode-option is-selected' : 'mode-option'}
          aria-pressed={announcementMode === 'full'}
          disabled={announcementMode === 'full'}
          onClick={() => onAnnouncementModeChange('full')}
        >
          Full announcement
        </button>
        <button
          type="button"
          className={announcementMode === 'short' ? 'mode-option is-selected' : 'mode-option'}
          aria-pressed={announcementMode === 'short'}
          disabled={announcementMode === 'short'}
          onClick={() => onAnnouncementModeChange('short')}
        >
          Short announcement
        </button>
      </div>

      <p className="settings-note">Speech {speechStatus === 'available' ? 'ready' : 'unsupported'}</p>
    </div>
  );
}
