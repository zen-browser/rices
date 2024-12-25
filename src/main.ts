import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ThrottlerExceptionFilter } from './common/filters/throttler-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(new ValidationPipe({ transform: true }));
  app.useGlobalFilters(new ThrottlerExceptionFilter());

  const config = new DocumentBuilder()
    .setTitle('Rices API')
    .setDescription('Zen Rices API management (Zen Browser)')
    .setVersion('1.0')
    // To manage the API with Swagger, we need to add the bearer token
    // .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  await app.listen(3000);
  console.log('API running on http://localhost:3000');
  console.log('Swagger docs on http://localhost:3000/api');
}
bootstrap();
