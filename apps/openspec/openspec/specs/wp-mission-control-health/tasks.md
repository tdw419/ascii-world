---
spec: wp-mission-control-health
phase: tasks
total_tasks: 7
created: 2026-02-21T00:00:00Z
generated: auto
---

# Tasks: wp-mission-control-health

## Phase 1: Make It Work (POC)

Focus: MetricsCollector core + bridge integration + dashboard widget

- [x] 1.1 MetricsCollector Core
  - **Do**: Create MetricsCollector class with latency measurement, sync/tile tracking, event emission
  - **Files**: `systems/visual_shell/web/MetricsCollector.js`, `systems/visual_shell/web/tests/test_metrics_collector.js`
  - **Done when**: 5 unit tests pass (latency measure, sync count, tile count, average latency, event emission)
  - **Verify**: Open test runner in browser, verify MetricsCollector tests pass
  - **Commit**: `feat(metrics): add MetricsCollector for latency and health tracking`
  - _Requirements: FR-1, FR-2, FR-3, FR-4, FR-5_
  - _Design: MetricsCollector component_

- [x] 1.2 Integrate MetricsCollector into Bridge
  - **Do**: Wrap sendCommand for latency measurement, expose metrics accessor, track tile count
  - **Files**: `systems/visual_shell/web/application.js`, `systems/visual_shell/web/tests/verification_wp_integration.js`
  - **Done when**: Test 6 in verification_wp_integration.js passes
  - **Verify**: Run `await new WPIntegrationVerifier().runAll()` in browser console
  - **Commit**: `feat(bridge): integrate MetricsCollector into geometryOS bridge`
  - _Requirements: FR-1, FR-3, FR-5_
  - _Design: Bridge Integration section_

- [x] 1.3 SystemHealthDashboard Widget
  - **Do**: Create dashboard class that renders metrics table and listens for update events
  - **Files**: `systems/visual_shell/web/SystemHealthDashboard.js`, `systems/visual_shell/web/tests/test_system_health_dashboard.js`
  - **Done when**: 4 unit tests pass (render table, update on event, PASS for low latency, WARN for high latency)
  - **Verify**: Open test runner, verify SystemHealthDashboard tests pass
  - **Commit**: `feat(dashboard): add SystemHealthDashboard widget for real-time metrics`
  - _Requirements: FR-6, FR-7, FR-8, FR-9_
  - _Design: SystemHealthDashboard component_

- [x] 1.4 WordPress Bridge Health Integration
  - **Do**: Create wp_health_bridge.js, update PHP plugin to enqueue scripts, add Test 7
  - **Files**: `systems/visual_shell/web/wp_health_bridge.js`, `wordpress_zone/wordpress/wp-content/mu-plugins/geometry_os_bridge.php`, `systems/visual_shell/web/tests/verification_wp_integration.js`
  - **Done when**: Test 7 passes, dashboard visible in WordPress Mission Control
  - **Verify**: Load Mission Control page, run verification tests
  - **Commit**: `feat(wp): integrate SystemHealthDashboard into WordPress Mission Control`
  - _Requirements: FR-10_
  - _Design: wp_health_bridge component_

- [x] 1.5 POC Checkpoint
  - **Do**: Verify all functional tests pass end-to-end
  - **Done when**: All 7 verification tests pass, dashboard shows real metrics
  - **Verify**: `await new WPIntegrationVerifier().runAll()` shows 7/7 PASSED
  - **Commit**: `feat(health): complete POC for mission control health dashboard`

## Phase 2: Testing Infrastructure

After POC validated, add stress and resilience tests.

- [x] 2.1 Stress Test Infrastructure
  - **Do**: Create WPBridgeStressTester with 50+ tile capacity, broadcast latency, DOM performance tests
  - **Files**: `systems/visual_shell/web/tests/stress_test_wp_bridge.js`
  - **Done when**: 3 stress tests run (swarm capacity, broadcast latency, FPS)
  - **Verify**: `await new WPBridgeStressTester().runStressTests()` shows results
  - **Commit**: `test(stress): add stress test infrastructure for 50+ tile scenarios`
  - _Requirements: FR-11, FR-12, FR-13_
  - _Design: Stress test patterns_

- [x] 2.2 Resilience Test Infrastructure
  - **Do**: Create WPBridgeResilienceTester with late joiner and metrics persistence tests
  - **Files**: `systems/visual_shell/web/tests/resilience_test_wp_bridge.js`
  - **Done when**: 2 resilience tests run
  - **Verify**: `await new WPBridgeResilienceTester().runResilienceTests()` shows results
  - **Commit**: `test(resilience): add resilience tests for late joiner and metrics persistence`
  - _Requirements: FR-14, FR-15_
  - _Design: Resilience test patterns_

- [x] 2.3 Unified Test Runner
  - **Do**: Create WPUnifiedTestRunner that orchestrates all test phases and generates final report
  - **Files**: `systems/visual_shell/web/tests/run_all_wp_tests.js`
  - **Done when**: Single command runs all 12 tests (7 functional + 3 stress + 2 resilience)
  - **Verify**: `await new WPUnifiedTestRunner().runAll()` shows aggregated report
  - **Commit**: `feat(test): add unified test runner for all WordPress integration tests`
  - _Requirements: FR-16, FR-17_
  - _Design: Test orchestration_

## Phase 3: Quality Gates

- [x] 3.1 Local quality check
  - **Do**: Run all tests locally in browser
  - **Verify**: All tests pass (12/12)
  - **Done when**: Unified test runner shows "PRODUCTION READY"
  - **Commit**: `fix(tests): address any failing tests` (if needed)

- [x] 3.2 Final verification (completed 2026-02-21)
  - **Do**: Complete spec documentation and provide testing instructions for user
  - **Files**: `.progress.md`, `.ralph-state.json`, `tasks.md`
  - **Done when**: Spec documentation is complete and user has clear testing instructions
  - **Commit**: `docs(spec): complete wp-mission-control-health spec`

## Notes

- **POC shortcuts**: Inline CSS, no build step, browser-native only
- **Production TODOs**: Add server-side persistence, historical graphs, alerting
