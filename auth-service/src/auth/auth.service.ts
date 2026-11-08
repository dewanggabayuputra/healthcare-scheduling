import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

import { UsersService } from '../users/users.service';
import { RegisterInput } from './dto/register.input';
import { LoginInput } from './dto/login.input';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async register(input: RegisterInput) {
    const email = input.email.trim().toLowerCase();

    const existingUser = await this.usersService.findByEmail(email);

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const hashedPassword = await bcrypt.hash(input.password, 12);

    const user = await this.usersService.create(
      email,
      hashedPassword,
    );

    const { password, ...safeUser } = user;

    return safeUser;
  }

  async login(input: LoginInput) {
    const email = input.email.trim().toLowerCase();

    const user = await this.usersService.findByEmail(email);

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(
      input.password,
      user.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const payload = {
      sub: user.id,
      email: user.email,
    };

    const accessToken = await this.jwtService.signAsync(payload);

    const { password, ...safeUser } = user;

    return {
      accessToken,
      user: safeUser,
    };
  }

  async validateToken(token: string) {
    try {
      const payload = await this.jwtService.verifyAsync(token);

      const user = await this.usersService.findById(payload.sub);

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      const { password, ...safeUser } = user;

      return safeUser;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}