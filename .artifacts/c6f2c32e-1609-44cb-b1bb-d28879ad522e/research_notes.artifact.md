# Research: Why "Desktop Site" doesn't change the layout

## The Problem
When a user selects **"Desktop site"** (موقع مصمم للكمبيوتر) in Google Chrome on Android:
1. The browser changes the **User Agent** to identify as a desktop browser.
2. The browser simulates a wider viewport, typically **980 pixels** wide.

## The Root Cause in the Codebase
The project has hardcoded breakpoints that are higher than this simulated width:

1. **CSS Breakpoints:**
   - `desktop-dashboard.css` uses `@media (min-width: 1024px)`.
   - `mobile-tablet-hero.css` and `tablet-bottom-nav.css` use `@media (max-width: 1023px)`.
   - `desktop-sidebar.css` and `ipad-tablet-override.css` use a **1200px** threshold for the "Full Desktop" experience.

2. **JavaScript Logic:**
   - In `src/routes/__root.tsx`, the `showDesktopDashboard` flag is gated by `window.innerWidth >= 1200`.

## The Mismatch
| Environment | Simulated Width | Site Layout Decision | Result |
| :--- | :--- | :--- | :--- |
| Mobile | ~360px - 420px | < 1024px (Mobile/Tablet) | Mobile UI |
| **Desktop Site** | **~980px** | **< 1024px (Mobile/Tablet)** | **Mobile UI (Wrong)** |
| Standard Desktop | > 1024px | >= 1024px (Desktop) | Desktop UI |

## Recommendation
Lower the desktop threshold to **970px** across all files to ensure that the 980px simulated width triggers the desktop layout.
