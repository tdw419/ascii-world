---
spec: proactive-health-center
phase: tasks
total_tasks: 7
created: 2026-02-21T15:30:00Z
generated: auto
---

# Tasks: proactive-health-center

## Phase 1: Make It Work (POC)

Focus: Validate core flow from browser heartbeat to WordPress storage.

- [x] 1.1 WordPress Health API Endpoint
  - **Do**: Add REST API endpoints for health metrics in `geometry_os_bridge.php`
  - **Files**: `wordpress_zone/wordpress/wp-content/mu-plugins/geometry_os_bridge.php`
  - **Steps**:
    1. Add `add_action('rest_api_init', ...)` to `__construct()`
    2. Implement `register_health_api()` with POST and GET routes
    3. Implement `verify_local_request()` for security
    4. Implement `handle_health_update()` to store in option
    5. Implement `get_health_status()` to retrieve option
  - **Done when**: `curl -X GET http://localhost/wp-json/geometry-os/v1/health` returns JSON
  - **Verify**: `php -l wordpress_zone/wordpress/wp-content/mu-plugins/geometry_os_bridge.php`
  - **Commit**: `feat(wp): add REST API endpoints for health metrics`
  - _Requirements: FR-1, FR-2, FR-3, FR-4_
  - _Design: Component 1_

- [x] 1.2 Heartbeat Mechanism in wp_health_bridge.js
  - **Do**: Add 60-second heartbeat to push metrics to WordPress
  - **Files**: `systems/visual_shell/web/wp_health_bridge.js`
  - **Steps**:
    1. Add `startHealthHeartbeat()` function after `initHealthDashboard()`
    2. Add `calculateHealthScore(metrics)` helper function
    3. Modify `onReady()` to call `startHealthHeartbeat()` after init
    4. Use `setInterval(60000)` for periodic heartbeat
  - **Done when**: Console shows "[System Health] Heartbeat sent" every 60s
  - **Verify**: `node --check systems/visual_shell/web/wp_health_bridge.js`
  - **Commit**: `feat(bridge): add 60-second health heartbeat to WordPress`
  - _Requirements: FR-5, FR-6_
  - _Design: Component 2_

- [x] 1.3 WordPress Admin HUD Widget
  - **Do**: Create dashboard widget showing real-time health metrics
  - **Files**: `wordpress_zone/wordpress/wp-content/mu-plugins/geometry_os_admin_ui.php`
  - **Steps**:
    1. Add `GeometryOS_AdminHUD` class with `wp_dashboard_setup` hook
    2. Implement `render_hud()` to read option and display metrics
    3. Add inline CSS via `wp_add_inline_style()`
    4. Add refresh button and emergency reset button (disabled initially)
  - **Done when**: WordPress dashboard shows "Geometry OS Health" widget with metrics
  - **Verify**: `php -l wordpress_zone/wordpress/wp-content/mu-plugins/geometry_os_admin_ui.php`
  - **Commit**: `feat(admin): add Geometry OS health HUD to WordPress dashboard`
  - _Requirements: FR-7, AC-1.1, AC-1.3_
  - _Design: Component 3_

- [x] 1.4 Emergency Reset Endpoint
  - **Do**: Add emergency reset capability with audit logging
  - **Files**: `wordpress_zone/wordpress/wp-content/mu-plugins/geometry_os_bridge.php`
  - **Steps**:
    1. Add `/emergency-reset` route to `register_health_api()`
    2. Implement `handle_emergency_reset()` to log and forward to Visual Bridge
    3. Clear `geometry_os_health_metrics` option on reset
    4. Enable HUD button when health score < 50%
  - **Done when**: POST to `/emergency-reset` returns success and logs to telemetry
  - **Verify**: `php -l wordpress_zone/wordpress/wp-content/mu-plugins/geometry_os_bridge.php`
  - **Commit**: `feat(wp): add emergency reset endpoint with audit logging`
  - _Requirements: FR-8, FR-9, AC-3.1, AC-3.3, AC-3.4_
  - _Design: Component 4_

- [x] 1.5 POC Checkpoint
  - **Do**: Verify end-to-end flow works
  - **Done when**:
    - Browser sends heartbeat every 60s
    - WordPress admin HUD shows updated metrics
    - Emergency reset button enables at score < 50%
  - **Verify**: Manual test in WordPress admin with browser console open
  - **Commit**: `feat(health): complete POC for proactive health center`

## Phase 2: Refactoring

After POC validated, clean up and add persistence.

- [x] 2.1 Hourly Health Report Posts
  - **Do**: Add cron-generated health summary posts
  - **Files**: `wordpress_zone/wordpress/wp-content/mu-plugins/geometry_os_bridge.php`
  - **Steps**:
    1. Add `geometry_os_hourly_health_report` cron action
    2. Implement `generate_health_report()` to read telemetry and create post
    3. Implement `generate_report_content()` for HTML formatting
    4. Register `geo_health_report` custom post type
  - **Done when**: Hourly cron creates `geo_health_report` posts
  - **Verify**: `php -l wordpress_zone/wordpress/wp-content/mu-plugins/geometry_os_bridge.php`
  - **Commit**: `feat(wp): add hourly health report posts with custom post type`
  - _Requirements: FR-10, FR-11, AC-2.1, AC-2.2_
  - _Design: Component 5_

## Phase 3: Testing

- [x] 3.1 Integration Tests
  - **Do**: Create browser-based integration tests
  - **Files**: `systems/visual_shell/web/tests/test_proactive_health.js`
  - **Steps**:
    1. Create `ProactiveHealthTester` class
    2. Add tests: MetricsCollector exists, heartbeat function, health score, API endpoint
    3. Add result reporting with pass/fail summary
  - **Done when**: Tests pass when run in browser console
  - **Verify**: `node --check systems/visual_shell/web/tests/test_proactive_health.js`
  - **Commit**: `test(health): add integration tests for Proactive Health Center`
  - _Requirements: NFR-5, NFR-6_

## Phase 4: Quality Gates

- [x] 4.1 Final Verification
  - **Do**: Run all syntax checks and verify file list
  - **Files**: All modified files
  - **Steps**:
    1. Run `php -l` on all PHP files
    2. Run `node --check` on all JS files
    3. Run `git status --short` to list changes
  - **Done when**: All syntax checks pass, file list matches plan
  - **Verify**:
    ```bash
    php -l wordpress_zone/wordpress/wp-content/mu-plugins/geometry_os_bridge.php
    php -l wordpress_zone/wordpress/wp-content/mu-plugins/geometry_os_admin_ui.php
    node --check systems/visual_shell/web/wp_health_bridge.js
    node --check systems/visual_shell/web/tests/test_proactive_health.js
    ```
  - **Commit**: `feat(health): complete Proactive Health Center implementation`
  - _Requirements: All NFRs_

## Notes

- **POC shortcuts taken**: No unit tests initially, inline styles in PHP
- **Production TODOs**:
  - Add email notifications for critical health
  - Add historical charts to admin HUD
  - Consider WebSocket for real-time updates instead of polling
