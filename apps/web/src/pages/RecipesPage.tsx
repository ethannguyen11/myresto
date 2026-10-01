import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { conversionFactor, normalizeUnit, unitChoices } from '../lib/units';

// ── Types ──────────────────────────────────────────────────────────────────

interface Ingredient { id: number; name: string; unit: string; currentPrice: number; }
interface SubRecipeRef { id: number; name: string; yieldQuantity: number | null; yieldUnit: string | null; }
interface RecipeItem {
  id: number; ingredientId: number | null; subRecipeId: number | null; quantity: number;
  unit: string | null; ingredient: Ingredient | null; subRecipe: SubRecipeRef | null;
}
interface CostLine {
  kind: 'ingredient' | 'preparation'; refId: number; name: string;
  quantity: number; unit: string | null; cost: number; unitMismatch: boolean;
}
interface FoodCost {
  totalCost: number; ingredientCost: number; ingredientCostWithWaste: number;
  totalRealCost: number; sellingPrice: number; foodCostPercent: number;
  realCostPercent: number; profitPerDish: number; realProfitPerDish: number;
  isRentable: boolean; ragStatus: 'green' | 'amber' | 'red'; status: string;
}
interface Recipe {
  id: number; name: string; category: string | null; sellingPrice: number;
  notes: string | null; prepTimeMinutes: number | null; servings: number | null;
  wastagePercent: number | null; isActive: boolean; items: RecipeItem[]; foodCost: FoodCost;
  isPreparation: boolean; yieldQuantity: number | null; yieldUnit: string | null;
  costLines: CostLine[]; unitCost: number | null; unitCostUnit: string | null;
  usedIn: { id: number; name: string }[];
}
// ref : "i:<id>" pour un ingrédient, "p:<id>" pour une préparation
interface ItemRow { ref: string; quantity: string; unit: string; }
interface RecipeForm {
  name: string; category: string; sellingPrice: string; prepTimeMinutes: string;
  servings: string; wastagePercent: string; notes: string; items: ItemRow[];
  isPreparation: boolean; yieldQuantity: string; yieldUnit: string;
}

const EMPTY_ROW: ItemRow = { ref: '', quantity: '', unit: '' };

const EMPTY_FORM: RecipeForm = {
  name: '', category: '', sellingPrice: '', prepTimeMinutes: '',
  servings: '1', wastagePercent: '0', notes: '',
  items: [EMPTY_ROW],
  isPreparation: false, yieldQuantity: '', yieldUnit: 'kg',
};

const EMPTY_PREP_FORM: RecipeForm = { ...EMPTY_FORM, isPreparation: true };

// ── Helpers ────────────────────────────────────────────────────────────────

function fmt(n: number, dec = 2): string { return n.toFixed(dec).replace('.', ','); }

function fcColor(pct: number): string {
  if (pct <= 25) return 'var(--green)';
  if (pct <= 30) return 'var(--amber)';
  if (pct <= 35) return '#f97316';
  return 'var(--red)';
}

function fcBg(pct: number): string {
  if (pct <= 25) return 'rgba(16,185,129,0.15)';
  if (pct <= 30) return 'rgba(245,158,11,0.15)';
  if (pct <= 35) return 'rgba(249,115,22,0.15)';
  return 'rgba(239,68,68,0.15)';
}

function ragLeftBorder(status: 'green' | 'amber' | 'red'): string {
  if (status === 'green') return 'var(--green)';
  if (status === 'amber') return 'var(--amber)';
  return 'var(--red)';
}

/** Unité dans laquelle une préparation est dosée (null = portion) */
function prepBaseUnit(p: { yieldQuantity: number | null; yieldUnit: string | null }): string | null {
  return Number(p.yieldQuantity ?? 0) > 0 ? p.yieldUnit : null;
}

/** L'option de la liste d'unités qui correspond à l'unité de base (« Kg » → « kg ») */
function defaultUnit(base: string | null | undefined): string {
  if (!base) return '';
  return unitChoices(base).find((u) => normalizeUnit(u) === normalizeUnit(base)) ?? base;
}

interface RefLookup { ingredients: Map<number, Ingredient>; preparations: Map<number, Recipe>; }

/** Référence d'une ligne : son nom, son unité de base et son prix par unité de base */
function resolveRef(ref: string, lookup: RefLookup) {
  const [kind, raw] = ref.split(':');
  const id = parseInt(raw);
  if (kind === 'i') {
    const ing = lookup.ingredients.get(id);
    return ing ? { baseUnit: ing.unit as string | null, unitPrice: Number(ing.currentPrice) } : null;
  }
  if (kind === 'p') {
    const prep = lookup.preparations.get(id);
    return prep ? { baseUnit: prepBaseUnit(prep), unitPrice: Number(prep.unitCost ?? 0) } : null;
  }
  return null;
}

function lineCost(row: ItemRow, lookup: RefLookup): number {
  const target = resolveRef(row.ref, lookup);
  const qty = parseFloat(row.quantity);
  if (!target || !qty || qty <= 0) return 0;
  const factor = row.unit ? conversionFactor(row.unit, target.baseUnit) : 1;
  return qty * (factor ?? 1) * target.unitPrice;
}

