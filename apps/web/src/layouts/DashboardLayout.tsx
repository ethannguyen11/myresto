import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthContext';

export function DashboardLayout() {
  const { user, logout } = useAuth();
  const { t, i18n } = useTranslation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const NAV_ITEMS = [
    { to: '/', label: t('nav.dashboard'), icon: '📊' },
    { to: '/ingredients', label: t('nav.ingredients'), icon: '🥕' },
    { to: '/recipes', label: t('nav.recipes'), icon: '👨‍🍳' },
    { to: '/invoices', label: t('nav.invoices'), icon: '🧾' },
    { to: '/advisor', label: t('nav.advisor'), icon: '🤖' },
  ];

  function toggleLang() {
    const next = i18n.language === 'fr' ? 'en' : 'fr';
    i18n.changeLanguage(next);
    localStorage.setItem('i18n_language', next);
  }

  function closeSidebar() {
    setSidebarOpen(false);
  }

  return (
    <div className="flex h-screen bg-stone-50">

      {/* ─── Mobile overlay ─── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 md:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* ─── Sidebar ─── */}
      <aside
        className={[
          'fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-stone-200 bg-white transition-transform duration-200',
          'md:static md:translate-x-0 md:z-auto',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        {/* Brand */}
        <div className="flex h-14 items-center gap-2 border-b border-stone-200 px-6">
          <span className="text-2xl">🍳</span>
          <span className="text-lg font-semibold tracking-tight text-stone-900">Chef IA</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV_ITEMS.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={closeSidebar}
              className={({ isActive }) =>
                [
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900',
                ].join(' ')
              }
            >
              <span className="text-base">{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User footer */}
        <div className="space-y-3 border-t border-stone-200 p-4">
          {/* Language switcher */}
          <button
            onClick={toggleLang}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 transition-colors hover:bg-stone-100 hover:text-stone-800"
          >
            <span>{t('lang.flag')}</span>
            <span>{t('lang.switch')}</span>
          </button>

          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-stone-900">{user?.name}</p>
              <p className="truncate text-xs text-stone-500">{user?.email}</p>
            </div>
            <button
              onClick={logout}
              className="rounded-md px-2 py-1 text-xs text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-700"
            >
              {t('nav.logout')}
            </button>
          </div>
        </div>
      </aside>

      {/* ─── Main content ─── */}
      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">

        {/* Mobile top bar */}
        <div className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-3 border-b border-stone-200 bg-white px-4 md:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-2 text-stone-500 transition-colors hover:bg-stone-100"
            aria-label="Menu"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
              <path fillRule="evenodd" d="M2 4.75A.75.75 0 012.75 4h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 4.75zm0 10.5a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75a.75.75 0 01-.75-.75zM2 10a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 10z" clipRule="evenodd" />
            </svg>
          </button>
          <span className="text-base font-semibold text-stone-900">🍳 Chef IA</span>
        </div>

        <div className="mx-auto w-full max-w-6xl px-4 py-4 sm:px-8 sm:py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
