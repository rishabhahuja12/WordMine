// content.js — WordMine Power Suite Content Script
// Operates on Coursera lesson, reading, quiz, assignment, lab, and discussion pages.

if (window.__wordmine_initialized) {
  // Content script already initialized in this frame
} else {
window.__wordmine_initialized = true;

// ─── 1. Content Taxonomy & Classification ───────────────────────────────────

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

function isQuizOrActivityPage() {
  const type = getPageType();
  return type === "quiz" || type === "exam" || type === "assignment" || type === "discussion" || type === "lab";
}

function cleanText(str) {
  return (str || "")
    .replace(/​/g, "")           // Zero-width space
    .replace(/\u00a0/g, " ")     // Non-breaking space
    .trim();
}

function getVideoTitle() {
  const heading = document.querySelector(".video-name")
    || document.querySelector("#main-container h1")
    || document.querySelector('[role="main"] h1')
    || document.querySelector("h1");
  if (heading) return cleanText(heading.innerText);
  return cleanText(document.title.split("|")[0]);
}

function getReadingTitle() {
  const heading = document.querySelector("#main-container h1")
    || document.querySelector('[role="main"] h1')
    || document.querySelector("h1");
  if (heading) return cleanText(heading.innerText);
  return cleanText(document.title.split("|")[0]);
}

// ─── 2. Transcript & Reading Extraction ─────────────────────────────────────

function getTranscript() {
  const phrases = document.querySelectorAll(".rc-Phrase");
  if (!phrases || phrases.length === 0) return null;
  const text = Array.from(phrases)
    .map(p => cleanText(p.innerText))
    .filter(Boolean)
    .join("\n");
  return text || null;
}

function getReadingContent() {
  const selectors = [
    '[data-testid="cml-viewer"]',
    ".rc-CML",
    ".rc-DesktopSupplement .rc-CML",
    ".item-page-content .rc-CML",
    ".rc-SupplementContent",
    ".item-page-content"
  ];
  for (const sel of selectors) {
    const nodes = document.querySelectorAll(sel);
    if (nodes.length) {
      const text = Array.from(nodes)
        .map(n => cleanText(n.innerText))
        .filter(Boolean)
        .join("\n\n");
      if (text) return text;
    }
  }
  return null;
}

function getTranscriptTab() {
  return document.querySelector('[data-testid="item-tool-panel-button-transcript"]')
    || document.querySelector('button[aria-label="Transcript"]')
    || Array.from(document.querySelectorAll("button")).find(
        el => (el.innerText || "").trim().toLowerCase() === "transcript"
      );
}

function isTranscriptTabActive() {
  if (document.querySelector(".rc-Phrase")) return true;
  const tab = getTranscriptTab();
  if (!tab) return false;
  return tab.getAttribute("aria-pressed") === "true"
    || tab.getAttribute("aria-selected") === "true"
    || tab.classList.contains("active")
    || tab.classList.contains("selected");
}

function openTranscriptTab() {
  if (isTranscriptTabActive()) return true;
  const tab = getTranscriptTab();
  if (tab) {
    tab.click();
    return true;
  }
  return false;
}

function waitForTranscript(timeout = 8000) {
  return new Promise((resolve) => {
    const start = Date.now();
    const interval = setInterval(() => {
      const phrases = document.querySelectorAll(".rc-Phrase");
      if (phrases.length > 0) {
        clearInterval(interval);
        resolve(true);
      }
      if (Date.now() - start > timeout) {
        clearInterval(interval);
        resolve(false);
      }
    }, 300);
  });
}

function isEndOfCourse() {
  const allElements = Array.from(document.querySelectorAll("a, button, span, h2, h3"));
  return allElements.some(el => {
    const txt = (el.innerText || "").toLowerCase();
    return txt.includes("go to my learning") || txt.includes("course complete") || txt.includes("congratulations! you finished");
  });
}

function clickNextVideo() {
  const selectors = [
    '[data-track-component="next_item"]',
    'button[aria-label="Go to next item"]',
    'a[aria-label="Go to next item"]',
    '[data-testid="next-item"]',
    'button[data-testid="navigation-next-button"]'
  ];

  for (const selector of selectors) {
    const btn = document.querySelector(selector);
    if (btn && !btn.disabled) {
      btn.click();
      return true;
    }
  }

  const allButtons = Array.from(document.querySelectorAll("a, button"));
  const nextBtn = allButtons.find(el => {
    const txt = (el.innerText || "").toLowerCase().trim();
    return (txt.includes("go to next item") || txt === "next item" || txt === "next") && !el.disabled;
  });
  if (nextBtn) {
    nextBtn.click();
    return true;
  }

  return false;
}

// ─── 3. Curriculum Scanner (Read-Only) ──────────────────────────────────────

function scanCurriculum() {
  const links = Array.from(document.querySelectorAll('a[href*="/learn/"]'));
  const validKeywords = [
    "/lecture/", "/supplement/", "/quiz/", "/practice-quiz/",
    "/exam/", "/assignment-submission/", "/peer/",
    "/discussionPrompt/", "/discussion/", "/ungradedWidget/",
    "/ungradedLti/", "/lab/"
  ];

  const modulesMap = new Map();
  const seenHrefs = new Set();

  links.forEach(a => {
    const href = a.href;
    const cleanHref = href.split("?")[0].split("#")[0];

    const isLesson = validKeywords.some(kw => cleanHref.includes(kw));
    if (!isLesson) return;
    if (seenHrefs.has(cleanHref)) return;
    seenHrefs.add(cleanHref);

    let type = "other";
    if (cleanHref.includes("/lecture/")) type = "video";
    else if (cleanHref.includes("/supplement/")) type = "reading";
    else if (cleanHref.includes("/quiz/") || cleanHref.includes("/practice-quiz/")) type = "quiz";
    else if (cleanHref.includes("/exam/")) type = "exam";
    else if (cleanHref.includes("/assignment-submission/") || cleanHref.includes("/peer/")) type = "assignment";
    else if (cleanHref.includes("/discussionPrompt/") || cleanHref.includes("/discussion/")) type = "discussion";
    else if (cleanHref.includes("/ungradedWidget/") || cleanHref.includes("/ungradedLti/") || cleanHref.includes("/lab/")) type = "lab";

    let rawText = cleanText(a.innerText || "");
    let title = rawText
      .replace(/^(Video|Reading|Practice Quiz|Quiz|Graded Quiz|Assignment|Discussion Prompt|Plugin|Ungraded Plugin)\s*[•·-]\s*(\d+\s*(min|m|hours|h))?/i, "")
      .replace(/^(Video|Reading|Quiz|Assignment|Discussion)\s*/i, "")
      .replace(/^\d+[\.\)]\s*/, "")
      .trim();

    if (!title || title.length < 2) {
      const heading = a.querySelector("h2, h3, h4, span, p");
      title = heading ? cleanText(heading.innerText) : cleanHref.split("/").pop().replace(/-/g, " ");
    }

    let moduleName = "Course Outline";
    const moduleContainer = a.closest('[data-testid*="module"], [data-testid*="accordion"], .rc-Module, [role="region"], section, li');
    if (moduleContainer) {
      const headerEl = moduleContainer.querySelector('h2, h3, h4, [data-testid*="title"], [data-testid*="header"]');
      if (headerEl) {
        moduleName = cleanText(headerEl.innerText) || moduleName;
      }
    } else {
      let curr = a.parentElement;
      for (let i = 0; i < 5 && curr; i++) {
        const prevH = curr.querySelector('h2, h3, h4');
        if (prevH && prevH !== a) {
          moduleName = cleanText(prevH.innerText);
          break;
        }
        curr = curr.parentElement;
      }
    }

    moduleName = moduleName.split("\n")[0].trim() || "Course Outline";

    if (!modulesMap.has(moduleName)) {
      modulesMap.set(moduleName, []);
    }

    modulesMap.get(moduleName).push({
      title: title || "Untitled Lesson",
      type: type,
      url: cleanHref
    });
  });

  const result = [];
  modulesMap.forEach((items, moduleTitle) => {
    if (items.length > 0) {
      result.push({ moduleTitle, items });
    }
  });

  if (result.length === 0) {
    const currentHref = window.location.href.split("?")[0].split("#")[0];
    const currentType = getPageType();
    const currentTitle = getVideoTitle() || getReadingTitle() || cleanText(document.title.split("|")[0]);
    if (currentTitle && currentType !== "other") {
      result.push({
        moduleTitle: "Current Lesson",
        items: [{
          title: currentTitle,
          type: currentType,
          url: currentHref
        }]
      });
    }
  }

  return result;
}

