const eventsService = require('./events.service');

/**
 * Controller para listar eventos.
 * GET /api/events?date=YYYY-MM-DD
 */
async function listEvents(req, res) {
  const { date } = req.query; // Permite filtrar por data

  // Validação básica da data (opcional, pode ser mais robusta)
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ message: 'Formato de data inválido. Use YYYY-MM-DD.' });
  }

  try {
    const events = await eventsService.getEvents(date);
    res.status(200).json({
      message: 'Eventos recuperados com sucesso.',
      count: events.length,
      data: events,
    });
  } catch (error) {
    console.error('Erro no controller ao listar eventos:', error.message);
    res.status(500).json({
      message: 'Erro ao listar eventos',
      error: error.message,
    });
  }
}

/**
 * Controller para obter detalhes de odds de um evento específico.
 * GET /api/events/:id/odds
 */
async function getEventOddsDetails(req, res) {
  const { id } = req.params; // ID do evento da URL

  try {
    const eventOdds = await eventsService.getEventOdds(id);
    if (!eventOdds) {
      return res.status(404).json({ message: 'Evento não encontrado.' });
    }
    res.status(200).json({
      message: 'Odds do evento recuperadas com sucesso.',
      data: eventOdds,
    });
  } catch (error) {
    console.error(`Erro no controller ao buscar odds do evento ${id}:`, error.message);
    res.status(500).json({
      message: 'Erro ao recuperar odds do evento',
      error: error.message,
    });
  }
}

module.exports = {
  listEvents,
  getEventOddsDetails,
}