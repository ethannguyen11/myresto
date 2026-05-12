import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

// ── Lang hook ──────────────────────────────────────────────────────────────

function useLandingLang(): ['fr' | 'en', () => void] {
  const [lang, setLang] = useState<'fr' | 'en'>(() => {
    const saved = localStorage.getItem('landing-lang');
    return (saved === 'en' ? 'en' : 'fr');
  });
  useEffect(() => { localStorage.setItem('landing-lang', lang); }, [lang]);
  return [lang, () => setLang((l) => (l === 'fr' ? 'en' : 'fr'))];
}

// ── Theme hook ─────────────────────────────────────────────────────────────

function useLandingTheme(): [boolean, () => void] {
  const [dark, setDark] = useState(() => localStorage.getItem('landing-theme') === 'dark');
  useEffect(() => { localStorage.setItem('landing-theme', dark ? 'dark' : 'light'); }, [dark]);
  return [dark, () => setDark((d) => !d)];
}

// ── Translations ───────────────────────────────────────────────────────────

const COPY = {
  fr: {
    navFeatures: 'Fonctionnalités',
    navPricing: 'Tarifs',
    navDemo: 'Démo',
    navLogin: 'Se connecter',
    navCta: 'Essayer gratuitement',
    badge: '✨ Analyse IA des factures fournisseurs',
    heroLine1: 'Sachez enfin si vos plats',
    heroAccent: 'vous font gagner',
    heroLine3: "de l'argent",
    subtitle: 'Chef IA analyse automatiquement vos factures fournisseurs et calcule la rentabilité de chaque plat en temps réel.',
    ctaDemo: 'Voir la démo',
    ctaRegister: 'Créer mon compte gratuit',
    mockupKpis: [
      { label: 'Food Cost Moyen', value: '27,4 %', color: '#10b981' },
      { label: 'Plats rentables', value: '6 / 8', color: '#f59e0b' },
      { label: 'Marge nette est.', value: '1 240 €', color: '#60a5fa' },
    ],
    mockupTitle: 'Analyse des recettes',
    mockupRecipes: [
      { name: 'Entrecôte frites', fc: 22, color: '#10b981' },
      { name: 'Saumon grillé', fc: 28, color: '#f59e0b' },
      { name: 'Burger du chef', fc: 38, color: '#ef4444' },
    ],
    stats: [
      { value: '< 10 min', label: 'Pour voir votre premier food cost' },
      { value: '30 %', label: 'Le seuil de rentabilité standard' },
      { value: '100 %', label: "Automatisé grâce à l'IA" },
    ],
    featTitle: 'Tout ce dont vous avez besoin',
    featSub: 'Chef IA centralise tout ce qui impacte votre rentabilité.',
    features: [
      { icon: '📸', title: 'Scan de factures IA', desc: "Prenez vos factures en photo. L'IA lit les prix et met à jour vos coûts automatiquement." },
      { icon: '📊', title: 'Food cost en temps réel', desc: 'Calculez instantanément la rentabilité de chaque plat avec les vrais prix du marché.' },
      { icon: '🤖', title: 'Conseiller IA', desc: 'Recevez des recommandations concrètes pour optimiser votre carte et augmenter vos marges.' },
    ],
    demoTitle: 'Voyez Chef IA en action',
    demoSub: "Naviguez dans l'interface avec de vraies données de restaurant. Sans inscription.",
    demoCta: '🚀 Explorer la démo',
    pricingTitle: 'Des tarifs simples et transparents',
    pricingSub: 'Commencez gratuitement, évoluez selon vos besoins.',
    free: 'Gratuit',
    freePer: '/mois',
    freeFeatures: ['3 recettes', '10 ingrédients', '2 scans de factures', 'Dashboard food cost', 'Accès web et mobile'],
    freeCta: 'Commencer gratuitement',
    proLabel: 'Pro',
    proBadge: 'Recommandé',
    proPer: '/mois',
    proFeatures: ['Recettes & ingrédients illimités', 'Scans IA illimités', 'Conseiller IA avancé', 'Rapports PDF', 'Export bon de commande', 'Support prioritaire'],
    proCta: 'Commencer',
    finalTitle: 'Prêt à optimiser votre restaurant ?',
    finalSub: 'Rejoignez les restaurateurs qui maîtrisent enfin leurs marges.',
    finalCta: 'Créer mon compte',
    footerDesc: 'La solution de rentabilité pour les restaurants modernes.',
    footerCol1: 'Produit',
    footerLinks1: ['Fonctionnalités', 'Tarifs', 'Démo'],
    footerCol2: 'Contact',
    footerLinks2: ['Support', 'Partenariats', 'Presse'],
    footerCopy: '© 2026 Chef IA. Tous droits réservés.',
  },
  en: {
    navFeatures: 'Features',
    navPricing: 'Pricing',
    navDemo: 'Demo',
    navLogin: 'Login',
    navCta: 'Start for free',
    badge: '✨ AI-powered supplier invoice analysis',
    heroLine1: 'Finally know if your dishes',
    heroAccent: 'are making you',
    heroLine3: 'money',
    subtitle: 'Chef IA automatically analyzes your supplier invoices and calculates the profitability of each dish in real time.',
    ctaDemo: 'See the demo',
    ctaRegister: 'Create my free account',
    mockupKpis: [
      { label: 'Avg Food Cost', value: '27.4 %', color: '#10b981' },
      { label: 'Profitable dishes', value: '6 / 8', color: '#f59e0b' },
      { label: 'Est. net margin', value: '€1,240', color: '#60a5fa' },
    ],
    mockupTitle: 'Recipe analysis',
    mockupRecipes: [
      { name: 'Rib steak & fries', fc: 22, color: '#10b981' },
      { name: 'Grilled salmon', fc: 28, color: '#f59e0b' },
      { name: 'Chef burger', fc: 38, color: '#ef4444' },
    ],
    stats: [
      { value: '< 10 min', label: 'To see your first food cost' },
      { value: '30 %', label: 'Standard profitability threshold' },
      { value: '100 %', label: 'Automated with AI' },
    ],
    featTitle: 'Everything you need to stay profitable',
    featSub: 'Chef IA centralizes everything that impacts your margins.',
    features: [
      { icon: '📸', title: 'AI Invoice Scanning', desc: 'Take a photo of your supplier invoices. AI reads the prices and updates your costs automatically.' },
      { icon: '📊', title: 'Real-time Food Cost', desc: 'Instantly calculate the profitability of each dish using current market prices.' },
      { icon: '🤖', title: 'Personalized AI Advisor', desc: 'Get concrete recommendations to optimize your menu and increase your margins.' },
    ],
    demoTitle: 'See Chef IA in action',
    demoSub: 'Browse the interface with real restaurant data. No account required.',
    demoCta: '🚀 Explore the demo',
    pricingTitle: 'Simple, transparent pricing',
    pricingSub: 'Start for free, scale as you grow.',
    free: 'Free',
    freePer: '/month',
    freeFeatures: ['3 recipes', '10 ingredients', '2 invoice scans', 'Food cost dashboard', 'Web & mobile access'],
    freeCta: 'Start for free',
    proLabel: 'Pro',
    proBadge: 'Recommended',
    proPer: '/month',
    proFeatures: ['Unlimited recipes & ingredients', 'Unlimited AI scans', 'Advanced AI advisor', 'PDF reports', 'Purchase order export', 'Priority support'],
    proCta: 'Get started',
    finalTitle: 'Ready to optimize your restaurant?',
    finalSub: 'Join restaurateurs who finally have control over their margins.',
    finalCta: 'Create my account',
    footerDesc: 'The profitability solution for modern restaurants.',
    footerCol1: 'Product',
    footerLinks1: ['Features', 'Pricing', 'Demo'],
    footerCol2: 'Contact',
    footerLinks2: ['Support', 'Partnerships', 'Press'],
    footerCopy: '© 2026 Chef IA. All rights reserved.',
  },
} as const;

