/// <reference path="./text-assets.d.ts" />
import migrationBootstrap from "./workspace-assets/skills/codument-migrate/references/bootstrap.md" with { type: "text" };
import contextLoading from "./workspace-assets/codument/std/protocols/context-loading.md" with { type: "text" };
// Static text imports are bundled by Bun, including compiled executables.
// Project-owned templates are current installation inputs. The std/ and skills/
// entries are legacy migration fingerprints and the frozen cost baseline only;
// they are not current global guidance. The complete global App is owned by
// templates/agents/global/skills/depa-codument/ and loaded via global-guidance.ts.
import asset0 from "./workspace-assets/codument/README.md" with { type: "text" };
import asset1 from "./workspace-assets/codument/SKILL.md" with { type: "text" };
import asset2 from "./workspace-assets/codument/attractors/product.md" with { type: "text" };
import asset3 from "./workspace-assets/codument/attractors/project.md" with { type: "text" };
import asset4 from "./workspace-assets/codument/backlog/README.md" with { type: "text" };
import asset5 from "./workspace-assets/codument/config/attractor-profiles.xnl" with { type: "text" };
import asset8 from "./workspace-assets/codument/config/operation-hooks.xnl" with { type: "text" };
import asset9 from "./workspace-assets/codument/memory/README.md" with { type: "text" };
import asset10 from "./workspace-assets/codument/missions/README.md" with { type: "text" };
import asset11 from "./workspace-assets/codument/sop/README.md" with { type: "text" };
import asset12 from "./workspace-assets/codument/std/AGENTS.md" with { type: "text" };
import asset13 from "./workspace-assets/codument/std/attractors/depa-attractor.md" with { type: "text" };
import asset14 from "./workspace-assets/codument/std/attractors/knowledge-tiers.md" with { type: "text" };
import asset16 from "./workspace-assets/codument/std/attractors/project-memory.md" with { type: "text" };
import asset17 from "./workspace-assets/codument/std/commands/archive-track.md" with { type: "text" };
import asset19 from "./workspace-assets/codument/std/commands/upgrade-workspace.md" with { type: "text" };
import asset20 from "./workspace-assets/codument/std/compat/README.md" with { type: "text" };
import asset21 from "./workspace-assets/codument/std/kernel-pointer.md" with { type: "text" };
import asset22 from "./workspace-assets/codument/std/methods/dag-execution.md" with { type: "text" };
import asset23 from "./workspace-assets/codument/std/methods/tdd.md" with { type: "text" };
import asset24 from "./workspace-assets/codument/std/methods/workflow.md" with { type: "text" };
import asset25 from "./workspace-assets/codument/std/operations/README.md" with { type: "text" };
import asset26 from "./workspace-assets/codument/std/operations/_operation-spec.md" with { type: "text" };
import asset27 from "./workspace-assets/codument/std/operations/archive-mission.md" with { type: "text" };
import asset28 from "./workspace-assets/codument/std/operations/archive-track.md" with { type: "text" };
import asset29 from "./workspace-assets/codument/std/operations/artifact-sync.md" with { type: "text" };
import asset30 from "./workspace-assets/codument/std/operations/discuss.md" with { type: "text" };
import asset32 from "./workspace-assets/codument/std/operations/gap-loop.md" with { type: "text" };
import asset33 from "./workspace-assets/codument/std/operations/impl-mission.md" with { type: "text" };
import asset34 from "./workspace-assets/codument/std/operations/impl-quick.md" with { type: "text" };
import asset35 from "./workspace-assets/codument/std/operations/impl-track.md" with { type: "text" };
import asset36 from "./workspace-assets/codument/std/operations/maintain-track.md" with { type: "text" };
import asset37 from "./workspace-assets/codument/std/operations/migrate.md" with { type: "text" };
import asset38 from "./workspace-assets/codument/std/operations/plan-mission.md" with { type: "text" };
import asset39 from "./workspace-assets/codument/std/operations/plan-track.md" with { type: "text" };
import asset40 from "./workspace-assets/codument/std/operations/validate.md" with { type: "text" };
import asset41 from "./workspace-assets/codument/std/operations/verify.md" with { type: "text" };
import asset42 from "./workspace-assets/codument/std/protocols/attractor-check.md" with { type: "text" };
import asset43 from "./workspace-assets/codument/std/protocols/cybernetic-loop.md" with { type: "text" };
import asset44 from "./workspace-assets/codument/std/protocols/decision-tree.md" with { type: "text" };
import asset45 from "./workspace-assets/codument/std/protocols/questioning.md" with { type: "text" };
import asset46 from "./workspace-assets/codument/std/protocols/validation.md" with { type: "text" };
import asset51 from "./workspace-assets/codument/std/spec/decision-registry.md" with { type: "text" };
import asset55 from "./workspace-assets/codument/std/spec/flow-notation.md" with { type: "text" };
import asset56 from "./workspace-assets/codument/std/spec/folder-manifest.md" with { type: "text" };
import asset57 from "./workspace-assets/codument/std/spec/mission-xnl-spec.md" with { type: "text" };
import asset61 from "./workspace-assets/codument/std/spec/track-xnl-spec.md" with { type: "text" };
import asset62 from "./workspace-assets/codument/std/spec/xnl-format.md" with { type: "text" };
import asset63 from "./workspace-assets/codument/tracks/active/README.md" with { type: "text" };
import asset64 from "./workspace-assets/codument/tracks/archived/README.md" with { type: "text" };
import asset65 from "./workspace-assets/codument/tracks/pending/README.md" with { type: "text" };
import asset66 from "./workspace-assets/codument/workflows/README.md" with { type: "text" };
import asset67 from "./workspace-assets/skills/README.md" with { type: "text" };
import asset68 from "./workspace-assets/skills/codument-archive-mission/SKILL.md" with { type: "text" };
import asset69 from "./workspace-assets/skills/codument-archive-track/SKILL.md" with { type: "text" };
import asset70 from "./workspace-assets/skills/codument-artifact-sync/SKILL.md" with { type: "text" };
import asset71 from "./workspace-assets/skills/codument-discuss/SKILL.md" with { type: "text" };
import asset73 from "./workspace-assets/skills/codument-gap-loop/SKILL.md" with { type: "text" };
import asset74 from "./workspace-assets/skills/codument-impl-mission/SKILL.md" with { type: "text" };
import asset75 from "./workspace-assets/skills/codument-impl-quick/SKILL.md" with { type: "text" };
import asset76 from "./workspace-assets/skills/codument-impl-track/SKILL.md" with { type: "text" };
import asset77 from "./workspace-assets/skills/codument-maintain-track/SKILL.md" with { type: "text" };
import asset78 from "./workspace-assets/skills/codument-migrate/SKILL.md" with { type: "text" };
import asset79 from "./workspace-assets/skills/codument-migrate/references/decision-migration.md" with { type: "text" };
import asset80 from "./workspace-assets/skills/codument-plan-mission/SKILL.md" with { type: "text" };
import asset81 from "./workspace-assets/skills/codument-plan-track/SKILL.md" with { type: "text" };
import asset82 from "./workspace-assets/skills/codument-validate/SKILL.md" with { type: "text" };
import asset83 from "./workspace-assets/skills/codument-verify/SKILL.md" with { type: "text" };
import asset84 from "./workspace-assets/codument/std/protocols/depa-package-role.md" with { type: "text" };

