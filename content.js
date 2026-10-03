// content.js — runs on every Coursera lesson page
// Listens for messages from popup.js and responds with transcript / reading data
//
// Note on the 2024+ Coursera redesign:
// The Transcript / Notes / Files controls now live in a right-hand side panel.
// The active tab is indicated with aria-pressed (it used to be aria-selected),
// and re-clicking the active tab toggles the panel closed — so we must only
// click the Transcript tab when it is NOT already active.

// ─── Helpers ────────────────────────────────────────────────────────────────

function isReadingPage() {
  // Reading / summary pages live under /supplement/
  return window.location.href.includes("/supplement/");
}

function cleanText(str) {
  // Strip zero-width spaces injected into the transcript markup, normalise nbsp
  return str.replace(/​/g, "").replace(/ /g, " ").trim();
}

function getVideoTitle() {
  const heading = document.querySelector(".video-name")
    || document.querySelector("#main-container h1")
    || document.querySelector("h1");
  if (heading) return heading.innerText.trim();
  return document.title.split("|")[0].trim() || "Untitled";
}

function getReadingTitle() {
  // The reading title is the first heading inside the main content area
  const heading = document.querySelector("#main-container h1")
    || document.querySelector('[role="main"] h1')
    || document.querySelector("h1");
  if (heading) return heading.innerText.trim();
  return document.title.split("|")[0].trim() || "Untitled";
}

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
  // Coursera renders reading bodies as CML (Coursera Markup Language)
  const selectors = [
    '[data-testid="cml-viewer"]',
    ".rc-CML",
    ".rc-DesktopSupplement .rc-CML",
    ".item-page-content .rc-CML",
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

// ─── Transcript tab (right-hand side panel) ──────────────────────────────────

function getTranscriptTab() {
  return document.querySelector('[data-testid="item-tool-panel-button-transcript"]')
    || document.querySelector('button[aria-label="Transcript"]')
    || Array.from(document.querySelectorAll("button")).find(
        el => el.innerText.trim().toLowerCase() === "transcript"
      );
}

function isTranscriptTabActive() {
  // The transcript phrases being present in the DOM is the real signal that the
  // panel is open and showing the transcript.
  if (document.querySelector(".rc-Phrase")) return true;

  const tab = getTranscriptTab();
  if (!tab) return false;
  // New UI uses aria-pressed; keep aria-selected/class checks for safety.
  return tab.getAttribute("aria-pressed") === "true"
    || tab.getAttribute("aria-selected") === "true"
    || tab.classList.contains("active")
    || tab.classList.contains("selected");
}

function openTranscriptTab() {
  // Only click when the transcript isn't already showing — clicking an already
  // active tab in the new UI collapses the panel.
  if (isTranscriptTabActive()) return true;
  const tab = getTranscriptTab();
  if (tab) {
    tab.click();
    return true;
  }
  return false;
}

function isEndOfCourse() {
  // "Go to My Learning" appears on the last page of a course
  const allButtons = Array.from(document.querySelectorAll("a, button"));
  return allButtons.some(el =>
    el.innerText.trim().toLowerCase().includes("go to my learning")
  );
}

function clickNextVideo() {
  const selectors = [
    '[data-track-component="next_item"]',
    'button[aria-label="Go to next item"]',
    'a[aria-label="Go to next item"]',
  ];

  for (const selector of selectors) {
    const btn = document.querySelector(selector);
    if (btn) {
      btn.click();
      return true;
    }
  }

  // Fallback: find by text content
  const allButtons = Array.from(document.querySelectorAll("a, button"));
  const nextBtn = allButtons.find(el =>
    el.innerText.trim().toLowerCase().includes("go to next item")
  );
  if (nextBtn) {
    nextBtn.click();
    return true;
  }

  return false;
}

function waitForTranscript(timeout = 8000) {
  // Returns a promise that resolves when transcript phrases appear
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
        resolve(false); // timed out — no transcript on this page
      }
    }, 300);
  });
}

function isQuizPage() {
  const url = window.location.href;
  return url.includes("/quiz/") || 
         url.includes("/exam/") || 
         url.includes("/practice-quiz/") || 
         url.includes("/assignment-submission/") || 
         url.includes("/peer/") || 
         url.includes("/discussionPrompt/") || 
         url.includes("/discussion/") || 
         url.includes("/ungradedWidget/") || 
         url.includes("/ungradedLti/");
}

function getPageType() {
  const url = window.location.href;
  if (url.includes("/lecture/")) return "video";
  if (url.includes("/supplement/")) return "reading";
  if (url.includes("/quiz/") || url.includes("/practice-quiz/")) return "quiz";
  if (url.includes("/exam/")) return "exam";
  if (url.includes("/assignment-submission/") || url.includes("/peer/")) return "assignment";
  if (url.includes("/discussionPrompt/") || url.includes("/discussion/")) return "discussion";
  if (url.includes("/ungradedWidget/") || url.includes("/ungradedLti/")) return "lab";
  return "other";
}

