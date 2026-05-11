import { render, screen } from '@testing-library/react';
import { CourtView } from './CourtView';
import { createMatch } from '../domain/matchEngine';

describe('CourtView', () => {
  it('renders a dimensionally scaled badminton court with all regulation lines', () => {
    render(<CourtView match={createMatch({ mode: 'doubles', initialServingTeamId: 'teamA', initialServingPlayerId: 'A1' })} />);

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
    render(<CourtView match={createMatch({ mode: 'doubles', initialServingTeamId: 'teamA', initialServingPlayerId: 'A1' })} />);

    for (const name of ['Player 1', 'Player 2', 'Player 3', 'Player 4']) {
      const chip = screen.getByText(name).closest('.player-chip');

      expect(chip).toBeInTheDocument();
      expect(chip).toHaveClass('player-chip');
    }
  });

  it('mirrors visual court lanes for the team on the right side of the net', () => {
    render(<CourtView match={createMatch({ mode: 'doubles', initialServingTeamId: 'teamA', initialServingPlayerId: 'A1' })} />);

    expect(screen.getByText('Player 1').closest('.court-slot')).toHaveClass('court-lane-bottom');
    expect(screen.getByText('Player 2').closest('.court-slot')).toHaveClass('court-lane-top');
    expect(screen.getByText('Player 3').closest('.court-slot')).toHaveClass('court-lane-top');
    expect(screen.getByText('Player 4').closest('.court-slot')).toHaveClass('court-lane-bottom');
  });
});
