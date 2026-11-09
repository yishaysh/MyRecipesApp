import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema.js';

let dbInstance: ReturnType<typeof drizzle> | null = null;
let currentConnectionString: string | undefined = undefined;

export function getDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    return null;
  }
  if (!dbInstance || currentConnectionString !== connectionString) {
    const sql = neon(connectionString);
    dbInstance = drizzle(sql, { schema });
    currentConnectionString = connectionString;
  }
  return dbInstance;
}

export function isDbConnected(): boolean {
  return !!process.env.DATABASE_URL;
}

export { schema };

