# Release

The npm package is `@protoline/protoline`; the executable is `protoline`.

## Manual checks

Run these checks before any release:

```sh
npm ci
npm test
npm audit --omit=dev
npm pack --dry-run
```

Inspect the dry-run tarball output. The package should contain only:

- `README.md`
- `bin/protoline.mjs`
- `package.json`

## Trusted publishing setup

npm trusted publishing requires the package to exist before the trusted
publisher can be configured.

For the first release:

1. Publish `@protoline/protoline` manually with an npm account that has 2FA.
2. In npm package settings, add a trusted publisher for:
   - Provider: GitHub Actions
   - Owner: `protolineai`
   - Repository: `protoline`
   - Workflow file: `publish.yml`
   - Environment: `npm`
   - Allowed action: `npm publish`
3. After a CI publish succeeds, restrict package publishing access to require
   2FA and disallow traditional token publishing.

Future releases should be published by pushing a version tag:

```sh
git tag v0.1.1
git push origin v0.1.1
```

The workflow uses OIDC and does not require an npm token.
