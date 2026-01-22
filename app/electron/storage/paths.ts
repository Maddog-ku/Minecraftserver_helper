import { app } from 'electron';
import path from 'path';
import fs from 'fs/promises';

export const getAppName = () => app.getName();

export const getAppDataPath = () => app.getPath('userData');

export const getDocumentsPath = () => path.join(app.getPath('documents'), getAppName());

export const getServersRoot = () => path.join(getDocumentsPath(), 'Servers');

export const ensureAppPaths = async () => {
  await fs.mkdir(getAppDataPath(), { recursive: true });
  await fs.mkdir(getServersRoot(), { recursive: true });
};