function calcFoodCost(items: ItemRow[], sellingPriceStr: string, lookup: RefLookup, wastageStr: string) {
  const selling = parseFloat(sellingPriceStr);
  if (!selling || selling <= 0) return null;
  const ingredientCost = items.reduce((sum, row) => sum + lineCost(row, lookup), 0);
  const wastage = (parseFloat(wastageStr) || 0) / 100;
  const totalRealCost = ingredientCost * (1 + wastage);
  return {
    ingredientCost: Math.round(ingredientCost * 100) / 100,
    totalRealCost: Math.round(totalRealCost * 100) / 100,
    foodCostPct: Math.round((ingredientCost / selling) * 10000) / 100,
    realCostPct: Math.round((totalRealCost / selling) * 10000) / 100,
    profit: Math.round((selling - ingredientCost) * 100) / 100,
    realProfit: Math.round((selling - totalRealCost) * 100) / 100,
  };
}

// ── Modal shell ────────────────────────────────────────────────────────────

function Modal({ title, wide, onClose, children }: { title: string; wide?: boolean; onClose: () => void; children: React.ReactNode }) {
  const backdropRef = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 pt-12 backdrop-blur-sm"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onMouseDown={(e) => { if (e.target === backdropRef.current) onClose(); }}
    >
      <div
        className={`w-full ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'} rounded-2xl shadow-xl`}
        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--bg-border)' }}
      >
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--bg-border)' }}>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h2>
          <button onClick={onClose} className="rounded-md p-1 transition-colors" style={{ color: 'var(--text-tertiary)' }}>✕</button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

// ── Food cost preview ──────────────────────────────────────────────────────

function PreparationPreview({ form, lookup }: { form: RecipeForm; lookup: RefLookup }) {
  const { t } = useTranslation();
  const batchCost = form.items.reduce((sum, row) => sum + lineCost(row, lookup), 0);
  if (batchCost <= 0) return null;
  const yieldQty = parseFloat(form.yieldQuantity);
  const unitLabel = yieldQty > 0 ? form.yieldUnit : t('recipes.prep.portion');
  const perUnit = yieldQty > 0 ? batchCost / yieldQty : batchCost;
  return (
    <div className="rounded-xl px-4 py-3" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--bg-border)' }}>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>{t('recipes.prep.batchCost')}</p>
          <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{fmt(batchCost)} €</p>
        </div>
        <div>
          <p className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>{t('recipes.prep.unitCost')}</p>
          <p className="font-semibold" style={{ color: 'var(--accent)' }}>{fmt(perUnit)} € / {unitLabel}</p>
        </div>
      </div>
    </div>
  );
}

