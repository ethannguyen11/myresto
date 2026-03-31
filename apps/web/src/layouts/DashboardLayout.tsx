import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: '📊' },
  { to: '/ingredients', label: 'Ingrédients', icon: '🥕' },
  { to: '/recipes', label: 'Recettes', icon: '👨‍🍳' },
  { to: '/invoices', label: 'Factures', icon: '🧾' },
  { to: '/advisor', label: 'Conseiller IA', icon: '🤖' },
] as const;

export function DashboardLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="flex h-screen bg-stone-50">
      {/* ─── Sidebar ─── */}
      <aside className="flex w-64 flex-col border-r border-stone-200 bg-white">
        {/* Brand */}
        <div className="flex h-16 items-center gap-2 border-b border-stone-200 px-6">
          <span className="text-2xl">🍳</span>
          <span className="text-lg font-semibold tracking-tight text-stone-900">
            Chef IA
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV_ITEMS.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
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
        <div className="border-t border-stone-200 p-4">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-stone-900">
                {user?.name}
              </p>
              <p className="truncate text-xs text-stone-500">{user?.email}</p>
            </div>
            <button
              onClick={logout}
              className="rounded-md px-2 py-1 text-xs text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-700"
            >
              Déconnexion
            </button>
          </div>
        </div>
      </aside>

      {/* ─── Main content ─── */}
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-8 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
