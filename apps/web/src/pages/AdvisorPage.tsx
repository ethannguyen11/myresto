import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';

interface ChatMessage { role: 'user' | 'assistant'; content: string; }

// ── Markdown-lite renderer ─────────────────────────────────────────────────

function renderMarkdown(text: string): React.ReactNode[] {
  return text.split('\n').map((line, i) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g).map((part, j) => {
      if (part.startsWith('**') && part.endsWith('**')) return <strong key={j}>{part.slice(2, -2)}</strong>;
      return <span key={j}>{part}</span>;
    });

    if (/^---+$/.test(line.trim())) return <hr key={i} className="my-3" style={{ borderColor: 'var(--bg-border)' }} />;
    if (line.trim() === '') return <div key={i} className="h-2" />;

    if (line.startsWith('### ')) {
      const inner = line.slice(4).split(/(\*\*[^*]+\*\*)/g).map((p, j) =>
        p.startsWith('**') && p.endsWith('**') ? <strong key={j}>{p.slice(2, -2)}</strong> : <span key={j}>{p}</span>
      );
      return <h3 key={i} className="mt-4 text-sm font-semibold first:mt-0" style={{ color: 'var(--accent)' }}>{inner}</h3>;
    }
    if (line.startsWith('## ')) {
      const inner = line.slice(3).split(/(\*\*[^*]+\*\*)/g).map((p, j) =>
        p.startsWith('**') && p.endsWith('**') ? <strong key={j}>{p.slice(2, -2)}</strong> : <span key={j}>{p}</span>
      );
      return <h2 key={i} className="mt-5 text-base font-semibold first:mt-0" style={{ color: 'var(--accent)' }}>{inner}</h2>;
    }
    if (line.startsWith('# ')) {
      const inner = line.slice(2).split(/(\*\*[^*]+\*\*)/g).map((p, j) =>
        p.startsWith('**') && p.endsWith('**') ? <strong key={j}>{p.slice(2, -2)}</strong> : <span key={j}>{p}</span>
      );
      return <h1 key={i} className="mt-6 text-lg font-bold first:mt-0" style={{ color: 'var(--accent)' }}>{inner}</h1>;
    }
    if (/^\d+[\.\)]\s/.test(line.trim())) {
      return <p key={i} className="mt-1 pl-4 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{parts}</p>;
    }
    if (/^[-•]\s/.test(line.trim())) {
      return <p key={i} className="mt-0.5 pl-4 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{parts}</p>;
    }
    if (/^\p{Emoji}/u.test(line.trim())) {
      return <p key={i} className="mt-4 text-sm font-semibold leading-relaxed first:mt-0" style={{ color: 'var(--text-primary)' }}>{parts}</p>;
    }
    return <p key={i} className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{parts}</p>;
  });
}

// ── Chat bubble ────────────────────────────────────────────────────────────

function ChatBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <div
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm"
        style={{
          background: isUser ? 'var(--accent-bg)' : 'var(--bg-tertiary)',
          color: isUser ? 'var(--accent)' : 'var(--text-secondary)',
        }}
      >
        {isUser ? '👤' : '🤖'}
      </div>
      <div
        className="max-w-[80%] rounded-2xl px-4 py-3"
        style={isUser ? {
          background: 'var(--accent-bg)',
          border: '1px solid var(--accent)',
          borderTopRightRadius: 4,
        } : {
          background: 'var(--bg-secondary)',
          border: '1px solid var(--bg-border)',
          borderTopLeftRadius: 4,
        }}
      >
        {isUser ? (
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>{message.content}</p>
        ) : (
          <div className="space-y-0.5">{renderMarkdown(message.content)}</div>
        )}
      </div>
    </div>
  );
}

// ── Typing indicator ───────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex gap-3">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm" style={{ background: 'var(--bg-tertiary)' }}>
        🤖
      </div>
      <div className="rounded-2xl px-4 py-3" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--bg-border)', borderTopLeftRadius: 4 }}>
        <div className="flex items-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <span key={i} className="h-2 w-2 animate-bounce rounded-full" style={{ background: 'var(--text-tertiary)', animationDelay: `${i * 150}ms` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Report section ─────────────────────────────────────────────────────────

