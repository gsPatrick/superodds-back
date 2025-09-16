// src/features/odds-collector/odds-collector.service.js
const axios = require('axios');
const db = require('../../models'); // Importa os modelos do banco de dados
const telegramNotifierService = require('../telegram-notifier/telegram-notifier.service'); // Importa o serviço do Telegram

// As chaves da API e URL base devem vir das variáveis de ambiente
const ODDS_API_BASE_URL = 'https://api.odds-api.io/v2';
const ODDS_API_KEY = process.env.ODDS_API_KEY;

if (!ODDS_API_KEY) {
  console.error('ERRO: A variável de ambiente ODDS_API_KEY não está configurada.');
  process.exit(1);
}

// Mapeamento dos links de afiliado fixos
const AFFILIATE_LINKS = {
  'stake': 'https://bdeal.io/stake/116387/1',
  'bet365': 'https://bdeal.io/bet365/132044/1', // Substitua pelo link real da Bet365 no bdeal.io
  'superbet': 'https://bdeal.io/Superbet/110998/1',
  'mcgames': 'https://bdeal.io/mcgames/125292/1',
  'betano': 'https://bdeal.io/Betano/124683/1',
  'betfair': 'https://bdeal.io/Betfair/61765/1',
  'kto': 'https://bdeal.io/kto/127471/1',
  'novibet': 'https://bdeal.io/Superbet/110998/1', // Verifique se este é o link correto para Novibet
  'betmgm': 'https://bdeal.io/betmgm/123274/1',
  'betsson': 'https://bdeal.io/Betsson/127093/1',
  'bateubet': 'https://bdeal.io/BateuBet/119087/1' ,
  'esportivabet': 'https://bdeal.io/EsportivaBet/128422/1' ,
};


/**
 * Busca os esportes disponíveis na Odds-API.io.
 * @returns {Promise<Array>} Uma promessa que resolve para uma lista de esportes.
 */
async function getAvailableSports() {
  try {
    const response = await axios.get(`${ODDS_API_BASE_URL}/sports`, {
      params: {
        apiKey: ODDS_API_KEY,
      },
    });
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error('[OddsCollectorService] Erro na requisição à Odds-API.io (getAvailableSports):', error.response.status, error.response.data);
      throw new Error(`Erro na API: ${error.response.status} - ${error.response.data.message || 'Erro desconhecido'}`);
    } else {
      console.error('[OddsCollectorService] Erro ao buscar esportes disponíveis:', error.message);
      throw new Error('Não foi possível buscar os esportes. Verifique a chave da API e a conexão.');
    }
  }
}

/**
 * Busca as odds para um esporte específico, região e mercado e as salva no banco de dados.
 * Após o salvamento, dispara o envio do resumo para o Telegram.
 * @param {string} sportKey - A chave do esporte (ex: 'soccer', 'basketball_nba').
 * @param {string} region - A região das odds (ex: 'eu', 'us', 'uk').
 * @param {string} market - O mercado de aposta (ex: 'h2h', 'spreads', 'totals').
 * @param {string} [bookmakersCsv] - CSV de chaves de bookmakers para filtrar (opcional).
 * @returns {Promise<number>} Uma promessa que resolve para o número de eventos salvos/atualizados.
 */
