import 'reflect-metadata';
import { json, urlencoded } from 'express';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // API je dostupné len cez Caddy (jeden proxy hop) — req.ip = skutočná IP klienta
  // (rate-limit verejného API). Žiadna iná časť API req.ip/protocol nepoužíva.
  app.set('trust proxy', 1);
  app.setGlobalPrefix('api/v1');
  // väčší limit tela požiadavky — registrácia môže obsahovať fotku (data URL)
  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ limit: '10mb', extended: true }));
  app.enableCors({
    origin: (process.env.CORS_ORIGIN ?? 'http://localhost:3000').split(','),
    credentials: true,
  });
  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`FKKNV API beží na porte ${port}`);
}

void bootstrap();
