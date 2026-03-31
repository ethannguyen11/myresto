import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';

// ── Types ──────────────────────────────────────────────────────────────────

interface Ingredient {
  id: number;
  name: string;
  unit: string;
  currentPrice: number;
}

interface RecipeItem {
  id: number;
  ingredientId: number;
  quantity: number;
  ingredient: Ingredient;
}

interface FoodCost {
  totalCost: number;
  sellingPrice: number;
  foodCostPercent: number;
  profitPerDish: number;
  isRentable: boolean;
  status: string;
}

interface Recipe {
  id: number;
  name: string;
  category: string | null;
  sellingPrice: number;
  notes: string | null;
  items: RecipeItem[];
  foodCost: FoodCost;
}

// Form types
interface ItemRow {
  ingredientId: string;
  quantity: string;
}

interface RecipeForm {
  name: string;
  category: string;
  sellingPrice: string;
  notes: string;
  items: ItemRow[];
}

const EMPTY_FORM: RecipeForm = {
  name: '',
  category: '',
  sellingPrice: '',
  notes: '',
  items: [{ ingredientId: '', quantity: '' }],
};

// ── Helpers ────────────────────────────────────────────────────────────────

function fmt(n: number, dec = 2): string {
  return n.toFixed(dec).replace('.', ',');
}

function foodCostBadgeCls(pct: number): string {
  if (pct <= 25) return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200';
  if (pct <= 30) return 'bg-amber-50 text-amber-700 ring-1 ring-amber-200';
  if (pct <= 35) return 'bg-orange-50 text-orange-700 ring-1 ring-orange-200';
  return 'bg-red-50 text-red-700 ring-1 ring-red-200';
}

function foodCostTextCls(pct: number): string {
  if (pct <= 25) return 'text-emerald-600';
  if (pct <= 30) return 'text-amber-500';
  if (pct <= 35) return 'text-orange-500';
  return 'text-red-500';
}

/** Recalculate food cost locally using ingredient prices — mirrors server logic */
function calcFoodCost(
  items: ItemRow[],
  sellingPriceStr: string,
  ingredientMap: Map<number, Ingredient>,
): { totalCost: number; foodCostPct: number; profit: number } | null {
  const selling = parseFloat(sellingPriceStr);
  if (!selling || selling <= 0) return null;

  let totalCost = 0;
  for (const row of items) {
    const ing = ingredientMap.get(parseInt(row.ingredientId));
    const qty = parseFloat(row.quantity);
    if (!ing || !qty || qty <= 0) continue;
    totalCost += Number(ing.currentPrice) * qty;
  }

  const pct = (totalCost / selling) * 100;
  return {
    totalCost: Math.round(totalCost * 100) / 100,
    foodCostPct: Math.round(pct * 100) / 100,
    profit: Math.round((selling - totalCost) * 100) / 100,
  };
}

// ── Modal shell ────────────────────────────────────────────────────────────

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
      <div className={`w-full ${wide ? 'max-w-2xl' : 'max-w-md'} rounded-2xl border border-stone-200 bg-white shadow-xl`}>
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

// ── Live food cost preview ─────────────────────────────────────────────────

function FoodCostPreview({
  form,
  ingredientMap,
}: {
  form: RecipeForm;
  ingredientMap: Map<number, Ingredient>;
}) {
  const result = calcFoodCost(form.items, form.sellingPrice, ingredientMap);
  if (!result) return null;

  const { totalCost, foodCostPct, profit } = result;

  return (
    <div
      className={`flex items-center gap-4 rounded-xl border px-4 py-3 text-sm ${
        foodCostPct <= 25
          ? 'border-emerald-200 bg-emerald-50'
          : foodCostPct <= 30
            ? 'border-amber-200 bg-amber-50'
            : 'border-red-200 bg-red-50'
      }`}
    >
      <div className="flex-1">
        <p className="text-xs font-medium text-stone-500">Coût ingrédients</p>
        <p className="font-semibold text-stone-800">{fmt(totalCost)} €</p>
      </div>
      <div className="flex-1">
        <p className="text-xs font-medium text-stone-500">Food cost</p>
        <p className={`font-semibold ${foodCostTextCls(foodCostPct)}`}>
          {fmt(foodCostPct, 1)} %
        </p>
      </div>
      <div className="flex-1">
        <p className="text-xs font-medium text-stone-500">Marge / plat</p>
        <p className={`font-semibold ${foodCostTextCls(foodCostPct)}`}>
          {fmt(profit)} €
        </p>
      </div>
    </div>
  );
}

