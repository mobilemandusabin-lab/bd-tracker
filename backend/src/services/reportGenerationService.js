const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');
const { Resvg } = require('@resvg/resvg-js');

const LEFT_COL = { min: 0, max: 2500000 };
const CENTER_COL = { min: 2500000, max: 6500000 };
const RIGHT_COL = { min: 6500000, max: 13000000 };

const COLUMN_FIELD_MAP = { prev: 'previousValue', current: 'currentValue', target: 'targetValue' };

const LABEL_KEY_MAP = {
  'total vendors': 'totalVendors',
  'verified vendors': 'verifiedVendors',
  'active sellers': 'activeSellers',
  'vendors added': 'vendorsAdded',
  'vendors with less than 10': 'vendorsWithLessThan10',
  'total marketplace products': 'totalMarketplaceProducts',
  'daily average listings': 'dailyAverageListings',
  'backlog': 'backlogProducts',
  'total listings': 'totalListings',
  'products shown in marketplace': 'totalProductsShown',
  'total specifications added': 'totalSpecificationsAdded',
  'spec completion': 'specificationCompletionPercent',
  'specification completion': 'specificationCompletionPercent',
  'products approved': 'productsApproved',
  'products rejected': 'productsRejected',
  'products pending': 'productsPending',
};

const SLIDE9_ROWS = [
  { yMin: 3000000, yMax: 4000000, xMin: 0, xMax: 2500000, key: 'totalVendors' },
  { yMin: 3000000, yMax: 4000000, xMin: 2500000, xMax: 6000000, key: 'totalMarketplaceProducts' },
  { yMin: 3000000, yMax: 4000000, xMin: 6000000, xMax: 13000000, key: 'dailyAverageListings' },
];

const CHART_POSITIONS = {
  2: [  // BD Charts - moved down to avoid label overlap
    { x: 411480, y: 2190750, dept: 'Business Development', key: 'totalVendors', title: 'Total Vendors' },
    { x: 6420700, y: 2190750, dept: 'Business Development', key: 'verifiedVendors', title: 'Total Verified Vendors' },
  ],
  5: [  // Listing Charts - moved down to avoid label overlap
    { x: 713232, y: 2190750, dept: 'Listing', key: 'totalMarketplaceProducts', title: 'Marketplace Products' },
    { x: 6812280, y: 2190750, dept: 'Listing', key: 'dailyAverageListings', title: 'Daily Average Listings' },
  ],
  8: [  // QC Charts - moved down to avoid label overlap
    { x: 411480, y: 2190750, dept: 'Quality Control', key: 'productsApproved', title: 'QC – Products Approved' },
    { x: 6420700, y: 2190750, dept: 'Quality Control', key: 'productsRejected', title: 'QC – Products Rejected' },
  ],
};

function getColumn(x) {
  if (x >= LEFT_COL.min && x <= LEFT_COL.max) return 'prev';
  if (x >= CENTER_COL.min && x <= CENTER_COL.max) return 'current';
  if (x >= RIGHT_COL.min && x <= RIGHT_COL.max) return 'target';
  return null;
}

function getValue(sections, key, col) {
  const field = COLUMN_FIELD_MAP[col];
  if (!field) return null;
  for (const s of sections) {
    for (const v of s.values || []) {
      if (v.headingKey === key) return v[field] ?? null;
    }
  }
  return null;
}

function findHeadingKey(text) {
  const lower = text.toLowerCase().trim();
  for (const [label, key] of Object.entries(LABEL_KEY_MAP)) {
    if (lower.includes(label)) return key;
  }
  return null;
}

function fmt(v) {
  if (v === null || v === undefined) return '—';
  return Number(v).toLocaleString();
}

function getDeptSection(sections, name) {
  return sections.find(s => s.departmentName?.toLowerCase().includes(name.toLowerCase().split(' ')[0]));
}

function parseEmu(emu) {
  return { x: parseInt(emu[1]), y: parseInt(emu[2]) };
}

// ── 12-slide template builder ─────────────────────────────────────

