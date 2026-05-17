import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DiagnosticsModal, type DiagnosticEvent } from './DiagnosticsModal';

describe('DiagnosticsModal', () => {
  it('shows empty diagnostic state', () => {
    render(<DiagnosticsModal events={[]} />);
    expect(screen.getByText(/no events seen yet/i)).toBeInTheDocument();
  });

  it('shows keyboard and gamepad diagnostic rows', () => {
    const events: DiagnosticEvent[] = [
      { source: 'keyboard', type: 'keydown', key: 'VolumeUp', code: 'VolumeUp', keyCode: 175, which: 175, repeat: false },
      { source: 'gamepad', type: 'press', gamepadIndex: 0, gamepadId: 'Generic Controller', buttonIndex: 2 },
    ];

    render(<DiagnosticsModal events={events} />);

    expect(screen.getByText(/\[key\] keydown/i)).toBeInTheDocument();
    expect(screen.getByText(/\[gamepad\] press/i)).toBeInTheDocument();
    expect(screen.getByText(/btn 2/i)).toBeInTheDocument();
  });
});
