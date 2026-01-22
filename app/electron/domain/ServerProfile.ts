export type ServerStatus = 'stopped' | 'running';

export type CoreType = 'vanilla' | 'paper' | 'fabric' | 'forge';

export interface ServerProfile {
  id: string;
  displayName: string;
  coreType: CoreType;
  mcVersion: string;
  ramMinMb: number;
  ramMaxMb: number;
  runtimeJavaPath?: string;
  rootPath: string;
  serverPath: string;
  status: ServerStatus;
  createdAt: string;
  updatedAt: string;
}
