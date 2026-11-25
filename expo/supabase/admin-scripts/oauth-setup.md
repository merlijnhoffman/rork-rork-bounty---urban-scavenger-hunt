# Google & Apple sign-in — Supabase dashboard setup

The app already has the full OAuth flow built (PKCE via `expo-web-browser`,
redirect `myapp://…`). What's left is switching the providers on in the
Supabase dashboard (project `jmlqcdcegejeunblzemh`). Until a provider is
enabled, its button simply fails with "Sign-in failed" — email sign-in keeps
working regardless.

The shared callback URL for both providers is:

```
https://jmlqcdcegejeunblzemh.supabase.co/auth/v1/callback
```

## 1. Redirect URLs (do this first)

Dashboard → Authentication → URL Configuration → **Redirect URLs**, add:

```
myapp://**
```

Note: for testing sign-in **inside Expo Go** you'd also need `exp://**` in
this list — but that entry lets any Expo Go project receive sign-in links
(account-takeover risk). Leave it out unless we explicitly need Expo Go
testing, and remove it again afterwards.

## 2. Google

1. Google Cloud Console (console.cloud.google.com) → create/select a project.
2. APIs & Services → Credentials → **Create OAuth client ID** → type **Web
   application** (yes, Web — the native redirect goes through Supabase).
3. Authorized redirect URI: the callback URL above.
4. Copy the Client ID and Client secret.
5. Supabase Dashboard → Authentication → Sign In / Providers → **Google**:
   enable, paste Client ID + Client Secret, Save.

## 3. Apple (needs paid Apple Developer Program, $99/yr)

1. developer.apple.com → Identifiers → register an **App ID** for Bounty with
   "Sign In with Apple" enabled.
2. Identifiers → register a **Services ID** (e.g.
   `com.yourdomain.bounty.web`), enable Sign In with Apple, click Configure,
   set the Return URL to the callback URL above.
3. Keys → create a key with **Sign In with Apple**, download the `.p8` file,
   note the **Key ID**.
4. Supabase Dashboard → Authentication → Sign In / Providers → **Apple**:
   enable, fill in:
   - Services ID (from step 2)
   - Secret Key (paste the entire `.p8` file contents)
   - Key ID (step 3) and Team ID (Apple Developer account details)
   - Authorized Client IDs: your Bounty App ID's bundle id **and** the
     Services ID, comma-separated.

## 4. Test

1. Sign out in the app, kill it, reopen: onboarding should appear on first
   launch only.
2. Tap Continue with Google / Apple → in-app browser opens → approve →
   redirected back into the app, signed in.
3. Profile screen should show your provider email; a `profiles` row is
   created automatically.
