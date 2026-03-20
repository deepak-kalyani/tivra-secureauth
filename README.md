<div align="center">

<img src="icons/icon128.png" width="96" height="96" alt="Tivra SecureAuth" />

# Tivra SecureAuth

**A secure, offline TOTP authenticator extension for Microsoft Edge**

[![Edge Add-ons](https://img.shields.io/badge/Microsoft%20Edge%20Add--ons-Download-0078d4?style=for-the-badge&logo=microsoftedge&logoColor=white)](https://microsoftedge.microsoft.com/addons/search/Tivra%20SecureAuth)
[![Version](https://img.shields.io/badge/Version-1.0.0-blue?style=for-the-badge)](CHANGELOG.md)
[![License](https://img.shields.io/badge/License-Proprietary-red?style=for-the-badge)](LICENSE.txt)
[![Offline](https://img.shields.io/badge/Works-Offline-brightgreen?style=for-the-badge)](#)

</div>

---

## Overview

Tired of grabbing your phone every time you need to log in? **Tivra SecureAuth** puts your two-factor authentication codes right in your Edge toolbar — one click and your code is ready.

It generates Time-based One-Time Passwords (TOTP) using the same algorithm as Google Authenticator, working completely offline with no account, no cloud, and no data collection.

---

## Install

<a href="https://microsoftedge.microsoft.com/addons/search/Tivra%20SecureAuth">
  <img src="https://img.shields.io/badge/Get%20it%20on-Microsoft%20Edge%20Add--ons-0078d4?style=for-the-badge&logo=microsoftedge&logoColor=white" alt="Get it on Microsoft Edge Add-ons" />
</a>

---

## Features

| Feature | Details |
|---------|---------|
| ⚡ Instant codes | 6-digit TOTP codes in one click |
| 🔄 Auto-refresh | Codes update every 30 seconds |
| 📥 Bulk import | Import all Google Authenticator accounts at once via QR export |
| ✏️ Rename accounts | Give your accounts any name you like |
| 📋 One-click copy | Copy codes to clipboard instantly |
| 📵 Fully offline | Zero network requests — works without internet |
| 🔒 Private by design | Secrets stored locally, never transmitted anywhere |
| 🆓 Free | No account, no subscription, no ads |

---

## How to import from Google Authenticator

1. Open **Google Authenticator** on your phone
2. Tap **⋮ → Transfer accounts → Export accounts**
3. Take a **screenshot** of the QR code → send it to your PC
4. Open [zxing.org/w/decode.jspx](https://zxing.org/w/decode.jspx) → upload the screenshot → copy the decoded text
5. In the extension click the **QR icon** → paste the text → **Import**
6. All your accounts appear — select and import in one click ✓

---

## Compatibility

Works with any service that uses TOTP / 2FA, including:

Google · GitHub · Microsoft · Dropbox · Instagram · Amazon · Twitter/X · Facebook · Discord · Binance · Coinbase · Cloudflare · AWS · Notion · and thousands more

---

## Privacy & Security

- All TOTP secrets are stored using `chrome.storage.local` — on your device only
- The extension makes **zero network requests**
- No analytics, no telemetry, no crash reporting
- Only 2 permissions: `storage` and `clipboardWrite`
- TOTP algorithm: [RFC 6238](https://datatracker.ietf.org/doc/html/rfc6238) — implemented using the browser's native Web Crypto API

📄 [Read the full Privacy Policy](totp-extension/privacy-policy.html)

---

## Project structure

```
totp-extension/
├── manifest.json         # Extension manifest (v3)
├── popup.html            # Main UI
├── popup.css             # Styles
├── popup.js              # TOTP engine + import + storage
├── privacy-policy.html   # Privacy policy
├── icons/
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
├── LICENSE.txt
├── CREDITS.txt
├── CHANGELOG.md
└── bump_version.py       # Version management script
```

---

## Version management

This project uses [Semantic Versioning](https://semver.org/) — `MAJOR.MINOR.PATCH`

```bash
python bump_version.py patch   # bug fix   → 1.0.0 to 1.0.1
python bump_version.py minor   # feature   → 1.0.0 to 1.1.0
python bump_version.py major   # big change → 1.0.0 to 2.0.0
```

See [CHANGELOG.md](CHANGELOG.md) for full release history.

---

## Development setup

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/tivra-secureauth.git

# Load in Edge
# 1. Open edge://extensions
# 2. Enable Developer mode
# 3. Click Load unpacked → select the totp-extension/ folder
```

---

## Author

**Deepak Kalyani**
© 2026 Deepak Kalyani. All rights reserved.

---

<div align="center">

If you find Tivra SecureAuth useful, please consider leaving a ⭐ on this repo and a review on the [Edge Add-ons Store](https://microsoftedge.microsoft.com/addons/search/Tivra%20SecureAuth) — it helps others find it!

</div>
