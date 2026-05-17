const mongoose = require('mongoose');
const Lead = require('../models/Lead');
const { getVendorModel } = require('../models/Vendor');

require('dotenv').config();

async function moveVendorsToLeads() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to main database');

    const Vendor = await getVendorModel();
    console.log('Connected to vendors database');

    const vendors = await Vendor.find({ assigned_user: { $exists: true, $ne: null } });
    console.log(`Found ${vendors.length} assigned vendors to move`);

    for (const vendor of vendors) {
      await Lead.create({
        business_name: vendor.business_name,
        contact_person: vendor.contact_person,
        phone: vendor.phone,
        email: vendor.email,
        category: vendor.category,
        location: vendor.location,
        lead_source: vendor.lead_source,
        assigned_user: vendor.assigned_user,
        assignment_status: vendor.assignment_status,
        creator_id: vendor.creator_id,
        expected_product_count: vendor.expected_product_count,
        expected_monthly_sales: vendor.expected_monthly_sales,
        lead_status: vendor.lead_status,
        notes: vendor.notes,
        nepalcanId: vendor.nepalcanId,
        is_verified: vendor.is_verified,
        lead_score: vendor.lead_score,
        converted_at: vendor.converted_at,
        drop_reason: vendor.drop_reason,
        drop_date: vendor.drop_date,
        type: 'vendor'
      });
      console.log(`Moved vendor: ${vendor.business_name}`);
    }

    console.log('Move complete');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

moveVendorsToLeads();