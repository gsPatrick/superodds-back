// src/features/super-odds-collector/super-odds-collector.controller.js (COMPLETO E ATUALIZADO)
const superOddsCollectorService = require('./super-odds-collector.service');

/**
 * Controller para disparar a coleta e salvamento de super odds.
 * GET /api/super-odds-collector/collect
 */
async function collectSuperOdds(req, res) {
  try {
    const count = await superOddsCollectorService.fetchAndSaveSuperOdds();
    res.status(200).json({
      message: `Coleta de super odds concluída. ${count} super odds processadas/salvas.`,
    });
  } catch (error) {
    console.error('Erro no controller de coleta de super odds:', error.message);
    res.status(500).json({
      message: 'Erro ao coletar super odds',
      error: error.message,
    });
  }
}

/**
 * Controller para listar as super odds disponíveis (não expiradas), com filtros e ordenação.
 * GET /api/super-odds
 * Query params:
 *   - provider: Nome da casa de aposta (ex: 'Superbet', 'EsportivaBet')
 *   - max_odd: Valor numérico para a odd máxima
 *   - sort_by: Critério de ordenação ('boosted_desc', 'boosted_asc', 'game_time_asc', 'game_time_desc', 'expire_asc', 'expire_desc')
 *   - hide_expired: 'true' ou 'false' (padrão é true)
 *   - limit: Número máximo de resultados (padrão 20)
 */
async function listSuperOdds(req, res) {
  const { provider, max_odd, sort_by, hide_expired, limit } = req.query;

  const filters = {
    provider: provider,
    maxOdd: max_odd ? parseFloat(max_odd) : undefined, // Converte para float
    sortBy: sort_by,
    // Converte 'true'/'false' string para boolean. Se não for fornecido, usa o padrão do service (true).
    hideExpired: hide_expired !== undefined ? hide_expired.toLowerCase() === 'true' : undefined,
  };

  try {
    const superOdds = await superOddsCollectorService.getLatestSuperOdds(filters, limit);
    res.status(200).json({
      message: 'Super odds recuperadas com sucesso.',
      count: superOdds.length,
      data: superOdds.map(odd => ({
          ...odd.toJSON(), // Converte o objeto Sequelize para JSON puro
          gameTimestamp: odd.gameTimestamp.toISOString(), // Garante que é um formato ISO para o frontend
          expireAtTimestamp: odd.expireAtTimestamp.toISOString(), // Garante que é um formato ISO
      })),
    });
  } catch (error) {
    console.error('Erro no controller ao listar super odds:', error.message);
    res.status(500).json({
      message: 'Erro ao listar super odds',
      error: error.message,
    });
  }
}

/**
 * Controller para retornar a lista de casas de apostas afiliadas para Super Odds.
 * GET /api/super-odds/providers
 */
async function getSuperOddsProviders(req, res) {
    try {
        const providers = superOddsCollectorService.getAffiliatedProvidersList();
        res.status(200).json({
            message: 'Lista de provedores de super odds recuperada com sucesso.',
            data: providers
        });
    } catch (error) {
        console.error('Erro no controller ao listar provedores de super odds:', error.message);
        res.status(500).json({
            message: 'Erro ao listar provedores de super odds',
            error: error.message,
        });
    }
}


module.exports = {
  collectSuperOdds,
  listSuperOdds,
  getSuperOddsProviders, // Exporta a nova função
};