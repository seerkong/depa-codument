export interface PageSessionLike {
  send(method: string, params?: Record<string, unknown>): Promise<unknown>;
}

export function queryValue(input: unknown): string;
export function submitExpression(query: string): string;
export const extractExpression: string;
export const GoogleSearchPage: Record<string, (...args: any[]) => Promise<any>>;
export const GoogleSearchWorkflow: Record<string, (...args: any[]) => Promise<any>>;
export const DemoPage: Record<string, (...args: any[]) => Promise<any>>;
export function normalizeOwidInput(input: unknown): Record<string, unknown>;
export function decodeZipEntries(bytes: Uint8Array): Map<string, Uint8Array>;
export function parseCsv(text: string): string[][];
export function processOwidArchive(artifact: { bytes: Uint8Array; [key: string]: unknown }, input: unknown): Record<string, unknown>;
export const OwidChartPage: Record<string, (...args: any[]) => Promise<any>>;
export const OwidChartActions: Record<string, (...args: any[]) => Promise<any>>;
export const OpenDataExportPage: Record<string, (...args: any[]) => Promise<any>>;
export const OwidOpenDataWorkflow: Record<string, (...args: any[]) => Promise<any>>;
export const resourceDefinitions: readonly unknown[];
