/// <reference types="vite/client" />

import type { CoreType, ServerProfile } from './store/serversStore';

declare global {
  interface Window {
    api: {
      server: {
        list: () => Promise<ServerProfile[]>;
        create: (payload: { displayName: string; coreType: CoreType; mcVersion: string }) => Promise<ServerProfile>;
        rename: (payload: { id: string; displayName: string }) => Promise<ServerProfile>;
        delete: (payload: { id: string; deleteFiles: boolean }) => Promise<void>;
        start: (id: string) => Promise<ServerProfile>;
        stop: (id: string) => Promise<ServerProfile>;
        status: (id: string) => Promise<'running' | 'stopped'>;
        sendCommand: (payload: { id: string; command: string }) => Promise<void>;
        openFolder: (id: string) => Promise<void>;
        onLog: (callback: (payload: { serverId: string; line: string }) => void) => () => void;
      };
      mods: {
        pickAndImport: (serverId: string) => Promise<{
          importedCount: number;
          skippedCount: number;
          conflicts: string[];
          detectedPackType?: 'curseforge';
          mcVersion?: string;
          loaderType?: 'forge' | 'fabric' | 'neoforge' | 'unknown';
          modCount?: number;
          importedOverridesCount?: number;
          importedJarsCount?: number;
        }>;
        pickAndImportFolder: (payload: {
          serverId: string;
          options: { includeConfig: boolean; includeKubejs: boolean; includeDefaultconfigs: boolean };
        }) => Promise<{
          importedCount: number;
          skippedCount: number;
          conflicts: string[];
          importedOverridesCount?: number;
          importedJarsCount?: number;
        }>;
        list: (serverId: string) => Promise<{ filename: string; size: number; enabled: boolean }[]>;
        remove: (payload: { serverId: string; filename: string }) => Promise<void>;
        toggle: (payload: { serverId: string; filename: string; enabled: boolean }) => Promise<void>;
      };
      runtime: {
        ensureJava: (version: number) => Promise<{ javaPath: string }>;
        onProgress: (callback: (payload: { phase: 'downloading' | 'extracting' | 'verifying'; percent: number; downloadedBytes: number; totalBytes: number }) => void) => () => void;
      };
    };
  }
}

export {};
