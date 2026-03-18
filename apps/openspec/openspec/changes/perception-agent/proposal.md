# Perception Agent

## Summary

Create a PerceptionAgent that wraps the Visual Extraction Pipeline as a swarm-capable agent, enabling any agent in the collective to "see" and analyze pixel-based interfaces.

## Motivation

This change implements the architecture described below, enabling spec-driven development
and verification of the implementation.

## Architecture

PerceptionAgent subclasses WorkerAgent and exposes `extract_visuals` capability. It imports the extraction_pipeline from the shotcut-on-the-map track and returns widgets + ASCII scene graphs to requesting agents.

## Tech Stack

Python, asyncio, websockets, dataclasses, Tesseract OCR (via extraction_pipeline)

## Files

| File | Purpose |
|------|---------|
| (See tasks.md for detailed file list) | |

## Success Criteria

- [ ] All tasks in tasks.md are completed
- [ ] Tests pass
- [ ] Documentation updated

## Related

- Source Plan: `docs/plans/2026-02-19-perception-agent.md`
