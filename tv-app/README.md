# مجلس السيف للتلفزيون

Dedicated Android TV / Google TV preview application. Package: `com.alsaif.familyhub.tv`.

The Android launcher loads the bundled, image-led TV interface. It uses the existing site's HTTPS origin inside its own WebView. Version 1.1 replaces the desktop sign-in form with a full-screen TV QR sign-in screen: scan with a phone, sign in there if necessary, match the six-digit display code and explicitly approve. The television then creates its own Supabase session. Phone access/refresh tokens and passwords are never copied to the TV.

`/tv-login` is the isolated phone approval route; `/api/tv-pair` is its POST-only same-origin server endpoint. A request lasts five minutes. The QR contains a random 256-bit approval capability in a fragment, removed from history before sign-in; a different 256-bit secret remains on the requesting TV. Only SHA-256 hashes, status and expiry are stored in the two RLS-protected, service-role-only tables. The display code is for comparison, never for account lookup. Approval verifies the phone JWT with Auth and requires an active approved member; claim rechecks membership, atomically consumes the request and mints a one-use Auth token for that exact existing account. A new TV session is established using `verifyOtp`. No passwords, access/refresh tokens or generated Auth links are stored in the pairing tables or logged. Public allocation and polling are rate-limited. Refresh cancels the preceding pending request; expiry, denial, replay, wrong secrets, inactive members and concurrent claims fail closed.

Apply `supabase/migrations/20261029235110_tv_device_pairing.sql` and deploy the website routes before installing 1.1. The server uses the existing server-only `SUPABASE_SERVICE_ROLE_KEY` configuration. No privileged credential is bundled in the APK. Existing content RLS policies and normal phone/browser sign-in are unchanged. Login session and local sign-out remain separate from the phone application.

Occasions use the **same `Preview` renderer, selected templates, text, fonts and colors as the existing family occasions page**. All templates are bundled. Preview, open invitation, fullscreen zoom and directional pan are available. Actual members' photos, news photos, trips and archive images are loaded through their existing storage access paths. No sample posts or fabricated family relations ship in the application.

Implemented TV views: home, occasions, member posts, news, genealogy/legacy, trips, meetings, tasks, photo archive and services. Existing finance, Quran, chat, vault, suggestions, notifications, detailed trip registration and color customization open the corresponding live website page with a native "العودة للتلفزيون" button. Their forms retain their existing behavior.

Requires Android TV 8.0+ and a current Android System WebView (Chromium 100+). Navigation: D-pad, OK, Back. The first version is a debug-signed installable preview, not a Play Store release. Verify sign-in, invitation rendering and D-pad behavior on a physical TV before distribution.

Build with Node 24, Java 21, Android SDK 36 and the repository's Gradle wrapper:

```sh
npm install --package-lock=false --ignore-scripts
node --test tv-app/model.test.mjs
node --experimental-transform-types --test scripts/test-tv-pairing.mts
npx tsc -p tv-app/tsconfig.json --pretty false
npx vite build --config tv-app/vite.config.ts
android/gradlew -p android-tv assembleDebug
```

`.env` supplies the same existing public `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. They are public client configuration. Keep privileged keys out of the app. The workflow builds a downloadable APK on the `android-tv-image-first` and `tv-phone-signin` branches. The generated web assets are ignored. This remains a sideloaded preview; debug CI builds are not guaranteed to share a signing key. Production distribution requires a retained private signing key.
