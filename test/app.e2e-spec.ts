import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { GitHubService } from '../src/github/github.service';
import { SupabaseService } from '../src/supabase/supabase.service';

describe('Rices API E2E', () => {
  let app: INestApplication;
  let gitHubService: GitHubService;
  let supabaseService: SupabaseService;
  const moderationSecret = 'testSecret999';

  beforeAll(async () => {
    require('dotenv').config({ path: '.env.test.local' });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    gitHubService = moduleFixture.get<GitHubService>(GitHubService);
    supabaseService = moduleFixture.get<SupabaseService>(SupabaseService);

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Limpiar repositorio y base de datos antes de cada test si es necesario
  });

  it('POST /rices - Create a new rice entry', async () => {
    const response = await request(app.getHttpServer())
      .post('/rices')
      .field('name', 'Test Rice')
      .attach('file', path.join(__dirname, 'files', 'example.zenrice'))
      .expect(201);

    const { slug, token } = response.body;
    expect(slug).toBeDefined();
    expect(token).toBeDefined();

    const riceInDatabase = await supabaseService.getRiceBySlug(slug);
    expect(riceInDatabase).not.toBeNull();
    expect(riceInDatabase.name).toBe('Test Rice');

    const fileInGitHub = await gitHubService.getFileContent(
      `rices/${slug}/data.zenrice`,
    );
    expect(fileInGitHub).toContain('This is an example zenrice file.');
  });

  it('GET /rices/:slug - Retrieve a rice entry and increment visits', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/rices')
      .field('name', 'Test Rice')
      .attach('file', path.join(__dirname, 'files', 'example.zenrice'))
      .expect(201);

    const { slug } = createResponse.body;

    const initialData = await supabaseService.getRiceBySlug(slug);
    expect(initialData.visits).toBe(0);

    await request(app.getHttpServer()).get(`/rices/${slug}`).expect(200);

    const updatedData = await supabaseService.getRiceBySlug(slug);
    expect(updatedData.visits).toBe(1);
  });

  it('PUT /rices/:slug - Update a rice entry', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/rices')
      .field('name', 'Original Rice')
      .attach('file', path.join(__dirname, 'files', 'example.zenrice'))
      .expect(201);

    const { slug, token } = createResponse.body;

    const updateResponse = await request(app.getHttpServer())
      .put(`/rices/${slug}`)
      .set('x-rices-token', token)
      .field('name', 'Updated Rice')
      .attach('file', path.join(__dirname, 'files', 'example_update.zenrice'))
      .expect(200);

    expect(updateResponse.body.message).toBe(`ok`);

    const updatedData = await supabaseService.getRiceBySlug(slug);
    expect(updatedData.name).toBe('Updated Rice');

    const updatedFile = await gitHubService.getFileContent(
      `rices/${slug}/data.zenrice`,
    );
    expect(updatedFile).toContain(
      'This is an example zenrice file (modified).',
    );
  });

  it('DELETE /rices/:slug - Delete a rice entry', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/rices')
      .field('name', 'Rice to Delete')
      .attach('file', path.join(__dirname, 'files', 'example.zenrice'))
      .expect(201);

    const { slug, token } = createResponse.body;

    await request(app.getHttpServer())
      .delete(`/rices/${slug}`)
      .set('x-rices-token', token)
      .expect(204);

    const riceInDatabase = await supabaseService.getRiceBySlug(slug);
    expect(riceInDatabase).toBeNull();

    const fileInGitHub = await gitHubService.getFileContent(
      `rices/${slug}/data.zenrice`,
    );
    expect(fileInGitHub).toBeNull();
  });

  it('DELETE /rices/moderate/delete/:slug - Moderation delete with correct secret', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/rices')
      .field('name', 'Moderation Test Rice')
      .attach('file', path.join(__dirname, 'files', 'example.zenrice'))
      .expect(201);

    const { slug } = createResponse.body;

    await request(app.getHttpServer())
      .delete(`/rices/moderate/delete/${slug}`)
      .set('x-moderation-secret', moderationSecret)
      .expect(204);

    const riceInDatabase = await supabaseService.getRiceBySlug(slug);
    expect(riceInDatabase).toBeNull();

    const fileInGitHub = await gitHubService.getFileContent(
      `rices/${slug}/data.zenrice`,
    );
    expect(fileInGitHub).toBeNull();
  });

  it('DELETE /rices/moderate/delete/:slug - Moderation delete with incorrect secret', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/rices')
      .field('name', 'Moderation Failure Test')
      .attach('file', path.join(__dirname, 'files', 'example.zenrice'))
      .expect(201);

    const { slug } = createResponse.body;

    await request(app.getHttpServer())
      .delete(`/rices/moderate/delete/${slug}`)
      .set('x-moderation-secret', 'wrongSecret')
      .expect(401);

    const riceInDatabase = await supabaseService.getRiceBySlug(slug);
    expect(riceInDatabase).not.toBeNull();
  });
});
