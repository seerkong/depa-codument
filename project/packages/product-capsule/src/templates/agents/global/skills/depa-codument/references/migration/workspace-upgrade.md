# Workspace and global upgrade

`depa-codument upgrade-global --agent=claude,codex,eidolon` replaces the selected
global skill installations after backup. It does not upgrade a project.

`depa-codument upgrade-workspace` inspects, backs up, transforms and validates
the current project's Codument App. Success leaves project-owned assets under
`codument/`, with shared standards supplied by the global skill. It does not
refresh a project-local `codument/std/` copy.

Run `depa-codument migrate guide workspace` for the current migration protocol;
do not reproduce that control loop here. Respect `review-required`, preserve
unknown custom rules in the backup and migrate useful project rules to an
appropriate project-owned location before completing cleanup. Never treat a
new manifest or planned changes as evidence of a committed upgrade.

The receipt identifies the actual backup and result. Do not assume an old backup
directory convention. Historical completed records retain their declaration and
are not proof of revalidation against the current acceptance rules.