// ── Recipe form ────────────────────────────────────────────────────────────

function RecipeFormModal({
  initial,
  ingredients,
  title,
  onSave,
  onClose,
}: {
  initial: RecipeForm;
  ingredients: Ingredient[];
  title: string;
  onSave: (form: RecipeForm) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<RecipeForm>(initial);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const ingredientMap = new Map(ingredients.map((i) => [i.id, i]));

  function setField(key: keyof Omit<RecipeForm, 'items'>) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));
  }

  function setItemField(idx: number, key: keyof ItemRow, value: string) {
    setForm((f) => {
      const items = [...f.items];
      items[idx] = { ...items[idx], [key]: value };
      return { ...f, items };
    });
  }

  function addItem() {
    setForm((f) => ({ ...f, items: [...f.items, { ingredientId: '', quantity: '' }] }));
  }

  function removeItem(idx: number) {
    setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    // Validate at least one complete item
    const validItems = form.items.filter((r) => r.ingredientId && r.quantity);
    if (validItems.length === 0) {
      setError('Ajoutez au moins un ingrédient avec une quantité.');
      return;
    }
    setSubmitting(true);
    try {
      await onSave({ ...form, items: validItems });
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Une erreur est survenue.');
    } finally {
      setSubmitting(false);
    }
  }

  const inputCls =
    'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 ' +
    'placeholder:text-stone-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20';
  const labelCls = 'mb-1.5 block text-xs font-medium text-stone-600';

  return (
    <Modal title={title} wide onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</div>
        )}

        {/* Recette info */}
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className={labelCls}>Nom de la recette *</label>
            <input
              className={inputCls}
              required
              value={form.name}
              onChange={setField('name')}
              placeholder="ex. Magret de canard, sauce aux cerises"
            />
          </div>
          <div>
            <label className={labelCls}>Catégorie</label>
            <input
              className={inputCls}
              value={form.category}
              onChange={setField('category')}
              placeholder="Entrée, Plat, Dessert…"
            />
          </div>
          <div>
            <label className={labelCls}>Prix de vente TTC (€) *</label>
            <input
              className={inputCls}
              required
              type="number"
              min="0"
              step="0.01"
              value={form.sellingPrice}
              onChange={setField('sellingPrice')}
              placeholder="0,00"
            />
          </div>
        </div>

        {/* Ingrédients */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className={labelCls + ' mb-0'}>Ingrédients *</label>
            <button
              type="button"
              onClick={addItem}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-emerald-600 transition-colors hover:bg-emerald-50"
            >
              <span>+</span> Ajouter
            </button>
          </div>

          <div className="space-y-2">
            {form.items.map((row, idx) => (
              <div key={idx} className="flex items-center gap-2">
                {/* Ingredient select */}
                <select
                  value={row.ingredientId}
                  onChange={(e) => setItemField(idx, 'ingredientId', e.target.value)}
                  className="flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                >
                  <option value="">— Choisir un ingrédient —</option>
                  {ingredients.map((ing) => (
                    <option key={ing.id} value={ing.id}>
                      {ing.name} ({ing.unit}) — {fmt(Number(ing.currentPrice))} €
                    </option>
                  ))}
                </select>

                {/* Quantity */}
                <input
                  type="number"
                  min="0"
                  step="0.001"
                  value={row.quantity}
                  onChange={(e) => setItemField(idx, 'quantity', e.target.value)}
                  placeholder="Qté"
                  className="w-24 rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />

                {/* Unit label */}
                <span className="w-10 text-xs text-stone-400">
                  {ingredientMap.get(parseInt(row.ingredientId))?.unit ?? ''}
                </span>

                {/* Remove */}
                <button
                  type="button"
                  onClick={() => removeItem(idx)}
                  disabled={form.items.length === 1}
                  className="rounded-md p-1.5 text-stone-300 transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-30"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Live food cost preview */}
        <FoodCostPreview form={form} ingredientMap={ingredientMap} />

        {/* Notes */}
        <div>
          <label className={labelCls}>Notes (facultatif)</label>
          <textarea
            rows={2}
            value={form.notes}
            onChange={setField('notes')}
            placeholder="Conseils de préparation, allergènes…"
            className={inputCls + ' resize-none'}
          />
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-stone-200 px-4 py-2 text-sm text-stone-600 transition-colors hover:bg-stone-50"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
          >
            {submitting ? 'Enregistrement…' : 'Enregistrer la recette'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ── Delete confirm ─────────────────────────────────────────────────────────

function DeleteModal({
  recipe,
  onConfirm,
  onCancel,
}: {
  recipe: Recipe;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}) {
  const [loading, setLoading] = useState(false);
  async function go() {
    setLoading(true);
    try { await onConfirm(); } finally { setLoading(false); }
  }
  return (
    <Modal title="Confirmer la suppression" onClose={onCancel}>
      <p className="text-sm text-stone-600">
        Supprimer la recette{' '}
        <span className="font-semibold text-stone-900">{recipe.name}</span> ? Cette action est
        irréversible.
      </p>
      <div className="mt-5 flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="rounded-lg border border-stone-200 px-4 py-2 text-sm text-stone-600 transition-colors hover:bg-stone-50"
        >
          Annuler
        </button>
        <button
          onClick={go}
          disabled={loading}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-60"
        >
          {loading ? 'Suppression…' : 'Supprimer définitivement'}
        </button>
      </div>
    </Modal>
  );
}

// ── Summary banner ─────────────────────────────────────────────────────────

function SummaryBanner({ recipes }: { recipes: Recipe[] }) {
  if (recipes.length === 0) return null;

  const rentable = recipes.filter((r) => r.foodCost.isRentable).length;
  const avgFC =
    recipes.reduce((s, r) => s + r.foodCost.foodCostPercent, 0) / recipes.length;
  const avgFCRounded = Math.round(avgFC * 10) / 10;

  const fcCls =
    avgFC <= 25
      ? 'text-emerald-600'
      : avgFC <= 30
        ? 'text-amber-500'
        : 'text-red-500';

  const items = [
    { label: 'Food cost moyen', value: `${fmt(avgFCRounded, 1)} %`, cls: fcCls },
    { label: 'Recettes rentables', value: `${rentable} / ${recipes.length}`, cls: 'text-stone-800' },
    {
      label: 'Taux de rentabilité',
      value: `${Math.round((rentable / recipes.length) * 100)} %`,
      cls: rentable === recipes.length ? 'text-emerald-600' : 'text-amber-500',
    },
    {
      label: 'Profit total / service',
      value: `${fmt(recipes.reduce((s, r) => s + r.foodCost.profitPerDish, 0))} €`,
      cls: 'text-emerald-600',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map(({ label, value, cls }) => (
        <div key={label} className="rounded-xl border border-stone-200 bg-white px-5 py-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-stone-400">{label}</p>
          <p className={`mt-1 text-2xl font-semibold tracking-tight ${cls}`}>{value}</p>
        </div>
      ))}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

type ActiveModal =
  | { type: 'create' }
  | { type: 'edit'; recipe: Recipe }
  | { type: 'delete'; recipe: Recipe };

function recipeToForm(r: Recipe): RecipeForm {
  return {
    name: r.name,
    category: r.category ?? '',
    sellingPrice: String(Number(r.sellingPrice)),
    notes: r.notes ?? '',
    items: r.items.length
      ? r.items.map((it) => ({
          ingredientId: String(it.ingredientId),
          quantity: String(Number(it.quantity)),
        }))
      : [{ ingredientId: '', quantity: '' }],
  };
}

export function RecipesPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<ActiveModal | null>(null);

  async function load() {
    try {
      const [rRes, iRes] = await Promise.all([
        api.get<Recipe[]>('/recipes'),
        api.get<Ingredient[]>('/ingredients'),
      ]);
      setRecipes(rRes.data);
      setIngredients(iRes.data);
    } catch (err: any) {
      console.error('[RecipesPage] load', err);
      setError(err.response?.data?.message ?? 'Impossible de charger les recettes.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function buildPayload(form: RecipeForm) {
    return {
      name: form.name,
      category: form.category || undefined,
      sellingPrice: parseFloat(form.sellingPrice),
      notes: form.notes || undefined,
      items: form.items
        .filter((r) => r.ingredientId && r.quantity)
        .map((r) => ({
          ingredientId: parseInt(r.ingredientId),
          quantity: parseFloat(r.quantity),
        })),
    };
  }

  async function handleCreate(form: RecipeForm) {
    await api.post('/recipes', buildPayload(form));
    setModal(null);
    await load();
  }

  async function handleEdit(recipe: Recipe, form: RecipeForm) {
    await api.put(`/recipes/${recipe.id}`, buildPayload(form));
    setModal(null);
    await load();
  }

  async function handleDelete(recipe: Recipe) {
    await api.delete(`/recipes/${recipe.id}`);
    setModal(null);
    await load();
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-5 text-sm text-red-700">
        {error}
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-stone-900">Recettes</h1>
            <p className="mt-0.5 text-sm text-stone-500">
              {recipes.length} recette{recipes.length !== 1 ? 's' : ''} sur la carte
            </p>
          </div>
          <button
            onClick={() => setModal({ type: 'create' })}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
          >
            <span className="text-base leading-none">+</span>
            Nouvelle recette
          </button>
        </div>

        {/* Summary KPIs */}
        <SummaryBanner recipes={recipes} />

        {/* Table / empty state */}
        {recipes.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-stone-300 bg-white py-16 text-center">
            <span className="text-4xl">👨‍🍳</span>
            <p className="mt-3 text-sm font-medium text-stone-700">Aucune recette</p>
            <p className="mt-1 text-xs text-stone-400">
              Créez votre première recette pour calculer votre food cost.
            </p>
            <button
              onClick={() => setModal({ type: 'create' })}
              className="mt-4 rounded-lg border border-stone-200 px-4 py-2 text-sm text-stone-600 transition-colors hover:bg-stone-50"
            >
              Créer une recette
            </button>
          </div>
        ) : (
          <div className="rounded-xl border border-stone-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-100 bg-stone-50 text-left text-xs font-medium uppercase tracking-wide text-stone-400">
                    <th className="px-5 py-3">Recette</th>
                    <th className="px-5 py-3">Catégorie</th>
                    <th className="px-5 py-3 text-right">Prix vente</th>
                    <th className="px-5 py-3 text-right">Coût total</th>
                    <th className="px-5 py-3 text-right">Food cost</th>
                    <th className="px-5 py-3 text-right">Marge / plat</th>
                    <th className="px-5 py-3">Statut</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {recipes.map((r) => (
                    <tr key={r.id} className="group hover:bg-stone-50">
                      <td className="px-5 py-3">
                        <div className="font-medium text-stone-800">{r.name}</div>
                        {r.items.length > 0 && (
                          <div className="mt-0.5 text-xs text-stone-400">
                            {r.items.length} ingrédient{r.items.length !== 1 ? 's' : ''}
                          </div>
                        )}
                      </td>

                      <td className="px-5 py-3">
                        {r.category ? (
                          <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600">
                            {r.category}
                          </span>
                        ) : (
                          <span className="text-stone-300">—</span>
                        )}
                      </td>

                      <td className="px-5 py-3 text-right text-stone-700">
                        {fmt(Number(r.sellingPrice))} €
                      </td>

                      <td className="px-5 py-3 text-right text-stone-600">
                        {fmt(r.foodCost.totalCost)} €
                      </td>

                      <td className="px-5 py-3 text-right">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${foodCostBadgeCls(r.foodCost.foodCostPercent)}`}>
                          {fmt(r.foodCost.foodCostPercent, 1)} %
                        </span>
                      </td>

                      <td className={`px-5 py-3 text-right font-semibold ${foodCostTextCls(r.foodCost.foodCostPercent)}`}>
                        {fmt(r.foodCost.profitPerDish)} €
                      </td>

                      <td className="px-5 py-3 text-xs">
                        {r.foodCost.status}
                      </td>

                      <td className="px-5 py-3">
                        <div className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                          <button
                            onClick={() => setModal({ type: 'edit', recipe: r })}
                            className="rounded-md px-2.5 py-1.5 text-xs font-medium text-stone-600 transition-colors hover:bg-stone-100"
                          >
                            Modifier
                          </button>
                          <button
                            onClick={() => setModal({ type: 'delete', recipe: r })}
                            className="rounded-md px-2.5 py-1.5 text-xs font-medium text-red-500 transition-colors hover:bg-red-50"
                          >
                            Supprimer
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      {modal?.type === 'create' && (
        <RecipeFormModal
          title="Nouvelle recette"
          initial={EMPTY_FORM}
          ingredients={ingredients}
          onSave={handleCreate}
          onClose={() => setModal(null)}
        />
      )}

      {modal?.type === 'edit' && (
        <RecipeFormModal
          title={`Modifier — ${modal.recipe.name}`}
          initial={recipeToForm(modal.recipe)}
          ingredients={ingredients}
          onSave={(form) => handleEdit(modal.recipe, form)}
          onClose={() => setModal(null)}
        />
      )}

      {modal?.type === 'delete' && (
        <DeleteModal
          recipe={modal.recipe}
          onConfirm={() => handleDelete(modal.recipe)}
          onCancel={() => setModal(null)}
        />
      )}
    </>
  );
}