// ── Theme tokens ───────────────────────────────────────────────────────────

function th(dark: boolean) {
  return {
    bg: dark ? '#0a0a0f' : '#ffffff',
    bgAlt: dark ? '#111118' : '#f8fafc',
    bgCard: dark ? '#111118' : '#ffffff',
    border: dark ? '#2a2a38' : '#e2e8f0',
    borderCard: dark ? '#2a2a38' : '#e2e8f0',
    text: dark ? '#ffffff' : '#0f172a',
    textSec: dark ? '#a1a1aa' : '#64748b',
    textTer: dark ? '#71717a' : '#94a3b8',
    navBg: (scrolled: boolean) =>
      scrolled ? (dark ? 'rgba(10,10,15,0.92)' : 'rgba(255,255,255,0.92)') : 'transparent',
    navBorder: (scrolled: boolean) =>
      scrolled ? (dark ? '#2a2a38' : '#e2e8f0') : 'transparent',
    shadow: dark ? 'none' : '0 1px 3px rgba(0,0,0,0.08)',
    btnPrimary: { background: '#f59e0b', color: '#000' } as React.CSSProperties,
    btnSecondary: (dark
      ? { border: '1px solid #2a2a38', color: '#ffffff', background: 'transparent' }
      : { border: '1px solid #0f172a', color: '#0f172a', background: 'transparent' }) as React.CSSProperties,
    glow: dark
      ? 'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(245,158,11,0.12) 0%, transparent 60%)'
      : 'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(245,158,11,0.08) 0%, transparent 60%)',
    pricingBorder: 'rgba(245,158,11,0.3)',
    pricingBg: 'rgba(245,158,11,0.04)',
    mockupBg: dark ? '#111118' : '#f1f5f9',
    mockupBorder: dark ? '#2a2a38' : '#e2e8f0',
    mockupChromeBg: dark ? '#0a0a0f' : '#f8fafc',
    mockupBarBg: dark ? '#1a1a24' : '#e2e8f0',
    mockupBarColor: dark ? '#71717a' : '#94a3b8',
    mockupCardBg: dark ? '#111118' : '#ffffff',
    mockupRowBg: dark ? '#1a1a24' : '#f1f5f9',
    toggleBg: dark ? '#1a1a24' : '#f1f5f9',
  };
}

