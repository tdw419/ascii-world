# add-terminal-clone-pixelrts

## Summary

Build a hybrid system that "rips" terminals from VMs and renders them as PixelRTS tiles with native PTY support for local shells.

## Motivation

Geometry OS needs a way to:
1. Extract terminal content from VM framebuffers
2. Render terminals as GPU textures on the infinite map
3. Provide native PTY shells for interactive use
4. Auto-detect and spawn terminal tiles when VMs boot

## Approach

**Architecture**: PTY engine (Rust/nix::pty) → TerminalEmulator (VT100/ANSI) → TerminalBuffer (cells) → GPU shader (WGSL) → VAT placement (Python)

**Reuse**: 80% of infrastructure exists:
- TerminalEmulator (1324 lines) - VT100/ANSI parsing
- FONT_8X16 atlas (8x16 bitmap)
- VATManager (focal-point placement)
- ExtractionPipeline (OCR + widget detection)

**New Code**: ~500 LoC across 6 tasks

## Impact

- **Files affected**: `systems/infinite_map_rs/src/terminal_clone/`, `systems/visual_shell/api/`
- **Dependencies**: nix crate needs `term`, `pty` features
- **Breaking changes**: None

## Related

- Spec: `specs/terminal-clone-pixelrts/`
- Plan: `docs/plans/2026-02-20-terminal-clone-pixelrts.md`
- Team: `ai_project_management/teams/terminal-clone-team.yaml`
