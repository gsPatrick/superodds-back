// src/routes/index.js
const express = require('express');
const router = express.Router();

// Importa as rotas das funcionalidades
const oddsCollectorRoutes = require('../features/odds-collector/odds-collector.routes');
const eventsRoutes = require('../features/events/events.routes');
const superOddsCollectorRoutes = require('../features/super-odds-collector/super-odds-collector.routes'); // NOVA IMPORTAÇÃO

router.get('/', (req, res) => {
  res.json({ message: 'Bem-vindo à API Odds Collector!' });
});

// Rotas para coleta e listagem de odds "normais"
router.use('/odds-collector', oddsCollectorRoutes);
router.use('/events', eventsRoutes);

// Rotas para coleta e listagem de SUPER ODDS
// Ex: /api/super-odds-collector/collect (para disparar coleta)
// Ex: /api/super-odds (para o frontend listar)
router.use('/super-odds', superOddsCollectorRoutes); // NOVA ROTA ADICIONADA

module.exports = router;