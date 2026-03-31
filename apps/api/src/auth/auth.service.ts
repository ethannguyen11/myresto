import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { UsersService } from '../users/users.service'
import * as bcrypt from 'bcrypt'

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async register(data: { email: string; password: string; firstName: string; lastName: string; restaurant?: string }) {
    const existing = await this.usersService.findByEmail(data.email)
    if (existing) throw new ConflictException('Un compte existe déjà avec cet email')

    const user = await this.usersService.create(data)
    const payload = { sub: user.id, email: user.email }
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        plan: user.plan,
      },
    }
  }

  async login(email: string, password: string) {
    const user = await this.usersService.findByEmail(email)
    if (!user) throw new UnauthorizedException('Email ou mot de passe incorrect')

    const isValid = await bcrypt.compare(password, user.passwordHash)
    if (!isValid) throw new UnauthorizedException('Email ou mot de passe incorrect')

    const payload = { sub: user.id, email: user.email }
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        plan: user.plan,
      },
    }
  }

  async me(userId: number) {
    const user = await this.usersService.findById(userId)
    if (!user) throw new UnauthorizedException()
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      restaurant: user.restaurant,
      plan: user.plan,
    }
  }

  async validateUser(userId: number) {
    return this.usersService.findById(userId)
  }
}