import 'dotenv/config';
import { CuratedCollectionsService } from '../services/curated-collections.service.js';

async function main() {
  const result = await CuratedCollectionsService.seedCuratedCollections();
  console.log(`[SEED] Curated collections seed complete: inserted=${result.inserted}, total=${result.total}`);
}

main().catch((err) => {
  console.error('[SEED] Failed seeding curated collections:', err);
  process.exit(1);
});
