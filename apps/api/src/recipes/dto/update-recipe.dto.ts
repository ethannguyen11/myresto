import { RecipeItemDto } from './create-recipe.dto'

export class UpdateRecipeDto {
  name?: string
  category?: string
  sellingPrice?: number
  vatRate?: number
  notes?: string
  prepTimeMinutes?: number
  servings?: number
  wastagePercent?: number
  isActive?: boolean
  isPreparation?: boolean
  yieldQuantity?: number | null
  yieldUnit?: string | null
  items?: RecipeItemDto[]
}
