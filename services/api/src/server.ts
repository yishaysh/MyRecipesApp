import { buildApp } from './app.js';
import dotenv from 'dotenv';

dotenv.config();

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
const host = process.env.HOST || '0.0.0.0';

const app = buildApp();

app.listen({ port, host }, (err, address) => {
  if (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
  console.log(`🚀 Social Recipe Extractor API running at ${address}`);
  console.log(`📡 Ingestion route: ${address}/api/v1/recipes/parse`);
});
