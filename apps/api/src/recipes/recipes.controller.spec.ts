import { Test, TestingModule } from '@nestjs/testing'
import { BadRequestException } from '@nestjs/common'
import { RecipesController } from './recipes.controller'
import { RecipesService } from './recipes.service'

describe('RecipesController', () => {
  let controller: RecipesController
  let service: { findAll: jest.Mock; setActive: jest.Mock }

  const req = { user: { sub: 7 } }

  beforeEach(async () => {
    service = {
      findAll: jest.fn().mockResolvedValue([]),
      setActive: jest.fn().mockResolvedValue({ id: 1, isActive: false }),
    }

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RecipesController],
      providers: [{ provide: RecipesService, useValue: service }],
    }).compile()

    controller = module.get<RecipesController>(RecipesController)
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })

  describe('GET /recipes', () => {
    it('renvoie tous les plats quand activeOnly est absent', async () => {
      await controller.findAll(req)
      expect(service.findAll).toHaveBeenCalledWith(7, false)
    })

    it('ne restreint aux plats actifs que sur la chaîne exacte "true"', async () => {
      await controller.findAll(req, 'true')
      expect(service.findAll).toHaveBeenLastCalledWith(7, true)

      await controller.findAll(req, '1')
      expect(service.findAll).toHaveBeenLastCalledWith(7, false)
    })
  })

  describe('PATCH /recipes/:id/active', () => {
    it('transmet le booléen au service', async () => {
      await controller.setActive(1, false, req)
      expect(service.setActive).toHaveBeenCalledWith(1, 7, false)
    })

    it('refuse un corps de requête non booléen', () => {
      // Sans ValidationPipe global, un `undefined` non intercepté
      // désactiverait le plat silencieusement.
      expect(() => controller.setActive(1, undefined, req)).toThrow(BadRequestException)
      expect(() => controller.setActive(1, 'true', req)).toThrow(BadRequestException)
      expect(service.setActive).not.toHaveBeenCalled()
    })
  })
})
