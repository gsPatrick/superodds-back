// src/features/super-odds-collector/super-odds-collector.controller.js (COMPLETO E ATUALIZADO)
const superOddsCollectorService = require('./super-odds-collector.service');

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

async function listSuperOdds(req, res) {
  const { provider, max_odd, sort_by, hide_expired, limit } = req.query;

  const filters = {
    provider: provider,
    maxOdd: max_odd ? parseFloat(max_odd) : undefined,
    sortBy: sort_by,
    // MUDANÇA: Esta lógica agora funciona corretamente com o novo padrão do serviço.
    // Se 'hide_expired' for 'true', ele será ativado. Se for 'false' ou ausente, as expiradas aparecerão.
    hideExpired: hide_expired ? hide_expired.toLowerCase() === 'true' : false,
  };

  try {
    // MUDANÇA: Passa o 'limit' da query para o serviço. Se não houver, 'limit' será undefined e nenhum limite será aplicado.
    const superOdds = await superOddsCollectorService.getLatestSuperOdds(filters, limit);
    res.status(200).json({
      message: 'Super odds recuperadas com sucesso.',
      count: superOdds.length,
      data: superOdds.map(odd => ({
          ...odd.toJSON(),
          gameTimestamp: odd.gameTimestamp ? odd.gameTimestamp.toISOString() : null, // Adiciona verificação de nulidade
          expireAtTimestamp: odd.expireAtTimestamp.toISOString(),
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
  getSuperOddsProviders,
};