# Workspace and global upgrade

Use `depa-codument status` to inspect the target project. For a new project,
`depa-codument init-workspace [path]` creates the project-owned `codument/` App
without global installation. `depa-codument init [path] --agent=claude,codex,eidolon`
combines project initialization with global guidance installation.

`depa-codument init-global --agent=claude,codex,eidolon` installs the complete
global App for the selected agents without creating a project App. These agent
names are installation choices, not the Codex runtime scope of Serve/MCP tasks.
Use each command's help for its supported arguments; a Skill installation
directory must not replace the project's `codument/` asset root. These commands
do not configure MCP or Claude Desktop for the user.

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
