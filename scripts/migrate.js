// scripts/migrate.js
require('dotenv').config();
const { sequelize } = require('../models');
const logger = require('../utils/logger'); // ✅ using logger only

const migrate = async () => {
  try {
    await sequelize.authenticate();
    logger.info('✅ Database connected successfully');

    // Sync all models (creates/updates tables automatically)
    await sequelize.sync({ alter: true });
    logger.info('✅ Database migration completed successfully!');

    // Show all tables
    const queryInterface = sequelize.getQueryInterface();
    const tables = await queryInterface.showAllTables();
    logger.info(`📋 Tables in database: ${tables.join(', ')}`);

  } catch (error) {
    logger.error('❌ Database migration failed', { error });
    throw error;
  } finally {
    await sequelize.close();
  }
};

// Run migration if called directly
if (require.main === module) {
  migrate()
    .then(() => {
      console.log('✅ Migration completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    });
}

module.exports = migrate;
