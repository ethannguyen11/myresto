export class ValidateItemDto {
  itemId: number
  // Permet à l'utilisateur de corriger le match IA (null pour dissocier)
  ingredientId?: number | null
  // Unités d'ingrédient contenues dans 1 unité de la facture (1 colis = 5 kg → 5)
  conversionFactor?: number | null
}

export class ValidateItemsDto {
  items: ValidateItemDto[]
}
