// src/models/SuperOdd.js
module.exports = (sequelize, DataTypes) => {
  const SuperOdd = sequelize.define('SuperOdd', {
    // Usaremos 'unique_key' da API como ID primário para evitar duplicações
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
      unique: true, // Garante que a chave seja única
    },
    provider: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    link: { // Link de afiliado direto da super odd
      type: DataTypes.STRING(1024), // URLs podem ser longas
      allowNull: false,
    },
    sportId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    boostedOdd: { // Odd turbinada
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    originalOdd: { // Odd original
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true, // Pode ser nulo se a API não sempre fornecer
    },
    descriptionForSeo: { // Descrição detalhada da aposta
      type: DataTypes.TEXT, // Use TEXT para textos longos
      allowNull: true,
    },
    providerId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    marketName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    selectionName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    competitionName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    gameTimestamp: { // Hora de início do jogo
      type: DataTypes.DATE,
      allowNull: false,
    },
    gameName: { // Nome do jogo (ex: "Time A vs. Time B")
      type: DataTypes.STRING,
      allowNull: false,
    },
    expireAtTimestamp: { // Hora de expiração da super odd
      type: DataTypes.DATE,
      allowNull: false,
    },
    // createdAt e updatedAt já são adicionados por default pelo timestamps: true no options
  }, {
    tableName: 'super_odds', // Nome da tabela no banco de dados
    timestamps: true,
  });

  return SuperOdd;
};