// models/index.js - FIXED VERSION with proper exports
const { Sequelize } = require('sequelize');
const dns = require('dns');
require('dotenv').config();

// Force IPv4 resolution globally
dns.setDefaultResultOrder('ipv4first');

let sequelize;

// Method 1: Direct connection string with enhanced options
const createSequelizeWithConnectionString = () => {
  return new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false
      },
      application_name: 'church-admin-api',
      connect_timeout: 10,
      statement_timeout: 30000,
      query_timeout: 30000,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
    },
    pool: {
      max: 3,
      min: 0,
      acquire: 10000,
      idle: 30000,
      evict: 5000,
      handleDisconnects: true
    },
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    retry: {
      max: 2
    }
  });
};

// Initialize sequelize connection
async function initializeSequelize() {
  try {
    console.log('Initializing database connection...');
    sequelize = createSequelizeWithConnectionString();
    
    // Test the connection
    await sequelize.authenticate();
    console.log('✅ Database connection established successfully');
    return sequelize;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    throw error;
  }
}

// Import Models
const Admin = require('./Admin');
const Member = require('./member');
const Attendance = require('./Attendance');
const Event = require('./Event');
const Celebration = require('./Celebration');
const MemberAttendance = require('./MemberAttendance');

// Database object
const db = {};

// Initialize models and associations
async function initializeModels() {
  try {
    if (!sequelize) {
      sequelize = await initializeSequelize();
    }
    
    // Initialize models
    db.sequelize = sequelize;
    db.Sequelize = Sequelize;
    db.Admin = Admin(sequelize, Sequelize.DataTypes);
    db.Member = Member(sequelize, Sequelize.DataTypes);
    db.Attendance = Attendance(sequelize, Sequelize.DataTypes);
    db.Event = Event(sequelize, Sequelize.DataTypes);
    db.Celebration = Celebration(sequelize, Sequelize.DataTypes);
    db.MemberAttendance = MemberAttendance(sequelize, Sequelize.DataTypes);

    // Define Associations
    db.Admin.hasMany(db.Attendance, { foreignKey: 'recordedById', as: 'recordedAttendances' });
    db.Admin.hasMany(db.Event, { foreignKey: 'organizerId', as: 'organizedEvents' });
    db.Admin.hasMany(db.Celebration, { foreignKey: 'approvedById', as: 'approvedCelebrations' });

    db.Member.hasMany(db.Celebration, { foreignKey: 'memberId', as: 'celebrations' });
    db.Member.hasMany(db.MemberAttendance, { foreignKey: 'memberId', as: 'attendances' });

    db.Attendance.belongsTo(db.Admin, { foreignKey: 'recordedById', as: 'recordedBy' });
    db.Attendance.hasMany(db.MemberAttendance, { foreignKey: 'attendanceId', as: 'memberAttendances' });

    db.Event.belongsTo(db.Admin, { foreignKey: 'organizerId', as: 'organizer' });

    db.Celebration.belongsTo(db.Member, { foreignKey: 'memberId', as: 'member' });
    db.Celebration.belongsTo(db.Admin, { foreignKey: 'approvedById', as: 'approvedBy' });

    db.MemberAttendance.belongsTo(db.Member, { foreignKey: 'memberId', as: 'member' });
    db.MemberAttendance.belongsTo(db.Attendance, { foreignKey: 'attendanceId', as: 'attendance' });

    console.log('✅ Database models initialized successfully');
    return db;
  } catch (error) {
    console.error('❌ Failed to initialize models:', error);
    throw error;
  }
}

// Export the database object and initialization function
module.exports = {
  ...db,
  initialize: initializeModels
};