// src/features/events/events.routes.js
const express = require('express');
const eventsController = require('./events.controller');
const router = express.Router();

// Rota para listar todos os eventos (com filtro opcional por data)
// Ex: GET /api/events?date=2025-07-25
router.get('/', eventsController.listEvents);

// Rota para obter odds detalhadas de um evento específico
// Ex: GET /api/events/SEU_EVENT_ID_AQUI/odds
router.get('/:id/odds', eventsController.getEventOddsDetails);

module.exports = router;