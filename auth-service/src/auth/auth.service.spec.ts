import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

jest.mock('@nestjs/jwt', () => ({
  JwtService: class JwtService {},
}));

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;
  let usersService: {
    findByEmail: jest.Mock;
    findById: jest.Mock;
    create: jest.Mock;
  };
  let jwtService: {
    signAsync: jest.Mock;
    verifyAsync: jest.Mock;
  };

  const user = {
    id: 'user-id',
    email: 'demo@example.com',
    password: 'hashed-password',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  beforeEach(async () => {
    usersService = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
    };
    jwtService = {
      signAsync: jest.fn(),
      verifyAsync: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = module.get(AuthService);
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('normalizes the email, hashes the password, and omits the hash', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      usersService.create.mockResolvedValue({
        ...user,
        email: 'demo@example.com',
      });
      jest.mocked(bcrypt.hash).mockResolvedValue('new-hash');

      const result = await service.register({
        email: '  Demo@Example.com ',
        password: 'password123',
      });

      expect(usersService.findByEmail).toHaveBeenCalledWith('demo@example.com');
      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 12);
      expect(usersService.create).toHaveBeenCalledWith(
        'demo@example.com',
        'new-hash',
      );
      expect(result).not.toHaveProperty('password');
      expect(result.email).toBe('demo@example.com');
    });

    it('rejects an email that is already registered', async () => {
      usersService.findByEmail.mockResolvedValue(user);

      await expect(
        service.register({
          email: 'demo@example.com',
          password: 'password123',
        }),
      ).rejects.toThrow('Email already registered');

      expect(usersService.create).not.toHaveBeenCalled();
      expect(bcrypt.hash).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('returns a signed token and a safe user for valid credentials', async () => {
      usersService.findByEmail.mockResolvedValue(user);
      jest.mocked(bcrypt.compare).mockResolvedValue(true);
      jwtService.signAsync.mockResolvedValue('signed-token');

      const result = await service.login({
        email: ' DEMO@example.com ',
        password: 'password123',
      });

      expect(usersService.findByEmail).toHaveBeenCalledWith('demo@example.com');
      expect(jwtService.signAsync).toHaveBeenCalledWith({
        sub: user.id,
        email: user.email,
      });
      expect(result).toEqual({
        accessToken: 'signed-token',
        user: expect.not.objectContaining({ password: expect.anything() }),
      });
    });

    it('rejects an unknown email', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(
        service.login({
          email: 'unknown@example.com',
          password: 'password123',
        }),
      ).rejects.toThrow('Invalid email or password');

      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    it('rejects an incorrect password', async () => {
      usersService.findByEmail.mockResolvedValue(user);
      jest.mocked(bcrypt.compare).mockResolvedValue(false);

      await expect(
        service.login({
          email: 'demo@example.com',
          password: 'wrong-password',
        }),
      ).rejects.toThrow('Invalid email or password');

      expect(jwtService.signAsync).not.toHaveBeenCalled();
    });
  });

  describe('validateToken', () => {
    it('returns the matching user without the password', async () => {
      jwtService.verifyAsync.mockResolvedValue({ sub: user.id });
      usersService.findById.mockResolvedValue(user);

      const result = await service.validateToken('valid-token');

      expect(usersService.findById).toHaveBeenCalledWith(user.id);
      expect(result).not.toHaveProperty('password');
    });

    it('rejects an invalid token', async () => {
      jwtService.verifyAsync.mockRejectedValue(new Error('invalid token'));

      await expect(service.validateToken('invalid-token')).rejects.toThrow(
        'Invalid or expired token',
      );
    });

    it('rejects a token whose user no longer exists', async () => {
      jwtService.verifyAsync.mockResolvedValue({ sub: user.id });
      usersService.findById.mockResolvedValue(null);

      await expect(service.validateToken('valid-token')).rejects.toThrow(
        'Invalid or expired token',
      );
    });
  });
});
