// src/models/BookmakerOdds.js
module.exports = (sequelize, DataTypes) => {
  const BookmakerOdds = sequelize.define('BookmakerOdds', {
    id: {
      type: DataTypes.UUID, // UUID para ID único desta entrada de odds da casa
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    key: { // Chave da casa de aposta (ex: 'bet365')
      type: DataTypes.STRING,
      allowNull: false,
    },
    title: { // Título da casa de aposta (ex: 'Bet365')
      type: DataTypes.STRING,
      allowNull: false,
    },
    lastUpdate: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    affiliateLink: { // Link de afiliado gerado
      type: DataTypes.STRING(1024), // Aumentar o tamanho para URLs longas
      allowNull: true,
    },
    eventId: { // Chave estrangeira para o Event
      type: DataTypes.STRING, // Deve corresponder ao tipo do Event.id
      allowNull: false,
      references: {
        model: 'events', // Nome da tabela do modelo Event
        key: 'id',
      }
    }
  }, {
    tableName: 'bookmaker_odds',
    timestamps: true,
    uniqueKeys: { // Garante que não haja duplicatas para a mesma casa no mesmo evento
      unique_bookmaker_event: {
        fields: ['key', 'eventId']
      }
    }
  });

  return BookmakerOdds;
};  