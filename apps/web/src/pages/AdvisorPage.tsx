import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';

// ── Types ──────────────────────────────────────────────────────────────────

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// ── Markdown-lite renderer ─────────────────────────────────────────────────
// Handles: **bold**, #/##/### headings, ---, line breaks, lists, emoji headings

function renderMarkdown(text: string): React.ReactNode[] {
  return text.split('\n').map((line, i) => {
    // Split on **bold** spans
    const parts = line.split(/(\*\*[^*]+\*\*)/g).map((part, j) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={j}>{part.slice(2, -2)}</strong>;
      }
      return <span key={j}>{part}</span>;
    });

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      return <hr key={i} className="my-3 border-stone-200" />;
    }

    // Empty line → spacer
    if (line.trim() === '') {
      return <div key={i} className="h-2" />;
    }

    // ### h3
    if (line.startsWith('### ')) {
      const inner = line.slice(4).split(/(\*\*[^*]+\*\*)/g).map((p, j) =>
        p.startsWith('**') && p.endsWith('**')
          ? <strong key={j}>{p.slice(2, -2)}</strong>
          : <span key={j}>{p}</span>
      );
      return <h3 key={i} className="mt-4 text-sm font-semibold text-stone-800 first:mt-0">{inner}</h3>;
    }

    // ## h2
    if (line.startsWith('## ')) {
      const inner = line.slice(3).split(/(\*\*[^*]+\*\*)/g).map((p, j) =>
        p.startsWith('**') && p.endsWith('**')
          ? <strong key={j}>{p.slice(2, -2)}</strong>
          : <span key={j}>{p}</span>
      );
      return <h2 key={i} className="mt-5 text-base font-semibold text-stone-900 first:mt-0">{inner}</h2>;
    }

    // # h1
    if (line.startsWith('# ')) {
      const inner = line.slice(2).split(/(\*\*[^*]+\*\*)/g).map((p, j) =>
        p.startsWith('**') && p.endsWith('**')
          ? <strong key={j}>{p.slice(2, -2)}</strong>
          : <span key={j}>{p}</span>
      );
      return <h1 key={i} className="mt-6 text-lg font-bold text-stone-900 first:mt-0">{inner}</h1>;
    }

    // Numbered list
    if (/^\d+[\.\)]\s/.test(line.trim())) {
      return (
        <p key={i} className="mt-1 pl-4 text-sm leading-relaxed text-stone-700">
          {parts}
        </p>
      );
    }

    // Bullet list
    if (/^[-•]\s/.test(line.trim())) {
      return (
        <p key={i} className="mt-0.5 pl-4 text-sm leading-relaxed text-stone-600">
          {parts}
        </p>
      );
    }

    // Emoji heading (line starting with emoji)
    if (/^\p{Emoji}/u.test(line.trim())) {
      return (
        <p key={i} className="mt-4 text-sm font-semibold leading-relaxed text-stone-800 first:mt-0">
          {parts}
        </p>
      );
    }

    // Regular paragraph
    return (
      <p key={i} className="text-sm leading-relaxed text-stone-700">
        {parts}
      </p>
    );
  });
}

// ── Chat bubble ────────────────────────────────────────────────────────────

function ChatBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm ${
          isUser ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-100 text-stone-600'
        }`}
      >
        {isUser ? '👤' : '🤖'}
      </div>

      {/* Bubble */}
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
          isUser
            ? 'rounded-tr-sm bg-emerald-600 text-sm text-white'
            : 'rounded-tl-sm border border-stone-200 bg-white shadow-sm'
        }`}
      >
        {isUser ? (
          <p className="text-sm leading-relaxed">{message.content}</p>
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
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-stone-100 text-sm">
        🤖
      </div>
      <div className="rounded-2xl rounded-tl-sm border border-stone-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-2 w-2 animate-bounce rounded-full bg-stone-400"
              style={{ animationDelay: `${i * 150}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Report section ─────────────────────────────────────────────────────────

function ReportSection({
  report,
  generatedAt,
  loading,
  error,
  onGenerate,
}: {
  report: string | null;
  generatedAt: string | null;
  loading: boolean;
  error: string;
  onGenerate: () => void;
}) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-stone-900">Rapport de rentabilité</h2>
          {generatedAt && (
            <p className="mt-0.5 text-xs text-stone-400">
              Généré le{' '}
              {new Date(generatedAt).toLocaleString('fr-FR', {
                day: '2-digit', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit',
              })}
            </p>
          )}
        </div>
        <button
          onClick={onGenerate}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
        >
          {loading ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Génération…
            </>
          ) : (
            <>
              ✨ {report ? 'Regénérer' : 'Générer le rapport'}
            </>
          )}
        </button>
      </div>

      {/* Content */}
      <div className="px-5 py-4">
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading && !report ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <span className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
            <p className="text-sm text-stone-500">
              L'IA analyse vos données…<br />
              <span className="text-xs text-stone-400">Cela prend environ 10 secondes</span>
            </p>
          </div>
        ) : report ? (
          <div className="space-y-0.5">{renderMarkdown(report)}</div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <span className="text-4xl">📊</span>
            <p className="text-sm font-medium text-stone-700">
              Obtenez votre analyse personnalisée
            </p>
            <p className="max-w-sm text-xs text-stone-400">
              L'IA analyse vos recettes, ingrédients et food costs pour générer
              des recommandations actionnables adaptées à votre restaurant.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Simulation section ─────────────────────────────────────────────────────

interface SimRecipe {
  name: string;
  category: string | null;
  currentFoodCost: number;
  currentSellingPrice: number;
  totalIngredientCost: number;
  requiredSellingPrice: number | null;
  priceDelta: number | null;
  mostImpactfulIngredient: { name: string; lineCost: number; quantity: number; unit: string } | null;
}

interface SimulationResult {
  currentAvgFoodCost: number;
  targetFoodCost: number;
  suggestions: string;
  recipes: SimRecipe[];
}

function SimulationSection() {
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
      setError(err.response?.data?.message ?? 'Impossible de lancer la simulation.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-stone-200 bg-white shadow-sm">
      {/* Header */}
      <div className="border-b border-stone-100 px-5 py-4">
        <h2 className="text-sm font-semibold text-stone-900">Simulation de menu</h2>
        <p className="mt-0.5 text-xs text-stone-500">
          Identifiez les recettes hors cible et obtenez des ajustements concrets pour atteindre votre food cost idéal.
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-end gap-4 px-5 py-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-stone-600">Food cost cible</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={100}
              value={target}
              onChange={(e) => setTarget(Math.max(1, Math.min(100, Number(e.target.value))))}
              className="w-20 rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
            <span className="text-sm text-stone-500">%</span>
          </div>
        </div>

        <button
          onClick={handleSimulate}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
        >
          {loading ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Simulation…
            </>
          ) : (
            '🎯 Simuler'
          )}
        </button>
      </div>

      {/* Results */}
      {(error || result) && (
        <div className="border-t border-stone-100 px-5 py-4 space-y-5">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {result && (
            <>
              {/* KPIs */}
              <div className="flex flex-wrap gap-3">
                <div className="flex-1 min-w-32 rounded-lg bg-stone-50 px-4 py-3">
                  <p className="text-xs text-stone-500">Food cost moyen actuel</p>
                  <p className="mt-0.5 text-xl font-semibold text-stone-900">{result.currentAvgFoodCost}%</p>
                </div>
                <div className="flex-1 min-w-32 rounded-lg bg-emerald-50 px-4 py-3">
                  <p className="text-xs text-emerald-700">Objectif cible</p>
                  <p className="mt-0.5 text-xl font-semibold text-emerald-700">{result.targetFoodCost}%</p>
                </div>
                <div className="flex-1 min-w-32 rounded-lg bg-orange-50 px-4 py-3">
                  <p className="text-xs text-orange-700">Recettes non conformes</p>
                  <p className="mt-0.5 text-xl font-semibold text-orange-700">{result.recipes.length}</p>
                </div>
              </div>

              {/* Non-compliant recipes table */}
              {result.recipes.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-medium text-stone-600">Recettes hors cible</p>
                  <div className="overflow-x-auto rounded-lg border border-stone-200">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-stone-200 bg-stone-50">
                          <th className="px-3 py-2 text-left font-medium text-stone-600">Recette</th>
                          <th className="px-3 py-2 text-right font-medium text-stone-600">FC actuel</th>
                          <th className="px-3 py-2 text-right font-medium text-stone-600">Prix actuel</th>
                          <th className="px-3 py-2 text-right font-medium text-stone-600">Prix cible</th>
                          <th className="px-3 py-2 text-right font-medium text-stone-600">Δ prix</th>
                          <th className="px-3 py-2 text-left font-medium text-stone-600">Ingrédient clé</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.recipes.map((r) => (
                          <tr key={r.name} className="border-b border-stone-100 last:border-0 hover:bg-stone-50">
                            <td className="px-3 py-2 font-medium text-stone-800">{r.name}</td>
                            <td className="px-3 py-2 text-right text-orange-600 font-medium">{r.currentFoodCost}%</td>
                            <td className="px-3 py-2 text-right text-stone-600">{r.currentSellingPrice}€</td>
                            <td className="px-3 py-2 text-right text-emerald-700 font-medium">
                              {r.requiredSellingPrice != null ? `${r.requiredSellingPrice}€` : '—'}
                            </td>
                            <td className="px-3 py-2 text-right">
                              {r.priceDelta != null ? (
                                <span className={r.priceDelta > 0 ? 'text-blue-600' : 'text-stone-500'}>
                                  {r.priceDelta > 0 ? '+' : ''}{r.priceDelta}€
                                </span>
                              ) : '—'}
                            </td>
                            <td className="px-3 py-2 text-stone-500">
                              {r.mostImpactfulIngredient
                                ? `${r.mostImpactfulIngredient.name} (${r.mostImpactfulIngredient.lineCost.toFixed(2)}€)`
                                : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* AI suggestions */}
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-4">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-emerald-800">
                  ✨ Recommandations IA
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
  // Report state
  const [report, setReport] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState('');

  // PDF download state
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState('');

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState('');

  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, chatLoading]);

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
    } catch (err: any) {
      setPdfError('Impossible de générer le rapport PDF.');
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
      console.error('[AdvisorPage] report', err);
      setReportError(err.response?.data?.message ?? 'Impossible de générer le rapport.');
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

    // Build history excluding the message just added (will be sent as `message`)
    const history = messages;

    try {
      const res = await api.post<{ reply: string }>('/advisor/chat', {
        message: text,
        history,
      });
      setMessages((m) => [...m, { role: 'assistant', content: res.data.reply }]);
    } catch (err: any) {
      console.error('[AdvisorPage] chat', err);
      setChatError(err.response?.data?.message ?? 'Erreur lors de la réponse IA.');
      // Remove the user message that failed
      setMessages((m) => m.slice(0, -1));
      setInput(text);
    } finally {
      setChatLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-stone-900">Conseiller IA</h1>
          <p className="mt-0.5 text-sm text-stone-500">
            Analyse intelligente de votre rentabilité et recommandations personnalisées
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <button
            onClick={handleDownloadPdf}
            disabled={pdfLoading}
            className="flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 shadow-sm transition-colors hover:border-emerald-400 hover:text-emerald-700 disabled:opacity-60"
          >
            {pdfLoading ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-stone-400 border-t-transparent" />
                Génération PDF…
              </>
            ) : (
              '📄 Télécharger le rapport mensuel PDF'
            )}
          </button>
          {pdfError && <p className="text-xs text-red-600">{pdfError}</p>}
        </div>
      </div>

      {/* Report */}
      <ReportSection
        report={report}
        generatedAt={generatedAt}
        loading={reportLoading}
        error={reportError}
        onGenerate={handleGenerateReport}
      />

      {/* Simulation */}
      <SimulationSection />

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-stone-200" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-stone-50 px-3 text-xs font-medium text-stone-400">
            Chat avec le conseiller
          </span>
        </div>
      </div>

      {/* Chat */}
      <div className="flex flex-col rounded-xl border border-stone-200 bg-white shadow-sm">

        {/* Messages area */}
        <div className="flex min-h-64 flex-col gap-4 overflow-y-auto p-5" style={{ maxHeight: 480 }}>
          {messages.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 py-8 text-center">
              <span className="text-4xl">🤖</span>
              <p className="text-sm font-medium text-stone-700">
                Posez une question à votre conseiller IA
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {[
                  'Quelle est ma recette la moins rentable ?',
                  'Comment réduire mon food cost ?',
                  'Quels ingrédients ont augmenté récemment ?',
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => { setInput(suggestion); inputRef.current?.focus(); }}
                    className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs text-stone-600 transition-colors hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg, i) => (
                <ChatBubble key={i} message={msg} />
              ))}
              {chatLoading && <TypingIndicator />}
              {chatError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
                  {chatError}
                </div>
              )}
              <div ref={chatEndRef} />
            </>
          )}
        </div>

        {/* Input bar */}
        <div className="border-t border-stone-100 p-4">
          <div className="flex items-end gap-3">
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                // Auto-grow up to 5 rows
                e.target.style.height = 'auto';
                e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
              }}
              onKeyDown={handleKeyDown}
              placeholder="Posez une question… (Entrée pour envoyer, Maj+Entrée pour un retour à la ligne)"
              disabled={chatLoading}
              className="flex-1 resize-none rounded-xl border border-stone-300 px-4 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-60"
              style={{ minHeight: '42px' }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || chatLoading}
              className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {chatLoading ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 rotate-90">
                  <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                </svg>
              )}
            </button>
          </div>
          <p className="mt-1.5 text-xs text-stone-400">
            Le conseiller a accès à toutes vos données en temps réel.
          </p>
        </div>
      </div>
    </div>
  );
}
