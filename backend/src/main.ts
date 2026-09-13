import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Habilitar CORS para que el Frontend (React/Vite/etc.) pueda conectarse sin bloqueos
  app.enableCors();

  // Validación automática de DTOs con class-validator
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Configuración de Swagger
  const config = new DocumentBuilder()
    .setTitle('Farmacia La Sana - API')
    .setDescription('API Backend de Facturación, Inventario y Traslados Multisede')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`🚀 Backend corriendo en: http://localhost:${port}`);
  console.log(`📑 Swagger disponible en: http://localhost:${port}/api/docs`);
}
bootstrap();