async function ensure12SlideTemplate(srcPath, cachePath) {
  if (fs.existsSync(cachePath)) return;

  const buf = fs.readFileSync(srcPath);
  const zip = await JSZip.loadAsync(buf);

  const presXml = await zip.file('ppt/presentation.xml').async('string');
  const presRelsXml = await zip.file('ppt/_rels/presentation.xml.rels').async('string');
  const ctXml = await zip.file('[Content_Types].xml').async('string');

  const sldIds = [];
  let m;
  const sldRegex = /<p:sldId[^>]*\/>/g;
  while ((m = sldRegex.exec(presXml)) !== null) {
    const rId = m[0].match(/r:id="([^"]+)"/)?.[1];
    if (rId) sldIds.push(rId);
  }

  const rels = {};
  const relRegex = /<Relationship\s+([^>]*)\/>/g;
  while ((m = relRegex.exec(presRelsXml)) !== null) {
    const id = m[1].match(/Id="([^"]+)"/)?.[1];
    const target = m[1].match(/Target="([^"]+)"/)?.[1];
    if (id && target) rels[id] = target;
  }

  const slideData = {};
  for (const rId of sldIds) {
    const p = 'ppt/' + rels[rId];
    slideData[rId] = { xml: await zip.file(p).async('string'), rels: null };
    const num = rels[rId].match(/slide(\d+)/)?.[1];
    const rp = `ppt/slides/_rels/slide${num}.xml.rels`;
    if (zip.files[rp]) slideData[rId].rels = await zip.file(rp).async('string');
  }

  // Fix slide3 (BD Charts): resize chart images so they don't overlap
  const bdIdx = sldIds[2];
  if (slideData[bdIdx]) {
    slideData[bdIdx].xml = slideData[bdIdx].xml
      .replace(
        '<a:off x="411480" y="1824770"/><a:ext cx="6400800" cy="3931920"/>',
        '<a:off x="411480" y="1824770"/><a:ext cx="6009220" cy="3931920"/>'
      )
      .replace(
        '<a:off x="6420700" y="1866850"/><a:ext cx="6358200" cy="3931800"/>',
        '<a:off x="6420700" y="1866850"/><a:ext cx="5771300" cy="3931800"/>'
      );
  }

  // Fix slide3 (BD Charts): move charts down to avoid label overlap
  if (slideData[bdIdx]) {
    slideData[bdIdx].xml = slideData[bdIdx].xml
      .replace(/y="1824770"/g, 'y="2190750"')  // left chart y
      .replace(/y="1866850"/g, 'y="2190750"');  // right chart y
    zip.file('ppt/' + rels[bdIdx], slideData[bdIdx].xml);
  }

  // Fix slide6 (Listing Charts): remove duplicate PIC at (6812280, 1600200) with rId6
  const liIdx = sldIds[5];
  if (slideData[liIdx]) {
    slideData[liIdx].xml = slideData[liIdx].xml
      .replace(/<p:pic>[\s\S]*?<\/p:pic>/g, pic =>
        pic.includes('r:embed="rId6"') ? '' : pic
      )
      // Move charts down to avoid label overlap
      .replace(/y="1600200"/g, 'y="2190750"')
      // Replace 2nd chart text label
      .replace(/Total Specifications Added Trend/g, 'Daily Average Listings Trend')
      // Update narrative text below charts
      .replace(/Total Specifications Added/g, 'Daily Average Listings');
    if (slideData[liIdx].rels) {
      slideData[liIdx].rels = slideData[liIdx].rels.replace(
        /<Relationship\s+Id="rId6"[^>]*\/>/, ''
      );
    }
  }

  // Overwrite fixed originals in the zip so all 12 slides get the fix
  if (slideData[bdIdx]) {
    zip.file('ppt/' + rels[bdIdx], slideData[bdIdx].xml);
  }
  if (slideData[liIdx]) {
    zip.file('ppt/' + rels[liIdx], slideData[liIdx].xml);
    if (slideData[liIdx].rels) {
      zip.file('ppt/slides/_rels/slide6.xml.rels', slideData[liIdx].rels);
    }
  }

  let maxRId = 0;
  for (const id of Object.keys(rels)) {
    const n = id.match(/rId(\d+)/)?.[1];
    if (n) maxRId = Math.max(maxRId, parseInt(n));
  }
  let nextRId = maxRId + 1;
  let nextSlideNum = 10;

  function cloneSlide(srcRId, replacements = {}) {
    let xml = slideData[srcRId].xml;
    for (const [search, replace] of Object.entries(replacements)) {
      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      xml = xml.replace(regex, replace);
    }
    const newRId = `rId${nextRId++}`;
    const num = nextSlideNum++;
    const target = `slides/slide${num}.xml`;
    return { rId: newRId, xml, rels: slideData[srcRId].rels, target };
  }

  const listingNarrative = cloneSlide(sldIds[3], { 'Business Development': 'Listing' });
  const qcChartsClone = cloneSlide(sldIds[2], {
    'Business Development': 'Quality Control',
    'Total Vendors': 'Products Approved',
    'Total Verified Vendors': 'Products Rejected',
  });
  const qcNarrative = cloneSlide(sldIds[3], { 'Business Development': 'Quality Control' });

  // Give QC Charts its own media copies so chart injection doesn't conflict with BD Charts
  const qcMediaCopies = [];
  if (qcChartsClone.rels) {
    const mediaRelRegex = /<Relationship\s+([^>]*?)Id="([^"]+)"[^>]*?Target="([^"]*media\/([^"]+))"[^>]*?\/>/g;
    let mr;
    while ((mr = mediaRelRegex.exec(qcChartsClone.rels)) !== null) {
      const oldTarget = mr[3];
      const fileName = mr[4];
      const ext = path.extname(fileName);
      const base = path.basename(fileName, ext);
      const newTarget = `../media/${base}_qc${ext}`;
      qcChartsClone.rels = qcChartsClone.rels.replace(new RegExp(fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), `${base}_qc${ext}`);
      qcMediaCopies.push({ oldFull: `ppt/media/${fileName}`, newFull: `ppt/media/${base}_qc${ext}` });
    }
  }

  for (const { oldFull, newFull } of qcMediaCopies) {
    if (zip.files[oldFull]) {
      const data = await zip.files[oldFull].async('nodebuffer');
      zip.file(newFull, data);
    }
  }



  const newSlides = [
    { rId: sldIds[0] },
    { rId: sldIds[1] },
    { rId: sldIds[2] },
    { rId: sldIds[3] },
    { rId: sldIds[4] },
    { rId: sldIds[5] },
    { rId: listingNarrative.rId, target: listingNarrative.target, xml: listingNarrative.xml, rels: listingNarrative.rels },
    { rId: sldIds[6] },
    { rId: qcChartsClone.rId, target: qcChartsClone.target, xml: qcChartsClone.xml, rels: qcChartsClone.rels },
    { rId: qcNarrative.rId, target: qcNarrative.target, xml: qcNarrative.xml, rels: qcNarrative.rels },
    { rId: sldIds[7] },
    { rId: sldIds[8] },
  ];

  let newPresXml = presXml.replace(/<p:sldIdLst>[\s\S]*?<\/p:sldIdLst>/, () =>
    '<p:sldIdLst>' + newSlides.map((s, i) => `<p:sldId id="${256 + i}" r:id="${s.rId}"/>`).join('') + '</p:sldIdLst>'
  );

  let newRelsXml = presRelsXml;
  for (const s of newSlides) {
    if (s.target) {
      newRelsXml = newRelsXml.replace('</Relationships>',
        `<Relationship Id="${s.rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="${s.target}"/></Relationships>`
      );
    }
  }

  let newCtXml = ctXml;
  for (const s of newSlides) {
    if (s.target) {
      newCtXml = newCtXml.replace('</Types>',
        `<Override PartName="/ppt/${s.target}" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/></Types>`
      );
    }
  }

  zip.file('ppt/presentation.xml', newPresXml);
  zip.file('ppt/_rels/presentation.xml.rels', newRelsXml);
  zip.file('[Content_Types].xml', newCtXml);

  for (const s of newSlides) {
    if (s.xml) {
      zip.file(`ppt/${s.target}`, s.xml);
      if (s.rels) {
        const rn = path.basename(s.target).replace('.xml', '.xml.rels');
        zip.file(`ppt/slides/_rels/${rn}`, s.rels);
      }
    }
  }

  const outBuf = await zip.generateAsync({ type: 'nodebuffer' });
  fs.mkdirSync(path.dirname(cachePath), { recursive: true });
  fs.writeFileSync(cachePath, outBuf);
  console.log('[ReportGen] 12-slide template cached at', cachePath);
}

