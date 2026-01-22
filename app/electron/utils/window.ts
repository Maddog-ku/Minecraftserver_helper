import { BrowserWindow } from 'electron';

export const getMainWindow = () =>
  BrowserWindow.getAllWindows().find((win) => !win.isDestroyed());
