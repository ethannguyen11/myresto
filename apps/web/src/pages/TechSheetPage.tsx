import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';

interface GeneratedIngredient {
  name: string;
  quantity: string;
  unit: string;
}

interface GeneratedSheet {
  name: string;
  category: string;
  servings: number;
  prepTime: number;
  cookTime: number;
  difficulty: string;
  ingredients: GeneratedIngredient[];
  steps: string[];
  presentation: string;
  tips: string;
}

interface TechSheet {
  id: number;
  name: string;
  category: string | null;
  servings: number;
  prepTime: number | null;
  cookTime: number | null;
  difficulty: string | null;
  ingredients: string;
  steps: string;
  presentation: string | null;
  tips: string | null;
  createdAt: string;
}

function parseIngredients(s: TechSheet): GeneratedIngredient[] {
  try { return JSON.parse(s.ingredients || '[]'); } catch { return []; }
}

function parseSteps(s: TechSheet): string[] {
  try { return JSON.parse(s.steps || '[]'); } catch { return []; }
}

function getDiffBadge(d: string | null, t: (k: string) => string) {
  const label = d ? (t(`techSheets.difficulty.${d}`) || d) : null;
  if (!label) return null;
  const isEasy = d === 'Facile' || d === 'facile';
  const isMed = d === 'Moyen' || d === 'moyen';
  const color = isEasy ? 'var(--green)' : isMed ? 'var(--amber)' : 'var(--red)';
  const bg = isEasy ? 'rgba(16,185,129,0.12)' : isMed ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.12)';
  return (
    <span className="rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ background: bg, color }}>{label}</span>
  );
}

