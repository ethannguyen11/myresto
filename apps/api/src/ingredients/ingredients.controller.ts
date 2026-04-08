import {
  Controller, Get, Post, Put, Delete,
  Body, Param, ParseIntPipe, Request, UseGuards
} from '@nestjs/common'
import { IngredientsService } from './ingredients.service'
import { CreateIngredientDto } from './dto/create-ingredient.dto'
import { UpdateIngredientDto } from './dto/update-ingredient.dto'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'

@UseGuards(JwtAuthGuard)
@Controller('ingredients')
export class IngredientsController {
  constructor(private ingredientsService: IngredientsService) {}

  @Get()
  findAll(@Request() req) {
    return this.ingredientsService.findAll(req.user.sub)
  }

  // Doit être avant @Get(':id') pour ne pas intercepter "order-sheet" comme un ID
  @Get('order-sheet')
  getOrderSheet(@Request() req) {
    return this.ingredientsService.getOrderSheet(req.user.sub)
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.ingredientsService.findOne(id, req.user.sub)
  }

  @Post()
  create(@Body() dto: CreateIngredientDto, @Request() req) {
    return this.ingredientsService.create(req.user.sub, dto)
  }

  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateIngredientDto,
    @Request() req,
  ) {
    return this.ingredientsService.update(id, req.user.sub, dto)
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.ingredientsService.remove(id, req.user.sub)
  }

  @Get(':id/price-history')
  getPriceHistory(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.ingredientsService.getPriceHistory(id, req.user.sub)
  }
}