async function fetchOdds(
  sportKey,
  region = 'eu',
  market = 'h2h',
  bookmakersCsv = 'bet365,betfair,betmgm,betano,superbet,mcgames,novibet,kto,betsson,stake'
) {
  try {
    console.log(`[OddsCollectorService] Buscando odds para ${sportKey}, região ${region}, mercado ${market}...`);
    const response = await axios.get(`${ODDS_API_BASE_URL}/odds`, {
      params: {
        apiKey: ODDS_API_KEY,
        sport: sportKey,
        regions: region,
        mkt: market,
        dateFormat: 'iso',
        oddsFormat: 'decimal',
        bookmakers: bookmakersCsv,
      },
    });

    if (response.data.success) {
      const oddsData = response.data.data;
      console.log(`[OddsCollectorService] Odds encontradas para ${oddsData.length} eventos.`);

      let processedEventsCount = 0;

      for (const event of oddsData) {
        try {
          const [dbEvent, created] = await db.Event.findOrCreate({
            where: { id: event.id },
            defaults: {
              sportKey: event.sport_key,
              homeTeam: event.home_team,
              awayTeam: event.away_team,
              commenceTime: new Date(event.commence_time),
            },
          });

          if (created) {
            console.log(`[OddsCollectorService] Novo evento salvo: ${event.home_team} vs ${event.away_team}`);
            processedEventsCount++;
          } else {
            await dbEvent.update({
              sportKey: event.sport_key,
              homeTeam: event.home_team,
              awayTeam: event.away_team,
              commenceTime: new Date(event.commence_time),
            });
            console.log(`[OddsCollectorService] Evento atualizado: ${event.home_team} vs ${event.away_team}`);
          }

          for (const bookmaker of event.bookmakers) {
            const h2hMarket = bookmaker.markets.find(m => m.key === 'h2h');
            if (!h2hMarket) {
              console.warn(`[OddsCollectorService] Mercado H2H não encontrado para a casa ${bookmaker.key} no evento ${event.id}. Ignorando esta casa.`);
              continue;
            }

            const affiliateLink = AFFILIATE_LINKS[bookmaker.key] || null;

            if (!affiliateLink) {
                console.warn(`[OddsCollectorService] Link de afiliado não encontrado para a casa: ${bookmaker.key}. Pulando esta casa.`);
                continue;
            }

            const [dbBookmakerOdds, bmCreated] = await db.BookmakerOdds.findOrCreate({
              where: {
                eventId: dbEvent.id,
                key: bookmaker.key,
              },
              defaults: {
                title: bookmaker.title,
                lastUpdate: new Date(bookmaker.last_update),
                affiliateLink: affiliateLink,
              },
            });

            if (!bmCreated) {
              await dbBookmakerOdds.update({
                title: bookmaker.title,
                lastUpdate: new Date(bookmaker.last_update),
                affiliateLink: affiliateLink,
              });
              console.log(`  [OddsCollectorService] Odds da casa ${bookmaker.title} para o evento ${event.id} atualizadas.`);
            } else {
              console.log(`  [OddsCollectorService] Odds da casa ${bookmaker.title} para o evento ${event.id} salvas.`);
            }

            await db.Outcome.destroy({ where: { bookmakerOddsId: dbBookmakerOdds.id } });

            const outcomePromises = h2hMarket.outcomes.map(outcome =>
              db.Outcome.create({
                name: outcome.name,
                price: parseFloat(outcome.price),
                bookmakerOddsId: dbBookmakerOdds.id,
              })
            );
            await Promise.all(outcomePromises);
            console.log(`    [OddsCollectorService] Outcomes para ${bookmaker.title} salvos/atualizados.`);
          }
        } catch (dbError) {
          console.error(`[OddsCollectorService] ERRO ao processar ou salvar evento ${event.id} (${event.home_team} vs ${event.away_team}) no banco de dados:`, dbError.message);
        }
      }

      // --- CHAMA O SERVIÇO DO TELEGRAM AQUI ---
      // A chamada ao Telegram pode ser feita aqui, após a coleta e salvamento.
      // Em um cenário real, você pode querer um CRON JOB separado para enviar o resumo diário,
      // para que a coleta e o envio não estejam estritamente acoplados e possam ter horários diferentes.
      // Por enquanto, vamos acoplar para demonstrar a funcionalidade.
      await telegramNotifierService.sendDailyOddsSummary();
      // --- FIM DA CHAMADA ---

      return processedEventsCount;
    } else {
      console.error('[OddsCollectorService] Erro na resposta da Odds-API.io (success: false):', response.data.message);
      throw new Error(`A API Odds-API.io retornou um erro: ${response.data.message || 'Erro desconhecido.'}`);
    }
  } catch (error) {
    if (error.response) {
      console.error('[OddsCollectorService] Erro na requisição à Odds-API.io:', error.response.status, error.response.data);
      throw new Error(`Erro na API Odds-API.io: Status ${error.response.status} - ${error.response.data.message || 'Erro desconhecido'}`);
    } else if (error.request) {
      console.error('[OddsCollectorService] Nenhuma resposta recebida da Odds-API.io:', error.message);
      throw new Error('Não foi possível conectar à Odds-API.io. Verifique sua conexão com a internet ou a URL da API.');
    } else {
      console.error('[OddsCollectorService] Erro ao configurar a requisição para Odds-API.io ou erro interno:', error.message);
      throw new Error(`Erro interno no serviço de coleta de odds: ${error.message}`);
    }
  }
}

module.exports = {
  getAvailableSports,
  fetchOdds,
};
