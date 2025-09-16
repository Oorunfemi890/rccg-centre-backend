// models/MemberAttendance.js - Updated with proper associations
module.exports = (sequelize, DataTypes) => {
  const MemberAttendance = sequelize.define('MemberAttendance', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    attendanceId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'attendances',
        key: 'id'
      }
    },
    memberId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'members',
        key: 'id'
      }
    },
    present: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    timeArrived: {
      type: DataTypes.TIME
    },
    notes: {
      type: DataTypes.STRING(500)
    }
  }, {
    tableName: 'member_attendances',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['attendanceId', 'memberId']
      },
      {
        fields: ['memberId']
      },
      {
        fields: ['present']
      },
      {
        fields: ['attendanceId']
      }
    ]
  });

  // Define associations
  MemberAttendance.associate = function(models) {
    // MemberAttendance belongs to Attendance
    MemberAttendance.belongsTo(models.Attendance, {
      foreignKey: 'attendanceId',
      as: 'attendance',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // MemberAttendance belongs to Member
    MemberAttendance.belongsTo(models.Member, {
      foreignKey: 'memberId',
      as: 'member',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });
  };

  // Instance methods
  MemberAttendance.prototype.toJSON = function() {
    const values = { ...this.get() };
    
    // Ensure boolean is properly formatted
    values.present = Boolean(values.present);
    
    return values;
  };

  // Class methods
  MemberAttendance.getMemberAttendanceStats = async function(memberId, period = 'month') {
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

    const totalServices = await sequelize.models.Attendance.count({
      where: {
        date: {
          [Op.gte]: startDate
        }
      }
    });

    const memberAttendances = await this.findAll({
      where: {
        memberId: memberId
      },
      include: [{
        model: sequelize.models.Attendance,
        as: 'attendance',
        where: {
          date: {
            [Op.gte]: startDate
          }
        }
      }]
    });

    const presentCount = memberAttendances.filter(ma => ma.present).length;
    const attendanceRate = totalServices > 0 ? (presentCount / totalServices * 100).toFixed(2) : 0;

    return {
      totalServices,
      attended: presentCount,
      missed: totalServices - presentCount,
      attendanceRate: parseFloat(attendanceRate)
    };
  };

  return MemberAttendance;
};