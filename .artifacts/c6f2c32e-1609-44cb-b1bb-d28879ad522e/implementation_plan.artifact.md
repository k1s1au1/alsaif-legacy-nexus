# Implementation Plan - Lowering Desktop Breakpoints for "Desktop Site" Support

This plan aims to fix the issue where selecting "Desktop site" on mobile browsers doesn't trigger the desktop layout. We will lower the desktop threshold from 1024px/1200px to **970px** across the codebase.

## User Review Required

> [!IMPORTANT]
> This change will cause tablets with a width between 970px and 1023px (like some iPads in portrait or landscape) to display the **Desktop UI** instead of the **Tablet UI**. This is generally preferred for a "Desktop-first" experience but should be noted.

## Proposed Changes

### [CSS Stylesheets]

#### [MODIFY] [desktop-dashboard.css](file:///C:/Projects/alsaif-legacy-nexus-b14dc257/src/desktop-dashboard.css)
- Change `@media (min-width: 1024px)` to `@media (min-width: 970px)`.

#### [MODIFY] [desktop-sidebar.css](file:///C:/Projects/alsaif-legacy-nexus-b14dc257/src/desktop-sidebar.css)
- Change `@media (min-width: 1200px)` to `@media (min-width: 970px)`.

#### [MODIFY] [mobile-tablet-hero.css](file:///C:/Projects/alsaif-legacy-nexus-b14dc257/src/mobile-tablet-hero.css)
- Change `@media (max-width: 1023px)` to `@media (max-width: 969.98px)`.
- Change `@media (min-width: 1024px)` to `@media (min-width: 970px)`.

#### [MODIFY] [ipad-tablet-override.css](file:///C:/Projects/alsaif-legacy-nexus-b14dc257/src/ipad-tablet-override.css)
- Change `@media (min-width: 600px) and (max-width: 1199.98px)` to `@media (min-width: 600px) and (max-width: 969.98px)`.
- Change `orientation:landscape` media query accordingly.

#### [MODIFY] [tablet-bottom-nav.css](file:///C:/Projects/alsaif-legacy-nexus-b14dc257/src/tablet-bottom-nav.css)
- Change `@media (min-width: 768px) and (max-width: 1023.98px)` to `@media (min-width: 768px) and (max-width: 969.98px)`.

### [Main Application Logic]

#### [MODIFY] [__root.tsx](file:///C:/Projects/alsaif-legacy-nexus-b14dc257/src/routes/__root.tsx)
- Update `window.innerWidth >= 1200` to `window.innerWidth >= 970` for the `showDesktopDashboard` variable.

## Verification Plan

### Manual Verification
- The user can test by selecting "Desktop site" on their Android device. The layout should now shift to the desktop version (showing the sidebar and desktop grid).
- Verify that on a standard desktop browser, the layout remains correct.
