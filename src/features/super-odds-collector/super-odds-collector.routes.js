// src/features/super-odds-collector/super-odds-collector.routes.js (COMPLETO E ATUALIZADO)
const express = require('express');
const superOddsCollectorController = require('./super-odds-collector.controller');
const router = express.Router();

// Rota para disparar a coleta de super odds (para testes manuais ou cron jobs externos)
router.get('/collect', superOddsCollectorController.collectSuperOdds);

// Rota para listar super odds disponíveis para o frontend, com filtros
// Ex: GET /api/super-odds?provider=Superbet&max_odd=5.0&sort_by=boosted_desc&hide_expired=true&limit=10
router.get('/', superOddsCollectorController.listSuperOdds);

// Nova rota para listar as casas de apostas afiliadas para o dropdown de filtro no frontend
// Ex: GET /api/super-odds/providers
router.get('/providers', superOddsCollectorController.getSuperOddsProviders);

module.exports = router;