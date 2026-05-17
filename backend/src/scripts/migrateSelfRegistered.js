const mongoose = require('mongoose');
const Lead = require('../models/Lead');
const { getVendorModel } = require('../models/Vendor');
const Activity = require('../models/Activity');

require('dotenv').config();

async function migrateSelfRegistered() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const Vendor = await getVendorModel();

    const selfRegisteredLeads = await Lead.find({ lead_status: 'Self Registered' });
    console.log(`Found ${selfRegisteredLeads.length} Self Registered leads`);

    let created = 0;
    let skipped = 0;

    for (const lead of selfRegisteredLeads) {
      const existingVendor = await Vendor.findOne({ 
        $or: [
          { business_name: lead.business_name },
          { phone: lead.phone },
          { email: lead.email }
        ]
      });

      if (existingVendor) {
        console.log(`Skipping ${lead.business_name} - already exists as vendor`);
        skipped++;
        continue;
      }

      const vendor = await Vendor.create({
        business_name: lead.business_name,
        contact_person: lead.contact_person || 'TBD',
        phone: lead.phone || 'TBD',
        email: lead.email || 'TBD',
        location: lead.location || 'TBD',
        category: lead.category || 'Other',
        lead_source: lead.lead_source || 'Inbound',
        notes: lead.notes,
        lead_id: lead._id,
        assigned_user: lead.assigned_user,
        creator_id: lead.creator_id,
        expected_product_count: lead.expected_product_count || 0,
        expected_monthly_sales: lead.expected_monthly_sales || 0,
        lead_status: 'Self Registered',
        lead_score: lead.lead_score || 0
      });

      await Activity.create({
        vendor_id: vendor._id,
        lead_id: lead._id,
        user_id: lead.creator_id,
        activity_type: 'note',
        description: 'Migrated from Self Registered lead',
        status: 'completed'
      });

      console.log(`Created vendor: ${lead.business_name}`);
      created++;
    }

    console.log(`\nMigration complete: ${created} created, ${skipped} skipped`);
    process.exit(0);
  } catch (err) {
    console.error('Migration error:', err);
    process.exit(1);
  }
}

migrateSelfRegistered();