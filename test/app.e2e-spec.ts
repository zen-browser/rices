import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { GitHubService } from '../src/github/github.service';

describe('Rices API E2E', () => {
  let app: INestApplication;
  let gitHubService: GitHubService;
  const moderationSecret = 'testSecret999';

  beforeAll(async () => {
    require('dotenv').config({ path: '.env.test.local' });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    gitHubService = moduleFixture.get<GitHubService>(GitHubService);

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // await gitHubService.clearRepository();
  });

  it('POST /rices - Create new zenrice', async () => {
    const response = await request(app.getHttpServer())
      .post('/rices')
      .field('name', 'My first zenrice')
      .attach('file', path.join(__dirname, 'files', 'example.zenrice'))
      .expect(201);

    expect(response.body).toHaveProperty('identifier');
    expect(response.body).toHaveProperty('token');

    const { identifier, token } = response.body;

    const uploadedFileContent = await gitHubService.getFileContent(
      `rices/${identifier}/data.zenrice`,
    );
    expect(uploadedFileContent).not.toBeNull();
    expect(uploadedFileContent).toContain('This is an example zenrice file.');
  });

  it('GET /rices/:identifier - Download zenrice', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/rices')
      .field('name', 'My first zenrice')
      .attach('file', path.join(__dirname, 'files', 'example.zenrice'))
      .expect(201);

    const { identifier, token } = createResponse.body;

    const response = await request(app.getHttpServer())
      .get(`/rices/${identifier}`)
      .expect(200);
  });

  it('PUT /rices/:identifier - Update zenrice', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/rices')
      .field('name', 'My first zenrice')
      .attach('file', path.join(__dirname, 'files', 'example.zenrice'))
      .expect(201);

    const { identifier, token } = createResponse.body;

    const updateResponse = await request(app.getHttpServer())
      .put(`/rices/${identifier}`)
      .set('x-rices-token', token)
      .field('name', 'Mi rice renombrado')
      .attach('file', path.join(__dirname, 'files', 'example_update.zenrice'))
      .expect(200);

    expect(updateResponse.body).toHaveProperty(
      'message',
      `Rice ${identifier} updated`,
    );

    const uploadedFileContent = await gitHubService.getFileContent(
      `rices/${identifier}/data.zenrice`,
    );
    expect(uploadedFileContent).not.toBeNull();
    expect(uploadedFileContent).toContain(
      'This is an example zenrice file (modified).',
    );
  });

  it('DELETE /rices/:identifier - Delete zenrice with previous token', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/rices')
      .field('name', 'My first zenrice')
      .attach('file', path.join(__dirname, 'files', 'example.zenrice'))
      .expect(201);

    const { identifier, token } = createResponse.body;

    await request(app.getHttpServer())
      .delete(`/rices/${identifier}`)
      .set('x-rices-token', token)
      .expect(204);

    const riceJsonContent = await gitHubService.getFileContent(
      `rices/${identifier}/rice.json`,
    );
    expect(riceJsonContent).toBeNull();

    const uploadedFileContent = await gitHubService.getFileContent(
      `rices/${identifier}/data.zenrice`,
    );
    expect(uploadedFileContent).toBeNull();
  });

  it('GET /rices/:identifier - Trying to download deleted zenrice', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/rices')
      .field('name', 'My first zenrice')
      .attach('file', path.join(__dirname, 'files', 'example.zenrice'))
      .expect(201);

    const { identifier, token } = createResponse.body;

    await request(app.getHttpServer())
      .delete(`/rices/${identifier}`)
      .set('x-rices-token', token)
      .expect(204);

    await request(app.getHttpServer()).get(`/rices/${identifier}`).expect(404);
  });

  it('POST /rices - New zenrice for moderation test', async () => {
    const response = await request(app.getHttpServer())
      .post('/rices')
      .field('name', 'Rice for moderation')
      .attach('file', path.join(__dirname, 'files', 'example.zenrice'))
      .expect(201);

    expect(response.body).toHaveProperty('identifier');
    expect(response.body).toHaveProperty('token');

    const { identifier, token } = response.body;

    const riceJsonContent = await gitHubService.getFileContent(
      `rices/${identifier}/rice.json`,
    );
    expect(riceJsonContent).not.toBeNull();

    const riceData = JSON.parse(riceJsonContent!);
    expect(riceData).toMatchObject({
      id: identifier,
      token,
      name: 'Rice for moderation',
    });

    const uploadedFileContent = await gitHubService.getFileContent(
      `rices/${identifier}/data.zenrice`,
    );
    expect(uploadedFileContent).not.toBeNull();
    expect(uploadedFileContent).toContain('This is an example zenrice file.');
  });

  it('DELETE /rices/moderate/delete/:identifier - Delete zenrice for moderation using a correct secret', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/rices')
      .field('name', 'Rice for moderation')
      .attach('file', path.join(__dirname, 'files', 'example.zenrice'))
      .expect(201);

    const { identifier, token } = createResponse.body;

    await request(app.getHttpServer())
      .delete(`/rices/moderate/delete/${identifier}`)
      .set('x-moderation-secret', moderationSecret)
      .expect(204);

    const riceJsonContent = await gitHubService.getFileContent(
      `rices/${identifier}/rice.json`,
    );
    expect(riceJsonContent).toBeNull();

    const uploadedFileContent = await gitHubService.getFileContent(
      `rices/${identifier}/data.zenrice`,
    );
    expect(uploadedFileContent).toBeNull();
  });

  it('DELETE /rices/moderate/delete/:identifier - Delete zenrice for moderation using an incorrect secret', async () => {
    await request(app.getHttpServer())
      .delete(`/rices/moderate/delete/${uuidv4()}`)
      .set('x-moderation-secret', 'claveIncorrecta')
      .expect(401);
  });

  it('DELETE /rices/moderate/delete/:identifier - Delete non existent zenrice for moderation', async () => {
    await request(app.getHttpServer())
      .delete(`/rices/moderate/delete/${uuidv4()}`)
      .set('x-moderation-secret', moderationSecret)
      .expect(404);
  });
});
