import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthContext';
import { api } from '../api/client';

// ── Dark mode hook ─────────────────────────────────────────────────────────

function useDarkMode(): [boolean, () => void] {
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem('chefai_dark');
    return saved ? saved === 'true' : false;
  });

  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('chefai_dark', String(dark));
  }, [dark]);

  return [dark, () => setDark((d) => !d)];
}

// ── Bottom navigation items (5 principaux) ────────────────────────────────

const BOTTOM_NAV = [
  { to: '/', label: 'Dashboard', icon: '📊' },
  { to: '/recipes', label: 'Recettes', icon: '🥗' },
  { to: '/ingredients', label: 'Ingrédients', icon: '📦' },
  { to: '/invoices', label: 'Factures', icon: '📄' },
  { to: '/advisor', label: 'Conseiller', icon: '🤖' },
];

// ── Layout ─────────────────────────────────────────────────────────────────

export function DashboardLayout() {
  const { user, logout } = useAuth();
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dark, toggleDark] = useDarkMode();
  const [alertCount, setAlertCount] = useState(0);

  useEffect(() => {
    api.get<{ alerts: string[] }>('/dashboard')
      .then((r) => setAlertCount(r.data.alerts?.length ?? 0))
      .catch(() => {});
  }, []);

  const NAV_ITEMS = [
    { to: '/', label: t('nav.dashboard'), icon: '📊' },
    { to: '/ingredients', label: t('nav.ingredients'), icon: '🥕' },
    { to: '/recipes', label: t('nav.recipes'), icon: '👨‍🍳' },
    { to: '/invoices', label: t('nav.invoices'), icon: '🧾' },
    { to: '/advisor', label: t('nav.advisor'), icon: '🤖' },
    { to: '/alerts', label: 'Alertes', icon: '🔔', badge: alertCount },
    { to: '/analytics', label: 'Analytiques', icon: '📈' },
    { to: '/tech-sheets', label: t('nav.techSheets'), icon: '📋' },
  ];

  function toggleLang() {
    const next = i18n.language === 'fr' ? 'en' : 'fr';
    i18n.changeLanguage(next);
    localStorage.setItem('i18n_language', next);
  }

  function closeSidebar() {
    setSidebarOpen(false);
  }

  function isBottomNavActive(to: string) {
    if (to === '/') return location.pathname === '/';
    return location.pathname.startsWith(to);
  }

  return (
    <div className="flex bg-stone-50 dark:bg-gray-950" style={{ height: '100dvh' }}>

      {/* ─── Mobile overlay ─── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 md:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* ─── Sidebar ─── */}
      <aside
        className={[
          'fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-stone-200 bg-white transition-transform duration-200',
          'dark:bg-gray-900 dark:border-gray-700',
          'md:static md:translate-x-0 md:z-auto',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
        style={{ height: '100dvh' }}
      >
        {/* Brand */}
        <div className="flex h-14 items-center gap-2 border-b border-stone-200 px-6 dark:border-gray-700">
          <span className="text-2xl">🍳</span>
          <span className="text-lg font-semibold tracking-tight text-stone-900 dark:text-white">
            Chef IA
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
          {NAV_ITEMS.map(({ to, label, icon, badge }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={closeSidebar}
              className={({ isActive }) =>
                [
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                    : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white',
                ].join(' ')
              }
            >
              <span className="text-base">{icon}</span>
              <span className="flex-1">{label}</span>
              {badge != null && badge > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                  {badge}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User footer */}
        <div className="space-y-3 border-t border-stone-200 p-4 dark:border-gray-700">
          {/* Controls row */}
          <div className="flex gap-2">
            {/* Language switcher */}
            <button
              onClick={toggleLang}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-stone-200 px-2 py-1.5 text-xs font-medium text-stone-600 transition-colors hover:bg-stone-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              <span>{t('lang.flag')}</span>
              <span>{t('lang.switch')}</span>
            </button>
            {/* Dark mode toggle */}
            <button
              onClick={toggleDark}
              title={dark ? 'Mode clair' : 'Mode sombre'}
              className="flex items-center justify-center rounded-lg border border-stone-200 px-3 py-1.5 text-sm transition-colors hover:bg-stone-100 dark:border-gray-600 dark:hover:bg-gray-800"
            >
              {dark ? '☀️' : '🌙'}
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-stone-900 dark:text-white">{user?.name}</p>
              <p className="truncate text-xs text-stone-500 dark:text-gray-400">{user?.email}</p>
            </div>
            <button
              onClick={logout}
              className="rounded-md px-2 py-1 text-xs text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
            >
              {t('nav.logout')}
            </button>
          </div>
        </div>
      </aside>

      {/* ─── Main content ─── */}
      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">

        {/* Mobile top bar */}
        <div className="sticky top-0 z-10 flex h-14 shrink-0 items-center justify-between border-b border-stone-200 bg-white px-4 md:hidden dark:border-gray-700 dark:bg-gray-900">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="rounded-lg p-2 text-stone-500 transition-colors hover:bg-stone-100 dark:text-gray-400 dark:hover:bg-gray-800"
              aria-label="Menu"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                <path fillRule="evenodd" d="M2 4.75A.75.75 0 012.75 4h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 4.75zm0 10.5a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75a.75.75 0 01-.75-.75zM2 10a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 10z" clipRule="evenodd" />
              </svg>
            </button>
            <span className="text-base font-semibold text-stone-900 dark:text-white">🍳 Chef IA</span>
          </div>
          <button
            onClick={toggleDark}
            className="rounded-lg p-2 text-stone-500 transition-colors hover:bg-stone-100 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            {dark ? '☀️' : '🌙'}
          </button>
        </div>

        {/* Page content — padding-bottom for bottom nav on mobile */}
        <div
          className="mx-auto w-full max-w-6xl px-4 py-4 sm:px-8 sm:py-8"
          style={{ paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px))' }}
        >
          <Outlet />
        </div>
      </main>

      {/* ─── Bottom Navigation (mobile only) ─── */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 flex border-t border-stone-200 bg-white md:hidden dark:border-gray-700 dark:bg-gray-900"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {BOTTOM_NAV.map(({ to, label, icon }) => {
          const active = isBottomNavActive(to);
          return (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className="flex flex-1 flex-col items-center justify-center gap-0.5 py-2"
              style={{ minHeight: '56px' }}
            >
              <span className="text-xl leading-none">{icon}</span>
              <span
                className="text-[10px] font-medium leading-tight"
                style={{ color: active ? '#16a34a' : undefined }}
              >
                {label}
              </span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