async function scanCurriculum() {
  // If sidebar / navigation drawer is present but collapsed, safely attempt to open it.
  // CRITICAL: NEVER click anything containing 'next', 'prev', or pagination buttons!
  const drawerBtn = document.querySelector(
    '[data-testid="item-sidebar-toggle"], button[aria-label="Course Material"], button[aria-label="Course navigation"], button[aria-label="Toggle navigation menu"], button[aria-label="Course Outline"]'
  );
  if (drawerBtn) {
    const label = (drawerBtn.getAttribute("aria-label") || "").toLowerCase();
    const isNavigationPager = label.includes("next") || label.includes("prev") || label.includes("item");
    if (!isNavigationPager && drawerBtn.getAttribute("aria-expanded") === "false") {
      try {
        drawerBtn.click();
        await new Promise(r => setTimeout(r, 500));
      } catch {
        // ignore
      }
    }
  }

  // Find all lesson item links in the DOM
  const links = Array.from(document.querySelectorAll('a[href*="/learn/"]'));
  const validPathKeywords = ["/lecture/", "/supplement/", "/quiz/", "/exam/", "/assignment-submission/", "/peer/", "/discussionPrompt/", "/ungradedWidget/"];

  const modulesMap = new Map();
  const seenHrefs = new Set();

  links.forEach(a => {
    const href = a.href;
    const cleanHref = href.split("?")[0].split("#")[0];

    const isLessonLink = validPathKeywords.some(keyword => cleanHref.includes(keyword));
    if (!isLessonLink) return;
    if (seenHrefs.has(cleanHref)) return;
    seenHrefs.add(cleanHref);

    let type = "other";
    if (cleanHref.includes("/lecture/")) type = "video";
    else if (cleanHref.includes("/supplement/")) type = "reading";
    else if (cleanHref.includes("/quiz/") || cleanHref.includes("/practice-quiz/")) type = "quiz";
    else if (cleanHref.includes("/exam/")) type = "exam";
    else if (cleanHref.includes("/assignment-submission/") || cleanHref.includes("/peer/")) type = "assignment";
    else if (cleanHref.includes("/discussionPrompt/") || cleanHref.includes("/discussion/")) type = "discussion";
    else if (cleanHref.includes("/ungradedWidget/") || cleanHref.includes("/ungradedLti/")) type = "lab";

    // Clean up title text
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

    // Determine module or week container
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

    // Clean up module name
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
      result.push({
        moduleTitle,
        items
      });
    }
  });

  // Fallback: If no sidebar/syllabus links are visible in DOM, include the current page lesson
  if (result.length === 0) {
    const currentHref = window.location.href.split("?")[0].split("#")[0];
    const currentType = getPageType();
    const currentTitle = getVideoTitle() || getReadingTitle() || document.title.split("|")[0].trim();
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

// ─── Message listener ────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  // PING — check if content script is loaded on this page
  if (message.action === "ping") {
    sendResponse({ success: true });
    return true;
  }

  // SCAN_CURRICULUM — scan and return all course modules and items
  if (message.action === "scanCurriculum") {
    (async () => {
      try {
        const modules = await scanCurriculum();
        sendResponse({ success: true, modules });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  // NAVIGATE_TO — navigate to a specific lesson URL
  if (message.action === "navigateTo") {
    if (message.url) {
      window.location.href = message.url;
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: "No URL provided" });
    }
    return true;
  }

  // GET_TRANSCRIPT — extract transcript (video) or content (reading) from page
  if (message.action === "getTranscript") {
    (async () => {

      // Check if page is an activity / quiz / assignment
      if (isQuizPage()) {
        sendResponse({
          success: false,
          reason: "is_quiz",
          pageType: getPageType(),
          title: getVideoTitle() || getReadingTitle() || "Quiz / Assignment",
          isEndOfCourse: isEndOfCourse()
        });
        return;
      }

      // ── Reading / summary pages ──────────────────────────────────────────
      if (isReadingPage()) {
        const content = getReadingContent();
        if (!content) {
          sendResponse({
            success: false,
            reason: "no_transcript",
            isEndOfCourse: isEndOfCourse()
          });
          return;
        }
        sendResponse({
          success: true,
          title: getReadingTitle(),
          transcript: content,
          isEndOfCourse: isEndOfCourse()
        });
        return;
      }

      // ── Video pages ──────────────────────────────────────────────────────
      // Open the Transcript tab in the right-hand panel if it isn't already.
      if (!isTranscriptTabActive()) {
        openTranscriptTab();
        await new Promise(r => setTimeout(r, 1000));
      }

      const found = await waitForTranscript(8000);

      if (!found) {
        sendResponse({
          success: false,
          reason: "no_transcript",
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
          isEndOfCourse: isEndOfCourse()
        });
        return;
      }

      sendResponse({
        success: true,
        title: title,
        transcript: transcript,
        isEndOfCourse: isEndOfCourse()
      });
    })();
    return true; // keep message channel open for async response
  }

  // NEXT_VIDEO — click the next button
  if (message.action === "nextVideo") {
    if (isEndOfCourse()) {
      sendResponse({ success: false, reason: "end_of_course" });
      return true;
    }
    const clicked = clickNextVideo();
    sendResponse({ success: clicked });
    return true;
  }

  // CHECK_PAGE — check if we're on a lesson page
  if (message.action === "checkPage") {
    const onCoursera = window.location.hostname === "www.coursera.org";
    const onVideoPage = window.location.href.includes("/lecture/")
      || window.location.href.includes("/supplement/")
      || window.location.href.includes("/learn/");
    sendResponse({
      onCoursera,
      onVideoPage,
      isEndOfCourse: isEndOfCourse()
    });
    return true;
  }

});
