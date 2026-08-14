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

  /**
   * Prijme prihlášku. Podľa typu vytvorí:
   *  - ADULT: jednu prihlášku dospelého hráča,
   *  - CHILD: jednu prihlášku na každé registrované dieťa (spoločné údaje rodiča),
   *  - PARENT: jednu prihlášku rodiča bez dieťaťa (deti sú už členmi klubu).
   */
  async submit(input: RegistrationRequestInput) {
    const parent = input.parent
      ? {
          parentFirstName: input.parent.firstName,
          parentLastName: input.parent.lastName,
          parentEmail: input.parent.email.toLowerCase(),
          parentPhone: input.parent.phone,
          parentRelation: input.parent.relation,
        }
      : {};

    type RegPlayer = NonNullable<RegistrationRequestInput['children']>[number];
    const playerData = (p: RegPlayer | undefined) => {
      if (!p) throw new BadRequestException('Chýbajú údaje hráča');
      const rc = parseRodneCislo(p.birthNumber);
      if (!rc) throw new BadRequestException('Neplatné rodné číslo');
      return {
        childFirstName: p.firstName,
        childLastName: p.lastName,
        childBirthDate: rc.birthDate,
        birthNumber: p.birthNumber.replace(/\s/g, ''),
        sex: rc.sex,
        playerRegistrationNumber: p.registrationNumber,
        originCountry: p.originCountry,
        addressStreet: p.address.street,
        addressHouseNumber: p.address.houseNumber,
        addressZip: p.address.zip,
        addressCity: p.address.city,
        photoDataUrl: p.photoBase64,
        healthNotes: p.healthNotes,
        playerEmail: p.email?.toLowerCase(),
      };
    };

    const common = {
      applicantType: input.applicantType,
      consentGdpr: input.consents.gdpr,
      consentPhotos: input.consents.photos,
      note: input.note,
      ...parent,
    };

    if (input.applicantType === 'ADULT') {
      await this.prisma.registrationRequest.create({ data: { ...common, ...playerData(input.player) } });
      return { created: 1 };
    }

    if (input.applicantType === 'PARENT') {
      await this.prisma.registrationRequest.create({
        data: { ...common, parentChildrenNote: input.existingChildrenNote },
      });
      return { created: 1 };
    }

    // CHILD — jedna prihláška na každé dieťa
    const children = input.children ?? [];
    await this.prisma.$transaction(
      children.map((child) => this.prisma.registrationRequest.create({ data: { ...common, ...playerData(child) } })),
    );
    return { created: children.length };
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

    const parentOnly = request.applicantType === 'PARENT';

    // 1. hráč (dieťa alebo dospelý) ako člen — pri type PARENT sa hráč nevytvára
    let player: { id: string; firstName: string; lastName: string } | null = null;
    let playerAccount: { email: string; tempPassword: string | null } | null = null;
    if (!parentOnly) {
      player = await this.prisma.member.create({
        data: {
          firstName: request.childFirstName ?? '',
          lastName: request.childLastName ?? '',
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
      if (request.playerEmail) {
        const acc = await this.accounts.ensureAccount({
          email: request.playerEmail,
          firstName: request.childFirstName ?? '',
          lastName: request.childLastName ?? '',
          roles: ['PLAYER'],
        });
        // prepoj hráča s jeho kontom
        await this.prisma.member.update({ where: { id: player.id }, data: { userId: acc.userId } });
        playerAccount = { email: acc.email, tempPassword: acc.tempPassword };
      }
    }

    // 3. rodič — pri registrácii dieťaťa aj pri type PARENT (konto rodiča)
    let parent: { email: string; tempPassword: string | null; accountCreated: boolean } | null = null;
    if (request.applicantType !== 'ADULT' && request.parentEmail) {
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
      // väzba rodič ↔ dieťa (len ak sa vytvoril hráč; pri type PARENT priradí dieťa vedenie/tréner)
      if (player) {
        await this.prisma.guardian.upsert({
          where: { userId_memberId: { userId: parentAccount.userId, memberId: player.id } },
          create: {
            userId: parentAccount.userId,
            memberId: player.id,
            relation: request.parentRelation ?? 'GUARDIAN',
          },
          update: {},
        });
      }
      parent = {
        email: parentAccount.email,
        tempPassword: parentAccount.tempPassword,
        accountCreated: parentAccount.created,
      };
    }

    await this.prisma.registrationRequest.update({
      where: { id },
      data: { status: 'APPROVED', reviewedById: reviewerId, reviewedAt: new Date(), createdMemberId: player?.id },
    });

    // 4. zaradenie hráča do kategórie podľa veku
    if (player) {
      const activeSeason = await this.prisma.season.findFirst({ where: { isActive: true } });
      if (activeSeason) await this.seasonsService.assignMemberships(activeSeason.id);
    }

    return {
      player: player
        ? { id: player.id, firstName: player.firstName, lastName: player.lastName, account: playerAccount }
        : null,
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
