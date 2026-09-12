export interface BrowserFetchPluginRequest {
  url: string;
  origin: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
  hasBody: boolean;
  timeoutMs: number;
}

export interface BrowserFetchPluginPage {
  goto(url: string): Promise<void>;
  evaluateWithArgs?(script: string, args: { request: BrowserFetchPluginRequest }): Promise<unknown>;
  evaluate?(script: string): Promise<unknown>;
}

export const FETCH_SCRIPT: string;
export function parseBrowserFetchRequest(raw: string): BrowserFetchPluginRequest;
export function executeBrowserFetch(page: BrowserFetchPluginPage, raw: string): Promise<unknown>;
