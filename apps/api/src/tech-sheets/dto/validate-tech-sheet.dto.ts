export class ValidateTechSheetDto {
  name: string
  category?: string
  servings?: number
  prepTime?: number
  cookTime?: number
  difficulty?: string
  ingredients?: Array<{ name: string; quantity: string; unit?: string }>
  steps?: string[]
  presentation?: string
  tips?: string
}
