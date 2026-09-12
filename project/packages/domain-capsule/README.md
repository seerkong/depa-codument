# depa-codument-domain-capsule

`createDomainOwner` binds explicit repository, verification and clock ports. It
serializes operations on the same resource, permits independent resources to
proceed, closes admission before draining work, and releases only capabilities
explicitly transferred through `release`.

Verification precedes task completion; unfinished TaskGroups do not launch the
verifier. The repository must compare source revisions at commit so an edit made
while verification runs cannot be overwritten. This in-process owner is not a
cross-process filesystem lock or the future multi-file migration transaction.
