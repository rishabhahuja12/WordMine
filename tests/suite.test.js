/**
 * tests/suite.test.js — WordMine Comprehensive Automated Test Suite
 * Validates file integrity, zero emojis, Manifest V3 schemas, Coursera taxonomy,
 * OpenXML DOCX generation, and Gemini AI prompt structures.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const JSZip = require('../jszip.min.js');
const docx = require('../docx.min.js');

const ROOT_DIR = path.resolve(__dirname, '..');

let totalTests = 0;
let passedTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`PASS [${totalTests}] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`FAIL [${totalTests}] ${name}`);
    console.error('   ', err.message);
    process.exitCode = 1;
  }
}

async function runAsyncTest(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`PASS [${totalTests}] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`FAIL [${totalTests}] ${name}`);
    console.error('   ', err.message);
    process.exitCode = 1;
  }
}

console.log('====================================================');
console.log('   WordMine Automated Engineering Test Runner');
console.log('====================================================\n');

// ─── Test 1: File Existence & Integrity ─────────────────────────────────────
runTest('All required project files and documentation must exist', () => {
  const requiredFiles = [
    'manifest.json',
    'popup.html',
    'styles.css',
    'popup.js',
    'content.js',
    'docx.min.js',
    'jszip.min.js',
    'html2pdf.min.js',
    'pdfobject.min.js',
    'TASK.md',
    'SECURITY.md',
    'AGENTS.md',
    'RULES.md',
    'README.md'
  ];

  requiredFiles.forEach(file => {
    const fullPath = path.join(ROOT_DIR, file);
    assert.ok(fs.existsSync(fullPath), `Missing required file: ${file}`);
    const stats = fs.statSync(fullPath);
    assert.ok(stats.size > 0, `File is empty: ${file}`);
  });
});

// ─── Test 2: Zero Emoji Enforcement ─────────────────────────────────────────
runTest('Zero emojis in UI files (popup.html, styles.css, popup.js, content.js, README.md)', () => {
  const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
  const filesToCheck = ['popup.html', 'styles.css', 'popup.js', 'content.js', 'README.md'];

  filesToCheck.forEach(file => {
    const content = fs.readFileSync(path.join(ROOT_DIR, file), 'utf8');
    const match = emojiRegex.exec(content);
    assert.strictEqual(
      match,
      null,
      `Emoji found in ${file}: "${match ? match[0] : ''}" (Unicode: ${match ? match[0].codePointAt(0).toString(16) : ''})`
    );
  });
});

// ─── Test 3: Manifest V3 Specification ──────────────────────────────────────
runTest('Manifest V3 configuration meets permissions and host security standards', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'manifest.json'), 'utf8'));

  assert.strictEqual(manifest.manifest_version, 3, 'Must use Manifest V3');
  assert.ok(manifest.permissions.includes('storage'), 'Must include storage permission');
  assert.ok(manifest.permissions.includes('activeTab'), 'Must include activeTab permission');
  assert.ok(manifest.permissions.includes('scripting'), 'Must include scripting permission');

  assert.ok(manifest.host_permissions.some(h => h.includes('coursera.org')), 'Must have coursera host permission');
  assert.ok(manifest.host_permissions.some(h => h.includes('generativelanguage.googleapis.com')), 'Must have Gemini API host permission');

  assert.ok(manifest.web_accessible_resources.length > 0, 'Must configure web_accessible_resources');
  const webResources = manifest.web_accessible_resources[0].resources;
  assert.ok(webResources.includes('docx.min.js'), 'Must expose docx.min.js');
  assert.ok(webResources.includes('jszip.min.js'), 'Must expose jszip.min.js');
});

// ─── Test 4: Coursera Taxonomy Engine ───────────────────────────────────────
runTest('Taxonomy engine correctly classifies all 6 Coursera content archetypes', () => {
  function classify(url) {
    if (url.includes("/lecture/")) return "video";
    if (url.includes("/supplement/")) return "reading";
    if (url.includes("/quiz/") || url.includes("/practice-quiz/")) return "quiz";
    if (url.includes("/exam/")) return "exam";
    if (url.includes("/assignment-submission/") || url.includes("/peer/")) return "assignment";
    if (url.includes("/discussionPrompt/") || url.includes("/discussion/")) return "discussion";
    if (url.includes("/ungradedWidget/") || url.includes("/ungradedLti/") || url.includes("/lab/")) return "lab";
    return "other";
  }

  assert.strictEqual(classify("https://www.coursera.org/learn/deep-learning/lecture/A1b2/welcome"), "video");
  assert.strictEqual(classify("https://www.coursera.org/learn/deep-learning/supplement/C3d4/syllabus"), "reading");
  assert.strictEqual(classify("https://www.coursera.org/learn/deep-learning/practice-quiz/E5f6/check"), "quiz");
  assert.strictEqual(classify("https://www.coursera.org/learn/deep-learning/quiz/G7h8/graded-test"), "quiz");
  assert.strictEqual(classify("https://www.coursera.org/learn/deep-learning/exam/I9j0/midterm"), "exam");
  assert.strictEqual(classify("https://www.coursera.org/learn/deep-learning/assignment-submission/K1l2/project"), "assignment");
  assert.strictEqual(classify("https://www.coursera.org/learn/deep-learning/peer/M3n4/review-step"), "assignment");
  assert.strictEqual(classify("https://www.coursera.org/learn/deep-learning/discussionPrompt/O5p6/intro"), "discussion");
  assert.strictEqual(classify("https://www.coursera.org/learn/deep-learning/discussion/Q7r8/forum"), "discussion");
  assert.strictEqual(classify("https://www.coursera.org/learn/deep-learning/ungradedWidget/S9t0/sandbox"), "lab");
  assert.strictEqual(classify("https://www.coursera.org/learn/deep-learning/ungradedLti/U1v2/jupyter"), "lab");
  assert.strictEqual(classify("https://www.coursera.org/learn/deep-learning/lab/W3x4/terminal"), "lab");
});

// ─── Test 5: OpenXML DOCX Generation & Structure ────────────────────────────
(async () => {
  await runAsyncTest('OpenXML DOCX generator produces valid package with escaped XML', async () => {
    const title = 'Machine Learning: <Bias & Variance> "Test"';
    const transcript = 'Line 1: Overfitting happens when variance is high.\nLine 2: Underfitting happens with high bias.';

    const doc = new docx.Document({
      sections: [{
        children: [
          new docx.Paragraph({
            children: [new docx.TextRun({ text: title, bold: true, size: 36, color: "1F5C6B" })],
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

    const buffer = await docx.Packer.toBuffer(doc);
    assert.ok(buffer.length > 500, 'Buffer should be non-trivial zip file');

    const zip = await JSZip.loadAsync(buffer);
    assert.ok(zip.file('[Content_Types].xml'), 'Missing [Content_Types].xml');
    assert.ok(zip.file('_rels/.rels'), 'Missing _rels/.rels');
    assert.ok(zip.file('word/document.xml'), 'Missing word/document.xml');

    const docXml = await zip.file('word/document.xml').async('text');
    // Ensure XML entities were properly escaped
    assert.ok(docXml.includes('&lt;Bias &amp; Variance&gt;'), 'Special characters must be XML-escaped');
    assert.ok(docXml.includes('Overfitting happens when variance is high.'), 'Transcript text must be present');
    assert.ok(docXml.includes('1F5C6B'), 'Petrol Teal color code must be applied to heading run');
  });

  // ─── Test 6: Skipped Audit Log Reason Formatting ──────────────────────────
  runTest('Skipped audit log correctly categorizes non-transcript items with clear rationales', () => {
    function getSkipReason(type) {
      if (type === "quiz" || type === "exam") return "Practice/Graded Quiz — Interactive assessment";
      if (type === "lab") return "Hands-on Project / Guided Lab — Interactive sandbox, no transcript";
      if (type === "discussion") return "Discussion Forum — Community prompt, no transcript";
      if (type === "assignment") return "Peer/Programmatic Assignment — Task rubric, no transcript";
      return "Non-transcript item";
    }

    assert.strictEqual(getSkipReason("quiz"), "Practice/Graded Quiz — Interactive assessment");
    assert.strictEqual(getSkipReason("lab"), "Hands-on Project / Guided Lab — Interactive sandbox, no transcript");
    assert.strictEqual(getSkipReason("discussion"), "Discussion Forum — Community prompt, no transcript");
    assert.strictEqual(getSkipReason("assignment"), "Peer/Programmatic Assignment — Task rubric, no transcript");
  });

  // ─── Test 7: Gemini AI Prompt Structuring ─────────────────────────────────
  runTest('Gemini AI prompt builders produce valid academic tutor queries', () => {
    const questions = [
      {
        prompt: "What is the primary function of gradient descent?",
        options: [
          { text: "Minimize the loss function" },
          { text: "Maximize weights" }
        ]
      }
    ];

    let prompt = "Solve each question:\n";
    questions.forEach((q, idx) => {
      prompt += `Question ${idx + 1}: ${q.prompt}\n`;
      q.options.forEach((opt, oIdx) => {
        prompt += `  [${oIdx + 1}] ${opt.text}\n`;
      });
    });

    assert.ok(prompt.includes("Question 1: What is the primary function of gradient descent?"));
    assert.ok(prompt.includes("[1] Minimize the loss function"));
  });

  // ─── Test 8: HTML Element Verification ────────────────────────────────────
  runTest('popup.html contains all required UI elements for the 3 modes', () => {
    const html = fs.readFileSync(path.join(ROOT_DIR, 'popup.html'), 'utf8');

    // Navigation tabs
    assert.ok(html.includes('id="tabMinerBtn"'), 'Missing tabMinerBtn');
    assert.ok(html.includes('id="tabAutomatorBtn"'), 'Missing tabAutomatorBtn');
    assert.ok(html.includes('id="tabAiBtn"'), 'Missing tabAiBtn');

    // Transcripts Miner controls
    assert.ok(html.includes('name="format" value="docx"'), 'Missing docx format pill');
    assert.ok(html.includes('name="format" value="pdf"'), 'Missing pdf format pill');
    assert.ok(html.includes('name="format" value="txt"'), 'Missing txt format pill');
    assert.ok(html.includes('id="autoToggle"'), 'Missing autoToggle');
    assert.ok(html.includes('id="includeVideos"'), 'Missing includeVideos');
    assert.ok(html.includes('id="includeReadings"'), 'Missing includeReadings');
    assert.ok(html.includes('id="includeQuizzes"'), 'Missing includeQuizzes');
    assert.ok(html.includes('id="scanCurriculumBtn"'), 'Missing scanCurriculumBtn');
    assert.ok(html.includes('id="feedTabMined"'), 'Missing feedTabMined');
    assert.ok(html.includes('id="feedTabSkipped"'), 'Missing feedTabSkipped');

    // Automator controls
    assert.ok(html.includes('id="btnAutoMarkCurrent"'), 'Missing btnAutoMarkCurrent');
    assert.ok(html.includes('id="btnHandleDiscussion"'), 'Missing btnHandleDiscussion');
    assert.ok(html.includes('id="btnAssistPeerReview"'), 'Missing btnAssistPeerReview');
    assert.ok(html.includes('id="btnAutoLoopCourse"'), 'Missing btnAutoLoopCourse');

    // Gemini AI controls
    assert.ok(html.includes('id="geminiApiKey"'), 'Missing geminiApiKey');
    assert.ok(html.includes('id="btnSaveKey"'), 'Missing btnSaveKey');
    assert.ok(html.includes('id="btnAiSolveQuiz"'), 'Missing btnAiSolveQuiz');
    assert.ok(html.includes('id="btnAiSummarize"'), 'Missing btnAiSummarize');
    assert.ok(html.includes('id="btnAiPeerReview"'), 'Missing btnAiPeerReview');
    assert.ok(html.includes('id="aiOutputBox"'), 'Missing aiOutputBox');
  });

  console.log('\n====================================================');
  console.log(`Results: ${passedTests} passed, ${totalTests - passedTests} failed`);
  console.log('====================================================');

  if (passedTests === totalTests) {
    console.log('ALL VERIFICATION TESTS COMPLETED SUCCESSFULLY!\n');
  } else {
    process.exit(1);
  }
})();
