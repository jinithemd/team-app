# Clbx phone apps: getting them into the stores

The apps open clbx.ca inside a native shell (Capacitor), so website changes reach the apps
straight away. Native parts: push notifications, the phone's share sheet, clbx.ca links
opening in the app, camera and location prompts, Android back button.

App id (both stores): `ca.clbx.app`. Name: Clbx.

## 1. Accounts (once)
- Apple Developer Program: developer.apple.com/programs, $99 US/year. Enrol as an individual
  (no business number needed). Note your **Team ID** (Membership details).
- Google Play Console: play.google.com/console, $25 US once. Personal account.
- Codemagic: codemagic.io, sign in with GitHub, add the `jinithemd/team-app` repo. Builds use
  `codemagic.yaml` in the repo. Free tier: 500 build minutes a month.
- Firebase: console.firebase.google.com → new project "Clbx" (needed for Android push).

## 2. iPhone
1. App Store Connect → Apps → + New app: name Clbx, bundle id `ca.clbx.app`, SKU `clbx`.
2. Certificates, IDs & Profiles → Identifiers → `ca.clbx.app`: turn on **Push Notifications**
   and **Associated Domains**.
3. Keys → + → "Apple Push Notifications service (APNs)" → download the `.p8` file, note the Key ID.
4. App Store Connect → Users and Access → Integrations → App Store Connect API → generate a key
   (App Manager). In Codemagic: Team settings → Integrations → App Store Connect → add it,
   name it **Clbx App Store**.
5. Codemagic → start workflow **iPhone → TestFlight**. Codemagic creates the signing
   certificate and profile itself. The build lands in TestFlight; install it with the
   TestFlight app on your phone.

## 3. Android
1. Firebase → Project settings → add Android app `ca.clbx.app` → download `google-services.json`.
   In Codemagic → Environment variables → group **clbx_firebase**: `GOOGLE_SERVICES_JSON` = the
   file's contents.
2. Firebase → Project settings → Service accounts → Generate new private key (JSON). This is
   for the server (Vercel `FCM_SERVICE_ACCOUNT`, below).
3. Codemagic → Code signing → Android → generate a new keystore, reference name **clbx_upload**.
4. Play Console → Create app "Clbx". Setup → API access → create a service account with
   release permissions, download its JSON key; in Codemagic group **clbx_play** set
   `GCLOUD_SERVICE_ACCOUNT_CREDENTIALS` to it. (The very first upload to Play has to be done by
   hand: download the `.aab` from the first Codemagic build and upload it under Internal testing.)
5. Play Console → App integrity → copy the **App signing key SHA-256** fingerprint.

## 4. Vercel environment variables (Project → Settings → Environment Variables)
| Name | Value |
|---|---|
| `APNS_KEY` | contents of the `.p8` file |
| `APNS_KEY_ID` | the key's id (10 characters) |
| `APNS_TEAM_ID` | your Apple Team ID |
| `APPLE_TEAM_ID` | your Apple Team ID (iPhone links open the app) |
| `FCM_SERVICE_ACCOUNT` | the Firebase service account JSON |
| `ANDROID_CERT_SHA256` | the Play app signing SHA-256 (Android links open the app) |

Redeploy after adding them.

## 5. Store listings
- Category: Sports. Price: free.
- Privacy policy URL: https://clbx.ca/privacy. Support: hello@clbx.ca.
- Screenshots: 6.7" iPhone and a phone for Play (take them from the TestFlight / internal build).
- Apple review needs a sign-in it can use: create a reviewer account (an email you can read)
  and give Apple that email; they sign in with the emailed code. Add the code-by-email note
  in "App Review Information".
- Payments for team fees and tournament entries are real-world services, so Stripe is allowed
  (no Apple/Google in-app purchase).

## Checking builds without a store
Every push that changes the app runs **Phone apps** on GitHub Actions: an installable Android
test APK (Actions → the run → Artifacts) and an iPhone simulator build.
