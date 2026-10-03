# Security & Privacy Policy — WordMine

## Overview
**WordMine** is an open-source, 100% client-side Chrome Extension operating under Google Chrome Manifest V3. WordMine operates without any backend servers, databases, telemetry trackers, or third-party analytical SDKs. All processing takes place entirely within the user's browser sandbox.

---

## 1. Bring-Your-Own-Key (BYOK) Security Model

WordMine integrates with Google Gemini AI using a strict **Bring-Your-Own-Key (BYOK)** model:
- **Local Storage Only**: The Google Gemini API key provided by the user is stored exclusively in the browser's local sandbox via `chrome.storage.local`.
- **Zero Third-Party Telemetry**: The API key is **never** sent to any external server, proxy, proxy-wrapper, or logging service.
- **Direct Encrypted Transport**: All AI requests are transmitted directly over HTTPS (TLS 1.3) from the extension context to Google's official endpoint:
  ```
  https://generativelanguage.googleapis.com/v1beta/models/...
  ```
- **Voluntary & Revocable**: Users obtain their free key directly from [Google AI Studio](https://aistudio.google.com/app/apikey) and can clear or revoke it at any moment.

---

## 2. Chrome Extension Permissions & Least Privilege Scoping

WordMine adheres to the Principle of Least Privilege in Manifest V3:

| Permission | Technical Purpose | Scope |
|---|---|---|
| `storage` | Persists user preferences (output format, filters), queued transcripts, skipped audit log, and BYOK Gemini API key locally. | Stored only in local browser profile. |
| `activeTab` | Grants temporary execution permission to read the Coursera DOM only when the user opens the extension popup. | Restricted to the active tab. |
| `scripting` | Enables fallback injection of `content.js` into Coursera course tabs if the page navigated after extension reload. | Restricted to active Coursera tabs. |

### Host Permissions Scoping
Host permissions are strictly constrained to:
- `https://*.coursera.org/*` & `https://coursera.org/*`: Detecting course DOM elements, video players, and transcripts.
- `https://generativelanguage.googleapis.com/*`: Transmitting queries directly to Google Gemini API.

WordMine **cannot** read, access, or intercept traffic from any other website or domain.

---

## 3. DOM Security & Injection Prevention (Anti-XSS)

- **Strict XML & HTML Sanitization**: All transcript lines, lesson titles, and prompt extractions undergo rigorous entity escaping (`&`, `<`, `>`, `"`, `'`) before being assembled into DOCX OpenXML packages or PDF DOM wrappers.
- **Zero `eval()`**: In compliance with Chrome Manifest V3 Content Security Policy (CSP), WordMine contains zero `eval()`, zero `new Function()`, and zero execution of dynamic remote scripts.
- **Client-Side Document Assembly**: OpenXML DOCX files and text outputs are generated in-memory using `jszip.min.js` and exported via standard `Blob` and `URL.createObjectURL` flows.

---

## 4. User Data & Academic Integrity

- **Non-Destructive Operations**: WordMine does not alter server-side grade databases or modify academic records. Automator features interact purely with front-end browser elements.
- **Data Retention**: Transcripts and generated study materials reside in browser memory or the user's local downloads directory. No data is stored externally.

---

## 5. Vulnerability Reporting

If you identify a security issue or vulnerability in WordMine, please report it directly via GitHub Issues or contact the maintainer:
- **Maintainer**: Rishabh Ahuja ([@rishabhahuja12](https://github.com/rishabhahuja12))
- **Repository**: [https://github.com/rishabhahuja12/WordMine.git](https://github.com/rishabhahuja12/WordMine.git)
