const Finance = require('../models/Finance');
const NepalcanOrder = require('../models/NepalcanOrder');
const axios = require('axios');

// GET /finance — list with filters, search, pagination
exports.getAllFinance = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      search,
      delivery_type,
      vendor_name,
      payment_status,
      date_from,
      date_to,
      sort_by = 'delivery_date',
      sort_order = 'desc'
    } = req.query;

    const query = {};

    if (search) {
      query.$or = [
        { order_id: { $regex: search, $options: 'i' } },
        { product_name: { $regex: search, $options: 'i' } },
        { customer_name: { $regex: search, $options: 'i' } }
      ];
    }
    if (delivery_type) query.delivery_type = delivery_type;
    if (vendor_name) query.vendor_name = { $regex: vendor_name, $options: 'i' };
    if (payment_status) query.payment_status = payment_status;
    if (date_from || date_to) {
      query.delivery_date = {};
      if (date_from) query.delivery_date.$gte = new Date(date_from);
      if (date_to) query.delivery_date.$lte = new Date(date_to);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sort = { [sort_by]: sort_order === 'asc' ? 1 : -1 };

    const [records, total] = await Promise.all([
      Finance.find(query).sort(sort).skip(skip).limit(parseInt(limit)).lean(),
      Finance.countDocuments(query)
    ]);

    res.status(200).json({
      status: 'success',
      data: { records, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) }
    });
  } catch (err) {
    res.status(400).json({ status: 'fail', message: err.message });
  }
};

// GET /finance/summary — aggregate totals
exports.getSummary = async (req, res) => {
  try {
    const { date_from, date_to, delivery_type, vendor_name } = req.query;
    const match = {};
    if (delivery_type) match.delivery_type = delivery_type;
    if (vendor_name) match.vendor_name = { $regex: vendor_name, $options: 'i' };
    if (date_from || date_to) {
      match.delivery_date = {};
      if (date_from) match.delivery_date.$gte = new Date(date_from);
      if (date_to) match.delivery_date.$lte = new Date(date_to);
    }

    const [summary] = await Finance.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          total_orders: { $sum: 1 },
          total_revenue: { $sum: '$total_revenue' },
          total_profit: { $sum: '$profit' },
          total_commission: { $sum: '$commission' },
          total_tds: { $sum: '$tds' },
          total_net_payments: { $sum: '$net_payment' },
          total_delivery_costs: { $sum: '$delivery_cost_recognized' },
          avg_profit: { $avg: '$profit' },
          avg_commission: { $avg: '$commission' },
          paid_orders: { $sum: { $cond: [{ $eq: ['$payment_status', 'Paid'] }, 1, 0] } },
          pending_orders: { $sum: { $cond: [{ $eq: ['$payment_status', 'Pending'] }, 1, 0] } }
        }
      }
    ]);

    // Vendor breakdown
    const byVendor = await Finance.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$vendor_name',
          orders: { $sum: 1 },
          revenue: { $sum: '$total_revenue' },
          profit: { $sum: '$profit' },
          commission: { $sum: '$commission' }
        }
      },
      { $sort: { profit: -1 } },
      { $limit: 20 }
    ]);

    // Delivery type breakdown
    const byType = await Finance.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$delivery_type',
          orders: { $sum: 1 },
          revenue: { $sum: '$total_revenue' },
          profit: { $sum: '$profit' }
        }
      },
      { $sort: { orders: -1 } }
    ]);

    res.status(200).json({
      status: 'success',
      data: {
        summary: summary || { total_orders: 0, total_revenue: 0, total_profit: 0, total_commission: 0, total_tds: 0, total_net_payments: 0, total_delivery_costs: 0, avg_profit: 0, avg_commission: 0, paid_orders: 0, pending_orders: 0 },
        byVendor,
        byType
      }
    });
  } catch (err) {
    res.status(400).json({ status: 'fail', message: err.message });
  }
};

// GET /finance/:id
exports.getFinanceById = async (req, res) => {
  try {
    const record = await Finance.findById(req.params.id).lean();
    if (!record) return res.status(404).json({ status: 'fail', message: 'Record not found' });
    res.status(200).json({ status: 'success', data: { record } });
  } catch (err) {
    res.status(400).json({ status: 'fail', message: err.message });
  }
};

// POST /finance
exports.createFinance = async (req, res) => {
  try {
    const record = await Finance.create(req.body);
    res.status(201).json({ status: 'success', data: { record } });
  } catch (err) {
    res.status(400).json({ status: 'fail', message: err.message });
  }
};

