const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema({
  business_name: {
    type: String,
    required: [true, 'Please provide business name'],
    trim: true
  },
  contact_person: {
    type: String,
    required: [true, 'Please provide contact person name'],
    trim: true
  },
  phone: {
    type: String,
    required: [true, 'Please provide phone number']
  },
  email: {
    type: String,
    required: false,
    default: 'TBD',
    lowercase: true,
    trim: true
  },
  category: {
    type: String,
    required: [true, 'Please provide category']
  },
  location: {
    type: String,
    required: [true, 'Please provide location']
  },
  lead_source: {
    type: String,
    required: [true, 'Please provide lead source']
  },
  assigned_user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  assignment_status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected'],
    default: 'accepted'
  },
  creator_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  expected_product_count: {
    type: Number,
    default: 0
  },
  expected_monthly_sales: {
    type: Number,
    default: 0
  },
  lead_status: {
    type: String,
    enum: [
      'New', 'Contacted', 'Interested', 'Meeting Scheduled', 
      'Negotiation', 'Document Pending', 'Verification', 
      'Onboarding', 'Activated', 'Active Seller', 'Lost'
    ],
    default: 'New'
  },
  drop_reason: {
    type: String,
    enum: [
      'Price Too High', 
      'Not Interested', 
      'Already Using Competitor', 
      'Business Closed', 
      'Invalid Contact', 
      'Technical Barriers',
      'Other'
    ],
    default: null
  },
  drop_date: {
    type: Date,
    default: null
  },
  lead_score: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  converted_at: {
    type: Date,
    default: null
  },
  notes: {
    type: String,
    trim: true
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

// Update updated_at on every save
leadSchema.pre('save', function() {
  this.updated_at = Date.now();
});

// Lead Scoring Algorithm (0-100)
leadSchema.methods.calculateLeadScore = function() {
  let score = 0;
  
  // 1. Expected Monthly Sales (0-30 points)
  if (this.expected_monthly_sales >= 100000) score += 30;
  else if (this.expected_monthly_sales >= 50000) score += 20;
  else if (this.expected_monthly_sales >= 20000) score += 15;
  else if (this.expected_monthly_sales > 0) score += 10;

  // 2. Expected Product Count (0-25 points)
  if (this.expected_product_count >= 50) score += 25;
  else if (this.expected_product_count >= 20) score += 20;
  else if (this.expected_product_count >= 10) score += 15;
  else if (this.expected_product_count > 0) score += 10;

  // 3. Lead Status Progression (0-20 points)
  const statusScores = {
    'New': 0,
    'Contacted': 5,
    'Interested': 10,
    'Meeting Scheduled': 15,
    'Negotiation': 18,
    'Document Pending': 20,
    'Verification': 22,
    'Onboarding': 25,
    'Activated': 30,
    'Active Seller': 30,
    'Lost': -20
  };
  score += statusScores[this.lead_status] || 0;

  // 4. Engagement (Activity Count) - fetched separately via virtual
  // This will be added when activities are populated

  // 5. Category Bonus (0-10 points)
  const premiumCategories = ['Electronics', 'Fashion', 'Home & Living'];
  if (premiumCategories.includes(this.category)) score += 10;

  // 6. Lead Source Quality (0-10 points)
  const sourceScores = {
    'Referral': 10,
    'Partner': 8,
    'Website': 6,
    'Social Media': 5,
    'Cold Call': 3,
    'Other': 2
  };
  score += sourceScores[this.lead_source] || 0;

  // Ensure score stays within 0-100
  return Math.max(0, Math.min(100, score));
};

// Virtual field to get priority label
leadSchema.virtual('priority').get(function() {
  if (this.lead_score >= 70) return 'Hot';
  if (this.lead_score >= 40) return 'Warm';
  return 'Cold';
});

leadSchema.set('toJSON', { virtuals: true });
leadSchema.set('toObject', { virtuals: true });

const Lead = mongoose.model('Lead', leadSchema);
module.exports = Lead;
