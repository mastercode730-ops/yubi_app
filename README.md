# Yubi7 mobile app

Android and iOS app for the Yubi7 portal, built with Expo (SDK 58) and Expo Router. It talks to the same live backend as the web portal (`https://marketai.solutions/sapi`) and uses the same endpoints and payloads, so all data, rights and sessions are shared with the web.

## Run it on a phone (development)

Requirements: Node.js 20+ and the **Expo Go** app (it must support SDK 58).

```bash
npm install
npx expo start
```

Scan the QR code with Expo Go (Android) or the Camera app (iOS). The phone and the computer must be on the same network, or use `npx expo start --tunnel`.

> Logging in from the app ends any other session for that account (web or another phone). The backend allows one active device per user; this is server behaviour, not an app setting.

## Build installable apps (EAS)

Builds run in the Expo cloud, so you don't need Android Studio or Xcode. Sign in once with `npx eas-cli@latest login`.

| Command | Output | Use |
|---|---|---|
| `npm run build:apk` | `.apk` | Install directly on Android phones for testing |
| `npm run build:android` | `.aab` | Upload to Google Play |
| `npm run build:ios` | `.ipa` | TestFlight / App Store (needs an Apple Developer account) |

To submit to the stores: `npx eas-cli@latest submit -p android` or `-p ios`.

Before each store release, raise `version` in `app.json`, plus `android.versionCode` and `ios.buildNumber` (`eas.json` uses `appVersionSource: local`, so the numbers in `app.json` are what gets built).

## Ship fixes without a new build (EAS Update)

Installed apps download JavaScript updates (screens, logic, text, styling) by themselves. An update is fetched in the background when the app opens and applied the next time the app is opened.

```bash
npm run update:apk -- "Fixed hisab totals"     # apps installed from the APK (preview channel)
npm run update:store -- "Fixed hisab totals"   # Play Store / App Store builds (production channel)
```

An update only reaches builds with the same `version` in `app.json` (`runtimeVersion` policy `appVersion`). So:

- **JS-only change** → keep `version` as it is and run an update command.
- **Native change** (new library with native code, icon, name, splash, permissions, Expo SDK upgrade) → raise `version` (and `versionCode` / `buildNumber`) and make a new build. Older installs keep their last update until the new build is installed.

## Configuration

| What | Where |
|---|---|
| Backend URL | `API_BASE` in `src/api/client.js` |
| App name, bundle id (`com.yubi7.app`), icons, splash | `app.json`, `assets/` |
| Colours, spacing, fonts | `src/theme/index.js` |
| Menu items and the access right each needs | `src/auth/menu.js` |
| WhatsApp support number | `SUPPORT_WHATSAPP` in `src/auth/menu.js` |

## Project layout

```
src/
  app/            Screens (Expo Router: one file per route)
    (tabs)/       Home, Games (received entries), Menu
    entry.js      Chat/entry screen (typing, laddi, jode, cross, pahada, ander/bahar, yantri, 57/43, palat)
    yantri.js     Yantri (actual/daily/agent/special, cutting, add, adjust, parts, forward, negative sale)
    admin/        Super admin: users, sales, open yantri
    ...           Results, Find Chat, Hisab, Hisab Summary, Balance, LC, Absent Report,
                  Accounts, Contacts, Games, Sub Users, Change Password
  api/client.js   HTTP client: JWT in SecureStore, 401 → back to login
  auth/           Login state, access rights, menu definition
  lib/            Business logic ported from the web pages
    entryEngine.js   Entry parsing and row building (from chat.html)
    yantriEngine.js  Yantri calculations (from yantri.html)
  ui/             Shared components (kit, sheets, date/select fields, tables, toast)
  components/     Larger shared pieces (history sheet, yantri grid, bulk move)
```

`entryEngine.js` and `yantriEngine.js` were checked against the original web functions with automated comparison tests: 2,167 entry cases and 3,200 Yantri calculations, with no differences. If you change either file, keep it in step with the web logic.

## Where the app differs from the web portal

Each change below works around a web-portal bug against the live backend, or adapts the web portal to a phone:

- **Change Password** calls `/api/auth/reset-password` (or `/reset-subuser-password` for staff). The web page calls `/api/admin/change-password`, which doesn't exist on the server.
- **Delete LC** sends the selected date. The web page drops it.
- **Hisab Summary export** builds the Excel file on the phone. The web export link has no login token, so it fails.
- **Entry auto-refresh** uses `/api/chat/refresh-status`. On the web it never turns on, because the logged-in user data has no refresh flag.
- **Yantri Forward / Negative Sale** count a plain success response as success. The web page shows an error even when the save worked.
- **Editing an entry** reads the saved `number=amount` pairs directly, so entries such as `1000=x` aren't split wrongly.
- **Reject and Delete** ask for confirmation before acting.
- **P&L Yantri** opens Yantri in Agent mode.
- **Admin "Switch user"** is left out because it has no effect with token login.
- **Absent Report and Sub User** are hidden for staff logins. The web page sends staff away from these pages anyway.

## Checks

```bash
npx expo lint      # 0 errors expected
npx expo-doctor    # dependency / config check
```
