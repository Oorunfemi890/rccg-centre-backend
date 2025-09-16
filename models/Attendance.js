// models/Attendance.js - Updated with proper associations
module.exports = (sequelize, DataTypes) => {
  const Attendance = sequelize.define('Attendance', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      validate: {
        notEmpty: true,
        isDate: true
      }
    },
    serviceType: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true,
        isIn: [[
          'Sunday Fire Service',
          'Sunday School', 
          'Sunday Main Service',
          'Tuesday Bible Study',
          'Wednesday Prayer',
          'Thursday Faith Clinic',
          'Friday Night Service',
          'Holy Ghost Service',
          'Special Program'
        ]]
      }
    },
    totalAttendance: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 0
      }
    },
    adults: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      validate: {
        min: 0
      }
    },
    youth: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      validate: {
        min: 0
      }
    },
    children: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      validate: {
        min: 0
      }
    },
    visitors: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      validate: {
        min: 0
      }
    },
    notes: {
      type: DataTypes.TEXT
    },
    recordedById: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'admins',
        key: 'id'
      }
    }
  }, {
    tableName: 'attendances',
    timestamps: true,
    indexes: [
      {
        fields: ['date']
      },
      {
        fields: ['serviceType']
      },
      {
        fields: ['recordedById']
      },
      {
        unique: true,
        fields: ['date', 'serviceType']
      }
    ]
  });

  // Define associations
  Attendance.associate = function(models) {
    // Attendance belongs to Admin (who recorded it)
    Attendance.belongsTo(models.Admin, {
      foreignKey: 'recordedById',
      as: 'recordedBy',
      onDelete: 'RESTRICT',
      onUpdate: 'CASCADE'
    });

    // Attendance has many MemberAttendances
    Attendance.hasMany(models.MemberAttendance, {
      foreignKey: 'attendanceId',
      as: 'memberAttendances',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });
  };

  // Class Methods
  Attendance.getStatistics = function(period = 'month') {
    const { Op } = require('sequelize');
    const now = new Date();
    let startDate;

    switch (period) {
      case 'week':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        break;
      case 'year':
        startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    }

    return this.findAll({
      where: {
        date: {
          [Op.gte]: startDate
        }
      },
      attributes: [
        [sequelize.fn('COUNT', sequelize.col('id')), 'totalRecords'],
        [sequelize.fn('SUM', sequelize.col('totalAttendance')), 'totalAttendance'],
        [sequelize.fn('AVG', sequelize.col('totalAttendance')), 'averageAttendance'],
        [sequelize.fn('MAX', sequelize.col('totalAttendance')), 'highestAttendance'],
        [sequelize.fn('MIN', sequelize.col('totalAttendance')), 'lowestAttendance']
      ],
      raw: true
    });
  };

  // Instance methods
  Attendance.prototype.toJSON = function() {
    const values = { ...this.get() };
    
    // Ensure numbers are properly formatted
    values.totalAttendance = parseInt(values.totalAttendance) || 0;
    values.adults = parseInt(values.adults) || 0;
    values.youth = parseInt(values.youth) || 0;
    values.children = parseInt(values.children) || 0;
    values.visitors = parseInt(values.visitors) || 0;
    
    return values;
  };

  return Attendance;
};