// ── SVG Chart Generation ─────────────────────────────────────────

function createBarChartSvg(values, labels, title, wPx = 500, hPx = 340) {
  const n = values.length;
  const f = 'Arial, sans-serif';
  const barColor = '#dc1e3e';
  const labelColor = '#666666';

  // Compute nice Y-axis range
  const dataMin = Math.min(...values);
  const dataMax = Math.max(...values);
  const rawRange = dataMax - dataMin;
  const pad = Math.max(rawRange === 0 ? 5 : Math.round(rawRange * 0.2), 2);
  const rawMin = dataMin - pad;
  const rawMax = dataMax + pad;
  const idealStep = (rawMax - rawMin) / 5;
  const magnitude = Math.pow(10, Math.floor(Math.log10(idealStep)));
  const residual = idealStep / magnitude;
  let niceStep;
  if (residual <= 1.5) niceStep = 1 * magnitude;
  else if (residual <= 3.5) niceStep = 2 * magnitude;
  else if (residual <= 7) niceStep = 5 * magnitude;
  else niceStep = 10 * magnitude;
  const yMin = Math.floor(rawMin / niceStep) * niceStep;
  const yMax = Math.ceil(rawMax / niceStep) * niceStep;
  const ySteps = Math.round((yMax - yMin) / niceStep);

  // Plot area at 80% of original, centered
  const margin = { l: 78, r: 100, t: 75, b: 76 };
  const plotL = margin.l, plotR = wPx - margin.r;
  const plotT = margin.t, plotB = hPx - margin.b;
  const plotW = plotR - plotL, plotH = plotB - plotT;
  const barW = 56;
  const gap = (plotW - barW * n) / (n + 1);

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${wPx}" height="${hPx}" viewBox="0 0 ${wPx} ${hPx}">
    <rect width="${wPx}" height="${hPx}" fill="#ffffff"/>`;

  // Notebook ruled lines at uniform Y-axis subdivisions
  const subStep = niceStep / 4;
  for (let v = yMin; v <= yMax; v += subStep) {
    const y = plotB - ((v - yMin) / (yMax - yMin)) * plotH;
    svg += `<line x1="${plotL}" y1="${y}" x2="${plotR}" y2="${y}" stroke="#e0e0e0" stroke-width="1"/>`;
  }

  // Horizontal grid lines at Y-axis label positions
  for (let i = 0; i <= ySteps; i++) {
    const gy = plotB - (plotH / ySteps) * i;
    const val = yMin + niceStep * i;
    svg += `<line x1="${plotL}" y1="${gy}" x2="${plotR}" y2="${gy}" stroke="#d4d4d4" stroke-width="1"/>`;
    svg += `<text x="${plotL - 10}" y="${gy + 4}" text-anchor="end" font-family="${f}" font-size="10" fill="${labelColor}">${fmt(val)}</text>`;
  }

  // Axes
  svg += `<line x1="${plotL}" y1="${plotT}" x2="${plotL}" y2="${plotB}" stroke="#222222" stroke-width="1.5"/>`;
  svg += `<line x1="${plotL}" y1="${plotB}" x2="${plotR}" y2="${plotB}" stroke="#222222" stroke-width="1.5"/>`;

  // Bars
  for (let i = 0; i < n; i++) {
    const barH = Math.max(((values[i] - yMin) / (yMax - yMin)) * plotH, 2);
    const cx = plotL + gap + (barW + gap) * i + barW / 2;
    const by = plotB - barH;

    // Shadow
    svg += `<rect x="${cx - barW/2 + 2}" y="${by + 2}" width="${barW}" height="${barH}" fill="#000000" opacity="0.08" rx="2"/>`;
    // Bar
    svg += `<rect x="${cx - barW/2}" y="${by}" width="${barW}" height="${barH}" fill="${barColor}" rx="2"/>`;
    // Value above bar
    svg += `<text x="${cx}" y="${by - 10}" text-anchor="middle" font-family="${f}" font-size="12" font-weight="bold" fill="#333333">${fmt(values[i])}</text>`;
    // Category label below bar
    svg += `<text x="${cx}" y="${plotB + 18}" text-anchor="middle" font-family="${f}" font-size="10" fill="${labelColor}">${labels[i].replace('\\n', ' ')}</text>`;
    // Value below category label
    svg += `<text x="${cx}" y="${plotB + 34}" text-anchor="middle" font-family="${f}" font-size="11" font-weight="bold" fill="#333333">${fmt(values[i])}</text>`;
  }

  // Legend
  const legendX = wPx / 2;
  const legendY = plotB + 50;
  svg += `<rect x="${legendX - 28}" y="${legendY - 8}" width="10" height="10" fill="${barColor}" rx="1"/>`;
  svg += `<text x="${legendX - 14}" y="${legendY + 1}" text-anchor="start" font-family="${f}" font-size="11" fill="${labelColor}">Total</text>`;

  // Footer axis title
  svg += `<text x="${legendX}" y="${legendY + 22}" text-anchor="middle" font-family="${f}" font-size="11" font-weight="bold" fill="${labelColor}">${title.replace('Total ', '')}</text>`;

  svg += '</svg>';
  return svg;
}

const FONT_DIR = path.join(__dirname, '..', '..', 'fonts');
const FONT_FILES = ['QuattrocentoSans-Regular.ttf', 'QuattrocentoSans-Bold.ttf']
  .map(f => path.join(FONT_DIR, f))
  .filter(f => fs.existsSync(f));

function svgToPng(svg) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: 500 },
    font: { fontFiles: FONT_FILES, defaultFontFamily: 'Quattrocento Sans' },
  });
  const pngData = resvg.render();
  return pngData.asPng();
}

// ── Text Replacement in Slides ──────────────────────────────────

function slideReplaceValues(slideXml, sections, summary, dateStr, slideIdx, slideCount) {
  let xml = slideXml;
  const dataSlides = [1, 4, 6, 10];

  if (dateStr) {
    const datePattern = /[A-Z][a-z]{2}\s+\d{1,2},\s+\d{4}\s*-\s*[A-Z][a-z]{2}\s+\d{1,2},\s+\d{4}/;
    xml = xml.replace(datePattern, dateStr);
  }

  // Replace heading-key-matched values
  const spBlocks = xml.match(/<p:sp>[\s\S]*?<\/p:sp>/g) || [];
  for (const block of spBlocks) {
    const offMatch = block.match(/<a:off\s+x="(\d+)"\s+y="(\d+)"/);
    if (!offMatch) continue;
    const x = parseInt(offMatch[1]);
    const col = getColumn(x);
    if (!col) continue;

    const textMatch = block.match(/<a:t[^>]*>([^<]*)<\/a:t>/);
    if (!textMatch) continue;
    const text = textMatch[1].trim();
    if (!text) continue;

    const headingKey = findHeadingKey(text);
    if (!headingKey) {
      // No heading key — clear stale text on data slides
      if (dataSlides.includes(slideIdx)) {
        const topMatch = block.match(/<a:off\s+x="\d+"\s+y="(\d+)"/);
        if (topMatch) {
          const top = parseInt(topMatch[1]);
          if (top >= 1300000 && top <= 5800000) {
            const cleaned = block.replace(/<a:t[^>]*>([^<]*)<\/a:t>/g, '<a:t></a:t>');
            xml = xml.replace(block, cleaned);
          }
        }
      }
      continue;
    }

    const reportVal = getValue(sections, headingKey, col);
    const formatted = reportVal !== null && reportVal !== undefined ? fmt(reportVal) : '—';

    // Replace the value within this shape
    if (col === 'prev') {
      if (text.startsWith('Target:')) {
        const targetVal = getValue(sections, headingKey, 'target');
        const targetFmt = targetVal !== null ? fmt(targetVal) : '—';
        const newText = text.replace(/\b\d{1,3}(?:,\d{3})*\b/, targetFmt);
        const newBlock = block.replace(text, newText);
        xml = xml.replace(block, newBlock);
        continue;
      }
      if (text.includes('Actual:')) {
        const cleanText = text.replace(/Actual:\s*/, '');
        const newText = cleanText.replace(/\b\d{1,3}(?:,\d{3})*\b/, formatted);
        const newBlock = block.replace(text, newText);
        xml = xml.replace(block, newBlock);
        continue;
      }
    }

    // Generic value replacement
    if (text.includes(':')) {
      const labelPart = text.split(':')[0];
      const escaped = labelPart.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const newBlock = block.replace(new RegExp(`(${escaped}:\\s*)[^<]*`), `$1${formatted}`);
      xml = xml.replace(block, newBlock);
    } else {
      const newText = text.replace(/\b\d{1,3}(?:,\d{3})*\b/, formatted);
      const newBlock = block.replace(text, newText);
      xml = xml.replace(block, newBlock);
    }
  }

  return xml;
}

function replaceNarrative(xml, sections, deptName) {
  const section = getDeptSection(sections, deptName);
  const notes = section?.notes?.trim() || '';
  const cleaned = notes.replace(/\.{2,}/g, '.');
  const bullets = cleaned.split('\n').filter(Boolean).map(l => `• ${l.trim()}`).join('\n');

  const spBlocks = xml.match(/<p:sp>[\s\S]*?<\/p:sp>/g) || [];
  let targetBlock = null;
  let targetLen = 0;

  for (const block of spBlocks) {
    const topMatch = block.match(/<a:off\s+x="\d+"\s+y="(\d+)"/);
    const wMatch = block.match(/<a:ext\s+cx="(\d+)"\s+cy="(\d+)"/);
    if (!topMatch || !wMatch) continue;
    const top = parseInt(topMatch[1]);
    const w = parseInt(wMatch[1]);
    const h = parseInt(wMatch[2]);
    if (top < 700000 || top > 6000000) continue;
    if (w < 2000000 || h < 500000) continue;
    const textLen = block.length;
    if (textLen > targetLen) {
      targetLen = textLen;
      targetBlock = block;
    }
  }

  if (targetBlock) {
    let newBlock = targetBlock.replace(/<a:t[^>]*>[^<]*<\/a:t>/g, '<a:t></a:t>');
    const firstRun = newBlock.match(/<a:r[^>]*>[\s\S]*?<\/a:r>/);
    if (firstRun) {
      const newRun = firstRun[0].replace(/<a:t[^>]*>[^<]*<\/a:t>/, `<a:t>${bullets}</a:t>`);
      newBlock = newBlock.replace(firstRun[0], newRun);
      xml = xml.replace(targetBlock, newBlock);
    }
  }

  return xml;
}

function replaceSummaryNumbers(slideXml, sections, summary) {
  let xml = slideXml;
  const spBlocks = xml.match(/<p:sp>[\s\S]*?<\/p:sp>/g) || [];

  for (const block of spBlocks) {
    const offMatch = block.match(/<a:off\s+x="(\d+)"\s+y="(\d+)"/);
    if (!offMatch) continue;
    const x = parseInt(offMatch[1]);
    const y = parseInt(offMatch[2]);

    const textMatch = block.match(/<a:t[^>]*>([^<]*)<\/a:t>/);
    if (!textMatch) continue;
    const text = textMatch[1].trim();
    if (!text || !/^[\d,+\-./day\s]+$/.test(text)) continue;

    for (const row of SLIDE9_ROWS) {
      if (y >= row.yMin && y <= row.yMax && x >= row.xMin && x <= row.xMax) {
        const currVal = getValue(sections, row.key, 'current');
        const formatted = currVal !== null ? fmt(currVal) : '—';
        const newBlock = block.replace(/(<a:t[^>]*>)[^<]*(<\/a:t>)/, `$1${formatted}$2`);
        xml = xml.replace(block, newBlock);
        break;
      }
    }
  }

  return xml;
}

function replaceImageInZip(zip, slideTarget, imgRId, pngBuffer) {
  // Find the image relationship in slide rels
  const slideNum = slideTarget.match(/slide(\d+)/)?.[1];
  if (!slideNum) return;
  const relsPath = `ppt/slides/_rels/slide${slideNum}.xml.rels`;
  if (!zip.files[relsPath]) return;

  // Find the target from the relationship
  const relsXml = zip.files[relsPath].async('string');
  // Actually this is async... let me handle it differently
}

// ── Main Export ──────────────────────────────────────────────────

let cachedTemplate = null;

exports.generatePptx = async (report, templatePath) => {
  const cachePath = '/tmp/opencode/template_12slide.pptx';
  await ensure12SlideTemplate(templatePath, cachePath);

  const templateBuf = fs.readFileSync(cachePath);
  const zip = await JSZip.loadAsync(templateBuf);

  const sections = report.sections || [];
  const summary = report.summary || {};
  const nepaliDate = report.nepaliDate || '';
  const engStart = report.weekStart ? new Date(report.weekStart).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '';
  const engEnd = report.weekEnd ? new Date(report.weekEnd).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '';
  const dateStr = engStart && engEnd ? `${nepaliDate} (${engStart} - ${engEnd})` : nepaliDate;

  // Get slide order from presentation.xml
  const presXml = await zip.file('ppt/presentation.xml').async('string');
  const presRelsXml = await zip.file('ppt/_rels/presentation.xml.rels').async('string');

  const rels = {};
  let m;
  const relRegex = /<Relationship\s+([^>]*)\/>/g;
  while ((m = relRegex.exec(presRelsXml)) !== null) {
    const id = m[1].match(/Id="([^"]+)"/)?.[1];
    const target = m[1].match(/Target="([^"]+)"/)?.[1];
    if (id && target) rels[id] = target;
  }

  const sldIds = [];
  const sldRegex = /<p:sldId[^>]*\/>/g;
  while ((m = sldRegex.exec(presXml)) !== null) {
    const rId = m[0].match(/r:id="([^"]+)"/)?.[1];
    if (rId) sldIds.push(rId);
  }

  const slideTargets = sldIds.map(rId => rels[rId]);

  // Process each slide
  for (let slideIdx = 0; slideIdx < slideTargets.length; slideIdx++) {
    const target = slideTargets[slideIdx];
    if (!target) continue;
    const slidePath = `ppt/${target}`;
    if (!zip.files[slidePath]) continue;

    let slideXml = await zip.files[slidePath].async('string');

    // Text replacement
    slideXml = slideReplaceValues(slideXml, sections, summary, dateStr, slideIdx, slideTargets.length);

    // Chart image replacement
    const chartDefs = CHART_POSITIONS[slideIdx];
    if (chartDefs) {
      for (const chartDef of chartDefs) {
        const deptSection = getDeptSection(sections, chartDef.dept);
        const vals = [
          getValue(sections, chartDef.key, 'prev') || 0,
          getValue(sections, chartDef.key, 'current') || 0,
          getValue(sections, chartDef.key, 'target') || 0,
        ];

        // Find image at position
        const imgRegex = /<p:pic>[\s\S]*?<\/p:pic>/g;
        let imgMatch;
        while ((imgMatch = imgRegex.exec(slideXml)) !== null) {
          const imgBlock = imgMatch[0];
          const offMatch = imgBlock.match(/<a:off\s+x="(\d+)"\s+y="(\d+)"/);
          if (!offMatch) continue;
          const ix = parseInt(offMatch[1]);
          const iy = parseInt(offMatch[2]);
          if (Math.abs(ix - chartDef.x) > 100000 || Math.abs(iy - chartDef.y) > 100000) continue;

          // Found matching image - get its rId
          const blipMatch = imgBlock.match(/r:embed="([^"]+)"/);
          if (!blipMatch) continue;
          const imgRId = blipMatch[1];

          // Find the image target in slide rels
          const slideNum = target.match(/slide(\d+)/)?.[1];
          if (!slideNum) continue;
          const slideRelsPath = `ppt/slides/_rels/slide${slideNum}.xml.rels`;

          if (zip.files[slideRelsPath]) {
            let relsXml = await zip.files[slideRelsPath].async('string');
            const imgRelMatch = relsXml.match(new RegExp(`Id="${imgRId}"[^>]*Target="([^"]+)"`));
            if (imgRelMatch) {
              const imgTarget = imgRelMatch[1];
              const imgPath = path.normalize(`ppt/slides/${imgTarget}`);

              // Generate chart image
              const barSvg = createBarChartSvg(vals, ['Previous\nWeek', 'Current\nWeek', 'Next Week\nTarget'], chartDef.title);
              const pngBuf = svgToPng(barSvg);

              // Replace image in zip
              zip.file(imgPath, pngBuf);
            }
          }

          break;
        }
      }
    }

    // Narrative replacement
    if (slideIdx === 3) slideXml = replaceNarrative(slideXml, sections, 'Business Development');
    if (slideIdx === 6) slideXml = replaceNarrative(slideXml, sections, 'Listing');
    if (slideIdx === 9) slideXml = replaceNarrative(slideXml, sections, 'Quality Control');

    // Summary numbers on closure slide
    if (slideIdx === 11) slideXml = replaceSummaryNumbers(slideXml, sections, summary);

    zip.file(slidePath, slideXml);
  }

  return zip.generateAsync({ type: 'nodebuffer' });
};

