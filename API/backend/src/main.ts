import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS
  app.enableCors({
    origin: ['http://localhost:5173',
      /\.vercel\.app$/
    ], 
    
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type,Authorization',
  });

  // Validación global de DTOs
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,            // elimina campos no declarados en DTOs
    forbidNonWhitelisted: true, 
    transform: true,          
  }));

  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  await app.listen(port);
  const logger = new Logger('Bootstrap');
  logger.log(`API corriendo en el puerto: ${port}`);
}
bootstrap();
