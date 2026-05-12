import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';

interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "À l'instant";
  if (mins < 60) return `Il y a ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Hier';
  return `Il y a ${days} jours`;
}

function typeIcon(type: string): string {
  if (type === 'food_cost') return '⚠️';
  if (type === 'price_increase') return '📈';
  if (type === 'weekly') return '📧';
  return '💡';
}

function typeRoute(type: string): string {
  if (type === 'food_cost') return '/analytics';
  if (type === 'price_increase') return '/ingredients';
  if (type === 'weekly') return '/dashboard';
  return '/alerts';
}

function typeColor(type: string): string {
  if (type === 'food_cost') return 'var(--amber)';
  if (type === 'price_increase') return '#ef4444';
  if (type === 'weekly') return '#60a5fa';
  return 'var(--accent)';
}

interface Props {
  onClose: () => void;
  onCountChange: (count: number) => void;
}

export function NotificationsPanel({ onClose, onCountChange }: Props) {
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const panelRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.get<Notification[]>('/notifications')
      .then((r) => setNotifs(r.data))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  async function markRead(id: number) {
    await api.patch(`/notifications/${id}/read`);
    setNotifs((prev) => prev.map((n) => n.id === id ? { ...n, isRead: true } : n));
    const unread = notifs.filter((n) => n.id !== id && !n.isRead).length;
    onCountChange(unread);
  }

  async function markAllRead() {
    await api.patch('/notifications/read-all');
    setNotifs((prev) => prev.map((n) => ({ ...n, isRead: true })));
    onCountChange(0);
  }

  async function deleteNotif(id: number, e: React.MouseEvent) {
    e.stopPropagation();
    await api.delete(`/notifications/${id}`);
    const updated = notifs.filter((n) => n.id !== id);
    setNotifs(updated);
    onCountChange(updated.filter((n) => !n.isRead).length);
  }

  async function handleClick(notif: Notification) {
    if (!notif.isRead) await markRead(notif.id);
    onClose();
    navigate(typeRoute(notif.type));
  }

  const unreadCount = notifs.filter((n) => !n.isRead).length;

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-full mt-2 z-[200] w-80 sm:w-96 rounded-2xl overflow-hidden"
      style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--bg-border)',
        boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--bg-border)' }}>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Notifications</span>
          {unreadCount > 0 && (
            <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: 'var(--accent)', color: '#000' }}>
              {unreadCount}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="text-xs font-medium"
            style={{ color: 'var(--accent)' }}
          >
            Tout lire
          </button>
        )}
      </div>

      {/* List */}
      <div className="max-h-[420px] overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-5 w-5 animate-spin rounded-full border-2" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
          </div>
        ) : notifs.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <span className="text-3xl">🎉</span>
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Aucune notification</p>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Vous êtes à jour !</p>
          </div>
        ) : (
          <div>
            {notifs.map((n, i) => (
              <div
                key={n.id}
                onClick={() => handleClick(n)}
                className="flex items-start gap-3 px-4 py-3 cursor-pointer transition-all"
                style={{
                  borderTop: i > 0 ? '1px solid var(--bg-border)' : undefined,
                  background: n.isRead ? 'transparent' : 'rgba(245,158,11,0.04)',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = n.isRead ? 'transparent' : 'rgba(245,158,11,0.04)')}
              >
                {/* Icon */}
                <div
                  className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm"
                  style={{ background: `rgba(${typeColor(n.type) === '#ef4444' ? '239,68,68' : typeColor(n.type) === '#60a5fa' ? '96,165,250' : '245,158,11'},0.12)` }}
                >
                  {typeIcon(n.type)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-semibold leading-snug" style={{ color: 'var(--text-primary)' }}>{n.title}</p>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {!n.isRead && (
                        <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: 'var(--accent)' }} />
                      )}
                      <button
                        onClick={(e) => deleteNotif(n.id, e)}
                        className="text-xs leading-none"
                        style={{ color: 'var(--text-tertiary)' }}
                        title="Supprimer"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                  <p className="mt-0.5 text-xs leading-relaxed line-clamp-2" style={{ color: 'var(--text-secondary)' }}>{n.message}</p>
                  <p className="mt-1 text-[10px]" style={{ color: 'var(--text-tertiary)' }}>{relativeTime(n.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
