const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const WeeklyReport = require('../models/WeeklyReport');
const VendorSnapshot = require('../models/VendorSnapshot');
const ListingSnapshot = require('../models/ListingSnapshot');
const ReportHeading = require('../models/ReportHeading');
const Department = require('../models/Department');
const { toNepaliDateObject } = require('../utils/nepaliDate');

exports.getReports = async (req, res) => {
  try {
    const { status, limit = 20, page = 1 } = req.query;
    const query = {};
    if (status) query.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [reports, total] = await Promise.all([
      WeeklyReport.find(query)
        .populate('createdBy', 'name')
        .populate('lastEditedBy', 'name')
        .sort({ weekStart: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      WeeklyReport.countDocuments(query)
    ]);

    res.status(200).json({
      status: 'success',
      data: { reports, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) }
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

exports.getReport = async (req, res) => {
  try {
    const report = await WeeklyReport.findById(req.params.id)
      .populate('createdBy', 'name')
      .populate('lastEditedBy', 'name');
    if (!report) {
      return res.status(404).json({ status: 'fail', message: 'Report not found' });
    }
    res.status(200).json({ status: 'success', data: report });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

function getWeekRange(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const satOffset = day === 6 ? 0 : -(day + 1);
  const sat = new Date(d);
  sat.setDate(d.getDate() + satOffset);
  sat.setHours(0, 0, 0, 0);

  const fri = new Date(sat);
  fri.setDate(sat.getDate() + 6);
  fri.setHours(23, 59, 59, 999);

  return { weekStart: sat, weekEnd: fri };
}

exports.getAutoFill = async (req, res) => {
  try {
    const { weekStart, weekEnd } = req.query;
    const range = weekStart && weekEnd
      ? { weekStart: new Date(weekStart), weekEnd: new Date(weekEnd) }
      : getWeekRange();

    const [vendorSnap, listingSnap, lastReport, departments, headings] = await Promise.all([
      VendorSnapshot.findOne({ type: 'weekly' }).sort({ snapshotDate: -1 }),
      ListingSnapshot.findOne({ type: 'weekly' }).sort({ snapshotDate: -1 }),
      WeeklyReport.findOne({ status: 'published' }).sort({ weekStart: -1 }),
      Department.find().sort({ name: 1 }),
      ReportHeading.find().sort({ departmentId: 1, order: 1 })
    ]);

    const bsDate = toNepaliDateObject(range.weekStart);
    const bsEnd = toNepaliDateObject(range.weekEnd);
    const nepaliDateStr = `${bsDate.formatted} - ${bsEnd.formatted}`;

    const lastValues = {};
    if (lastReport) {
      for (const section of lastReport.sections) {
        for (const val of section.values) {
          lastValues[val.headingKey] = val.currentValue;
        }
      }
    }

    const sections = [];
    for (const dept of departments) {
      const deptHeadings = headings.filter(h => h.departmentId.toString() === dept._id.toString());
      const values = deptHeadings.map(h => {
        let prevValue = lastValues[h.key] ?? null;
        let currValue = null;

        if (vendorSnap && h.key in vendorSnap) {
          currValue = vendorSnap[h.key];
        } else if (listingSnap && h.key in listingSnap) {
          currValue = listingSnap[h.key];
        }

        if (currValue === null && prevValue !== null) {
          currValue = prevValue;
        }

        const targetValue =
          vendorSnap?.targets?.[h.key] ??
          listingSnap?.targets?.[h.key] ??
          null;

        return {
          headingId: h._id,
          headingName: h.name,
          headingKey: h.key,
          previousValue: prevValue,
          currentValue: currValue,
          targetValue
        };
      });

      if (values.length > 0) {
        sections.push({
          departmentId: dept._id,
          departmentName: dept.name,
          order: 0,
          notes: '',
          values
        });
      }
    }

    const summary = {
      totalVendors: vendorSnap?.totalVendors || sections.reduce((a, s) => {
        const v = s.values.find(v => v.headingKey === 'totalVendors');
        return v?.currentValue || a;
      }, 0),
      totalVerifiedVendors: vendorSnap?.verifiedVendors || 0,
      totalMarketplaceProducts: listingSnap?.totalMarketplaceProducts || 0,
      dailyAverageListings: listingSnap?.dailyAverageListings || 0
    };

    res.status(200).json({
      status: 'success',
      data: {
        weekStart: range.weekStart,
        weekEnd: range.weekEnd,
        nepaliDate: nepaliDateStr,
        sections,
        summary
      }
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

exports.createReport = async (req, res) => {
  try {
    const { weekStart, weekEnd, nepaliDate, title, sections, summary } = req.body;

    if (!weekStart || !weekEnd) {
      return res.status(400).json({ status: 'fail', message: 'weekStart and weekEnd are required' });
    }

    const existing = await WeeklyReport.findOne({
      weekStart: new Date(weekStart),
      weekEnd: new Date(weekEnd)
    });
    if (existing) {
      return res.status(400).json({ status: 'fail', message: 'Report for this week already exists' });
    }

    const bsDate = toNepaliDateObject(new Date(weekStart));
    const report = await WeeklyReport.create({
      weekStart: new Date(weekStart),
      weekEnd: new Date(weekEnd),
      nepaliDate: nepaliDate || bsDate.formatted,
      nepaliYear: bsDate.year,
      nepaliMonth: bsDate.month,
      title: title || `Weekly Report ${nepaliDate || bsDate.formatted}`,
      status: 'published',
      createdBy: req.user._id,
      lastEditedBy: req.user._id,
      sections: sections || [],
      summary: summary || {}
    });

    res.status(201).json({ status: 'success', data: report });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

exports.updateReport = async (req, res) => {
  try {
    const report = await WeeklyReport.findById(req.params.id);
    if (!report) {
      return res.status(404).json({ status: 'fail', message: 'Report not found' });
    }

    const { title, sections, summary, status } = req.body;
    if (title !== undefined) report.title = title;
    if (sections !== undefined) report.sections = sections;
    if (summary !== undefined) report.summary = summary;
    if (status !== undefined) report.status = status;
    report.lastEditedBy = req.user._id;

    await report.save();
    res.status(200).json({ status: 'success', data: report });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

exports.deleteReport = async (req, res) => {
  try {
    const report = await WeeklyReport.findByIdAndDelete(req.params.id);
    if (!report) {
      return res.status(404).json({ status: 'fail', message: 'Report not found' });
    }
    res.status(200).json({ status: 'success', message: 'Report deleted' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

const TEMPLATE_PPTX = path.join(__dirname, '../../..', 'NEPALCAN.COM-2026-WK-20 (1).pptx');
const TEMPLATE_12SLIDE = '/tmp/opencode/template_12slide.pptx';
const PYTHON_SCRIPT = path.join(__dirname, '../../..', 'scripts', 'generate_pptx_report.py');

function ensure12SlideTemplate() {
  if (!fs.existsSync(TEMPLATE_12SLIDE)) {
    const dir = path.dirname(TEMPLATE_12SLIDE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const result = require('child_process').spawnSync('python3', [
      '-c', `
import sys; sys.path.insert(0, '${path.dirname(PYTHON_SCRIPT)}')
from generate_pptx_report import build_12slide_template
build_12slide_template('${TEMPLATE_PPTX}', '${TEMPLATE_12SLIDE}')
      `
    ], { stdio: 'pipe' });
    if (result.status !== 0) {
      console.error('Failed to build 12-slide template:', result.stderr?.toString() || result.error?.message || 'Unknown error');
      throw new Error('12-slide template build failed');
    }
  }
}

const REQUIRED_SECTIONS = {
  'Business Development': ['totalVendors', 'verifiedVendors'],
  'Listing': ['totalMarketplaceProducts', 'dailyAverageListings', 'backlogProducts', 'totalSpecificationsAdded', 'specificationCompletionPercent'],
  'Quality Control': ['productsApproved', 'productsRejected', 'productsPending'],
};

function checkReportReadiness(report) {
  const missing = [];

  for (const [deptName, headingKeys] of Object.entries(REQUIRED_SECTIONS)) {
    const section = report.sections.find(s =>
      s.departmentName.toLowerCase().includes(deptName.toLowerCase().split(' ')[0])
    );

    if (!section) {
      missing.push({ department: deptName, error: 'Section not found in report' });
      continue;
    }

    for (const key of headingKeys) {
      const value = section.values.find(v => v.headingKey === key);
      if (!value) {
        missing.push({ department: deptName, heading: key, error: 'Heading not found in section' });
        continue;
      }
      if (value.previousValue === null || value.previousValue === undefined) {
        missing.push({ department: deptName, heading: key, field: 'previousValue' });
      }
      if (value.currentValue === null || value.currentValue === undefined) {
        missing.push({ department: deptName, heading: key, field: 'currentValue' });
      }
      if (value.targetValue === null || value.targetValue === undefined) {
        missing.push({ department: deptName, heading: key, field: 'targetValue' });
      }
    }
  }

  return { ready: missing.length === 0, missing };
}

exports.generatePptx = async (req, res) => {
  try {
    const report = await WeeklyReport.findById(req.params.id);
    if (!report) {
      return res.status(404).json({ status: 'fail', message: 'Report not found' });
    }

    const readiness = checkReportReadiness(report);
    if (!readiness.ready) {
      return res.status(400).json({
        status: 'fail',
        message: 'Report not ready for PPTX generation. Fill all required fields first.',
        missing: readiness.missing
      });
    }

    ensure12SlideTemplate();

    const [vendorSnapshots, listingSnapshots] = await Promise.all([
      VendorSnapshot.find({ type: 'weekly' }).sort({ snapshotDate: -1 }).limit(12).lean(),
      ListingSnapshot.find({ type: 'weekly' }).sort({ snapshotDate: -1 }).limit(12).lean()
    ]);

    const data = {
      template_path: TEMPLATE_12SLIDE,
      report: report.toObject(),
      vendorSnapshots: vendorSnapshots.reverse(),
      listingSnapshots: listingSnapshots.reverse(),
      use_12slide: true,
    };

    const tmpDir = '/tmp/opencode';
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const jsonPath = path.join(tmpDir, `pptx_data_${req.params.id}.json`);
    const outputPath = path.join(tmpDir, `report_${req.params.id}.pptx`);
    fs.writeFileSync(jsonPath, JSON.stringify(data));

    await new Promise((resolve, reject) => {
      const proc = spawn('python3', [PYTHON_SCRIPT, '--data', jsonPath, '--output', outputPath], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let stderr = '';
      proc.stdout.on('data', () => {});
      proc.stderr.on('data', chunk => { stderr += chunk; });
      proc.on('close', code => {
        if (code !== 0) {
          reject(new Error(`Python script exited with code ${code}: ${stderr}`));
        } else {
          resolve();
        }
      });
      proc.on('error', reject);
    });

    if (!fs.existsSync(outputPath)) {
      throw new Error('Output PPTX was not created by the Python script');
    }

    res.download(outputPath, `${report.title.replace(/\s+/g, '_')}.pptx`, () => {
      fs.unlink(jsonPath, () => {});
      fs.unlink(outputPath, () => {});
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

exports.generatePdf = async (req, res) => {
  try {
    const report = await WeeklyReport.findById(req.params.id);
    if (!report) {
      return res.status(404).json({ status: 'fail', message: 'Report not found' });
    }

    const readiness = checkReportReadiness(report);
    if (!readiness.ready) {
      return res.status(400).json({
        status: 'fail',
        message: 'Report not ready for PDF generation. Fill all required fields first.',
        missing: readiness.missing
      });
    }

    const data = {
      report: report.toObject(),
    };

    const tmpDir = '/tmp/opencode';
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const jsonPath = path.join(tmpDir, `pdf_data_${req.params.id}.json`);
    const pdfPath = path.join(tmpDir, `report_${req.params.id}.pdf`);
    fs.writeFileSync(jsonPath, JSON.stringify(data));

    await new Promise((resolve, reject) => {
      const proc = spawn('python3', [PYTHON_SCRIPT, '--data', jsonPath, '--pdf', pdfPath], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let stderr = '';
      proc.stdout.on('data', () => {});
      proc.stderr.on('data', chunk => { stderr += chunk; });
      proc.on('close', code => {
        if (code !== 0) {
          reject(new Error(`Python script exited with code ${code}: ${stderr}`));
        } else {
          resolve();
        }
      });
      proc.on('error', reject);
    });

    if (!fs.existsSync(pdfPath)) {
      throw new Error('Output PDF was not created by the Python script');
    }

    res.download(pdfPath, `${report.title.replace(/\s+/g, '_')}.pdf`, () => {
      fs.unlink(jsonPath, () => {});
      fs.unlink(pdfPath, () => {});
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};
