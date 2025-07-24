// src/config/database.js
require('dotenv').config(); // Garante que as variáveis de ambiente sejam carregadas aqui também

module.exports = {
  development: {
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'odds_collector_db',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: false, // Desabilita logs SQL no console (mudar para true para debug)
  },
  // Você pode adicionar configurações para production, test, etc.
  production: {
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: 'postgres',
    logging: false,
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false // Para ambientes como Heroku que usam SSL auto-assinado
      }
    }
  }
};