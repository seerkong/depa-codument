# depa-codument-skill-app-contract

Stable, implementation-free authoring contracts for package-authored Halfcode Skill Apps.

This package owns descriptor shapes and pure `define*` helpers. It does not perform filesystem access, schema admission, builds, dependency installation, or runtime effects. The Host always validates descriptors again before execution.

`defineSkillApp` owns the exact module, PageBundle, Site, and direct-resource membership of an app package. `defineSkillModule` owns one module's HostBundle FQN and its directly discovered non-Host resources. Their XNL manifests only select the package profile and provide location/Kind discovery; they do not repeat exact membership.

A module keeps composition and executable Host logic separate: its default descriptor is created with `defineSkillModule`, while the HostBundle points to a distinct module that exports `resourceDefinitions` (and may also default-export `defineHostModule(...)`).

The `./resource` entry point is a thin façade over the exact
`halfcode-compiler.xnl` resource contract types and pure revision factory.
`defineResourceContractRegistrations` only freezes portable registrations; it
does not admit owners, build registries, select a reader, or calculate a lock.
Those authority decisions remain in the Host composition root.

`createSkillAppKindContractDescriptors({ ownerPackageId, contractAuthority })`
derives the exact contract set for a package identity. The default
`SKILL_APP_KIND_CONTRACT_DESCRIPTORS` export is produced by that same factory,
and `renderSkillAppKindDefinition` renders its canonical XNL source. Clone and
authoring tools should use these helpers instead of copying fingerprints or
reimplementing compiler hashing rules.
