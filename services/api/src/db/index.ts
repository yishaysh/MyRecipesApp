import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema.js';

const connectionString = process.env.DATABASE_URL;

let dbInstance: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  if (!connectionString) {
    return null;
  }
  if (!dbInstance) {
    const sql = neon(connectionString);
    dbInstance = drizzle(sql, { schema });
  }
  return dbInstance;
}

export function isDbConnected(): boolean {
  return !!process.env.DATABASE_URL;
}

export { schema };
