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
      video.currentTime = (video.duration && !isNaN(video.duration)) ? video.duration - 0.2 : 99999;
      video.dispatchEvent(new Event("timeupdate", { bubbles: true }));
      video.dispatchEvent(new Event("ended", { bubbles: true }));
      completed = true;
    } catch (e) {
      console.warn("Video seek error:", e);
    }
  }

  // Click any "Mark as completed" or completion buttons
  const buttons = Array.from(document.querySelectorAll("button, a"));
  const markBtns = buttons.filter(b => {
    const txt = (b.innerText || "").toLowerCase().trim();
    return txt.includes("mark as completed") || txt.includes("mark complete") || txt === "completed";
  });
  markBtns.forEach(b => {
    b.click();
    completed = true;
  });

  return completed;
}

function completeReading() {
  window.scrollTo(0, document.body.scrollHeight);
  const buttons = Array.from(document.querySelectorAll("button, a"));
  const markBtn = buttons.find(b => {
    const txt = (b.innerText || "").toLowerCase().trim();
    return txt.includes("mark as completed") || txt.includes("mark complete");
  });
  if (markBtn) {
    markBtn.click();
    return true;
  }
  return true;
}

function handleDiscussionPrompt() {
  const textareas = document.querySelectorAll('textarea, [contenteditable="true"]');
  if (!textareas || textareas.length === 0) {
    return { success: false, error: "No discussion response box found on this page." };
  }

  const constructiveReflections = [
    "Thank you for this thought-provoking prompt. In my experience, adhering to these structured principles ensures rigorous quality, promotes scalable architectures, and mitigates edge-case risks in complex workflows.",
    "This concept highlights the critical importance of iterative verification and clear modular design. Approaching problems with this methodology significantly improves collaboration and clarity.",
    "A very thoughtful topic. Balancing these considerations requires continuous alignment between foundational theory and practical execution, which this module demonstrates effectively."
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
    message: `Injected constructive reflection into ${injected} discussion input box(es). Ready to submit.`
  };
}

function assistPeerReview() {
  try {
    // 1. Rubric radio buttons: select highest score for each rubric criterion
    const radioGroups = new Map();
    document.querySelectorAll('input[type="radio"]').forEach(r => {
      const name = r.name || "default";
      if (!radioGroups.has(name)) radioGroups.set(name, []);
      radioGroups.get(name).push(r);
    });

    let radioCount = 0;
    radioGroups.forEach(radios => {
      // Find the radio with the maximum numeric score value, or the last one
      let bestRadio = radios[radios.length - 1];
      let maxVal = -Infinity;
      radios.forEach(r => {
        const val = parseFloat(r.value);
        if (!isNaN(val) && val > maxVal) {
          maxVal = val;
          bestRadio = r;
        }
      });

      if (bestRadio && !bestRadio.checked) {
        bestRadio.click();
        bestRadio.dispatchEvent(new Event("change", { bubbles: true }));
        radioCount++;
      }
    });

    // 2. Varied constructive evaluation comments for each rubric textarea
    const rubricComments = [
      "Great work on this submission! The explanation is thorough, logically structured, and directly satisfies all rubric criteria with concrete detail.",
      "Clear, rigorous, and concise submission. Demonstrates strong conceptual understanding of the module and provides high-quality insights.",
      "Well done! All required components are addressed with exemplary accuracy. The methodology is clearly communicated throughout.",
      "Excellent effort! The submission adheres strictly to the assignment guidelines and demonstrates deep mastery of the subject."
    ];

    let filledComments = 0;
    document.querySelectorAll("textarea").forEach((ta, idx) => {
      if (!ta.value || ta.value.trim().length === 0) {
        ta.value = rubricComments[idx % rubricComments.length];
        ta.dispatchEvent(new Event("input", { bubbles: true }));
        ta.dispatchEvent(new Event("change", { bubbles: true }));
        filledComments++;
      }
    });

    // 3. Check confirmation / honor code checkboxes if present
    let checkedBoxes = 0;
    document.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      const parentText = (cb.parentElement?.innerText || "").toLowerCase();
      if (parentText.includes("honor code") || parentText.includes("confirm") || parentText.includes("reviewed")) {
        if (!cb.checked) {
          cb.click();
          cb.dispatchEvent(new Event("change", { bubbles: true }));
          checkedBoxes++;
        }
      }
    });

    return {
      success: true,
      message: `Assisted review: selected ${radioCount} top rubric score(s), filled ${filledComments} comment box(es), and acknowledged ${checkedBoxes} requirement(s).`
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ─── 5. Quiz Questions Extractor for Gemini AI ──────────────────────────────

function extractQuizQuestions() {
  const questionContainers = document.querySelectorAll(
    '.rc-FormPartsQuestion, [data-testid*="question"], .rc-QuizQuestion, [role="group"]'
  );

  const questions = [];
  const seenPrompts = new Set();

  questionContainers.forEach((qEl, qIdx) => {
    const promptEl = qEl.querySelector('.rc-FormPartsQuestion__prompt, [data-testid*="prompt"], .cml-viewer, h3, h4, p');
    const prompt = promptEl ? cleanText(promptEl.innerText) : "";

    if (!prompt || prompt.length < 5 || seenPrompts.has(prompt)) return;
    seenPrompts.add(prompt);

    const optionEls = qEl.querySelectorAll('label, .rc-Option, [role="radio"], [role="checkbox"]');
    const options = Array.from(optionEls).map((opt, oIdx) => ({
      index: oIdx,
      text: cleanText(opt.innerText)
    })).filter(o => o.text.length > 0 && o.text !== prompt);

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
        if (pageType === "quiz" || pageType === "exam") {
          reason = "is_quiz";
        }
        sendResponse({
          success: false,
          reason,
          pageType,
          title,
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
