// src/features/super-odds-collector/super-odds-collector.service.js (COMPLETO E ATUALIZADO)
const axios = require('axios');
const db = require('../../models');
const { Op } = require('sequelize');
const moment = require('moment-timezone');
const telegramNotifierService = require('../telegram-notifier/telegram-notifier.service');
const SUPER_ODDS_AFFILIATED_PROVIDERS = require('../constants/superOddsProviders'); // Importa a constante

const SUPER_ODDS_API_URL = 'https://api.craquestats.com.br/api/super_odds';


/**
 * Busca as super odds da API externa e as salva no banco de dados.
 * @returns {Promise<number>} O número de super odds salvas/atualizadas.
 */
async function fetchAndSaveSuperOdds() {
  try {
    console.log('[SuperOddsCollectorService] Buscando super odds da CraqueStats API...');
    const response = await axios.get(SUPER_ODDS_API_URL);

    if (response.data && response.data.data && response.data.status_code === 200) {
      const superOddsData = response.data.data;
      console.log(`[SuperOddsCollectorService] ${superOddsData.length} super odds encontradas.`);

      let processedCount = 0;

      for (const superOdd of superOddsData) {
        try {
          const gameTimestamp = moment.unix(superOdd.game_timestamp).toDate();
          const expireAtTimestamp = moment.unix(superOdd.expire_at_timestamp).toDate();

          // Filtra odds que já expiraram
          if (new Date() >= expireAtTimestamp) {
            continue;
          }

          // --- NOVO: Obtém o link de afiliado do nosso mapa centralizado ---
          // Verifica se o provedor está na nossa lista de afiliados e pega o link
          const affiliatedProviderInfo = SUPER_ODDS_AFFILIATED_PROVIDERS[superOdd.provider_id];
          if (!affiliatedProviderInfo) {
              console.warn(`[SuperOddsCollectorService] Provedor '${superOdd.provider_id}' não está na lista de afiliados configurados. Pulando esta super odd.`);
              continue;
          }
          const affiliateLink = affiliatedProviderInfo.link;
          // --- FIM NOVO ---

          // Cria ou encontra a Super Odd no banco de dados
          const [dbSuperOdd, created] = await db.SuperOdd.findOrCreate({
            where: { id: superOdd.unique_key },
            defaults: {
              provider: superOdd.provider,
              link: affiliateLink, // AGORA USA O NOSSO LINK DE AFILIADO
              sportId: superOdd.sport_id,
              boostedOdd: parseFloat(superOdd.boosted_odd),
              originalOdd: parseFloat(superOdd.original_odd),
              descriptionForSeo: superOdd.description_for_seo,
              providerId: superOdd.provider_id, // Salva o provider_id para fácil filtragem
              marketName: superOdd.market_name,
              selectionName: superOdd.selection_name,
              competitionName: superOdd.competition_name,
              gameTimestamp: gameTimestamp,
              gameName: superOdd.game_name,
              expireAtTimestamp: expireAtTimestamp,
            },
          });

          if (!created) {
            // Se já existe, atualiza os dados
            await dbSuperOdd.update({
              provider: superOdd.provider,
              link: affiliateLink, // Garante que o link de afiliado seja sempre o nosso
              sportId: superOdd.sport_id,
              boostedOdd: parseFloat(superOdd.boosted_odd),
              originalOdd: parseFloat(superOdd.original_odd),
              descriptionForSeo: superOdd.description_for_seo,
              providerId: superOdd.provider_id,
              marketName: superOdd.market_name,
              selectionName: superOdd.selection_name,
              competitionName: superOdd.competition_name,
              gameTimestamp: gameTimestamp,
              expireAtTimestamp: expireAtTimestamp,
            });
            console.log(`[SuperOddsCollectorService] Super odd ${superOdd.unique_key} atualizada.`);
          } else {
            console.log(`[SuperOddsCollectorService] Nova super odd salva: ${superOdd.unique_key}`);
            await telegramNotifierService.sendSuperOddAlert(dbSuperOdd);
          }
          processedCount++;

        } catch (dbError) {
          console.error(`[SuperOddsCollectorService] ERRO ao processar ou salvar super odd ${superOdd.unique_key} no banco de dados:`, dbError.message);
        }
      }
      return processedCount;

    } else {
      console.error('[SuperOddsCollectorService] Erro na resposta da CraqueStats API:', response.data);
      throw new Error('CraqueStats API retornou um erro ou dados inválidos.');
    }
  } catch (error) {
    if (error.response) {
      console.error('[SuperOddsCollectorService] Erro na requisição à CraqueStats API:', error.response.status, error.response.data);
      throw new Error(`Erro na API CraqueStats: Status ${error.response.status} - ${error.response.data.message || 'Erro desconhecido'}`);
    } else if (error.request) {
      console.error('[SuperOddsCollectorService] Nenhuma resposta recebida da CraqueStats API:', error.message);
      throw new Error('Não foi possível conectar à CraqueStats API. Verifique sua conexão com a internet ou a URL da API.');
    } else {
      console.error('[SuperOddsCollectorService] Erro ao configurar requisição para CraqueStats API ou erro interno:', error.message);
      throw new Error(`Erro interno no serviço de coleta de super odds: ${error.message}`);
    }
  }
}

