## Description

Please provide a concise description of the changes introduced in this pull request and the rationale behind them.

- **Issue Reference:** Closes #
- **Change Category:**
  - [ ] Bug fix
  - [ ] New feature
  - [ ] Refactoring
  - [ ] Documentation update
  - [ ] CI / Infrastructure / Build tooling

---

## Affected Components

- [ ] Core Protocol (`packages/core/`)
- [ ] Firefox Extension (`packages/extensions/firefox/`)
- [ ] Chrome Extension (`packages/extensions/chrome/`)
- [ ] Shared Extension UI (`packages/extensions/shared/`)
- [ ] Bookmarklets (`packages/bookmarklets/`)
- [ ] Documentation (`README.md`, `RFC.md`, etc.)
- [ ] CI & Build Tooling (`.github/`, `scripts/`, `Makefile`, `Containerfile`)

---

## Verification & Testing

Explain how the changes were verified:

1. **Local Container Test:** Run `make test` (or `podman run --rm mudpie npm --test ...`)
2. **Local Container Build:** Run `make build` (or verify package generation in `dist/`)
3. **Manual Browser Test (if applicable):** Tested temporary add-on in Firefox / Chrome.

---

## Contributor Checklist

- [ ] My code adheres to the existing project code style and conventions.
- [ ] I have executed `make test` locally and all tests pass without errors.
- [ ] I have updated corresponding documentation or RFC specs if necessary.
- [ ] My commits are focused and clearly describe the changes made.
- [ ] I understand that changes must be submitted via pull request and merge requires green CI checks.
