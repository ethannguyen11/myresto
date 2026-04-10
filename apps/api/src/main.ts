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
      'http://localhost:5173',
      'http://localhost:8083',
      'http://localhost:19006',
      'http://192.168.0.6:8083',
      'https://chef-ai-tssy.onrender.com',
      'https://chefai-web.vercel.app',
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });
  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
bootstrap();
