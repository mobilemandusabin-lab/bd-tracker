const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Role = require('../models/Role');
const { DEFAULT_ROLE_PERMISSIONS } = require('../config/permissions');

dotenv.config({ path: './.env' });

const seedRoles = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB for role seeding...');

    const roleData = [
      {
        name: 'super_admin',
        description: 'Full system access — all permissions',
        permissions: DEFAULT_ROLE_PERMISSIONS.super_admin
      },
      {
        name: 'admin',
        description: 'Administrative access — manage most features',
        permissions: DEFAULT_ROLE_PERMISSIONS.admin
      },
      {
        name: 'user',
        description: 'Standard user — manage own leads and tasks',
        permissions: DEFAULT_ROLE_PERMISSIONS.user
      },
      {
        name: 'viewer',
        description: 'Read-only access — view own data only',
        permissions: DEFAULT_ROLE_PERMISSIONS.viewer
      }
    ];

    for (const data of roleData) {
      const existing = await Role.findOne({ name: data.name });
      if (existing) {
        existing.permissions = data.permissions;
        existing.description = data.description;
        await existing.save();
        console.log(`Updated role: ${data.name} (${data.permissions.length} permissions)`);
      } else {
        await Role.create(data);
        console.log(`Created role: ${data.name} (${data.permissions.length} permissions)`);
      }
    }

    console.log('\nRole seeding complete!');
    console.log('---');
    const roles = await Role.find({});
    for (const role of roles) {
      console.log(`  ${role.name}: ${role.permissions.length} permissions`);
    }

    process.exit(0);
  } catch (err) {
    console.error('Error seeding roles:', err.message);
    process.exit(1);
  }
};

seedRoles();
