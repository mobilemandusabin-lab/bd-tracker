const PipelineStage = require('../models/PipelineStage');

async function seedDefaultPipelineStages() {
  try {
    const count = await PipelineStage.countDocuments();
    if (count > 0) {
      console.log(`[Pipeline Stages] ${count} stages already exist`);
      return;
    }

    const stages = [
      { name: 'New', category: 'lead', order: 1, color: '#3B82F6' },
      { name: 'Contacted', category: 'lead', order: 2, color: '#60A5FA' },
      { name: 'Interested', category: 'lead', order: 3, color: '#8B5CF6' },
      { name: 'Meeting Scheduled', category: 'lead', order: 4, color: '#A78BFA' },
      { name: 'Negotiation', category: 'vendor', order: 1, color: '#F59E0B' },
      { name: 'Document Pending', category: 'vendor', order: 2, color: '#FBBF24' },
      { name: 'Verification', category: 'vendor', order: 3, color: '#FCD34D' },
      { name: 'Onboarding', category: 'vendor', order: 4, color: '#BEF264' },
      { name: 'Activated', category: 'vendor', order: 5, color: '#10B981' },
      { name: 'Active Seller', category: 'vendor', order: 6, color: '#34D399' },
      { name: 'Lost', category: 'vendor', order: 7, color: '#EF4444' },
      { name: 'Self Registered', category: 'vendor', order: 8, color: '#EC4899' }
    ];

    await PipelineStage.insertMany(stages);
    console.log(`[Pipeline Stages] Seeded ${stages.length} default stages`);
  } catch (err) {
    console.error('[Pipeline Stages] Seed error:', err.message);
  }
}

module.exports = seedDefaultPipelineStages;