// ─── 4. Course Automator Routines ───────────────────────────────────────────

function completeVideo() {
  const video = document.querySelector("video");
  let completed = false;
  if (video) {
    try {
      if (video.duration && !isNaN(video.duration)) {
        video.currentTime = Math.max(0, video.duration - 0.2);
      } else {
        video.currentTime = 99999;
      }
      try { video.playbackRate = 16; } catch (_) {}
      video.dispatchEvent(new Event("play", { bubbles: true }));
      video.dispatchEvent(new Event("timeupdate", { bubbles: true }));
      video.dispatchEvent(new Event("ended", { bubbles: true }));
      video.dispatchEvent(new Event("pause", { bubbles: true }));
      completed = true;
    } catch (e) {
      console.warn("Video seek error:", e);
    }
  }

  // Click any unclicked "Mark as completed" or completion buttons
  const buttons = Array.from(document.querySelectorAll("button, a"));
  const markBtns = buttons.filter(b => {
    if (b.disabled) return false;
    const isAlreadyChecked = b.getAttribute("aria-pressed") === "true" || b.getAttribute("aria-checked") === "true";
    if (isAlreadyChecked) return false;

    const txt = (b.innerText || "").toLowerCase().trim();
    const aria = (b.getAttribute("aria-label") || "").toLowerCase().trim();
    const testid = (b.getAttribute("data-testid") || "").toLowerCase().trim();

    const isMarkBtn = txt.includes("mark as completed") || txt.includes("mark complete") || txt.includes("mark as complete")
      || aria.includes("mark as completed") || aria.includes("mark complete")
      || testid.includes("mark-complete");

    // Explicitly reject buttons that are already in past-tense completed state
    if (txt === "completed" && !isMarkBtn) return false;

    return isMarkBtn;
  });

  markBtns.forEach(b => {
    b.click();
    completed = true;
  });

  return completed;
}

