# مجلس السيف للتلفزيون

Dedicated Android TV / Google TV preview application. Package: `com.alsaif.familyhub.tv`.

The Android launcher loads the bundled, image-led TV interface. It uses the existing site's HTTPS origin inside its own WebView so the normal `/auth?next=…` sign-in flow returns directly to TV. It has a separate installation and login session from the mobile application and reads the existing Supabase content with the signed-in member's session and unchanged RLS policies. No service-role key, custom privileged endpoint, credential bridge, or backend migration is used.

Occasions use the **same `Preview` renderer, selected templates, text, fonts and colors as the existing family occasions page**. All templates are bundled. Preview, open invitation, fullscreen zoom and directional pan are available. Actual members' photos, news photos, trips and archive images are loaded through their existing storage access paths. No sample posts or fabricated family relations ship in the application.

Implemented TV views: home, occasions, member posts, news, genealogy/legacy, trips, meetings, tasks, photo archive and services. Existing finance, Quran, chat, vault, suggestions, notifications, detailed trip registration and color customization open the corresponding live website page with a native "العودة للتلفزيون" button. Their forms retain their existing behavior.

Requires Android TV 8.0+ and a current Android System WebView (Chromium 100+). Navigation: D-pad, OK, Back. The first version is a debug-signed installable preview, not a Play Store release. Verify sign-in, invitation rendering and D-pad behavior on a physical TV before distribution.

Build with Node 24, Java 21, Android SDK 36 and the repository's Gradle wrapper:

```sh
npm install --package-lock=false --ignore-scripts
node --test tv-app/model.test.mjs
npx vite build --config tv-app/vite.config.ts
android/gradlew -p android-tv assembleDebug
```

`.env` supplies the same existing public `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. They are public client configuration. Keep privileged keys out of the app. The workflow builds a downloadable APK on the `android-tv-image-first` branch. The generated web assets are ignored; existing website/mobile entry points are unchanged.
