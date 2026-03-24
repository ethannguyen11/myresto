import {
  Controller, Get, Post, Put, Delete,
  Body, Param, ParseIntPipe, Request, UseGuards
} from '@nestjs/common'
import { RecipesService } from './recipes.service'
import { CreateRecipeDto } from './dto/create-recipe.dto'
import { UpdateRecipeDto } from './dto/update-recipe.dto'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'

@UseGuards(JwtAuthGuard)
@Controller('recipes')
export class RecipesController {
  constructor(private recipesService: RecipesService) {}

  @Get()
  findAll(@Request() req) {
    return this.recipesService.findAll(req.user.sub)
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

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.recipesService.remove(id, req.user.sub)
  }
}