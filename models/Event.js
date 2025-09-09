
// models/Event.js
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
        min: 1
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
        isUrl: true
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
      defaultValue: 0.00
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
      }
    ]
  });

  // Instance Methods
  Event.prototype.isUpcoming = function() {
    return new Date(this.date) > new Date() && this.status === 'upcoming';
  };

  Event.prototype.isPast = function() {
    return new Date(this.date) < new Date();
  };

  Event.prototype.isFull = function() {
    return this.maxAttendees && this.currentAttendees >= this.maxAttendees;
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
    return this.findAll({
      where: { 
        category,
        status: { [Op.not]: 'cancelled' }
      },
      order: [['date', 'DESC']]
    });
  };

  Event.getStatistics = function() {
    const { Op } = require('sequelize');
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    return Promise.all([
      this.count(), // Total events
      this.count({ 
        where: { 
          date: { [Op.gte]: now },
          status: 'upcoming'
        }
      }), // Upcoming events
      this.count({ 
        where: { status: 'completed' }
      }), // Completed events
      this.count({
        where: {
          date: {
            [Op.gte]: thisMonth,
            [Op.lt]: new Date(thisMonth.getFullYear(), thisMonth.getMonth() + 1, 1)
          }
        }
      }), // This month events
      this.findAll({
        attributes: ['category', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
        group: ['category'],
        raw: true
      }), // Category breakdown
      this.findAll({
        attributes: ['status', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
        group: ['status'],
        raw: true
      }) // Status breakdown
    ]);
  };

  return Event;
};