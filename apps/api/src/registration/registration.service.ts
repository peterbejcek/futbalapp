import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { parseRodneCislo, type RegistrationRequestInput } from '@fkknv/shared';
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
    // dátum narodenia a pohlavie sú autoritatívne odvodené z rodného čísla
    const rc = parseRodneCislo(input.player.birthNumber);
    if (!rc) throw new BadRequestException('Neplatné rodné číslo');

    return this.prisma.registrationRequest.create({
      data: {
        applicantType: input.applicantType,
        childFirstName: input.player.firstName,
        childLastName: input.player.lastName,
        childBirthDate: rc.birthDate,
        birthNumber: input.player.birthNumber.replace(/\s/g, ''),
        sex: rc.sex,
        playerRegistrationNumber: input.player.registrationNumber,
        originCountry: input.originCountry,
        addressStreet: input.address.street,
        addressHouseNumber: input.address.houseNumber,
        addressZip: input.address.zip,
        addressCity: input.address.city,
        photoDataUrl: input.player.photoBase64,
        healthNotes: input.player.healthNotes,
        playerEmail: input.player.email?.toLowerCase(),
        parentFirstName: input.parent?.firstName,
        parentLastName: input.parent?.lastName,
        parentEmail: input.parent?.email.toLowerCase(),
        parentPhone: input.parent?.phone,
        parentRelation: input.parent?.relation,
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

    // 1. hráč (dieťa alebo dospelý) ako člen
    const player = await this.prisma.member.create({
      data: {
        firstName: request.childFirstName,
        lastName: request.childLastName,
        birthDate: request.childBirthDate,
        birthNumber: request.birthNumber,
        sex: request.sex,
        registrationNumber: request.playerRegistrationNumber || undefined,
        originCountry: request.originCountry,
        addressStreet: request.addressStreet,
        addressHouseNumber: request.addressHouseNumber,
        addressZip: request.addressZip,
        addressCity: request.addressCity,
        healthNotes: request.healthNotes,
      },
    });

    // 1b. fotka hráča (ak bola nahraná pri registrácii)
    if (request.photoDataUrl) {
      await this.prisma.memberPhoto.create({ data: { memberId: player.id, dataUrl: request.photoDataUrl } });
      await this.prisma.member.update({ where: { id: player.id }, data: { photoUrl: `/members/${player.id}/photo` } });
    }

    // 2. voliteľné vlastné prihlásenie hráča (starší hráč / dospelý)
    let playerAccount: { email: string; tempPassword: string | null } | null = null;
    if (request.playerEmail) {
      const acc = await this.accounts.ensureAccount({
        email: request.playerEmail,
        firstName: request.childFirstName,
        lastName: request.childLastName,
        roles: ['PLAYER'],
      });
      // prepoj hráča s jeho kontom
      await this.prisma.member.update({ where: { id: player.id }, data: { userId: acc.userId } });
      playerAccount = { email: acc.email, tempPassword: acc.tempPassword };
    }

    // 3. rodič — len pri registrácii dieťaťa
    let parent: { email: string; tempPassword: string | null; accountCreated: boolean } | null = null;
    if (request.applicantType === 'CHILD' && request.parentEmail) {
      const parentAccount = await this.accounts.ensureAccount({
        email: request.parentEmail,
        phone: request.parentPhone ?? undefined,
        firstName: request.parentFirstName ?? '',
        lastName: request.parentLastName ?? '',
        roles: ['PARENT'],
      });
      // rodič vedený aj ako člen klubu
      const existingParentMember = await this.prisma.member.findUnique({ where: { userId: parentAccount.userId } });
      if (!existingParentMember) {
        await this.prisma.member.create({
          data: {
            firstName: request.parentFirstName ?? '',
            lastName: request.parentLastName ?? '',
            userId: parentAccount.userId,
          },
        });
      }
      // väzba rodič ↔ dieťa
      await this.prisma.guardian.upsert({
        where: { userId_memberId: { userId: parentAccount.userId, memberId: player.id } },
        create: {
          userId: parentAccount.userId,
          memberId: player.id,
          relation: request.parentRelation ?? 'GUARDIAN',
        },
        update: {},
      });
      parent = {
        email: parentAccount.email,
        tempPassword: parentAccount.tempPassword,
        accountCreated: parentAccount.created,
      };
    }

    await this.prisma.registrationRequest.update({
      where: { id },
      data: { status: 'APPROVED', reviewedById: reviewerId, reviewedAt: new Date(), createdMemberId: player.id },
    });

    // 4. zaradenie hráča do kategórie podľa veku
    const activeSeason = await this.prisma.season.findFirst({ where: { isActive: true } });
    if (activeSeason) await this.seasonsService.assignMemberships(activeSeason.id);

    return {
      player: { id: player.id, firstName: player.firstName, lastName: player.lastName, account: playerAccount },
      parent,
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
