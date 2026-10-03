# WordMine — Master Task & Execution Specification

## Executive Summary
**WordMine** is an open-source, 100% free, zero-paywall Chrome Extension (Manifest V3) purpose-built for Coursera learners, researchers, and educators. It transforms Coursera course consumption by combining three high-performance capabilities into a unified, high-aesthetic interface:
1. **Transcript Miner**: Multi-format transcript and reading extraction (DOCX, PDF, TXT) with single-lesson or automated course-level batch mining.
2. **Course Automator**: Rapid, non-destructive learning workflow acceleration (inspired by `coursera-skip-tool`) for video/reading completion, peer review assistance with top rubric scoring, and discussion prompt handling.
3. **Gemini AI Co-Pilot**: Bring-Your-Own-Key (BYOK) free Google Gemini API integration from Google AI Studio for step-by-step quiz solving with reasoning, executive study sheet generation, and rubric-aligned peer review feedback.

---

## Instructional Content Types Taxonomy
Coursera courses are composed of six distinct instructional resource archetypes. WordMine identifies and handles each archetype natively:

| Archetype | URL Signature | Badge | Processing Strategy |
|---|---|---|---|
| **Video Lectures** | `/lecture/` | `VID` | Extracted via `.rc-Phrase` DOM elements; DOCX/PDF/TXT formatted. |
| **Reading Materials** | `/supplement/` | `READ` | Extracted from Coursera Markup Language (`.rc-CML`, `[data-testid="cml-viewer"]`). |
| **Practice & Graded Quizzes** | `/quiz/`, `/practice-quiz/`, `/exam/` | `QUIZ` / `EXAM` | Non-transcript item. Captured in **Skipped Audit Log**; solved via Gemini AI Co-Pilot. |
| **Peer & Programmatic Assignments** | `/assignment-submission/`, `/peer/` | `ASSIGN` | Non-transcript item. Rubrics auto-filled via Course Automator; feedback generated via Gemini AI. |
| **Hands-on Projects & Guided Labs** | `/ungradedWidget/`, `/ungradedLti/`, `/lab/` | `LAB` | Interactive cloud sandbox. Captured in **Skipped Audit Log** with transparent reason. |
| **Discussion Forums** | `/discussionPrompt/`, `/discussion/` | `DISC` | Non-transcript item. Captured in **Skipped Audit Log**; responses assisted via Automator. |

---

## Transparent Skipped Audit Log Architecture
To eliminate user confusion when navigating mixed courses, WordMine implements a **Zero-Blind-Spots Skipped Audit Log**:
- Any non-transcript or user-filtered item is recorded with:
  - Exact lesson title
  - Content archetype badge (`VID`, `READ`, `QUIZ`, `ASSIGN`, `LAB`, `DISC`)
  - Explicit rationale (e.g., *"Hands-on Project / Guided Lab — Interactive sandbox, no transcript available"*, *"Practice/Graded Quiz — Interactive assessment"*, *"Excluded by filter: Videos unchecked"*).
- Dedicated audit tab with live item counter ensures full transparency.

---

## Design System Directives
- **Palette**: Petrol Teal (`#1F5C6B`) primary, Warm Stone canvas (`#F5F4F0`), Crisp White cards (`#FFFFFF`).
- **Typography**: Apple System / Segoe UI / Inter body, Monospace for identifiers and API keys.
- **Iconography**: 100% Vector SVG icons throughout. **Zero emojis** in production UI.
- **Micro-interactions**: Smooth transitions, segmented controls, pulse status indicators, hover feedback.

---

## Work Breakdown Structure (WBS) & Implementation Status

- [x] **Phase 1: Architecture & Dependencies**
  - [x] Configure Manifest V3 permissions (`storage`, `activeTab`, `scripting`).
  - [x] Add `https://generativelanguage.googleapis.com/*` to `host_permissions` for Gemini BYOK API.
  - [x] Implement native ECMA-376 OpenXML `docx.min.js` generator utilizing bundled `jszip.min.js`.
  - [x] Verify `html2pdf.min.js` and `pdfobject.min.js` exports.

- [x] **Phase 2: Content Script & Coursera DOM Integration (`content.js`)**
  - [x] Multi-format transcript extractor (`.rc-Phrase` video transcript and CML reading bodies).
  - [x] Read-only Curriculum DOM scanner for course syllabus and sidebar exploration.
  - [x] Course Automator lesson completion routines (`video.ended`, reading scroll & mark complete).
  - [x] Peer review assistant (highest rubric radio selection, varied constructive comments, confirmation checks).
  - [x] Discussion prompt assistant (constructive academic reflection injection).
  - [x] Quiz question parser (prompts, options, choice types for Gemini AI).

- [x] **Phase 3: Extension Interface & User Experience (`popup.html` & `styles.css`)**
  - [x] Top navigation bar (Transcripts, Automator, Gemini AI).
  - [x] Symmetrical 1-line format pills (DOCX, PDF, TXT).
  - [x] Symmetrical 1-line content filters (Videos, Readings, Quizzes) with vector SVG icons.
  - [x] Module & Lesson Selector with collapsible drawer and quick filters (All, Videos, Readings, None).
  - [x] Dual-tab Feed: Live Mined transcripts list and Transparent Skipped Audit Log.
  - [x] Automator action cards with vector SVG icons and instant status updates.
  - [x] Gemini AI view with password key input, quiz solver, study sheet generator, and peer reviewer.

- [x] **Phase 4: Co-Pilot & Logic Controller (`popup.js`)**
  - [x] Chrome storage persistence for mined files, skipped items, and Gemini API key.
  - [x] Google Gemini REST API client (`v1beta/models/gemini-1.5-flash:generateContent`).
  - [x] Batch ZIP packaging and individual file downloader.
  - [x] In-page fallback curriculum extractor immune to runtime port closures.

- [x] **Phase 5: Documentation & Verification**
  - [x] `TASK.md` (Project Roadmap & Technical Specification).
  - [x] `SECURITY.md` (BYOK Isolation, Permissions Scoping, XSS Safeguards).
  - [x] `AGENTS.md` (Architecture, Ralph / GSD-Core Protocols, Developer Instructions).
  - [x] `RULES.md` (Engineering Guidelines & Anti-Slop Directives).
  - [x] Comprehensive test suite (`tests/` directory) with automated execution.
  - [x] Clean git commit and push to remote repository.
