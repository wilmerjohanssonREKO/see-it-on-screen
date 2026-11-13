# Real local Auth and recovery check

Run only against the dedicated local stack, using its ignored private manifest:

```sh
python tests/pilot/auth/recovery.py --manifest tests/pilot/fullstack/runtime/manifest.json --output /tmp/reko-auth-result.json
```

Requires Python Playwright and Chromium. Creates one uniquely named synthetic `.invalid` account via the real GoTrue signup API, verifies login is blocked before confirmation, follows the internally captured SMTP confirmation link, and verifies successful login. It then uses the application's forgot-password and reset-password forms with real SMTP recovery and checks that only the new password works.

No credentials, mail bodies or token URLs are included in the JSON report. The manifest and raw local mailbox must stay private. This test verifies API signup plus the app's recovery UI; it does not claim the app's entire signup form, school-invitation delivery or external SMTP/provider delivery is tested.
