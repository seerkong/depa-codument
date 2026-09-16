import type { LifecycleKind } from './lifecycle';
import type { OwnedLifecycleSnapshot } from './operations';

/** An observed local calendar, not an implicit clock/timezone dependency. */
export interface ArchiveCalendar {readonly year: number; readonly month: number; readonly day: number; readonly hour: number; readonly minute: number}
export interface ArchiveRequest {
  readonly kind: LifecycleKind;
  readonly id: string;
  readonly yes?: boolean;
}
export interface ArchiveTrackSelector {
  readonly trackId: string;
  readonly projectRef?: string;
  readonly projectKind: 'host' | 'external';
}
export interface ArchiveTrackObservation extends ArchiveTrackSelector {
  readonly stage: 'pending' | 'active' | 'archived' | 'missing' | 'unbound';
}
export type ArchiveRegistry = 'decisions' | 'memory';
export interface ArchiveSourceSnapshot {
  readonly request: ArchiveRequest;
  readonly process: OwnedLifecycleSnapshot;
  /** Text candidates keyed relative to the process directory. The adapter also
   * guards all binary/unknown files while moving the complete directory. */
  readonly processSources: ReadonlyMap<string, string>;
  readonly registries: Readonly<Record<ArchiveRegistry, ReadonlyMap<string, string>>>;
  readonly configs: {readonly profiles?: string; readonly modeling?: string; readonly engineering?: string};
  readonly linkedTracks: readonly ArchiveTrackObservation[];
  readonly nowIso: string;
  readonly calendar: ArchiveCalendar;
  /** Portable codument/... destination selected without creating it. */
  readonly destination: string;
  readonly sourceRevision: string;
}
export interface ArchivePublication {
  readonly registryUpdates: Readonly<Partial<Record<ArchiveRegistry, ReadonlyMap<string, string>>>>;
  /** Only the lifecycle root and derived summary may change in the moved tree. */
  readonly processUpdates: ReadonlyMap<string, string>;
  readonly warnings: readonly string[];
  readonly promotedMemory: readonly string[];
}
export interface ArchiveReceipt {
  readonly kind: LifecycleKind;
  readonly id: string;
  readonly directory: string;
  readonly updated: Readonly<Partial<Record<ArchiveRegistry, readonly string[]>>>;
  readonly summary?: string;
  readonly warnings: readonly string[];
  readonly promotedMemory?: readonly string[];
  readonly maintenanceWarnings?: readonly string[];
}
export interface ArchiveSourcePort {
  observe(input: ArchiveRequest): Promise<ArchiveSourceSnapshot>;
  /** All publication and the process move share a guarded recovery boundary.
   * A failed restore retains its journal/backups; unrelated edits survive. */
  publish(snapshot: ArchiveSourceSnapshot, proposal: ArchivePublication): Promise<ArchiveReceipt>;
}