function FoodCostPreview({ form, lookup }: { form: RecipeForm; lookup: RefLookup }) {
  const { t } = useTranslation();
  if (form.isPreparation) return <PreparationPreview form={form} lookup={lookup} />;
  const result = calcFoodCost(form.items, form.sellingPrice, lookup, form.wastagePercent);
  if (!result) return null;
  const { ingredientCost, totalRealCost, foodCostPct, realCostPct, profit, realProfit } = result;
  return (
    <div
      className="rounded-xl px-4 py-3"
      style={{ background: fcBg(foodCostPct), border: `1px solid ${fcColor(foodCostPct)}33` }}
    >
      <div className="grid grid-cols-3 gap-4 text-sm">
        <div>
          <p className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>{t('recipes.preview.cost')}</p>
          <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{fmt(ingredientCost)} €</p>
        </div>
        <div>
          <p className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>{t('recipes.preview.foodCost')}</p>
          <p className="font-semibold" style={{ color: fcColor(foodCostPct) }}>{fmt(foodCostPct, 1)} %</p>
        </div>
        <div>
          <p className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>{t('recipes.preview.margin')}</p>
          <p className="font-semibold" style={{ color: fcColor(foodCostPct) }}>{fmt(profit)} €</p>
        </div>
        {totalRealCost !== ingredientCost && (
          <>
            <div>
              <p className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>{t('recipes.preview.realCost')}</p>
              <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{fmt(totalRealCost)} €</p>
            </div>
            <div>
              <p className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>Coût réel %</p>
              <p className="font-semibold" style={{ color: fcColor(realCostPct) }}>{fmt(realCostPct, 1)} %</p>
            </div>
            <div>
              <p className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>{t('recipes.preview.realProfit')}</p>
              <p className="font-semibold" style={{ color: fcColor(realCostPct) }}>{fmt(realProfit)} €</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Tooltip helper ─────────────────────────────────────────────────────────

function Tooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative ml-1 inline-block">
      <button
        type="button"
        className="flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold"
        style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
      >
        ?
      </button>
      {show && (
        <span
          className="absolute bottom-full left-1/2 z-10 mb-1 w-48 -translate-x-1/2 rounded-lg px-3 py-2 text-xs shadow-lg"
          style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--bg-border)' }}
        >
          {text}
        </span>
      )}
    </span>
  );
}

// ── Recipe form modal ──────────────────────────────────────────────────────

function RecipeFormModal({ initial, ingredients, preparations, editingId, title, onSave, onClose }: {
  initial: RecipeForm; ingredients: Ingredient[]; preparations: Recipe[]; editingId?: number; title: string;
  onSave: (form: RecipeForm) => Promise<void>; onClose: () => void;
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState<RecipeForm>(initial);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  // Une préparation ne peut pas se contenir elle-même (l'API refuse aussi les boucles indirectes)
  const usablePreps = preparations.filter((p) => p.id !== editingId);
  const lookup: RefLookup = {
    ingredients: new Map(ingredients.map((i) => [i.id, i])),
    preparations: new Map(usablePreps.map((p) => [p.id, p])),
  };

  function setField(key: 'name' | 'category' | 'sellingPrice' | 'prepTimeMinutes' | 'servings' | 'wastagePercent' | 'notes' | 'yieldQuantity' | 'yieldUnit') {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));
  }
  function setItemField(idx: number, key: keyof ItemRow, value: string) {
    setForm((f) => {
      const items = [...f.items];
      items[idx] = { ...items[idx], [key]: value };
      return { ...f, items };
    });
  }
  function setItemRef(idx: number, ref: string) {
    // Nouvelle cible : on repart de son unité de base
    setForm((f) => {
      const items = [...f.items];
      const base = resolveRef(ref, lookup)?.baseUnit ?? null;
      items[idx] = { ...items[idx], ref, unit: defaultUnit(base) };
      return { ...f, items };
    });
  }
  function addItem() { setForm((f) => ({ ...f, items: [...f.items, EMPTY_ROW] })); }
  function removeItem(idx: number) { setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) })); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const validItems = form.items.filter((r) => r.ref && r.quantity);
    if (validItems.length === 0) { setError(t('recipes.form.atLeastOne')); return; }
    setSubmitting(true);
    try { await onSave({ ...form, items: validItems }); }
    catch (err: any) { setError(err.response?.data?.message ?? t('common.error')); }
    finally { setSubmitting(false); }
  }

  const inputStyle = {
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--bg-border)',
    color: 'var(--text-primary)',
    borderRadius: 8,
    padding: '8px 12px',
    fontSize: 14,
    width: '100%',
    outline: 'none',
  };
  const labelStyle = { color: 'var(--text-secondary)', fontSize: 12, fontWeight: 500, marginBottom: 6, display: 'block' };

  return (
    <Modal title={title} wide onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="rounded-lg px-4 py-2.5 text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--red)' }}>{error}</div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label style={labelStyle}>{t('recipes.form.recipeName')}</label>
            <input style={inputStyle} required value={form.name} onChange={setField('name')} placeholder={t('recipes.form.recipeNamePlaceholder')} />
          </div>
          <div>
            <label style={labelStyle}>{t('recipes.form.category')}</label>
            <input style={inputStyle} value={form.category} onChange={setField('category')} placeholder={t('recipes.form.categoryPlaceholder')} />
          </div>
          {form.isPreparation ? (
            <div>
              <label style={{ ...labelStyle, display: 'flex', alignItems: 'center' }}>
                {t('recipes.prep.yield')}
                <Tooltip text={t('recipes.prep.yieldTooltip')} />
              </label>
              <div className="flex gap-2">
                <input style={{ ...inputStyle, flex: 1 }} type="number" min="0" step="0.001" value={form.yieldQuantity} onChange={setField('yieldQuantity')} placeholder="1,5" />
                <select style={{ ...inputStyle, width: 90 }} value={form.yieldUnit} onChange={setField('yieldUnit')}>
                  {['kg', 'g', 'L', 'cl', 'pièce'].map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>
          ) : (
            <div>
              <label style={labelStyle}>{t('recipes.form.sellingPrice')}</label>
              <input style={inputStyle} required type="number" min="0" step="0.01" value={form.sellingPrice} onChange={setField('sellingPrice')} placeholder="0,00" />
            </div>
          )}
          <label className="col-span-2 flex cursor-pointer items-start gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
            <input
              type="checkbox"
              className="mt-0.5"
              checked={form.isPreparation}
              onChange={(e) => setForm((f) => ({ ...f, isPreparation: e.target.checked }))}
            />
            <span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{t('recipes.prep.checkbox')}</span>
              <span className="block text-xs" style={{ color: 'var(--text-tertiary)' }}>{t('recipes.prep.checkboxHint')}</span>
            </span>
          </label>
        </div>
        {!form.isPreparation && <div className="rounded-xl p-4" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--bg-border)' }}>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>Coûts réels</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={labelStyle}>{t('recipes.form.prepTime')}</label>
              <input style={inputStyle} type="number" min="0" step="1" value={form.prepTimeMinutes} onChange={setField('prepTimeMinutes')} placeholder="0" />
            </div>
            <div>
              <label style={labelStyle}>{t('recipes.form.servings')}</label>
              <input style={inputStyle} type="number" min="1" step="1" value={form.servings} onChange={setField('servings')} placeholder="1" />
            </div>
            <div>
              <label style={{ ...labelStyle, display: 'flex', alignItems: 'center' }}>
                {t('recipes.form.wastage')}
                <Tooltip text={t('recipes.form.wastageTooltip')} />
              </label>
              <input style={inputStyle} type="number" min="0" max="100" step="0.1" value={form.wastagePercent} onChange={setField('wastagePercent')} placeholder="0" />
            </div>
          </div>
        </div>}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label style={{ ...labelStyle, marginBottom: 0 }}>{t('recipes.form.ingredients')}</label>
            <button
              type="button"
              onClick={addItem}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors"
              style={{ color: 'var(--accent)' }}
            >
              + {t('recipes.form.addIngredient')}
            </button>
          </div>
          <div className="space-y-2">
            {form.items.map((row, idx) => {
              const base = resolveRef(row.ref, lookup)?.baseUnit ?? null;
              const choices = base ? unitChoices(base) : [];
              return (
                <div key={idx} className="flex items-center gap-2">
                  <select
                    value={row.ref}
                    onChange={(e) => setItemRef(idx, e.target.value)}
                    style={{ ...inputStyle, flex: 1, width: 'auto', minWidth: 0 }}
                  >
                    <option value="">{t('recipes.form.chooseIngredient')}</option>
                    <optgroup label={t('recipes.prep.groupIngredients')}>
                      {ingredients.map((ing) => (
                        <option key={`i${ing.id}`} value={`i:${ing.id}`}>
                          {ing.name} — {fmt(Number(ing.currentPrice))} €/{ing.unit}
                        </option>
                      ))}
                    </optgroup>
                    {usablePreps.length > 0 && (
                      <optgroup label={t('recipes.prep.groupPreparations')}>
                        {usablePreps.map((p) => (
                          <option key={`p${p.id}`} value={`p:${p.id}`}>
                            {p.name} — {fmt(Number(p.unitCost ?? 0))} €/{p.unitCostUnit ?? t('recipes.prep.portion')}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                  <input
                    type="number" min="0" step="0.001"
                    value={row.quantity}
                    onChange={(e) => setItemField(idx, 'quantity', e.target.value)}
                    placeholder={t('recipes.form.qtyPlaceholder')}
                    style={{ ...inputStyle, width: 88 }}
                  />
                  {choices.length > 1 ? (
                    <select
                      value={row.unit}
                      onChange={(e) => setItemField(idx, 'unit', e.target.value)}
                      style={{ ...inputStyle, width: 76, padding: '8px 6px' }}
                    >
                      {choices.map((u) => <option key={u} value={u}>{u}</option>)}
                    </select>
                  ) : (
                    <span className="w-[76px] text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      {row.ref ? (choices[0] ?? t('recipes.prep.portion')) : ''}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => removeItem(idx)}
                    disabled={form.items.length === 1}
                    className="rounded-md p-1.5 transition-colors disabled:opacity-30"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        </div>
        <FoodCostPreview form={form} lookup={lookup} />
        <div>
          <label style={labelStyle}>{t('recipes.form.notes')}</label>
          <textarea
            rows={2}
            value={form.notes}
            onChange={setField('notes')}
            placeholder={t('recipes.form.notesPlaceholder')}
            style={{ ...inputStyle, resize: 'none' }}
          />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm transition-colors"
            style={{ border: '1px solid var(--bg-border)', color: 'var(--text-secondary)' }}
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60"
            style={{ background: 'var(--accent)', color: '#000' }}
          >
            {submitting ? t('common.saving') : t('recipes.form.saveRecipe')}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ── Cost detail modal ──────────────────────────────────────────────────────

function CostDetailModal({ recipe, onClose }: { recipe: Recipe; onClose: () => void }) {
  const { t } = useTranslation();
  const fc = recipe.foodCost;
  const rows = [
    { label: t('recipes.detail.ingredientCost'), value: `${fmt(fc.ingredientCost)} €`, bold: false },
    { label: t('recipes.detail.ingredientCostWithWaste'), value: `${fmt(fc.ingredientCostWithWaste)} €`, bold: true },
    { label: t('recipes.detail.foodCostPct'), value: `${fmt(fc.foodCostPercent, 1)} %`, bold: false },
    { label: t('recipes.detail.realCostPct'), value: `${fmt(fc.realCostPercent, 1)} %`, bold: false },
    { label: t('recipes.detail.realProfit'), value: `${fmt(fc.realProfitPerDish)} €`, bold: true },
  ];
  return (
    <Modal title={t('recipes.detail.title', { name: recipe.name })} onClose={onClose}>
      <CostLinesTable lines={recipe.costLines} />
      <div className="space-y-1">
        {rows.map(({ label, value, bold }) => (
          <div key={label} className="flex items-center justify-between py-2" style={{ borderBottom: '1px solid var(--bg-border)' }}>
            <span className="text-sm" style={{ color: bold ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: bold ? 600 : 400 }}>{label}</span>
            <span className="text-sm" style={{ color: bold ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: bold ? 700 : 500 }}>{value}</span>
          </div>
        ))}
        <div className="mt-3 flex items-center justify-between rounded-lg px-3 py-2" style={{ background: 'var(--bg-tertiary)' }}>
          <span className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>RAG</span>
          <span
            className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
            style={{ background: fcBg(fc.foodCostPercent), color: fcColor(fc.foodCostPercent) }}
          >
            {t(`recipes.rag.${fc.ragStatus}`)}
          </span>
        </div>
      </div>
    </Modal>
  );
}

// ── Lignes de coût (ingrédients et préparations) ───────────────────────────

function CostLinesTable({ lines }: { lines: CostLine[] }) {
  const { t } = useTranslation();
  if (lines.length === 0) return null;
  return (
    <div className="mb-4 overflow-hidden rounded-lg" style={{ border: '1px solid var(--bg-border)', background: 'var(--bg-tertiary)' }}>
      {lines.map((l, i) => (
        <div
          key={i}
          className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
          style={{ borderBottom: i < lines.length - 1 ? '1px solid var(--bg-border)' : 'none' }}
        >
          <div className="min-w-0">
            <span style={{ color: 'var(--text-primary)' }}>{l.name}</span>
            {l.kind === 'preparation' && (
              <span className="ml-2 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase" style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}>
                {t('recipes.prep.badge')}
              </span>
            )}
            <span className="ml-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
              {fmt(l.quantity, 3).replace(/,?0+$/, '')} {l.unit ?? t('recipes.prep.portion')}
            </span>
            {l.unitMismatch && (
              <span className="ml-2 text-xs" style={{ color: 'var(--red)' }} title={t('recipes.prep.unitMismatch')}>⚠</span>
            )}
          </div>
          <span className="flex-none font-medium" style={{ color: 'var(--text-secondary)' }}>{fmt(l.cost)} €</span>
        </div>
      ))}
    </div>
  );
}

// ── Delete confirm ─────────────────────────────────────────────────────────

function DeleteModal({ recipe, onConfirm, onCancel }: { recipe: Recipe; onConfirm: () => Promise<void>; onCancel: () => void }) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  async function go() {
    setLoading(true);
    setError('');
    try { await onConfirm(); }
    catch (err: any) { setError(err.response?.data?.message ?? t('common.error')); }
    finally { setLoading(false); }
  }
  return (
    <Modal title={t('common.confirmDelete')} onClose={onCancel}>
      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('recipes.delete.message', { name: recipe.name })}</p>
      {error && (
        <div className="mt-3 rounded-lg px-4 py-2.5 text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--red)' }}>{error}</div>
      )}
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onCancel} className="rounded-lg px-4 py-2 text-sm" style={{ border: '1px solid var(--bg-border)', color: 'var(--text-secondary)' }}>{t('common.cancel')}</button>
        <button onClick={go} disabled={loading} className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60" style={{ background: 'var(--red)', color: '#fff' }}>
          {loading ? t('common.deleting') : t('common.deleteForever')}
        </button>
      </div>
    </Modal>
  );
}

// ── Summary banner ─────────────────────────────────────────────────────────

function SummaryBanner({ recipes }: { recipes: Recipe[] }) {
  const { t } = useTranslation();
  if (recipes.length === 0) return null;
  const rentable = recipes.filter((r) => r.foodCost.isRentable).length;
  const avgFC = recipes.reduce((s, r) => s + r.foodCost.foodCostPercent, 0) / recipes.length;
  const items = [
    { label: t('recipes.summary.avgFoodCost'), value: `${fmt(avgFC, 1)} %`, color: fcColor(avgFC) },
    { label: t('recipes.summary.rentable'), value: `${rentable} / ${recipes.length}`, color: 'var(--text-primary)' },
    { label: t('recipes.summary.rentabilityRate'), value: `${Math.round((rentable / recipes.length) * 100)} %`, color: rentable === recipes.length ? 'var(--green)' : 'var(--amber)' },
    { label: t('recipes.summary.totalProfit'), value: `${fmt(recipes.reduce((s, r) => s + r.foodCost.profitPerDish, 0))} €`, color: 'var(--green)' },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map(({ label, value, color }) => (
        <div key={label} className="rounded-xl px-5 py-4" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--bg-border)' }}>
          <p className="text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>{label}</p>
          <p className="mt-1 text-2xl font-bold tracking-tight" style={{ color }}>{value}</p>
        </div>
      ))}
    </div>
  );
}

// ── Recipe mobile bottomsheet ──────────────────────────────────────────────

function RecipeMobileDetailSheet({ recipe, onEdit, onToggleActive, onClose }: { recipe: Recipe; onEdit: () => void; onToggleActive: () => void; onClose: () => void }) {
  const { t } = useTranslation();
  const fc = recipe.foodCost;
  const itemCosts = recipe.costLines.map((l) => ({
    name: l.name,
    unit: l.unit ?? t('recipes.prep.portion'),
    quantity: Number(l.quantity),
    cost: l.cost,
  }));
  const hasWastage = fc.ingredientCostWithWaste !== fc.ingredientCost;
  const wastageCost = fc.ingredientCostWithWaste - fc.ingredientCost;

  return (
    <>
      <div
        style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.7)' }}
        onClick={onClose}
      />
      <div
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, height: '90vh', zIndex: 10000,
          borderRadius: '24px 24px 0 0', overflowY: 'auto', background: 'var(--bg-secondary)',
          animation: 'slideUp 0.22s ease-out', display: 'flex', flexDirection: 'column',
          border: '1px solid var(--bg-border)',
        }}
      >
        <div style={{ width: 40, height: 4, background: 'var(--bg-border)', borderRadius: 2, margin: '12px auto 8px', flexShrink: 0 }} />
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, padding: '0 20px 12px' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: ragLeftBorder(fc.ragStatus), flexShrink: 0 }} />
              <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{recipe.name}</h2>
            </div>
            {recipe.category && (
              <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2, marginLeft: 20 }}>{recipe.category}</p>
            )}
          </div>
          <button
            onClick={onClose}
            style={{ padding: 8, borderRadius: '50%', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-tertiary)' }}
          >
            <svg viewBox="0 0 20 20" fill="currentColor" width={20} height={20}>
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 8px' }}>
          {itemCosts.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-tertiary)', marginBottom: 8 }}>
                {t('recipes.bottomsheet.ingredients')}
              </p>
              <div style={{ borderRadius: 12, border: '1px solid var(--bg-border)', overflow: 'hidden', background: 'var(--bg-tertiary)' }}>
                {itemCosts.map((item, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 16px',
                      borderBottom: i < itemCosts.length - 1 ? '1px solid var(--bg-border)' : 'none',
                    }}
                  >
                    <div>
                      <span style={{ fontSize: 14, color: 'var(--text-primary)' }}>{item.name}</span>
                      <span style={{ fontSize: 12, color: 'var(--text-tertiary)', marginLeft: 8 }}>{item.quantity} {item.unit}</span>
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)' }}>{fmt(item.cost)} €</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div style={{ marginBottom: 20 }}>
            <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-tertiary)', marginBottom: 8 }}>
              {t('recipes.bottomsheet.costs')}
            </p>
            <div style={{ borderRadius: 12, border: '1px solid var(--bg-border)', overflow: 'hidden', background: 'var(--bg-tertiary)' }}>
              {[
                { label: t('recipes.bottomsheet.ingredientCost'), value: `${fmt(fc.ingredientCost)} €`, type: 'normal' },
                ...(hasWastage ? [{ label: t('recipes.bottomsheet.wastage', { pct: fmt(Number(recipe.wastagePercent ?? 0), 1) }), value: `+${fmt(wastageCost)} €`, type: 'normal' }] : []),
                { label: t('recipes.bottomsheet.totalCost'), value: `${fmt(fc.ingredientCostWithWaste)} €`, type: 'bold' },
                { label: t('recipes.bottomsheet.foodCost'), value: `${fmt(fc.foodCostPercent, 1)} %`, type: 'colored' },
                { label: t('recipes.bottomsheet.profit'), value: `+${fmt(fc.profitPerDish)} €`, type: 'green' },
              ].map(({ label, value, type }, i, arr) => {
                const valueColor =
                  type === 'green' ? 'var(--green)' :
                  type === 'colored' ? fcColor(fc.foodCostPercent) :
                  type === 'bold' ? 'var(--text-primary)' : 'var(--text-secondary)';
                return (
                  <div
                    key={label}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '12px 16px',
                      borderBottom: i < arr.length - 1 ? '1px solid var(--bg-border)' : 'none',
                    }}
                  >
                    <span style={{ fontSize: 14, color: type === 'bold' ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: type === 'bold' ? 600 : 400 }}>
                      {label}
                    </span>
                    <span style={{ fontSize: 14, fontWeight: type === 'bold' || type === 'green' ? 700 : 500, color: valueColor }}>
                      {value}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <div style={{ position: 'sticky', bottom: 0, padding: 16, background: 'var(--bg-secondary)', flexShrink: 0, borderTop: '1px solid var(--bg-border)' }}>
          <button
            onClick={onEdit}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              width: '100%', padding: '14px 16px', borderRadius: 14, border: 'none',
              background: 'var(--accent)', color: '#000', fontSize: 15, fontWeight: 600,
              cursor: 'pointer', minHeight: 52,
            }}
          >
            ✏️ {t('recipes.bottomsheet.edit')}
          </button>
          <button
            onClick={onToggleActive}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              width: '100%', marginTop: 8, padding: '12px 16px', borderRadius: 14,
              border: '1px solid var(--bg-border)', background: 'transparent',
              color: 'var(--text-secondary)', fontSize: 14, fontWeight: 500,
              cursor: 'pointer', minHeight: 46,
            }}
          >
            {recipe.isActive ? t('recipes.active.remove') : t('recipes.active.restore')}
          </button>
        </div>
      </div>
    </>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

