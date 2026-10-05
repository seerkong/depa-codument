# Release verification and recovery

Run scripts with Bun. Source candidate: `/private/tmp/halfcode-cli-public-release-NRFNf0/candidate`.
The original publisher receipt remains in that temporary root; `upload-ledger.json` is the durable upload acknowledgement ledger.

## Safety boundaries

- `release-public.mjs audit RELEASE RECEIPT` audits only the explicit 21-package shared allowlist.
- `release-public.mjs publish RELEASE upload-ledger.json` resumes acknowledged submissions without re-uploading them. It rejects conflicting published integrity. Successful submission is not successful publication.
- `observe-registry.mjs RELEASE OUTPUT` independently downloads publicly visible tarballs and checks SHA-512 against the tested candidate.
- `release-public.mjs verify RELEASE RECEIPT` requires all versions to be publicly visible with matching integrity.
- npm credentials remain in the existing user npmrc, bound to `registry.npmjs.com`; logs contain no token values. Never modify credential scope or account security settings to bypass a challenge.
- Product/native/vendor artifacts in the local test release set are explicitly excluded from publication.

## After all 21 packages are live

1. `public-lock.mjs rewrite project/bun.lock OUTPUT` replaces registry URLs and publisher integrity only after confirming every exact locked version exists on npmjs. It preserves the dependency graph and versions.
2. Run Bun install with public registry, then `public-consumers.mjs RELEASE OUTPUT`. This exercises npm installation, all shared entrypoints, the actual clone generator, a clean depa workspace install, full checks, build and isolated binary smoke. No global installation or model calls.
3. `migrate-names.mjs verify-protection` compares eight protected original/global paths to the pre-edit baseline.

Do not change a published candidate in place. Any necessary shared-code change requires a new version, new candidate, new validation and a separately recorded publication decision.
