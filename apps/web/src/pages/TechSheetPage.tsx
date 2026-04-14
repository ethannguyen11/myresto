import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';

// ── Types ──────────────────────────────────────────────────────────────────

interface Ingredient {
  id: number;
  name: string;
  unit: string;
  currentPrice: number;
}

interface TechSheetIngredient {
  ingredientId?: number;
  name: string;
  quantity: string;
  unit?: string;
  unitPrice?: number;
}

interface TechSheet {
  id: number;
  name: string;
  category: string | null;
  recipeId: number | null;
  servings: number;
  prepTime: number | null;
  cookTime: number | null;
  difficulty: string | null;
  ingredients: string;  // JSON
  steps: string;        // JSON
  presentation: string | null;
  tips: string | null;
  createdAt: string;
  updatedAt: string;
}

interface TechSheetForm {
  name: string;
  category: string;
  servings: string;
  prepTime: string;
  cookTime: string;
  difficulty: string;
  ingredients: TechSheetIngredient[];
  steps: string[];
  presentation: string;
  tips: string;
}

const EMPTY_FORM: TechSheetForm = {
  name: '',
  category: '',
  servings: '4',
  prepTime: '',
  cookTime: '',
  difficulty: '',
  ingredients: [{ name: '', quantity: '', unit: '' }],
  steps: [''],
  presentation: '',
  tips: '',
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function sheetToForm(s: TechSheet): TechSheetForm {
  const ings: TechSheetIngredient[] = JSON.parse(s.ingredients || '[]');
  const steps: string[] = JSON.parse(s.steps || '[]');
  return {
    name: s.name,
    category: s.category ?? '',
    servings: String(s.servings),
    prepTime: s.prepTime != null ? String(s.prepTime) : '',
    cookTime: s.cookTime != null ? String(s.cookTime) : '',
    difficulty: s.difficulty ?? '',
    ingredients: ings.length > 0 ? ings : [{ name: '', quantity: '', unit: '' }],
    steps: steps.length > 0 ? steps : [''],
    presentation: s.presentation ?? '',
    tips: s.tips ?? '',
  };
}

function getDifficultyColor(d: string | null) {
  if (d === 'facile') return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200';
  if (d === 'moyen') return 'bg-amber-50 text-amber-700 ring-1 ring-amber-200';
  if (d === 'difficile') return 'bg-red-50 text-red-700 ring-1 ring-red-200';
  return 'bg-stone-100 text-stone-500';
}

function parsedIngredients(s: TechSheet): TechSheetIngredient[] {
  try { return JSON.parse(s.ingredients || '[]'); } catch { return []; }
}

function parsedSteps(s: TechSheet): string[] {
  try { return JSON.parse(s.steps || '[]'); } catch { return []; }
}

// ── Modal shell ───────────────────────────────────────────────────────────

function Modal({
  title,
  wide,
  onClose,
  children,
}: {
  title: string;
  wide?: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const backdropRef = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 p-4 pt-12 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === backdropRef.current) onClose(); }}
    >
      <div className={`w-full ${wide ? 'sm:max-w-3xl' : 'sm:max-w-md'} rounded-2xl border border-stone-200 bg-white shadow-xl`}>
        <div className="flex items-center justify-between border-b border-stone-100 px-6 py-4">
          <h2 className="text-sm font-semibold text-stone-900">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600"
          >
            ✕
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

// ── Form ──────────────────────────────────────────────────────────────────

