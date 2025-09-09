// models/Celebration.js
module.exports = (sequelize, DataTypes) => {
  const Celebration = sequelize.define('Celebration', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    type: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true,
        isIn: [['Birthday', 'Wedding Anniversary', 'Graduation', 'Promotion', 'New Job', 'New Baby', 'House Dedication', 'Other']]
      }
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [2, 200]
      }
    },
    memberId: {
      type: DataTypes.UUID,
      allowNull: true, // Allow null for non-members
      references: {
        model: 'members',
        key: 'id'
      }
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true
      }
    },
    email: {
      type: DataTypes.STRING,
      validate: {
        isEmail: true
      }
    },
    message: {
      type: DataTypes.TEXT,
      validate: {
        len: [0, 1000]
      }
    },
    month: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1,
        max: 12
      }
    },
    date: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1,
        max: 31
      }
    },
    year: {
      type: DataTypes.INTEGER,
      validate: {
        min: 1900,
        max: 2100
      }
    },
    pictures: {
      type: DataTypes.JSON,
      defaultValue: [],
      validate: {
        isArray(value) {
          if (!Array.isArray(value)) {
            throw new Error('Pictures must be an array of URLs');
          }
        }
      }
    },
    status: {
      type: DataTypes.ENUM('pending', 'approved', 'rejected'),
      defaultValue: 'pending'
    },
    approvedById: {
      type: DataTypes.UUID,
      references: {
        model: 'admins',
        key: 'id'
      }
    },
    acknowledgedDate: {
      type: DataTypes.DATEONLY
    },
    rejectionReason: {
      type: DataTypes.TEXT
    },
    isPublic: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    celebrationDate: {
      type: DataTypes.DATEONLY // Computed field based on month/date/year
    },
    notificationSent: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    priority: {
      type: DataTypes.ENUM('low', 'medium', 'high'),
      defaultValue: 'medium'
    }
  }, {
    tableName: 'celebrations',
    timestamps: true,
    indexes: [
      {
        fields: ['status']
      },
      {
        fields: ['type']
      },
      {
        fields: ['month', 'date']
      },
      {
        fields: ['memberId']
      },
      {
        fields: ['approvedById']
      },
      {
        fields: ['celebrationDate']
      }
    ],
    hooks: {
      beforeSave: (celebration) => {
        // Compute celebration date if year is provided
        if (celebration.year) {
          celebration.celebrationDate = new Date(celebration.year, celebration.month - 1, celebration.date);
        } else {
          // For recurring celebrations (like birthdays), use current or next occurrence
          const now = new Date();
          const currentYear = now.getFullYear();
          const celebrationThisYear = new Date(currentYear, celebration.month - 1, celebration.date);
          
          if (celebrationThisYear >= now) {
            celebration.celebrationDate = celebrationThisYear;
          } else {
            celebration.celebrationDate = new Date(currentYear + 1, celebration.month - 1, celebration.date);
          }
        }
      }
    }
  });

  // Instance Methods
  Celebration.prototype.isUpcoming = function() {
    if (!this.celebrationDate) return false;
    return new Date(this.celebrationDate) >= new Date();
  };

  Celebration.prototype.daysUntilCelebration = function() {
    if (!this.celebrationDate) return null;
    const now = new Date();
    const celebrationDate = new Date(this.celebrationDate);
    const diffTime = celebrationDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  Celebration.prototype.approve = function(adminId, acknowledgedDate = new Date()) {
    this.status = 'approved';
    this.approvedById = adminId;
    this.acknowledgedDate = acknowledgedDate;
    this.rejectionReason = null;
    return this.save();
  };

  Celebration.prototype.reject = function(adminId, reason) {
    this.status = 'rejected';
    this.approvedById = adminId;
    this.rejectionReason = reason;
    this.acknowledgedDate = null;
    return this.save();
  };

  // Class Methods
  Celebration.getPendingCelebrations = function() {
    return this.findAll({
      where: { status: 'pending' },
      include: [{
        association: 'member',
        attributes: ['name', 'email', 'phone', 'department']
      }],
      order: [['createdAt', 'ASC']]
    });
  };

  Celebration.getUpcomingCelebrations = function(days = 30) {
    const { Op } = require('sequelize');
    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(now.getDate() + days);

    return this.findAll({
      where: {
        status: 'approved',
        celebrationDate: {
          [Op.between]: [now, futureDate]
        }
      },
      include: [{
        association: 'member',
        attributes: ['name', 'email', 'phone', 'department']
      }],
      order: [['celebrationDate', 'ASC']]
    });
  };

  Celebration.getCelebrationsByMonth = function(month, year = new Date().getFullYear()) {
    return this.findAll({
      where: {
        month: month,
        status: 'approved'
      },
      include: [{
        association: 'member',
        attributes: ['name', 'email', 'phone', 'department']
      }],
      order: [['date', 'ASC']]
    });
  };

  Celebration.getTodaysCelebrations = function() {
    const today = new Date();
    const month = today.getMonth() + 1;
    const date = today.getDate();

    return this.findAll({
      where: {
        month: month,
        date: date,
        status: 'approved'
      },
      include: [{
        association: 'member',
        attributes: ['name', 'email', 'phone', 'department']
      }]
    });
  };

  Celebration.getStatistics = function() {
    const thisMonth = new Date();
    thisMonth.setDate(1);

    return Promise.all([
      this.count(), // Total celebrations
      this.count({ where: { status: 'pending' } }), // Pending
      this.count({ where: { status: 'approved' } }), // Approved  
      this.count({ where: { status: 'rejected' } }), // Rejected
      this.count({
        where: {
          createdAt: {
            [Op.gte]: thisMonth
          }
        }
      }), // This month submissions
      this.findAll({
        attributes: ['type', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
        where: { status: 'approved' },
        group: ['type'],
        raw: true
      }) // Type breakdown
    ]);
  };

  return Celebration;
};