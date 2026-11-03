import { buildApp } from '../dist/app.js';

let appInstance: any = null;

export default async function handler(req: any, res: any) {
  if (!appInstance) {
    appInstance = buildApp();
    await appInstance.ready();
  }
  appInstance.server.emit('request', req, res);
}

