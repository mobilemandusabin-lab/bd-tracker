const WeeklyReport = require('../models/WeeklyReport');
const VendorSnapshot = require('../models/VendorSnapshot');
const ListingSnapshot = require('../models/ListingSnapshot');
const ExtensionEvent = require('../models/ExtensionEvent');
const ReportHeading = require('../models/ReportHeading');
const Department = require('../models/Department');
const path = require('path');
const { toNepaliDateObject } = require('../utils/nepaliDate');
const { generatePptx, generatePdf } = require('../services/reportGenerationService');

const TEMPLATE_PPTX = path.join(__dirname, '../../..', 'NEPALCAN.COM-2026-WK-20 (1).pptx');

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

    const [vendorSnap, listingSnap, lastReport, departments, headings, qcCounts, qcLatestPending, qcCountsPrev] = await Promise.all([
      VendorSnapshot.findOne({ type: 'weekly' }).sort({ snapshotDate: -1 }),
      ListingSnapshot.findOne({ type: 'weekly' }).sort({ snapshotDate: -1 }),
      WeeklyReport.findOne({ status: 'published' }).sort({ weekStart: -1 }),
      Department.find().sort({ name: 1 }),
      ReportHeading.find().sort({ departmentId: 1, order: 1 }),
      ExtensionEvent.aggregate([
        {
          $match: {
            created_at: { $gte: range.weekStart, $lte: range.weekEnd },
            event_type: { $in: ['qc_approved', 'qc_rejected'] },
            product_id: { $ne: 'b' }
          }
        },
        { $group: { _id: '$event_type', count: { $sum: { $ifNull: ['$bulk_count', 1] } } } }
      ]),
      ExtensionEvent.findOne({
        event_type: 'qc_pending',
        created_at: { $gte: range.weekStart, $lte: range.weekEnd }
      }).sort({ created_at: -1 }).select('pending_count').lean(),
      ExtensionEvent.aggregate([
        {
          $match: {
            created_at: {
              $gte: new Date(range.weekStart.getTime() - 7 * 86400000),
              $lte: new Date(range.weekEnd.getTime() - 7 * 86400000)
            },
            event_type: { $in: ['qc_approved', 'qc_rejected'] },
            product_id: { $ne: 'b' }
          }
        },
        { $group: { _id: '$event_type', count: { $sum: { $ifNull: ['$bulk_count', 1] } } } }
      ])
    ]);

    const qcMap = {};
    for (const item of qcCounts) qcMap[item._id] = item.count;
    const qcValues = {
      productsApproved: qcMap.qc_approved || 0,
      productsRejected: qcMap.qc_rejected || 0,
      productsPending: qcLatestPending?.pending_count ?? 0
    };
    const qcMapPrev = {};
    for (const item of qcCountsPrev) qcMapPrev[item._id] = item.count;
    const qcValuesPrev = {
      productsApproved: qcMapPrev.qc_approved || 0,
      productsRejected: qcMapPrev.qc_rejected || 0
    };

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

        if (h.key in qcValues) {
          currValue = qcValues[h.key];
        }
        if (h.key in qcValuesPrev) {
          prevValue = qcValuesPrev[h.key] ?? lastValues[h.key] ?? null;
        } else if (currValue === null && prevValue !== null) {
          currValue = prevValue;
        }

        const targetValue =
          h.key === 'productsApproved'
            ? listingSnap?.targets?.qcApproved ?? null
            : h.key === 'productsRejected'
              ? listingSnap?.targets?.qcRejected ?? null
              : h.key === 'productsPending'
                ? listingSnap?.targets?.totalListings ?? null
                : vendorSnap?.targets?.[h.key] ??
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

    const buffer = await generatePptx(report.toObject(), TEMPLATE_PPTX);

    const filename = `${report.title.replace(/\s+/g, '_')}.pptx`;
    res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
    res.set('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
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

    const buffer = await generatePdf(report.toObject());

    const filename = `${report.title.replace(/\s+/g, '_')}.pdf`;
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};
