import type { DomainOperationRuntime, DomainOwner } from 'depa-codument-domain-contract/operations';
import { projectTrackExecutionContext } from 'depa-codument-domain-logic';
import { applyArchive, applyDomainOperation, applyScaffold, applyWorkspaceBinding, inspectDecisionQuery, inspectDomainValidation, inspectStdDocumentation, proposeDecisionCreation, readyTrackTasks, runTrackVerification, runDomainQuery, syncArtifacts } from 'depa-codument-domain-logic';

/** Per-workspace admission/drain and per-resource operation ordering.
 * Repository CAS remains necessary for changes from other processes/editors.
 * Injected ports are borrowed unless release is explicitly supplied. */
export function createDomainOwner(bindings: DomainOperationRuntime, options: { release?: () => Promise<void> } = {}): DomainOwner {
  const runtime = { ...bindings, contextSources: bindings.contextSources ? { ...bindings.contextSources } : undefined };
  const release = options.release;
  const tails = new Map<string, Promise<void>>();
  let closed = false;
  let closing: Promise<void> | undefined;

  function admit<T>(key: string, action: () => Promise<T>): Promise<T> {
    if (closed) return Promise.reject(new Error('Domain owner is closed.'));
    const pending = (tails.get(key) ?? Promise.resolve()).then(action);
    const settled = pending.then(() => undefined, () => undefined);
    tails.set(key, settled);
    void settled.then(() => { if (tails.get(key) === settled) tails.delete(key); });
    return pending;
  }

  return {
    archive(request) {
      const input = structuredClone(request);
      return admit(`${input.kind}:${input.id}`, async () => {
        if (!runtime.archive) throw new Error('Archive ports are not configured.');
        return applyArchive(runtime.archive, input);
      });
    },
    syncArtifacts(request) {
      const input = structuredClone(request);
      return admit('artifact-sync', async () => {
        if (!runtime.artifacts) throw new Error('Artifact sync port is not configured.');
        return syncArtifacts(runtime.artifacts, input);
      });
    },
    lintStd(directory) {
      return admit('std-lint', async () => {
        if (!runtime.stdDocumentation) throw new Error('Std documentation source port is not configured.');
        return inspectStdDocumentation(await runtime.stdDocumentation.observe(directory));
      });
    },
    validate(request) {
      const input = structuredClone(request);
      return admit('validate', async () => {
        if (!runtime.validationSources) throw new Error('Domain validation source port is not configured.');
        return inspectDomainValidation(await runtime.validationSources.observe(input.target), input);
      });
    },
    scaffold(request) {
      const input = structuredClone(request);
      const kind = input.kind === 'Mission' ? 'mission' : 'track';
      return admit(`${kind}:${input.id}`, () => applyScaffold(runtime, input));
    },
    query(request) {
      const input = structuredClone(request);
      return admit('query', () => runDomainQuery(runtime, input));
    },
    project(request) {
      const input = structuredClone(request);
      return admit('workspace-bindings', () => {
        if (!runtime.projectBindings) throw new Error('Workspace binding port is not configured.');
        return applyWorkspaceBinding(runtime.projectBindings, input);
      });
    },
    createDecision(request) {
      const input = structuredClone(request);
      return admit(`decision-file:${input.file}`, async () => {
        if (!runtime.decisionWrites) throw new Error('Decision write port is not configured.');
        const source = await runtime.decisionWrites.read(input.file);
        const proposed = proposeDecisionCreation(source.source, input);
        const receipt = await runtime.decisionWrites.commit(source, proposed);
        return { ...receipt, id: input.id, parent: input.parent, specVersion: 1 as const };
      });
    },
    decisions(request) {
      const input = structuredClone(request);
      return admit(`decisions:${input.target ?? ''}`, async () => {
        if (!runtime.decisions) throw new Error('Decision source port is not configured.');
        const source = await runtime.decisions.read(input.target);
        const result = inspectDecisionQuery(source.sources);
        const findings = [...source.findings, ...result.findings];
        return { display: source.display, findings,
          frontier: findings.some(finding => finding.severity === 'error') ? [] : result.frontier };
      });
    },
    apply(request) {
      const input = structuredClone(request);
      return admit(`${input.kind}:${input.id}`, () => applyDomainOperation(runtime, input));
    },
    ready(track) {
      return admit(`track:${track}`, async () => readyTrackTasks(await runtime.repository.load({ kind: 'track', id: track }, { includeArchived: false })));
    },
    context(track) {
      return admit(`track:${track}`, async () => projectTrackExecutionContext(await runtime.repository.load({ kind: 'track', id: track }, { includeArchived: true }), runtime.contextSources?.profiles));
    },
    verify(request) {
      const input = structuredClone(request);
      return admit(`track:${input.track}`, () => runTrackVerification(runtime.verification, input));
    },
    close() {
      if (!closing) {
        closed = true;
        closing = Promise.all([...tails.values()]).then(async () => { await release?.(); });
      }
      return closing;
    },
  };
}
