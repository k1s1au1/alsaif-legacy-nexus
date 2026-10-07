# Project Architecture Rules

- Keep the approved dashboard gateway and family-services reference composition in `src/dashboard-reference-exact.css`; this last-loaded layer isolates it from legacy responsive overrides.
- Normalize rich push content through `rich-notification`; FCM owns background display and the Android RichNotifications plugin owns foreground images to avoid duplicate system notifications.
- Resolve push content from destination IDs inside privileged database sending helpers; never expose the content resolver to public or signed-in RPC callers.
- Sign private storage images (chat, trips) inside the send-push function and limit chat-image pushes to that conversation's members; FCM needs HTTPS links and private files must never reach outsiders.
