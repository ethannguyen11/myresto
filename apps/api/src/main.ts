import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use((_req, res, next) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    next()
  });
  app.enableCors({
    origin: [
      'http://localhost:5173',       // Vite web app
      'http://localhost:8083',       // Expo web (mobile app on web)
      'http://localhost:19006',      // Expo web (legacy port)
      'http://192.168.0.6:8083',    // Expo web depuis le réseau local
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