function ReportSection({ report, generatedAt, loading, error, onGenerate }: {
  report: string | null; generatedAt: string | null; loading: boolean; error: string; onGenerate: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="rounded-xl" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--bg-border)' }}>
      <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--bg-border)' }}>
        <div>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('advisor.report.title')}</h2>
          {generatedAt && (
            <p className="mt-0.5 text-xs" style={{ color: 'var(--text-tertiary)' }}>
              {t('advisor.report.generatedOn')}{' '}
              {new Date(generatedAt).toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>
        <button
          onClick={onGenerate}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60"
          style={{ background: 'var(--accent)', color: '#000' }}
        >
          {loading ? (
            <><span className="h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent" />{t('common.generating')}</>
          ) : (
            <>✨ {report ? t('advisor.report.regenerate') : t('advisor.report.generate')}</>
          )}
        </button>
      </div>
      <div className="px-5 py-4">
        {error && (
          <div className="mb-4 rounded-lg px-4 py-3 text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--red)', border: '1px solid rgba(239,68,68,0.2)' }}>
            {error}
          </div>
        )}
        {loading && !report ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <span className="h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {t('advisor.report.analyzing')}<br />
              <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{t('advisor.report.analyzingHint')}</span>
            </p>
          </div>
        ) : report ? (
          <div className="space-y-0.5">{renderMarkdown(report)}</div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <span className="text-4xl">📊</span>
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{t('advisor.report.emptyTitle')}</p>
            <p className="max-w-sm text-xs" style={{ color: 'var(--text-tertiary)' }}>{t('advisor.report.emptyDesc')}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Simulation section ─────────────────────────────────────────────────────

interface SimRecipe {
  name: string; category: string | null; currentFoodCost: number;
  currentSellingPrice: number; totalIngredientCost: number;
  requiredSellingPrice: number | null; priceDelta: number | null;
  mostImpactfulIngredient: { name: string; lineCost: number; quantity: number; unit: string } | null;
}
interface SimulationResult {
  currentAvgFoodCost: number; targetFoodCost: number; suggestions: string; recipes: SimRecipe[];
}

function SimulationSection() {
  const { t } = useTranslation();
  const [target, setTarget] = useState(30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<SimulationResult | null>(null);

  async function handleSimulate() {
    setLoading(true);
    setError('');
    try {
      const res = await api.post<SimulationResult>('/advisor/simulate', { targetFoodCost: target });
      setResult(res.data);
    } catch (err: any) {
      setError(err.response?.data?.message ?? t('advisor.simulation.error'));
    } finally {
      setLoading(false);
    }
  }

  const inputStyle = { background: 'var(--bg-tertiary)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)', borderRadius: 8, padding: '8px 12px', fontSize: 14, outline: 'none', width: 80 };

  return (
    <div className="rounded-xl" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--bg-border)' }}>
      <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--bg-border)' }}>
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('advisor.simulation.title')}</h2>
        <p className="mt-0.5 text-xs" style={{ color: 'var(--text-secondary)' }}>{t('advisor.simulation.desc')}</p>
      </div>
      <div className="flex flex-wrap items-end gap-4 px-5 py-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{t('advisor.simulation.targetLabel')}</label>
          <div className="flex items-center gap-2">
            <input type="number" min={1} max={100} value={target} onChange={(e) => setTarget(Math.max(1, Math.min(100, Number(e.target.value))))} style={inputStyle} />
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>%</span>
          </div>
        </div>
        <button
          onClick={handleSimulate}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60"
          style={{ background: 'var(--accent)', color: '#000' }}
        >
          {loading ? (
            <><span className="h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent" />{t('advisor.simulation.simulating')}</>
          ) : t('advisor.simulation.simulate')}
        </button>
      </div>
      {(error || result) && (
        <div className="px-5 py-4 space-y-5" style={{ borderTop: '1px solid var(--bg-border)' }}>
          {error && <div className="rounded-lg px-4 py-3 text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--red)' }}>{error}</div>}
          {result && (
            <>
              <div className="flex flex-wrap gap-3">
                {[
                  { label: t('advisor.simulation.kpiCurrent'), value: `${result.currentAvgFoodCost}%`, bg: 'var(--bg-tertiary)', color: 'var(--text-primary)' },
                  { label: t('advisor.simulation.kpiTarget'), value: `${result.targetFoodCost}%`, bg: 'rgba(16,185,129,0.1)', color: 'var(--green)' },
                  { label: t('advisor.simulation.kpiNonCompliant'), value: String(result.recipes.length), bg: 'rgba(249,115,22,0.1)', color: '#f97316' },
                ].map(({ label, value, bg, color }) => (
                  <div key={label} className="flex-1 min-w-32 rounded-lg px-4 py-3" style={{ background: bg }}>
                    <p className="text-xs" style={{ color }}>{label}</p>
                    <p className="mt-0.5 text-xl font-semibold" style={{ color }}>{value}</p>
                  </div>
                ))}
              </div>
              {result.recipes.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{t('advisor.simulation.offTarget')}</p>
                  <div className="overflow-x-auto rounded-lg" style={{ border: '1px solid var(--bg-border)' }}>
                    <table className="w-full text-xs">
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--bg-border)', background: 'var(--bg-tertiary)' }}>
                          {[t('advisor.simulation.colRecipe'), t('advisor.simulation.colCurrentFC'), t('advisor.simulation.colCurrentPrice'), t('advisor.simulation.colTargetPrice'), t('advisor.simulation.colDelta'), t('advisor.simulation.colKeyIngredient')].map((h, i) => (
                            <th key={i} className="px-3 py-2 text-left font-medium" style={{ color: 'var(--text-secondary)' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {result.recipes.map((r) => (
                          <tr key={r.name} style={{ borderBottom: '1px solid var(--bg-border)' }}>
                            <td className="px-3 py-2 font-medium" style={{ color: 'var(--text-primary)' }}>{r.name}</td>
                            <td className="px-3 py-2 text-right font-medium" style={{ color: '#f97316' }}>{r.currentFoodCost}%</td>
                            <td className="px-3 py-2 text-right" style={{ color: 'var(--text-secondary)' }}>{r.currentSellingPrice}€</td>
                            <td className="px-3 py-2 text-right font-medium" style={{ color: 'var(--green)' }}>{r.requiredSellingPrice != null ? `${r.requiredSellingPrice}€` : '—'}</td>
                            <td className="px-3 py-2 text-right">
                              {r.priceDelta != null ? (
                                <span style={{ color: r.priceDelta > 0 ? '#60a5fa' : 'var(--text-secondary)' }}>
                                  {r.priceDelta > 0 ? '+' : ''}{r.priceDelta}€
                                </span>
                              ) : '—'}
                            </td>
                            <td className="px-3 py-2" style={{ color: 'var(--text-tertiary)' }}>
                              {r.mostImpactfulIngredient ? `${r.mostImpactfulIngredient.name} (${r.mostImpactfulIngredient.lineCost.toFixed(2)}€)` : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              <div className="rounded-lg px-4 py-4" style={{ background: 'var(--accent-bg)', border: '1px solid var(--accent)33' }}>
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold" style={{ color: 'var(--accent)' }}>
                  {t('advisor.simulation.aiReco')}
                </p>
                <div className="space-y-0.5">{renderMarkdown(result.suggestions)}</div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export function AdvisorPage() {
  const { t } = useTranslation();
  const [report, setReport] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState('');
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, chatLoading]);

  async function handleDownloadPdf() {
    setPdfLoading(true);
    setPdfError('');
    try {
      const res = await api.get('/advisor/report/pdf', { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      const disposition: string = res.headers['content-disposition'] ?? '';
      const match = disposition.match(/filename="([^"]+)"/);
      a.href = url;
      a.download = match ? match[1] : 'rapport-chef-ia.pdf';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setPdfError(t('advisor.pdfError'));
    } finally {
      setPdfLoading(false);
    }
  }

  async function handleGenerateReport() {
    setReportLoading(true);
    setReportError('');
    try {
      const res = await api.post<{ report: string; generatedAt: string }>('/advisor/report');
      setReport(res.data.report);
      setGeneratedAt(res.data.generatedAt);
    } catch (err: any) {
      setReportError(err.response?.data?.message ?? t('advisor.report.error'));
    } finally {
      setReportLoading(false);
    }
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || chatLoading) return;
    const userMessage: ChatMessage = { role: 'user', content: text };
    setMessages((m) => [...m, userMessage]);
    setInput('');
    setChatLoading(true);
    setChatError('');
    const history = messages;
    try {
      const res = await api.post<{ reply: string }>('/advisor/chat', { message: text, history });
      setMessages((m) => [...m, { role: 'assistant', content: res.data.reply }]);
    } catch (err: any) {
      setChatError(err.response?.data?.message ?? t('advisor.chat.error'));
      setMessages((m) => m.slice(0, -1));
      setInput(text);
    } finally {
      setChatLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  const chatSuggestions = [t('advisor.chat.suggestion1'), t('advisor.chat.suggestion2'), t('advisor.chat.suggestion3')];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{t('advisor.title')}</h1>
          <p className="mt-0.5 text-sm" style={{ color: 'var(--text-secondary)' }}>{t('advisor.subtitle')}</p>
        </div>
        <div className="flex flex-col items-start sm:items-end gap-1">
          <button
            onClick={handleDownloadPdf}
            disabled={pdfLoading}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-60"
            style={{ border: '1px solid var(--bg-border)', color: 'var(--text-secondary)', background: 'transparent' }}
          >
            {pdfLoading ? (
              <><span className="h-4 w-4 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: 'var(--text-tertiary)', borderTopColor: 'transparent' }} />{t('advisor.generatingPdf')}</>
            ) : `📄 ${t('advisor.downloadPdf')}`}
          </button>
          {pdfError && <p className="text-xs" style={{ color: 'var(--red)' }}>{pdfError}</p>}
        </div>
      </div>

      <ReportSection report={report} generatedAt={generatedAt} loading={reportLoading} error={reportError} onGenerate={handleGenerateReport} />
      <SimulationSection />

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full" style={{ borderTop: '1px solid var(--bg-border)' }} />
        </div>
        <div className="relative flex justify-center">
          <span className="px-3 text-xs font-medium" style={{ background: 'var(--bg-primary)', color: 'var(--text-tertiary)' }}>
            {t('advisor.chat.divider')}
          </span>
        </div>
      </div>

      {/* Chat */}
      <div className="flex flex-col rounded-xl" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--bg-border)' }}>
        <div className="flex min-h-64 flex-col gap-4 overflow-y-auto p-5" style={{ maxHeight: 480 }}>
          {messages.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 py-8 text-center">
              <span className="text-4xl">🤖</span>
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{t('advisor.chat.emptyTitle')}</p>
              <div className="flex flex-wrap justify-center gap-2">
                {chatSuggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => { setInput(suggestion); inputRef.current?.focus(); }}
                    className="rounded-full px-3 py-1.5 text-xs transition-colors"
                    style={{ border: '1px solid var(--bg-border)', color: 'var(--text-secondary)', background: 'var(--bg-tertiary)' }}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg, i) => <ChatBubble key={i} message={msg} />)}
              {chatLoading && <TypingIndicator />}
              {chatError && (
                <div className="rounded-lg px-4 py-2.5 text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--red)' }}>{chatError}</div>
              )}
              <div ref={chatEndRef} />
            </>
          )}
        </div>
        <div className="p-4" style={{ borderTop: '1px solid var(--bg-border)' }}>
          <div className="flex items-end gap-3">
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
              }}
              onKeyDown={handleKeyDown}
              placeholder={t('advisor.chat.placeholder')}
              disabled={chatLoading}
              className="flex-1 resize-none rounded-xl px-4 py-2.5 text-sm outline-none disabled:opacity-60"
              style={{
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--bg-border)',
                color: 'var(--text-primary)',
                minHeight: '42px',
              }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || chatLoading}
              className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl disabled:cursor-not-allowed disabled:opacity-50"
              style={{ background: 'var(--accent)' }}
            >
              {chatLoading ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent" />
              ) : (
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 rotate-90 text-black">
                  <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                </svg>
              )}
            </button>
          </div>
          <p className="mt-1.5 text-xs" style={{ color: 'var(--text-tertiary)' }}>{t('advisor.chat.disclaimer')}</p>
        </div>
      </div>
    </div>
  );
}
