const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');
const Lead = require('../models/Lead');
const Activity = require('../models/Activity');
const Vendor = require('../models/Vendor');
const Task = require('../models/Task');

dotenv.config({ path: './.env' });

const seedData = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB for seeding...');

    // Clear existing data (except super admin)
    await User.deleteMany({ email: { $ne: 'sabeen684@gmail.com' } });
    await Lead.deleteMany({});
    await Activity.deleteMany({});
    await Vendor.deleteMany({});
    await Task.deleteMany({});

    console.log('Creating/Updating Super Admin...');
    // Create or Update Super Admin
    let superAdmin = await User.findOne({ email: 'sabeen684@gmail.com' });
    if (superAdmin) {
      superAdmin.password = '123456';
      superAdmin.role = 'super_admin';
      await superAdmin.save();
      console.log('Super Admin updated with new password.');
    } else {
      superAdmin = await User.create({
        name: 'Sabeen Admin',
        email: 'sabeen684@gmail.com',
        password: '123456',
        role: 'super_admin'
      });
      console.log('Super Admin created.');
    }

    console.log('Creating BD Users...');
    // Create BD Users (using 'user' role since 'bd' is not in enum)
    const bdUsers = await User.create([
      {
        name: 'Ram Sharma',
        email: 'ram@test.com',
        password: '123456',
        role: 'user'
      },
      {
        name: 'Sita Patel',
        email: 'sita@test.com',
        password: '123456',
        role: 'user'
      },
      {
        name: 'Hari Thapa',
        email: 'hari@test.com',
        password: '123456',
        role: 'user'
      }
    ]);

    console.log('Creating Leads...');
    // Create Leads
    const leads = await Lead.create([
      {
        business_name: 'Fashion Hub Nepal',
        contact_person: 'Amit Kumar',
        phone: '9801234567',
        email: 'amit@fashionhub.com',
        category: 'Fashion',
        location: 'Kathmandu',
        lead_source: 'Website',
        assigned_user: bdUsers[0]._id,
        assignment_status: 'accepted',
        creator_id: superAdmin._id,
        expected_product_count: 150,
        expected_monthly_sales: 80000,
        lead_status: 'Negotiation',
        lead_score: 75
      },
      {
        business_name: 'Tech Store Pvt Ltd',
        contact_person: 'Bibek Sharma',
        phone: '9812345678',
        email: 'bibek@techstore.com',
        category: 'Electronics',
        location: 'Pokhara',
        lead_source: 'Referral',
        assigned_user: bdUsers[1]._id,
        assignment_status: 'accepted',
        creator_id: superAdmin._id,
        expected_product_count: 200,
        expected_monthly_sales: 120000,
        lead_status: 'Meeting Scheduled',
        lead_score: 85
      },
      {
        business_name: 'Home Decor Plus',
        contact_person: 'Kiran Maharjan',
        phone: '9823456789',
        email: 'kiran@homedecor.com',
        category: 'Home Decor',
        location: 'Lalitpur',
        lead_source: 'Social Media',
        assigned_user: bdUsers[2]._id,
        assignment_status: 'accepted',
        creator_id: superAdmin._id,
        expected_product_count: 100,
        expected_monthly_sales: 60000,
        lead_status: 'Interested',
        lead_score: 60
      },
      {
        business_name: 'Organic Foods Nepal',
        contact_person: 'Maya Tamang',
        phone: '9834567890',
        email: 'maya@organicfoods.com',
        category: 'Groceries',
        location: 'Bhaktapur',
        lead_source: 'Cold Call',
        assigned_user: bdUsers[0]._id,
        assignment_status: 'accepted',
        creator_id: superAdmin._id,
        expected_product_count: 300,
        expected_monthly_sales: 150000,
        lead_status: 'Onboarding',
        lead_score: 90
      },
      {
        business_name: 'Sports World',
        contact_person: 'Rajesh Shrestha',
        phone: '9845678901',
        email: 'rajesh@sportsworld.com',
        category: 'Sports',
        location: 'Kathmandu',
        lead_source: 'Exhibition',
        assigned_user: bdUsers[1]._id,
        assignment_status: 'accepted',
        creator_id: superAdmin._id,
        expected_product_count: 180,
        expected_monthly_sales: 90000,
        lead_status: 'New',
        lead_score: 45
      },
      {
        business_name: 'Book Valley',
        contact_person: 'Sunita Poudel',
        phone: '9856789012',
        email: 'sunita@bookvalley.com',
        category: 'Books',
        location: 'Kathmandu',
        lead_source: 'Website',
        assigned_user: bdUsers[2]._id,
        assignment_status: 'accepted',
        creator_id: superAdmin._id,
        expected_product_count: 500,
        expected_monthly_sales: 70000,
        lead_status: 'Document Pending',
        lead_score: 70
      },
      {
        business_name: 'Beauty Palace',
        contact_person: 'Anjali Karki',
        phone: '9867890123',
        email: 'anjali@beauty.com',
        category: 'Beauty',
        location: 'Pokhara',
        lead_source: 'Referral',
        assigned_user: null,
        assignment_status: 'pending',
        creator_id: superAdmin._id,
        expected_product_count: 120,
        expected_monthly_sales: 50000,
        lead_status: 'New',
        lead_score: 40
      },
      {
        business_name: 'Gadget Zone',
        contact_person: 'Prakash Dongol',
        phone: '9878901234',
        email: 'prakash@gadgetzone.com',
        category: 'Electronics',
        location: 'Lalitpur',
        lead_source: 'Social Media',
        assigned_user: bdUsers[0]._id,
        assignment_status: 'accepted',
        creator_id: superAdmin._id,
        expected_product_count: 250,
        expected_monthly_sales: 110000,
        lead_status: 'Verification',
        lead_score: 80
      }
    ]);

    console.log('Creating Activities...');
    // Create Activities (some with follow-up dates for today)
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    await Activity.create([
      {
        lead_id: leads[0]._id,
        user_id: bdUsers[0]._id,
        activity_type: 'call',
        description: 'Discussed pricing and commission structure',
        follow_up_required: true,
        follow_up_date: today,
        follow_up_time: '10:00',
        status: 'pending'
      },
      {
        lead_id: leads[1]._id,
        user_id: bdUsers[1]._id,
        activity_type: 'meeting',
        description: 'Demo of vendor portal completed',
        follow_up_required: true,
        follow_up_date: today,
        follow_up_time: '14:00',
        status: 'pending'
      },
      {
        lead_id: leads[2]._id,
        user_id: bdUsers[2]._id,
        activity_type: 'email',
        description: 'Sent product catalog and pricing details',
        follow_up_required: false,
        status: 'completed'
      },
      {
        lead_id: leads[3]._id,
        user_id: bdUsers[0]._id,
        activity_type: 'demo',
        description: 'Warehouse inspection completed',
        follow_up_required: true,
        follow_up_date: tomorrow,
        follow_up_time: '11:00',
        status: 'pending'
      },
      {
        lead_id: leads[4]._id,
        user_id: bdUsers[1]._id,
        activity_type: 'call',
        description: 'Initial introduction call done',
        follow_up_required: false,
        status: 'completed'
      },
      {
        lead_id: leads[5]._id,
        user_id: bdUsers[2]._id,
        activity_type: 'whatsapp',
        description: 'Sent document checklist',
        follow_up_required: true,
        follow_up_date: yesterday,
        follow_up_time: '09:00',
        status: 'pending'
      }
    ]);

    console.log('Creating Vendors...');
    // Create Vendors from some leads
    await Vendor.create([
      {
        lead_id: leads[3]._id,
        user_id: bdUsers[0]._id,
        activation_status: 'active',
        first_order_date: null,
        total_products_listed: 45,
        onboarding_stage: 'product_upload_pending'
      },
      {
        lead_id: leads[7]._id,
        user_id: bdUsers[0]._id,
        activation_status: 'inactive',
        first_order_date: null,
        total_products_listed: 0,
        onboarding_stage: 'documents_pending'
      }
    ]);

    console.log('Creating Tasks...');
    // Create Tasks (today and tomorrow already defined above)
    await Task.create([
      {
        title: 'Follow up with Fashion Hub on pricing',
        description: 'Discuss the revised commission structure',
        assigned_to: bdUsers[0]._id,
        created_by: superAdmin._id,
        due_date: today,
        priority: 1,
        status: 'Open'
      },
      {
        title: 'Send agreement to Tech Store',
        description: 'Draft and send the vendor agreement',
        assigned_to: bdUsers[1]._id,
        created_by: superAdmin._id,
        due_date: tomorrow,
        priority: 2,
        status: 'Open'
      },
      {
        title: 'Complete verification for Gadget Zone',
        description: 'Verify legal documents and bank details',
        assigned_to: bdUsers[0]._id,
        created_by: superAdmin._id,
        due_date: today,
        priority: 1,
        status: 'In Progress'
      }
    ]);

    console.log('Seed data created successfully!');
    console.log('\nSuper Admin Credentials:');
    console.log('Email: sabeen684@gmail.com');
    console.log('Password: 123456');
    console.log('\nBD User Credentials:');
    bdUsers.forEach(user => {
      console.log(`Email: ${user.email}, Password: 123456`);
    });

    process.exit(0);
  } catch (err) {
    console.error('Error seeding data:', err.message);
    process.exit(1);
  }
};

seedData();
