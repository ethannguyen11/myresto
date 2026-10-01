import { areCompatible, conversionFactor, normalizeUnit } from './units'

describe('units', () => {
  it('normalise les écritures courantes', () => {
    expect(normalizeUnit('Kg')).toBe('kg')
    expect(normalizeUnit('grammes')).toBe('g')
    expect(normalizeUnit('Litre')).toBe('l')
    expect(normalizeUnit('pièce')).toBe('piece')
    expect(normalizeUnit('pcs')).toBe('piece')
    expect(normalizeUnit('  ')).toBeNull()
  })

  it('convertit dans une même dimension', () => {
    expect(conversionFactor('g', 'kg')).toBeCloseTo(0.001)
    expect(conversionFactor('kg', 'g')).toBeCloseTo(1000)
    expect(conversionFactor('cl', 'L')).toBeCloseTo(0.01)
    expect(conversionFactor('douzaine', 'pièce')).toBe(12)
    expect(conversionFactor('kg', 'kg')).toBe(1)
  })

  it('refuse les conversions entre dimensions', () => {
    expect(conversionFactor('kg', 'L')).toBeNull()
    expect(conversionFactor('pièce', 'kg')).toBeNull()
    expect(areCompatible('g', 'cl')).toBe(false)
  })

  it('accepte des unités inconnues seulement si elles sont identiques', () => {
    expect(conversionFactor('colis', 'colis')).toBe(1)
    expect(conversionFactor('colis', 'kg')).toBeNull()
  })
})
