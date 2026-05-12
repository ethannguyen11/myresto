import { useState } from 'react';
import { Link } from 'react-router-dom';

// ── Demo data ──────────────────────────────────────────────────────────────

const RESTAURANT = 'Le Petit Bistrot';

const INGREDIENTS = [
  { id: 1, name: 'Entrecôte (kg)', unit: 'kg', price: 28.5, category: 'Viandes' },
  { id: 2, name: 'Filet de saumon (kg)', unit: 'kg', price: 22.0, category: 'Poissons' },
  { id: 3, name: 'Pommes de terre (kg)', unit: 'kg', price: 1.2, category: 'Légumes' },
  { id: 4, name: 'Crème fraîche (L)', unit: 'L', price: 3.8, category: 'Laitiers' },
  { id: 5, name: 'Beurre (kg)', unit: 'kg', price: 8.5, category: 'Laitiers' },
  { id: 6, name: 'Farine (kg)', unit: 'kg', price: 0.9, category: 'Épicerie' },
  { id: 7, name: 'Œufs (dz)', unit: 'dz', price: 3.2, category: 'Laitiers' },
  { id: 8, name: 'Tomates (kg)', unit: 'kg', price: 2.4, category: 'Légumes' },
  { id: 9, name: 'Champignons (kg)', unit: 'kg', price: 6.5, category: 'Légumes' },
  { id: 10, name: 'Lardons (kg)', unit: 'kg', price: 9.0, category: 'Charcuterie' },
  { id: 11, name: 'Vin blanc (L)', unit: 'L', price: 4.5, category: 'Vins' },
  { id: 12, name: 'Échalotes (kg)', unit: 'kg', price: 3.0, category: 'Légumes' },
  { id: 13, name: 'Crevettes (kg)', unit: 'kg', price: 18.0, category: 'Poissons' },
  { id: 14, name: 'Parmesan (kg)', unit: 'kg', price: 24.0, category: 'Laitiers' },
  { id: 15, name: 'Pâtes (kg)', unit: 'kg', price: 1.8, category: 'Épicerie' },
];

const RECIPES = [
  { id: 1, name: 'Entrecôte frites', category: 'Plats', sellingPrice: 28, foodCost: 6.2, foodCostPct: 22, ragStatus: 'green', margin: 21.8 },
  { id: 2, name: 'Saumon grillé', category: 'Plats', sellingPrice: 24, foodCost: 6.7, foodCostPct: 28, ragStatus: 'amber', margin: 17.3 },
  { id: 3, name: 'Burger du chef', category: 'Plats', sellingPrice: 18, foodCost: 6.8, foodCostPct: 38, ragStatus: 'red', margin: 11.2 },
  { id: 4, name: 'Salade César', category: 'Entrées', sellingPrice: 14, foodCost: 2.1, foodCostPct: 15, ragStatus: 'green', margin: 11.9 },
  { id: 5, name: 'Risotto champignons', category: 'Plats', sellingPrice: 20, foodCost: 5.4, foodCostPct: 27, ragStatus: 'amber', margin: 14.6 },
  { id: 6, name: 'Penne carbonara', category: 'Plats', sellingPrice: 16, foodCost: 3.8, foodCostPct: 24, ragStatus: 'green', margin: 12.2 },
  { id: 7, name: 'Gambas à l\'ail', category: 'Entrées', sellingPrice: 18, foodCost: 8.1, foodCostPct: 45, ragStatus: 'red', margin: 9.9 },
  { id: 8, name: 'Crème brûlée', category: 'Desserts', sellingPrice: 9, foodCost: 1.6, foodCostPct: 18, ragStatus: 'green', margin: 7.4 },
];

