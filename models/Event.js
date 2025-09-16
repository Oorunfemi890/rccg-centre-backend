// models/Event.js - Updated with proper associations and methods
module.exports = (sequelize, DataTypes) => {
  const Event = sequelize.define('Event', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [3, 200]
      }
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        notEmpty: true
      }
    },
    date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      validate: {
        notEmpty: true,
        isDate: true
      }
    },
    time: {
      type: DataTypes.TIME,
      allowNull: false,
      validate: {
        notEmpty: true
      }
    },
    endTime: {
      type: DataTypes.TIME
    },
    location: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true
      }
    },
    category: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isIn: [[
          'Service',
          'Conference', 
          'Seminar',
          'Workshop',
          'Outreach',
          'Fellowship',
          'Youth Event',
          'Children Event',
          'Prayer Meeting',
          'Special Program',
          'Other'
        ]]
      }
    },
    maxAttendees: {
      type: DataTypes.INTEGER,
      validate: {
        min: 1,
        max: 50000
      }
    },
    currentAttendees: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      validate: {
        min: 0
      }
    },
    isRecurring: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    recurringPattern: {
      type: DataTypes.ENUM('daily', 'weekly', 'monthly', 'yearly'),
      validate: {
        isValidPattern(value) {
          if (this.isRecurring && !value) {
            throw new Error('Recurring pattern is required for recurring events');
          }
        }
      }
    },
    status: {
      type: DataTypes.ENUM('upcoming', 'ongoing', 'completed', 'cancelled'),
      defaultValue: 'upcoming'
    },
    image: {
      type: DataTypes.STRING,
      validate: {
        isUrl: {
          msg: 'Image must be a valid URL'
        }
      }
    },
    organizerId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'admins',
        key: 'id'
      }
    },
    registrationRequired: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    registrationDeadline: {
      type: DataTypes.DATE
    },
    eventFee: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0.00,
      validate: {
        min: 0
      }
    },
    tags: {
      type: DataTypes.JSON,
      defaultValue: []
    }
  }, {
    tableName: 'events',
    timestamps: true,
    indexes: [
      {
        fields: ['date']
      },
      {
        fields: ['category']
      },
      {
        fields: ['status']
      },
      {
        fields: ['organizerId']
      },
      {
        fields: ['isRecurring']
      },
      {
        fields: ['date', 'time']
      }
    ]
  });

  // Define associations
  Event.associate = function(models) {
    // Event belongs to Admin (organizer)
    Event.belongsTo(models.Admin, {
      foreignKey: 'organizerId',
      as: 'organizer',
      onDelete: 'RESTRICT',
      onUpdate: 'CASCADE'
    });

    // Future: Event can have many EventRegistrations
    // Event.hasMany(models.EventRegistration, {
    //   foreignKey: 'eventId',
    //   as: 'registrations',
    //   onDelete: 'CASCADE'
    // });
  };

  // Instance Methods
  Event.prototype.isUpcoming = function() {
    const now = new Date();
    const eventDate = new Date(this.date);
    return eventDate > now && this.status === 'upcoming';
  };

  Event.prototype.isPast = function() {
    const now = new Date();
    const eventDate = new Date(this.date);
    return eventDate < now;
  };

  Event.prototype.isToday = function() {
    const today = new Date();
    const eventDate = new Date(this.date);
    return today.getDate() === eventDate.getDate() &&
           today.getMonth() === eventDate.getMonth() &&
           today.getFullYear() === eventDate.getFullYear();
  };

  Event.prototype.isFull = function() {
    return this.maxAttendees && this.currentAttendees >= this.maxAttendees;
  };

  Event.prototype.getAvailableSpots = function() {
    if (!this.maxAttendees) return null;
    return Math.max(0, this.maxAttendees - this.currentAttendees);
  };

  Event.prototype.getCapacityPercentage = function() {
    if (!this.maxAttendees) return 0;
    return Math.round((this.currentAttendees / this.maxAttendees) * 100);
  };

  Event.prototype.canRegister = function() {
    const now = new Date();
    
    // Check if registration is required
    if (!this.registrationRequired) return true;
    
    // Check if registration deadline has passed
    if (this.registrationDeadline && now > new Date(this.registrationDeadline)) {
      return false;
    }
    
    // Check if event is full
    if (this.isFull()) return false;
    
    // Check if event is still upcoming
    return this.isUpcoming();
  };

  // Class Methods
  Event.getUpcomingEvents = function(limit = 10) {
    const { Op } = require('sequelize');
    return this.findAll({
      where: {
        date: {
          [Op.gte]: new Date()
        },
        status: 'upcoming'
      },
      order: [['date', 'ASC'], ['time', 'ASC']],
      limit,
      include: [{
        association: 'organizer',
        attributes: ['name', 'position']
      }]
    });
  };

  Event.getEventsByCategory = function(category) {
    const { Op } = require('sequelize');
    return this.findAll({
      where: { 
        category,
        status: { [Op.not]: 'cancelled' }
      },
      order: [['date', 'DESC']],
      include: [{
        association: 'organizer',
        attributes: ['name', 'position']
      }]
    });
  };

  Event.getEventsByDateRange = function(startDate, endDate) {
    const { Op } = require('sequelize');
    return this.findAll({
      where: {
        date: {
          [Op.between]: [startDate, endDate]
        }
      },
      order: [['date', 'ASC'], ['time', 'ASC']],
      include: [{
        association: 'organizer',
        attributes: ['name', 'position']
      }]
    });
  };

  Event.getTodaysEvents = function() {
    const today = new Date().toISOString().split('T')[0];
    return this.findAll({
      where: {
        date: today,
        status: { [Op.in]: ['upcoming', 'ongoing'] }
      },
      order: [['time', 'ASC']],
      include: [{
        association: 'organizer',
        attributes: ['name', 'position']
      }]
    });
  };

  Event.getStatistics = function() {
    const { Op } = require('sequelize');
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonth = new Date(thisMonth.getFullYear(), thisMonth.getMonth() + 1, 1);
    
    return Promise.all([
      // Total events
      this.count(),
      
      // Upcoming events
      this.count({ 
        where: { 
          date: { [Op.gte]: now },
          status: 'upcoming'
        }
      }),
      
      // Completed events
      this.count({ 
        where: { status: 'completed' }
      }),
      
      // This month events
      this.count({
        where: {
          date: {
            [Op.gte]: thisMonth,
            [Op.lt]: nextMonth
          }
        }
      }),
      
      // Category breakdown
      this.findAll({
        attributes: [
          'category', 
          [sequelize.fn('COUNT', sequelize.col('id')), 'count']
        ],
        group: ['category'],
        raw: true
      }),
      
      // Status breakdown
      this.findAll({
        attributes: [
          'status', 
          [sequelize.fn('COUNT', sequelize.col('id')), 'count']
        ],
        group: ['status'],
        raw: true
      })
    ]);
  };

  Event.getMonthlyStats = function(year, month) {
    const { Op } = require('sequelize');
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 1);
    
    return this.findAll({
      where: {
        date: {
          [Op.gte]: startDate,
          [Op.lt]: endDate
        }
      },
      attributes: [
        [sequelize.fn('DATE', sequelize.col('date')), 'date'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'eventCount'],
        [sequelize.fn('SUM', sequelize.col('currentAttendees')), 'totalAttendance']
      ],
      group: [sequelize.fn('DATE', sequelize.col('date'))],
      order: [[sequelize.fn('DATE', sequelize.col('date')), 'ASC']],
      raw: true
    });
  };

  // Instance method to format for JSON response
  Event.prototype.toJSON = function() {
    const values = { ...this.get() };
    
    // Ensure numbers are properly formatted
    values.maxAttendees = values.maxAttendees ? parseInt(values.maxAttendees) : null;
    values.currentAttendees = parseInt(values.currentAttendees) || 0;
    values.eventFee = parseFloat(values.eventFee) || 0;
    
    // Ensure booleans are properly formatted
    values.isRecurring = Boolean(values.isRecurring);
    values.registrationRequired = Boolean(values.registrationRequired);
    
    // Add computed properties
    values.isPast = this.isPast();
    values.isUpcoming = this.isUpcoming();
    values.isToday = this.isToday();
    values.isFull = this.isFull();
    values.availableSpots = this.getAvailableSpots();
    values.capacityPercentage = this.getCapacityPercentage();
    values.canRegister = this.canRegister();
    
    return values;
  };

  return Event;
};