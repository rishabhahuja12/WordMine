# WordMine — Engineering & Quality Rules

## 1. Code Quality & Verification Standards
- **Empirical Proof Required**: Never claim an implementation or bugfix works without running actual build or test commands (`node -c <file>.js`, automated test runners) and validating the full output.
- **Root Cause Problem Solving**: Fix the underlying architectural issue. Do not swallow exceptions with empty `catch {}` blocks, return dummy mock strings where live data is required, or remove tests.
- **Strict Error Handling & Port Resilience**: Always guard `chrome.tabs.sendMessage` calls with fallback injection routines and proper checking for disconnected runtime ports.

## 2. Anti-AI-Slop & Interface Design Directives
- **Zero Generic Aesthetics**: Adhere strictly to the established design system:
  - Canvas background: Warm Stone `#F5F4F0`
  - Primary Brand: Petrol Teal `#1F5C6B` (Hover: `#184B57`, Active: `#133E48`, Tint: `#E8F2F4`)
  - Typography: Native modern system stacks (-apple-system, Segoe UI, Roboto)
  - Card Containers: Crisp White `#FFFFFF` with `#D8D5CD` borders and subtle box-shadows.
- **Zero Emojis in User Interface**: Production UI must exclusively utilize crisp, scalable vector SVG icons. No emoji characters (e.g. ⚡, ✍, ⏩, 🧠, 📝, ⛏) may appear in buttons, headers, or status displays.
- **Symmetrical Controls**: Keep segmented controls and content filters balanced on unified grid rows with consistent padding and typography.
- **No Placeholders**: Every feature, button, and menu must be fully implemented and wired to operational code.

## 3. Coursera Compatibility & Taxonomy Integrity
- Support all 6 Core Coursera Instructional Content Types:
  1. Video Lectures (`/lecture/`, `VID`)
  2. Reading Materials (`/supplement/`, `READ`)
  3. Practice & Graded Quizzes (`/quiz/`, `/practice-quiz/`, `/exam/`, `QUIZ`/`EXAM`)
  4. Peer & Programmatic Assignments (`/assignment-submission/`, `/peer/`, `ASSIGN`)
  5. Hands-on Projects & Guided Labs (`/ungradedWidget/`, `/ungradedLti/`, `/lab/`, `LAB`)
  6. Discussion Forums (`/discussionPrompt/`, `/discussion/`, `DISC`)
- Ensure every non-transcript or skipped item is transparently captured in the Skipped Audit Log with an informative, user-visible explanation.

## 4. Security & Privacy Non-Negotiables
- **BYOK Gemini Key**: Key must reside strictly in `chrome.storage.local`.
- **Zero Third-Party Callbacks**: Extension must communicate solely with `*.coursera.org` and `generativelanguage.googleapis.com`.
- **XSS & Injection Protection**: Strictly escape all dynamic text before constructing HTML or XML trees.
