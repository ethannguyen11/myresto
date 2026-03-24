import { RecipeItemDto } from './create-recipe.dto'

export class UpdateRecipeDto {
  name?: string
  category?: string
  sellingPrice?: number
  vatRate?: number
  notes?: string
  items?: RecipeItemDto[]
}