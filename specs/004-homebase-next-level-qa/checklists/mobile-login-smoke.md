# Homebase Mobile Login Smoke

Use this when Dan wants real-device proof that Homebase behaves like a daily-use phone/iPad dashboard, not just a desktop page.

## Public URL

`https://openclaw-mac-mini.tail02a3b6.ts.net:10000/pages/teddy-house/`

## Android Chrome

- [ ] Open the public URL in Android Chrome.
- [ ] If login appears, sign in once with the house password.
- [ ] Confirm the first screen reaches Teddy Homebase, not the login page.
- [ ] Record the first action shown in `Now` and the first Review item, if any.
- [ ] Reload the tab.
- [ ] Confirm the dashboard returns without another password prompt.
- [ ] Close Chrome completely, reopen it, and open the same URL.
- [ ] Confirm the dashboard still opens without another password prompt.
- [ ] Tap `Send status`.
- [ ] Confirm Ask Teddy answers or clearly shows `Fallback`.

## iPhone Safari PWA

- [ ] Open the public URL in Safari.
- [ ] If login appears, sign in once with the house password.
- [ ] Add Teddy Homebase to the Home Screen.
- [ ] Launch Teddy Homebase from the Home Screen icon.
- [ ] Confirm the first screen reaches Teddy Homebase, not the login page.
- [ ] Record the first action shown in `Now` and the first Review item, if any.
- [ ] Force close the PWA and reopen it.
- [ ] Confirm the dashboard still opens without another password prompt.
- [ ] Tap `Send status`.
- [ ] Confirm Ask Teddy answers or clearly shows `Fallback`.

## iPad Safari PWA

- [ ] Open the public URL in Safari.
- [ ] If login appears, sign in once with the house password.
- [ ] Add Teddy Homebase to the Home Screen.
- [ ] Launch Teddy Homebase from the Home Screen icon.
- [ ] Confirm the first screen reaches Teddy Homebase, not the login page.
- [ ] Rotate between portrait and landscape.
- [ ] Confirm there is no horizontal overflow and the first action stays visible.
- [ ] Force close the PWA and reopen it.
- [ ] Confirm the dashboard still opens without another password prompt.
- [ ] Tap `Send status`.
- [ ] Confirm Ask Teddy answers or clearly shows `Fallback`.

## Pass Criteria

- [ ] Android Chrome keeps the trusted session across reload and browser restart.
- [ ] iPhone Home Screen PWA keeps the trusted session across relaunch.
- [ ] iPad Home Screen PWA keeps the trusted session across relaunch.
- [ ] The visible first action matches the local/browser QA report.
- [ ] Ask Teddy is usable or explicitly labeled as fallback.
- [ ] No device shows raw telemetry or horizontal overflow on the first screen.