type ActiveModal =
  | { type: 'create' }
  | { type: 'edit'; recipe: Recipe }
  | { type: 'delete'; recipe: Recipe }
  | { type: 'detail'; recipe: Recipe }
  | { type: 'mobile-detail'; recipe: Recipe };

function recipeToForm(r: Recipe): RecipeForm {
  return {
    name: r.name,
    category: r.category ?? '',
    sellingPrice: String(Number(r.sellingPrice)),
    prepTimeMinutes: r.prepTimeMinutes != null ? String(r.prepTimeMinutes) : '',
    servings: r.servings != null ? String(r.servings) : '1',
    wastagePercent: r.wastagePercent != null ? String(Number(r.wastagePercent)) : '0',
    notes: r.notes ?? '',
    items: r.items.length
      ? r.items.map((it) => ({
          ref: it.subRecipeId != null ? `p:${it.subRecipeId}` : `i:${it.ingredientId}`,
          quantity: String(Number(it.quantity)),
          unit: defaultUnit(it.unit ?? (it.subRecipe ? prepBaseUnit(it.subRecipe) : it.ingredient?.unit)),
        }))
      : [EMPTY_ROW],
    isPreparation: r.isPreparation,
    yieldQuantity: r.yieldQuantity != null ? String(Number(r.yieldQuantity)) : '',
    yieldUnit: r.yieldUnit ?? 'kg',
  };
}

