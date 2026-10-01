import { useTranslation } from 'react-i18next';

export interface PriceImpactRow {
  recipeId: number;
  name: string;
  isPreparation: boolean;
  isActive: boolean;
  sellingPrice: number;
  costBefore: number;
  costAfter: number;
  foodCostBefore: number;
  foodCostAfter: number;
  suggestedPrice: number | null;
}

function fmt(n: number, dec = 2): string { return n.toFixed(dec).replace('.', ','); }

function fcColor(pct: number): string {
  if (pct <= 25) return 'var(--green)';
  if (pct <= 30) return 'var(--amber)';
  if (pct <= 35) return '#f97316';
  return 'var(--red)';
}

/**
 * Effet d'un changement de prix sur les plats : food cost avant → après et
 * prix de vente qui ramène le food cost à son niveau d'avant.
 * Les préparations sont listées à part, avec leur coût unitaire.
 */
export function PriceImpactTable({ rows }: { rows: PriceImpactRow[] }) {
  const { t } = useTranslation();
  const dishes = rows.filter((r) => !r.isPreparation);
  const preps = rows.filter((r) => r.isPreparation);

  if (rows.length === 0) {
    return <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>{t('impact.none')}</p>;
  }

  return (
    <div className="space-y-3">
      {dishes.length > 0 && (
        <div className="overflow-x-auto rounded-lg" style={{ border: '1px solid var(--bg-border)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--bg-tertiary)', color: 'var(--text-tertiary)' }}>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase">{t('impact.dish')}</th>
                <th className="px-3 py-2 text-right text-xs font-medium uppercase">{t('impact.cost')}</th>
                <th className="px-3 py-2 text-right text-xs font-medium uppercase">{t('impact.foodCost')}</th>
                <th className="px-3 py-2 text-right text-xs font-medium uppercase">{t('impact.price')}</th>
              </tr>
            </thead>
            <tbody>
              {dishes.map((r) => {
                const up = r.foodCostAfter > r.foodCostBefore;
                const priceDelta = r.suggestedPrice != null ? r.suggestedPrice - r.sellingPrice : 0;
                return (
                  <tr key={r.recipeId} style={{ borderTop: '1px solid var(--bg-border)', opacity: r.isActive ? 1 : 0.55 }}>
                    <td className="px-3 py-2" style={{ color: 'var(--text-primary)' }}>
                      {r.name}
                      {!r.isActive && <span className="ml-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>· {t('impact.offMenu')}</span>}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right" style={{ color: 'var(--text-secondary)' }}>
                      {fmt(r.costBefore)} → <b style={{ color: 'var(--text-primary)' }}>{fmt(r.costAfter)} €</b>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right">
                      <span style={{ color: 'var(--text-tertiary)' }}>{fmt(r.foodCostBefore, 1)} %</span>
                      {' → '}
                      <b style={{ color: fcColor(r.foodCostAfter) }}>{fmt(r.foodCostAfter, 1)} %</b>
                      <span className="ml-1 text-xs" style={{ color: up ? 'var(--red)' : 'var(--green)' }}>{up ? '▲' : '▼'}</span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right">
                      {r.suggestedPrice != null && up && priceDelta > 0.001 ? (
                        <span title={t('impact.suggestedHint', { pct: fmt(r.foodCostBefore, 1) })}>
                          <span style={{ color: 'var(--text-tertiary)' }}>{fmt(r.sellingPrice)} → </span>
                          <b style={{ color: 'var(--accent)' }}>{fmt(r.suggestedPrice)} €</b>
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-tertiary)' }}>{fmt(r.sellingPrice)} €</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {preps.length > 0 && (
        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          {t('impact.preparations')}{' '}
          {preps.map((p) => `${p.name} (${fmt(p.costBefore)} → ${fmt(p.costAfter)} €)`).join(' · ')}
        </p>
      )}
      {dishes.some((r) => r.suggestedPrice != null && r.foodCostAfter > r.foodCostBefore) && (
        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{t('impact.footnote')}</p>
      )}
    </div>
  );
}