exports.generatePdf = async (report) => {
  const PDFDocument = require('pdfkit');
  const doc = new PDFDocument({ margin: 30, size: 'A4' });
  const buffers = [];
  doc.on('data', b => buffers.push(b));

  const sections = report.sections || [];
  const summary = report.summary || {};
  const dateStr = report.nepaliDate || '';

  const bd = getDeptSection(sections, 'Business Development');
  const listing = getDeptSection(sections, 'Listing');
  const qc = getDeptSection(sections, 'Quality Control');

  doc.fontSize(26).fillColor('#B41531').font('Helvetica-Bold')
    .text('Nepalcan.com', { align: 'center' }).moveDown(0.3);
  doc.fontSize(16).fillColor('#333333').font('Helvetica-Bold')
    .text('Weekly Review', { align: 'center' }).moveDown(0.2);
  doc.fontSize(12).fillColor('#666666').font('Helvetica')
    .text('Department-Wise Performance Analysis', { align: 'center' }).moveDown(0.3);
  doc.fontSize(12).fillColor('#333333').font('Helvetica')
    .text(dateStr, { align: 'center' }).moveDown(2);

  const depts = [
    { name: 'Business Development', section: bd },
    { name: 'Listing', section: listing },
    { name: 'Quality Control', section: qc },
  ];

  for (const dept of depts) {
    if (!dept.section) continue;
    doc.addPage();
    doc.fontSize(16).fillColor('#B41531').font('Helvetica-Bold')
      .text(dept.name).moveDown(0.3);

    const ml = doc.page.margins.left;
    const pw = doc.page.width - ml - doc.page.margins.right;

    const hdrY = doc.y;
    const cwFlex = pw - 78 - 78 - 78;
    const colWs = [cwFlex, 78, 78, 78];
    ['Metric', 'Previous', 'Current', 'Target'].forEach((h, i) => {
      const cx = i === 0 ? ml : ml + cwFlex + 78 * (i - 1);
      doc.rect(cx, hdrY, colWs[i], 12).fill('#EF4444');
      doc.fillColor('#FFFFFF').fontSize(8).font('Helvetica-Bold')
        .text(h, cx + 2, hdrY + 2, { width: colWs[i] - 4, align: i === 0 ? 'left' : 'right' });
    });
    doc.y = hdrY + 12;

    for (const val of dept.section.values) {
      const rowY = doc.y;
      const items = [val.headingName, fmt(val.previousValue), fmt(val.currentValue), fmt(val.targetValue)];
      items.forEach((text, i) => {
        const cx = i === 0 ? ml : ml + cwFlex + 78 * (i - 1);
        if (i === 2) doc.fillColor('#FEF2F2').rect(cx, rowY, colWs[i], 14).fill();
        doc.fillColor(i === 0 ? '#1F1F24' : i === 3 ? '#EA580C' : '#64748B')
          .fontSize(8).font('Helvetica')
          .text(text, cx + 2, rowY + 2, { width: colWs[i] - 4, align: i === 0 ? 'left' : 'right' });
      });
      doc.y = rowY + 14;
    }

    if (dept.section.notes) {
      doc.moveDown(0.3);
      doc.fontSize(10).fillColor('#333333').font('Helvetica');
      for (const line of dept.section.notes.split('\n').filter(Boolean)) {
        doc.text(`  •  ${line.trim()}`, { indent: 15 });
      }
    }
  }

  doc.addPage();
  doc.fontSize(20).fillColor('#B41531').font('Helvetica-Bold')
    .text('Report Closure', { align: 'center' }).moveDown(0.5);
  doc.fontSize(24).fillColor('#333333').font('Helvetica-Bold')
    .text('Thank You', { align: 'center' }).moveDown(1.5);

  const kpis = [
    { label: 'Total Vendors', key: 'totalVendors' },
    { label: 'Marketplace Products', key: 'totalMarketplaceProducts' },
    { label: 'Daily Avg Listings', key: 'dailyAverageListings' },
  ];
  const kpiX = [40, 105, 170];
  kpis.forEach((item, i) => {
    const val = summary[item.key] || getValue(sections, item.key, 'current') || 0;
    doc.rect(kpiX[i], doc.y, 60, 35).stroke('#CCCCCC');
    doc.fontSize(18).fillColor('#333333').font('Helvetica-Bold')
      .text(fmt(val), kpiX[i], doc.y + 5, { width: 60, align: 'center' });
    doc.fontSize(7).fillColor('#666666').font('Helvetica-Bold')
      .text(item.label, kpiX[i], doc.y + 23, { width: 60, align: 'center' });
  });

  doc.end();
  return new Promise(resolve => {
    doc.on('end', () => resolve(Buffer.concat(buffers)));
  });
};