export function RecipesPage() {
  const { t } = useTranslation();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<ActiveModal | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [view, setView] = useState<'dishes' | 'preparations'>('dishes');

  async function load() {
    try {
      const [rRes, iRes] = await Promise.all([api.get<Recipe[]>('/recipes'), api.get<Ingredient[]>('/ingredients')]);
      setRecipes(rRes.data);
      setIngredients(iRes.data);
    } catch (err: any) {
      setError(err.response?.data?.message ?? t('recipes.loadError'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function buildPayload(form: RecipeForm) {
    return {
      name: form.name,
      category: form.category || undefined,
      sellingPrice: form.isPreparation ? 0 : parseFloat(form.sellingPrice),
      isPreparation: form.isPreparation,
      yieldQuantity: form.isPreparation && form.yieldQuantity ? parseFloat(form.yieldQuantity) : null,
      yieldUnit: form.isPreparation ? form.yieldUnit : null,
      prepTimeMinutes: form.prepTimeMinutes ? parseInt(form.prepTimeMinutes) : undefined,
      servings: form.servings ? parseInt(form.servings) : 1,
      wastagePercent: parseFloat(form.wastagePercent) || 0,
      notes: form.notes || undefined,
      items: form.items.filter((r) => r.ref && r.quantity).map((r) => {
        const [kind, id] = r.ref.split(':');
        return {
          ingredientId: kind === 'i' ? parseInt(id) : null,
          subRecipeId: kind === 'p' ? parseInt(id) : null,
          quantity: parseFloat(r.quantity),
          unit: r.unit || null,
        };
      }),
    };
  }

  async function handleCreate(form: RecipeForm) { await api.post('/recipes', buildPayload(form)); setModal(null); await load(); }
  async function handleEdit(recipe: Recipe, form: RecipeForm) { await api.put(`/recipes/${recipe.id}`, buildPayload(form)); setModal(null); await load(); }
  async function handleDelete(recipe: Recipe) { await api.delete(`/recipes/${recipe.id}`); setModal(null); await load(); }

  async function handleToggleActive(recipe: Recipe) {
    await api.patch(`/recipes/${recipe.id}/active`, { isActive: !recipe.isActive });
    setModal(null);
    await load();
  }

  // Les plats retirés de la carte et les préparations sont exclus des moyennes, comme côté API.
  const dishes = recipes.filter((r) => !r.isPreparation);
  const preparations = recipes.filter((r) => r.isPreparation);
  const activeRecipes = dishes.filter((r) => r.isActive);
  const inactiveCount = dishes.length - activeRecipes.length;
  const isPrepView = view === 'preparations';
  const visibleRecipes = isPrepView ? preparations : showInactive ? dishes : activeRecipes;

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-xl px-6 py-5 text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--red)', border: '1px solid rgba(239,68,68,0.2)' }}>
        {error}
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{t('recipes.title')}</h1>
            <p className="mt-0.5 text-sm" style={{ color: 'var(--text-secondary)' }}>{t('recipes.subtitle', { count: activeRecipes.length })}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg p-0.5" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--bg-border)' }}>
              {(['dishes', 'preparations'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className="rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
                  style={view === v
                    ? { background: 'var(--bg-secondary)', color: 'var(--text-primary)' }
                    : { color: 'var(--text-tertiary)' }}
                >
                  {v === 'dishes' ? t('recipes.prep.tabDishes') : `${t('recipes.prep.tabPreparations')} (${preparations.length})`}
                </button>
              ))}
            </div>
            {!isPrepView && inactiveCount > 0 && (
              <button
                onClick={() => setShowInactive((v) => !v)}
                className="rounded-lg px-3 py-2.5 text-sm font-medium transition-colors"
                style={{ border: '1px solid var(--bg-border)', color: 'var(--text-secondary)' }}
                title={t('recipes.active.excludedHint')}
              >
                {showInactive
                  ? t('recipes.active.hideInactive')
                  : `${t('recipes.active.showInactive')} (${inactiveCount})`}
              </button>
            )}
            <button
              onClick={() => setModal({ type: 'create' })}
              className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium"
              style={{ background: 'var(--accent)', color: '#000' }}
            >
              <span className="text-base leading-none">+</span>
              {isPrepView ? t('recipes.prep.add') : t('recipes.add')}
            </button>
          </div>
        </div>

        {/* Les moyennes ne portent que sur les plats à la carte */}
        {isPrepView ? (
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('recipes.prep.intro')}</p>
        ) : (
          <SummaryBanner recipes={activeRecipes} />
        )}

        {visibleRecipes.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center rounded-xl border-dashed py-16 text-center"
            style={{ border: '2px dashed var(--bg-border)', background: 'var(--bg-secondary)' }}
          >
            <span className="text-4xl">👨‍🍳</span>
            <p className="mt-3 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{t('recipes.empty.title')}</p>
            <p className="mt-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>{t('recipes.empty.desc')}</p>
            <button
              onClick={() => setModal({ type: 'create' })}
              className="mt-4 rounded-lg px-4 py-2 text-sm transition-colors"
              style={{ border: '1px solid var(--bg-border)', color: 'var(--text-secondary)' }}
            >
              {t('recipes.empty.cta')}
            </button>
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="space-y-3 md:hidden">
              {visibleRecipes.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setModal({ type: 'mobile-detail', recipe: r })}
                  className="w-full rounded-xl p-4 text-left transition-colors active:scale-[0.99]"
                  style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--bg-border)',
                    borderLeft: `4px solid ${r.isPreparation ? '#818cf8' : ragLeftBorder(r.foodCost.ragStatus)}`,
                    opacity: r.isActive ? 1 : 0.5,
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="flex-1 font-semibold leading-snug" style={{ color: 'var(--text-primary)' }}>
                      {r.name}
                      {!r.isActive && (
                        <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
                          · {t('recipes.active.offMenu')}
                        </span>
                      )}
                    </p>
                    {r.isPreparation ? (
                      <span className="flex-none text-sm font-semibold" style={{ color: 'var(--accent)' }}>
                        {fmt(Number(r.unitCost ?? 0))} €/{r.unitCostUnit}
                      </span>
                    ) : (
                      <span
                        className="flex-none rounded-full px-2 py-0.5 text-xs font-semibold"
                        style={{ background: fcBg(r.foodCost.foodCostPercent), color: fcColor(r.foodCost.foodCostPercent) }}
                      >
                        {fmt(r.foodCost.foodCostPercent, 1)} %
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    {(r.isPreparation
                      ? [r.category, t('recipes.table.ingredientCount', { count: r.items.length }), t('recipes.prep.usedIn', { count: r.usedIn.length })]
                      : [r.category, t('recipes.table.ingredientCount', { count: r.items.length }), `${fmt(Number(r.sellingPrice))} €`]
                    ).filter(Boolean).join(' · ')}
                  </p>
                  {!r.isPreparation && <p className="mt-2 text-sm font-semibold" style={{ color: 'var(--green)' }}>
                    +{fmt(r.foodCost.profitPerDish)} €{' '}
                    <span className="text-xs font-normal" style={{ color: 'var(--text-tertiary)' }}>
                      {t('recipes.mobile.profitPerDish')}
                    </span>
                  </p>}
                </button>
              ))}
            </div>

            {/* Desktop table */}
            <div
              className="hidden md:block rounded-xl"
              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--bg-border)' }}
            >
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--bg-border)' }}>
                      {(isPrepView
                        ? [t('recipes.table.recipe'), t('recipes.table.category'), t('recipes.prep.unitCost'), t('recipes.prep.yield'), t('recipes.prep.usedInHeader'), t('recipes.table.actions')]
                        : [t('recipes.table.recipe'), t('recipes.table.category'), t('recipes.table.sellingPrice'), t('recipes.table.foodCost'), t('recipes.table.rag'), t('recipes.table.actions')]
                      ).map((h, i) => (
                        <th
                          key={i}
                          className={`px-5 py-3 text-xs font-medium uppercase tracking-wide text-left${i === 2 || i === 3 ? ' text-right' : ''}`}
                          style={{ color: 'var(--text-tertiary)' }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRecipes.map((r) => (
                      <tr
                        key={r.id}
                        className="group transition-colors"
                        style={{ borderBottom: '1px solid var(--bg-border)', opacity: r.isActive ? 1 : 0.5 }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-tertiary)'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                      >
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{r.name}</span>
                            {!r.isActive && (
                              <span
                                className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                                style={{ background: 'var(--bg-tertiary)', color: 'var(--text-tertiary)' }}
                              >
                                {t('recipes.active.offMenu')}
                              </span>
                            )}
                          </div>
                          {r.items.length > 0 && (
                            <div className="mt-0.5 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                              {t('recipes.table.ingredientCount', { count: r.items.length })}
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          {r.category ? (
                            <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                              {r.category}
                            </span>
                          ) : <span style={{ color: 'var(--bg-border)' }}>—</span>}
                        </td>
                        {r.isPreparation ? (
                          <>
                            <td className="px-5 py-3 text-right font-medium" style={{ color: 'var(--accent)' }}>
                              {fmt(Number(r.unitCost ?? 0))} € / {r.unitCostUnit}
                            </td>
                            <td className="px-5 py-3 text-right" style={{ color: 'var(--text-secondary)' }}>
                              {r.yieldQuantity ? `${fmt(Number(r.yieldQuantity), 3).replace(/,?0+$/, '')} ${r.yieldUnit ?? ''}` : '—'}
                            </td>
                            <td className="px-5 py-3 text-xs" style={{ color: 'var(--text-tertiary)' }} title={r.usedIn.map((u) => u.name).join(', ')}>
                              {t('recipes.prep.usedIn', { count: r.usedIn.length })}
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-5 py-3 text-right" style={{ color: 'var(--text-secondary)' }}>
                              {fmt(Number(r.sellingPrice))} €
                            </td>
                            <td className="px-5 py-3 text-right">
                              <span className="rounded-full px-2 py-0.5 text-xs font-semibold" style={{ background: fcBg(r.foodCost.foodCostPercent), color: fcColor(r.foodCost.foodCostPercent) }}>
                                {fmt(r.foodCost.foodCostPercent, 1)} %
                              </span>
                            </td>
                            <td className="px-5 py-3">
                              <div className="h-2 w-2 rounded-full" style={{ background: ragLeftBorder(r.foodCost.ragStatus) }} />
                            </td>
                          </>
                        )}
                        <td className="px-5 py-3">
                          <div className="flex gap-1">
                            <button
                              onClick={() => setModal({ type: 'detail', recipe: r })}
                              className="rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors"
                              style={{ color: 'var(--text-tertiary)' }}
                            >
                              €
                            </button>
                            <button
                              onClick={() => setModal({ type: 'edit', recipe: r })}
                              className="rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors"
                              style={{ color: 'var(--text-secondary)' }}
                            >
                              {t('common.edit')}
                            </button>
                            {!r.isPreparation && (
                              <button
                                onClick={() => handleToggleActive(r)}
                                className="rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors"
                                style={{ color: 'var(--text-tertiary)' }}
                                title={t('recipes.active.excludedHint')}
                              >
                                {r.isActive ? t('recipes.active.remove') : t('recipes.active.restore')}
                              </button>
                            )}
                            <button
                              onClick={() => setModal({ type: 'delete', recipe: r })}
                              className="rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors"
                              style={{ color: 'var(--red)' }}
                            >
                              {t('common.delete')}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {modal?.type === 'create' && (
        <RecipeFormModal
          title={isPrepView ? t('recipes.prep.createTitle') : t('recipes.form.createTitle')}
          initial={isPrepView ? EMPTY_PREP_FORM : EMPTY_FORM}
          ingredients={ingredients}
          preparations={preparations}
          onSave={handleCreate}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === 'edit' && (
        <RecipeFormModal
          title={t('recipes.form.editTitle', { name: modal.recipe.name })}
          initial={recipeToForm(modal.recipe)}
          ingredients={ingredients}
          preparations={preparations}
          editingId={modal.recipe.id}
          onSave={(form) => handleEdit(modal.recipe, form)}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === 'delete' && (
        <DeleteModal recipe={modal.recipe} onConfirm={() => handleDelete(modal.recipe)} onCancel={() => setModal(null)} />
      )}
      {modal?.type === 'detail' && (
        <CostDetailModal recipe={modal.recipe} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'mobile-detail' && (
        <RecipeMobileDetailSheet recipe={modal.recipe} onEdit={() => { const r = modal.recipe; setModal({ type: 'edit', recipe: r }); }} onToggleActive={() => handleToggleActive(modal.recipe)} onClose={() => setModal(null)} />
      )}
    </>
  );
}
