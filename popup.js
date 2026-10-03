// popup.js — controls the WordMine popup UI, curriculum scanner, and orchestrates extraction

// ─── State ───────────────────────────────────────────────────────────────────

let isRunning = false;
let shouldStop = false;
let collectedFiles = [];
let scannedModules = [];

// ─── DOM References ──────────────────────────────────────────────────────────

const autoToggle = document.getElementById("autoToggle");
const modeTitle = document.getElementById("modeTitle");
const modeDesc = document.getElementById("modeDesc");
const extractBtn = document.getElementById("extractBtn");
const nextBtn = document.getElementById("nextBtn");
const stopBtn = document.getElementById("stopBtn");
const logSection = document.getElementById("logSection");
const logBox = document.getElementById("logBox");
const downloadBtn = document.getElementById("downloadBtn");
const clearBtn = document.getElementById("clearBtn");

// Filter checkboxes (Symmetrical: all express what to include)
const includeVideos = document.getElementById("includeVideos");
const includeReadings = document.getElementById("includeReadings");
const includeQuizzes = document.getElementById("includeQuizzes");

// Status Bar
const statusIndicator = document.getElementById("statusIndicator");
const statusText = document.getElementById("statusText");

// Curriculum Explorer DOM
const scanCurriculumBtn = document.getElementById("scanCurriculumBtn");
const curriculumDrawer = document.getElementById("curriculumDrawer");
const curriculumStats = document.getElementById("curriculumStats");
const btnFilterAll = document.getElementById("btnFilterAll");
const btnFilterVideos = document.getElementById("btnFilterVideos");
const btnFilterReadings = document.getElementById("btnFilterReadings");
const btnFilterNone = document.getElementById("btnFilterNone");
const curriculumList = document.getElementById("curriculumList");
const mineSelectedBtn = document.getElementById("mineSelectedBtn");
const selectedCountBadge = document.getElementById("selectedCountBadge");

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getSelectedFormat() {
  const checked = document.querySelector('input[name="format"]:checked');
  return checked ? checked.value : "docx";
}

function log(message, type = "normal") {
  logSection.style.display = "block";
  const entry = document.createElement("div");
  entry.textContent = message;
  if (type === "success") entry.className = "log-entry-success";
  if (type === "skip")    entry.className = "log-entry-skip";
  if (type === "error")   entry.className = "log-entry-error";
  logBox.appendChild(entry);
  logBox.scrollTop = logBox.scrollHeight;
  return entry;
}

function replaceLog(entry, message, type = "normal") {
  entry.textContent = message;
  entry.className = "";
  if (type === "success") entry.className = "log-entry-success";
  if (type === "skip")    entry.className = "log-entry-skip";
  if (type === "error")   entry.className = "log-entry-error";
  logBox.scrollTop = logBox.scrollHeight;
}

