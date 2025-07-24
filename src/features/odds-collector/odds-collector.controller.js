// src/features/odds-collector/odds-collector.controller.js
const oddsCollectorService = require('./odds-collector.service');

/**
 * Controller para disparar a coleta de odds.
 * Esta rota é principalmente para testes e pode ser substituída por um cron job.
 */
async function collectOdds(req, res) {
  // Os parâmetros podem vir do corpo da requisição ou serem fixos para o cron job.
  // Por simplicidade, vamos usar valores padrão ou do query.
  const { sport, region, market, bookmakers } = req.query; // Permite sobrescrever via query params

  try {
    // Exemplo: Coletar odds para futebol (soccer) no mercado europeu (eu) para head-to-head (h2h)
    // Você pode parametrizar isso se quiser coletar para vários esportes/regiões/mercados.
    const collectedOdds = await oddsCollectorService.fetchOdds(
      sport || 'soccer', // Padrão: futebol
      region || 'eu',     // Padrão: europa
      market || 'h2h',    // Padrão: head-to-head
      bookmakers          // Casas de apostas padrão definidas no service, ou sobrescritas
    );

    // TODO: A resposta pode ser mais elaborada, informando o que foi salvo, etc.
    res.status(200).json({
      message: 'Coleta de odds iniciada com sucesso (ou concluída se não houver salvamento)',
      data: collectedOdds, // Para visualização, remover em produção se os dados forem muito grandes
      count: collectedOdds.length,
    });
  } catch (error) {
    console.error('Erro no controller de coleta de odds:', error.message);
    res.status(500).json({
      message: 'Erro ao coletar odds',
      error: error.message,
    });
  }
}

/**
 * Controller para listar os esportes disponíveis.
 */
async function listSports(req, res) {
  try {
    const sports = await oddsCollectorService.getAvailableSports();
    res.status(200).json({
      message: 'Esportes disponíveis',
      data: sports,
    });
  } catch (error) {
    console.error('Erro no controller ao listar esportes:', error.message);
    res.status(500).json({
      message: 'Erro ao listar esportes',
      error: error.message,
    });
  }
}

module.exports = {
  collectOdds,
  listSports,
};