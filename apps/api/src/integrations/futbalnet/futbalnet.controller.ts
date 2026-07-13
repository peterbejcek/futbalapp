import { Body, Controller, Param, Post } from '@nestjs/common';
import { z } from 'zod';
import { FutbalnetService } from './futbalnet.service';
import { Roles } from '../../auth/roles.decorator';
import { ZodValidationPipe } from '../../common/zod.pipe';

const configSchema = z.object({
  url: z.string().url().nullable(),
  teamName: z.string().min(2).nullable(),
});

const importSchema = z.object({
  matches: z.array(
    z.object({
      externalId: z.string().min(1),
      homeTeam: z.string().min(1),
      awayTeam: z.string().min(1),
      startAt: z.coerce.date(),
      location: z.string().optional(),
      competition: z.string().optional(),
      round: z.string().optional(),
    }),
  ),
});

@Controller('futbalnet')
@Roles('ADMIN', 'MANAGER')
export class FutbalnetController {
  constructor(private readonly futbalnetService: FutbalnetService) {}

  /** Nastavenie URL súťaže a názvu tímu pre kategóriu. */
  @Post('config/:categoryCode')
  configure(
    @Param('categoryCode') categoryCode: string,
    @Body(new ZodValidationPipe(configSchema)) body: z.infer<typeof configSchema>,
  ) {
    return this.futbalnetService.configure(categoryCode, body.url, body.teamName);
  }

  /** Sync všetkých nakonfigurovaných kategórií (inak beží v pondelok 5:00). */
  @Post('sync')
  syncAll() {
    return this.futbalnetService.syncAll();
  }

  @Post('sync/:categoryCode')
  syncCategory(@Param('categoryCode') categoryCode: string) {
    return this.futbalnetService.syncCategory(categoryCode);
  }

  /** Manuálny import zápasov (JSON) — záloha, keď fetch z futbalnetu nefunguje. */
  @Post('import/:categoryCode')
  importMatches(
    @Param('categoryCode') categoryCode: string,
    @Body(new ZodValidationPipe(importSchema)) body: z.infer<typeof importSchema>,
  ) {
    return this.futbalnetService.importMatches(categoryCode, body.matches);
  }
}
