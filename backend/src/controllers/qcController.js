const QCRecord = require('../models/QCRecord');
const Product = require('../models/Product');

// POST /qc-records - Create QC record
exports.createQCRecord = async (req, res) => {
  try {
    const { productId, status, failureReason, notes } = req.body;

    if (!productId || !status) {
      return res.status(400).json({ status: 'fail', message: 'Product and status are required' });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ status: 'fail', message: 'Product not found' });
    }

    const qcRecord = await QCRecord.create({
      productId,
      categoryId: product.categoryId,
      vendorId: product.vendorId,
      status,
      failureReason,
      notes,
      inspector: req.user._id
    });

    // Update product QC stats
    product.qcStats.total += 1;
    if (status === 'passed') {
      product.qcStats.passed += 1;
    } else {
      product.qcStats.failed += 1;
    }
    product.qcStats.passRate = product.qcStats.total > 0
      ? Math.round((product.qcStats.passed / product.qcStats.total) * 100)
      : 0;
    await product.save();

    res.status(201).json({ status: 'success', data: qcRecord });
  } catch (err) {
    console.error('Create QC record error:', err);
    res.status(500).json({ status: 'fail', message: err.message });
  }
};

// GET /qc-records - List QC records
exports.getQCRecords = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 25,
      productId,
      categoryId,
      vendorId,
      status,
      inspector,
      startDate,
      endDate,
      sort = '-inspectedAt'
    } = req.query;

    const filter = {};

    if (productId) filter.productId = productId;
    if (categoryId) filter.categoryId = categoryId;
    if (vendorId) filter.vendorId = vendorId;
    if (status) filter.status = status;
    if (inspector) filter.inspector = inspector;

    if (startDate || endDate) {
      filter.inspectedAt = {};
      if (startDate) filter.inspectedAt.$gte = new Date(startDate);
      if (endDate) filter.inspectedAt.$lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [records, total] = await Promise.all([
      QCRecord.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .populate('productId', 'name sku')
        .populate('categoryId', 'name pathString')
        .populate('vendorId', 'business_name')
        .populate('inspector', 'name')
        .lean(),
      QCRecord.countDocuments(filter)
    ]);

    res.status(200).json({
      status: 'success',
      data: records,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    res.status(500).json({ status: 'fail', message: err.message });
  }
};

// GET /qc-records/stats - QC statistics
exports.getQCStats = async (req, res) => {
  try {
    const { categoryId, vendorId, startDate, endDate } = req.query;

    const match = {};
    if (categoryId) match.categoryId = categoryId;
    if (vendorId) match.vendorId = vendorId;
    if (startDate || endDate) {
      match.inspectedAt = {};
      if (startDate) match.inspectedAt.$gte = new Date(startDate);
      if (endDate) match.inspectedAt.$lte = new Date(endDate);
    }

    const [overall, byCategory, byVendor, byFailureReason] = await Promise.all([
      // Overall stats
      QCRecord.aggregate([
        { $match: match },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]),

      // By category
      QCRecord.aggregate([
        { $match: match },
        {
          $lookup: {
            from: 'categories',
            localField: 'categoryId',
            foreignField: '_id',
            as: 'category'
          }
        },
        { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: {
              categoryId: '$categoryId',
              categoryName: '$category.name',
              categoryPath: '$category.pathString'
            },
            total: { $sum: 1 },
            passed: { $sum: { $cond: [{ $eq: ['$status', 'passed'] }, 1, 0] } },
            failed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } }
          }
        },
        {
          $project: {
            categoryId: '$_id.categoryId',
            categoryName: '$_id.categoryName',
            categoryPath: '$_id.categoryPath',
            total: 1,
            passed: 1,
            failed: 1,
            passRate: {
              $cond: [
                { $gt: ['$total', 0] },
                { $round: [{ $multiply: [{ $divide: ['$passed', '$total'] }, 100] }, 1] },
                0
              ]
            }
          }
        },
        { $sort: { total: -1 } }
      ]),

      // By vendor
      QCRecord.aggregate([
        { $match: match },
        {
          $lookup: {
            from: 'leads',
            localField: 'vendorId',
            foreignField: '_id',
            as: 'vendor'
          }
        },
        { $unwind: { path: '$vendor', preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: {
              vendorId: '$vendorId',
              vendorName: '$vendor.business_name'
            },
            total: { $sum: 1 },
            passed: { $sum: { $cond: [{ $eq: ['$status', 'passed'] }, 1, 0] } },
            failed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } }
          }
        },
        {
          $project: {
            vendorId: '$_id.vendorId',
            vendorName: '$_id.vendorName',
            total: 1,
            passed: 1,
            failed: 1,
            passRate: {
              $cond: [
                { $gt: ['$total', 0] },
                { $round: [{ $multiply: [{ $divide: ['$passed', '$total'] }, 100] }, 1] },
                0
              ]
            }
          }
        },
        { $sort: { total: -1 } }
      ]),

      // Top failure reasons
      QCRecord.aggregate([
        { $match: { ...match, status: 'failed', failureReason: { $exists: true, $ne: null } } },
        {
          $group: {
            _id: '$failureReason',
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ])
    ]);

    // Process overall stats
    const overallStats = {
      total: 0,
      passed: 0,
      failed: 0,
      passRate: 0
    };
    overall.forEach(item => {
      overallStats.total += item.count;
      if (item._id === 'passed') overallStats.passed = item.count;
      if (item._id === 'failed') overallStats.failed = item.count;
    });
    overallStats.passRate = overallStats.total > 0
      ? Math.round((overallStats.passed / overallStats.total) * 100)
      : 0;

    res.status(200).json({
      status: 'success',
      data: {
        overall: overallStats,
        byCategory,
        byVendor,
        topFailureReasons: byFailureReason.map(f => ({ reason: f._id, count: f.count }))
      }
    });
  } catch (err) {
    res.status(500).json({ status: 'fail', message: err.message });
  }
};

// GET /categories/:id/qc-stats - QC stats for a specific category
exports.getCategoryQCStats = async (req, res) => {
  try {
    const categoryId = req.params.id;

    const stats = await QCRecord.aggregate([
      { $match: { categoryId: categoryId } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const result = {
      total: 0,
      passed: 0,
      failed: 0,
      passRate: 0
    };

    stats.forEach(item => {
      result.total += item.count;
      if (item._id === 'passed') result.passed = item.count;
      if (item._id === 'failed') result.failed = item.count;
    });

    result.passRate = result.total > 0
      ? Math.round((result.passed / result.total) * 100)
      : 0;

    res.status(200).json({ status: 'success', data: result });
  } catch (err) {
    res.status(500).json({ status: 'fail', message: err.message });
  }
};
