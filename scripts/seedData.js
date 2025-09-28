// scripts/seedData.js
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { sequelize, Admin, Member, Event, Celebration } = require('../models');
const logger = require('../utils/logger');

const seedData = async () => {
  try {
    await sequelize.authenticate();
    logger.info('Database connected successfully');

    // Sync database
    await sequelize.sync({ force: false });
    logger.info('Database synced');

    // Check if admin already exists
    const existingAdmin = await Admin.findOne({ where: { email: 'admin@rccglcc.org' } });
    
    if (!existingAdmin) {
      // Create super admin
      const superAdmin = await Admin.create({
        name: 'Pastor olorunfemi Ayomide',
        email: 'olorunfemiayomide045@gmail.com',
        password: 'Ayrichie890?',
        role: 'super_admin',
        phone: '+234 903 539 3810',
        position: 'Senior Pastor',
        permissions: ['all'],
        isActive: true
      });

      logger.info('Super admin created successfully');

      // Create regular admin
      const regularAdmin = await Admin.create({
        name: 'Minister Sarah Johnson',
        email: 'sarah@rccglcc.org',
        password: 'sarah123',
        role: 'admin',
        phone: '+234 802 123 4567',
        position: 'Assistant Pastor',
        permissions: ['members', 'events', 'attendance', 'celebrations'],
        isActive: true
      });

      logger.info('Regular admin created successfully');

      // Create sample members
      const sampleMembers = [
        {
          name: 'Brother Michael Adebayo',
          email: 'michael@gmail.com',
          phone: '+234 801 234 5678',
          address: '15 Victoria Street, Lekki, Lagos',
          dateOfBirth: '1985-03-15',
          gender: 'Male',
          maritalStatus: 'Married',
          occupation: 'Software Engineer',
          department: 'Technical Unit',
          membershipDate: '2020-01-15',
          isActive: true,
          emergencyContactName: 'Mrs. Adebayo',
          emergencyContactPhone: '+234 802 345 6789',
          emergencyContactRelationship: 'Wife'
        },
        {
          name: 'Sister Grace Okafor',
          email: 'grace@yahoo.com',
          phone: '+234 803 456 7890',
          address: '22 Allen Avenue, Ikeja, Lagos',
          dateOfBirth: '1990-08-22',
          gender: 'Female',
          maritalStatus: 'Single',
          occupation: 'Teacher',
          department: 'Children Ministry',
          membershipDate: '2021-06-10',
          isActive: true,
          emergencyContactName: 'Mr. Okafor',
          emergencyContactPhone: '+234 804 567 8901',
          emergencyContactRelationship: 'Father'
        },
        {
          name: 'Brother David Ogundimu',
          email: 'david@hotmail.com',
          phone: '+234 805 678 9012',
          address: '8 Admiralty Way, Lekki Phase 1, Lagos',
          dateOfBirth: '1978-12-05',
          gender: 'Male',
          maritalStatus: 'Married',
          occupation: 'Business Owner',
          department: 'Finance Committee',
          membershipDate: '2019-03-20',
          isActive: true,
          emergencyContactName: 'Mrs. Ogundimu',
          emergencyContactPhone: '+234 806 789 0123',
          emergencyContactRelationship: 'Wife'
        }
      ];

      const createdMembers = await Member.bulkCreate(sampleMembers);
      logger.info(`${createdMembers.length} sample members created`);

      // Create sample events
      const sampleEvents = [
        {
          title: 'Holy Ghost Service',
          description: 'Monthly power-packed service with supernatural encounters, divine healing, and spiritual breakthrough.',
          date: '2025-02-07',
          time: '19:00',
          endTime: '21:00',
          location: 'Main Auditorium',
          category: 'Service',
          isRecurring: true,
          recurringPattern: 'monthly',
          organizerId: superAdmin.id,
          maxAttendees: 500,
          currentAttendees: 0,
          status: 'upcoming'
        },
        {
          title: 'Youth Conference 2025',
          description: 'Annual youth conference focused on purpose, passion, and divine destiny. Join us for 3 days of impactful sessions.',
          date: '2025-03-15',
          time: '09:00',
          endTime: '17:00',
          location: 'Church Grounds',
          category: 'Conference',
          isRecurring: false,
          organizerId: regularAdmin.id,
          maxAttendees: 300,
          currentAttendees: 85,
          status: 'upcoming'
        },
        {
          title: 'Marriage Seminar',
          description: 'Building strong Christian marriages - A seminar for couples and intending couples.',
          date: '2025-02-22',
          time: '10:00',
          endTime: '16:00',
          location: 'Conference Hall',
          category: 'Seminar',
          isRecurring: false,
          organizerId: superAdmin.id,
          maxAttendees: 100,
          currentAttendees: 42,
          status: 'upcoming'
        }
      ];

      const createdEvents = await Event.bulkCreate(sampleEvents);
      logger.info(`${createdEvents.length} sample events created`);

      // Create sample celebrations
      const sampleCelebrations = [
        {
          type: 'Birthday',
          name: 'Brother Michael Adebayo',
          memberId: createdMembers[0].id,
          phone: '+234 801 234 5678',
          message: 'Thank God for another year of life and His faithfulness!',
          month: 3,
          date: 15,
          status: 'approved',
          acknowledgedDate: '2025-01-15',
          approvedById: superAdmin.id
        },
        {
          type: 'Wedding Anniversary',
          name: 'Brother & Sister David Ogundimu',
          memberId: createdMembers[2].id,
          phone: '+234 805 678 9012',
          message: '15 years of God\'s faithfulness in our marriage. To God be the glory!',
          month: 2,
          date: 14,
          status: 'pending'
        },
        {
          type: 'Graduation',
          name: 'Sister Grace Okafor',
          memberId: createdMembers[1].id,
          phone: '+234 803 456 7890',
          message: 'Completed my Master\'s degree in Education. Thank you Lord!',
          month: 1,
          date: 20,
          status: 'approved',
          acknowledgedDate: '2025-01-20',
          approvedById: regularAdmin.id
        }
      ];

      const createdCelebrations = await Celebration.bulkCreate(sampleCelebrations);
      logger.info(`${createdCelebrations.length} sample celebrations created`);

      logger.info('✅ Database seeded successfully!');
      
    } else {
      logger.info('Admin already exists, skipping seed data creation');
    }

  } catch (error) {
    logger.error('❌ Database seeding failed:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
};

// Run seeding if called directly
if (require.main === module) {
  seedData()
    .then(() => {
      console.log('✅ Seeding completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Seeding failed:', error);
      process.exit(1);
    });
}

module.exports = seedData;