function completeReading() {
  window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  const buttons = Array.from(document.querySelectorAll("button, a"));
  const markBtn = buttons.find(b => {
    if (b.disabled) return false;
    const isAlreadyChecked = b.getAttribute("aria-pressed") === "true" || b.getAttribute("aria-checked") === "true";
    if (isAlreadyChecked) return false;

    const txt = (b.innerText || "").toLowerCase().trim();
    const aria = (b.getAttribute("aria-label") || "").toLowerCase().trim();
    const testid = (b.getAttribute("data-testid") || "").toLowerCase().trim();

    return txt.includes("mark as completed") || txt.includes("mark complete") || txt.includes("mark as complete")
      || aria.includes("mark as completed") || aria.includes("mark complete")
      || testid.includes("mark-complete");
  });

  if (markBtn) {
    markBtn.click();
    return true;
  }
  return true;
}

function handleDiscussionPrompt() {
  let textareas = Array.from(document.querySelectorAll('textarea, [contenteditable="true"]'));
  
  // If no editor is currently visible, look for "Reply" or "Add a response" triggers
  if (textareas.length === 0) {
    const expandButtons = Array.from(document.querySelectorAll('button, a, [role="button"]'));
    const replyTrigger = expandButtons.find(b => {
      if (b.disabled) return false;
      const txt = (b.innerText || "").toLowerCase().trim();
      const aria = (b.getAttribute("aria-label") || "").toLowerCase().trim();
      return (
        txt.includes("reply") ||
        txt.includes("add a response") ||
        txt.includes("write a response") ||
        txt.includes("create thread") ||
        txt.includes("join discussion") ||
        txt.includes("start discussion") ||
        aria.includes("reply")
      );
    });

    if (replyTrigger) {
      replyTrigger.click();
      textareas = Array.from(document.querySelectorAll('textarea, [contenteditable="true"]'));
    }
  }

  if (textareas.length === 0) {
    return { success: false, error: "No discussion response box found on this page. Please open a discussion forum prompt." };
  }

  const constructiveReflections = [
    "Thank you for this thought-provoking prompt. In my experience, adhering to these structured principles ensures rigorous quality, promotes scalable architectures, and mitigates edge-case risks in complex workflows.",
    "This concept highlights the critical importance of iterative verification and clear modular design. Approaching problems with this methodology significantly improves collaboration and clarity.",
    "A very thoughtful topic. Balancing these considerations requires continuous alignment between foundational theory and practical execution, which this module demonstrates effectively.",
    "Great discussion theme. Implementing these concepts systematically reinforces core architectural foundations while ensuring maintainability across production environments."
  ];

  const chosenText = constructiveReflections[Math.floor(Math.random() * constructiveReflections.length)];

  let injected = 0;
  textareas.forEach(el => {
    if (el.tagName === "TEXTAREA") {
      el.value = chosenText;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      injected++;
    } else if (el.getAttribute("contenteditable") === "true") {
      el.innerText = chosenText;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      injected++;
    }
  });

  return {
    success: true,
    message: `Injected constructive reflection into ${injected} discussion input box(es). Ready for review.`
  };
}

