const mongoose = require('mongoose');

const vendorSchema = new mongoose.Schema({
  lead_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lead',
    required: [true, 'Please provide lead ID']
  },
  business_details: {
    legal_name: String,
    tax_id: String,
    office_address: String,
    registration_type: String
  },
  pan_vat: {
    number: String,
    document_url: String
  },
  document_status: {
    type: String,
    enum: ['pending', 'submitted', 'verified', 'rejected'],
    default: 'pending'
  },
  verification_status: {
    type: String,
    enum: ['pending', 'verified', 'rejected'],
    default: 'pending'
  },
  pickup_address: {
    address: String,
    city: String,
    state: String,
    zip_code: String,
    contact_person: String,
    phone: String
  },
  bank_details: {
    bank_name: String,
    account_number: String,
    account_holder: String,
    branch: String,
    ifsc_code: String
  },
  onboarding_stage: {
    type: String,
    enum: [
      'documents_pending', 'documents_submitted', 'verification_pending', 
      'verified', 'account_created', 'product_upload_pending', 
      'product_review_pending', 'seller_activated'
    ],
    default: 'documents_pending'
  },
  onboarding_completion_percentage: {
    type: Number,
    default: 0
  },
  activation_status: {
    type: String,
    enum: ['inactive', 'active', 'dormant'],
    default: 'inactive'
  },
  first_order_date: {
    type: Date,
    default: null
  },
  last_order_date: {
    type: Date,
    default: null
  },
  total_products_listed: {
    type: Number,
    default: 0
  },
  order_frequency: {
    type: String,
    enum: ['high', 'medium', 'low', 'none'],
    default: 'none'
  },
  created_at: {
    type: Date,
    default: Date.now
  },
  updated_at: {
    type: Date,
    default: Date.now
  }
});

vendorSchema.pre('save', function() {
  this.updated_at = Date.now();
});

const Vendor = mongoose.model('Vendor', vendorSchema);
module.exports = Vendor;
