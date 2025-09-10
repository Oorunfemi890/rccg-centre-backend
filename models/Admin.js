// models/Admin.js - Enhanced with profile update fields
const bcrypt = require('bcryptjs');

module.exports = (sequelize, DataTypes) => {
  const Admin = sequelize.define('Admin', {
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
    password: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [6, 100]
      }
    },
    role: {
      type: DataTypes.ENUM('super_admin', 'admin'),
      defaultValue: 'admin',
      allowNull: false
    },
    phone: {
      type: DataTypes.STRING,
      validate: {
        notEmpty: true
      }
    },
    avatar: {
      type: DataTypes.STRING,
      validate: {
        isUrl: true
      }
    },
    position: {
      type: DataTypes.STRING
    },
    permissions: {
      type: DataTypes.JSON,
      defaultValue: ['members', 'events', 'attendance', 'celebrations'],
      validate: {
        isArray(value) {
          if (!Array.isArray(value)) {
            throw new Error('Permissions must be an array');
          }
        }
      }
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    lastLogin: {
      type: DataTypes.DATE
    },
    refreshToken: {
      type: DataTypes.TEXT
    },
    passwordResetToken: {
      type: DataTypes.STRING
    },
    passwordResetExpires: {
      type: DataTypes.DATE
    },
    // New fields for profile update verification
    profileUpdateToken: {
      type: DataTypes.STRING,
      allowNull: true
    },
    profileUpdateTokenExpires: {
      type: DataTypes.DATE,
      allowNull: true
    },
    profileUpdateType: {
      type: DataTypes.ENUM('email', 'profile'),
      allowNull: true
    },
    // New fields for password change verification
    passwordChangeToken: {
      type: DataTypes.STRING,
      allowNull: true
    },
    passwordChangeTokenExpires: {
      type: DataTypes.DATE,
      allowNull: true
    },
    // Email verification fields (for email changes)
    newEmail: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        isEmail: true
      }
    },
    emailVerificationToken: {
      type: DataTypes.STRING,
      allowNull: true
    },
    emailVerificationExpires: {
      type: DataTypes.DATE,
      allowNull: true
    },
    // Security fields
    twoFactorEnabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    twoFactorSecret: {
      type: DataTypes.STRING,
      allowNull: true
    },
    // Login tracking
    loginAttempts: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    lockedUntil: {
      type: DataTypes.DATE,
      allowNull: true
    },
    // Profile preferences
    preferences: {
      type: DataTypes.JSON,
      defaultValue: {
        emailNotifications: true,
        pushNotifications: true,
        language: 'en',
        timezone: 'Africa/Lagos'
      }
    }
  }, {
    tableName: 'admins',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['email']
      },
      {
        fields: ['role']
      },
      {
        fields: ['isActive']
      },
      {
        fields: ['profileUpdateToken']
      },
      {
        fields: ['passwordChangeToken']
      },
      {
        fields: ['emailVerificationToken']
      }
    ],
    hooks: {
      beforeCreate: async (admin) => {
        if (admin.password) {
          const saltRounds = 12;
          admin.password = await bcrypt.hash(admin.password, saltRounds);
        }
        // Clean email
        if (admin.email) {
          admin.email = admin.email.toLowerCase().trim();
        }
      },
      beforeUpdate: async (admin) => {
        if (admin.changed('password')) {
          const saltRounds = 12;
          admin.password = await bcrypt.hash(admin.password, saltRounds);
        }
        // Clean email
        if (admin.changed('email') && admin.email) {
          admin.email = admin.email.toLowerCase().trim();
        }
        if (admin.changed('newEmail') && admin.newEmail) {
          admin.newEmail = admin.newEmail.toLowerCase().trim();
        }
      }
    }
  });

  // Instance Methods
  Admin.prototype.comparePassword = async function(candidatePassword) {
    try {
      return await bcrypt.compare(candidatePassword, this.password);
    } catch (error) {
      throw new Error('Password comparison failed');
    }
  };

  Admin.prototype.hasPermission = function(permission) {
    if (this.role === 'super_admin') return true;
    return this.permissions && this.permissions.includes(permission);
  };

  Admin.prototype.isLocked = function() {
    return !!(this.lockedUntil && this.lockedUntil > Date.now());
  };

  Admin.prototype.incrementLoginAttempts = function() {
    // If we have a previous lock that has expired, restart at 1
    if (this.lockedUntil && this.lockedUntil < Date.now()) {
      return this.update({
        loginAttempts: 1,
        lockedUntil: null
      });
    }
    
    const updates = { loginAttempts: this.loginAttempts + 1 };
    
    // Lock account after 5 failed attempts for 2 hours
    if (this.loginAttempts + 1 >= 5 && !this.isLocked()) {
      updates.lockedUntil = Date.now() + 2 * 60 * 60 * 1000; // 2 hours
    }
    
    return this.update(updates);
  };

  Admin.prototype.resetLoginAttempts = function() {
    return this.update({
      loginAttempts: 0,
      lockedUntil: null
    });
  };

  Admin.prototype.toJSON = function() {
    const values = Object.assign({}, this.get());
    // Remove sensitive fields
    delete values.password;
    delete values.refreshToken;
    delete values.passwordResetToken;
    delete values.passwordResetExpires;
    delete values.profileUpdateToken;
    delete values.profileUpdateTokenExpires;
    delete values.passwordChangeToken;
    delete values.passwordChangeTokenExpires;
    delete values.emailVerificationToken;
    delete values.emailVerificationExpires;
    delete values.twoFactorSecret;
    
    return values;
  };

  Admin.prototype.toSafeJSON = function() {
    const values = this.toJSON();
    // Remove additional sensitive fields for public API
    delete values.loginAttempts;
    delete values.lockedUntil;
    delete values.newEmail;
    
    return values;
  };

  // Class Methods
  Admin.findByEmail = function(email) {
    return this.findOne({ 
      where: { 
        email: email.toLowerCase().trim(),
        isActive: true 
      }
    });
  };

  Admin.findActiveAdmins = function() {
    return this.findAll({
      where: { isActive: true },
      order: [['createdAt', 'DESC']]
    });
  };

  Admin.findByProfileUpdateToken = function(token) {
    return this.findOne({
      where: {
        profileUpdateToken: token,
        profileUpdateTokenExpires: {
          [sequelize.Sequelize.Op.gt]: new Date()
        },
        isActive: true
      }
    });
  };

  Admin.findByPasswordChangeToken = function(token) {
    return this.findOne({
      where: {
        passwordChangeToken: token,
        passwordChangeTokenExpires: {
          [sequelize.Sequelize.Op.gt]: new Date()
        },
        isActive: true
      }
    });
  };

  Admin.findByEmailVerificationToken = function(token) {
    return this.findOne({
      where: {
        emailVerificationToken: token,
        emailVerificationExpires: {
          [sequelize.Sequelize.Op.gt]: new Date()
        },
        isActive: true
      }
    });
  };

  // Clean expired tokens
  Admin.cleanExpiredTokens = async function() {
    const now = new Date();
    
    return this.update(
      {
        passwordResetToken: null,
        passwordResetExpires: null,
        profileUpdateToken: null,
        profileUpdateTokenExpires: null,
        passwordChangeToken: null,
        passwordChangeTokenExpires: null,
        emailVerificationToken: null,
        emailVerificationExpires: null
      },
      {
        where: {
          [sequelize.Sequelize.Op.or]: [
            { passwordResetExpires: { [sequelize.Sequelize.Op.lt]: now } },
            { profileUpdateTokenExpires: { [sequelize.Sequelize.Op.lt]: now } },
            { passwordChangeTokenExpires: { [sequelize.Sequelize.Op.lt]: now } },
            { emailVerificationExpires: { [sequelize.Sequelize.Op.lt]: now } }
          ]
        }
      }
    );
  };

  return Admin;
};