//  models/Attendance.js
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

  // Class Methods
  Attendance.getStatistics = function(period = 'month') {
    const { Op } = require('sequelize');
    const now = new Date();
    let startDate;

    switch (period) {
      case 'week':
        startDate = new Date(now.setDate(now.getDate() - 7));
        break;
      case 'month':
        startDate = new Date(now.setMonth(now.getMonth() - 1));
        break;
      case 'year':
        startDate = new Date(now.setFullYear(now.getFullYear() - 1));
        break;
      default:
        startDate = new Date(now.setMonth(now.getMonth() - 1));
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

  return Attendance;
};