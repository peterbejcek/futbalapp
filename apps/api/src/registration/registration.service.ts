import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { RegistrationRequestInput } from '@fkknv/shared';
import { PrismaService } from '../prisma/prisma.service';
import { SeasonsService } from '../seasons/seasons.service';

@Injectable()
export class RegistrationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly seasonsService: SeasonsService,
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
   * Schválenie prihlášky: vytvorí člena, rodičovský účet (ak neexistuje),
   * väzbu Guardian a zaradí člena do kategórie v aktívnej sezóne.
   */
  async approve(id: string, reviewerId: string) {
    const request = await this.prisma.registrationRequest.findUnique({ where: { id } });
    if (!request) throw new NotFoundException('Prihláška neexistuje');
    if (request.status !== 'PENDING') throw new BadRequestException('Prihláška už bola spracovaná');

    const activeSeason = await this.prisma.season.findFirst({ where: { isActive: true } });

    const result = await this.prisma.$transaction(async (tx) => {
      const member = await tx.member.create({
        data: {
          firstName: request.childFirstName,
          lastName: request.childLastName,
          birthDate: request.childBirthDate,
          healthNotes: request.healthNotes,
        },
      });

      let parent = await tx.user.findUnique({ where: { email: request.parentEmail } });
      if (!parent) {
        parent = await tx.user.create({
          data: {
            email: request.parentEmail,
            phone: request.parentPhone,
            firstName: request.parentFirstName,
            lastName: request.parentLastName,
            roles: { create: { role: 'PARENT' } },
          },
        });
      }

      await tx.guardian.create({
        data: { userId: parent.id, memberId: member.id, relation: request.parentRelation },
      });

      await tx.registrationRequest.update({
        where: { id },
        data: {
          status: 'APPROVED',
          reviewedById: reviewerId,
          reviewedAt: new Date(),
          createdMemberId: member.id,
        },
      });

      return { member, parentId: parent.id };
    });

    // Zaradenie do kategórie podľa pravidiel aktívnej sezóny (mimo transakcie — nie je kritické)
    if (activeSeason) {
      await this.seasonsService.assignMemberships(activeSeason.id);
    }

    return result;
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
