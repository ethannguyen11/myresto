export class RecipeItemDto {
  // Exactement l'un des deux : un ingrédient ou une préparation (sous-recette)
  ingredientId?: number | null
  subRecipeId?: number | null
  quantity: number
  // Unité de la quantité ; absente = unité de l'ingrédient / de rendement
  unit?: string | null
  notes?: string
}

export class CreateRecipeDto {
  name: string
  category?: string
  // Facultatif pour une préparation, qui n'est pas vendue seule
  sellingPrice?: number
  vatRate?: number
  notes?: string
  prepTimeMinutes?: number
  servings?: number
  wastagePercent?: number
  isPreparation?: boolean
  yieldQuantity?: number | null
  yieldUnit?: string | null
  items: RecipeItemDto[]
}
