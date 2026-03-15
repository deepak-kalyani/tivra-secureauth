# Tivra SecureAuth

> A secure, offline TOTP authenticator extension for Microsoft Edge.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-Proprietary-red)
![Platform](https://img.shields.io/badge/platform-Microsoft%20Edge-green)
![Offline](https://img.shields.io/badge/works-offline-brightgreen)

---

## What it does

Tivra SecureAuth generates Time-based One-Time Passwords (TOTP) directly in your Edge browser — the same 6-digit codes as Google Authenticator, but right in your toolbar. No phone needed.

- Compatible with Google Authenticator, Authy, Microsoft Authenticator
- Import all accounts at once via QR export
- Codes refresh every 30 seconds automatically
- 100% offline — zero network requests
- Secrets stored locally, never transmitted anywhere

---

## Installation

### From Microsoft Edge Add-ons Store
Search for **Tivra SecureAuth** on the [Edge Add-ons Store](https://microsoftedge.microsoft.com/addons).

### Manual (Developer mode)
1. Download or clone this repo
2. Open Edge → `edge://extensions`
3. Enable **Developer mode**
4. Click **Load unpacked** → select the `totp-extension/` folder

---

## How to import from Google Authenticator

1. Open Google Authenticator on your phone
2. Tap **⋮ → Transfer accounts → Export accounts**
3. Screenshot the QR code → send to your PC
4. Open [zxing.org/w/decode.jspx](https://zxing.org/w/decode.jspx) → upload screenshot → copy the decoded text
5. Click the QR icon in the extension → paste the text → Import

---

## Project structure

```
totp-extension/
├── manifest.json        # Extension config (Manifest V3)
├── popup.html           # Main UI
├── popup.css            # Styles
├── popup.js             # TOTP logic + import + storage
├── privacy-policy.html  # Privacy policy (hosted publicly)
├── icons/
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
├── LICENSE.txt
└── CREDITS.txt
```

---

## Versioning

This project uses [Semantic Versioning](https://semver.org/):

- `MAJOR.MINOR.PATCH`
- Example: `1.2.0` → major feature, `1.0.1` → bug fix

See [CHANGELOG.md](CHANGELOG.md) for full history.

---

## Privacy

Tivra SecureAuth collects no data. All secrets are stored locally using `chrome.storage.local`.
Full policy: [privacy-policy.html](totp-extension/privacy-policy.html)

---

## License

© 2026 Deepak Kalyani. All rights reserved.
See [LICENSE.txt](totp-extension/LICENSE.txt) for details.