const INVOICES = [
  {
    id: 1,
    supplier: 'Marché Rungis Direct',
    date: '2026-05-08',
    total: 847.50,
    status: 'validated',
    items: [
      { name: 'Entrecôte', qty: 15, unit: 'kg', price: 28.5 },
      { name: 'Saumon', qty: 12, unit: 'kg', price: 22.0 },
      { name: 'Crevettes', qty: 5, unit: 'kg', price: 18.0 },
    ],
  },
  {
    id: 2,
    supplier: 'Metro Cash & Carry',
    date: '2026-05-05',
    total: 312.80,
    status: 'reviewed',
    items: [
      { name: 'Crème fraîche', qty: 20, unit: 'L', price: 3.8 },
      { name: 'Beurre', qty: 10, unit: 'kg', price: 8.5 },
      { name: 'Parmesan', qty: 5, unit: 'kg', price: 24.0 },
    ],
  },
];

// Computed dashboard KPIs
const avgFoodCost = RECIPES.reduce((s, r) => s + r.foodCostPct, 0) / RECIPES.length;
const totalMargin = RECIPES.reduce((s, r) => s + r.margin, 0);
const profitable = RECIPES.filter((r) => r.ragStatus !== 'red').length;

function ragColor(status: string) {
  if (status === 'green') return '#10b981';
  if (status === 'amber') return '#f59e0b';
  return '#ef4444';
}

function ragBg(status: string) {
  if (status === 'green') return 'rgba(16,185,129,0.12)';
  if (status === 'amber') return 'rgba(245,158,11,0.12)';
  return 'rgba(239,68,68,0.12)';
}

function fcColor(pct: number) {
  if (pct <= 25) return '#10b981';
  if (pct <= 30) return '#f59e0b';
  return '#ef4444';
}

function statusLabel(s: string) {
  if (s === 'validated') return 'Validée';
  if (s === 'reviewed') return 'Vérifiée';
  return s;
}
function statusColor(s: string) {
  return s === 'validated' ? '#10b981' : '#f59e0b';
}

// ── Blocked action popup ───────────────────────────────────────────────────

function BlockedModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-8 text-center"
        style={{ background: '#111118', border: '1px solid #2a2a38' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-4xl mb-4">🔒</div>
        <h3 className="text-lg font-bold mb-2" style={{ color: '#fff' }}>
          Créez votre compte pour utiliser cette fonctionnalité
        </h3>
        <p className="text-sm mb-6" style={{ color: '#71717a' }}>
          Le mode démo est en lecture seule. Inscrivez-vous gratuitement pour accéder à toutes les fonctionnalités.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={onClose}
            className="rounded-full px-4 py-2 text-sm"
            style={{ border: '1px solid #2a2a38', color: '#a1a1aa' }}
          >
            Fermer
          </button>
          <Link
            to="/register"
            className="rounded-full px-5 py-2 text-sm font-semibold"
            style={{ background: '#f59e0b', color: '#000' }}
          >
            Créer mon compte
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── Sub-pages ──────────────────────────────────────────────────────────────

function DemoDashboard({ onBlock }: { onBlock: () => void }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#fff' }}>Dashboard</h1>
        <p className="mt-0.5 text-sm" style={{ color: '#71717a' }}>{RESTAURANT}</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Food Cost Moyen', value: `${avgFoodCost.toFixed(1)} %`, color: fcColor(avgFoodCost) },
          { label: 'Recettes rentables', value: `${profitable} / ${RECIPES.length}`, color: '#60a5fa' },
          { label: 'Marge totale estimée', value: `${totalMargin.toFixed(0)} €`, color: '#10b981' },
          { label: 'Alertes actives', value: '2', color: '#ef4444' },
        ].map((k) => (
          <div key={k.label} className="rounded-2xl p-5" style={{ background: '#111118', border: '1px solid #2a2a38' }}>
            <p className="text-xs mb-1" style={{ color: '#71717a' }}>{k.label}</p>
            <p className="text-3xl font-bold" style={{ color: k.color }}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Recipe preview */}
      <div className="rounded-2xl" style={{ background: '#111118', border: '1px solid #2a2a38' }}>
        <div className="px-5 py-4" style={{ borderBottom: '1px solid #2a2a38' }}>
          <p className="text-sm font-semibold" style={{ color: '#fff' }}>Top recettes</p>
        </div>
        <div>
          {RECIPES.slice(0, 5).map((r, i) => (
            <div
              key={r.id}
              className="flex items-center justify-between px-5 py-3"
              style={{ borderTop: i > 0 ? '1px solid #2a2a38' : undefined }}
            >
              <div className="flex items-center gap-3">
                <span className="h-2 w-2 rounded-full" style={{ background: ragColor(r.ragStatus) }} />
                <span className="text-sm font-medium" style={{ color: '#fff' }}>{r.name}</span>
                <span className="rounded-full px-2 py-0.5 text-xs" style={{ background: '#1a1a24', color: '#71717a' }}>{r.category}</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm font-semibold" style={{ color: fcColor(r.foodCostPct) }}>{r.foodCostPct} %</span>
                <span className="text-sm" style={{ color: '#71717a' }}>{r.sellingPrice} €</span>
                <button onClick={onBlock} className="text-xs px-3 py-1 rounded-lg" style={{ border: '1px solid #2a2a38', color: '#71717a' }}>
                  Modifier
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Alerts */}
      <div className="space-y-3">
        {[
          { msg: '🚨 Gambas à l\'ail : food cost à 45 % — au-dessus du seuil critique de 35 %.', severity: '#ef4444' },
          { msg: '⚠️ Burger du chef : rentabilité dégradée depuis la hausse des prix du bœuf.', severity: '#f59e0b' },
        ].map((a, i) => (
          <div key={i} className="rounded-2xl p-4" style={{ background: '#111118', border: '1px solid #2a2a38', borderLeft: `3px solid ${a.severity}` }}>
            <p className="text-sm" style={{ color: '#a1a1aa' }}>{a.msg}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function DemoRecipes({ onBlock }: { onBlock: () => void }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#fff' }}>Recettes</h1>
          <p className="mt-0.5 text-sm" style={{ color: '#71717a' }}>{RECIPES.length} recettes</p>
        </div>
        <button onClick={onBlock} className="rounded-xl px-4 py-2.5 text-sm font-medium" style={{ background: '#f59e0b', color: '#000' }}>
          + Nouvelle recette
        </button>
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ background: '#111118', border: '1px solid #2a2a38' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: '#1a1a24', borderBottom: '1px solid #2a2a38' }}>
              {['Recette', 'Catégorie', 'Prix vente', 'Food Cost', 'Marge', ''].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide" style={{ color: '#71717a' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {RECIPES.map((r, i) => (
              <tr
                key={r.id}
                style={{ borderTop: i > 0 ? '1px solid #2a2a38' : undefined }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#1a1a24')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <td className="px-4 py-3 font-medium" style={{ color: '#fff' }}>{r.name}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full px-2 py-0.5 text-xs" style={{ background: '#1a1a24', color: '#71717a' }}>{r.category}</span>
                </td>
                <td className="px-4 py-3" style={{ color: '#a1a1aa' }}>{r.sellingPrice} €</td>
                <td className="px-4 py-3">
                  <span className="rounded-full px-2 py-0.5 text-xs font-semibold" style={{ background: ragBg(r.ragStatus), color: ragColor(r.ragStatus) }}>
                    {r.foodCostPct} %
                  </span>
                </td>
                <td className="px-4 py-3 font-semibold" style={{ color: ragColor(r.ragStatus) }}>{r.margin.toFixed(1)} €</td>
                <td className="px-4 py-3">
                  <button onClick={onBlock} className="text-xs px-2 py-1 rounded" style={{ color: '#71717a' }}>✏️</button>
                  <button onClick={onBlock} className="text-xs px-2 py-1 rounded ml-1" style={{ color: '#ef4444' }}>🗑️</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DemoIngredients({ onBlock }: { onBlock: () => void }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#fff' }}>Ingrédients</h1>
          <p className="mt-0.5 text-sm" style={{ color: '#71717a' }}>{INGREDIENTS.length} ingrédients</p>
        </div>
        <button onClick={onBlock} className="rounded-xl px-4 py-2.5 text-sm font-medium" style={{ background: '#f59e0b', color: '#000' }}>
          + Ajouter
        </button>
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ background: '#111118', border: '1px solid #2a2a38' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: '#1a1a24', borderBottom: '1px solid #2a2a38' }}>
              {['Ingrédient', 'Catégorie', 'Unité', 'Prix actuel', ''].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide" style={{ color: '#71717a' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {INGREDIENTS.map((ing, i) => (
              <tr
                key={ing.id}
                style={{ borderTop: i > 0 ? '1px solid #2a2a38' : undefined }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#1a1a24')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <td className="px-4 py-3 font-medium" style={{ color: '#fff' }}>{ing.name}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full px-2 py-0.5 text-xs" style={{ background: '#1a1a24', color: '#71717a' }}>{ing.category}</span>
                </td>
                <td className="px-4 py-3" style={{ color: '#a1a1aa' }}>{ing.unit}</td>
                <td className="px-4 py-3 font-semibold" style={{ color: '#f59e0b' }}>{ing.price.toFixed(2)} €</td>
                <td className="px-4 py-3">
                  <button onClick={onBlock} className="text-xs px-2 py-1 rounded" style={{ color: '#71717a' }}>✏️</button>
                  <button onClick={onBlock} className="text-xs px-2 py-1 rounded ml-1" style={{ color: '#ef4444' }}>🗑️</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DemoInvoices({ onBlock }: { onBlock: () => void }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#fff' }}>Factures</h1>
          <p className="mt-0.5 text-sm" style={{ color: '#71717a' }}>{INVOICES.length} factures analysées</p>
        </div>
        <button onClick={onBlock} className="rounded-xl px-4 py-2.5 text-sm font-medium" style={{ background: '#f59e0b', color: '#000' }}>
          📎 Importer une facture
        </button>
      </div>

      <div className="space-y-4">
        {INVOICES.map((inv) => (
          <div key={inv.id} className="rounded-2xl" style={{ background: '#111118', border: '1px solid #2a2a38' }}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #2a2a38' }}>
              <div>
                <p className="font-semibold" style={{ color: '#fff' }}>{inv.supplier}</p>
                <p className="text-xs mt-0.5" style={{ color: '#71717a' }}>{new Date(inv.date).toLocaleDateString('fr-FR')}</p>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-lg font-bold" style={{ color: '#f59e0b' }}>{inv.total.toFixed(2)} €</span>
                <span className="rounded-full px-3 py-1 text-xs font-medium" style={{ background: `rgba(${inv.status === 'validated' ? '16,185,129' : '245,158,11'},0.12)`, color: statusColor(inv.status) }}>
                  {statusLabel(inv.status)}
                </span>
                <button onClick={onBlock} className="text-xs px-3 py-1 rounded-lg" style={{ border: '1px solid #2a2a38', color: '#71717a' }}>
                  Voir
                </button>
              </div>
            </div>
            <div className="px-5 py-3 space-y-2">
              {inv.items.map((item, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span style={{ color: '#a1a1aa' }}>{item.name}</span>
                  <div className="flex gap-6">
                    <span style={{ color: '#71717a' }}>{item.qty} {item.unit}</span>
                    <span style={{ color: '#fff' }}>{item.price.toFixed(2)} €/{item.unit}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main DemoPage ──────────────────────────────────────────────────────────

type DemoTab = 'dashboard' | 'recipes' | 'ingredients' | 'invoices';

const TABS: { key: DemoTab; label: string; icon: string }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: '📊' },
  { key: 'recipes', label: 'Recettes', icon: '👨‍🍳' },
  { key: 'ingredients', label: 'Ingrédients', icon: '🥕' },
  { key: 'invoices', label: 'Factures', icon: '🧾' },
];

export function DemoPage() {
  const [tab, setTab] = useState<DemoTab>('dashboard');
  const [blocked, setBlocked] = useState(false);

  return (
    <div style={{ background: '#0a0a0f', minHeight: '100vh' }}>

      {/* Demo banner */}
      <div className="sticky top-0 z-50 flex items-center justify-between px-4 py-2.5" style={{ background: '#f59e0b' }}>
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="flex items-center gap-1 text-xs font-medium"
            style={{ color: 'rgba(0,0,0,0.6)' }}
          >
            ← Back
          </Link>
          <div className="flex items-center gap-2 text-sm font-medium" style={{ color: '#000' }}>
            <span>👀</span>
            <span className="hidden sm:inline">Demo mode — "{RESTAURANT}" sample data</span>
            <span className="sm:hidden">Demo mode</span>
          </div>
        </div>
        <Link
          to="/register"
          className="flex items-center gap-1 rounded-full px-4 py-1.5 text-xs font-bold transition-all"
          style={{ background: '#000', color: '#f59e0b' }}
        >
          Create free account →
        </Link>
      </div>

      <div className="flex" style={{ height: 'calc(100vh - 44px)' }}>

        {/* Sidebar */}
        <aside
          className="hidden md:flex w-56 flex-col"
          style={{ background: '#0a0a0f', borderRight: '1px solid #2a2a38', height: '100%' }}
        >
          {/* Brand */}
          <div className="flex h-14 items-center gap-2.5 px-5" style={{ borderBottom: '1px solid #2a2a38' }}>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg text-base" style={{ background: 'rgba(245,158,11,0.15)' }}>🍳</span>
            <span className="text-sm font-bold" style={{ color: '#fff' }}>Chef IA</span>
          </div>

          {/* Nav */}
          <nav className="flex-1 px-3 py-4 space-y-0.5">
            {TABS.map(({ key, label, icon }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors text-left"
                style={{
                  background: tab === key ? 'rgba(245,158,11,0.1)' : 'transparent',
                  color: tab === key ? '#f59e0b' : '#a1a1aa',
                  borderLeft: `3px solid ${tab === key ? '#f59e0b' : 'transparent'}`,
                }}
              >
                <span className="text-base">{icon}</span>
                {label}
              </button>
            ))}
          </nav>

          {/* CTA */}
          <div className="p-4" style={{ borderTop: '1px solid #2a2a38' }}>
            <Link
              to="/register"
              className="flex w-full items-center justify-center rounded-xl py-2.5 text-xs font-semibold"
              style={{ background: '#f59e0b', color: '#000' }}
            >
              Créer mon compte
            </Link>
          </div>
        </aside>

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          {/* Mobile tabs */}
          <div className="flex gap-0 md:hidden" style={{ borderBottom: '1px solid #2a2a38', background: '#111118' }}>
            {TABS.map(({ key, label, icon }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className="flex flex-1 flex-col items-center py-2.5 text-[10px] gap-0.5"
                style={{ color: tab === key ? '#f59e0b' : '#71717a', borderBottom: `2px solid ${tab === key ? '#f59e0b' : 'transparent'}` }}
              >
                <span className="text-lg">{icon}</span>
                {label}
              </button>
            ))}
          </div>

          <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8">
            {tab === 'dashboard' && <DemoDashboard onBlock={() => setBlocked(true)} />}
            {tab === 'recipes' && <DemoRecipes onBlock={() => setBlocked(true)} />}
            {tab === 'ingredients' && <DemoIngredients onBlock={() => setBlocked(true)} />}
            {tab === 'invoices' && <DemoInvoices onBlock={() => setBlocked(true)} />}
          </div>
        </main>
      </div>

      {blocked && <BlockedModal onClose={() => setBlocked(false)} />}
    </div>
  );
}
