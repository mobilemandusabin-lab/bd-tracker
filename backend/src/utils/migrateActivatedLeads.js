/**
 * Migration script: Move activated leads to vendors database
 * Run with: node src/utils/migrateActivatedLeads.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Lead = require('../models/Lead');
const { getVendorModel } = require('../models/Vendor');
const AuditLog = require('../models/AuditLog');

const migrateActivatedLeads = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB...');
    
    // Find all leads in vendor-like stages
    const vendorStages = ['Document Pending', 'Verification', 'Onboarding', 'Activated', 'Active Seller', 'Lost'];
    const leads = await Lead.find({ lead_status: { $in: vendorStages } });
    
    console.log(`Found ${leads.length} leads to migrate to vendors database`);
    
    const Vendor = await getVendorModel();
    
    for (const lead of leads) {
      // Create vendor record
      await Vendor.create({
        lead_id: lead._id,
        business_details: {
          legal_name: lead.business_name,
        },
        onboarding_stage: lead.lead_status === 'Activated' ? 'seller_activated' : 'documents_pending',
        onboarding_completion_percentage: lead.lead_status === 'Activated' ? 100 : 0,
        activation_status: lead.lead_status === 'Activated' ? 'active' : 'inactive',
        document_status: 'pending',
        verification_status: lead.is_verified ? 'verified' : 'pending',
        total_products_listed: lead.expected_product_count || 0,
        created_at: lead.created_at,
        updated_at: new Date()
      });
      
      console.log(`Migrated: ${lead.business_name} (${lead.lead_status})`);
    }
    
    console.log(`\nMigration complete. ${leads.length} leads migrated.`);
    console.log('Run the following to delete leads from leads collection:');
    console.log('  const Lead = require("./src/models/Lead");');
    console.log('  await Lead.deleteMany({ lead_status: { $in: vendorStages } });');
    
    process.exit(0);
  } catch (err) {
    console.error('Migration error:', err.message);
    process.exit(1);
  }
};

migrateActivatedLeads();