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
          } else {
            console.log(`[SuperOddsCollectorService] Nova super odd salva: ${superOdd.unique_key}`);
            
            if (new Date() < dbSuperOdd.expireAtTimestamp) {
              await telegramNotifierService.sendSuperOddAlert(dbSuperOdd);
              await sleep(200);
            } else {
              console.log(`[SuperOddsCollectorService] Nova super odd ${superOdd.unique_key} já está expirada. Não será notificada no Telegram.`);
            }
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

async function getLatestSuperOdds(filters = {}, limit) { 
  const { provider, maxOdd, sortBy, hideExpired = false } = filters; 
  const whereClause = {};
  let orderClause = [];

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
    // MUDANÇA CRÍTICA: 'expire_asc' agora é tratado pela lógica default
    // para garantir a priorização de odds ativas.
    // O 'expire_asc' vindo do front será pego pelo default.
    case 'expire_desc':
        orderClause.push(['expireAtTimestamp', 'DESC']);
        break;
    default:
      // ORDENAÇÃO PADRÃO CORRIGIDA E INTELIGENTE
      // 1. Prioridade 1: Agrupa as odds em ATIVAS (valor 1) e EXPIRADAS (valor 2). Ordena por este grupo.
      orderClause.push([db.sequelize.literal('CASE WHEN "expireAtTimestamp" > NOW() THEN 1 ELSE 2 END'), 'ASC']);
      
      // 2. Prioridade 2: Para as odds ATIVAS (grupo 1), ordena pela data de expiração mais PRÓXIMA (ASC).
      orderClause.push([db.sequelize.literal('CASE WHEN "expireAtTimestamp" > NOW() THEN "expireAtTimestamp" END'), 'ASC']);
      
      // 3. Prioridade 3: Para as odds EXPIRADAS (grupo 2), ordena pela data que expirou mais RECENTEMENTE (DESC).
      orderClause.push([db.sequelize.literal('CASE WHEN "expireAtTimestamp" <= NOW() THEN "expireAtTimestamp" END'), 'DESC']);
      break;
  }

  try {
    const superOdds = await db.SuperOdd.findAll({
      where: whereClause,
      order: orderClause,
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