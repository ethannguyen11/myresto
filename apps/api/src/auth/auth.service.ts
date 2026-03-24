import { Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { UsersService } from '../users/users.service'
import * as bcrypt from 'bcrypt'

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

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

  async validateUser(userId: number) {
    return this.usersService.findById(userId)
  }
}