// models/Admin.js
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
      }
    ],
    hooks: {
      beforeCreate: async (admin) => {
        if (admin.password) {
          const saltRounds = 12;
          admin.password = await bcrypt.hash(admin.password, saltRounds);
        }
      },
      beforeUpdate: async (admin) => {
        if (admin.changed('password')) {
          const saltRounds = 12;
          admin.password = await bcrypt.hash(admin.password, saltRounds);
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

  Admin.prototype.toJSON = function() {
    const values = Object.assign({}, this.get());
    delete values.password;
    delete values.refreshToken;
    delete values.passwordResetToken;
    delete values.passwordResetExpires;
    return values;
  };

  // Class Methods
  Admin.findByEmail = function(email) {
    return this.findOne({ 
      where: { 
        email: email.toLowerCase(),
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

  return Admin;
};