import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CourtView } from './CourtView';
import { createMatch } from '../domain/matchEngine';
import type { MatchState } from '../domain/matchTypes';

let fullscreenElement: Element | null = null;

function installFullscreenMock() {
  fullscreenElement = null;
  const requestFullscreen = vi.fn(function requestFullscreen(this: Element) {
    fullscreenElement = this;
    document.dispatchEvent(new Event('fullscreenchange'));
    return Promise.resolve();
  });
  const exitFullscreen = vi.fn(() => {
    fullscreenElement = null;
    document.dispatchEvent(new Event('fullscreenchange'));
    return Promise.resolve();
  });

  Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', {
    configurable: true,
    value: requestFullscreen,
  });
  Object.defineProperty(document, 'exitFullscreen', {
    configurable: true,
    value: exitFullscreen,
  });
  Object.defineProperty(document, 'fullscreenElement', {
    configurable: true,
    get: () => fullscreenElement,
  });

  return { requestFullscreen, exitFullscreen };
}

afterEach(() => {
  fullscreenElement = null;
  vi.restoreAllMocks();
});

describe('CourtView', () => {
  it('renders a dimensionally scaled badminton court with all regulation lines', () => {
    render(
      <CourtView
        match={createMatch({ mode: 'doubles', initialServingTeamId: 'teamA', initialServingPlayerId: 'A1' })}
        onPointTeam={vi.fn()}
      />,
    );

    const court = screen.getByTestId('court-diagram');

    expect(court).toHaveAttribute('viewBox', '0 0 1340 610');
    expect(court).toHaveAttribute('aria-label', 'Badminton court scaled to 13.40m by 6.10m');
    expect(screen.getByTestId('court-boundary')).toBeInTheDocument();
    expect(screen.getByTestId('singles-sideline-left')).toBeInTheDocument();
    expect(screen.getByTestId('singles-sideline-right')).toBeInTheDocument();
    expect(screen.getByTestId('short-service-line-top')).toBeInTheDocument();
    expect(screen.getByTestId('short-service-line-bottom')).toBeInTheDocument();
    expect(screen.getByTestId('doubles-long-service-line-top')).toBeInTheDocument();
    expect(screen.getByTestId('doubles-long-service-line-bottom')).toBeInTheDocument();
    expect(screen.getByTestId('center-service-line-top')).toBeInTheDocument();
    expect(screen.getByTestId('center-service-line-bottom')).toBeInTheDocument();
    expect(screen.getByTestId('court-net')).toBeInTheDocument();
  });

  it('keeps each player label centered inside its chip', () => {
    render(
      <CourtView
        match={createMatch({ mode: 'doubles', initialServingTeamId: 'teamA', initialServingPlayerId: 'A1' })}
        onPointTeam={vi.fn()}
      />,
    );

    for (const name of ['Player 1', 'Player 2', 'Player 3', 'Player 4']) {
      const chip = screen.getByText(name).closest('.player-chip');

      expect(chip).toBeInTheDocument();
      expect(chip).toHaveClass('player-chip');
    }
  });

  it('shows only the player name in each court chip', () => {
    render(
      <CourtView
        match={createMatch({ mode: 'doubles', initialServingTeamId: 'teamA', initialServingPlayerId: 'A1' })}
        onPointTeam={vi.fn()}
      />,
    );

    expect(screen.queryByText('Server')).not.toBeInTheDocument();
    expect(screen.queryByText('Receiver')).not.toBeInTheDocument();
    expect(screen.queryByText(/right court/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/left court/i)).not.toBeInTheDocument();
  });

  it('mirrors visual court lanes for the team on the right side of the net', () => {
    render(
      <CourtView
        match={createMatch({ mode: 'doubles', initialServingTeamId: 'teamA', initialServingPlayerId: 'A1' })}
        onPointTeam={vi.fn()}
      />,
    );

    expect(screen.getByText('Player 1').closest('.court-slot')).toHaveClass('court-lane-bottom');
    expect(screen.getByText('Player 2').closest('.court-slot')).toHaveClass('court-lane-top');
    expect(screen.getByText('Player 3').closest('.court-slot')).toHaveClass('court-lane-top');
    expect(screen.getByText('Player 4').closest('.court-slot')).toHaveClass('court-lane-bottom');
  });

  it('renders score-only buttons joined in one center score box', () => {
    render(
      <CourtView
        match={createMatch({ mode: 'doubles', initialServingTeamId: 'teamA', initialServingPlayerId: 'A1' })}
        onPointTeam={vi.fn()}
      />,
    );

    const scoreBox = screen.getByLabelText(/score controls/i);
    const teamAScore = screen.getByRole('button', { name: /award point to team a, score 0/i });
    const teamBScore = screen.getByRole('button', { name: /award point to team b, score 0/i });

    expect(scoreBox).toHaveClass('court-score-box');
    expect(scoreBox).toContainElement(teamAScore);
    expect(scoreBox).toContainElement(teamBScore);
    expect(teamAScore).toHaveClass('court-score-button', 'teamA', 'is-serving');
    expect(teamBScore).toHaveClass('court-score-button', 'teamB');
    expect(teamAScore).toHaveTextContent(/^0$/);
    expect(teamBScore).toHaveTextContent(/^0$/);
    expect(teamAScore).not.toHaveTextContent(/team a/i);
    expect(teamBScore).not.toHaveTextContent(/team b/i);
  });

  it('awards points from the overlaid court score buttons', async () => {
    const user = userEvent.setup();
    const onPointTeam = vi.fn();

    render(
      <CourtView
        match={createMatch({ mode: 'doubles', initialServingTeamId: 'teamA', initialServingPlayerId: 'A1' })}
        onPointTeam={onPointTeam}
      />,
    );

    await user.click(screen.getByRole('button', { name: /award point to team a, score 0/i }));
    await user.click(screen.getByRole('button', { name: /award point to team b, score 0/i }));

    expect(onPointTeam).toHaveBeenNthCalledWith(1, 'teamA');
    expect(onPointTeam).toHaveBeenNthCalledWith(2, 'teamB');
  });

  it('disables both score buttons after a winner is decided', () => {
    const winnerMatch: MatchState = {
      ...createMatch({ mode: 'doubles', initialServingTeamId: 'teamA', initialServingPlayerId: 'A1' }),
      score: { teamA: 21, teamB: 10 },
      winnerTeamId: 'teamA',
    };

    render(<CourtView match={winnerMatch} onPointTeam={vi.fn()} />);

    expect(screen.getByRole('button', { name: /award point to team a, score 21/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /award point to team b, score 10/i })).toBeDisabled();
  });

  it('toggles fullscreen for the shared court section in both display modes', async () => {
    const user = userEvent.setup();
    const fullscreen = installFullscreenMock();
    const match = createMatch({ mode: 'doubles', initialServingTeamId: 'teamA', initialServingPlayerId: 'A1' });
    const { rerender } = render(<CourtView match={match} onPointTeam={vi.fn()} />);

    const enterButton = screen.getByRole('button', { name: /enter fullscreen court view/i });
    await user.click(enterButton);

    expect(fullscreen.requestFullscreen).toHaveBeenCalledTimes(1);
    expect(fullscreen.requestFullscreen.mock.instances[0]).toBe(screen.getByLabelText('Match court'));

    await user.click(screen.getByRole('button', { name: /exit fullscreen court view/i }));

    expect(fullscreen.exitFullscreen).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: /enter fullscreen court view/i })).toBeInTheDocument();

    rerender(<CourtView match={match} displayMode="little-fighters" onPointTeam={vi.fn()} />);

    expect(screen.getByRole('button', { name: /enter fullscreen court view/i })).toBeInTheDocument();
  });

  it('renders the little fighters mode with score, health, and serving markers', () => {
    const match: MatchState = {
      ...createMatch({ mode: 'doubles', initialServingTeamId: 'teamA', initialServingPlayerId: 'A1' }),
      score: { teamA: 5, teamB: 3 },
      servingTeamId: 'teamB',
      serverId: 'B2',
      courtPositions: {
        A1: 'left',
        A2: 'right',
        B1: 'left',
        B2: 'right',
      },
    };

    render(<CourtView match={match} displayMode="little-fighters" onPointTeam={vi.fn()} />);

    expect(screen.getByTestId('little-fighters-view')).toBeInTheDocument();
    expect(screen.getByTestId('fighters-court-svg')).toBeInTheDocument();
    expect(screen.getByRole('meter', { name: /team a health/i })).toHaveAttribute('aria-valuenow', '86');
    expect(screen.getByRole('meter', { name: /team b health/i })).toHaveAttribute('aria-valuenow', '76');
    expect(screen.getByText('Serve')).toBeInTheDocument();
    expect(screen.getByTestId('fighter-B2')).toHaveClass('is-server');
    expect(screen.getByTestId('fighter-B2')).toHaveAttribute('data-quadrant', 'top');
    expect(screen.getByTestId('fighter-B1')).toHaveAttribute('data-quadrant', 'bottom');
  });

  it('renders deterministic badminton roster sprites for each little fighter slot', () => {
    render(
      <CourtView
        match={createMatch({ mode: 'doubles', initialServingTeamId: 'teamA', initialServingPlayerId: 'A1' })}
        displayMode="little-fighters"
        onPointTeam={vi.fn()}
      />,
    );

    expect(screen.getByTestId('fighter-A1').querySelector('.fighter-sprite')).toHaveAttribute(
      'src',
      expect.stringContaining('badminton-female-ace.png'),
    );
    expect(screen.getByTestId('fighter-A2').querySelector('.fighter-sprite')).toHaveAttribute(
      'src',
      expect.stringContaining('badminton-male-clear.png'),
    );
    expect(screen.getByTestId('fighter-B1').querySelector('.fighter-sprite')).toHaveAttribute(
      'src',
      expect.stringContaining('badminton-female-drive.png'),
    );
    expect(screen.getByTestId('fighter-B2').querySelector('.fighter-sprite')).toHaveAttribute(
      'src',
      expect.stringContaining('badminton-male-jump-smash.png'),
    );
  });

  it('flips only the team B little fighter sprites to face the net', () => {
    render(
      <CourtView
        match={createMatch({ mode: 'doubles', initialServingTeamId: 'teamA', initialServingPlayerId: 'A1' })}
        displayMode="little-fighters"
        onPointTeam={vi.fn()}
      />,
    );

    expect(screen.getByTestId('fighter-A1')).not.toHaveClass('is-flipped');
    expect(screen.getByTestId('fighter-A2')).not.toHaveClass('is-flipped');
    expect(screen.getByTestId('fighter-B1')).toHaveClass('is-flipped');
    expect(screen.getByTestId('fighter-B2')).toHaveClass('is-flipped');
  });

  it('projects the little fighters court from regulation badminton dimensions', () => {
    render(
      <CourtView
        match={createMatch({ mode: 'doubles', initialServingTeamId: 'teamA', initialServingPlayerId: 'A1' })}
        displayMode="little-fighters"
        onPointTeam={vi.fn()}
      />,
    );

    expect(screen.getByTestId('fighters-court-boundary')).toHaveAttribute('d', 'M 92 194 L 908 194 L 976 506 L 24 506 Z');
    expect(screen.getByTestId('fighters-doubles-sideline-top')).toHaveAttribute('d', 'M 92 194 L 908 194');
    expect(screen.getByTestId('fighters-doubles-sideline-bottom')).toHaveAttribute('d', 'M 24 506 L 976 506');
    expect(screen.getByTestId('fighters-singles-sideline-top')).toHaveAttribute('d', 'M 86.872 217.528 L 913.128 217.528');
    expect(screen.getByTestId('fighters-singles-sideline-bottom')).toHaveAttribute('d', 'M 29.128 482.472 L 970.872 482.472');
    expect(screen.getByTestId('fighters-court-net')).toHaveAttribute('d', 'M 500 194 L 500 506');
    expect(screen.getByTestId('fighters-short-service-left')).toHaveAttribute('d', 'M 379.427 194 L 359.331 506');
    expect(screen.getByTestId('fighters-short-service-right')).toHaveAttribute('d', 'M 620.573 194 L 640.669 506');
    expect(screen.getByTestId('fighters-doubles-long-service-left')).toHaveAttribute('d', 'M 138.281 194 L 77.994 506');
    expect(screen.getByTestId('fighters-doubles-long-service-right')).toHaveAttribute('d', 'M 861.719 194 L 922.006 506');
    expect(screen.getByTestId('fighters-center-service-left')).toHaveAttribute('d', 'M 58 350 L 369.379 350');
    expect(screen.getByTestId('fighters-center-service-right')).toHaveAttribute('d', 'M 630.621 350 L 942 350');
  });

  it('places little fighters in the middle of their service courts', () => {
    render(
      <CourtView
        match={createMatch({ mode: 'doubles', initialServingTeamId: 'teamA', initialServingPlayerId: 'A1' })}
        displayMode="little-fighters"
        onPointTeam={vi.fn()}
      />,
    );

    expect(screen.getByTestId('fighter-A1')).toHaveStyle({ left: '29.087745534621973%', top: '77.98126463700234%' });
    expect(screen.getByTestId('fighter-A2')).toHaveStyle({ left: '24.72905701003181%', top: '50.67213114754099%' });
    expect(screen.getByTestId('fighter-B1')).toHaveStyle({ left: '75.27094298996819%', top: '50.67213114754099%' });
    expect(screen.getByTestId('fighter-B2')).toHaveStyle({ left: '77.24096305358455%', top: '77.98126463700234%' });
  });

  it('places little fighter nameplates beside each team instead of below the sprites', () => {
    render(
      <CourtView
        match={createMatch({ mode: 'doubles', initialServingTeamId: 'teamA', initialServingPlayerId: 'A1' })}
        displayMode="little-fighters"
        onPointTeam={vi.fn()}
      />,
    );

    for (const playerId of ['A1', 'A2']) {
      expect(screen.getByTestId(`fighter-${playerId}`).querySelector('.fighter-nameplate')).toHaveClass('nameplate-left');
    }

    for (const playerId of ['B1', 'B2']) {
      expect(screen.getByTestId(`fighter-${playerId}`).querySelector('.fighter-nameplate')).toHaveClass('nameplate-right');
    }
  });

  it('uses enlarged tablet-readable score and player tag classes in little fighters mode', () => {
    render(
      <CourtView
        match={createMatch({ mode: 'doubles', initialServingTeamId: 'teamA', initialServingPlayerId: 'A1' })}
        displayMode="little-fighters"
        onPointTeam={vi.fn()}
      />,
    );

    expect(screen.getByTestId('score-teamA').querySelector('.fighter-score-number')).toHaveTextContent('0');
    expect(screen.getByTestId('score-teamB').querySelector('.fighter-score-number')).toHaveTextContent('0');

    for (const playerId of ['A1', 'A2', 'B1', 'B2']) {
      expect(screen.getByTestId(`fighter-${playerId}`).querySelector('.fighter-nameplate-name')).toBeInTheDocument();
    }
  });

  it('calls onPlayerSpriteClick when a little fighter sprite is clicked', async () => {
    const user = userEvent.setup();
    const onPlayerSpriteClick = vi.fn();

    render(
      <CourtView
        match={createMatch({ mode: 'doubles', initialServingTeamId: 'teamA', initialServingPlayerId: 'A1' })}
        displayMode="little-fighters"
        onPointTeam={vi.fn()}
        fighterSprites={{
          A1: { id: 'female-ace', name: 'Female Ace', src: '/sprites/badminton-female-ace.png' },
          A2: { id: 'male-clear', name: 'Male Clear', src: '/sprites/badminton-male-clear.png' },
          B1: { id: 'female-drive', name: 'Female Drive', src: '/sprites/badminton-female-drive.png' },
          B2: { id: 'male-jump-smash', name: 'Male Jump Smash', src: '/sprites/badminton-male-jump-smash.png' },
        }}
        onPlayerSpriteClick={onPlayerSpriteClick}
      />,
    );

    await user.click(screen.getByRole('button', { name: /choose sprite for player 1/i }));

    expect(onPlayerSpriteClick).toHaveBeenCalledWith('A1');
  });

  it('animates the serving player attacking the other team after a point', () => {
    const baseMatch = createMatch({ mode: 'doubles', initialServingTeamId: 'teamA', initialServingPlayerId: 'A1' });
    const { rerender } = render(<CourtView match={baseMatch} displayMode="little-fighters" onPointTeam={vi.fn()} />);

    const nextMatch: MatchState = {
      ...baseMatch,
      score: { teamA: 1, teamB: 0 },
      servingTeamId: 'teamA',
      serverId: 'A1',
    };

    rerender(<CourtView match={nextMatch} displayMode="little-fighters" onPointTeam={vi.fn()} />);

    expect(screen.getByTestId('fighter-A1')).toHaveClass('is-attacking');
    expect(screen.getByTestId('fighter-B1').closest('.fighter-team')).toHaveClass('is-under-attack');
  });
});
