import { buildApp } from '../services/api/dist/app.js';

let appInstance: any = null;

export default async function handler(req: any, res: any) {
  if (!appInstance) {
    appInstance = buildApp();
    await appInstance.ready();
  }
  const urlPath = (req.url || '').split('?')[0];
  if (!urlPath.startsWith('/api/v1/') && !urlPath.includes('apple-touch-icon') && !urlPath.includes('favicon')) {
    req.url = '/';
  }
  appInstance.server.emit('request', req, res);
}

