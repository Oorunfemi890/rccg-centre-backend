// models/index.js - Simple approach that often works better
const { Sequelize } = require('sequelize');
require('dotenv').config();

// Simple, direct connection using the Supabase connection string
const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: false,
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000,
  }
});

// Import Models
const Admin = require('./Admin')(sequelize, Sequelize.DataTypes);
const Member = require('./member')(sequelize, Sequelize.DataTypes);
const Attendance = require('./Attendance')(sequelize, Sequelize.DataTypes);
const Event = require('./Event')(sequelize, Sequelize.DataTypes);
const Celebration = require('./Celebration')(sequelize, Sequelize.DataTypes);
const MemberAttendance = require('./MemberAttendance')(sequelize, Sequelize.DataTypes);

// Define Associations
Admin.hasMany(Attendance, { foreignKey: 'recordedById', as: 'recordedAttendances' });
Admin.hasMany(Event, { foreignKey: 'organizerId', as: 'organizedEvents' });
Admin.hasMany(Celebration, { foreignKey: 'approvedById', as: 'approvedCelebrations' });

Member.belongsTo(Member, { foreignKey: 'emergencyContactId', as: 'emergencyContact' });
Member.hasMany(Celebration, { foreignKey: 'memberId', as: 'celebrations' });
Member.hasMany(MemberAttendance, { foreignKey: 'memberId', as: 'attendances' });

Attendance.belongsTo(Admin, { foreignKey: 'recordedById', as: 'recordedBy' });
Attendance.hasMany(MemberAttendance, { foreignKey: 'attendanceId', as: 'memberAttendances' });

Event.belongsTo(Admin, { foreignKey: 'organizerId', as: 'organizer' });

Celebration.belongsTo(Member, { foreignKey: 'memberId', as: 'member' });
Celebration.belongsTo(Admin, { foreignKey: 'approvedById', as: 'approvedBy' });

MemberAttendance.belongsTo(Member, { foreignKey: 'memberId', as: 'member' });
MemberAttendance.belongsTo(Attendance, { foreignKey: 'attendanceId', as: 'attendance' });

const db = {
  sequelize,
  Sequelize,
  Admin,
  Member,
  Attendance,
  Event,
  Celebration,
  MemberAttendance
};

module.exports = db;