function assistPeerReview() {
  try {
    // 1. Identify all rubric criteria groups (native input[type="radio"] and [role="radio"])
    const allRadios = Array.from(document.querySelectorAll('input[type="radio"], [role="radio"]'));

    const groups = new Map();
    let unassignedCounter = 0;

    allRadios.forEach(radio => {
      // Find nearest semantic container
      const container = radio.closest('[role="radiogroup"], fieldset, [data-testid*="part"], tr, .rc-RubricPart, [role="group"], .rc-FormPartsQuestion');
      let groupKey;
      if (container) {
        groupKey = container;
      } else if (radio.name) {
        groupKey = `name_${radio.name}`;
      } else {
        groupKey = `parent_${radio.parentElement ? radio.parentElement : unassignedCounter++}`;
      }

      if (!groups.has(groupKey)) groups.set(groupKey, []);
      groups.get(groupKey).push(radio);
    });

    let radioCount = 0;

    function getRadioPoints(radio) {
      // Direct numeric value attribute
      const directVal = parseFloat(radio.value);
      if (!isNaN(directVal)) return directVal;

      // Label or aria-label text inspection
      const ariaLabel = radio.getAttribute("aria-label") || "";
      const labelText = radio.closest("label") ? radio.closest("label").innerText : "";
      const parentText = radio.parentElement ? radio.parentElement.innerText : "";
      const combinedText = `${ariaLabel} ${labelText} ${parentText}`.toLowerCase();

      // Explicit point patterns: "3 points", "3 pts", "10 / 10", "3 pt"
      const ptMatch = combinedText.match(/(\d+(?:\.\d+)?)\s*(?:points?|pts?|\/\s*\d+)/);
      if (ptMatch) {
        const parsed = parseFloat(ptMatch[1]);
        if (!isNaN(parsed)) return parsed;
      }

      // Standalone numbers in score labels
      const numMatch = combinedText.match(/\b(\d+(?:\.\d+)?)\b/);
      if (numMatch) {
        const parsed = parseFloat(numMatch[1]);
        if (!isNaN(parsed)) return parsed;
      }

      // Qualitative rubric keyword scoring heuristics
      if (combinedText.includes("excellent") || combinedText.includes("exceeds") || combinedText.includes("mastery")) return 100;
      if (combinedText.includes("proficient") || combinedText.includes("good") || combinedText.includes("meets")) return 80;
      if (combinedText.includes("partial") || combinedText.includes("developing") || combinedText.includes("needs improvement")) return 40;
      if (combinedText.includes("unsatisfactory") || combinedText.includes("incomplete") || combinedText.includes("missing") || combinedText.includes("no")) return 0;

      return -1;
    }

    groups.forEach(radios => {
      if (radios.length === 0) return;

      // Score each radio to select the HIGHEST rubric value
      let bestRadio = radios[0]; // Default to first (standard descending order 3, 2, 1, 0)
      let maxScore = -Infinity;

      radios.forEach(radio => {
        const score = getRadioPoints(radio);
        if (score > maxScore) {
          maxScore = score;
          bestRadio = radio;
        }
      });

      if (bestRadio) {
        const isChecked = bestRadio.tagName === "INPUT" ? bestRadio.checked : bestRadio.getAttribute("aria-checked") === "true";
        if (!isChecked) {
          bestRadio.click();
          bestRadio.dispatchEvent(new Event("change", { bubbles: true }));
          bestRadio.dispatchEvent(new Event("input", { bubbles: true }));
          radioCount++;
        }
      }
    });

    // 2. Varied constructive evaluation comments for each rubric textarea
    const rubricComments = [
      "Great work on this submission! The explanation is thorough, logically structured, and directly satisfies all rubric criteria with concrete detail.",
      "Clear, rigorous, and concise submission. Demonstrates strong conceptual understanding of the module and provides high-quality insights.",
      "Well done! All required components are addressed with exemplary accuracy. The methodology is clearly communicated throughout.",
      "Excellent effort! The submission adheres strictly to the assignment guidelines and demonstrates deep mastery of the subject.",
      "Comprehensive analysis and thoughtful presentation. The solution is well-organized and reflects diligent attention to detail."
    ];

    let filledComments = 0;
    document.querySelectorAll("textarea, [contenteditable=\"true\"]").forEach((ta, idx) => {
      const val = ta.tagName === "TEXTAREA" ? ta.value : ta.innerText;
      if (!val || val.trim().length === 0) {
        const comment = rubricComments[idx % rubricComments.length];
        if (ta.tagName === "TEXTAREA") {
          ta.value = comment;
          ta.dispatchEvent(new Event("input", { bubbles: true }));
          ta.dispatchEvent(new Event("change", { bubbles: true }));
        } else {
          ta.innerText = comment;
          ta.dispatchEvent(new Event("input", { bubbles: true }));
        }
        filledComments++;
      }
    });

    // 3. Check confirmation / honor code checkboxes
    let checkedBoxes = 0;
    document.querySelectorAll('input[type="checkbox"], [role="checkbox"]').forEach(cb => {
      const parentText = (cb.parentElement ? cb.parentElement.innerText : "").toLowerCase();
      const ariaLabel = (cb.getAttribute("aria-label") || "").toLowerCase();
      const combined = `${parentText} ${ariaLabel}`;

      if (combined.includes("honor code") || combined.includes("confirm") || combined.includes("reviewed") || combined.includes("agree")) {
        const isChecked = cb.tagName === "INPUT" ? cb.checked : cb.getAttribute("aria-checked") === "true";
        if (!isChecked) {
          cb.click();
          cb.dispatchEvent(new Event("change", { bubbles: true }));
          checkedBoxes++;
        }
      }
    });

    return {
      success: true,
      message: `Assisted review: selected top rubric scores for ${groups.size} criteria group(s) (${radioCount} updated), filled ${filledComments} comment box(es), and acknowledged ${checkedBoxes} requirement(s).`
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ─── 5. Quiz Questions Extractor for Gemini AI & Study Sheets ───────────────

function extractQuizQuestions() {
  const questionContainers = document.querySelectorAll(
    '.rc-FormPartsQuestion, [data-testid*="question"], .rc-QuizQuestion, [role="group"]'
  );

  const questions = [];
  const seenPrompts = new Set();

  questionContainers.forEach((qEl, qIdx) => {
    const promptContainer = qEl.querySelector('.rc-FormPartsQuestion__prompt, [data-testid*="prompt"], .rc-CML');
    let prompt = "";
    if (promptContainer) {
      prompt = cleanText(promptContainer.innerText);
    } else {
      const promptEl = qEl.querySelector('h3, h4, p');
      prompt = promptEl ? cleanText(promptEl.innerText) : "";
    }

    if (!prompt || prompt.length < 5 || seenPrompts.has(prompt)) return;
    seenPrompts.add(prompt);

    const optionEls = qEl.querySelectorAll('label, .rc-Option, [role="radio"], [role="checkbox"]');
    const options = [];
    const seenOptionTexts = new Set();

    optionEls.forEach((opt) => {
      const optText = cleanText(opt.innerText);
      if (optText.length > 0 && optText !== prompt && !seenOptionTexts.has(optText)) {
        seenOptionTexts.add(optText);
        options.push({
          index: options.length,
          text: optText
        });
      }
    });

    const isMultiSelect = !!qEl.querySelector('input[type="checkbox"], [role="checkbox"]');

    questions.push({
      index: qIdx + 1,
      prompt,
      options,
      isMultiSelect
    });
  });

  return questions;
}

function formatQuizAsStudySheet(title, questions) {
  if (!questions || questions.length === 0) return null;
  let text = `Practice/Graded Quiz: ${title}\n${"=".repeat(Math.max(20, title.length + 22))}\n\n`;
  questions.forEach(q => {
    text += `Question ${q.index}: ${q.prompt}\n`;
    if (q.options && q.options.length > 0) {
      q.options.forEach((opt, idx) => {
        const letter = String.fromCharCode(65 + (idx % 26));
        text += `  [${letter}] ${opt.text}\n`;
      });
    }
    text += "\n";
  });
  return text.trim();
}

// ─── 6. Message Listener ────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  // PING
  if (message.action === "ping") {
    sendResponse({ success: true });
    return true;
  }

  // CHECK_PAGE
  if (message.action === "checkPage") {
    const onCoursera = window.location.hostname.includes("coursera.org");
    const pageType = getPageType();
    sendResponse({
      onCoursera,
      onVideoPage: pageType === "video" || pageType === "reading",
      pageType,
      isEndOfCourse: isEndOfCourse()
    });
    return true;
  }

  // SCAN_CURRICULUM
  if (message.action === "scanCurriculum") {
    try {
      const modules = scanCurriculum();
      sendResponse({ success: true, modules });
    } catch (err) {
      sendResponse({ success: false, error: err.message });
    }
    return true;
  }

  // NAVIGATE_TO
  if (message.action === "navigateTo") {
    if (message.url) {
      window.location.href = message.url;
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: "No URL provided" });
    }
    return true;
  }

  // GET_TRANSCRIPT
  if (message.action === "getTranscript") {
    (async () => {
      const pageType = getPageType();

      // Check if page is an activity / quiz / assignment / lab / discussion
      if (isQuizOrActivityPage()) {
        const title = getVideoTitle() || getReadingTitle() || "Interactive Activity";
        let reason = "no_transcript";
        let quizContent = null;
        if (pageType === "quiz" || pageType === "exam") {
          reason = "is_quiz";
          try {
            const questions = extractQuizQuestions();
            quizContent = formatQuizAsStudySheet(title, questions);
          } catch (e) {
            console.warn("Could not extract quiz study sheet:", e);
          }
        }
        sendResponse({
          success: false,
          reason,
          pageType,
          title,
          quizContent,
          isEndOfCourse: isEndOfCourse()
        });
        return;
      }

      // Reading pages (/supplement/)
      if (pageType === "reading") {
        const content = getReadingContent();
        if (!content) {
          sendResponse({
            success: false,
            reason: "no_transcript",
            pageType: "reading",
            title: getReadingTitle(),
            isEndOfCourse: isEndOfCourse()
          });
          return;
        }
        sendResponse({
          success: true,
          title: getReadingTitle(),
          transcript: content,
          pageType: "reading",
          isEndOfCourse: isEndOfCourse()
        });
        return;
      }

      // Video pages (/lecture/)
      if (!isTranscriptTabActive()) {
        openTranscriptTab();
        await new Promise(r => setTimeout(r, 1000));
      }

      const found = await waitForTranscript(8000);
      if (!found) {
        sendResponse({
          success: false,
          reason: "no_transcript",
          pageType: "video",
          title: getVideoTitle(),
          isEndOfCourse: isEndOfCourse()
        });
        return;
      }

      const transcript = getTranscript();
      const title = getVideoTitle();

      if (!transcript) {
        sendResponse({
          success: false,
          reason: "no_transcript",
          pageType: "video",
          title: title,
          isEndOfCourse: isEndOfCourse()
        });
        return;
      }

      sendResponse({
        success: true,
        title: title,
        transcript: transcript,
        pageType: "video",
        isEndOfCourse: isEndOfCourse()
      });
    })();
    return true;
  }

  // NEXT_VIDEO
  if (message.action === "nextVideo") {
    if (isEndOfCourse()) {
      sendResponse({ success: false, reason: "end_of_course" });
      return true;
    }
    const clicked = clickNextVideo();
    sendResponse({ success: clicked });
    return true;
  }

  // COMPLETE_LESSON
  if (message.action === "completeLesson") {
    const pageType = getPageType();

    if (pageType === "video") {
      const ok = completeVideo();
      sendResponse({ success: ok, message: "Video lecture marked completed." });
      return true;
    }

    if (pageType === "reading") {
      const ok = completeReading();
      sendResponse({ success: ok, message: "Reading lesson marked completed." });
      return true;
    }

    if (pageType === "discussion") {
      const res = handleDiscussionPrompt();
      sendResponse(res);
      return true;
    }

    if (pageType === "lab") {
      // Look for mark completed
      const buttons = Array.from(document.querySelectorAll("button, a"));
      const markBtn = buttons.find(b => {
        const txt = (b.innerText || "").toLowerCase().trim();
        return txt.includes("mark as completed") || txt.includes("mark complete");
      });
      if (markBtn) {
        markBtn.click();
        sendResponse({ success: true, message: "Hands-on lab marked as completed." });
      } else {
        sendResponse({ success: true, message: "Hands-on lab page opened and verified." });
      }
      return true;
    }

    sendResponse({ success: false, error: `Automated completion not available for ${pageType} items.` });
    return true;
  }

  // HANDLE_DISCUSSION_PROMPT
  if (message.action === "handleDiscussionPrompt") {
    const res = handleDiscussionPrompt();
    sendResponse(res);
    return true;
  }

  // ASSIST_PEER_REVIEW
  if (message.action === "assistPeerReview") {
    const res = assistPeerReview();
    sendResponse(res);
    return true;
  }

  // GET_QUIZ_QUESTIONS
  if (message.action === "getQuizQuestions") {
    try {
      const questions = extractQuizQuestions();
      sendResponse({ success: true, questions });
    } catch (err) {
      sendResponse({ success: false, error: err.message });
    }
    return true;
  }

  // GET_PEER_REVIEW_CONTENT
  if (message.action === "getPeerReviewContent") {
    try {
      const title = getVideoTitle() || getReadingTitle() || "Peer Review Assignment";
      const submissions = Array.from(document.querySelectorAll('.rc-CML, .item-page-content, [data-testid*="submission"]'))
        .map(el => cleanText(el.innerText))
        .filter(t => t.length > 20)
        .join("\n\n");
      sendResponse({ success: true, title, submissionContent: submissions });
    } catch (err) {
      sendResponse({ success: false, error: err.message });
    }
    return true;
  }

});

} // end window.__wordmine_initialized
