// Electron type definitions for IPC renderer
export interface IpcRenderer {
  on(channel: string, listener: (event: any, ...args: any[]) => void): void
  send(channel: string, ...args: any[]): void
  removeListener(channel: string, listener: (...args: any[]) => void): void
  removeAllListeners(channel: string): void
}

declare global {
  interface Window {
    ipcRenderer: IpcRenderer
  }
}

export {}
