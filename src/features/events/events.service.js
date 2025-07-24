// src/features/events/events.service.js
const db = require('../../models');
const { Op } = require('sequelize'); // Importa o Op para operadores de consulta

/**
 * Retorna uma lista de eventos com dados básicos, com opcional filtro por data.
 * @param {string} [date] - Data no formato YYYY-MM-DD para filtrar eventos por dia de início.
 * @returns {Promise<Array>} Lista de eventos.
 */
async function getEvents(date) {
  const whereClause = {};

  if (date) {
    // Para filtrar por um dia específico, precisamos de um range de data e hora
    const startOfDay = new Date(`${date}T00:00:00.000Z`);
    const endOfDay = new Date(`${date}T23:59:59.999Z`);
    whereClause.commenceTime = {
      [Op.between]: [startOfDay, endOfDay],
    };
  } else {
    // Se nenhuma data for fornecida, busca eventos que ainda não começaram ou estão próximos
    // Por exemplo, eventos que começam no futuro ou nas últimas 24 horas (ajuste conforme necessidade)
    const now = new Date();
    // Exemplo: Buscar eventos que iniciam a partir de agora
    whereClause.commenceTime = {
      [Op.gte]: now,
    };
  }

  try {
    const events = await db.Event.findAll({
      where: whereClause,
      order: [['commenceTime', 'ASC']], // Ordena por data de início
      attributes: ['id', 'sportKey', 'homeTeam', 'awayTeam', 'commenceTime'], // Campos básicos
    });
    return events;
  } catch (error) {
    console.error('Erro ao buscar eventos do banco de dados:', error.message);
    throw new Error('Não foi possível recuperar os eventos.');
  }
}

/**
 * Retorna detalhes completos de um evento, incluindo odds das casas e outcomes.
 * @param {string} eventId - O ID do evento.
 * @returns {Promise<Object|null>} O objeto do evento com suas odds, ou null se não encontrado.
 */
async function getEventOdds(eventId) {
  try {
    const event = await db.Event.findByPk(eventId, {
      include: [
        {
          model: db.BookmakerOdds,
          as: 'bookmakers',
          include: [
            {
              model: db.Outcome,
              as: 'outcomes',
            },
          ],
        },
      ],
    });
    return event;
  } catch (error) {
    console.error(`Erro ao buscar odds para o evento ${eventId}:`, error.message);
    throw new Error('Não foi possível recuperar as odds do evento.');
  }
}

module.exports = {
  getEvents,
  getEventOdds,
};