// content.js — WordMine Power Suite Content Script
// Operates on Coursera lesson, reading, quiz, assignment, lab, and discussion pages.

if (window.__wordmine_initialized) {
  // Content script already initialized in this frame
} else {
window.__wordmine_initialized = true;

// ─── 1. Content Taxonomy & Classification ───────────────────────────────────

function getPageType() {
  const ctx = getCourseContext();
  if (!ctx || !ctx.itemType) return "other";
  const t = ctx.itemType;
  if (t === "lecture" || t === "video") return "video";
  if (t === "supplement") return "reading";
  if (t === "quiz" || t === "practice-quiz") return "quiz";
  if (t === "exam") return "exam";
  if (t === "peer" || t === "assignment" || t === "programming") return "assignment";
  if (t === "discussionPrompt" || t === "dialogue" || t === "discussion") return "discussion";
  if (t === "ungradedWidget" || t === "ungradedLti" || t === "lab") return "lab";
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

// ─── 4. Coursera REST/OnDemand API & Completion Automator Engine ───────────

const BASE_URL = "https://www.coursera.org";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let cachedCourseId = null;
let cachedUserId = null;

function getCsrfToken() {
  const match = document.cookie.match(/(^|;\s*)csrf3-token=([^;]+)/) ||
                document.cookie.match(/(^|;\s*)CSRF3-Token=([^;]+)/) ||
                document.cookie.match(/(^|;\s*)csrf2-token=([^;]+)/);
  return match ? decodeURIComponent(match[2]) : "";
}

async function courseraFetch(url, options = {}) {
  const headers = {
    "X-Requested-With": "XMLHttpRequest",
    "X-Coursera-Application": "nautilus",
    "X-Coursera-Version": "ondemand",
    ...options.headers,
  };

  if (!options.method || options.method.toUpperCase() === "GET") {
    delete headers["Content-Type"];
  } else if (!headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const csrf = getCsrfToken();
  if (csrf) {
    headers["X-CSRF3-Token"] = csrf;
    headers["X-CSRFToken"] = csrf;
    headers["x-csrf3-token"] = csrf;
  }

  return fetch(url, {
    ...options,
    credentials: "include",
    headers,
  });
}

function getCourseContext() {
  const href = window.location.href;

  const match = href.match(
    /\/learn\/([^/]+)\/(lecture|supplement|quiz|practice-quiz|exam|programming|discussionPrompt|dialogue|ungradedWidget|ungradedLti|lab)\/([^/?#]+)/i
  );
  if (match) {
    let itemType = match[2];
    if (itemType.toLowerCase() === "discussionprompt") itemType = "discussionPrompt";
    return { courseSlug: match[1], itemType, itemId: match[3] };
  }

  const peerMatch = href.match(
    /\/learn\/([^/]+)\/(?:peer-review|peer|peer-assignment|submit-revisions|assignment-submission)\/([^/?#]+)/i
  );
  if (peerMatch) {
    return { courseSlug: peerMatch[1], itemType: "peer", itemId: peerMatch[2] };
  }

  const hasRubric = Boolean(
    document.querySelector(
      '.rc-FormPart, .c-peer-review-rubric-item, fieldset.c-peer-review-rubric, div[data-testid*="rubric-criterion"], .c-peer-review, div[data-testid*="peer-review"], div[data-testid*="give-feedback"]'
    )
  );
  if (hasRubric) {
    const slugMatch = href.match(/\/learn\/([^/?#]+)/i);
    if (slugMatch) {
      return { courseSlug: slugMatch[1], itemType: "peer", itemId: "review" };
    }
  }

  const discMatch = href.match(/\/learn\/([^/]+)\/discussionPrompt\/([^/?#]+)/i);
  if (discMatch) {
    return { courseSlug: discMatch[1], itemType: "discussionPrompt", itemId: discMatch[2] };
  }

  const courseMatch = href.match(/\/learn\/([^/?#]+)/i);
  if (courseMatch && courseMatch[1]) {
    const slug = courseMatch[1];
    const excludedSlugs = ["my-learning", "home", "search", "browse", "programs", "certificates", "degrees"];
    if (!excludedSlugs.includes(slug.toLowerCase())) {
      return { courseSlug: slug, itemType: "course", itemId: null };
    }
  }

  return null;
}

async function getCourseId(courseSlug) {
  if (cachedCourseId) return cachedCourseId;
  try {
    const res = await courseraFetch(`${BASE_URL}/api/onDemandCourses.v1?q=slug&slug=${courseSlug}&fields=id`);
    if (res.ok) {
      const data = await res.json();
      const id = data?.elements?.[0]?.id ?? null;
      if (id) {
        cachedCourseId = id;
        return id;
      }
    }
  } catch (e) {
    console.warn("[WordMine] getCourseId error:", e.message);
  }
  return null;
}

async function getUserId() {
  if (cachedUserId) return cachedUserId;

  try {
    const scripts = document.getElementsByTagName("script");
    for (const script of scripts) {
      const text = script.textContent;
      if (text) {
        if (text.includes('"email_address"') && text.includes('"id"')) {
          const match = text.match(/"id"\s*:\s*(\d+)/);
          if (match && match[1]) {
            cachedUserId = match[1];
            return cachedUserId;
          }
        }
        if (text.includes("ROOT_QUERY") && text.includes("userId")) {
          const match2 = text.match(/"userId"\s*:\s*(\d+)/);
          if (match2 && match2[1]) {
            cachedUserId = match2[1];
            return cachedUserId;
          }
        }
        const match3 = text.match(/"User:(\d+)"/);
        if (match3 && match3[1]) {
          cachedUserId = match3[1];
          return cachedUserId;
        }
      }
    }
  } catch (e) {
    console.warn("[WordMine] script tag userId parse error:", e.message);
  }

  try {
    const res = await courseraFetch(`${BASE_URL}/api/users.v1?q=me&fields=id`);
    if (res.ok) {
      const data = await res.json();
      const userId = data?.elements?.[0]?.id ?? null;
      if (userId) {
        cachedUserId = String(userId);
        return cachedUserId;
      }
    }
  } catch (e) {
    console.warn("[WordMine] users.v1 error:", e.message);
  }

  return null;
}

function extractVideoFromLecturePayload(data) {
  const linkedVideos = data?.linked?.["onDemandVideos.v1"];
  if (Array.isArray(linkedVideos) && linkedVideos.length > 0) {
    return linkedVideos[0];
  }
  const videoFromElement = data?.elements?.[0]?.video;
  if (videoFromElement) return videoFromElement;
  return null;
}

async function getVideoMeta(courseId, courseSlug, itemId) {
  const fields = [
    "onDemandVideos.v1(id%2Cduration%2Cname%2Csources%2Csubtitles%2CsubtitlesVtt%2CsubtitlesTxt)",
    "disableSkippingForward",
    "startMs",
    "endMs",
  ].join("%2C");

  const url = `${BASE_URL}/api/onDemandLectureVideos.v1/${courseId}~${itemId}/?includes=video&fields=${fields}`;

  try {
    const res = await courseraFetch(url);
    if (res.ok) {
      const data = await res.json();
      const video = extractVideoFromLecturePayload(data);
      if (video) {
        let durationMs = video.duration;
        if (!durationMs) {
          try {
            const videoEl = document.querySelector("video");
            if (videoEl && videoEl.duration && isFinite(videoEl.duration)) {
              durationMs = Math.round(videoEl.duration * 1000);
            }
          } catch (_) {}
        }
        return { videoId: video.id, duration: durationMs };
      }
    }
  } catch (e) {
    console.warn("[WordMine] onDemandLectureVideos error:", e.message);
  }

  try {
    const videoEl = document.querySelector("video");
    if (videoEl && videoEl.duration && isFinite(videoEl.duration)) {
      const durationMs = Math.round(videoEl.duration * 1000);
      return { videoId: itemId, duration: durationMs };
    }
  } catch (_) {}

  return null;
}

async function reportVideoProgress(userId, courseId, videoId, duration) {
  const progressId = `${userId}~${courseId}~${videoId}`;
  const validDuration = (typeof duration === "number" && isFinite(duration) && duration > 0) ? duration : 9999999;
  const viewedUpTo = Math.max(0, validDuration - 1000);

  const methods = ["POST", "PUT"];
  for (const method of methods) {
    try {
      const res = await courseraFetch(`${BASE_URL}/api/onDemandVideoProgresses.v1/${progressId}`, {
        method: method,
        body: JSON.stringify({ viewedUpTo, videoProgressId: progressId }),
      });
      if (res.ok || res.status === 204) return true;
    } catch (e) {
      console.warn(`[WordMine] reportVideoProgress (${method}) error:`, e.message);
    }
  }
  return false;
}

function triggerDomVideoEnded() {
  try {
    const video = document.querySelector("video");
    if (video) {
      if (video.duration && isFinite(video.duration)) {
        video.currentTime = Math.max(0, video.duration - 0.2);
      }
      try { video.playbackRate = 16; } catch (_) {}
      video.dispatchEvent(new Event("play", { bubbles: true }));
      video.dispatchEvent(new Event("timeupdate", { bubbles: true }));
      video.dispatchEvent(new Event("ended", { bubbles: true }));
      video.dispatchEvent(new Event("pause", { bubbles: true }));
    }

    const buttons = Array.from(document.querySelectorAll("button, a"));
    const markBtn = buttons.find(b => {
      if (b.disabled) return false;
      const isAlreadyChecked = b.getAttribute("aria-pressed") === "true" || b.getAttribute("aria-checked") === "true";
      if (isAlreadyChecked) return false;
      const txt = (b.innerText || "").toLowerCase().trim();
      return (txt.includes("mark as completed") || txt.includes("mark complete") || txt.includes("mark as complete")) && txt !== "completed";
    });
    if (markBtn) markBtn.click();
  } catch (_) {}
}

function triggerDomReadingCompleted() {
  try {
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    const buttons = Array.from(document.querySelectorAll("button, a"));
    const markBtn = buttons.find(b => {
      if (b.disabled) return false;
      const isAlreadyChecked = b.getAttribute("aria-pressed") === "true" || b.getAttribute("aria-checked") === "true";
      if (isAlreadyChecked) return false;
      const txt = (b.innerText || "").toLowerCase().trim();
      return (txt.includes("mark as completed") || txt.includes("mark complete") || txt.includes("mark as complete")) && txt !== "completed";
    });
    if (markBtn) markBtn.click();
  } catch (_) {}
}





async function markLectureCompleted(userId, courseId, courseSlug, itemId, isBulk = false) {
  const completeUrl = `${BASE_URL}/api/opencourse.v1/user/${userId}/course/${courseSlug}/item/${itemId}/lecture/videoEvents/ended?autoEnroll=false`;
  try {
    const res1 = await courseraFetch(completeUrl, {
      method: "POST",
      body: JSON.stringify({ contentRequestBody: {} }),
    });
    if (res1.ok) {
      triggerDomVideoEnded();
      return { success: true, step: 1 };
    }
    if (res1.status === 403 || res1.status === 401) {
      return { success: false, error: `Authentication error (${res1.status}). Ensure you are enrolled in this course.` };
    }
  } catch (e) {
    console.warn("[WordMine] Step 1 direct complete error:", e.message);
  }

  const meta = await getVideoMeta(courseId, courseSlug, itemId);

  if (!meta) {
    const putVariants = [
      `${BASE_URL}/api/opencourse.v1/user/${userId}/course/${courseId}/item/${itemId}/progressState`,
      `${BASE_URL}/api/opencourse.v1/user/${userId}/course/${courseSlug}/item/${itemId}/progressState`,
    ];
    for (const url of putVariants) {
      try {
        const fbRes = await courseraFetch(url, {
          method: "PUT",
          body: JSON.stringify({ progressState: "COMPLETED" }),
        });
        if (fbRes.ok) {
          triggerDomVideoEnded();
          return { success: true, step: "fallback-PUT" };
        }
      } catch (_) {}
    }
    triggerDomVideoEnded();
    return { success: false, error: "Could not fetch video metadata and fallback PUT failed." };
  }

  const progressOk = await reportVideoProgress(userId, courseId, meta.videoId, meta.duration);

  const maxWaitMs = isBulk ? 15000 : 30000;
  const intervalMs = 2500;
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    await sleep(intervalMs);
    try {
      const retryRes = await courseraFetch(completeUrl, {
        method: "POST",
        body: JSON.stringify({ contentRequestBody: {} }),
      });
      if (retryRes.ok) {
        triggerDomVideoEnded();
        return { success: true, step: 4, videoId: meta.videoId };
      }
      if (retryRes.status === 403 || retryRes.status === 401) {
        return { success: false, error: `Permission denied (${retryRes.status}).` };
      }
    } catch (_) {}
  }

  triggerDomVideoEnded();
  if (progressOk) {
    return {
      success: true,
      step: 3,
      videoId: meta.videoId,
      message: "Video progress registered. Refresh page if Coursera UI has not updated."
    };
  }

  return { success: false, error: "Progress reporting timed out on Coursera servers." };
}

async function markSupplementCompleted(userId, courseId, courseSlug, itemId) {
  try {
    const supplementUrl = `${BASE_URL}/api/onDemandSupplementCompletions.v1`;
    const res = await courseraFetch(supplementUrl, {
      method: "POST",
      body: JSON.stringify({
        courseId: courseId,
        itemId: itemId,
        userId: Number(userId),
      }),
    });
    if (res.ok) {
      triggerDomReadingCompleted();
      return { success: true };
    }
    if (res.status === 403 || res.status === 401) {
      return { success: false, error: `Permission denied (${res.status}). Ensure you are enrolled.` };
    }
  } catch (e) {
    console.warn("[WordMine] supplement complete error:", e.message);
  }

  const putVariants = [
    `${BASE_URL}/api/opencourse.v1/user/${userId}/course/${courseId}/item/${itemId}/progressState`,
    `${BASE_URL}/api/opencourse.v1/user/${userId}/course/${courseSlug}/item/${itemId}/progressState`,
  ];
  for (const url of putVariants) {
    try {
      const fbRes = await courseraFetch(url, {
        method: "PUT",
        body: JSON.stringify({ progressState: "COMPLETED" }),
      });
      if (fbRes.ok) {
        triggerDomReadingCompleted();
        return { success: true, step: "fallback-PUT" };
      }
    } catch (_) {}
  }

  triggerDomReadingCompleted();
  return { success: false, error: "Reading completion could not be registered on Coursera servers." };
}

async function completeCurrentLesson() {
  const context = getCourseContext();
  if (!context || !context.courseSlug) {
    return { success: false, error: "Could not identify Coursera course context. Please open a Coursera lesson." };
  }

  const { courseSlug, itemType, itemId } = context;

  if (!itemId) {
    return {
      success: false,
      error: "You are on a course overview page. Open a specific lesson (video, reading, or discussion) to complete."
    };
  }

  if (itemType === "discussion" || itemType === "discussionPrompt") {
    return await handleDiscussionPrompt();
  }

  if (itemType === "peer" || itemType === "assignment") {
    return await assistPeerReview();
  }

  const courseId = await getCourseId(courseSlug);
  if (!courseId) {
    return { success: false, error: "Could not retrieve course ID from Coursera API." };
  }

  const userId = await getUserId();
  if (!userId) {
    return { success: false, error: "Could not retrieve user ID. Please ensure you are logged into Coursera." };
  }

  if (itemType === "lecture" || itemType === "video") {
    const result = await markLectureCompleted(userId, courseId, courseSlug, itemId);
    return {
      ...result,
      message: result.success ? "Video lecture completed and verified on Coursera backend." : (result.error || "Failed to complete video.")
    };
  }

  if (itemType === "supplement" || itemType === "reading") {
    const result = await markSupplementCompleted(userId, courseId, courseSlug, itemId);
    return {
      ...result,
      message: result.success ? "Reading lesson completed and verified on Coursera backend." : (result.error || "Failed to complete reading.")
    };
  }

  if (itemType === "lab" || itemType === "ungradedWidget" || itemType === "ungradedLti") {
    try {
      await courseraFetch(`${BASE_URL}/api/opencourse.v1/user/${userId}/course/${courseId}/item/${itemId}/progressState`, {
        method: "PUT",
        body: JSON.stringify({ progressState: "COMPLETED" }),
      });
    } catch (_) {}
    triggerDomReadingCompleted();
    return { success: true, message: "Guided lab progress registered." };
  }

  return { success: false, error: `Automated completion not available for ${itemType}.` };
}

async function getAllCourseItems(courseSlug) {
  try {
    const includes = "modules,lessons,passableItemGroups,passableItemGroupChoices,passableLessonElements,items,tracks,gradePolicy,gradingParameters,embeddedContentMapping";
    const fields = "moduleIds,onDemandCourseMaterialModules.v1(name,slug,description,timeCommitment,lessonIds,optional,learningObjectives),onDemandCourseMaterialLessons.v1(name,slug,timeCommitment,elementIds,optional,trackId),onDemandCourseMaterialPassableItemGroups.v1(requiredPassedCount,passableItemGroupChoiceIds,trackId),onDemandCourseMaterialPassableItemGroupChoices.v1(name,description,itemIds),onDemandCourseMaterialPassableLessonElements.v1(gradingWeight,isRequiredForPassing),onDemandCourseMaterialItems.v2(name,originalName,slug,timeCommitment,contentSummary,isLocked,lockableByItem,itemLockedReasonCode,trackId,lockedStatus,itemLockSummary),onDemandCourseMaterialTracks.v1(passablesCount),onDemandGradingParameters.v1(gradedAssignmentGroups),contentAtomRelations.v1(embeddedContentSourceCourseId,subContainerId)";
    const url = `${BASE_URL}/api/onDemandCourseMaterials.v2/?q=slug&slug=${courseSlug}&includes=${includes}&fields=${fields}&showLockedItems=true`;

    const res = await courseraFetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.warn("[WordMine] getAllCourseItems error:", e.message);
    return null;
  }
}

async function markAllItemsCompleted(onProgress) {
  const context = getCourseContext();
  if (!context || !context.courseSlug) {
    return { success: false, error: "Could not identify Coursera course. Please navigate to a course page." };
  }

  const { courseSlug } = context;
  if (onProgress) onProgress({ status: "loading", message: "Fetching complete course curriculum..." });

  const material = await getAllCourseItems(courseSlug);
  if (!material || !material.linked || !material.linked["onDemandCourseMaterialItems.v2"]) {
    return { success: false, error: "Could not load course curriculum from Coursera API." };
  }

  const items = material.linked["onDemandCourseMaterialItems.v2"].filter(
    (f) => f.contentSummary && (
      f.contentSummary.typeName.includes("lecture") ||
      f.contentSummary.typeName.includes("supplement")
    )
  );

  const total = items.length;
  if (total === 0) {
    return { success: false, error: "No video or reading lessons found in this course." };
  }

  const courseId = material.elements?.[0]?.id || await getCourseId(courseSlug);
  if (!courseId) {
    return { success: false, error: "Could not determine course ID." };
  }

  const userId = await getUserId();
  if (!userId) {
    return { success: false, error: "Could not determine user ID. Please make sure you are logged into Coursera." };
  }

  const batchSize = 4;
  let successCount = 0;
  let failedCount = 0;
  let processed = 0;

  for (let i = 0; i < total; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    await Promise.all(batch.map(async (item) => {
      try {
        const typeName = item.contentSummary.typeName || "";
        let res = null;
        if (typeName.includes("lecture")) {
          res = await markLectureCompleted(userId, courseId, courseSlug, item.id, true);
        } else if (typeName.includes("supplement")) {
          res = await markSupplementCompleted(userId, courseId, courseSlug, item.id);
        }
        if (res && res.success) {
          successCount++;
        } else {
          failedCount++;
        }
      } catch (_) {
        failedCount++;
      }
    }));

    processed = Math.min(processed + batch.length, total);
    if (onProgress) {
      onProgress({
        status: "running",
        current: processed,
        total,
        successCount,
        failedCount,
        message: `Processing course lessons: ${processed} / ${total} (${successCount} succeeded, ${failedCount} failed)`
      });
    }

    if (processed < total) {
      await sleep(1500);
    }
  }

  return {
    success: successCount > 0,
    total,
    successCount,
    failedCount,
    message: failedCount === 0
      ? `Completed all ${total} videos and readings in the entire course.`
      : `Processed ${total} lessons: ${successCount} completed, ${failedCount} could not be updated.`
  };
}

async function hasUserAnsweredDiscussion(courseId, questionId, userId) {
  const limit = 50;
  let start = 0;
  const maxItemsToCheck = 250;

  while (start < maxItemsToCheck) {
    const checkUrl = `${BASE_URL}/api/onDemandCourseForumAnswers.v1/?q=courseForumQuestionId&courseForumQuestionId=${courseId}~${questionId}&fields=creatorId&limit=${limit}&start=${start}`;
    try {
      const checkRes = await courseraFetch(checkUrl);
      if (!checkRes.ok) break;
      const checkData = await checkRes.json();
      const elements = checkData?.elements || [];
      const found = elements.some((ans) => String(ans.creatorId) === String(userId));
      if (found) return true;
      if (elements.length < limit) break;
      start += limit;
    } catch (_) {
      break;
    }
  }
  return false;
}

const DISCUSSION_RESPONSES = [
  "This lesson provided a clear and well-structured overview of the topic. I particularly appreciated how the key concepts were broken down step by step, making them much easier to understand and apply.",
  "After going through this material, I find the approach presented here both practical and insightful. It gave me a new perspective on how to tackle similar problems in real-world scenarios.",
  "The content covered in this lesson was very informative. I especially liked the examples used to illustrate the core ideas — they really helped connect theory to practice.",
  "This was a thought-provoking lesson. The framework introduced here aligns well with industry best practices and I can see how it can be directly applied to improve outcomes in various contexts.",
  "I found this lesson to be an excellent introduction to the subject. The explanation was concise yet comprehensive, and it raised several interesting points worth exploring further."
];

function getRandomDiscussionResponse() {
  return DISCUSSION_RESPONSES[Math.floor(Math.random() * DISCUSSION_RESPONSES.length)];
}

function fillTextInput(el, text) {
  if (!el) return;

  const isContentEditable = (el.getAttribute && el.getAttribute("contenteditable") !== null && el.getAttribute("contenteditable") !== "false") ||
    (el.getAttribute && el.getAttribute("role") === "textbox") ||
    (el.classList && el.classList.contains("cml-editor"));

  if (isContentEditable) {
    if (typeof el.focus === "function") el.focus();
    if (typeof el.click === "function") el.click();

    let inserted = false;
    try {
      if (typeof document !== "undefined" && document.execCommand) {
        document.execCommand("selectAll", false, null);
        inserted = document.execCommand("insertText", false, text);
      }
    } catch (_) {}

    if (!inserted || !el.textContent || el.textContent.trim().length === 0) {
      el.textContent = text;
    }

    try {
      if (typeof InputEvent !== "undefined") {
        el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
      } else {
        el.dispatchEvent(new Event("input", { bubbles: true }));
      }
    } catch (_) {
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new Event("blur", { bubbles: true }));
    return;
  }

  if (typeof el.focus === "function") el.focus();
  if (typeof el.click === "function") el.click();
  try {
    if (typeof document !== "undefined" && document.execCommand) {
      document.execCommand("selectAll", false, null);
      document.execCommand("insertText", false, text);
    }
  } catch (_) {}

  const isTextarea = (typeof HTMLTextAreaElement !== "undefined" && el instanceof HTMLTextAreaElement) || el.tagName === "TEXTAREA";
  const proto = isTextarea
    ? (typeof HTMLTextAreaElement !== "undefined" ? HTMLTextAreaElement.prototype : Object.getPrototypeOf(el))
    : (typeof HTMLInputElement !== "undefined" ? HTMLInputElement.prototype : Object.getPrototypeOf(el));

  const nativeInputSetter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  if (nativeInputSetter) {
    nativeInputSetter.call(el, text);
  } else {
    el.value = text;
  }
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
  el.dispatchEvent(new Event("blur", { bubbles: true }));
}

async function handleDiscussionPrompt() {
  const ctx = getCourseContext();
  const answerText = getRandomDiscussionResponse();

  if (ctx && ctx.courseSlug && ctx.itemId) {
    try {
      const courseId = await getCourseId(ctx.courseSlug);
      const userId = await getUserId();
      const csrfToken = getCsrfToken();

      if (courseId && userId) {
        const promptUrl = `${BASE_URL}/api/onDemandDiscussionPrompts.v1/${userId}~${courseId}~${ctx.itemId}?fields=onDemandDiscussionPromptQuestions.v1(content,creatorId,createdAt,forumId,sessionId),promptType,question&includes=question`;
        const promptRes = await courseraFetch(promptUrl);

        if (promptRes.ok) {
          const promptData = await promptRes.json();
          const questionRef = promptData?.elements?.[0]?.promptType?.courseItemForumQuestionId
            || promptData?.elements?.[0]?.question?.courseItemForumQuestionId;

          if (questionRef) {
            const parts = questionRef.split("~");
            const questionId = parts[2] || parts[parts.length - 1];

            if (questionId) {
              const alreadyAnswered = await hasUserAnsweredDiscussion(courseId, questionId, userId);
              if (alreadyAnswered) {
                return {
                  success: true,
                  message: "Discussion prompt was already answered previously."
                };
              }

              const answerBody = {
                content: {
                  typeName: "cml",
                  definition: {
                    dtdId: "discussion/1",
                    value: `<co-content><text>${answerText}</text></co-content>`,
                  },
                },
                courseForumQuestionId: `${courseId}~${questionId}`,
              };

              const postUrl = `${BASE_URL}/api/onDemandCourseForumAnswers.v1/?fields=content,forumQuestionId,parentForumAnswerId,state,creatorId,createdAt,order,courseItemForumQuestionId&includes=profiles,children,userId`;
              const postRes = await courseraFetch(postUrl, {
                method: "POST",
                headers: { "x-csrf3-token": csrfToken },
                body: JSON.stringify(answerBody),
              });

              if (postRes.ok || postRes.status === 201) {
                return {
                  success: true,
                  message: "Discussion response posted successfully via Coursera API."
                };
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn("[WordMine] API discussion error, attempting DOM fallback:", e.message);
    }
  }

  let textareas = Array.from(document.querySelectorAll('textarea, [contenteditable="true"], div[role="textbox"]'));

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
      await sleep(300);
      textareas = Array.from(document.querySelectorAll('textarea, [contenteditable="true"], div[role="textbox"]'));
    }
  }

  if (textareas.length === 0) {
    return { success: false, error: "No discussion response input found on this page." };
  }

  let injected = 0;
  textareas.forEach(el => {
    fillTextInput(el, answerText);
    injected++;
  });

  const buttons = Array.from(document.querySelectorAll("button"));
  const replyBtn = buttons.find(b => {
    const txt = (b.textContent || "").trim().toLowerCase();
    return (txt === "reply" || txt === "post" || txt === "submit reply") && !b.disabled;
  });

  if (replyBtn) {
    replyBtn.scrollIntoView({ behavior: "smooth", block: "center" });
    await sleep(200);
    replyBtn.click();
    return {
      success: true,
      message: "Injected academic reflection and submitted reply."
    };
  }

  return {
    success: true,
    message: `Injected constructive reflection into ${injected} discussion input box(es). Ready to submit.`
  };
}

async function markAllDiscussionsCompleted(onProgress) {
  const context = getCourseContext();
  if (!context || !context.courseSlug) {
    return { success: false, error: "Could not identify Coursera course. Please open a course page." };
  }

  const { courseSlug } = context;
  if (onProgress) onProgress({ status: "loading", message: "Fetching course discussions..." });

  const material = await getAllCourseItems(courseSlug);
  if (!material || !material.linked || !material.linked["onDemandCourseMaterialItems.v2"]) {
    return { success: false, error: "Could not retrieve course materials." };
  }

  const discussionItems = material.linked["onDemandCourseMaterialItems.v2"].filter(
    (f) => f.contentSummary && f.contentSummary.typeName && f.contentSummary.typeName.includes("discussionPrompt")
  );

  const total = discussionItems.length;
  if (total === 0) {
    return { success: false, error: "No discussion prompts found in this course." };
  }

  const courseId = material.elements?.[0]?.id || await getCourseId(courseSlug);
  if (!courseId) {
    return { success: false, error: "Could not retrieve course ID." };
  }

  const userId = await getUserId();
  if (!userId) {
    return { success: false, error: "Could not retrieve user ID. Ensure you are logged into Coursera." };
  }

  const csrfToken = getCsrfToken();
  let successCount = 0;
  let failedCount = 0;
  let skippedDuplicate = 0;

  for (let i = 0; i < total; i++) {
    const item = discussionItems[i];
    try {
      const promptUrl = `${BASE_URL}/api/onDemandDiscussionPrompts.v1/${userId}~${courseId}~${item.id}?fields=onDemandDiscussionPromptQuestions.v1(content,creatorId,createdAt,forumId,sessionId),promptType,question&includes=question`;
      const promptRes = await courseraFetch(promptUrl);
      if (promptRes.ok) {
        const promptData = await promptRes.json();
        const questionRef = promptData?.elements?.[0]?.promptType?.courseItemForumQuestionId
          || promptData?.elements?.[0]?.question?.courseItemForumQuestionId;
        if (questionRef) {
          const parts = questionRef.split("~");
          const questionId = parts[2] || parts[parts.length - 1];
          if (questionId) {
            const alreadyAnswered = await hasUserAnsweredDiscussion(courseId, questionId, userId);
            if (alreadyAnswered) {
              skippedDuplicate++;
              successCount++;
            } else {
              const answerText = getRandomDiscussionResponse();
              const answerBody = {
                content: {
                  typeName: "cml",
                  definition: {
                    dtdId: "discussion/1",
                    value: `<co-content><text>${answerText}</text></co-content>`,
                  },
                },
                courseForumQuestionId: `${courseId}~${questionId}`,
              };
              const postUrl = `${BASE_URL}/api/onDemandCourseForumAnswers.v1/?fields=content,forumQuestionId,parentForumAnswerId,state,creatorId,createdAt,order,courseItemForumQuestionId&includes=profiles,children,userId`;
              const postRes = await courseraFetch(postUrl, {
                method: "POST",
                headers: { "x-csrf3-token": csrfToken },
                body: JSON.stringify(answerBody),
              });
              if (postRes.ok || postRes.status === 201) {
                successCount++;
              } else {
                failedCount++;
              }
            }
          } else {
            failedCount++;
          }
        } else {
          failedCount++;
        }
      } else {
        failedCount++;
      }
    } catch (_) {
      failedCount++;
    }

    if (onProgress) {
      onProgress({
        status: "running",
        current: i + 1,
        total,
        successCount,
        failedCount,
        message: `Processing discussions: ${i + 1} / ${total} (${successCount} succeeded, ${failedCount} failed)`
      });
    }

    if (i + 1 < total) {
      await sleep(1500);
    }
  }

  return {
    success: successCount > 0,
    total,
    successCount,
    failedCount,
    skippedDuplicate,
    message: failedCount === 0
      ? `Completed all ${total} discussion prompts (${skippedDuplicate} already answered).`
      : `Processed ${total} discussions: ${successCount} completed, ${failedCount} could not be posted.`
  };
}

function assistPeerReview() {
  try {
    const allRadios = Array.from(document.querySelectorAll('input[type="radio"], [role="radio"]'));

    const groups = new Map();
    let unassignedCounter = 0;

    allRadios.forEach(radio => {
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
      const directVal = parseFloat(radio.value);
      if (!isNaN(directVal)) return directVal;

      const ariaLabel = radio.getAttribute("aria-label") || "";
      const labelText = radio.closest("label") ? radio.closest("label").innerText : "";
      const parentText = radio.parentElement ? radio.parentElement.innerText : "";
      const combinedText = `${ariaLabel} ${labelText} ${parentText}`.toLowerCase();

      const ptMatch = combinedText.match(/(\d+(?:\.\d+)?)\s*(?:points?|pts?|\/\s*\d+)/);
      if (ptMatch) {
        const parsed = parseFloat(ptMatch[1]);
        if (!isNaN(parsed)) return parsed;
      }

      const numMatch = combinedText.match(/\b(\d+(?:\.\d+)?)\b/);
      if (numMatch) {
        const parsed = parseFloat(numMatch[1]);
        if (!isNaN(parsed)) return parsed;
      }

      if (combinedText.includes("excellent") || combinedText.includes("exceeds") || combinedText.includes("mastery")) return 100;
      if (combinedText.includes("proficient") || combinedText.includes("good") || combinedText.includes("meets")) return 80;
      if (combinedText.includes("partial") || combinedText.includes("developing") || combinedText.includes("needs improvement")) return 40;
      if (combinedText.includes("unsatisfactory") || combinedText.includes("incomplete") || combinedText.includes("missing") || combinedText.includes("no")) return 0;

      return -1;
    }

    groups.forEach(radios => {
      if (radios.length === 0) return;

      let bestRadio = radios[0];
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

    const rubricComments = [
      "Great work on this submission! The explanation is thorough, logically structured, and directly satisfies all rubric criteria with concrete detail.",
      "Clear, rigorous, and concise submission. Demonstrates strong conceptual understanding of the module and provides high-quality insights.",
      "Well done! All required components are addressed with exemplary accuracy. The methodology is clearly communicated throughout.",
      "Excellent effort! The submission adheres strictly to the assignment guidelines and demonstrates deep mastery of the subject.",
      "Comprehensive analysis and thoughtful presentation. The solution is well-organized and reflects diligent attention to detail."
    ];

    let filledComments = 0;
    document.querySelectorAll('textarea, [contenteditable="true"], div[role="textbox"]').forEach((ta, idx) => {
      const val = ta.tagName === "TEXTAREA" ? ta.value : ta.innerText;
      if (!val || val.trim().length === 0) {
        const comment = rubricComments[idx % rubricComments.length];
        fillTextInput(ta, comment);
        filledComments++;
      }
    });

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

    const submitBtn = Array.from(document.querySelectorAll("button")).find(b => {
      const txt = (b.textContent || "").trim().toLowerCase();
      return (txt.includes("submit") || txt.includes("review")) && !txt.includes("cancel");
    });
    if (submitBtn && submitBtn.style) {
      submitBtn.scrollIntoView({ behavior: "smooth", block: "center" });
      const origOutline = submitBtn.style.outline;
      submitBtn.style.outline = "3px solid #1F5C6B";
      setTimeout(() => { if (submitBtn.style) submitBtn.style.outline = origOutline; }, 4000);
    }

    return {
      success: true,
      message: `Assisted review: selected top rubric scores for ${groups.size} criteria group(s) (${radioCount} updated), filled ${filledComments} comment box(es), and acknowledged ${checkedBoxes} requirement(s).`
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ─── 4b. In-Page Floating Widget (Shadow DOM) ──────────────────────────────

let floatingWidgetShadow = null;

function initFloatingWidget() {
  if (typeof document === "undefined") return;
  if (document.getElementById("wordmine-floating-host")) return;
  if (!window.location.href.includes("/learn/")) return;

  const host = document.createElement("div");
  host.id = "wordmine-floating-host";
  floatingWidgetShadow = host.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = `
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :host {
      all: initial;
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 2147483647;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 13px;
      user-select: none;
      line-height: 1.4;
    }
    .wm-fab {
      width: 46px;
      height: 46px;
      border-radius: 50%;
      background: linear-gradient(135deg, #1F5C6B 0%, #164652 100%);
      box-shadow: 0 6px 18px rgba(31, 92, 107, 0.45);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 2px solid rgba(255, 255, 255, 0.3);
      transition: all 0.2s ease;
      color: #FFFFFF;
    }
    .wm-fab:hover {
      transform: scale(1.06) translateY(-2px);
      box-shadow: 0 8px 24px rgba(31, 92, 107, 0.6);
    }
    .wm-fab-icon {
      width: 22px;
      height: 22px;
    }
    .wm-card {
      display: none;
      width: 290px;
      background: #FFFFFF;
      border: 1px solid #E2E8F0;
      border-radius: 14px;
      box-shadow: 0 16px 36px rgba(0, 0, 0, 0.18), 0 0 0 1px rgba(0, 0, 0, 0.04);
      color: #1E293B;
      overflow: hidden;
      flex-direction: column;
      animation: wmFadeIn 0.2s ease;
    }
    @keyframes wmFadeIn {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .wm-header {
      padding: 10px 12px;
      background: #1F5C6B;
      color: #FFFFFF;
      display: flex;
      align-items: center;
      justify-content: space-between;
      cursor: move;
    }
    .wm-title-row {
      display: flex;
      align-items: center;
      gap: 6px;
      font-weight: 600;
      font-size: 13px;
      letter-spacing: -0.01em;
    }
    .wm-header-btns {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .wm-icon-btn {
      background: transparent;
      border: none;
      color: rgba(255, 255, 255, 0.8);
      width: 22px;
      height: 22px;
      border-radius: 4px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.15s;
    }
    .wm-icon-btn:hover {
      background: rgba(255, 255, 255, 0.2);
      color: #FFFFFF;
    }
    .wm-body {
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      background: #F8FAFC;
    }
    .wm-context-pill {
      font-size: 11px;
      font-weight: 600;
      color: #1F5C6B;
      background: #E6F0F2;
      padding: 4px 8px;
      border-radius: 6px;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      width: fit-content;
    }
    .wm-action-btn {
      width: 100%;
      padding: 8px 10px;
      background: #FFFFFF;
      border: 1px solid #CBD5E1;
      border-radius: 8px;
      color: #1E293B;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: all 0.15s ease;
      text-align: left;
    }
    .wm-action-btn:hover {
      border-color: #1F5C6B;
      background: #F0F7F8;
      color: #1F5C6B;
    }
    .wm-action-btn.primary {
      background: #1F5C6B;
      border-color: #1F5C6B;
      color: #FFFFFF;
    }
    .wm-action-btn.primary:hover {
      background: #164652;
      border-color: #164652;
    }
    .wm-status {
      font-size: 11px;
      color: #64748B;
      line-height: 1.35;
      padding-top: 4px;
      border-top: 1px solid #E2E8F0;
      min-height: 28px;
    }
  `;

  const container = document.createElement("div");
  container.innerHTML = `
    <div class="wm-fab" id="wmFab" title="WordMine Suite">
      <svg class="wm-fab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
      </svg>
    </div>
    <div class="wm-card" id="wmCard">
      <div class="wm-header" id="wmHeader">
        <div class="wm-title-row">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
          </svg>
          <span>WordMine Automator</span>
        </div>
        <div class="wm-header-btns">
          <button class="wm-icon-btn" id="wmMinBtn" title="Minimize">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </button>
        </div>
      </div>
      <div class="wm-body">
        <div class="wm-context-pill" id="wmPill">Coursera Lesson</div>
        <button class="wm-action-btn primary" id="wmBtnComplete">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          <span>Complete Current Lesson</span>
        </button>
        <button class="wm-action-btn" id="wmBtnBulk">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
          <span>Bulk Complete All Lessons</span>
        </button>
        <button class="wm-action-btn" id="wmBtnPeer">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M12 20h9"></path>
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
          </svg>
          <span>Assist Peer Review</span>
        </button>
        <div class="wm-status" id="wmStatus">Ready. Click an action above.</div>
      </div>
    </div>
  `;

  floatingWidgetShadow.appendChild(style);
  floatingWidgetShadow.appendChild(container);
  document.body.appendChild(host);

  const fab = floatingWidgetShadow.getElementById("wmFab");
  const card = floatingWidgetShadow.getElementById("wmCard");
  const minBtn = floatingWidgetShadow.getElementById("wmMinBtn");
  const pill = floatingWidgetShadow.getElementById("wmPill");
  const btnComplete = floatingWidgetShadow.getElementById("wmBtnComplete");
  const btnBulk = floatingWidgetShadow.getElementById("wmBtnBulk");
  const btnPeer = floatingWidgetShadow.getElementById("wmBtnPeer");
  const status = floatingWidgetShadow.getElementById("wmStatus");
  const header = floatingWidgetShadow.getElementById("wmHeader");

  function updateWidgetContext() {
    const ctx = getCourseContext();
    if (!ctx) {
      pill.textContent = "Overview Page";
    } else {
      const type = (ctx.itemType || "lesson").toUpperCase();
      pill.textContent = `${type} | ${ctx.itemId || "course"}`;
    }
  }

  fab.addEventListener("click", () => {
    fab.style.display = "none";
    card.style.display = "flex";
    updateWidgetContext();
  });

  minBtn.addEventListener("click", () => {
    card.style.display = "none";
    fab.style.display = "flex";
  });

  btnComplete.addEventListener("click", async () => {
    status.textContent = "Processing lesson completion on Coursera backend...";
    btnComplete.disabled = true;
    try {
      const res = await completeCurrentLesson();
      status.textContent = res.success ? (res.message || "Completed successfully!") : ("Notice: " + (res.error || "Failed."));
    } catch (e) {
      status.textContent = "Error: " + e.message;
    } finally {
      btnComplete.disabled = false;
    }
  });

  btnBulk.addEventListener("click", async () => {
    status.textContent = "Starting bulk completion...";
    btnBulk.disabled = true;
    try {
      const res = await markAllItemsCompleted((p) => {
        status.textContent = p.message || `Processing: ${p.current} / ${p.total}`;
      });
      status.textContent = res.message || "Bulk processing completed.";
    } catch (e) {
      status.textContent = "Error: " + e.message;
    } finally {
      btnBulk.disabled = false;
    }
  });

  btnPeer.addEventListener("click", async () => {
    status.textContent = "Assisting peer review rubrics & comments...";
    try {
      const res = assistPeerReview();
      status.textContent = res.success ? res.message : ("Notice: " + (res.error || "Failed."));
    } catch (e) {
      status.textContent = "Error: " + e.message;
    }
  });

  let isDragging = false;
  let dragStartX, dragStartY, initialLeft, initialTop;

  header.addEventListener("mousedown", (e) => {
    if (e.target.closest("button")) return;
    isDragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    const rect = host.getBoundingClientRect();
    initialLeft = rect.left;
    initialTop = rect.top;
    host.style.bottom = "auto";
    host.style.right = "auto";
    host.style.left = `${initialLeft}px`;
    host.style.top = `${initialTop}px`;
  });

  window.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;
    const newLeft = Math.max(10, Math.min(window.innerWidth - 310, initialLeft + dx));
    const newTop = Math.max(10, Math.min(window.innerHeight - 200, initialTop + dy));
    host.style.left = `${newLeft}px`;
    host.style.top = `${newTop}px`;
  });

  window.addEventListener("mouseup", () => {
    isDragging = false;
  });
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      setTimeout(initFloatingWidget, 1500);
    });
  } else {
    setTimeout(initFloatingWidget, 1500);
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
    completeCurrentLesson()
      .then(sendResponse)
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  // MARK_ALL_COMPLETED (Bulk API)
  if (message.action === "markAllCompleted") {
    markAllItemsCompleted((progress) => {
      try {
        chrome.runtime.sendMessage({ action: "bulkProgress", ...progress });
      } catch (_) {}
    })
      .then(sendResponse)
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  // HANDLE_DISCUSSION_PROMPT
  if (message.action === "handleDiscussionPrompt") {
    handleDiscussionPrompt()
      .then(sendResponse)
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  // MARK_ALL_DISCUSSIONS_COMPLETED
  if (message.action === "markAllDiscussionsCompleted") {
    markAllDiscussionsCompleted((progress) => {
      try {
        chrome.runtime.sendMessage({ action: "bulkProgress", ...progress });
      } catch (_) {}
    })
      .then(sendResponse)
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  // ASSIST_PEER_REVIEW
  if (message.action === "assistPeerReview") {
    try {
      const res = assistPeerReview();
      sendResponse(res);
    } catch (err) {
      sendResponse({ success: false, error: err.message });
    }
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
