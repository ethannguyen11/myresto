import {
  Controller, Get, Post, Put, Patch, Delete,
  Body, Param, Query, ParseIntPipe, Request, UseGuards, BadRequestException
} from '@nestjs/common'
import { RecipesService } from './recipes.service'
import { CreateRecipeDto } from './dto/create-recipe.dto'
import { UpdateRecipeDto } from './dto/update-recipe.dto'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'

@UseGuards(JwtAuthGuard)
@Controller('recipes')
export class RecipesController {
  constructor(private recipesService: RecipesService) {}

  // ?activeOnly=true pour n'obtenir que les plats actuellement à la carte
  @Get()
  findAll(@Request() req, @Query('activeOnly') activeOnly?: string) {
    return this.recipesService.findAll(req.user.sub, activeOnly === 'true')
  }

  @Get('analysis')
  getMenuAnalysis(@Request() req) {
    return this.recipesService.getMenuAnalysis(req.user.sub)
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.recipesService.findOne(id, req.user.sub)
  }

  @Post()
  create(@Body() dto: CreateRecipeDto, @Request() req) {
    return this.recipesService.create(req.user.sub, dto)
  }

  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRecipeDto,
    @Request() req,
  ) {
    return this.recipesService.update(id, req.user.sub, dto)
  }

  // Retire le plat de la carte sans le supprimer (saisonnalité)
  @Patch(':id/active')
  setActive(
    @Param('id', ParseIntPipe) id: number,
    @Body('isActive') isActive: unknown,
    @Request() req,
  ) {
    // Sans ValidationPipe global, on vérifie ici : un `undefined` silencieux
    // désactiverait le plat au lieu de renvoyer une erreur.
    if (typeof isActive !== 'boolean') {
      throw new BadRequestException('Le champ "isActive" doit être un booléen.')
    }
    return this.recipesService.setActive(id, req.user.sub, isActive)
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.recipesService.remove(id, req.user.sub)
  }
}