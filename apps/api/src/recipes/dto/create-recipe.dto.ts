export class RecipeItemDto {
  ingredientId: number
  quantity: number
  notes?: string
}

export class CreateRecipeDto {
  name: string
  category?: string
  sellingPrice: number
  vatRate?: number
  notes?: string
  prepTimeMinutes?: number
  servings?: number
  wastagePercent?: number
  items: RecipeItemDto[]
}