// ── Main component ─────────────────────────────────────────────────────────

export function LandingPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [dark, toggleDark] = useLandingTheme();
  const [lang, toggleLang] = useLandingLang();
  const c = COPY[lang];
  const s = th(dark);

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

  const navLinks = [
    { label: c.navFeatures, ref: featuresRef },
    { label: c.navPricing, ref: pricingRef },
    { label: c.navDemo, ref: demoRef },
  ];

  const smallBtnStyle: React.CSSProperties = {
    background: s.toggleBg,
    border: `1px solid ${s.border}`,
    color: s.textSec,
    borderRadius: '999px',
    padding: '4px 10px',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
    lineHeight: '20px',
  };

  return (
    <div style={{ background: s.bg, minHeight: '100vh', color: s.text, transition: 'background 0.2s, color 0.2s' }}>

      {/* ── NAVBAR ── */}
      <header
        className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
        style={{
          background: s.navBg(scrolled),
          backdropFilter: scrolled ? 'blur(12px)' : 'none',
          borderBottom: `1px solid ${s.navBorder(scrolled)}`,
          boxShadow: scrolled && !dark ? '0 1px 8px rgba(0,0,0,0.06)' : 'none',
        }}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-8">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg text-lg" style={{ background: 'rgba(245,158,11,0.15)' }}>🍳</span>
            <span className="text-base font-bold tracking-tight" style={{ color: s.text }}>Chef IA</span>
          </div>

          {/* Nav links */}
          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map(({ label, ref }) => (
              <button
                key={label}
                onClick={() => scrollTo(ref)}
                className="text-sm font-medium transition-colors"
                style={{ color: s.textSec }}
                onMouseEnter={(e) => (e.currentTarget.style.color = s.text)}
                onMouseLeave={(e) => (e.currentTarget.style.color = s.textSec)}
              >
                {label}
              </button>
            ))}
          </nav>

          {/* Controls */}
          <div className="flex items-center gap-2">
            {/* Lang toggle */}
            <button onClick={toggleLang} style={smallBtnStyle} title="Switch language">
              {lang === 'fr' ? 'EN' : 'FR'}
            </button>

            {/* Theme toggle */}
            <button
              onClick={toggleDark}
              className="flex h-8 w-8 items-center justify-center rounded-full text-sm transition-colors"
              style={{ background: s.toggleBg, border: `1px solid ${s.border}`, color: s.textSec }}
              title={dark ? 'Light mode' : 'Dark mode'}
            >
              {dark ? '☀️' : '🌙'}
            </button>

            <Link
              to="/login"
              className="hidden sm:block text-sm font-medium transition-colors"
              style={{ color: s.textSec }}
            >
              {c.navLogin}
            </Link>
            <Link
              to="/register"
              className="rounded-full px-5 py-2 text-sm font-semibold"
              style={s.btnPrimary}
            >
              {c.navCta}
            </Link>
          </div>
        </div>
      </header>

      {/* ── HERO ── */}
      <section className="relative flex min-h-screen flex-col items-center justify-center px-4 pt-16 text-center">
        <div className="pointer-events-none absolute inset-0" style={{ background: s.glow }} />

        <div className="relative mx-auto max-w-4xl">
          {/* Badge */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', color: '#f59e0b' }}>
            {c.badge}
          </div>

          {/* Title */}
          <h1 className="text-5xl font-bold leading-tight tracking-tight md:text-7xl" style={{ color: s.text }}>
            {c.heroLine1}<br />
            <span style={{ color: '#f59e0b' }}>{c.heroAccent}</span><br />
            {c.heroLine3}
          </h1>

          {/* Subtitle */}
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed" style={{ color: s.textSec }}>
            {c.subtitle}
          </p>

          {/* CTAs */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <button
              onClick={() => scrollTo(demoRef)}
              className="rounded-full px-8 py-4 text-base font-semibold"
              style={s.btnPrimary}
            >
              {c.ctaDemo}
            </button>
            <Link
              to="/register"
              className="rounded-full px-8 py-4 text-base font-semibold"
              style={s.btnSecondary}
            >
              {c.ctaRegister}
            </Link>
          </div>

          {/* App mockup */}
          <div className="relative mt-20 mx-auto max-w-4xl">
            <div
              className="overflow-hidden rounded-2xl"
              style={{ border: `1px solid ${s.mockupBorder}`, background: s.mockupBg, boxShadow: dark ? '0 40px 80px rgba(0,0,0,0.6)' : '0 24px 64px rgba(0,0,0,0.1)' }}
            >
              {/* Browser chrome */}
              <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: `1px solid ${s.mockupBorder}`, background: s.mockupChromeBg }}>
                <span className="h-3 w-3 rounded-full" style={{ background: '#ef4444' }} />
                <span className="h-3 w-3 rounded-full" style={{ background: '#f59e0b' }} />
                <span className="h-3 w-3 rounded-full" style={{ background: '#10b981' }} />
                <div className="mx-auto rounded-md px-4 py-1 text-xs" style={{ background: s.mockupBarBg, color: s.mockupBarColor }}>
                  app.chefai.fr/dashboard
                </div>
              </div>
              {/* Dashboard preview */}
              <div className="p-6" style={{ background: s.mockupChromeBg }}>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  {c.mockupKpis.map((k) => (
                    <div key={k.label} className="rounded-xl p-4" style={{ background: s.mockupCardBg, border: `1px solid ${s.mockupBorder}` }}>
                      <p className="text-xs mb-1" style={{ color: s.textTer }}>{k.label}</p>
                      <p className="text-2xl font-bold" style={{ color: k.color }}>{k.value}</p>
                    </div>
                  ))}
                </div>
                <div className="rounded-xl p-4" style={{ background: s.mockupCardBg, border: `1px solid ${s.mockupBorder}` }}>
                  <p className="text-xs mb-3" style={{ color: s.textTer }}>{c.mockupTitle}</p>
                  <div className="space-y-2">
                    {c.mockupRecipes.map((r) => (
                      <div key={r.name} className="flex items-center gap-3">
                        <span className="text-xs w-36 truncate text-left" style={{ color: s.textSec }}>{r.name}</span>
                        <div className="flex-1 h-2 rounded-full" style={{ background: s.mockupRowBg }}>
                          <div className="h-2 rounded-full" style={{ width: `${r.fc}%`, background: r.color }} />
                        </div>
                        <span className="text-xs font-semibold w-10 text-right" style={{ color: r.color }}>{r.fc}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="pointer-events-none absolute -bottom-10 left-1/2 -translate-x-1/2 h-20 w-3/4 blur-3xl" style={{ background: 'rgba(245,158,11,0.12)' }} />
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <section style={{ background: s.bgAlt, borderTop: `1px solid ${s.border}`, borderBottom: `1px solid ${s.border}` }} className="py-20 px-4">
        <div className="mx-auto max-w-4xl">
          <div className="grid grid-cols-1 sm:grid-cols-3">
            {c.stats.map((stat, i) => (
              <div
                key={stat.label}
                className="flex flex-col items-center py-12 text-center px-8"
                style={{ borderLeft: i > 0 ? `1px solid ${s.border}` : undefined }}
              >
                <span className="text-5xl font-bold" style={{ color: '#f59e0b' }}>{stat.value}</span>
                <span className="mt-2 text-sm" style={{ color: s.textTer }}>{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section ref={featuresRef} className="py-24 px-4" style={{ background: s.bg }}>
        <div className="mx-auto max-w-5xl">
          <div className="mb-16 text-center">
            <h2 className="text-3xl font-bold sm:text-4xl" style={{ color: s.text }}>{c.featTitle}</h2>
            <p className="mt-3 text-base" style={{ color: s.textTer }}>{c.featSub}</p>
          </div>
          <div className="grid gap-6 sm:grid-cols-3">
            {c.features.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl p-6 transition-all"
                style={{ background: s.bgCard, border: `1px solid ${s.borderCard}`, boxShadow: s.shadow }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(245,158,11,0.4)')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = s.borderCard)}
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl text-2xl" style={{ background: 'rgba(245,158,11,0.1)' }}>
                  {f.icon}
                </div>
                <h3 className="mb-2 text-base font-semibold" style={{ color: s.text }}>{f.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: s.textTer }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── DEMO CTA ── */}
      <section ref={demoRef} className="py-24 px-4" style={{ background: s.bgAlt }}>
        <div
          className="mx-auto max-w-3xl rounded-3xl p-12 text-center"
          style={{ background: s.bgCard, border: `1px solid ${s.borderCard}`, boxShadow: s.shadow }}
        >
          <span className="text-5xl">🚀</span>
          <h2 className="mt-6 text-3xl font-bold sm:text-4xl" style={{ color: s.text }}>{c.demoTitle}</h2>
          <p className="mt-4 text-base" style={{ color: s.textSec }}>{c.demoSub}</p>
          <Link
            to="/demo"
            className="mt-8 inline-flex items-center gap-2 rounded-full px-10 py-4 text-base font-semibold"
            style={s.btnPrimary}
          >
            {c.demoCta}
          </Link>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section ref={pricingRef} className="py-24 px-4" style={{ background: s.bg }}>
        <div className="mx-auto max-w-4xl">
          <div className="mb-16 text-center">
            <h2 className="text-3xl font-bold sm:text-4xl" style={{ color: s.text }}>{c.pricingTitle}</h2>
            <p className="mt-3 text-base" style={{ color: s.textTer }}>{c.pricingSub}</p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            {/* Free */}
            <div className="rounded-2xl p-8" style={{ background: s.bgCard, border: `1px solid ${s.borderCard}`, boxShadow: s.shadow }}>
              <p className="text-sm font-semibold uppercase tracking-widest" style={{ color: s.textTer }}>{c.free}</p>
              <div className="mt-4 flex items-end gap-2">
                <span className="text-5xl font-bold" style={{ color: s.text }}>0€</span>
                <span className="mb-1 text-sm" style={{ color: s.textTer }}>{c.freePer}</span>
              </div>
              <ul className="mt-8 space-y-3">
                {c.freeFeatures.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm" style={{ color: s.textSec }}>
                    <span style={{ color: '#10b981' }}>✓</span> {f}
                  </li>
                ))}
              </ul>
              <Link
                to="/register"
                className="mt-8 flex w-full items-center justify-center rounded-full py-3 text-sm font-semibold"
                style={s.btnSecondary}
              >
                {c.freeCta}
              </Link>
            </div>

            {/* Pro */}
            <div className="relative rounded-2xl p-8" style={{ background: s.pricingBg, border: `1px solid ${s.pricingBorder}` }}>
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-4 py-1 text-xs font-semibold" style={{ background: '#f59e0b', color: '#000' }}>
                {c.proBadge}
              </div>
              <p className="text-sm font-semibold uppercase tracking-widest" style={{ color: '#f59e0b' }}>{c.proLabel}</p>
              <div className="mt-4 flex items-end gap-2">
                <span className="text-5xl font-bold" style={{ color: s.text }}>49€</span>
                <span className="mb-1 text-sm" style={{ color: s.textTer }}>{c.proPer}</span>
              </div>
              <ul className="mt-8 space-y-3">
                {c.proFeatures.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm" style={{ color: s.textSec }}>
                    <span style={{ color: '#f59e0b' }}>✓</span> {f}
                  </li>
                ))}
              </ul>
              <Link
                to="/register"
                className="mt-8 flex w-full items-center justify-center rounded-full py-3 text-sm font-semibold"
                style={s.btnPrimary}
              >
                {c.proCta}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="py-24 px-4" style={{ background: s.bgAlt }}>
        <div
          className="mx-auto max-w-4xl rounded-3xl p-16 text-center"
          style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}
        >
          <h2 className="text-3xl font-bold sm:text-4xl" style={{ color: '#000' }}>{c.finalTitle}</h2>
          <p className="mt-4 text-base" style={{ color: 'rgba(0,0,0,0.7)' }}>{c.finalSub}</p>
          <Link
            to="/register"
            className="mt-8 inline-flex items-center gap-2 rounded-full px-10 py-4 text-lg font-semibold"
            style={{ background: '#ffffff', color: '#0f172a' }}
          >
            {c.finalCta}
          </Link>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="px-4 py-12" style={{ background: s.bg, borderTop: `1px solid ${s.border}` }}>
        <div className="mx-auto max-w-5xl">
          <div className="grid gap-8 sm:grid-cols-3">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg text-base" style={{ background: 'rgba(245,158,11,0.15)' }}>🍳</span>
                <span className="font-bold" style={{ color: s.text }}>Chef IA</span>
              </div>
              <p className="text-sm leading-relaxed" style={{ color: s.textTer }}>{c.footerDesc}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: s.textTer }}>{c.footerCol1}</p>
              <div className="space-y-2">
                {c.footerLinks1.map((l) => (
                  <p key={l} className="text-sm" style={{ color: s.textSec }}>{l}</p>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: s.textTer }}>{c.footerCol2}</p>
              <div className="space-y-2">
                {c.footerLinks2.map((l) => (
                  <p key={l} className="text-sm" style={{ color: s.textSec }}>{l}</p>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-12 pt-8 text-center text-xs" style={{ borderTop: `1px solid ${s.border}`, color: s.textTer }}>
            {c.footerCopy}
          </div>
        </div>
      </footer>
    </div>
  );
}
