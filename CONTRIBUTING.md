# Contributing to Mudpie

Thank you for your interest in contributing to Mudpie (Mastodon URL Discussion Protocol)! We welcome bug reports, protocol improvements, feature enhancements, documentation updates, and test additions.

---

## Branching Strategy & Governance

To maintain stability and ensure deterministic releases, Mudpie uses a strict PR-driven workflow:

- **Protected Main Branch:** The `main` branch represents the canonical, always-deployable state of the repository. Direct pushes and force pushes to `main` are prohibited.
- **Pull Requests Only:** All modifications—including bug fixes, features, and documentation—must be submitted via pull requests targeting `main`.
- **Branch Naming Conventions:** Create focused topic branches from `main` using descriptive prefixes:
  - `feature/<short-description>`: New functionality or capabilities.
  - `fix/<short-description>`: Bug fixes and error corrections.
  - `docs/<short-description>`: Documentation, guides, or RFC updates.
  - `ci/<short-description>`: CI workflows, container configuration, and build scripts.
  - `refactor/<short-description>`: Code cleanup and internal refactoring without behavioral changes.

---

## Local Development & Containerized Testing

Mudpie uses containerized builds to ensure 100% environment parity between local development machines and CI runners.

### Prerequisites

- **Podman** (preferred) or **Docker**
- **Node.js** (v18+) if running tests or linters outside containers

### Build and Test Targets

Use the provided `Makefile` to build artifacts and run the full test suite:

```bash
# Build the container image and execute tests
make test

# Build extension packages (.zip and .xpi) into dist/
make build

# Clean up build artifacts
make clean
```

Before submitting a pull request, ensure `make test` and `make build` succeed locally without errors.

---

## Submitting a Pull Request

1. **Fork & Branch:** Create a branch from the latest `main` commit.
2. **Implement Changes:** Write clean, modular code adhering to existing project conventions and [RFC-MUDP-0001](RFC.md).
3. **Add / Update Tests:** Add test cases in `tests/*.test.js` for new logic or bug fixes.
4. **Validate Locally:** Verify all tests pass with `make test`.
5. **Open Pull Request:** Open a pull request targeting `main`. Fill out all sections of the [Pull Request Template](.github/pull_request_template.md).
6. **CI Verification:** Every pull request automatically triggers the containerized GitHub Actions CI workflow (`build-and-test`). Merging requires a passing status check and an approved review.

---

## Code Style & Guidelines

- **Protocol Conformance:** Ensure all core URL normalization, hashing, and post builder logic strictly conforms to RFC-MUDP-0001.
- **Modern JavaScript:** Use standard ES Modules (`import`/`export`) without external build-step transpilers where possible.
- **Test Coverage:** All core protocol functions must have unit test coverage using Node's native test runner (`node:test`).
- **No Background Fetching:** Extension contributions must honor RFC Section 11 (strict prohibition of auto-fetching / polling without explicit user interaction).
