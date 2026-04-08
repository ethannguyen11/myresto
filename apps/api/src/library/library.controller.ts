import { Body, Controller, Get, Post, Query, Request, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { LibraryService } from './library.service'

class ImportDto {
  indices: number[]
}

@UseGuards(JwtAuthGuard)
@Controller('library')
export class LibraryController {
  constructor(private readonly libraryService: LibraryService) {}

  @Get('ingredients')
  search(
    @Query('search') search?: string,
    @Query('category') category?: string,
  ) {
    return this.libraryService.search(search, category)
  }

  @Get('categories')
  categories() {
    return this.libraryService.getCategories()
  }

  @Post('import')
  import(@Body() dto: ImportDto, @Request() req: any) {
    return this.libraryService.importIngredients(req.user.sub, dto.indices)
  }
}
