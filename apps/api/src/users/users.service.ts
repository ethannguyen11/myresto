import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import * as bcrypt from 'bcrypt'

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } })
  }

  async findById(id: number) {
    return this.prisma.user.findUnique({ where: { id } })
  }

  async create(data: {
    email: string
    password: string
    firstName: string
    lastName: string
    restaurant?: string
    phone?: string
  }) {
    const passwordHash = await bcrypt.hash(data.password, 10)
    return this.prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        restaurant: data.restaurant,
        phone: data.phone,
      },
    })
  }
}