/**
 * src/config/sequelize.js
 * Creates the single shared Sequelize instance.
 * Dialect is chosen via DB_DIALECT:
 *   - 'mysql'  (default) → production on InterServer shared host
 *   - 'sqlite'           → local development / smoke testing (no DB server needed)
 */

const { Sequelize } = require('sequelize');

const dialect = process.env.DB_DIALECT || 'mysql';

let sequelize;

if (dialect === 'sqlite') {
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: process.env.SQLITE_PATH || './dev.sqlite',
    logging: false,
  });
} else {
  sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASS,
    {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
      dialect: 'mysql',
      logging: false,
      define: { charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci' },
      pool: { max: 5, min: 0, acquire: 30000, idle: 10000 },
    }
  );
}

module.exports = sequelize;
