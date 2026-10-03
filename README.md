# WordMine — Coursera Power Suite

> **WordMine** is an open-source, 100% free, zero-paywall Chrome Extension built for Coursera learners, researchers, and developers. It combines three power tools into a single, high-aesthetic interface: **Transcript Miner**, **Course Automator**, and **Gemini AI Co-Pilot**.

---

## 3 Core Operating Modes

### 1. Transcript Miner
- **Multi-Format Document Exports**: Direct client-side generation of Microsoft Word (`.docx`), Adobe Acrobat (`.pdf`), and clean plain text (`.txt`).
- **Auto-Advance & Batch ZIP Packaging**: Silently advances through course lessons and bundles all transcripts into a unified `.zip` archive.
- **Symmetrical Content Filters**: Granular 1-line toggles to filter Videos, Readings, or Quizzes.
- **Module & Lesson Selector**: Interactive course syllabus explorer allowing users to select specific modules or individual lessons to mine.
- **Transparent Skipped Audit Log**: Live audit feed with badge counters and explicit explanations whenever non-transcript items (interactive labs, discussion prompts, quizzes) are encountered.

### 2. Course Automator *(Inspired by coursera-skip-tool)*
- **Complete Current Lesson**: Instant completion for video lectures (`timeupdate`/`ended`) and reading materials (scroll and mark complete).
- **Handle Discussion Prompts**: Injects thoughtful, constructive academic reflections into discussion forum prompts.
- **Assist Peer Review**: Automatically scores rubric criteria with maximum points, fills varied constructive feedback into comments, and acknowledges confirmation requirements.
- **Auto-Loop Course Queue**: Hands-free navigation through eligible course sequences.

### 3. Gemini AI Co-Pilot *(BYOK — Bring Your Own Key)*
- **Free Google AI Studio Integration**: Connect your free Gemini API key without credit cards or fees.
- **Solve Current Quiz**: Scrapes quiz questions and choices, calling Gemini for answers accompanied by concise, step-by-step reasoning.
- **Executive Study Sheets**: Transforms 15,000+ character transcripts into executive summaries, core takeaways, and key formulas.
- **AI Peer Review Feedback**: Analyzes student submissions directly from the page and generates rubric-tailored constructive feedback.

---

## Supported Coursera Content Types Taxonomy

WordMine natively identifies and processes all 6 primary Coursera instructional archetypes:

| Type | Badge | Description |
|---|---|---|
| **Video Lectures** | `VID` | Extracts synced video transcripts from `.rc-Phrase` elements. |
| **Reading Materials** | `READ` | Extracts structured text from Coursera Markup Language (CML). |
| **Practice & Graded Quizzes** | `QUIZ` / `EXAM` | Captures in Skipped Audit Log; solves with Gemini AI Co-Pilot. |
| **Peer & Programmatic Assignments** | `ASSIGN` | Auto-fills rubrics; generates peer review evaluations with AI. |
| **Hands-on Projects & Guided Labs** | `LAB` | Tracks interactive sandboxes transparently in the Skipped Audit Log. |
| **Discussion Forums** | `DISC` | Provides automated constructive reflections for forum prompts. |

---

## Design System

Designed strictly around the Petrol Teal (`#1F5C6B`) and Warm Stone (`#F5F4F0`) aesthetic:
- **Zero Emojis**: 100% clean vector SVG iconography.
- **Symmetrical 1-Line Controls**: Formats and content filters aligned on balanced grid rows.
- **Subtle Micro-interactions**: Hover depth, pulse activity indicators, and clean state switches.

---

## Privacy & Security Guarantees

- **100% Client-Side**: No central servers, databases, or analytics tracking.
- **Secure BYOK**: Your Google Gemini API key is stored exclusively in `chrome.storage.local` and transmitted only to official Google AI endpoints (`https://generativelanguage.googleapis.com/*`).
- **Least Privilege**: Manifest permissions are strictly limited to `storage`, `activeTab`, `scripting`, and Coursera/Google domains.

---

## Installation & Setup

1. Clone or download this repository:
   ```bash
   git clone https://github.com/rishabhahuja12/WordMine.git
   ```
2. Open Google Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** via the toggle switch in the top-right corner.
4. Click **Load unpacked** and select the `wordmine` project directory.
5. Open any Coursera course and click the WordMine icon in your extension toolbar.

---

## License & Contributing
WordMine is free and open-source software released under the [MIT License](LICENSE).
Contributions, bug reports, and suggestions are welcome via [GitHub Issues](https://github.com/rishabhahuja12/WordMine/issues).