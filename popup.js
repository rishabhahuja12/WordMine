// popup.js — controls the popup UI and orchestrates extraction

// ─── State ───────────────────────────────────────────────────────────────────

let isRunning = false;
let shouldStop = false;
let collectedFiles = [];

// ─── DOM References ──────────────────────────────────────────────────────────

const autoToggle = document.getElementById("autoToggle");
const modeHint = document.getElementById("modeHint");
const extractBtn = document.getElementById("extractBtn");
const nextBtn = document.getElementById("nextBtn");
const stopBtn = document.getElementById("stopBtn");
const logSection = document.getElementById("logSection");
const logBox = document.getElementById("logBox");
const downloadBtn = document.getElementById("downloadBtn");
const clearBtn = document.getElementById("clearBtn");

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getSelectedFormat() {
  return document.querySelector('input[name="format"]:checked').value;
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
  return name.replace(/[\\/:*?"<>|]/g, "").trim().substring(0, 60);
}

function setButtonState(running) {
  isRunning = running;
  extractBtn.disabled = running;
  stopBtn.style.display = running ? "block" : "none";
  if (autoToggle.checked) {
    nextBtn.style.display = "none";
  } else {
    nextBtn.style.display = running ? "block" : "none";
  }
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
        clearBtn.style.display = "block";
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

function getExtension(format) {
  return format;
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

// Single file download (manual mode — immediate, no ZIP)
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

// ─── Core extraction ──────────────────────────────────────────────────────────

async function ensureContentScriptInjected(tabId) {
  // Test if already responding
  const isLoaded = await new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { action: "ping" }, (res) => {
      if (chrome.runtime.lastError || !res || !res.success) {
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });

  if (isLoaded) return true;

  // Try dynamic programmatic injection
  if (chrome.scripting) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ["content.js"]
      });
      // Short delay for event listener registration
      await new Promise(r => setTimeout(r, 250));
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
        reject(new Error("You are not on Coursera. Please open a Coursera video lesson page first."));
        return;
      }

      // Ensure content script is running
      await ensureContentScriptInjected(tab.id);

      chrome.tabs.sendMessage(tab.id, message, (response) => {
        if (chrome.runtime.lastError) {
          const err = chrome.runtime.lastError.message || "";
          if (err.includes("Receiving end does not exist") || err.includes("Could not establish connection")) {
            reject(new Error("Could not connect to Coursera page. Please refresh (F5) the Coursera tab and try again."));
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

async function extractCurrentVideo(index, silentMode = false) {
  const searchingEntry = log("⏳ Searching for video / reading content...");

  try {
    const response = await sendMessageToTab({ action: "getTranscript" });

    if (!response) {
      replaceLog(searchingEntry, "✗ Could not connect to Coursera. Please refresh (F5) the Coursera page and try again.", "error");
      return { success: false, reason: "no_connection" };
    }

    if (!response.success) {
      if (response.reason === "no_transcript") {
        replaceLog(searchingEntry, "↷ No transcript found — skipping.", "skip");
        return { success: false, reason: "no_transcript", isEndOfCourse: response.isEndOfCourse };
      }
      replaceLog(searchingEntry, `↷ Skipped: ${response.reason || "Unknown issue"}`, "skip");
      return { success: false, reason: response.reason || "skip", isEndOfCourse: response.isEndOfCourse };
    }

    const format = getSelectedFormat();
    const fileIndex = collectedFiles.length + 1;

    collectedFiles.push({
      title: response.title,
      content: response.transcript,
      format,
      index: fileIndex
    });

    // Persist collected files so they survive popup close
    await saveCollectedFiles();

    replaceLog(searchingEntry, `✓ ${fileIndex}. ${sanitizeFilename(response.title)}`, "success");

    // Only trigger immediate download in manual mode
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
    if (!result.success && result.reason !== "no_transcript") {
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
    clearBtn.style.display = "block";
  }
}

// ─── Event listeners ──────────────────────────────────────────────────────────

autoToggle.addEventListener("change", () => {
  if (autoToggle.checked) {
    modeHint.textContent = "Auto: mines all lessons silently into one ZIP archive.";
    nextBtn.style.display = "none";
    extractBtn.innerHTML = '<span class="btn-icon">⛏</span><span class="btn-label">START AUTO MINING</span>';
  } else {
    modeHint.textContent = 'Manual: click Next Lesson yourself after each page.';
    extractBtn.innerHTML = '<span class="btn-icon">⛏</span><span class="btn-label">MINE THIS LESSON</span>';
    nextBtn.style.display = isRunning ? "block" : "none";
  }
});

extractBtn.addEventListener("click", async () => {
  collectedFiles = [];
  await saveCollectedFiles();
  logBox.innerHTML = "";
  downloadBtn.style.display = "none";
  clearBtn.style.display = "none";

  if (autoToggle.checked) {
    await runAutoMode();
  } else {
    setButtonState(true);
    await extractCurrentVideo(1, false); // immediate download, no ZIP
    setButtonState(false);
  }
});

nextBtn.addEventListener("click", async () => {
  nextBtn.disabled = true;
  nextBtn.textContent = "Loading...";
  const advanced = await goToNextVideo();
  if (!advanced) log("✗ Could not find Next button.", "error");
  nextBtn.disabled = false;
  nextBtn.textContent = "NEXT LESSON →";
});

stopBtn.addEventListener("click", () => {
  shouldStop = true;
  log("⏹ Stopping after current lesson...", "skip");
});

downloadBtn.addEventListener("click", async () => {
  downloadBtn.textContent = "⏳ Preparing ZIP...";
  downloadBtn.disabled = true;
  await downloadAsZip(collectedFiles);
  downloadBtn.textContent = "⬇ DOWNLOAD ALL (.ZIP)";
  downloadBtn.disabled = false;
});

clearBtn.addEventListener("click", async () => {
  collectedFiles = [];
  await setStorage({ collectedFiles: "[]" });
  logBox.innerHTML = "";
  downloadBtn.style.display = "none";
  clearBtn.style.display = "none";
  log("Cleared. Ready to start again.");
});

// ─── Init ─────────────────────────────────────────────────────────────────────

loadCollectedFiles();
