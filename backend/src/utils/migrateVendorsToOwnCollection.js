/**
 * Migration script: Move vendors from leads collection to vendors collection
 * with complete independence (no lead_id connection)
 * Run with: node src/utils/migrateVendorsToOwnCollection.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Lead = require('../models/Lead');
const Activity = require('../models/Activity');
const { getVendorModel } = require('../models/Vendor');

const VENDOR_STATUSES = ['Document Pending', 'Verification', 'Onboarding', 'Activated', 'Active Seller', 'Lost', 'Self Registered'];

const migrateVendors = async () => {
  try {
    // Connect to main DB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB...');
    
    // Get vendors DB model
    const Vendor = await getVendorModel();
    
    // Find all leads with vendor statuses
    const leads = await Lead.find({ lead_status: { $in: VENDOR_STATUSES } });
    console.log(`Found ${leads.length} leads with vendor statuses to migrate`);
    
    let migratedCount = 0;
    let activityMigratedCount = 0;
    
    for (const lead of leads) {
      // Check if vendor already exists
      const existingVendor = await Vendor.findOne({ lead_id: lead._id });
      if (existingVendor) {
        console.log(`Vendor already exists for: ${lead.business_name}`);
        continue;
      }
      
      // Create vendor with all data from lead
      const vendorData = {
        business_name: lead.business_name,
        contact_person: lead.contact_person,
        phone: lead.phone,
        email: lead.email,
        location: lead.location,
        category: lead.category,
        lead_source: lead.lead_source,
        notes: lead.notes,
        lead_id: lead._id, // Keep reference to original lead for activity migration
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
        converted_at: lead.converted_at,
        created_at: lead.created_at,
        updated_at: lead.updated_at
      };
      
      const newVendor = await Vendor.create(vendorData);
      console.log(`Created vendor: ${lead.business_name} (${lead.lead_status})`);
      migratedCount++;
      
      // Migrate activities - create new activities linked to vendor_id
      const leadActivities = await Activity.find({ lead_id: lead._id });
      for (const activity of leadActivities) {
        await Activity.create({
          vendor_id: newVendor._id,
          user_id: activity.user_id,
          activity_type: activity.activity_type,
          description: activity.description,
          follow_up_required: activity.follow_up_required,
          follow_up_date: activity.follow_up_date,
          follow_up_time: activity.follow_up_time,
          status: activity.status,
          created_at: activity.created_at
        });
        activityMigratedCount++;
      }
      
      // Optionally: Delete the original lead after successful migration
      // await Lead.findByIdAndDelete(lead._id);
    }
    
    console.log(`\n=== Migration Summary ===`);
    console.log(`Vendors created: ${migratedCount}`);
    console.log(`Activities migrated: ${activityMigratedCount}`);
    
    console.log('\nTo complete migration and delete leads from main collection, uncomment the delete lines in the script.');
    console.log('IMPORTANT: Backup your database before running destructive operations.');
    
    process.exit(0);
  } catch (err) {
    console.error('Migration error:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
};

migrateVendors();