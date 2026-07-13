import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { roles: true },
    });
    if (!user?.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('Nesprávny e-mail alebo heslo');
    }
    const roles = user.roles.map((r) => ({ role: r.role, teamCategoryId: r.teamCategoryId }));
    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      roles,
    });
    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roles,
      },
    };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        roles: { include: { teamCategory: true } },
        guardianOf: { include: { member: true } },
      },
    });
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      roles: user.roles.map((r) => ({
        role: r.role,
        teamCategory: r.teamCategory ? { code: r.teamCategory.code, name: r.teamCategory.name } : null,
      })),
      children: user.guardianOf.map((g) => ({
        id: g.member.id,
        firstName: g.member.firstName,
        lastName: g.member.lastName,
      })),
    };
  }
}