/**
 * Retorna as super odds mais recentes do banco de dados, aplicando filtros e ordenação.
 * @param {Object} filters - Objeto contendo os filtros.
 * @param {string} [filters.provider] - Nome do provedor para filtrar.
 * @param {number} [filters.maxOdd] - Odd máxima permitida.
 * @param {string} [filters.sortBy] - Critério de ordenação ('boosted_desc', 'boosted_asc', 'expire_asc', 'expire_desc').
 * @param {boolean} [filters.hideExpired=true] - Se true, oculta odds já expiradas.
 * @param {number} [limit] - Limite de resultados.
 * @returns {Promise<Array>} Lista de objetos SuperOdd.
 */
async function getLatestSuperOdds(filters = {}, limit = 20) {
  const { provider, maxOdd, sortBy, hideExpired = true } = filters;
  const whereClause = {};
  const orderClause = [];

  // 1. Filtrar por casas de apostas (somente as afiliadas e, opcionalmente, uma específica)
  const affiliatedProviderIds = Object.keys(SUPER_ODDS_AFFILIATED_PROVIDERS);
  whereClause.providerId = {
      [Op.in]: affiliatedProviderIds // Garante que só liste casas afiliadas
  };

  if (provider && provider !== 'Todas') { // 'Todas' é o valor padrão da UI, não filtrar se for ele
    // Para filtrar por nome de provedor (display name), pois o frontend envia o nome
    whereClause.provider = provider;
  }

  // 2. Filtrar por odd máxima
  if (maxOdd) {
    whereClause.boostedOdd = {
      [Op.lte]: parseFloat(maxOdd),
    };
  }

  // 3. Ocultar odds expiradas (padrão é ocultar, se hideExpired for false, mostra todas)
  if (hideExpired) {
    whereClause.expireAtTimestamp = {
      [Op.gt]: new Date(),
    };
  }

  // 4. Ordenar
  switch (sortBy) {
    case 'boosted_desc':
      orderClause.push(['boostedOdd', 'DESC']);
      break;
    case 'boosted_asc':
      orderClause.push(['boostedOdd', 'ASC']);
      break;
    case 'game_time_asc': // Novo critério: por data de início do jogo
      orderClause.push(['gameTimestamp', 'ASC']);
      break;
    case 'game_time_desc': // Novo critério: por data de início do jogo
        orderClause.push(['gameTimestamp', 'DESC']);
        break;
    case 'expire_asc': // Por data de expiração (útil para ver as que vão sair do ar)
        orderClause.push(['expireAtTimestamp', 'ASC']);
        break;
    case 'expire_desc': // Por data de expiração (útil para ver as que vão sair do ar)
        orderClause.push(['expireAtTimestamp', 'DESC']);
        break;
    default: // Padrão: por data de expiração ascendente, depois pela boostedOdd descendente
      orderClause.push(['expireAtTimestamp', 'ASC']);
      orderClause.push(['boostedOdd', 'DESC']);
      break;
  }

  try {
    const superOdds = await db.SuperOdd.findAll({
      where: whereClause,
      order: orderClause,
      limit: parseInt(limit), // Garante que o limite seja um número
    });
    return superOdds;
  } catch (error) {
    console.error('[SuperOddsCollectorService] Erro ao buscar super odds do banco de dados com filtros:', error.message);
    throw new Error('Não foi possível recuperar as super odds com os filtros aplicados.');
  }
}

/**
 * Retorna uma lista de todas as casas de apostas afiliadas configuradas.
 * Útil para popular o dropdown de filtros no frontend.
 * @returns {Array<{id: string, name: string}>} Lista de provedores.
 */
function getAffiliatedProvidersList() {
    return Object.entries(SUPER_ODDS_AFFILIATED_PROVIDERS).map(([id, data]) => ({
        id: id,
        name: data.name
    }));
}


module.exports = {
  fetchAndSaveSuperOdds,
  getLatestSuperOdds,
  getAffiliatedProvidersList, // Exporta a nova função
};