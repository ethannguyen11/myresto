import { Test, TestingModule } from '@nestjs/testing'
import { IngredientsController } from './ingredients.controller'
import { IngredientsService } from './ingredients.service'

describe('IngredientsController', () => {
  let controller: IngredientsController
  let service: { findAll: jest.Mock; findOne: jest.Mock; getOrderSheet: jest.Mock }

  const req = { user: { sub: 7 } }

  beforeEach(async () => {
    service = {
      findAll: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue({ id: 1 }),
      getOrderSheet: jest.fn().mockResolvedValue({ categories: [] }),
    }

    const module: TestingModule = await Test.createTestingModule({
      controllers: [IngredientsController],
      providers: [{ provide: IngredientsService, useValue: service }],
    }).compile()

    controller = module.get<IngredientsController>(IngredientsController)
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })

  it("transmet l'identifiant utilisateur issu du JWT", async () => {
    await controller.findAll(req)
    expect(service.findAll).toHaveBeenCalledWith(7)
  })

  it('route "order-sheet" vers le bon service et non vers findOne', async () => {
    // La route est déclarée avant @Get(':id') : si l'ordre était inversé,
    // "order-sheet" serait interprété comme un identifiant.
    await controller.getOrderSheet(req)

    expect(service.getOrderSheet).toHaveBeenCalledWith(7)
    expect(service.findOne).not.toHaveBeenCalled()
  })
})