// PATCH /finance/:id
exports.updateFinance = async (req, res) => {
  try {
    const record = await Finance.findById(req.params.id);
    if (!record) return res.status(404).json({ status: 'fail', message: 'Record not found' });

    Object.assign(record, req.body);
    record.calculateFinancials();
    await record.save();

    res.status(200).json({ status: 'success', data: { record } });
  } catch (err) {
    res.status(400).json({ status: 'fail', message: err.message });
  }
};

// DELETE /finance/:id
exports.deleteFinance = async (req, res) => {
  try {
    const record = await Finance.findByIdAndDelete(req.params.id);
    if (!record) return res.status(404).json({ status: 'fail', message: 'Record not found' });
    res.status(200).json({ status: 'success', data: null });
  } catch (err) {
    res.status(400).json({ status: 'fail', message: err.message });
  }
};

// POST /finance/bulk-import
exports.bulkImport = async (req, res) => {
  try {
    const { records } = req.body;
    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ status: 'fail', message: 'records array is required' });
    }

    const results = { created: 0, updated: 0, errors: [] };

    for (const data of records) {
      try {
        const existing = await Finance.findOne({ order_id: data.order_id });
        if (existing) {
          Object.assign(existing, data);
          existing.calculateFinancials();
          await existing.save();
          results.updated++;
        } else {
          const record = new Finance(data);
          record.calculateFinancials();
          await record.save();
          results.created++;
        }
      } catch (err) {
        results.errors.push({ order_id: data.order_id, error: err.message });
      }
    }

    res.status(200).json({ status: 'success', data: results });
  } catch (err) {
    res.status(400).json({ status: 'fail', message: err.message });
  }
};

// POST /finance/sync — auto-sync from delivered Nepalcan orders
exports.syncFromNepalcan = async (req, res) => {
  try {
    const deliveredOrders = await NepalcanOrder.find({ orderStatus: 'Delivered' }).lean();
    const results = { synced: 0, skipped: 0, errors: [] };

    for (const order of deliveredOrders) {
      try {
        // Get tracking data for delivery type and charge breakdown
        let trackingData = null;
        try {
          const response = await axios.get(
            `https://can-logistic-prod-84pie.ondigitalocean.app/api/public/marketplace-tracker/${order.orderId}`
          );
          trackingData = response.data;
        } catch (err) {
          results.errors.push({ order_id: order.orderId, error: `Tracking API failed: ${err.message}` });
          results.skipped++;
          continue;
        }

        const items = trackingData?.items || order.rawData?.items || [];
        const firstItem = items[0];
        if (!firstItem) {
          results.errors.push({ order_id: order.orderId, error: 'No items found' });
          results.skipped++;
          continue;
        }

        // Extract product info — tracking API item.product is an object with productName
        const productName = typeof firstItem.product === 'object' ? firstItem.product?.productName : firstItem.product;
        const productPrice = firstItem.price || 0;

        // Extract delivery info from tracking API
        const shippingType = (trackingData?.shippingType || 'd2d').toUpperCase();
        const breakdown = trackingData?.deliveryChargeBreakdown || {};
        const deliveryChargeContribution = breakdown.vendorPickupCharge || 0;
        const costToVendor = breakdown.vendorDropCharge || 0;

        // Get delivery date from statusHistory
        const deliveredEntry = order.statusHistory?.find(h => h.status === 'Delivered');
        const deliveryDate = deliveredEntry?.timestamp || order.updatedAt;

        const financeData = {
          order_id: order.orderId,
          nepalcan_order_id: order._id,
          product_name: productName,
          product_price: productPrice,
          customer_name: order.customer || trackingData?.customerProfile?.name,
          vendor_name: order.vendor || trackingData?.vendor?.name,
          delivery_type: ['D2D', 'D2B', 'B2B'].includes(shippingType) ? shippingType : 'D2D',
          delivery_charge_contribution: deliveryChargeContribution,
          cost_to_vendor: costToVendor,
          payment_status: order.paymentStatus === 'Paid' ? 'Paid' : 'Pending',
          delivery_date: deliveryDate
        };

        const existing = await Finance.findOne({ order_id: order.orderId });
        if (existing) {
          Object.assign(existing, financeData);
          existing.calculateFinancials();
          await existing.save();
        } else {
          const record = new Finance(financeData);
          record.calculateFinancials();
          await record.save();
        }
        results.synced++;
      } catch (err) {
        results.errors.push({ order_id: order.orderId, error: err.message });
      }
    }

    res.status(200).json({ status: 'success', data: results });
  } catch (err) {
    res.status(400).json({ status: 'fail', message: err.message });
  }
};
