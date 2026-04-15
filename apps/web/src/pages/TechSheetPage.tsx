import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';

// ── Types ──────────────────────────────────────────────────────────────────

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

// ── Helpers ────────────────────────────────────────────────────────────────

function parseIngredients(s: TechSheet): GeneratedIngredient[] {
  try { return JSON.parse(s.ingredients || '[]'); } catch { return []; }
}

function parseSteps(s: TechSheet): string[] {
  try { return JSON.parse(s.steps || '[]'); } catch { return []; }
}

function getDiffBadge(d: string | null, t: (k: string) => string) {
  const label = d ? (t(`techSheets.difficulty.${d}`) || d) : null;
  if (!label) return null;
  const cls = d === 'Facile' || d === 'facile'
    ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
    : d === 'Moyen' || d === 'moyen'
      ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
      : 'bg-red-50 text-red-700 ring-1 ring-red-200';
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>{label}</span>;
}

// ── Shared sheet preview ───────────────────────────────────────────────────

function SheetPreview({ sheet, compact = false }: { sheet: GeneratedSheet; compact?: boolean }) {
  const { t } = useTranslation();
  const headingCls = 'mb-2 text-[11px] font-semibold uppercase tracking-wide text-stone-400 border-b border-stone-100 pb-1';

  return (
    <div className="space-y-5 text-sm text-stone-700">
      {/* Header */}
      <div>
        <h2 className={`${compact ? 'text-xl' : 'text-2xl'} font-bold text-stone-900`}>{sheet.name}</h2>
        {sheet.category && (
          <span className="mt-1 inline-block rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-600">
            {sheet.category}
          </span>
        )}
      </div>

      {/* Meta chips */}
      <div className="flex flex-wrap gap-2">
        {sheet.servings > 0 && (
          <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-600">
            {sheet.servings} {sheet.servings > 1
              ? t('techSheets.step2.servings_plural').replace('{{n}}', String(sheet.servings)).replace('{{n}} ', '')
              : t('techSheets.step2.servings').replace('{{n}}', String(sheet.servings)).replace('{{n}} ', '')} couvert{sheet.servings > 1 ? 's' : ''}
          </span>
        )}
        {sheet.prepTime > 0 && (
          <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-600">
            Prép. {sheet.prepTime} min
          </span>
        )}
        {sheet.cookTime > 0 && (
          <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-600">
            Cuisson {sheet.cookTime} min
          </span>
        )}
        {sheet.difficulty && getDiffBadge(sheet.difficulty, t)}
      </div>

      {/* Ingrédients */}
      {sheet.ingredients.length > 0 && (
        <div>
          <h3 className={headingCls}>{t('techSheets.step2.ingredients')}</h3>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-stone-400 font-medium">
                <th className="pb-1.5 pr-4">{t('techSheets.detail.name')}</th>
                <th className="pb-1.5 pr-4">{t('techSheets.detail.quantity')}</th>
                <th className="pb-1.5">{t('techSheets.detail.unit')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {sheet.ingredients.map((ing, i) => (
                <tr key={i}>
                  <td className="py-1.5 pr-4 font-medium text-stone-800">{ing.name}</td>
                  <td className="py-1.5 pr-4">{ing.quantity}</td>
                  <td className="py-1.5 text-stone-400">{ing.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Étapes */}
      {sheet.steps.length > 0 && (
        <div>
          <h3 className={headingCls}>{t('techSheets.step2.steps')}</h3>
          <ol className="space-y-3">
            {sheet.steps.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-[11px] font-bold text-white">
                  {i + 1}
                </span>
                <p className="pt-0.5 leading-relaxed">{step}</p>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Présentation */}
      {sheet.presentation && (
        <div>
          <h3 className={headingCls}>{t('techSheets.step2.presentation')}</h3>
          <p className="rounded-xl border-l-2 border-emerald-500 bg-stone-50 px-4 py-3 leading-relaxed">{sheet.presentation}</p>
        </div>
      )}

      {/* Conseils */}
      {sheet.tips && (
        <div>
          <h3 className={headingCls}>{t('techSheets.step2.tips')}</h3>
          <p className="rounded-xl border-l-2 border-amber-400 bg-amber-50 px-4 py-3 leading-relaxed">{sheet.tips}</p>
        </div>
      )}
    </div>
  );
}

// ── Detail modal (saved sheet) ─────────────────────────────────────────────

function DetailModal({
  sheet,
  apiBase,
  onClose,
}: {
  sheet: TechSheet;
  apiBase: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const backdropRef = useRef<HTMLDivElement>(null);
  const ingredients = parseIngredients(sheet);
  const steps = parseSteps(sheet);
  const headingCls = 'mb-2 text-[11px] font-semibold uppercase tracking-wide text-stone-400 border-b border-stone-100 pb-1';

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
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 p-4 pt-12 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === backdropRef.current) onClose(); }}
    >
      <div className="w-full sm:max-w-2xl rounded-2xl border border-stone-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-stone-100 px-6 py-4">
          <h2 className="text-sm font-semibold text-stone-900">{sheet.name}</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.open(`${apiBase}/tech-sheets/${sheet.id}/pdf`, '_blank')}
              className="rounded-lg bg-stone-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-stone-700"
            >
              {t('techSheets.print')}
            </button>
            <button
              onClick={onClose}
              className="rounded-md p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
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

// ── Delete confirm modal ───────────────────────────────────────────────────

function DeleteModal({
  sheet,
  onConfirm,
  onCancel,
}: {
  sheet: TechSheet;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  async function go() {
    setLoading(true);
    try { await onConfirm(); } finally { setLoading(false); }
  }
  const backdropRef = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === backdropRef.current) onCancel(); }}
    >
      <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white shadow-xl p-6">
        <h2 className="mb-2 text-sm font-semibold text-stone-900">{t('common.confirmDelete')}</h2>
        <p className="text-sm text-stone-600">{t('techSheets.delete.message', { name: sheet.name })}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onCancel} className="rounded-lg border border-stone-200 px-4 py-2 text-sm text-stone-600 hover:bg-stone-50">
            {t('common.cancel')}
          </button>
          <button onClick={go} disabled={loading} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60">
            {loading ? t('common.deleting') : t('common.deleteForever')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Spinner ────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg className="h-5 w-5 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

type View = 'list' | 'step1' | 'step2' | 'step3';
type ActiveModal =
  | { type: 'detail'; sheet: TechSheet }
  | { type: 'delete'; sheet: TechSheet };

export function TechSheetPage() {
  const { t } = useTranslation();

  // API base URL for PDF links
  const apiBase = (import.meta.env.VITE_API_URL ?? '') + '/api';

  // ── State ──
  const [view, setView] = useState<View>('list');
  const [sheets, setSheets] = useState<TechSheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [modal, setModal] = useState<ActiveModal | null>(null);

  // wizard state
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

  // ── Step 1 → 2 : generate ──
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

  // ── Step 2 → 3 : save ──
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

  // ── Delete ──
  async function handleDelete() {
    if (modal?.type !== 'delete') return;
    await api.delete(`/tech-sheets/${modal.sheet.id}`);
    setModal(null);
    await loadSheets();
  }

  // ── Reset wizard ──
  function resetWizard() {
    setDescription('');
    setGeneratedSheet(null);
    setGenerateError('');
    setSaveError('');
    setSavedSheet(null);
    setView('step1');
  }

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* ─── LIST VIEW ─── */}
      {view === 'list' && (
        <>
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-stone-900 dark:text-white">
                {t('techSheets.title')}
              </h1>
              <p className="mt-1 text-sm text-stone-500 dark:text-gray-400">
                {t(sheets.length === 1 ? 'techSheets.subtitle_one' : 'techSheets.subtitle_other', { count: sheets.length })}
              </p>
            </div>
            <button
              onClick={resetWizard}
              className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-emerald-700"
            >
              <span>✨</span> {t('techSheets.newSheet')}
            </button>
          </div>

          {/* Loading / Error */}
          {loading && <p className="text-sm text-stone-500">{t('common.loading')}</p>}
          {loadError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{loadError}</div>
          )}

          {/* Empty */}
          {!loading && !loadError && sheets.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-stone-200 bg-white py-20 text-center">
              <p className="text-5xl">📋</p>
              <p className="mt-4 font-semibold text-stone-700">{t('techSheets.empty.title')}</p>
              <p className="mt-1 text-sm text-stone-400">{t('techSheets.empty.desc')}</p>
              <button
                onClick={resetWizard}
                className="mt-5 flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700"
              >
                ✨ {t('techSheets.newSheet')}
              </button>
            </div>
          )}

          {/* Table */}
          {!loading && sheets.length > 0 && (
            <div className="rounded-xl border border-stone-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-stone-100 bg-stone-50 text-left text-xs font-medium uppercase tracking-wide text-stone-400">
                      <th className="px-5 py-3">{t('techSheets.table.name')}</th>
                      <th className="px-5 py-3">{t('techSheets.table.category')}</th>
                      <th className="px-5 py-3 text-center">{t('techSheets.table.servings')}</th>
                      <th className="px-5 py-3">{t('techSheets.table.difficulty')}</th>
                      <th className="px-5 py-3">{t('techSheets.table.date')}</th>
                      <th className="px-5 py-3">{t('techSheets.table.actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {sheets.map((s) => {
                      const ings = parseIngredients(s).length;
                      const stps = parseSteps(s).filter((x) => x.trim()).length;
                      return (
                        <tr key={s.id} className="hover:bg-stone-50">
                          <td className="px-5 py-3">
                            <button
                              onClick={() => setModal({ type: 'detail', sheet: s })}
                              className="font-medium text-stone-800 hover:text-emerald-700 hover:underline text-left"
                            >
                              {s.name}
                            </button>
                            <div className="mt-0.5 text-xs text-stone-400">
                              {ings > 0 && `${ings} ing.`}
                              {ings > 0 && stps > 0 && ' · '}
                              {stps > 0 && `${stps} étape${stps > 1 ? 's' : ''}`}
                            </div>
                          </td>
                          <td className="px-5 py-3">
                            {s.category
                              ? <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600">{s.category}</span>
                              : <span className="text-stone-300">—</span>}
                          </td>
                          <td className="px-5 py-3 text-center text-stone-600">{s.servings}</td>
                          <td className="px-5 py-3">
                            {s.difficulty ? getDiffBadge(s.difficulty, t) : <span className="text-stone-300">—</span>}
                          </td>
                          <td className="px-5 py-3 text-xs text-stone-400">
                            {new Date(s.createdAt).toLocaleDateString('fr-FR')}
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex gap-1">
                              <button
                                onClick={() => setModal({ type: 'detail', sheet: s })}
                                className="rounded-md px-2.5 py-1.5 text-xs font-medium text-stone-500 hover:bg-stone-100"
                              >
                                Voir
                              </button>
                              <button
                                onClick={() => window.open(`${apiBase}/tech-sheets/${s.id}/pdf`, '_blank')}
                                className="rounded-md px-2.5 py-1.5 text-xs font-medium text-stone-500 hover:bg-stone-100"
                              >
                                🖨️
                              </button>
                              <button
                                onClick={() => setModal({ type: 'delete', sheet: s })}
                                className="rounded-md px-2.5 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50"
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

      {/* ─── STEP 1 — Description ─── */}
      {view === 'step1' && (
        <div className="mx-auto max-w-2xl space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-stone-900 dark:text-white">
                {t('techSheets.step1.title')}
              </h1>
              <p className="mt-1 text-sm text-stone-500 dark:text-gray-400">{t('techSheets.step1.subtitle')}</p>
            </div>
            <button onClick={() => setView('list')} className="text-sm text-stone-500 hover:text-stone-700">
              {t('techSheets.backToList')}
            </button>
          </div>

          {/* Wizard progress */}
          <WizardSteps current={1} />

          <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={10}
              placeholder={t('techSheets.step1.placeholder')}
              className="w-full resize-none rounded-xl border border-stone-200 p-4 text-sm text-stone-800 placeholder:text-stone-300 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/20"
            />

            {generateError && (
              <p className="mt-2 text-sm text-red-600">{generateError}</p>
            )}

            <div className="mt-4 flex justify-end">
              <button
                onClick={handleGenerate}
                disabled={generating || !description.trim()}
                className="flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
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

      {/* ─── STEP 2 — Preview ─── */}
      {view === 'step2' && generatedSheet && (
        <div className="mx-auto max-w-2xl space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-stone-900 dark:text-white">
                {t('techSheets.step2.title')}
              </h1>
              <p className="mt-1 text-sm text-stone-500 dark:text-gray-400">{t('techSheets.step2.subtitle')}</p>
            </div>
            <button onClick={() => setView('list')} className="text-sm text-stone-500 hover:text-stone-700">
              {t('techSheets.backToList')}
            </button>
          </div>

          {/* Wizard progress */}
          <WizardSteps current={2} />

          <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
            <SheetPreview sheet={generatedSheet} />
          </div>

          {saveError && (
            <p className="text-sm text-red-600">{saveError}</p>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setView('step1')}
              className="flex-1 rounded-xl border border-stone-200 px-4 py-3 text-sm font-medium text-stone-600 hover:bg-stone-50"
            >
              {t('techSheets.step2.edit')}
            </button>
            <button
              onClick={handleValidate}
              disabled={saving}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
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

      {/* ─── STEP 3 — Confirmation ─── */}
      {view === 'step3' && (
        <div className="mx-auto max-w-2xl space-y-6">
          <WizardSteps current={3} />

          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center shadow-sm">
            <div className="text-5xl">✅</div>
            <h2 className="mt-4 text-xl font-bold text-emerald-800">{t('techSheets.step3.title')}</h2>
            <p className="mt-2 text-sm text-emerald-700">{t('techSheets.step3.subtitle')}</p>
            <div className="mt-6 flex justify-center gap-3">
              {savedSheet && (
                <button
                  onClick={() => { setView('list'); setModal({ type: 'detail', sheet: savedSheet }); }}
                  className="rounded-xl border border-emerald-300 bg-white px-5 py-2.5 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
                >
                  {t('techSheets.step3.viewSheet')}
                </button>
              )}
              <button
                onClick={resetWizard}
                className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-700"
              >
                ✨ {t('techSheets.step3.newSheet')}
              </button>
            </div>
            <button
              onClick={() => setView('list')}
              className="mt-3 text-sm text-emerald-600 hover:underline"
            >
              {t('techSheets.backToList')}
            </button>
          </div>

          {/* Aperçu de la fiche sauvegardée */}
          {savedSheet && generatedSheet && (
            <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
              <SheetPreview sheet={generatedSheet} compact />
            </div>
          )}
        </div>
      )}

      {/* ─── Modals ─── */}
      {modal?.type === 'detail' && (
        <DetailModal sheet={modal.sheet} apiBase={apiBase} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'delete' && (
        <DeleteModal sheet={modal.sheet} onConfirm={handleDelete} onCancel={() => setModal(null)} />
      )}
    </div>
  );
}

// ── Wizard stepper ─────────────────────────────────────────────────────────

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
              className={[
                'flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold',
                current === s.n
                  ? 'bg-emerald-600 text-white'
                  : current > s.n
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-stone-100 text-stone-400',
              ].join(' ')}
            >
              {current > s.n ? '✓' : s.n}
            </span>
            <span className={`text-xs font-medium ${current >= s.n ? 'text-stone-700' : 'text-stone-400'}`}>
              {s.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className={`mx-3 flex-1 h-px ${current > s.n ? 'bg-emerald-300' : 'bg-stone-200'}`} />
          )}
        </div>
      ))}
    </div>
  );
}
