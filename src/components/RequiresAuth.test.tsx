import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';

const authMock = vi.hoisted(() => ({ useAuth: vi.fn() }));
vi.mock('../auth', () => ({ useAuth: authMock.useAuth }));

describe('RequiresAuth', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders children when signed in with a named account', async () => {
    authMock.useAuth.mockReturnValue({ user: { uid: 'u1' }, isAnonymous: false, loading: false });
    const { RequiresAuth } = await import('./RequiresAuth');
    render(<RequiresAuth><div>protected</div></RequiresAuth>);
    expect(screen.getByText('protected')).toBeInTheDocument();
  });

  it('renders sign-in nudge instead of children when anonymous', async () => {
    authMock.useAuth.mockReturnValue({ user: { uid: 'anon' }, isAnonymous: true, loading: false });
    const { RequiresAuth } = await import('./RequiresAuth');
    render(<RequiresAuth><div>protected</div></RequiresAuth>);
    expect(screen.queryByText('protected')).not.toBeInTheDocument();
    expect(screen.getByText(/sign in to use this feature/i)).toBeInTheDocument();
  });

  it('renders sign-in nudge instead of children when signed out', async () => {
    authMock.useAuth.mockReturnValue({ user: null, isAnonymous: false, loading: false });
    const { RequiresAuth } = await import('./RequiresAuth');
    render(<RequiresAuth><div>protected</div></RequiresAuth>);
    expect(screen.queryByText('protected')).not.toBeInTheDocument();
    expect(screen.getByText(/sign in to use this feature/i)).toBeInTheDocument();
  });

  it('renders nothing while loading', async () => {
    authMock.useAuth.mockReturnValue({ isAnonymous: false, loading: true });
    const { RequiresAuth } = await import('./RequiresAuth');
    const { container } = render(<RequiresAuth><div>protected</div></RequiresAuth>);
    expect(container).toBeEmptyDOMElement();
  });
});
