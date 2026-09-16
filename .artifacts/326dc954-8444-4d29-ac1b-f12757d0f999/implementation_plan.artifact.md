# Android Optimization for Alsaif Family Hub (المجلس)

The app is currently a feature-rich family hub built with TanStack Start and Capacitor. To take it to the next level on Android, we should focus on making it feel truly native and integrated with the system.

## Proposed Changes

### 1. Edge-to-Edge Experience
Currently, the app might show bars at the top and bottom. We should enable a full-screen "Edge-to-Edge" experience.
- **[MODIFY] [MainActivity.java](file:///C:/Projects/alsaif-legacy-nexus-b14dc257/android/app/src/main/java/com/alsaif/familyhub/MainActivity.java)**: Enable edge-to-edge in `onCreate`.
- **[MODIFY] [styles.css](file:///C:/Projects/alsaif-legacy-nexus-b14dc257/src/styles.css)**: Add CSS variables for safe area insets to ensure content isn't cut off.

### 2. AppFunctions (Google Assistant Integration)
Enable users to perform common actions using voice or system-wide searches.
- **[NEW] [FamilyActions.kt](file:///C:/Projects/alsaif-legacy-nexus-b14dc257/android/app/src/main/java/com/alsaif/familyhub/FamilyActions.kt)**: Define AppFunctions for "Open Majlis", "New Chat", and "View Family Tree".

### 3. Widget Enhancement
Improve the `TodayWidget` to show real-time family updates or upcoming events from the shared calendar.
- **[MODIFY] [TodayWidgetProvider.java](file:///C:/Projects/alsaif-legacy-nexus-b14dc257/android/app/src/main/java/com/alsaif/familyhub/TodayWidgetProvider.java)**: Add logic to fetch and display the next 3 events.

### 4. Deep Link Verification
Ensure the app supports App Links (verified deep links) for a seamless experience when clicking links from other apps.

## User Review Required

> [!IMPORTANT]
> Enabling **Edge-to-Edge** will change how the status bar and navigation bar look (they will be transparent). We need to ensure the web UI handles the extra padding at the top (status bar) and bottom (gesture bar/nav bar).

> [!NOTE]
> For **AppFunctions**, we'll need to add the `androidx.appfunctions` dependencies to the Android project.

## Open Questions
- Do you want to prioritize any specific feature (e.g., the Majlis/Meetings or the Family Tree)?
- Is the `TodayWidget` currently functional, or should I build it from scratch based on the existing `WidgetPlugin`?
- Should we add "App Shortcuts" for more frequent actions like "Send a quick message to family"?
