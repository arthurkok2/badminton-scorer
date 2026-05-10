import { render, screen } from '@testing-library/react';
import App from './App';

describe('App', () => {
  it('renders the initial scoreboard shell', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: '0 - 0' })).toBeInTheDocument();
    expect(screen.getByText('Match setup is ready for implementation.')).toBeInTheDocument();
  });
});
