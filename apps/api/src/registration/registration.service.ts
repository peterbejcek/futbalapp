import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { RegistrationRequestInput } from '@fkknv/shared';
import { PrismaService } from '../prisma/prisma.service';
import { SeasonsService } from '../seasons/seasons.service';
import { AccountsService } from '../auth/accounts.service';

@Injectable()
export class RegistrationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly seasonsService: SeasonsService,
    private readonly accounts: AccountsService,
  ) {}

  submit(input: RegistrationRequestInput) {
    return this.prisma.registrationRequest.create({
      data: {
        childFirstName: input.child.firstName,
        childLastName: input.child.lastName,
        childBirthDate: input.child.birthDate,
        healthNotes: input.child.healthNotes,
        parentFirstName: input.parent.firstName,
        parentLastName: input.parent.lastName,
        parentEmail: input.parent.email.toLowerCase(),
        parentPhone: input.parent.phone,
        parentRelation: input.parent.relation,
        consentGdpr: input.consents.gdpr,
        consentPhotos: input.consents.photos,
        note: input.note,
      },
      select: { id: true, status: true, createdAt: true },
    });
  }

  listPending() {
    return this.prisma.registrationRequest.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Schválenie prihlášky. Vytvorí:
   *  - člena-hráča (dieťa) so zaradením do kategórie podľa veku,
   *  - konto rodiča s dočasným heslom + rolou PARENT (rodič je vedený aj ako člen),
   *  - väzbu Guardian rodič ↔ dieťa.
   * Vráti dočasné heslo rodiča, aby ho vedenie mohlo odovzdať.
   */
  async approve(id: string, reviewerId: string) {
    const request = await this.prisma.registrationRequest.findUnique({ where: { id } });
    if (!request) throw new NotFoundException('Prihláška neexistuje');
    if (request.status !== 'PENDING') throw new BadRequestException('Prihláška už bola spracovaná');

    // 1. dieťa ako člen-hráč
    const child = await this.prisma.member.create({
      data: {
        firstName: request.childFirstName,
        lastName: request.childLastName,
        birthDate: request.childBirthDate,
        healthNotes: request.healthNotes,
      },
    });

    // 2. konto rodiča (temp heslo len ak je nové) + rola PARENT
    const parentAccount = await this.accounts.ensureAccount({
      email: request.parentEmail,
      phone: request.parentPhone,
      firstName: request.parentFirstName,
      lastName: request.parentLastName,
      roles: ['PARENT'],
    });

    // 3. rodič vedený aj ako člen klubu (bez dátumu narodenia)
    let parentMember = await this.prisma.member.findUnique({ where: { userId: parentAccount.userId } });
    if (!parentMember) {
      parentMember = await this.prisma.member.create({
        data: {
          firstName: request.parentFirstName,
          lastName: request.parentLastName,
          userId: parentAccount.userId,
        },
      });
    }

    // 4. väzba rodič ↔ dieťa
    await this.prisma.guardian.upsert({
      where: { userId_memberId: { userId: parentAccount.userId, memberId: child.id } },
      create: { userId: parentAccount.userId, memberId: child.id, relation: request.parentRelation },
      update: {},
    });

    await this.prisma.registrationRequest.update({
      where: { id },
      data: { status: 'APPROVED', reviewedById: reviewerId, reviewedAt: new Date(), createdMemberId: child.id },
    });

    // 5. zaradenie dieťaťa do kategórie podľa veku
    const activeSeason = await this.prisma.season.findFirst({ where: { isActive: true } });
    if (activeSeason) await this.seasonsService.assignMemberships(activeSeason.id);

    return {
      child: { id: child.id, firstName: child.firstName, lastName: child.lastName },
      parent: {
        email: parentAccount.email,
        tempPassword: parentAccount.tempPassword, // null, ak rodič konto už mal
        accountCreated: parentAccount.created,
      },
    };
  }

  async reject(id: string, reviewerId: string) {
    const request = await this.prisma.registrationRequest.findUnique({ where: { id } });
    if (!request) throw new NotFoundException('Prihláška neexistuje');
    if (request.status !== 'PENDING') throw new BadRequestException('Prihláška už bola spracovaná');
    return this.prisma.registrationRequest.update({
      where: { id },
      data: { status: 'REJECTED', reviewedById: reviewerId, reviewedAt: new Date() },
    });
  }
}
