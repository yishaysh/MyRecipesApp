import { ParseRecipeJobResponse, StructuredRecipe } from '../shared/index.js';
import { ExtractorService } from './extractor.service.js';
import { LlmParserService } from './llm-parser.service.js';
import { RecipeStorageService } from './recipe-storage.service.js';
import { SyncService } from './sync.service.js';

export class JobQueueService {
  private static instance: JobQueueService;
  private jobs: Map<string, ParseRecipeJobResponse> = new Map();
  private extractor: ExtractorService = new ExtractorService();
  private parser: LlmParserService = new LlmParserService();
  private storage: RecipeStorageService = RecipeStorageService.getInstance();

  private constructor() {}

  public static getInstance(): JobQueueService {
    if (!JobQueueService.instance) {
      JobQueueService.instance = new JobQueueService();
    }
    return JobQueueService.instance;
  }

  public createJob(sourceUrl: string, userId?: string): { jobId: string; status: 'processing' } {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const initialJob: ParseRecipeJobResponse = {
      jobId,
      status: 'processing',
      progress: 10,
      message: 'Fetching social media media and caption...'
    };

    this.jobs.set(jobId, initialJob);

    // Asynchronously execute extraction & parsing pipeline
    this.processJob(jobId, sourceUrl, userId).catch((err) => {
      console.error(`[JOB_QUEUE] Unhandled error processing job ${jobId}:`, err);
    });

    return { jobId, status: 'processing' };
  }

  public async createJobAsync(sourceUrl: string, userId?: string): Promise<ParseRecipeJobResponse> {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const initialJob: ParseRecipeJobResponse = {
      jobId,
      status: 'processing',
      progress: 10,
      message: 'Fetching social media media and caption...'
    };

    this.jobs.set(jobId, initialJob);
    await this.processJob(jobId, sourceUrl, userId);
    return this.jobs.get(jobId) || initialJob;
  }

  public getJob(jobId: string): ParseRecipeJobResponse | undefined {
    return this.jobs.get(jobId);
  }

  private async processJob(jobId: string, sourceUrl: string, userId?: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) return;

    try {
      console.log(`[JOB_QUEUE] Starting async job execution for ${jobId} (URL: ${sourceUrl})`);
      
      // Step 1: Check Global Recipes Cache
      const cachedData = await SyncService.getFromGlobalCache(sourceUrl);
      if (cachedData) {
        console.log(`[JOB_QUEUE] Cache HIT for URL: ${sourceUrl}`);
        const cachedRecipes = Array.isArray(cachedData.recipes) ? cachedData.recipes : [cachedData];
        for (const r of cachedRecipes) {
          this.storage.save(r);
        }
        if (userId) {
          await SyncService.incrementUsage(userId);
        }
        job.status = 'completed';
        job.progress = 100;
        job.message = 'Recipe retrieved instantly from global cache!';
        job.recipe = cachedData.primary || cachedRecipes[0];
        job.recipes = cachedRecipes;
        return;
      }

      // Step 2: Extract raw media content
      job.progress = 30;
      job.message = 'Extracting social media content & captions...';
      const rawContent = await this.extractor.extractRawContent(sourceUrl);

      // Step 3: LLM Structured Parsing (supports multiple recipes from carousels)
      job.progress = 70;
      job.message = 'Parsing recipe into structured schema with LLM...';
      const recipes: StructuredRecipe[] = await this.parser.parseToRecipes(rawContent);

      // Step 4: Persistence to Database & Global Cache
      job.progress = 90;
      job.message = 'Saving recipe to database...';
      for (const r of recipes) {
        this.storage.save(r);
      }

      if (recipes.length > 0) {
        await SyncService.saveToGlobalCache(sourceUrl, { recipes, primary: recipes[0] });
      }

      if (userId) {
        await SyncService.incrementUsage(userId);
      }

      // Step 5: Completion
      job.status = 'completed';
      job.progress = 100;
      job.message = recipes.length > 1
        ? `חולצו בהצלחה ${recipes.length} מתכונים מהקרוסלה ונשמרו בספר שלך!`
        : 'Recipe successfully parsed and saved.';
      job.recipe = recipes[0];
      job.recipes = recipes;
      console.log(`[JOB_QUEUE] Job ${jobId} completed successfully with ${recipes.length} recipes.`);
    } catch (err: any) {
      console.error(`[JOB_QUEUE] Job ${jobId} failed:`, err);
      if (userId) {
        await SyncService.decrementUsage(userId);
      }
      job.status = 'failed';
      job.error = err.message || 'Unknown processing error';
      job.message = 'Failed to extract recipe from URL.';
    }
  }

  public clear(): void {
    this.jobs.clear();
  }
}