function SheetPreview({ sheet, compact = false }: { sheet: GeneratedSheet; compact?: boolean }) {
  const { t } = useTranslation();

  return (
    <div className="space-y-5 text-sm" style={{ color: 'var(--text-secondary)' }}>
      <div>
        <h2 className={`${compact ? 'text-xl' : 'text-2xl'} font-bold`} style={{ color: 'var(--text-primary)' }}>{sheet.name}</h2>
        {sheet.category && (
          <span className="mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
            {sheet.category}
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {sheet.servings > 0 && (
          <span className="rounded-full px-3 py-1 text-xs font-medium" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
            {sheet.servings} couvert{sheet.servings > 1 ? 's' : ''}
          </span>
        )}
        {sheet.prepTime > 0 && (
          <span className="rounded-full px-3 py-1 text-xs font-medium" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
            Prép. {sheet.prepTime} min
          </span>
        )}
        {sheet.cookTime > 0 && (
          <span className="rounded-full px-3 py-1 text-xs font-medium" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
            Cuisson {sheet.cookTime} min
          </span>
        )}
        {sheet.difficulty && getDiffBadge(sheet.difficulty, t)}
      </div>

      {sheet.ingredients.length > 0 && (
        <div>
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide pb-1" style={{ color: 'var(--text-tertiary)', borderBottom: '1px solid var(--bg-border)' }}>
            {t('techSheets.step2.ingredients')}
          </h3>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left font-medium" style={{ color: 'var(--text-tertiary)' }}>
                <th className="pb-1.5 pr-4">{t('techSheets.detail.name')}</th>
                <th className="pb-1.5 pr-4">{t('techSheets.detail.quantity')}</th>
                <th className="pb-1.5">{t('techSheets.detail.unit')}</th>
              </tr>
            </thead>
            <tbody>
              {sheet.ingredients.map((ing, i) => (
                <tr key={i} style={{ borderTop: i > 0 ? '1px solid var(--bg-border)' : undefined }}>
                  <td className="py-1.5 pr-4 font-medium" style={{ color: 'var(--text-primary)' }}>{ing.name}</td>
                  <td className="py-1.5 pr-4" style={{ color: 'var(--text-secondary)' }}>{ing.quantity}</td>
                  <td className="py-1.5" style={{ color: 'var(--text-tertiary)' }}>{ing.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {sheet.steps.length > 0 && (
        <div>
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide pb-1" style={{ color: 'var(--text-tertiary)', borderBottom: '1px solid var(--bg-border)' }}>
            {t('techSheets.step2.steps')}
          </h3>
          <ol className="space-y-3">
            {sheet.steps.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold" style={{ background: 'var(--accent)', color: '#000' }}>
                  {i + 1}
                </span>
                <p className="pt-0.5 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{step}</p>
              </li>
            ))}
          </ol>
        </div>
      )}

      {sheet.presentation && (
        <div>
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide pb-1" style={{ color: 'var(--text-tertiary)', borderBottom: '1px solid var(--bg-border)' }}>
            {t('techSheets.step2.presentation')}
          </h3>
          <p className="rounded-xl px-4 py-3 leading-relaxed" style={{ borderLeft: '2px solid var(--accent)', background: 'var(--accent-bg)', color: 'var(--text-secondary)' }}>
            {sheet.presentation}
          </p>
        </div>
      )}

      {sheet.tips && (
        <div>
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide pb-1" style={{ color: 'var(--text-tertiary)', borderBottom: '1px solid var(--bg-border)' }}>
            {t('techSheets.step2.tips')}
          </h3>
          <p className="rounded-xl px-4 py-3 leading-relaxed" style={{ borderLeft: '2px solid var(--amber)', background: 'rgba(245,158,11,0.08)', color: 'var(--text-secondary)' }}>
            {sheet.tips}
          </p>
        </div>
      )}
    </div>
  );
}

function DetailModal({ sheet, apiBase, onClose }: { sheet: TechSheet; apiBase: string; onClose: () => void }) {
  const { t } = useTranslation();
  const backdropRef = useRef<HTMLDivElement>(null);
  const ingredients = parseIngredients(sheet);
  const steps = parseSteps(sheet);

  const generated: GeneratedSheet = {
    name: sheet.name,
    category: sheet.category ?? '',
    servings: sheet.servings,
    prepTime: sheet.prepTime ?? 0,
    cookTime: sheet.cookTime ?? 0,
    difficulty: sheet.difficulty ?? '',
    ingredients,
    steps,
    presentation: sheet.presentation ?? '',
    tips: sheet.tips ?? '',
  };

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 pt-12"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onMouseDown={(e) => { if (e.target === backdropRef.current) onClose(); }}
    >
      <div className="w-full sm:max-w-2xl rounded-2xl" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--bg-border)' }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--bg-border)' }}>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{sheet.name}</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.open(`${apiBase}/tech-sheets/${sheet.id}/pdf`, '_blank')}
              className="rounded-lg px-3 py-1.5 text-xs font-medium"
              style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--bg-border)' }}
            >
              {t('techSheets.print')}
            </button>
            <button
              onClick={onClose}
              className="rounded-md p-1 text-sm"
              style={{ color: 'var(--text-tertiary)' }}
            >
              ✕
            </button>
          </div>
        </div>
        <div className="max-h-[75vh] overflow-y-auto px-6 py-5">
          <SheetPreview sheet={generated} />
        </div>
      </div>
    </div>
  );
}

function DeleteModal({ sheet, onConfirm, onCancel }: { sheet: TechSheet; onConfirm: () => Promise<void>; onCancel: () => void }) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const backdropRef = useRef<HTMLDivElement>(null);
  async function go() {
    setLoading(true);
    try { await onConfirm(); } finally { setLoading(false); }
  }
  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onMouseDown={(e) => { if (e.target === backdropRef.current) onCancel(); }}
    >
      <div className="w-full max-w-md rounded-2xl p-6" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--bg-border)' }}>
        <h2 className="mb-2 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('common.confirmDelete')}</h2>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('techSheets.delete.message', { name: sheet.name })}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-lg px-4 py-2 text-sm"
            style={{ border: '1px solid var(--bg-border)', color: 'var(--text-secondary)', background: 'transparent' }}
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={go}
            disabled={loading}
            className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60"
            style={{ background: 'var(--red)', color: '#fff' }}
          >
            {loading ? t('common.deleting') : t('common.deleteForever')}
          </button>
        </div>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="h-5 w-5 animate-spin" style={{ color: '#000' }} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

