import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

const INSECURE_SECRETS = new Set(['dev-secret-change', 'change-me', 'secret', 'changeme', '']);

async function bootstrap() {
  const jwtSecret = process.env.JWT_SECRET ?? '';
  if (process.env.NODE_ENV === 'production' && INSECURE_SECRETS.has(jwtSecret)) {
    console.error('FATAL: JWT_SECRET is not set or uses an insecure default value in production. Set a strong secret and restart.');
    process.exit(1);
  }

  const app = await NestFactory.create(AppModule, { cors: true });
  const config = new DocumentBuilder()
    .setTitle('HRPro API')
    .setDescription('HRPro payroll and HR API')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);
  const port = process.env.PORT ? Number(process.env.PORT) : 4000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`HRPro API listening on port ${port}`);
}

bootstrap();
