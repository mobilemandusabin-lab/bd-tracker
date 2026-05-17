/**
 * Migration script: Move vendors with complete independence from leads
 * This creates vendors with all their data copied over and activities linked to vendor_id
 * 
 * Run with: node src/utils/migrateCompleteVendors.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Lead = require('../models/Lead');
const Activity = require('../models/Activity');
const { getVendorModel } = require('../models/Vendor');

const VENDOR_STATUSES = ['Document Pending', 'Verification', 'Onboarding', 'Activated', 'Active Seller', 'Lost'];

const runMigration = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB...\n');
    
    const Vendor = await getVendorModel();
    
    // Find leads with vendor statuses
    const leads = await Lead.find({ lead_status: { $in: VENDOR_STATUSES } });
    console.log(`Found ${leads.length} leads to migrate to complete vendor records\n`);
    
    let created = 0;
    let activitiesMigrated = 0;
    
    for (const lead of leads) {
      // Check if vendor already exists for this lead
      const existing = await Vendor.findOne({ lead_id: lead._id });
      if (existing) {
        console.log(`✓ Vendor exists: ${lead.business_name}`);
        continue;
      }
      
      // Create complete vendor record with all data from lead
      const vendorData = {
        business_name: lead.business_name,
        contact_person: lead.contact_person,
        phone: lead.phone,
        email: lead.email,
        location: lead.location,
        category: lead.category,
        lead_source: lead.lead_source,
        notes: lead.notes,
        lead_id: lead._id,
        assigned_user: lead.assigned_user,
        creator_id: lead.creator_id,
        assignment_status: lead.assignment_status,
        business_details: {
          legal_name: lead.business_name
        },
        lead_status: lead.lead_status,
        lead_score: lead.lead_score,
        drop_reason: lead.drop_reason,
        drop_date: lead.drop_date,
        expected_product_count: lead.expected_product_count,
        expected_monthly_sales: lead.expected_monthly_sales,
        is_verified: lead.is_verified,
        nepalcanId: lead.nepalcanId,
        converted_at: lead.converted_at || lead.created_at,
        created_at: lead.created_at,
        onboarding_stage: lead.lead_status === 'Activated' || lead.lead_status === 'Active Seller' ? 'seller_activated' : 'documents_pending',
        activation_status: lead.lead_status === 'Activated' || lead.lead_status === 'Active Seller' ? 'active' : 'inactive'
      };
      
      const vendor = await Vendor.create(vendorData);
      console.log(`✓ Created vendor: ${lead.business_name} (${lead.lead_status})`);
      created++;
      
      // Migrate activities to vendor_id
      const leadActivities = await Activity.find({ lead_id: lead._id });
      for (const act of leadActivities) {
        await Activity.create({
          vendor_id: vendor._id,
          user_id: act.user_id,
          activity_type: act.activity_type,
          description: act.description,
          follow_up_required: act.follow_up_required,
          follow_up_date: act.follow_up_date,
          follow_up_time: act.follow_up_time,
          status: act.status,
          created_at: act.created_at
        });
        activitiesMigrated++;
      }
    }
    
    console.log(`\n===============================`);
    console.log(`Migration Complete!`);
    console.log(`Vendors created: ${created}`);
    console.log(`Activities migrated: ${activitiesMigrated}`);
    console.log(`===============================`);
    
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
};

runMigration();