type View = 'list' | 'step1' | 'step2' | 'step3';
type ActiveModal = { type: 'detail'; sheet: TechSheet } | { type: 'delete'; sheet: TechSheet };

export function TechSheetPage() {
  const { t } = useTranslation();
  const apiBase = (import.meta.env.VITE_API_URL ?? '') + '/api';

  const [view, setView] = useState<View>('list');
  const [sheets, setSheets] = useState<TechSheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [modal, setModal] = useState<ActiveModal | null>(null);

  const [description, setDescription] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState('');
  const [generatedSheet, setGeneratedSheet] = useState<GeneratedSheet | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [savedSheet, setSavedSheet] = useState<TechSheet | null>(null);

  async function loadSheets() {
    try {
      const res = await api.get<TechSheet[]>('/tech-sheets');
      setSheets(res.data);
    } catch (err: any) {
      setLoadError(err.response?.data?.message ?? t('techSheets.loadError'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadSheets(); }, []);

  async function handleGenerate() {
    if (!description.trim()) return;
    setGenerateError('');
    setGenerating(true);
    try {
      const res = await api.post<GeneratedSheet>('/tech-sheets/generate', { description });
      setGeneratedSheet(res.data);
      setView('step2');
    } catch {
      setGenerateError(t('techSheets.generateError'));
    } finally {
      setGenerating(false);
    }
  }

  async function handleValidate() {
    if (!generatedSheet) return;
    setSaveError('');
    setSaving(true);
    try {
      const res = await api.post<TechSheet>('/tech-sheets/validate', generatedSheet);
      setSavedSheet(res.data);
      setView('step3');
      await loadSheets();
    } catch {
      setSaveError(t('techSheets.saveError'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (modal?.type !== 'delete') return;
    await api.delete(`/tech-sheets/${modal.sheet.id}`);
    setModal(null);
    await loadSheets();
  }

  function resetWizard() {
    setDescription('');
    setGeneratedSheet(null);
    setGenerateError('');
    setSaveError('');
    setSavedSheet(null);
    setView('step1');
  }

  return (
    <div className="space-y-6">

      {/* LIST VIEW */}
      {view === 'list' && (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                {t('techSheets.title')}
              </h1>
              <p className="mt-0.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
                {t(sheets.length === 1 ? 'techSheets.subtitle_one' : 'techSheets.subtitle_other', { count: sheets.length })}
              </p>
            </div>
            <button
              onClick={resetWizard}
              className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium"
              style={{ background: 'var(--accent)', color: '#000' }}
            >
              <span>✨</span> {t('techSheets.newSheet')}
            </button>
          </div>

          {loading && <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('common.loading')}</p>}
          {loadError && (
            <div className="rounded-xl px-4 py-3 text-sm" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--red)' }}>
              {loadError}
            </div>
          )}

          {!loading && !loadError && sheets.length === 0 && (
            <div
              className="flex flex-col items-center justify-center rounded-2xl py-20 text-center"
              style={{ border: '2px dashed var(--bg-border)', background: 'var(--bg-secondary)' }}
            >
              <p className="text-5xl">📋</p>
              <p className="mt-4 font-semibold" style={{ color: 'var(--text-primary)' }}>{t('techSheets.empty.title')}</p>
              <p className="mt-1 text-sm" style={{ color: 'var(--text-tertiary)' }}>{t('techSheets.empty.desc')}</p>
              <button
                onClick={resetWizard}
                className="mt-5 flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium"
                style={{ background: 'var(--accent)', color: '#000' }}
              >
                ✨ {t('techSheets.newSheet')}
              </button>
            </div>
          )}

          {!loading && sheets.length > 0 && (
            <div className="rounded-2xl" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--bg-border)' }}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--bg-border)', background: 'var(--bg-tertiary)' }}>
                      {[t('techSheets.table.name'), t('techSheets.table.category'), t('techSheets.table.servings'), t('techSheets.table.difficulty'), t('techSheets.table.date'), t('techSheets.table.actions')].map((h) => (
                        <th key={h} className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-left" style={{ color: 'var(--text-tertiary)' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sheets.map((s, idx) => {
                      const ings = parseIngredients(s).length;
                      const stps = parseSteps(s).filter((x) => x.trim()).length;
                      return (
                        <tr
                          key={s.id}
                          style={{ borderTop: idx > 0 ? '1px solid var(--bg-border)' : undefined }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        >
                          <td className="px-5 py-3">
                            <button
                              onClick={() => setModal({ type: 'detail', sheet: s })}
                              className="font-medium text-left hover:underline"
                              style={{ color: 'var(--text-primary)' }}
                              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent)')}
                              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
                            >
                              {s.name}
                            </button>
                            <div className="mt-0.5 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                              {ings > 0 && `${ings} ing.`}
                              {ings > 0 && stps > 0 && ' · '}
                              {stps > 0 && `${stps} étape${stps > 1 ? 's' : ''}`}
                            </div>
                          </td>
                          <td className="px-5 py-3">
                            {s.category
                              ? <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>{s.category}</span>
                              : <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
                          </td>
                          <td className="px-5 py-3" style={{ color: 'var(--text-secondary)' }}>{s.servings}</td>
                          <td className="px-5 py-3">
                            {s.difficulty ? getDiffBadge(s.difficulty, t) : <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
                          </td>
                          <td className="px-5 py-3 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                            {new Date(s.createdAt).toLocaleDateString('fr-FR')}
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex gap-1">
                              <button
                                onClick={() => setModal({ type: 'detail', sheet: s })}
                                className="rounded-md px-2.5 py-1.5 text-xs font-medium"
                                style={{ color: 'var(--text-secondary)', background: 'transparent' }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
                                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                              >
                                Voir
                              </button>
                              <button
                                onClick={() => window.open(`${apiBase}/tech-sheets/${s.id}/pdf`, '_blank')}
                                className="rounded-md px-2.5 py-1.5 text-xs font-medium"
                                style={{ color: 'var(--text-secondary)', background: 'transparent' }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
                                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                              >
                                🖨️
                              </button>
                              <button
                                onClick={() => setModal({ type: 'delete', sheet: s })}
                                className="rounded-md px-2.5 py-1.5 text-xs font-medium"
                                style={{ color: 'var(--red)', background: 'transparent' }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(239,68,68,0.1)')}
                                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                              >
                                {t('common.delete')}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* STEP 1 — Description */}
      {view === 'step1' && (
        <div className="mx-auto max-w-2xl space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                {t('techSheets.step1.title')}
              </h1>
              <p className="mt-0.5 text-sm" style={{ color: 'var(--text-secondary)' }}>{t('techSheets.step1.subtitle')}</p>
            </div>
            <button onClick={() => setView('list')} className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
              {t('techSheets.backToList')}
            </button>
          </div>

          <WizardSteps current={1} />

          <div className="rounded-2xl p-6" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--bg-border)' }}>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={10}
              placeholder={t('techSheets.step1.placeholder')}
              className="w-full resize-none rounded-xl p-4 text-sm focus:outline-none focus:ring-2"
              style={{
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--bg-border)',
                color: 'var(--text-primary)',
                outlineColor: 'var(--accent)',
              }}
            />

            {generateError && (
              <p className="mt-2 text-sm" style={{ color: 'var(--red)' }}>{generateError}</p>
            )}

            <div className="mt-4 flex justify-end">
              <button
                onClick={handleGenerate}
                disabled={generating || !description.trim()}
                className="flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-medium disabled:opacity-60"
                style={{ background: 'var(--accent)', color: '#000' }}
              >
                {generating ? (
                  <><Spinner /> {t('techSheets.step1.generating')}</>
                ) : (
                  t('techSheets.step1.generate')
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2 — Preview */}
      {view === 'step2' && generatedSheet && (
        <div className="mx-auto max-w-2xl space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                {t('techSheets.step2.title')}
              </h1>
              <p className="mt-0.5 text-sm" style={{ color: 'var(--text-secondary)' }}>{t('techSheets.step2.subtitle')}</p>
            </div>
            <button onClick={() => setView('list')} className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
              {t('techSheets.backToList')}
            </button>
          </div>

          <WizardSteps current={2} />

          <div className="rounded-2xl p-6" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--bg-border)' }}>
            <SheetPreview sheet={generatedSheet} />
          </div>

          {saveError && (
            <p className="text-sm" style={{ color: 'var(--red)' }}>{saveError}</p>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setView('step1')}
              className="flex-1 rounded-xl px-4 py-3 text-sm font-medium"
              style={{ border: '1px solid var(--bg-border)', color: 'var(--text-secondary)', background: 'transparent' }}
            >
              {t('techSheets.step2.edit')}
            </button>
            <button
              onClick={handleValidate}
              disabled={saving}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium disabled:opacity-60"
              style={{ background: 'var(--accent)', color: '#000' }}
            >
              {saving ? (
                <><Spinner /> {t('techSheets.step2.saving')}</>
              ) : (
                t('techSheets.step2.validate')
              )}
            </button>
          </div>
        </div>
      )}

      {/* STEP 3 — Confirmation */}
      {view === 'step3' && (
        <div className="mx-auto max-w-2xl space-y-6">
          <WizardSteps current={3} />

          <div className="rounded-2xl p-8 text-center" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)' }}>
            <div className="text-5xl">✅</div>
            <h2 className="mt-4 text-xl font-bold" style={{ color: 'var(--green)' }}>{t('techSheets.step3.title')}</h2>
            <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{t('techSheets.step3.subtitle')}</p>
            <div className="mt-6 flex justify-center gap-3">
              {savedSheet && (
                <button
                  onClick={() => { setView('list'); setModal({ type: 'detail', sheet: savedSheet }); }}
                  className="rounded-xl px-5 py-2.5 text-sm font-medium"
                  style={{ border: '1px solid rgba(16,185,129,0.3)', background: 'var(--bg-secondary)', color: 'var(--green)' }}
                >
                  {t('techSheets.step3.viewSheet')}
                </button>
              )}
              <button
                onClick={resetWizard}
                className="rounded-xl px-5 py-2.5 text-sm font-medium"
                style={{ background: 'var(--accent)', color: '#000' }}
              >
                ✨ {t('techSheets.step3.newSheet')}
              </button>
            </div>
            <button
              onClick={() => setView('list')}
              className="mt-3 text-sm hover:underline"
              style={{ color: 'var(--green)' }}
            >
              {t('techSheets.backToList')}
            </button>
          </div>

          {savedSheet && generatedSheet && (
            <div className="rounded-2xl p-6" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--bg-border)' }}>
              <SheetPreview sheet={generatedSheet} compact />
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {modal?.type === 'detail' && (
        <DetailModal sheet={modal.sheet} apiBase={apiBase} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'delete' && (
        <DeleteModal sheet={modal.sheet} onConfirm={handleDelete} onCancel={() => setModal(null)} />
      )}
    </div>
  );
}

function WizardSteps({ current }: { current: 1 | 2 | 3 }) {
  const steps = [
    { n: 1, label: 'Description' },
    { n: 2, label: 'Prévisualisation' },
    { n: 3, label: 'Confirmation' },
  ];
  return (
    <div className="flex items-center gap-0">
      {steps.map((s, i) => (
        <div key={s.n} className="flex flex-1 items-center">
          <div className="flex items-center gap-2">
            <span
              className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold"
              style={{
                background: current === s.n ? 'var(--accent)' : current > s.n ? 'var(--accent-bg)' : 'var(--bg-tertiary)',
                color: current === s.n ? '#000' : current > s.n ? 'var(--accent)' : 'var(--text-tertiary)',
              }}
            >
              {current > s.n ? '✓' : s.n}
            </span>
            <span
              className="text-xs font-medium"
              style={{ color: current >= s.n ? 'var(--text-primary)' : 'var(--text-tertiary)' }}
            >
              {s.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div
              className="mx-3 flex-1 h-px"
              style={{ background: current > s.n ? 'var(--accent)' : 'var(--bg-border)' }}
            />
          )}
        </div>
      ))}
    </div>
  );
}
