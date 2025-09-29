// models/index.js - ADVANCED IPv6 FIX VERSION
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
      // Force connection options
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

// Method 2: IPv4-only host resolution
const createSequelizeWithIPv4Host = async () => {
  const { promisify } = require('util');
  const lookup = promisify(dns.lookup);
  
  try {
    // Resolve hostname to IPv4 address
    const { address } = await lookup(process.env.DB_HOST, { family: 4 });
    console.log(`Resolved ${process.env.DB_HOST} to IPv4: ${address}`);
    
    return new Sequelize({
      host: address, // Use IPv4 address directly
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME,
      username: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      dialect: 'postgres',
      dialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized: false
        }
      },
      pool: {
        max: 3,
        min: 0,
        acquire: 10000,
        idle: 30000
      },
      logging: process.env.NODE_ENV === 'development' ? console.log : false
    });
  } catch (error) {
    console.error('Failed to resolve IPv4 address:', error);
    throw error;
  }
};

// Try connection methods in order
async function initializeSequelize() {
  const methods = [
    { name: 'Connection String', fn: createSequelizeWithConnectionString },
    { name: 'IPv4 Resolution', fn: createSequelizeWithIPv4Host },
  ];

  for (const method of methods) {
    try {
      console.log(`Trying connection method: ${method.name}`);
      sequelize = await method.fn();
      
      // Test the connection
      await sequelize.authenticate();
      console.log(`✅ Connected using: ${method.name}`);
      return sequelize;
    } catch (error) {
      console.error(`❌ ${method.name} failed:`, error.message);
      if (sequelize) {
        try { await sequelize.close(); } catch {} // Cleanup
      }
    }
  }
  
  throw new Error('All connection methods failed');
}

// Initialize sequelize
let sequelizePromise;
if (!sequelize) {
  sequelizePromise = initializeSequelize();
}

// Import Models
const Admin = require('./Admin');
const Member = require('./member');
const Attendance = require('./Attendance');
const Event = require('./Event');
const Celebration = require('./Celebration');
const MemberAttendance = require('./MemberAttendance');

// Database object that will be populated after connection
const db = {
  Sequelize,
  sequelize: null,
  Admin: null,
  Member: null,
  Attendance: null,
  Event: null,
  Celebration: null,
  MemberAttendance: null
};

// Initialize models and associations after connection is established
async function initializeModels() {
  if (!sequelize) {
    sequelize = await sequelizePromise;
  }
  
  // Initialize models
  db.sequelize = sequelize;
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

  db.Member.belongsTo(db.Member, { foreignKey: 'emergencyContactId', as: 'emergencyContact' });
  db.Member.hasMany(db.Celebration, { foreignKey: 'memberId', as: 'celebrations' });
  db.Member.hasMany(db.MemberAttendance, { foreignKey: 'memberId', as: 'attendances' });

  db.Attendance.belongsTo(db.Admin, { foreignKey: 'recordedById', as: 'recordedBy' });
  db.Attendance.hasMany(db.MemberAttendance, { foreignKey: 'attendanceId', as: 'memberAttendances' });

  db.Event.belongsTo(db.Admin, { foreignKey: 'organizerId', as: 'organizer' });

  db.Celebration.belongsTo(db.Member, { foreignKey: 'memberId', as: 'member' });
  db.Celebration.belongsTo(db.Admin, { foreignKey: 'approvedById', as: 'approvedBy' });

  db.MemberAttendance.belongsTo(db.Member, { foreignKey: 'memberId', as: 'member' });
  db.MemberAttendance.belongsTo(db.Attendance, { foreignKey: 'attendanceId', as: 'attendance' });

  return db;
}

// Export promise-based database object
module.exports = {
  ...db,
  initialize: initializeModels,
  sequelizePromise
};