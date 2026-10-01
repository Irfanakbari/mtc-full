import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  app.use(helmet());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, transformOptions: { enableImplicitConversion: true } }));
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.enableShutdownHooks();
  const instance = app.getHttpAdapter().getInstance();
  if (instance?.set) instance.set('trust proxy', 1);
  const production = config.get<string>('NODE_ENV') === 'production';
  const swaggerEnabled = config.get<string>('SWAGGER_ENABLED') === 'true' || (!production && config.get<string>('SWAGGER_ENABLED') !== 'false');
  if (swaggerEnabled) {
    const document = SwaggerModule.createDocument(app, new DocumentBuilder().setTitle('MTC Inventory API').setDescription('Inventory, ledger, stock opname, and IAM API').setVersion('1.0').addBearerAuth().addApiKey({ type: 'apiKey', in: 'header', name: 'X-Api-Key' }, 'api-key').build());
    const key = config.get<string>('SWAGGER_API_KEY');
    instance.use('/api/docs', (req: { headers: Record<string, string> }, res: { status: (code: number) => { json: (value: unknown) => void } }, next: () => void) => { if (!key || req.headers['x-docs-api-key'] === key) next(); else res.status(401).json({ message: 'Documentation authentication failed' }); });
    SwaggerModule.setup('api/docs', app, document, { jsonDocumentUrl: 'api/docs-json' });
  }
  const port = config.get<number>('PORT', 31000);
  await app.listen(port, '0.0.0.0');
  Logger.log(`MTC Inventory API listening on ${port}`, 'Bootstrap');
}

void bootstrap();
