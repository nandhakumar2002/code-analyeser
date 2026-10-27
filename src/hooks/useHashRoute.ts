import React from 'react';

export type AppRoute = 'home' | 'about' | 'contact';

function parseHash(): AppRoute {
  if (typeof window === 'undefined') return 'home';
  const raw = window.location.hash.replace(/^#\/?/, '').split('?')[0].replace(/\/$/, '');
  if (raw === 'about') return 'about';
  if (raw === 'contact') return 'contact';
  return 'home';
}

/** Tiny hash router: works on static hosts without any server rewrites. */
export function useHashRoute(): {
  route: AppRoute;
  navigate: (route: AppRoute) => void;
} {
  const [route, setRoute] = React.useState<AppRoute>(parseHash);

  React.useEffect(() => {
    const onHashChange = () => {
      setRoute(parseHash());
      window.scrollTo({ top: 0, behavior: 'auto' });
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigate = React.useCallback((next: AppRoute) => {
    const target = next === 'home' ? '#/' : `#/${next}`;
    if (window.location.hash === target) {
      setRoute(next);
      window.scrollTo({ top: 0, behavior: 'auto' });
    } else {
      window.location.hash = target;
    }
  }, []);

  return { route, navigate };
}
