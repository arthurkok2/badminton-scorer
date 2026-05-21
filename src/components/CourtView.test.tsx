import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CourtView } from './CourtView';
import { createMatch } from '../domain/matchEngine';
import type { MatchState } from '../domain/matchTypes';

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
