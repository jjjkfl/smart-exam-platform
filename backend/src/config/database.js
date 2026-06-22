/**
 * src/config/database.js
 * Connects to MySQL (or SQLite for local dev) via Sequelize and ensures the
 * schema exists. Exports connectDB as the default (server.js calls it) plus the
 * sequelize instance for scripts that need it.
 */

const sequelize = require('./sequelize');
const logger = require('../utils/logger');

const connectDB = async () => {
  try {
    // Requiring the models registers them on the sequelize instance and wires
    // up associations before we sync.
    require('../models');

    await sequelize.authenticate();
    const dialect = sequelize.getDialect();
    logger.info(`✅ Database connected (${dialect})`);

    // Create any missing tables. Existing tables/data are left untouched.
    await sequelize.sync();
    logger.info('✅ Schema synced');
  } catch (err) {
    logger.error(`❌ Database Connection Error: ${err.message}`);
    logger.error('👉 TIP: Verify DB_HOST/DB_NAME/DB_USER/DB_PASS in your .env file.');
    logger.error('👉 TIP: Make sure the MySQL database exists and the user has access.');
    process.exit(1);
  }
};

module.exports = connectDB;
module.exports.sequelize = sequelize;
