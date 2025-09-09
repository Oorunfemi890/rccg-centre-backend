// models/index.js
const { Sequelize } = require('sequelize');
require('dotenv').config();

// Initialize Sequelize
const sequelize = new Sequelize({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  dialect: 'postgres',
  logging: false,
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
});

// Import Models
const Admin = require('./Admin')(sequelize, Sequelize.DataTypes);
const Member = require('./Member')(sequelize, Sequelize.DataTypes);
const Attendance = require('./Attendance')(sequelize, Sequelize.DataTypes);
const Event = require('./Event')(sequelize, Sequelize.DataTypes);
const Celebration = require('./Celebration')(sequelize, Sequelize.DataTypes);
const MemberAttendance = require('./MemberAttendance')(sequelize, Sequelize.DataTypes);

// Define Associations
// Admin associations
Admin.hasMany(Attendance, { foreignKey: 'recordedById', as: 'recordedAttendances' });
Admin.hasMany(Event, { foreignKey: 'organizerId', as: 'organizedEvents' });
Admin.hasMany(Celebration, { foreignKey: 'approvedById', as: 'approvedCelebrations' });

// Member associations
Member.belongsTo(Member, { foreignKey: 'emergencyContactId', as: 'emergencyContact' });
Member.hasMany(Celebration, { foreignKey: 'memberId', as: 'celebrations' });
Member.hasMany(MemberAttendance, { foreignKey: 'memberId', as: 'attendances' });

// Attendance associations
Attendance.belongsTo(Admin, { foreignKey: 'recordedById', as: 'recordedBy' });
Attendance.hasMany(MemberAttendance, { foreignKey: 'attendanceId', as: 'memberAttendances' });

// Event associations
Event.belongsTo(Admin, { foreignKey: 'organizerId', as: 'organizer' });

// Celebration associations
Celebration.belongsTo(Member, { foreignKey: 'memberId', as: 'member' });
Celebration.belongsTo(Admin, { foreignKey: 'approvedById', as: 'approvedBy' });

// MemberAttendance associations
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