// src/models/Outcome.js
module.exports = (sequelize, DataTypes) => {
  const Outcome = sequelize.define('Outcome', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    name: { // Nome do resultado (ex: nome do time, "Draw")
      type: DataTypes.STRING,
      allowNull: false,
    },
    price: { // Valor da odd
      type: DataTypes.DECIMAL(10, 2), // Exemplo: 10 dígitos no total, 2 após a vírgula
      allowNull: false,
    },
    bookmakerOddsId: { // Chave estrangeira para BookmakerOdds
      type: DataTypes.DECIMAL, // Tipo correspondente ao ID de BookmakerOdds
      allowNull: false,
      references: {
        model: 'bookmaker_odds', // Nome da tabela do modelo BookmakerOdds
        key: 'id',
      }
    }
  }, {
    tableName: 'outcomes',
    timestamps: false, // Não precisamos de timestamps para resultados individuais
  });

  return Outcome;
};