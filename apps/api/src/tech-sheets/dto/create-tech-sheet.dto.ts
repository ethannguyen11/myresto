export class CreateTechSheetDto {
  name: string
  category?: string
  recipeId?: number
  servings?: number
  prepTime?: number
  cookTime?: number
  difficulty?: string
  ingredients?: string   // JSON
  steps?: string         // JSON
  presentation?: string
  tips?: string
}
