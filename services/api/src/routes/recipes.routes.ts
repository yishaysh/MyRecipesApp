import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { ParseRecipeRequestSchema } from '@myrecipes/shared';
import { JobQueueService } from '../services/job-queue.service.js';
import { RecipeStorageService } from '../services/recipe-storage.service.js';
import { ExtractorService } from '../services/extractor.service.js';
import { LlmParserService } from '../services/llm-parser.service.js';

export const recipesRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const jobQueue = JobQueueService.getInstance();
  const storage = RecipeStorageService.getInstance();
  const extractor = new ExtractorService();
  const parser = new LlmParserService();

  // POST /api/v1/recipes/parse (Asynchronous Ingestion Endpoint per Spec)
  fastify.post('/parse', async (request, reply) => {
    const parseResult = ParseRecipeRequestSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: parseResult.error.format()
      });
    }

    const { sourceUrl, userId } = parseResult.data;
    const job = jobQueue.createJob(sourceUrl, userId);

    return reply.status(202).send(job);
  });

  // GET /api/v1/recipes/jobs/:jobId (Poll job status)
  fastify.get('/jobs/:jobId', async (request, reply) => {
    const { jobId } = request.params as { jobId: string };
    const job = jobQueue.getJob(jobId);

    if (!job) {
      return reply.status(404).send({ error: 'Job not found' });
    }

    return reply.send(job);
  });

  // POST /api/v1/recipes/fast-parse (Synchronous direct parsing for instant response)
  fastify.post('/fast-parse', async (request, reply) => {
    const parseResult = ParseRecipeRequestSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: parseResult.error.format()
      });
    }

    const { sourceUrl } = parseResult.data;
    const raw = await extractor.extractRawContent(sourceUrl);
    const recipe = await parser.parseToRecipe(raw);
    storage.save(recipe);

    return reply.send(recipe);
  });

  // GET /api/v1/recipes (List all stored recipes)
  fastify.get('/', async (_request, reply) => {
    const recipes = storage.getAll();
    return reply.send({
      recipes,
      total: recipes.length
    });
  });

  // GET /api/v1/recipes/:id (Get single recipe)
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const recipe = storage.getById(id);

    if (!recipe) {
      return reply.status(404).send({ error: 'Recipe not found' });
    }

    return reply.send(recipe);
  });

  // DELETE /api/v1/recipes/:id (Delete recipe)
  fastify.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const success = storage.delete(id);

    if (!success) {
      return reply.status(404).send({ error: 'Recipe not found' });
    }

    return reply.send({ success: true, message: 'Recipe deleted' });
  });
};
