// models/Member.js
module.exports = (sequelize, DataTypes) => {
  const Member = sequelize.define('Member', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [2, 100]
      }
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
        notEmpty: true
      }
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true
      }
    },
    address: {
      type: DataTypes.TEXT
    },
    dateOfBirth: {
      type: DataTypes.DATEONLY
    },
    gender: {
      type: DataTypes.ENUM('Male', 'Female'),
      validate: {
        isIn: [['Male', 'Female']]
      }
    },
    maritalStatus: {
      type: DataTypes.ENUM('Single', 'Married', 'Divorced', 'Widowed'),
      validate: {
        isIn: [['Single', 'Married', 'Divorced', 'Widowed']]
      }
    },
    occupation: {
      type: DataTypes.STRING
    },
    department: {
      type: DataTypes.STRING,
      validate: {
        notEmpty: true
      }
    },
    membershipDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      validate: {
        notEmpty: true,
        isDate: true
      }
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    avatar: {
      type: DataTypes.STRING,
      validate: {
        isUrl: true
      }
    },
    // Emergency Contact Information
    emergencyContactName: {
      type: DataTypes.STRING
    },
    emergencyContactPhone: {
      type: DataTypes.STRING
    },
    emergencyContactRelationship: {
      type: DataTypes.STRING
    },
    // Additional Fields
    notes: {
      type: DataTypes.TEXT
    },
    joinedThrough: {
      type: DataTypes.STRING // e.g., "Invitation", "Walk-in", "Online", etc.
    },
    baptismDate: {
      type: DataTypes.DATEONLY
    },
    lastVisit: {
      type: DataTypes.DATE
    }
  }, {
    tableName: 'members',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['email']
      },
      {
        fields: ['isActive']
      },
      {
        fields: ['department']
      },
      {
        fields: ['membershipDate']
      },
      {
        fields: ['name']
      }
    ]
  });

  // Virtual field for emergency contact
  Member.prototype.getEmergencyContact = function() {
    return {
      name: this.emergencyContactName,
      phone: this.emergencyContactPhone,
      relationship: this.emergencyContactRelationship
    };
  };

  // Instance Methods
  Member.prototype.getAge = function() {
    if (!this.dateOfBirth) return null;
    const today = new Date();
    const birthDate = new Date(this.dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  };

  Member.prototype.getMembershipDuration = function() {
    const today = new Date();
    const membershipDate = new Date(this.membershipDate);
    const diffTime = Math.abs(today - membershipDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const years = Math.floor(diffDays / 365);
    const months = Math.floor((diffDays % 365) / 30);
    
    return { years, months, totalDays: diffDays };
  };

  // Class Methods
  Member.findActiveMembers = function(options = {}) {
    return this.findAll({
      where: { 
        isActive: true,
        ...options.where 
      },
      ...options
    });
  };

  Member.findByDepartment = function(department) {
    return this.findAll({
      where: { 
        department,
        isActive: true 
      },
      order: [['name', 'ASC']]
    });
  };

  Member.searchMembers = function(searchTerm) {
    const { Op } = require('sequelize');
    return this.findAll({
      where: {
        [Op.and]: [
          { isActive: true },
          {
            [Op.or]: [
              { name: { [Op.iLike]: `%${searchTerm}%` } },
              { email: { [Op.iLike]: `%${searchTerm}%` } },
              { phone: { [Op.like]: `%${searchTerm}%` } }
            ]
          }
        ]
      },
      order: [['name', 'ASC']]
    });
  };

  Member.getStatistics = function() {
    const { Op } = require('sequelize');
    return Promise.all([
      this.count(), // Total members
      this.count({ where: { isActive: true } }), // Active members
      this.count({ where: { isActive: false } }), // Inactive members
      this.findAll({
        attributes: ['department', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
        where: { isActive: true },
        group: ['department'],
        raw: true
      }), // Department breakdown
      this.findAll({
        attributes: ['gender', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
        where: { isActive: true, gender: { [Op.not]: null } },
        group: ['gender'],
        raw: true
      }) // Gender breakdown
    ]);
  };

  return Member;
};