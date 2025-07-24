// src/features/odds-collector/odds-collector.routes.js
const express = require('express');
const oddsCollectorController = require('./odds-collector.controller');
const router = express.Router();

// Rota para disparar a coleta de odds
// Ex: GET /api/odds-collector/collect?sport=soccer®ion=uk
router.get('/collect', oddsCollectorController.collectOdds);

// Rota para listar esportes disponíveis na Odds-API.io
// Ex: GET /api/odds-collector/sports
router.get('/sports', oddsCollectorController.listSports);

module.exports = router;