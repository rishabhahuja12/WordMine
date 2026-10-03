const fs = require('fs');
const path = require('path');
const JSZip = require('../jszip.min.js');

function escapeXml(unsafe) {
  return String(unsafe || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

class TextRun {
  constructor(options = {}) {
    this.text = options.text || '';
    this.bold = !!options.bold;
    this.size = options.size || 24; // in half-points (24 = 12pt)
    this.color = options.color || '1C1C1A';
  }

  toXml() {
    let rPr = '<w:rPr>';
    if (this.bold) rPr += '<w:b/><w:bCs/>';
    if (this.size) rPr += `<w:sz w:val="${this.size}"/><w:szCs w:val="${this.size}"/>`;
    if (this.color) rPr += `<w:color w:val="${this.color}"/>`;
    rPr += '<w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>';
    rPr += '</w:rPr>';

    return `<w:r>${rPr}<w:t xml:space="preserve">${escapeXml(this.text)}</w:t></w:r>`;
  }
}

class Paragraph {
  constructor(options = {}) {
    this.children = options.children || [];
    this.spacing = options.spacing || {};
  }

  toXml() {
    let pPr = '<w:pPr>';
    if (this.spacing && this.spacing.after) {
      pPr += `<w:spacing w:after="${this.spacing.after}"/>`;
    }
    pPr += '</w:pPr>';
    const runsXml = this.children.map(child => child.toXml ? child.toXml() : '').join('');
    return `<w:p>${pPr}${runsXml}</w:p>`;
  }
}

class Document {
  constructor(options = {}) {
    this.sections = options.sections || [];
  }
}

class Packer {
  static async toZip(doc) {
    const ZipConstructor = typeof JSZip !== 'undefined' ? JSZip : (typeof window !== 'undefined' ? window.JSZip : null);
    if (!ZipConstructor) throw new Error('JSZip library is required to pack DOCX');
    const zip = new ZipConstructor();

    // 1. [Content_Types].xml
    zip.file('[Content_Types].xml',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
      '</Types>'
    );

    // 2. _rels/.rels
    zip.folder('_rels').file('.rels',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
      '</Relationships>'
    );

    // 3. word/document.xml
    const wordFolder = zip.folder('word');
    wordFolder.folder('_rels').file('document.xml.rels',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>'
    );

    let bodyXml = '';
    for (const section of doc.sections || []) {
      for (const child of section.children || []) {
        if (child.toXml) {
          bodyXml += child.toXml();
        }
      }
    }
    bodyXml += '<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>';

    wordFolder.file('document.xml',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
      `<w:body>${bodyXml}</w:body>` +
      '</w:document>'
    );

    return zip;
  }

  static async toBlob(doc) {
    const zip = await Packer.toZip(doc);
    return await zip.generateAsync({
      type: 'blob',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    });
  }

  static async toBuffer(doc) {
    const zip = await Packer.toZip(doc);
    return await zip.generateAsync({ type: 'nodebuffer' });
  }
}

// Test generation
async function run() {
  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({
          children: [new TextRun({ text: 'Neural Networks: Week 1 Lecture', bold: true, size: 36, color: '1F5C6B' })],
          spacing: { after: 200 }
        }),
        new Paragraph({
          children: [new TextRun({ text: 'Welcome to this deep learning course. Today we discuss gradient descent.', size: 24 })],
          spacing: { after: 80 }
        })
      ]
    }]
  });

  const buffer = await Packer.toBuffer(doc);
  console.log('DOCX buffer generated successfully. Size:', buffer.length, 'bytes');

  // Verify that it is a valid zip containing word/document.xml
  const readZip = await JSZip.loadAsync(buffer);
  const docXml = await readZip.file('word/document.xml').async('text');
  if (!docXml.includes('Neural Networks: Week 1 Lecture') || !docXml.includes('gradient descent')) {
    throw new Error('Verification failed: XML missing text');
  }
  console.log('DOCX verification PASSED! Content verified in word/document.xml');
}

run().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