function TechSheetFormModal({
  initial,
  catalogIngredients,
  title,
  onSave,
  onClose,
}: {
  initial: TechSheetForm;
  catalogIngredients: Ingredient[];
  title: string;
  onSave: (form: TechSheetForm) => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState<TechSheetForm>(initial);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const inputCls =
    'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 ' +
    'placeholder:text-stone-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20';
  const labelCls = 'mb-1.5 block text-xs font-medium text-stone-600';
  const sectionCls = 'rounded-xl border border-stone-100 bg-stone-50 p-4';

  function setField(key: keyof Omit<TechSheetForm, 'ingredients' | 'steps'>) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));
  }

  // ── Ingredients ──
  function setIngField(idx: number, key: keyof TechSheetIngredient, value: string | number | undefined) {
    setForm((f) => {
      const ings = [...f.ingredients];
      ings[idx] = { ...ings[idx], [key]: value };
      return { ...f, ingredients: ings };
    });
  }

  function addIngredient() {
    setForm((f) => ({ ...f, ingredients: [...f.ingredients, { name: '', quantity: '', unit: '' }] }));
  }

  function removeIngredient(idx: number) {
    setForm((f) => ({ ...f, ingredients: f.ingredients.filter((_, i) => i !== idx) }));
  }

  function selectCatalogIng(idx: number, ingId: string) {
    const ing = catalogIngredients.find((i) => String(i.id) === ingId);
    if (!ing) {
      setIngField(idx, 'ingredientId', undefined);
      setIngField(idx, 'name', '');
      setIngField(idx, 'unit', '');
      return;
    }
    setForm((f) => {
      const ings = [...f.ingredients];
      ings[idx] = {
        ...ings[idx],
        ingredientId: ing.id,
        name: ing.name,
        unit: ing.unit,
        unitPrice: Number(ing.currentPrice),
      };
      return { ...f, ingredients: ings };
    });
  }

  // ── Steps ──
  function setStep(idx: number, value: string) {
    setForm((f) => {
      const steps = [...f.steps];
      steps[idx] = value;
      return { ...f, steps };
    });
  }

  function addStep() {
    setForm((f) => ({ ...f, steps: [...f.steps, ''] }));
  }

  function removeStep(idx: number) {
    setForm((f) => ({ ...f, steps: f.steps.filter((_, i) => i !== idx) }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await onSave(form);
    } catch (err: any) {
      setError(err.response?.data?.message ?? t('common.error'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title={title} wide onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-5 max-h-[75vh] overflow-y-auto pr-1">
        {error && (
          <div className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</div>
        )}

        {/* ── Infos générales ── */}
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className={labelCls}>{t('techSheets.form.name')}</label>
            <input className={inputCls} required value={form.name} onChange={setField('name')} placeholder={t('techSheets.form.namePlaceholder')} />
          </div>
          <div>
            <label className={labelCls}>{t('techSheets.form.category')}</label>
            <input className={inputCls} value={form.category} onChange={setField('category')} placeholder={t('techSheets.form.categoryPlaceholder')} />
          </div>
          <div>
            <label className={labelCls}>{t('techSheets.form.difficulty')}</label>
            <select className={inputCls} value={form.difficulty} onChange={setField('difficulty')}>
              <option value="">{t('techSheets.form.difficultyPlaceholder')}</option>
              <option value="facile">{t('techSheets.difficulty.facile')}</option>
              <option value="moyen">{t('techSheets.difficulty.moyen')}</option>
              <option value="difficile">{t('techSheets.difficulty.difficile')}</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>{t('techSheets.form.servings')}</label>
            <input className={inputCls} type="number" min="1" value={form.servings} onChange={setField('servings')} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>{t('techSheets.form.prepTime')}</label>
              <input className={inputCls} type="number" min="0" value={form.prepTime} onChange={setField('prepTime')} placeholder="0" />
            </div>
            <div>
              <label className={labelCls}>{t('techSheets.form.cookTime')}</label>
              <input className={inputCls} type="number" min="0" value={form.cookTime} onChange={setField('cookTime')} placeholder="0" />
            </div>
          </div>
        </div>

        {/* ── Ingrédients ── */}
        <div className={sectionCls}>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">{t('techSheets.form.ingredientsSection')}</p>
            <button type="button" onClick={addIngredient} className="text-xs font-medium text-emerald-600 hover:underline">
              {t('techSheets.form.addIngredient')}
            </button>
          </div>
          <div className="space-y-2">
            {form.ingredients.map((ing, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                {/* Sélecteur catalogue */}
                <select
                  className="col-span-4 rounded-lg border border-stone-300 px-2 py-2 text-xs text-stone-700 focus:border-emerald-500 focus:outline-none"
                  value={ing.ingredientId != null ? String(ing.ingredientId) : ''}
                  onChange={(e) => selectCatalogIng(idx, e.target.value)}
                >
                  <option value="">{t('techSheets.form.chooseIngredient')}</option>
                  {catalogIngredients.map((ci) => (
                    <option key={ci.id} value={ci.id}>{ci.name}</option>
                  ))}
                </select>
                {/* Nom libre */}
                <input
                  className="col-span-3 rounded-lg border border-stone-300 px-2 py-2 text-xs placeholder:text-stone-400 focus:border-emerald-500 focus:outline-none"
                  value={ing.name}
                  onChange={(e) => setIngField(idx, 'name', e.target.value)}
                  placeholder={t('techSheets.form.ingredientNamePlaceholder')}
                />
                {/* Quantité */}
                <input
                  className="col-span-2 rounded-lg border border-stone-300 px-2 py-2 text-xs placeholder:text-stone-400 focus:border-emerald-500 focus:outline-none"
                  value={ing.quantity}
                  onChange={(e) => setIngField(idx, 'quantity', e.target.value)}
                  placeholder={t('techSheets.form.ingredientQtyPlaceholder')}
                />
                {/* Unité */}
                <input
                  className="col-span-2 rounded-lg border border-stone-300 px-2 py-2 text-xs placeholder:text-stone-400 focus:border-emerald-500 focus:outline-none"
                  value={ing.unit ?? ''}
                  onChange={(e) => setIngField(idx, 'unit', e.target.value)}
                  placeholder={t('techSheets.form.ingredientUnitPlaceholder')}
                />
                <button
                  type="button"
                  onClick={() => removeIngredient(idx)}
                  disabled={form.ingredients.length === 1}
                  className="col-span-1 rounded-md p-1.5 text-stone-300 hover:bg-red-50 hover:text-red-500 disabled:opacity-30"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* ── Progression ── */}
        <div className={sectionCls}>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">{t('techSheets.form.stepsSection')}</p>
            <button type="button" onClick={addStep} className="text-xs font-medium text-emerald-600 hover:underline">
              {t('techSheets.form.addStep')}
            </button>
          </div>
          <div className="space-y-2">
            {form.steps.map((step, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <span className="mt-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-[11px] font-bold text-white">
                  {idx + 1}
                </span>
                <textarea
                  rows={2}
                  value={step}
                  onChange={(e) => setStep(idx, e.target.value)}
                  placeholder={t('techSheets.form.stepPlaceholder')}
                  className="flex-1 resize-none rounded-lg border border-stone-300 px-3 py-2 text-sm placeholder:text-stone-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
                <button
                  type="button"
                  onClick={() => removeStep(idx)}
                  disabled={form.steps.length === 1}
                  className="mt-2 rounded-md p-1.5 text-stone-300 hover:bg-red-50 hover:text-red-500 disabled:opacity-30"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* ── Présentation ── */}
        <div>
          <label className={labelCls}>{t('techSheets.form.presentationSection')}</label>
          <textarea
            rows={3}
            value={form.presentation}
            onChange={setField('presentation')}
            placeholder={t('techSheets.form.presentationPlaceholder')}
            className={inputCls + ' resize-none'}
          />
        </div>

        {/* ── Conseils chef ── */}
        <div>
          <label className={labelCls}>{t('techSheets.form.tipsSection')}</label>
          <textarea
            rows={2}
            value={form.tips}
            onChange={setField('tips')}
            placeholder={t('techSheets.form.tipsPlaceholder')}
            className={inputCls + ' resize-none'}
          />
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="rounded-lg border border-stone-200 px-4 py-2 text-sm text-stone-600 hover:bg-stone-50">
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {submitting ? t('common.saving') : t('techSheets.form.save')}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ── Sheet detail (vue impression) ────────────────────────────────────────

function TechSheetDetailModal({ sheet, onClose }: { sheet: TechSheet; onClose: () => void }) {
  const { t } = useTranslation();
  const ingredients = parsedIngredients(sheet);
  const steps = parsedSteps(sheet);
  const date = new Date(sheet.createdAt).toLocaleDateString('fr-FR');

  const diffLabel: Record<string, string> = {
    facile: t('techSheets.difficulty.facile'),
    moyen: t('techSheets.difficulty.moyen'),
    difficile: t('techSheets.difficulty.difficile'),
  };

  function handlePrint() {
    window.open(`${import.meta.env.VITE_API_URL ?? ''}/api/tech-sheets/${sheet.id}/pdf`, '_blank');
  }

  return (
    <Modal title={sheet.name} wide onClose={onClose}>
      <div className="space-y-5 max-h-[75vh] overflow-y-auto pr-1 text-sm text-stone-700">

        {/* Header meta */}
        <div className="flex flex-wrap gap-3">
          {sheet.category && (
            <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-600">
              {sheet.category}
            </span>
          )}
          <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-600">
            {sheet.servings} couverts
          </span>
          {sheet.prepTime != null && (
            <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-600">
              Prép. {sheet.prepTime} {t('techSheets.min')}
            </span>
          )}
          {sheet.cookTime != null && (
            <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-600">
              Cuisson {sheet.cookTime} {t('techSheets.min')}
            </span>
          )}
          {sheet.difficulty && (
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${getDifficultyColor(sheet.difficulty)}`}>
              {diffLabel[sheet.difficulty] ?? sheet.difficulty}
            </span>
          )}
        </div>

        {/* Ingrédients */}
        {ingredients.length > 0 && (
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400 border-b border-stone-100 pb-1">
              {t('techSheets.form.ingredientsSection')}
            </h3>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-stone-400 font-medium uppercase tracking-wide">
                  <th className="py-1.5 pr-3">{t('techSheets.form.ingredientName')}</th>
                  <th className="py-1.5 pr-3">{t('techSheets.form.ingredientQty')}</th>
                  <th className="py-1.5 pr-3">{t('techSheets.form.ingredientUnit')}</th>
                  <th className="py-1.5 text-right">{t('techSheets.form.ingredientPrice')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-50">
                {ingredients.map((ing, i) => (
                  <tr key={i}>
                    <td className="py-1.5 pr-3 font-medium text-stone-800">{ing.name}</td>
                    <td className="py-1.5 pr-3">{ing.quantity}</td>
                    <td className="py-1.5 pr-3 text-stone-400">{ing.unit ?? ''}</td>
                    <td className="py-1.5 text-right text-stone-500">
                      {ing.unitPrice != null ? `${Number(ing.unitPrice).toFixed(2)} €` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Étapes */}
        {steps.length > 0 && steps.some((s) => s.trim()) && (
          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-stone-400 border-b border-stone-100 pb-1">
              {t('techSheets.form.stepsSection')}
            </h3>
            <ol className="space-y-3">
              {steps.filter((s) => s.trim()).map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-[11px] font-bold text-white">
                    {i + 1}
                  </span>
                  <p className="pt-0.5 leading-relaxed text-stone-700">{step}</p>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Présentation */}
        {sheet.presentation && (
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400 border-b border-stone-100 pb-1">
              {t('techSheets.form.presentationSection')}
            </h3>
            <p className="rounded-xl border-l-2 border-emerald-500 bg-stone-50 px-4 py-3 leading-relaxed text-stone-700">
              {sheet.presentation}
            </p>
          </div>
        )}

        {/* Conseils chef */}
        {sheet.tips && (
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400 border-b border-stone-100 pb-1">
              {t('techSheets.form.tipsSection')}
            </h3>
            <p className="rounded-xl border-l-2 border-amber-400 bg-amber-50 px-4 py-3 leading-relaxed text-stone-700">
              {sheet.tips}
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 text-xs text-stone-400 border-t border-stone-100">
          <span>{date}</span>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 rounded-lg bg-stone-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-stone-700"
          >
            🖨️ {t('techSheets.print')}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Delete confirm ────────────────────────────────────────────────────────

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
  return (
    <Modal title={t('common.confirmDelete')} onClose={onCancel}>
      <p className="text-sm text-stone-600">{t('techSheets.delete.message', { name: sheet.name })}</p>
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onCancel} className="rounded-lg border border-stone-200 px-4 py-2 text-sm text-stone-600 hover:bg-stone-50">
          {t('common.cancel')}
        </button>
        <button
          onClick={go}
          disabled={loading}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
        >
          {loading ? t('common.deleting') : t('common.deleteForever')}
        </button>
      </div>
    </Modal>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

type ActiveModal =
  | { type: 'create' }
  | { type: 'edit'; sheet: TechSheet }
  | { type: 'detail'; sheet: TechSheet }
  | { type: 'delete'; sheet: TechSheet };

export function TechSheetPage() {
  const { t } = useTranslation();
  const [sheets, setSheets] = useState<TechSheet[]>([]);
  const [catalogIngredients, setCatalogIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<ActiveModal | null>(null);

  async function load() {
    try {
      const [sRes, iRes] = await Promise.all([
        api.get<TechSheet[]>('/tech-sheets'),
        api.get<Ingredient[]>('/ingredients'),
      ]);
      setSheets(sRes.data);
      setCatalogIngredients(iRes.data);
    } catch (err: any) {
      setError(err.response?.data?.message ?? t('techSheets.loadError'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function buildPayload(form: TechSheetForm) {
    const ings = form.ingredients.filter((i) => i.name.trim() || i.quantity.trim());
    const steps = form.steps.filter((s) => s.trim());
    return {
      name: form.name,
      category: form.category || undefined,
      servings: parseInt(form.servings) || 4,
      prepTime: form.prepTime ? parseInt(form.prepTime) : undefined,
      cookTime: form.cookTime ? parseInt(form.cookTime) : undefined,
      difficulty: form.difficulty || undefined,
      ingredients: JSON.stringify(ings),
      steps: JSON.stringify(steps),
      presentation: form.presentation || undefined,
      tips: form.tips || undefined,
    };
  }

  async function handleCreate(form: TechSheetForm) {
    await api.post('/tech-sheets', buildPayload(form));
    setModal(null);
    await load();
  }

  async function handleEdit(form: TechSheetForm) {
    if (modal?.type !== 'edit') return;
    await api.put(`/tech-sheets/${modal.sheet.id}`, buildPayload(form));
    setModal(null);
    await load();
  }

  async function handleDelete() {
    if (modal?.type !== 'delete') return;
    await api.delete(`/tech-sheets/${modal.sheet.id}`);
    setModal(null);
    await load();
  }

  const diffLabel: Record<string, string> = {
    facile: t('techSheets.difficulty.facile'),
    moyen: t('techSheets.difficulty.moyen'),
    difficile: t('techSheets.difficulty.difficile'),
  };

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900 dark:text-white">
            {t('techSheets.title')}
          </h1>
          <p className="mt-1 text-sm text-stone-500 dark:text-gray-400">
            {t('techSheets.subtitle', { count: sheets.length })}
          </p>
        </div>
        <button
          onClick={() => setModal({ type: 'create' })}
          className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-700"
        >
          <span>+</span> {t('techSheets.add')}
        </button>
      </div>

      {/* ── States ── */}
      {loading && (
        <p className="text-sm text-stone-500">{t('common.loading')}</p>
      )}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* ── Empty ── */}
      {!loading && !error && sheets.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-stone-200 bg-white py-20 text-center">
          <p className="text-4xl">📋</p>
          <p className="mt-3 font-medium text-stone-700">{t('techSheets.empty.title')}</p>
          <p className="mt-1 text-sm text-stone-400">{t('techSheets.empty.desc')}</p>
          <button
            onClick={() => setModal({ type: 'create' })}
            className="mt-5 rounded-lg border border-stone-200 px-4 py-2 text-sm text-stone-600 hover:bg-stone-50"
          >
            {t('techSheets.add')}
          </button>
        </div>
      )}

      {/* ── Table ── */}
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
                  <th className="px-5 py-3">{t('techSheets.table.times')}</th>
                  <th className="px-5 py-3">{t('techSheets.table.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {sheets.map((s) => {
                  const ingsCount = parsedIngredients(s).length;
                  const stepsCount = parsedSteps(s).filter((x) => x.trim()).length;
                  const totalTime = (s.prepTime ?? 0) + (s.cookTime ?? 0);
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
                          {ingsCount > 0 && `${ingsCount} ingrédient${ingsCount > 1 ? 's' : ''}`}
                          {ingsCount > 0 && stepsCount > 0 && ' · '}
                          {stepsCount > 0 && `${stepsCount} étape${stepsCount > 1 ? 's' : ''}`}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        {s.category ? (
                          <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600">
                            {s.category}
                          </span>
                        ) : (
                          <span className="text-stone-300">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-center text-stone-700">{s.servings}</td>
                      <td className="px-5 py-3">
                        {s.difficulty ? (
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${getDifficultyColor(s.difficulty)}`}>
                            {diffLabel[s.difficulty] ?? s.difficulty}
                          </span>
                        ) : (
                          <span className="text-stone-300">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-stone-500 text-xs">
                        {totalTime > 0 ? `${totalTime} ${t('techSheets.min')}` : '—'}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex gap-1">
                          <button
                            onClick={() => setModal({ type: 'detail', sheet: s })}
                            className="rounded-md px-2.5 py-1.5 text-xs font-medium text-stone-400 hover:bg-stone-100 hover:text-stone-600"
                          >
                            👁
                          </button>
                          <button
                            onClick={() => setModal({ type: 'edit', sheet: s })}
                            className="rounded-md px-2.5 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-100"
                          >
                            {t('common.edit')}
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

      {/* ── Modals ── */}
      {modal?.type === 'create' && (
        <TechSheetFormModal
          initial={EMPTY_FORM}
          catalogIngredients={catalogIngredients}
          title={t('techSheets.form.createTitle')}
          onSave={handleCreate}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === 'edit' && (
        <TechSheetFormModal
          initial={sheetToForm(modal.sheet)}
          catalogIngredients={catalogIngredients}
          title={t('techSheets.form.editTitle', { name: modal.sheet.name })}
          onSave={handleEdit}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === 'detail' && (
        <TechSheetDetailModal sheet={modal.sheet} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'delete' && (
        <DeleteModal sheet={modal.sheet} onConfirm={handleDelete} onCancel={() => setModal(null)} />
      )}
    </div>
  );
}
