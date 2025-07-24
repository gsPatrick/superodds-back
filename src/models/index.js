// src/models/index.js
const { Sequelize, DataTypes } = require('sequelize');
const config = require('../config/database');

const env = process.env.NODE_ENV || 'development';
const dbConfig = config[env];

const sequelize = new Sequelize(dbConfig.database, dbConfig.username, dbConfig.password, {
  host: dbConfig.host,
  port: dbConfig.port,
  dialect: dbConfig.dialect,
  logging: dbConfig.logging,
  dialectOptions: dbConfig.dialectOptions || {}
});

const db = {};

db.sequelize = sequelize;
db.Sequelize = Sequelize;

// Importar e inicializar modelos aqui
db.Event = require('./Event')(sequelize, DataTypes);
db.BookmakerOdds = require('./BookmakerOdds')(sequelize, DataTypes);
db.Outcome = require('./Outcome')(sequelize, DataTypes);
db.SuperOdd = require('./SuperOdd')(sequelize, DataTypes); // NOVO MODELO ADICIONADO

// Definir associações (apenas entre Event, BookmakerOdds, Outcome)
// SuperOdd será um modelo independente, sem associações diretas com os outros
db.Event.hasMany(db.BookmakerOdds, {
  foreignKey: 'eventId',
  as: 'bookmakers'
});
db.BookmakerOdds.belongsTo(db.Event, {
  foreignKey: 'eventId',
  as: 'event'
});

db.BookmakerOdds.hasMany(db.Outcome, {
  foreignKey: 'bookmakerOddsId',
  as: 'outcomes'
});
db.Outcome.belongsTo(db.BookmakerOdds, {
  foreignKey: 'bookmakerOddsId',
  as: 'bookmakerOdds'
});

module.exports = db;