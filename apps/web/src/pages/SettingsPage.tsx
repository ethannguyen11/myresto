import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthContext';
import { api } from '../api/client';

export function SettingsPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const isFr = i18n.language === 'fr';

  const [weeklyEmail, setWeeklyEmail] = useState(true);
  const [alertEmail, setAlertEmail] = useState(true);
  const [priceEmail, setPriceEmail] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [testMsg, setTestMsg] = useState('');

  async function sendTest() {
    setTestStatus('sending');
    setTestMsg('');
    try {
      const res = await api.post<{ sent: boolean; reason?: string }>('/email/send-weekly-test');
      if (res.data.sent) {
        setTestStatus('sent');
        setTestMsg(isFr ? 'Rapport envoyé avec succès !' : 'Report sent successfully!');
      } else {
        setTestStatus('error');
        setTestMsg(res.data.reason || (isFr ? 'Clé Resend non configurée.' : 'Resend API key not configured.'));
      }
    } catch {
      setTestStatus('error');
      setTestMsg(isFr ? 'Erreur lors de l\'envoi.' : 'Error sending email.');
    }
  }

  const toggleStyle = (active: boolean): React.CSSProperties => ({
    width: 40,
    height: 22,
    borderRadius: 999,
    background: active ? 'var(--accent)' : 'var(--bg-border)',
    position: 'relative',
    cursor: 'pointer',
    transition: 'background 0.2s',
    border: 'none',
    padding: 0,
    flexShrink: 0,
  });

  function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
    return (
      <button onClick={() => onChange(!value)} style={toggleStyle(value)}>
        <span style={{
          position: 'absolute',
          top: 3,
          left: value ? 21 : 3,
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: '#fff',
          transition: 'left 0.2s',
          boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
        }} />
      </button>
    );
  }

  const prefs = [
    {
      label: isFr ? 'Rapport hebdomadaire (lundi 7h)' : 'Weekly report (Monday 7am)',
      desc: isFr ? 'Recevez chaque lundi un résumé de vos food costs et marges.' : 'Receive a summary of your food costs and margins every Monday.',
      value: weeklyEmail,
      onChange: setWeeklyEmail,
    },
    {
      label: isFr ? 'Alertes food cost critique' : 'Critical food cost alerts',
      desc: isFr ? 'Email immédiat si un plat dépasse 35% de food cost.' : 'Immediate email when a dish exceeds 35% food cost.',
      value: alertEmail,
      onChange: setAlertEmail,
    },
    {
      label: isFr ? 'Alertes hausse de prix fournisseur' : 'Supplier price increase alerts',
      desc: isFr ? 'Notification si un ingrédient augmente de plus de 10%.' : 'Notification if an ingredient increases by more than 10%.',
      value: priceEmail,
      onChange: setPriceEmail,
    },
  ];

  return (
    <div className="space-y-8 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          {isFr ? 'Paramètres' : 'Settings'}
        </h1>
        <p className="mt-0.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
          {isFr ? 'Gérez vos préférences de notifications et emails.' : 'Manage your notification and email preferences.'}
        </p>
      </div>

      {/* Email section */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--bg-border)' }}>
        <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--bg-border)' }}>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            📧 {isFr ? 'Préférences emails' : 'Email preferences'}
          </h2>
          <p className="mt-0.5 text-xs" style={{ color: 'var(--text-tertiary)' }}>
            {isFr ? `Envoyés à : ${user?.email}` : `Sent to: ${user?.email}`}
          </p>
        </div>

        <div>
          {prefs.map((p, i) => (
            <div
              key={p.label}
              className="flex items-center justify-between px-5 py-4"
              style={{ borderTop: i > 0 ? '1px solid var(--bg-border)' : undefined }}
            >
              <div className="flex-1 min-w-0 pr-4">
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{p.label}</p>
                <p className="mt-0.5 text-xs" style={{ color: 'var(--text-tertiary)' }}>{p.desc}</p>
              </div>
              <Toggle value={p.value} onChange={p.onChange} />
            </div>
          ))}
        </div>

        {/* Test send */}
        <div className="px-5 py-4" style={{ borderTop: '1px solid var(--bg-border)', background: 'var(--bg-tertiary)' }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                {isFr ? 'Tester l\'envoi d\'un rapport' : 'Send a test report'}
              </p>
              <p className="mt-0.5 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                {isFr ? 'Envoie immédiatement le rapport à votre email.' : 'Immediately sends the report to your email.'}
              </p>
            </div>
            <button
              onClick={sendTest}
              disabled={testStatus === 'sending'}
              className="rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-60"
              style={{ background: 'var(--accent)', color: '#000' }}
            >
              {testStatus === 'sending'
                ? (isFr ? 'Envoi…' : 'Sending…')
                : (isFr ? 'Envoyer maintenant' : 'Send now')}
            </button>
          </div>
          {testMsg && (
            <p
              className="mt-2 text-xs"
              style={{ color: testStatus === 'sent' ? 'var(--green)' : 'var(--red)' }}
            >
              {testStatus === 'sent' ? '✓' : '✗'} {testMsg}
            </p>
          )}
        </div>
      </div>

      {/* Resend config notice */}
      <div
        className="rounded-2xl px-5 py-4"
        style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}
      >
        <p className="text-sm font-medium" style={{ color: 'var(--amber)' }}>
          🔑 {isFr ? 'Configuration requise' : 'Configuration required'}
        </p>
        <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
          {isFr
            ? 'Pour activer les emails, ajoutez votre clé API Resend dans apps/api/.env :'
            : 'To enable emails, add your Resend API key to apps/api/.env:'}
        </p>
        <code
          className="mt-2 block rounded-lg px-3 py-2 text-xs font-mono"
          style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
        >
          RESEND_API_KEY=re_your_key_here
        </code>
        <p className="mt-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
          {isFr ? 'Créez un compte gratuit sur ' : 'Create a free account at '}
          <span style={{ color: 'var(--accent)' }}>resend.com</span>
          {isFr ? ' (100 emails/jour gratuits).' : ' (100 emails/day free).'}
        </p>
      </div>
    </div>
  );
}