function sanitizeFilename(name) {
  return (name || "untitled").replace(/[\\/:*?"<>|]/g, "").trim().substring(0, 60);
}

function setButtonState(running) {
  isRunning = running;
  extractBtn.disabled = running;
  if (mineSelectedBtn) mineSelectedBtn.disabled = running;
  stopBtn.style.display = running ? "block" : "none";
  if (autoToggle.checked) {
    nextBtn.style.display = "none";
  } else {
    nextBtn.style.display = running ? "block" : "none";
  }
}

function updateStatus(state, message) {
  if (!statusIndicator || !statusText) return;
  statusIndicator.className = "status-dot";
  if (state === "ready") {
    statusIndicator.classList.add("dot-ready");
  } else if (state === "warning") {
    statusIndicator.classList.add("dot-warning");
  } else {
    statusIndicator.classList.add("dot-muted");
  }
  statusText.textContent = message;
}

// ─── Storage helpers ──────────────────────────────────────────────────────────

function getStorage(keys) {
  return new Promise(resolve => chrome.storage.local.get(keys, resolve));
}

function setStorage(data) {
  return new Promise(resolve => chrome.storage.local.set(data, resolve));
}

// ─── Collected files persistence ─────────────────────────────────────────────

async function saveCollectedFiles() {
  await setStorage({ collectedFiles: JSON.stringify(collectedFiles) });
}

async function loadCollectedFiles() {
  try {
    const data = await getStorage(["collectedFiles"]);
    if (data.collectedFiles) {
      collectedFiles = JSON.parse(data.collectedFiles);
      if (collectedFiles.length > 0) {
        logSection.style.display = "block";
        logBox.innerHTML = "";
        collectedFiles.forEach(f => {
          log(`✓ ${f.index}. ${sanitizeFilename(f.title)}`, "success");
        });
        log(`\n${collectedFiles.length} file(s) ready — click Download to save.`, "success");
        downloadBtn.style.display = "block";
      }
    }
  } catch {
    collectedFiles = [];
  }
}

// ─── File generation ──────────────────────────────────────────────────────────

function generateContent(title, transcript) {
  return `${title}\n${"=".repeat(title.length)}\n\n${transcript}`;
}

async function generateDocx(title, transcript) {
  const doc = new docx.Document({
    sections: [{
      children: [
        new docx.Paragraph({
          children: [new docx.TextRun({ text: title, bold: true, size: 36 })],
          spacing: { after: 200 }
        }),
        ...transcript.split("\n").map(line =>
          new docx.Paragraph({
            children: [new docx.TextRun({ text: line, size: 24 })],
            spacing: { after: 80 }
          })
        )
      ]
    }]
  });
  return await docx.Packer.toBlob(doc);
}

async function generatePdf(title, transcript) {
  const element = document.createElement("div");
  element.style.cssText = `
    font-family: Arial, sans-serif;
    font-size: 12px;
    line-height: 1.6;
    padding: 20px;
    color: #000;
  `;
  function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  element.innerHTML = `
    <h1 style="font-size:18px; font-weight:bold; margin-bottom:16px;">${escapeHtml(title)}</h1>
    <hr style="margin-bottom:16px;">
    <div>${transcript.split("\n").map(line =>
      line.trim() ? `<p style="margin:4px 0;">${escapeHtml(line)}</p>` : `<br>`
    ).join("")}</div>
  `;

  const opt = {
    margin: 15,
    filename: `${sanitizeFilename(title)}.pdf`,
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: { scale: 2 },
    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }
  };

  return await html2pdf().set(opt).from(element).outputPdf("blob");
}

// ─── ZIP download ─────────────────────────────────────────────────────────────

async function downloadAsZip(files) {
  if (files.length === 0) return;
  const zip = new JSZip();
  const folder = zip.folder("WordMine Transcripts");

  await Promise.all(files.map(async (f) => {
    const prefix = String(f.index).padStart(2, "0");
    const filename = `${prefix} - ${sanitizeFilename(f.title)}.${f.format}`;
    let blob;

    if (f.format === "docx") {
      blob = await generateDocx(f.title, f.content);
    } else if (f.format === "pdf") {
      blob = await generatePdf(f.title, f.content);
    } else {
      blob = new Blob([generateContent(f.title, f.content)], { type: "text/plain" });
    }

    folder.file(filename, blob);
  }));

  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "WordMine_Transcripts.zip";
  a.click();
  URL.revokeObjectURL(url);
}

// Single file download (immediate)
async function downloadSingleFile(title, transcript, format, index) {
  const prefix = String(index).padStart(2, "0");
  const safeName = sanitizeFilename(title);
  let blob;

  if (format === "docx") {
    blob = await generateDocx(title, transcript);
  } else if (format === "pdf") {
    blob = await generatePdf(title, transcript);
  } else {
    blob = new Blob([generateContent(title, transcript)], { type: "text/plain" });
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${prefix} - ${safeName}.${format}`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Core extraction & communication ──────────────────────────────────────────

async function ensureContentScriptInjected(tabId) {
  const isLoaded = await new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { action: "ping" }, { frameId: 0 }, (res) => {
      if (chrome.runtime.lastError || !res || !res.success) {
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });

  if (isLoaded) return true;

  if (chrome.scripting) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tabId, frameIds: [0] },
        files: ["content.js"]
      });
      await new Promise(r => setTimeout(r, 300));
      return true;
    } catch (e) {
      console.warn("Could not inject content script:", e);
    }
  }
  return false;
}

async function sendMessageToTab(message) {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (!tabs || tabs.length === 0) {
        reject(new Error("No active browser tab found."));
        return;
      }

      const tab = tabs[0];
      const url = tab.url || "";

      // Validate URL: user must be on Coursera
      if (!url.includes("coursera.org")) {
        reject(new Error("Please open a Coursera lesson page."));
        return;
      }

      try {
        await ensureContentScriptInjected(tab.id);
      } catch (err) {
        console.warn("Script injection check:", err);
      }

      // Explicitly target top-level frame (frameId: 0) to prevent port closure from iframes
      chrome.tabs.sendMessage(tab.id, message, { frameId: 0 }, (response) => {
        if (chrome.runtime.lastError) {
          const err = chrome.runtime.lastError.message || "";
          if (err.includes("Receiving end does not exist") || err.includes("Could not establish connection")) {
            reject(new Error("Could not connect to Coursera. Please refresh (F5) the Coursera tab."));
          } else {
            reject(new Error(err));
          }
          return;
        }
        resolve(response);
      });
    });
  });
}

async function detectActiveTab() {
  try {
    const tabs = await new Promise(r => chrome.tabs.query({ active: true, currentWindow: true }, r));
    if (!tabs || tabs.length === 0) {
      updateStatus("muted", "No active browser tab.");
      return;
    }
    const url = tabs[0].url || "";
    if (!url.includes("coursera.org")) {
      updateStatus("muted", "Open a Coursera lesson to begin.");
      return;
    }

    if (url.includes("/lecture/") || url.includes("/supplement/")) {
      updateStatus("ready", "Ready. Lesson page detected.");
    } else if (url.includes("/quiz/") || url.includes("/exam/")) {
      updateStatus("ready", "Quiz / Activity detected.");
    } else if (url.includes("/learn/")) {
      updateStatus("ready", "Coursera outline detected.");
    } else {
      updateStatus("ready", "Coursera detected.");
    }
  } catch {
    updateStatus("muted", "Ready.");
  }
}

async function extractCurrentVideo(index, silentMode = false) {
  const searchingEntry = log("⏳ Searching for lesson content / transcript...");

  try {
    const response = await sendMessageToTab({ action: "getTranscript" });

    if (!response) {
      replaceLog(searchingEntry, "✗ Could not connect to Coursera. Please refresh (F5) the page and try again.", "error");
      return { success: false, reason: "no_connection" };
    }

    if (!response.success) {
      // Activity or Quiz detected
      if (response.reason === "is_quiz") {
        if (!includeQuizzes.checked) {
          replaceLog(searchingEntry, `↷ Skipped Quiz: ${sanitizeFilename(response.title)}`, "skip");
          return { success: false, reason: "quiz_skipped", isEndOfCourse: response.isEndOfCourse };
        } else {
          replaceLog(searchingEntry, `↷ Quiz / Activity (no transcript): ${sanitizeFilename(response.title)}`, "skip");
          return { success: false, reason: "no_transcript", isEndOfCourse: response.isEndOfCourse };
        }
      }

      if (response.reason === "no_transcript") {
        replaceLog(searchingEntry, "↷ No transcript found on this page — skipping.", "skip");
        return { success: false, reason: "no_transcript", isEndOfCourse: response.isEndOfCourse };
      }

      replaceLog(searchingEntry, `↷ Skipped: ${response.reason || "Unknown issue"}`, "skip");
      return { success: false, reason: response.reason || "skip", isEndOfCourse: response.isEndOfCourse };
    }

    // Check user content filters (Videos vs Readings)
    const isVideo = !response.transcript.includes("\n\n");
    if (isVideo && !includeVideos.checked) {
      replaceLog(searchingEntry, `↷ Skipped Video (Videos unchecked): ${sanitizeFilename(response.title)}`, "skip");
      return { success: false, reason: "filtered_video", isEndOfCourse: response.isEndOfCourse };
    }
    if (!isVideo && !includeReadings.checked) {
      replaceLog(searchingEntry, `↷ Skipped Reading (Readings unchecked): ${sanitizeFilename(response.title)}`, "skip");
      return { success: false, reason: "filtered_reading", isEndOfCourse: response.isEndOfCourse };
    }

    const format = getSelectedFormat();
    const fileIndex = collectedFiles.length + 1;

    collectedFiles.push({
      title: response.title,
      content: response.transcript,
      format,
      index: fileIndex
    });

    await saveCollectedFiles();

    replaceLog(searchingEntry, `✓ ${fileIndex}. ${sanitizeFilename(response.title)}`, "success");

    // Only trigger immediate individual download in manual mode
    if (!silentMode) {
      await downloadSingleFile(response.title, response.transcript, format, fileIndex);
    }

    return { success: true, isEndOfCourse: response.isEndOfCourse };

  } catch (err) {
    replaceLog(searchingEntry, `✗ Error: ${err.message}`, "error");
    return { success: false, reason: "fatal_error" };
  }
}

async function goToNextVideo() {
  try {
    const response = await sendMessageToTab({ action: "nextVideo" });
    if (!response || !response.success) return false;
    await new Promise(r => setTimeout(r, 3500));
    return true;
  } catch {
    return false;
  }
}

// ─── Auto mode loop ───────────────────────────────────────────────────────────

async function runAutoMode() {
  shouldStop = false;
  collectedFiles = [];
  await saveCollectedFiles();
  setButtonState(true);
  log("▶ Auto mode — mining transcripts silently...");

  let pageIndex = 1;

  while (!shouldStop) {
    const result = await extractCurrentVideo(pageIndex, true);

    // If fatal connection error or stopped, break out immediately
    if (!result.success && result.reason !== "no_transcript" && result.reason !== "quiz_skipped" && result.reason !== "filtered_video" && result.reason !== "filtered_reading") {
      break;
    }

    if (result.isEndOfCourse) {
      log("🏁 Reached end of course.", "success");
      break;
    }

    const advanced = await goToNextVideo();
    if (!advanced) {
      log("✗ Could not find Next button — stopping.", "error");
      break;
    }

    pageIndex++;
  }

  if (shouldStop) log("⏹ Stopped by user.");
  setButtonState(false);

  if (collectedFiles.length > 0) {
    log(`\n✅ ${collectedFiles.length} transcript(s) mined. Click Download to save.`, "success");
    downloadBtn.style.display = "block";
    await downloadAsZip(collectedFiles);
  }
}

// ─── Curriculum Explorer Functions ────────────────────────────────────────────

function getCheckedCurriculumItems() {
  const checkboxes = curriculumList.querySelectorAll("input.item-chk:checked");
  return Array.from(checkboxes).map(cb => ({
    title: cb.dataset.title,
    type: cb.dataset.type,
    url: cb.dataset.url
  }));
}

function updateCurriculumStats() {
  const total = curriculumList.querySelectorAll("input.item-chk").length;
  const selected = curriculumList.querySelectorAll("input.item-chk:checked").length;
  curriculumStats.textContent = `${selected} / ${total} selected`;
  selectedCountBadge.textContent = selected;
  mineSelectedBtn.style.display = selected > 0 ? "block" : "none";

  // Update each module header checkbox & badge
  scannedModules.forEach((mod, modIdx) => {
    const modItems = curriculumList.querySelectorAll(`input.item-chk[data-module-idx="${modIdx}"]`);
    const modChecked = curriculumList.querySelectorAll(`input.item-chk[data-module-idx="${modIdx}"]:checked`);
    const modHeaderChk = curriculumList.querySelector(`input.module-header-chk[data-module-idx="${modIdx}"]`);
    const modBadge = curriculumList.querySelector(`.module-count-badge[data-module-idx="${modIdx}"]`);
    if (modHeaderChk) {
      modHeaderChk.checked = modChecked.length === modItems.length && modItems.length > 0;
      modHeaderChk.indeterminate = modChecked.length > 0 && modChecked.length < modItems.length;
    }
    if (modBadge) {
      modBadge.textContent = `${modChecked.length}/${modItems.length}`;
    }
  });
}

function renderCurriculum(modules) {
  curriculumList.innerHTML = "";
  if (!modules || modules.length === 0) {
    curriculumList.innerHTML = '<div class="curriculum-empty">No modules detected. Make sure you are on a Coursera course page with the course outline or syllabus visible.</div>';
    mineSelectedBtn.style.display = "none";
    curriculumStats.textContent = "0 items";
    return;
  }

  modules.forEach((mod, modIdx) => {
    const groupEl = document.createElement("div");
    groupEl.className = "module-group";

    const headerEl = document.createElement("div");
    headerEl.className = "module-header-row";

    headerEl.innerHTML = `
      <label class="module-header-left">
        <input type="checkbox" class="module-header-chk" data-module-idx="${modIdx}" checked />
        <span>${sanitizeFilename(mod.moduleTitle)}</span>
      </label>
      <span class="module-count-badge" data-module-idx="${modIdx}">0/0</span>
    `;

    const itemsListEl = document.createElement("div");
    itemsListEl.className = "lesson-items-list";

    mod.items.forEach((item, itemIdx) => {
      const rowEl = document.createElement("div");
      rowEl.className = "lesson-item-row";

      // By default: check videos if includeVideos, readings if includeReadings, quizzes if includeQuizzes
      let isChecked = true;
      if (item.type === "video") isChecked = includeVideos.checked;
      else if (item.type === "reading") isChecked = includeReadings.checked;
      else if (item.type === "quiz" || item.type === "exam" || item.type === "assignment") isChecked = includeQuizzes.checked;

      const typeBadgeClass = `badge-${item.type}`;
      const typeLabel = item.type === "reading" ? "READ" : item.type === "video" ? "VID" : item.type.toUpperCase();

      rowEl.innerHTML = `
        <input type="checkbox" class="item-chk" 
          data-module-idx="${modIdx}" 
          data-item-idx="${itemIdx}" 
          data-title="${sanitizeFilename(item.title)}" 
          data-type="${item.type}" 
          data-url="${item.url}" 
          ${isChecked ? "checked" : ""} />
        <span class="lesson-type-badge ${typeBadgeClass}">${typeLabel}</span>
        <span class="lesson-title-text" title="${sanitizeFilename(item.title)}">${sanitizeFilename(item.title)}</span>
      `;

      itemsListEl.appendChild(rowEl);
    });

    groupEl.appendChild(headerEl);
    groupEl.appendChild(itemsListEl);
    curriculumList.appendChild(groupEl);
  });

  // Module header master toggle
  curriculumList.querySelectorAll("input.module-header-chk").forEach(chk => {
    chk.addEventListener("change", (e) => {
      const mIdx = e.target.dataset.moduleIdx;
      const targetChecked = e.target.checked;
      curriculumList.querySelectorAll(`input.item-chk[data-module-idx="${mIdx}"]`).forEach(itemChk => {
        itemChk.checked = targetChecked;
      });
      updateCurriculumStats();
    });
  });

  // Item checkboxes
  curriculumList.querySelectorAll("input.item-chk").forEach(chk => {
    chk.addEventListener("change", updateCurriculumStats);
  });

  updateCurriculumStats();
}

function applyCurriculumFilter(filterFn) {
  curriculumList.querySelectorAll("input.item-chk").forEach(chk => {
    chk.checked = filterFn(chk.dataset.type);
  });
  updateCurriculumStats();
}

// ─── Mine Selected Lessons Queue ──────────────────────────────────────────────

async function runMineSelected() {
  const items = getCheckedCurriculumItems();
  if (items.length === 0) {
    log("Please select at least one lesson from the curriculum.", "error");
    return;
  }

  shouldStop = false;
  collectedFiles = [];
  await saveCollectedFiles();
  setButtonState(true);
  logBox.innerHTML = "";
  downloadBtn.style.display = "none";

  log(`▶ Mining ${items.length} selected lesson(s)...`, "success");

  for (let i = 0; i < items.length && !shouldStop; i++) {
    const item = items[i];
    log(`[${i + 1}/${items.length}] Navigating to: ${item.title}...`);

    try {
      await sendMessageToTab({ action: "navigateTo", url: item.url });
      
      // Wait for Coursera SPA navigation and player/transcript to render
      await new Promise(r => setTimeout(r, 3800));

      if (shouldStop) break;

      await extractCurrentVideo(i + 1, autoToggle.checked);
      await new Promise(r => setTimeout(r, 1000));

    } catch (err) {
      log(`✗ Error on "${item.title}": ${err.message}`, "error");
    }
  }

  if (shouldStop) log("⏹ Mining stopped by user.", "skip");
  setButtonState(false);

  if (collectedFiles.length > 0) {
    log(`\n✅ Finished! ${collectedFiles.length} transcript(s) collected.`, "success");
    downloadBtn.style.display = "block";
    if (autoToggle.checked) {
      await downloadAsZip(collectedFiles);
    }
  }
}

// ─── Event listeners ──────────────────────────────────────────────────────────

scanCurriculumBtn.addEventListener("click", async () => {
  const isVisible = curriculumDrawer.style.display !== "none";
  if (isVisible && scannedModules.length > 0) {
    curriculumDrawer.style.display = "none";
    scanCurriculumBtn.textContent = "🔍 Scan";
    return;
  }

  scanCurriculumBtn.disabled = true;
  scanCurriculumBtn.textContent = "⏳ Scanning...";
  curriculumDrawer.style.display = "flex";

  try {
    const response = await sendMessageToTab({ action: "scanCurriculum" });
    if (response && response.success && response.modules) {
      scannedModules = response.modules;
      renderCurriculum(scannedModules);
      scanCurriculumBtn.textContent = "▲ Hide";
    } else {
      curriculumList.innerHTML = '<div class="curriculum-empty">Could not read syllabus. Please ensure the Coursera course page has finished loading.</div>';
      scanCurriculumBtn.textContent = "🔍 Retry";
    }
  } catch (err) {
    curriculumList.innerHTML = `<div class="curriculum-empty">Error: ${err.message}</div>`;
    scanCurriculumBtn.textContent = "🔍 Retry";
  } finally {
    scanCurriculumBtn.disabled = false;
  }
});

btnFilterAll.addEventListener("click", () => applyCurriculumFilter(() => true));
btnFilterVideos.addEventListener("click", () => applyCurriculumFilter(t => t === "video"));
btnFilterReadings.addEventListener("click", () => applyCurriculumFilter(t => t === "reading"));
btnFilterNone.addEventListener("click", () => applyCurriculumFilter(() => false));

mineSelectedBtn.addEventListener("click", async () => {
  await runMineSelected();
});

autoToggle.addEventListener("change", () => {
  if (autoToggle.checked) {
    modeTitle.textContent = "Auto-advance: On";
    modeDesc.textContent = "Silently mines all lessons into one ZIP archive.";
    extractBtn.textContent = "Start auto-mining";
    nextBtn.style.display = "none";
  } else {
    modeTitle.textContent = "Auto-advance: Off";
    modeDesc.textContent = "You click Next lesson yourself after each page.";
    extractBtn.textContent = "Mine this lesson";
    nextBtn.style.display = isRunning ? "block" : "none";
  }
});

extractBtn.addEventListener("click", async () => {
  collectedFiles = [];
  await saveCollectedFiles();
  logBox.innerHTML = "";
  downloadBtn.style.display = "none";

  if (autoToggle.checked) {
    await runAutoMode();
  } else {
    setButtonState(true);
    await extractCurrentVideo(1, false);
    setButtonState(false);
  }
});

nextBtn.addEventListener("click", async () => {
  nextBtn.disabled = true;
  nextBtn.textContent = "Loading...";
  const advanced = await goToNextVideo();
  if (!advanced) log("✗ Could not find Next button.", "error");
  nextBtn.disabled = false;
  nextBtn.textContent = "Next lesson →";
});

stopBtn.addEventListener("click", () => {
  shouldStop = true;
  log("⏹ Stopping after current lesson...", "skip");
});

downloadBtn.addEventListener("click", async () => {
  downloadBtn.textContent = "⏳ Preparing ZIP...";
  downloadBtn.disabled = true;
  await downloadAsZip(collectedFiles);
  downloadBtn.textContent = "⬇ Download all (.zip)";
  downloadBtn.disabled = false;
});

clearBtn.addEventListener("click", async () => {
  collectedFiles = [];
  await setStorage({ collectedFiles: "[]" });
  logBox.innerHTML = "";
  downloadBtn.style.display = "none";
  logSection.style.display = "none";
});

// ─── Init ─────────────────────────────────────────────────────────────────────

loadCollectedFiles();
detectActiveTab();
