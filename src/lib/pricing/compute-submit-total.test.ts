import { describe, it, expect } from 'vitest'
import { computeSubmitTotal, type SubmitPricingInput } from './compute-submit-total'

const cat = { regularPrice: 800_000, memberPrice: 650_000 }
const menu = { price: 150_000, name: 'Paket A' }

describe('computeSubmitTotal', () => {
  it('single non-member holder, no menu', () => {
    const input: SubmitPricingInput = {
      holders: [{ memberValidation: 'invalid', category: cat }],
    }
    const result = computeSubmitTotal(input)
    expect(result.grandTotal).toBe(800_000)
    expect(result.lines[0].ticketPrice).toBe(800_000)
    expect(result.lines[0].isMember).toBe(false)
  })

  it('single member holder (valid)', () => {
    const input: SubmitPricingInput = {
      holders: [{ memberValidation: 'valid', category: cat }],
    }
    const result = computeSubmitTotal(input)
    expect(result.grandTotal).toBe(650_000)
    expect(result.lines[0].isMember).toBe(true)
  })

  it('overridden validation counts as member', () => {
    const input: SubmitPricingInput = {
      holders: [{ memberValidation: 'overridden', category: cat }],
    }
    expect(computeSubmitTotal(input).lines[0].isMember).toBe(true)
  })

  it('unknown validation counts as non-member', () => {
    const input: SubmitPricingInput = {
      holders: [{ memberValidation: 'unknown', category: cat }],
    }
    expect(computeSubmitTotal(input).lines[0].isMember).toBe(false)
  })

  it('two holders — member + non-member', () => {
    const input: SubmitPricingInput = {
      holders: [
        { memberValidation: 'valid', category: cat },
        { memberValidation: 'invalid', category: cat },
      ],
    }
    const result = computeSubmitTotal(input)
    expect(result.grandTotal).toBe(650_000 + 800_000)
    expect(result.lines).toHaveLength(2)
  })

  it('menu price stored separately, not added to grandTotal', () => {
    const input: SubmitPricingInput = {
      holders: [{ memberValidation: 'invalid', category: cat, menuItem: menu }],
    }
    const result = computeSubmitTotal(input)
    // grandTotal is ticket only
    expect(result.grandTotal).toBe(800_000)
    expect(result.lines[0].menuPrice).toBe(150_000)
  })

  it('empty holders returns zero total', () => {
    const result = computeSubmitTotal({ holders: [] })
    expect(result.grandTotal).toBe(0)
    expect(result.lines).toHaveLength(0)
  })
})
