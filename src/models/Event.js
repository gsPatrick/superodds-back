// src/models/Event.js
module.exports = (sequelize, DataTypes) => {
  const Event = sequelize.define('Event', {
    id: { // Usaremos o ID da Odds-API.io como primary key
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
    },
    sportKey: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    homeTeam: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    awayTeam: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    commenceTime: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    // Você pode adicionar mais campos conforme necessário, como 'sportTitle', 'lastUpdate' etc.
  }, {
    tableName: 'events', // Nome da tabela no banco de dados
    timestamps: true, // Adiciona createdAt e updatedAt automaticamente
  });

  return Event;
};