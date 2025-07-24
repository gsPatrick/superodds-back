// src/features/super-odds-collector/super-odds-collector.service.js (COMPLETO E CORRIGIDO)
const axios = require('axios');
const db = require('../../models');
const { Op } = require('sequelize');
const moment = require('moment-timezone');
const telegramNotifierService = require('../telegram-notifier/telegram-notifier.service');
const SUPER_ODDS_AFFILIATED_PROVIDERS = require('../constants/superOddsProviders');

const SUPER_ODDS_API_URL = 'https://api.craquestats.com.br/api/super_odds';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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

          // MUDANÇA: Não vamos mais pular as expiradas aqui, a API precisa delas.
          // A lógica de pular será feita apenas na busca se o filtro for ativado.
          // if (new Date() >= expireAtTimestamp) {
          //   continue;
          // }

          const affiliatedProviderInfo = SUPER_ODDS_AFFILIATED_PROVIDERS[superOdd.provider_id];
          
          if (!affiliatedProviderInfo) {
              console.warn(`[SuperOddsCollectorService] Provedor '${superOdd.provider_id}' não está na lista de afiliados. Pulando super odd.`);
              continue;
          }
          const affiliateLink = affiliatedProviderInfo.link;

          const [dbSuperOdd, created] = await db.SuperOdd.findOrCreate({
            where: { id: superOdd.unique_key },
            defaults: {
              provider: superOdd.provider,
              link: affiliateLink,
              sportId: superOdd.sport_id,
              boostedOdd: parseFloat(superOdd.boosted_odd),
              originalOdd: parseFloat(superOdd.original_odd),
              descriptionForSeo: superOdd.description_for_seo,
              providerId: superOdd.provider_id,
              marketName: superOdd.market_name,
              selectionName: superOdd.selection_name,
              competitionName: superOdd.competition_name,
              gameTimestamp: gameTimestamp,
              gameName: superOdd.game_name,
              expireAtTimestamp: expireAtTimestamp,
            },
          });

          if (!created) {
            await dbSuperOdd.update({
              provider: superOdd.provider,
              link: affiliateLink,
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
            // console.log(`[SuperOddsCollectorService] Super odd ${superOdd.unique_key} atualizada.`); // Log opcional
          } else {
            console.log(`[SuperOddsCollectorService] Nova super odd salva: ${superOdd.unique_key}`);
            await telegramNotifierService.sendSuperOddAlert(dbSuperOdd);
            await sleep(200);
          }
          processedCount++;

        } catch (dbError) {
          console.error(`[SuperOddsCollectorService] ERRO ao processar ou salvar super odd ${superOdd.unique_key} no banco de dados:`, dbError.message);
          await sleep(50);
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
    } else {
      console.error('[SuperOddsCollectorService] Erro ao configurar requisição para CraqueStats API ou erro interno:', error.message);
    }
    throw error;
  }
}

/**
 * Retorna as super odds do banco de dados com filtros.
 * @param {Object} filters - Objeto de filtros.
 * @param {number} [limit] - Limite de resultados (opcional).
 * @returns {Promise<Array>} Lista de objetos SuperOdd.
 */
// MUDANÇA: Removido o 'limit = 20' padrão
async function getLatestSuperOdds(filters = {}, limit) { 
  // MUDANÇA: 'hideExpired' agora é 'false' por padrão
  const { provider, maxOdd, sortBy, hideExpired = false } = filters; 
  const whereClause = {};
  const orderClause = [];

  const affiliatedProviderIds = Object.keys(SUPER_ODDS_AFFILIATED_PROVIDERS);
  whereClause.providerId = {
      [Op.in]: affiliatedProviderIds
  };

  if (provider && provider !== 'Todas') {
    whereClause.provider = provider;
  }

  if (maxOdd) {
    whereClause.boostedOdd = {
      [Op.lte]: parseFloat(maxOdd),
    };
  }

  // A lógica de filtro agora só é aplicada se `hideExpired` for explicitamente `true`
  if (hideExpired) {
    whereClause.expireAtTimestamp = {
      [Op.gt]: new Date(),
    };
  }

  switch (sortBy) {
    case 'boosted_desc':
      orderClause.push(['boostedOdd', 'DESC']);
      break;
    case 'boosted_asc':
      orderClause.push(['boostedOdd', 'ASC']);
      break;
    case 'game_time_asc':
      orderClause.push(['gameTimestamp', 'ASC']);
      break;
    case 'game_time_desc':
        orderClause.push(['gameTimestamp', 'DESC']);
        break;
    case 'expire_asc':
        orderClause.push(['expireAtTimestamp', 'ASC']);
        break;
    case 'expire_desc':
        orderClause.push(['expireAtTimestamp', 'DESC']);
        break;
    default:
      // MUDANÇA: Ordenação padrão alterada para mostrar as que expiram mais tarde primeiro,
      // garantindo que as ativas e relevantes apareçam no topo.
      orderClause.push(['expireAtTimestamp', 'DESC']);
      orderClause.push(['boostedOdd', 'DESC']);
      break;
  }

  try {
    const superOdds = await db.SuperOdd.findAll({
      where: whereClause,
      order: orderClause,
      // MUDANÇA: O 'limit' só será aplicado se for passado um valor
      limit: limit ? parseInt(limit) : undefined,
    });
    return superOdds;
  } catch (error) {
    console.error('[SuperOddsCollectorService] Erro ao buscar super odds do banco de dados com filtros:', error.message);
    throw new Error('Não foi possível recuperar as super odds com os filtros aplicados.');
  }
}

function getAffiliatedProvidersList() {
    return Object.entries(SUPER_ODDS_AFFILIATED_PROVIDERS).map(([id, data]) => ({
        id: id,
        name: data.name
    }));
}

module.exports = {
  fetchAndSaveSuperOdds,
  getLatestSuperOdds,
  getAffiliatedProvidersList,
};