export const CODUMENT_WORKSPACE_ASSETS = Object.freeze([
  Object.freeze({ path: "codument/std/protocols/context-loading.md", source: contextLoading }),
  Object.freeze({ path: "codument/README.md", source: asset0 }),
  Object.freeze({ path: "codument/SKILL.md", source: asset1 }),
  Object.freeze({ path: "codument/attractors/product.md", source: asset2 }),
  Object.freeze({ path: "codument/attractors/project.md", source: asset3 }),
  Object.freeze({ path: "codument/backlog/README.md", source: asset4 }),
  Object.freeze({ path: "codument/config/attractor-profiles.xnl", source: asset5 }),
  Object.freeze({ path: "codument/config/operation-hooks.xnl", source: asset8 }),
  Object.freeze({ path: "codument/memory/README.md", source: asset9 }),
  Object.freeze({ path: "codument/missions/README.md", source: asset10 }),
  Object.freeze({ path: "codument/sop/README.md", source: asset11 }),
  Object.freeze({ path: "codument/std/AGENTS.md", source: asset12 }),
  Object.freeze({ path: "codument/std/attractors/depa-attractor.md", source: asset13 }),
  Object.freeze({ path: "codument/std/attractors/knowledge-tiers.md", source: asset14 }),
  Object.freeze({ path: "codument/std/attractors/project-memory.md", source: asset16 }),
  Object.freeze({ path: "codument/std/commands/archive-track.md", source: asset17 }),
  Object.freeze({ path: "codument/std/commands/upgrade-workspace.md", source: asset19 }),
  Object.freeze({ path: "codument/std/compat/README.md", source: asset20 }),
  Object.freeze({ path: "codument/std/kernel-pointer.md", source: asset21 }),
  Object.freeze({ path: "codument/std/methods/dag-execution.md", source: asset22 }),
  Object.freeze({ path: "codument/std/methods/tdd.md", source: asset23 }),
  Object.freeze({ path: "codument/std/methods/workflow.md", source: asset24 }),
  Object.freeze({ path: "codument/std/operations/README.md", source: asset25 }),
  Object.freeze({ path: "codument/std/operations/_operation-spec.md", source: asset26 }),
  Object.freeze({ path: "codument/std/operations/archive-mission.md", source: asset27 }),
  Object.freeze({ path: "codument/std/operations/archive-track.md", source: asset28 }),
  Object.freeze({ path: "codument/std/operations/artifact-sync.md", source: asset29 }),
  Object.freeze({ path: "codument/std/operations/discuss.md", source: asset30 }),
  Object.freeze({ path: "codument/std/operations/gap-loop.md", source: asset32 }),
  Object.freeze({ path: "codument/std/operations/impl-mission.md", source: asset33 }),
  Object.freeze({ path: "codument/std/operations/impl-quick.md", source: asset34 }),
  Object.freeze({ path: "codument/std/operations/impl-track.md", source: asset35 }),
  Object.freeze({ path: "codument/std/operations/maintain-track.md", source: asset36 }),
  Object.freeze({ path: "codument/std/operations/migrate.md", source: asset37 }),
  Object.freeze({ path: "codument/std/operations/plan-mission.md", source: asset38 }),
  Object.freeze({ path: "codument/std/operations/plan-track.md", source: asset39 }),
  Object.freeze({ path: "codument/std/operations/validate.md", source: asset40 }),
  Object.freeze({ path: "codument/std/operations/verify.md", source: asset41 }),
  Object.freeze({ path: "codument/std/protocols/attractor-check.md", source: asset42 }),
  Object.freeze({ path: "codument/std/protocols/cybernetic-loop.md", source: asset43 }),
  Object.freeze({ path: "codument/std/protocols/decision-tree.md", source: asset44 }),
  Object.freeze({ path: "codument/std/protocols/questioning.md", source: asset45 }),
  Object.freeze({ path: "codument/std/protocols/validation.md", source: asset46 }),
  Object.freeze({ path: "codument/std/spec/decision-registry.md", source: asset51 }),
  Object.freeze({ path: "codument/std/spec/flow-notation.md", source: asset55 }),
  Object.freeze({ path: "codument/std/spec/folder-manifest.md", source: asset56 }),
  Object.freeze({ path: "codument/std/spec/mission-xnl-spec.md", source: asset57 }),
  Object.freeze({ path: "codument/std/spec/track-xnl-spec.md", source: asset61 }),
  Object.freeze({ path: "codument/std/spec/xnl-format.md", source: asset62 }),
  Object.freeze({ path: "codument/tracks/active/README.md", source: asset63 }),
  Object.freeze({ path: "codument/tracks/archived/README.md", source: asset64 }),
  Object.freeze({ path: "codument/tracks/pending/README.md", source: asset65 }),
  Object.freeze({ path: "codument/workflows/README.md", source: asset66 }),
  Object.freeze({ path: "skills/README.md", source: asset67 }),
  Object.freeze({ path: "skills/codument-archive-mission/SKILL.md", source: asset68 }),
  Object.freeze({ path: "skills/codument-archive-track/SKILL.md", source: asset69 }),
  Object.freeze({ path: "skills/codument-artifact-sync/SKILL.md", source: asset70 }),
  Object.freeze({ path: "skills/codument-discuss/SKILL.md", source: asset71 }),
  Object.freeze({ path: "skills/codument-gap-loop/SKILL.md", source: asset73 }),
  Object.freeze({ path: "skills/codument-impl-mission/SKILL.md", source: asset74 }),
  Object.freeze({ path: "skills/codument-impl-quick/SKILL.md", source: asset75 }),
  Object.freeze({ path: "skills/codument-impl-track/SKILL.md", source: asset76 }),
  Object.freeze({ path: "skills/codument-maintain-track/SKILL.md", source: asset77 }),
  Object.freeze({ path: "skills/codument-migrate/SKILL.md", source: asset78 }),
  Object.freeze({ path: "skills/codument-migrate/references/decision-migration.md", source: asset79 }),
  Object.freeze({ path: "skills/codument-plan-mission/SKILL.md", source: asset80 }),
  Object.freeze({ path: "skills/codument-plan-track/SKILL.md", source: asset81 }),
  Object.freeze({ path: "skills/codument-validate/SKILL.md", source: asset82 }),
  Object.freeze({ path: "skills/codument-verify/SKILL.md", source: asset83 }),
  Object.freeze({ path: "codument/std/protocols/depa-package-role.md", source: asset84 }),
  Object.freeze({ path: "skills/codument-migrate/references/bootstrap.md", source: migrationBootstrap }),
]);
