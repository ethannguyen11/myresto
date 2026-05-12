import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export function LandingPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const demoRef = useRef<HTMLElement>(null);
  const featuresRef = useRef<HTMLElement>(null);
  const pricingRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!isLoading && isAuthenticated) navigate('/dashboard', { replace: true });
  }, [isAuthenticated, isLoading, navigate]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  function scrollTo(ref: React.RefObject<HTMLElement | null>) {
    ref.current?.scrollIntoView({ behavior: 'smooth' });
  }

  if (isLoading) return null;

  return (
    <div style={{ background: '#0a0a0f', minHeight: '100vh', color: '#fff' }}>

      {/* ── NAVBAR ── */}
      <header
        className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
        style={{
          background: scrolled ? 'rgba(10,10,15,0.92)' : 'transparent',
          backdropFilter: scrolled ? 'blur(12px)' : 'none',
          borderBottom: scrolled ? '1px solid #2a2a38' : '1px solid transparent',
        }}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-8">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg text-lg" style={{ background: 'rgba(245,158,11,0.15)' }}>🍳</span>
            <span className="text-base font-bold tracking-tight" style={{ color: '#fff' }}>Chef IA</span>
          </div>

          <nav className="hidden md:flex items-center gap-8">
            {[
              { label: 'Fonctionnalités', ref: featuresRef },
              { label: 'Tarifs', ref: pricingRef },
              { label: 'Démo', ref: demoRef },
            ].map(({ label, ref }) => (
              <button
                key={label}
                onClick={() => scrollTo(ref)}
                className="text-sm font-medium transition-colors"
                style={{ color: '#a1a1aa' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#a1a1aa')}
              >
                {label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="hidden sm:block text-sm font-medium transition-colors"
              style={{ color: '#a1a1aa' }}
            >
              Se connecter
            </Link>
            <Link
              to="/register"
              className="rounded-full px-5 py-2 text-sm font-semibold transition-all"
              style={{ background: '#f59e0b', color: '#000' }}
            >
              Essayer gratuitement
            </Link>
          </div>
        </div>
      </header>

      {/* ── HERO ── */}
      <section className="relative flex min-h-screen flex-col items-center justify-center px-4 pt-16 text-center">
        {/* Background glow */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(245,158,11,0.12) 0%, transparent 60%)',
          }}
        />

        <div className="relative mx-auto max-w-4xl">
          {/* Badge */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', color: '#f59e0b' }}>
            <span>✨</span> Analyse IA des factures fournisseurs
          </div>

          {/* Title */}
          <h1 className="text-5xl font-bold leading-tight tracking-tight md:text-7xl" style={{ color: '#fff' }}>
            Sachez enfin si vos plats<br />
            <span style={{ color: '#f59e0b' }}>vous font gagner</span><br />
            de l'argent
          </h1>

          {/* Subtitle */}
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed" style={{ color: '#a1a1aa' }}>
            Chef IA analyse automatiquement vos factures et calcule la rentabilité
            de chaque plat en temps réel. Fini les tableurs Excel.
          </p>

          {/* CTAs */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <button
              onClick={() => scrollTo(demoRef)}
              className="rounded-full px-8 py-4 text-base font-semibold transition-all"
              style={{ background: '#f59e0b', color: '#000' }}
            >
              Voir la démo
            </button>
            <Link
              to="/register"
              className="rounded-full px-8 py-4 text-base font-semibold transition-all"
              style={{ border: '1px solid #2a2a38', color: '#fff', background: 'transparent' }}
            >
              Créer mon compte gratuit
            </Link>
          </div>

          {/* App mockup */}
          <div className="relative mt-20 mx-auto max-w-4xl">
            <div
              className="overflow-hidden rounded-2xl"
              style={{ border: '1px solid #2a2a38', background: '#111118', boxShadow: '0 40px 80px rgba(0,0,0,0.6)' }}
            >
              {/* Browser chrome */}
              <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: '1px solid #2a2a38', background: '#0a0a0f' }}>
                <span className="h-3 w-3 rounded-full" style={{ background: '#ef4444' }} />
                <span className="h-3 w-3 rounded-full" style={{ background: '#f59e0b' }} />
                <span className="h-3 w-3 rounded-full" style={{ background: '#10b981' }} />
                <div className="mx-auto rounded-md px-4 py-1 text-xs" style={{ background: '#1a1a24', color: '#71717a' }}>
                  app.chefai.fr/dashboard
                </div>
              </div>
              {/* Dashboard preview */}
              <div className="p-6" style={{ background: '#0a0a0f' }}>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  {[
                    { label: 'Food Cost Moyen', value: '27,4 %', color: '#10b981' },
                    { label: 'Recettes rentables', value: '6 / 8', color: '#f59e0b' },
                    { label: 'Marge nette estimée', value: '1 240 €', color: '#60a5fa' },
                  ].map((k) => (
                    <div key={k.label} className="rounded-xl p-4" style={{ background: '#111118', border: '1px solid #2a2a38' }}>
                      <p className="text-xs mb-1" style={{ color: '#71717a' }}>{k.label}</p>
                      <p className="text-2xl font-bold" style={{ color: k.color }}>{k.value}</p>
                    </div>
                  ))}
                </div>
                <div className="rounded-xl p-4" style={{ background: '#111118', border: '1px solid #2a2a38' }}>
                  <p className="text-xs mb-3" style={{ color: '#71717a' }}>Analyse des recettes</p>
                  <div className="space-y-2">
                    {[
                      { name: 'Entrecôte frites', fc: 22, color: '#10b981' },
                      { name: 'Saumon grillé', fc: 28, color: '#f59e0b' },
                      { name: 'Burger du chef', fc: 38, color: '#ef4444' },
                    ].map((r) => (
                      <div key={r.name} className="flex items-center gap-3">
                        <span className="text-xs w-32 truncate" style={{ color: '#a1a1aa' }}>{r.name}</span>
                        <div className="flex-1 h-2 rounded-full" style={{ background: '#1a1a24' }}>
                          <div className="h-2 rounded-full" style={{ width: `${r.fc}%`, background: r.color }} />
                        </div>
                        <span className="text-xs font-semibold w-10 text-right" style={{ color: r.color }}>{r.fc}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            {/* Glow under mockup */}
            <div
              className="pointer-events-none absolute -bottom-10 left-1/2 -translate-x-1/2 h-20 w-3/4 blur-3xl"
              style={{ background: 'rgba(245,158,11,0.15)' }}
            />
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <section className="py-24 px-4">
        <div className="mx-auto max-w-4xl">
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-3">
            {[
              { value: '< 10 min', label: 'Pour voir votre premier food cost' },
              { value: '30 %', label: 'Le seuil de rentabilité standard' },
              { value: '100 %', label: 'Automatisé grâce à l\'IA' },
            ].map((s, i) => (
              <div
                key={s.label}
                className="flex flex-col items-center py-12 text-center px-8"
                style={{ borderLeft: i > 0 ? '1px solid #2a2a38' : undefined }}
              >
                <span className="text-5xl font-bold" style={{ color: '#f59e0b' }}>{s.value}</span>
                <span className="mt-2 text-sm" style={{ color: '#71717a' }}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section ref={featuresRef} className="py-24 px-4">
        <div className="mx-auto max-w-5xl">
          <div className="mb-16 text-center">
            <h2 className="text-3xl font-bold sm:text-4xl" style={{ color: '#fff' }}>
              Tout ce dont vous avez besoin
            </h2>
            <p className="mt-3 text-base" style={{ color: '#71717a' }}>
              Chef IA centralise tout ce qui impacte votre rentabilité.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-3">
            {[
              {
                icon: '📸',
                title: 'Scan de factures IA',
                desc: 'Prenez vos factures en photo. L\'IA lit les prix et met à jour vos coûts automatiquement.',
              },
              {
                icon: '📊',
                title: 'Food cost en temps réel',
                desc: 'Calculez instantanément la rentabilité de chaque plat avec les vrais prix du marché.',
              },
              {
                icon: '🤖',
                title: 'Conseiller IA personnalisé',
                desc: 'Recevez des recommandations concrètes pour optimiser votre carte et augmenter vos marges.',
              },
            ].map((f) => (
              <div
                key={f.title}
                className="rounded-2xl p-6 transition-all"
                style={{ background: '#111118', border: '1px solid #2a2a38' }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(245,158,11,0.4)')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#2a2a38')}
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl text-2xl" style={{ background: 'rgba(245,158,11,0.1)' }}>
                  {f.icon}
                </div>
                <h3 className="mb-2 text-base font-semibold" style={{ color: '#fff' }}>{f.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: '#71717a' }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── DEMO CTA ── */}
      <section ref={demoRef} className="py-24 px-4">
        <div
          className="mx-auto max-w-3xl rounded-3xl p-12 text-center"
          style={{ background: '#111118', border: '1px solid #2a2a38' }}
        >
          <span className="text-5xl">🚀</span>
          <h2 className="mt-6 text-3xl font-bold sm:text-4xl" style={{ color: '#fff' }}>
            Voyez Chef IA en action
          </h2>
          <p className="mt-4 text-base" style={{ color: '#a1a1aa' }}>
            Naviguez dans l'interface avec de vraies données de restaurant.
            Aucun compte requis.
          </p>
          <Link
            to="/demo"
            className="mt-8 inline-flex items-center gap-2 rounded-full px-10 py-4 text-base font-semibold transition-all"
            style={{ background: '#f59e0b', color: '#000' }}
          >
            🚀 Explorer la démo
          </Link>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section ref={pricingRef} className="py-24 px-4">
        <div className="mx-auto max-w-4xl">
          <div className="mb-16 text-center">
            <h2 className="text-3xl font-bold sm:text-4xl" style={{ color: '#fff' }}>
              Tarifs simples et transparents
            </h2>
            <p className="mt-3 text-base" style={{ color: '#71717a' }}>
              Commencez gratuitement, évoluez selon vos besoins.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            {/* Free */}
            <div className="rounded-2xl p-8" style={{ background: '#111118', border: '1px solid #2a2a38' }}>
              <p className="text-sm font-semibold uppercase tracking-widest" style={{ color: '#71717a' }}>Gratuit</p>
              <div className="mt-4 flex items-end gap-2">
                <span className="text-5xl font-bold" style={{ color: '#fff' }}>0€</span>
                <span className="mb-1 text-sm" style={{ color: '#71717a' }}>/mois</span>
              </div>
              <ul className="mt-8 space-y-3">
                {['3 recettes', '10 ingrédients', '2 scans de factures', 'Dashboard food cost', 'Accès web et mobile'].map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm" style={{ color: '#a1a1aa' }}>
                    <span style={{ color: '#10b981' }}>✓</span> {f}
                  </li>
                ))}
              </ul>
              <Link
                to="/register"
                className="mt-8 flex w-full items-center justify-center rounded-full py-3 text-sm font-semibold transition-all"
                style={{ border: '1px solid #2a2a38', color: '#fff', background: 'transparent' }}
              >
                Commencer gratuitement
              </Link>
            </div>
            {/* Pro */}
            <div className="relative rounded-2xl p-8" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.3)' }}>
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-4 py-1 text-xs font-semibold" style={{ background: '#f59e0b', color: '#000' }}>
                Recommandé
              </div>
              <p className="text-sm font-semibold uppercase tracking-widest" style={{ color: '#f59e0b' }}>Pro</p>
              <div className="mt-4 flex items-end gap-2">
                <span className="text-5xl font-bold" style={{ color: '#fff' }}>49€</span>
                <span className="mb-1 text-sm" style={{ color: '#71717a' }}>/mois</span>
              </div>
              <ul className="mt-8 space-y-3">
                {['Recettes & ingrédients illimités', 'Scans IA illimités', 'Conseiller IA avancé', 'Rapports PDF', 'Export bon de commande', 'Support prioritaire'].map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm" style={{ color: '#a1a1aa' }}>
                    <span style={{ color: '#f59e0b' }}>✓</span> {f}
                  </li>
                ))}
              </ul>
              <Link
                to="/register"
                className="mt-8 flex w-full items-center justify-center rounded-full py-3 text-sm font-semibold transition-all"
                style={{ background: '#f59e0b', color: '#000' }}
              >
                Commencer gratuitement
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="py-24 px-4">
        <div
          className="mx-auto max-w-4xl rounded-3xl p-16 text-center"
          style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}
        >
          <h2 className="text-3xl font-bold sm:text-4xl" style={{ color: '#000' }}>
            Prêt à optimiser votre restaurant ?
          </h2>
          <p className="mt-4 text-base" style={{ color: 'rgba(0,0,0,0.7)' }}>
            Rejoignez les restaurateurs qui ont enfin le contrôle sur leurs marges.
          </p>
          <Link
            to="/register"
            className="mt-8 inline-flex items-center gap-2 rounded-full px-10 py-4 text-base font-semibold transition-all"
            style={{ background: '#000', color: '#fff' }}
          >
            Créer mon compte
          </Link>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t px-4 py-12" style={{ borderColor: '#2a2a38' }}>
        <div className="mx-auto max-w-5xl">
          <div className="grid gap-8 sm:grid-cols-3">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg text-base" style={{ background: 'rgba(245,158,11,0.15)' }}>🍳</span>
                <span className="font-bold" style={{ color: '#fff' }}>Chef IA</span>
              </div>
              <p className="text-sm leading-relaxed" style={{ color: '#71717a' }}>
                La solution de rentabilité pour les restaurants modernes.
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: '#71717a' }}>Produit</p>
              <div className="space-y-2">
                {['Fonctionnalités', 'Tarifs', 'Démo'].map((l) => (
                  <p key={l} className="text-sm" style={{ color: '#a1a1aa' }}>{l}</p>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: '#71717a' }}>Contact</p>
              <div className="space-y-2">
                {['Support', 'Partenariats', 'Presse'].map((l) => (
                  <p key={l} className="text-sm" style={{ color: '#a1a1aa' }}>{l}</p>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-12 pt-8 text-center text-xs" style={{ borderTop: '1px solid #2a2a38', color: '#71717a' }}>
            © 2026 Chef IA. Tous droits réservés.
          </div>
        </div>
      </footer>
    </div>
  );
}
