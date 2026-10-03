# WordMine — Autonomous Agent Architecture & Operating Manual

## Purpose
This document provides AI coding agents (Antigravity CLI, Ralph autonomous loops, and GSD-Core agents) with complete architectural guidelines, message-passing contracts, and operating instructions for the **WordMine** repository.

---

## 1. System Architecture

```
wordmine/
├── manifest.json        # Chrome Manifest V3 configuration & permission boundaries
├── popup.html           # 3-Mode interface (Transcript Miner, Automator, Gemini AI)
├── styles.css           # Petrol Teal (#1F5C6B) & Warm Stone (#F5F4F0) design system
├── popup.js             # Client controller, state management, storage, Gemini API client
├── content.js           # Coursera DOM observer, lesson extractor, Automator executor
├── docx.min.js          # In-memory ECMA-376 OpenXML document generator
├── html2pdf.min.js      # Client-side PDF rendering library
├── pdfobject.min.js     # PDF embedding utility
├── jszip.min.js         # Archive packaging for batch downloads & DOCX XML container
├── icons/               # 16px, 48px, 128px extension branding assets
├── tests/               # Automated test suites (taxonomy, docx, DOM handlers, security)
├── TASK.md              # Roadmap, WBS, implementation checklist
├── SECURITY.md          # BYOK security model & permission isolation
├── RULES.md             # Global engineering rules & anti-slop guidelines
└── README.md            # User-facing manual and documentation
```

---

## 2. Chrome Extension Message-Passing Protocol

Communication between `popup.js` (UI context) and `content.js` (Coursera tab DOM context) follows a typed, structured message-passing protocol via `chrome.tabs.sendMessage`:

### Protocol Actions

| Action | Payload | Response | Description |
|---|---|---|---|
| `ping` | `{ action: "ping" }` | `{ success: true }` | Verifies content script presence in the active tab. |
| `checkPage` | `{ action: "checkPage" }` | `{ onCoursera, onVideoPage, pageType, isEndOfCourse }` | Detects current page type and Coursera domain context. |
| `getTranscript` | `{ action: "getTranscript" }` | `{ success, title, transcript, pageType, reason, isEndOfCourse }` | Extracts video transcript (`.rc-Phrase`) or reading body (`.rc-CML`). |
| `nextVideo` | `{ action: "nextVideo" }` | `{ success, reason }` | Locates and activates the "Next item" navigation trigger. |
| `scanCurriculum` | `{ action: "scanCurriculum" }` | `{ success, modules: [{ moduleTitle, items: [...] }] }` | Read-only scan of visible syllabus/sidebar navigation links. |
| `navigateTo` | `{ action: "navigateTo", url }` | `{ success }` | Navigates the Coursera tab to the specified lesson URL. |
| `completeLesson` | `{ action: "completeLesson" }` | `{ success, message, error }` | Simulates completion of current video, reading, or lab item. |
| `handleDiscussionPrompt` | `{ action: "handleDiscussionPrompt" }` | `{ success, message }` | Inserts thoughtful academic reflection into discussion prompts. |
| `assistPeerReview` | `{ action: "assistPeerReview" }` | `{ success, message, error }` | Automatically selects top rubric scores and fills constructive feedback. |
| `getQuizQuestions` | `{ action: "getQuizQuestions" }` | `{ success, questions: [...] }` | Scrapes quiz prompts and options for Gemini AI processing. |

---

## 3. Coursera Content Taxonomy Engine

Every page inspected by WordMine is categorized into one of 6 core instructional types:

```javascript
function getPageType() {
  const url = window.location.href;
  if (url.includes("/lecture/")) return "video";
  if (url.includes("/supplement/")) return "reading";
  if (url.includes("/quiz/") || url.includes("/practice-quiz/")) return "quiz";
  if (url.includes("/exam/")) return "exam";
  if (url.includes("/assignment-submission/") || url.includes("/peer/")) return "assignment";
  if (url.includes("/discussionPrompt/") || url.includes("/discussion/")) return "discussion";
  if (url.includes("/ungradedWidget/") || url.includes("/ungradedLti/") || url.includes("/lab/")) return "lab";
  return "other";
}
```

---

## 4. Ralph & GSD-Core Execution Patterns

When developing or modifying WordMine within autonomous agent loops:
1. **Explore First**: Read `TASK.md`, `RULES.md`, and inspect actual code before generating diffs.
2. **Atomic Modification**: Keep changes focused on the target subsystem without adding extraneous refactors.
3. **Run Empirical Tests**: Execute `node tests/...` and `node -c ...` to verify runtime health before committing.
4. **Zero Emojis in UI**: Use vector SVG graphics for all buttons, badges, chips, and icons.
5. **Update Documentation**: Record completed WBS items in `TASK.md` and document any newly discovered patterns.
