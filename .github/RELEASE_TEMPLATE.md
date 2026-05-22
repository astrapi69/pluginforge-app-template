# MyApp vX.Y.Z

> **Static reference template.** Copy the relevant sections into
> `changelog/releases/vX.Y.Z.md` before invoking
> `gh release create --notes-file ...` (release-workflow.md Step 8).
> No automation reads this file; it exists so every release
> reuses the same prerequisites + verification block instead of
> being rewritten from memory.

<!--
TEMPLATE: customise per project. The "Before you install"
section assumes a Docker-shipped app + cross-OS launcher
binaries. If your deployment model differs (server-only, npm
package, plain Docker image, etc.), rewrite that block. Keep
"Download" + "Verifying downloads" + "What's new" as the
load-bearing structure.
-->

## Before you install

MyApp ships as a self-contained launcher binary (per OS) that
boots the backend, opens the frontend in your browser, and
manages updates.

<!-- TODO: if MyApp also requires Docker (or another external
runtime), say so explicitly here and link to a per-OS install
guide. -->

The first launch may take several minutes while initial assets
are downloaded; subsequent launches start in seconds.

## Download

| Platform | File |
|----------|------|
| Windows | `myapp-launcher.exe` |
| macOS (Apple silicon) | `myapp-launcher-macos.zip` |
| Linux | `myapp-launcher-linux` (ELF binary) |

Each platform also ships a `*.sha256` checksum next to the binary.

## Verifying downloads

```bash
# macOS / Linux
shasum -a 256 myapp-launcher-<platform>
cat myapp-launcher-<platform>.sha256
```

```powershell
# Windows
Get-FileHash -Algorithm SHA256 .\myapp-launcher.exe
Get-Content .\myapp-launcher.exe.sha256
```

The hashes must match.

If your operating system warns about an unsigned binary, see
the project's installation overview (link it from the release
once your installation doc exists).

## What's new

<!-- Paste the per-version changelog excerpt here. Keep the
"Before you install", "Download", and "Verifying downloads"
sections above unchanged across releases; only the changelog
varies. -->
