// models/MemberAttendance.js
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
      type: DataTypes.STRING
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
      }
    ]
  });

  return MemberAttendance;
};