export class ValidateItemDto {
  itemId: number
  // Permet à l'utilisateur de corriger le match IA (null pour dissocier)
  ingredientId?: number | null
}

export class ValidateItemsDto {
  items: ValidateItemDto[]
}
