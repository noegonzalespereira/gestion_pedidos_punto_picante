import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS: permite llamadas desde tu app Flutter (móvil y web)
  app.enableCors({
    origin: true, // en producción especifica tus orígenes permitidos
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Validación global de DTOs
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,            // elimina campos no declarados en DTOs
    forbidNonWhitelisted: true, // lanza error si llegan campos extra
    transform: true,            // convierte tipos (string->number, etc.)
  }));

  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  await app.listen(port);
  console.log(`API corriendo en http://localhost:${port}`);
}
bootstrap();
