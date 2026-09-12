# depa-codument-domain-support

Concrete workspace effects for domain ports. The initial adapter implements real
verification execution and content-addressed receipt storage. It requires an
absolute root, environment, output sink, clock and canonical Track locator.

Git tracked and untracked/nonignored source content participates in the existing
v1 fingerprint; non-Git workspaces use the original fallback exclusions. Only the
selected Track's authority, analysis and reports are excluded as control-plane
content. Receipts are written atomically through the public Workspace effect.

`readXnlRegistrySources` snapshots recursive nonhidden XNL sources from an explicit
root, preserving byte content and rejecting source symlinks/disappearing files.

`createFileLifecycleRepository` binds an absolute workspace, resource directory,
optional local ProjectRef locations, a pure codec and an archive naming policy.
It compares original source bytes, preserves file mode, moves entire resource
directories and appends portable binding receipts. Failed file publication rolls
back owned directory/receipt changes without overwriting observed manual edits.
It rejects duplicate authorities, occupied destinations, nonregular/symlink
authorities, malformed UTF-8 and required-file omissions.

A workspace-wide exclusive directory lock serializes cooperating CLI processes.
There is no automatic stale-lock stealing. Failed rollback retains its journal;
a successful publication followed by failed lock cleanup returns a maintenance
warning rather than pretending the publication failed. Arbitrary editors do not
participate in this protocol, so they can still race the final rename. This is
not a crash-atomic multi-file transaction or a cross-workspace distributed lock.
Migration/recovery automation and complete semantic admission remain separate,
unfinished work; the supplied lifecycle codec currently checks the new envelope
and structural fields, not the full domain validation contract.
