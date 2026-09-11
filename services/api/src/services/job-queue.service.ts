import { ParseRecipeJobResponse, StructuredRecipe } from '@myrecipes/shared';
import { ExtractorService } from './extractor.service.js';
import { LlmParserService } from './llm-parser.service.js';
import { RecipeStorageService } from './recipe-storage.service.js';

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

  public createJob(sourceUrl: string, _userId?: string): { jobId: string; status: 'processing' } {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const initialJob: ParseRecipeJobResponse = {
      jobId,
      status: 'processing',
      progress: 10,
      message: 'Fetching social media media and caption...'
    };

    this.jobs.set(jobId, initialJob);

    // Asynchronously execute extraction & parsing pipeline
    this.processJob(jobId, sourceUrl).catch((err) => {
      console.error(`[JOB_QUEUE] Unhandled error processing job ${jobId}:`, err);
    });

    return { jobId, status: 'processing' };
  }

  public getJob(jobId: string): ParseRecipeJobResponse | undefined {
    return this.jobs.get(jobId);
  }

  private async processJob(jobId: string, sourceUrl: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) return;

    try {
      console.log(`[JOB_QUEUE] Starting async job execution for ${jobId} (URL: ${sourceUrl})`);
      
      // Step 1: Extract raw media content
      job.progress = 30;
      job.message = 'Extracting social media content & captions...';
      const rawContent = await this.extractor.extractRawContent(sourceUrl);

      // Step 2: LLM Structured Parsing
      job.progress = 70;
      job.message = 'Parsing recipe into structured schema with LLM...';
      const recipe: StructuredRecipe = await this.parser.parseToRecipe(rawContent);

      // Step 3: Persistence to Database
      job.progress = 90;
      job.message = 'Saving recipe to database...';
      this.storage.save(recipe);

      // Step 4: Completion
      job.status = 'completed';
      job.progress = 100;
      job.message = 'Recipe successfully parsed and saved.';
      job.recipe = recipe;
      console.log(`[JOB_QUEUE] Job ${jobId} completed successfully.`);
    } catch (err: any) {
      console.error(`[JOB_QUEUE] Job ${jobId} failed:`, err);
      job.status = 'failed';
      job.error = err.message || 'Unknown processing error';
      job.message = 'Failed to extract recipe from URL.';
    }
  }

  public clear(): void {
    this.jobs.clear();
  }
}
