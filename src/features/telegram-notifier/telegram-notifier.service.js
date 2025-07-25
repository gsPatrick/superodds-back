// src/features/telegram-notifier/telegram-notifier.service.js (COMPLETO E ATUALIZADO)
const axios = require('axios');
const db = require('../../models');
const { Op } = require('sequelize');
const moment = require('moment-timezone');

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
  console.warn('AVISO: Variáveis de ambiente TELEGRAM_BOT_TOKEN ou TELEGRAM_CHAT_ID não configuradas. Notificações do Telegram serão desativadas.');
}

// Função de utilidade para pausar a execução
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Envia uma mensagem para o Telegram, com tratamento de limite de requisições.
 * @param {string} text - O texto da mensagem a ser enviado.
 * @param {boolean} [disableWebPagePreview=false] - Desabilita a visualização de links na mensagem.
 */
async function sendTelegramMessage(text, disableWebPagePreview = false) { // Alterado para false para mostrar preview do link
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.warn('[TelegramNotifierService] Notificação do Telegram ignorada: token ou chat ID não configurados.');
    return;
  }

  try {
    console.log('[TelegramNotifierService] Enviando mensagem para o Telegram...');
    await axios.post(TELEGRAM_API_URL, {
      chat_id: TELEGRAM_CHAT_ID,
      text: text,
      parse_mode: 'Markdown',
      disable_web_page_preview: disableWebPagePreview,
    });
    console.log('[TelegramNotifierService] Mensagem enviada com sucesso para o Telegram.');
  } catch (error) {
    if (error.response) {
      if (error.response.status === 429) {
        const retryAfter = error.response.data.parameters?.retry_after || 5;
        console.warn(`[TelegramNotifierService] Limite de requisições do Telegram atingido. Reagendando envio após ${retryAfter} segundos.`);
        await sleep(retryAfter * 1000);
        return sendTelegramMessage(text, disableWebPagePreview);
      }
      console.error('[TelegramNotifierService] Erro ao enviar mensagem para o Telegram:', error.response.status, error.response.data);
    } else if (error.request) {
      console.error('[TelegramNotifierService] Nenhuma resposta recebida do Telegram API:', error.message);
    } else {
      console.error('[TelegramNotifierService] Erro ao configurar requisição para Telegram API:', error.message);
    }
    throw error;
  }
}

/**
 * Busca eventos do dia para compor a mensagem do Telegram.
 * @param {number} daysAhead - Quantos dias à frente para buscar eventos.
 * @returns {Promise<Array>} Lista de eventos com suas odds.
 */
async function getTodaysEventsForReport(daysAhead = 1) {
  const startOfToday = moment().tz('America/Sao_Paulo').startOf('day').toDate();
  const endOfTargetDay = moment().tz('America/Sao_Paulo').add(daysAhead, 'days').endOf('day').toDate();

  try {
    const events = await db.Event.findAll({
      where: {
        commenceTime: {
          [Op.between]: [startOfToday, endOfTargetDay],
        },
      },
      order: [['commenceTime', 'ASC']],
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
      limit: 10
    });
    return events;
  } catch (error) {
    console.error('[TelegramNotifierService] Erro ao buscar eventos normais do DB para o relatório:', error.message);
    return [];
  }
}

/**
 * Busca as super odds ativas para compor a mensagem do Telegram.
 * @param {number} limit - Limite de resultados.
 * @returns {Promise<Array>} Lista de super odds.
 */
async function getActiveSuperOddsForReport(limit = 5) {
  try {
    const now = new Date();
    const superOdds = await db.SuperOdd.findAll({
      where: {
        expireAtTimestamp: {
          [Op.gt]: now,
        },
      },
      order: [['boostedOdd', 'DESC']],
      limit: limit,
    });
    return superOdds;
  } catch (error) {
    console.error('[TelegramNotifierService] Erro ao buscar super odds do DB para o relatório:', error.message);
    return [];
  }
}


/**
 * Formata os dados dos eventos normais em uma mensagem Markdown.
 * @param {Array} events - Lista de objetos de evento com odds.
 * @returns {string} A mensagem formatada em Markdown.
 */
function formatNormalOddsMessage(events) {
  let message = '';
  if (events.length > 0) {
    message += `*⚽ Principais Jogos e Odds do Dia (${moment().tz('America/Sao_Paulo').format('DD/MM/YYYY')})*\n\n`;
    events.forEach(event => {
      const commenceTimeFormatted = moment(event.commenceTime).tz('America/Sao_Paulo').format('DD/MM HH:mm');
      message += `*${event.homeTeam} x ${event.awayTeam}* (${commenceTimeFormatted})\n`;
      message += `Sport: _${event.sportKey}_\n`;

      const sortedBookmakers = event.bookmakers.sort((a, b) => a.title.localeCompare(b.title));

      sortedBookmakers.forEach(bookmaker => {
        const homeOdd = bookmaker.outcomes.find(o => o.name === event.homeTeam);
        const awayOdd = bookmaker.outcomes.find(o => o.name === event.awayTeam);
        const drawOdd = bookmaker.outcomes.find(o => o.name === 'Draw' || o.name === 'draw');

        let oddsLine = '';
        if (homeOdd) oddsLine += ` ${homeOdd.price}`;
        if (drawOdd) oddsLine += ` | ${drawOdd.price}`;
        if (awayOdd) oddsLine += ` | ${awayOdd.price}`;

        if (oddsLine) {
          const bookmakerTitle = bookmaker.title.length > 15 ? bookmaker.title.substring(0, 12) + '...' : bookmaker.title;
          message += `  \`${bookmakerTitle}:\`${oddsLine} [Link](${bookmaker.affiliateLink})\n`;
        }
      });
      message += '\n';
    });
  }
  return message;
}

/**
 * Formata os dados das super odds em uma mensagem Markdown para o resumo diário.
 * @param {Array} superOdds - Lista de objetos SuperOdd.
 * @returns {string} A mensagem formatada em Markdown.
 */
function formatSuperOddsMessage(superOdds) {
  let message = '';
  if (superOdds.length > 0) {
    message += `*🔥 SUPER ODDS EM DESTAQUE! (Ativas)*\n\n`;
    superOdds.forEach(sOdd => {
      const expireTimeFormatted = moment(sOdd.expireAtTimestamp).tz('America/Sao_Paulo').format('DD/MM HH:mm');
      const gameNameDisplay = sOdd.gameName ? sOdd.gameName.replace(/ vs\.? /g, ' X ').replace(/ vs /g, ' X ').trim() : 'Evento Desconhecido';
      message += `⚡️ *${gameNameDisplay}*\n`;

      if (sOdd.selectionName) {
          message += `⚽️ ${sOdd.selectionName}`;
          if (sOdd.marketName && sOdd.marketName.toLowerCase() !== sOdd.selectionName.toLowerCase()) {
              message += `\n🎯 ${sOdd.marketName}`;
          }
      } else if (sOdd.marketName) {
          message += `⚽️ ${sOdd.marketName}`;
      }

      message += `\n💰 ${parseFloat(sOdd.originalOdd).toFixed(2)} 》 ${parseFloat(sOdd.boostedOdd).toFixed(2)}\n`;
      message += `*${sOdd.provider}*\n`;
      message += `👉 [CLIQUE AQUI](${sOdd.link})\n`;
      message += `Vence em: ${expireTimeFormatted}\n\n`;
    });
  }
  return message;
}

/**
 * Envia uma notificação concisa e formatada para uma única Super Odd.
 * @param {Object} superOdd - O objeto SuperOdd recém-criado.
 */
async function sendSuperOddAlert(superOdd) {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
        console.warn('[TelegramNotifierService] Alerta de Super Odd ignorado: token ou chat ID não configurados.');
        return;
    }

    console.log(`[TelegramNotifierService] Montando e enviando alerta para nova super odd: ${superOdd.id}`);

    const gameName = superOdd.gameName ? superOdd.gameName.replace(/ vs\.? /g, ' vs. ').replace(/ vs /g, ' vs. ').trim() : 'Evento Desconhecido';
    const expireTimeFormatted = moment(superOdd.expireAtTimestamp).tz('America/Sao_Paulo').format('DD/MM HH[h]mm');
    
    // Inicia a construção da mensagem seguindo o novo layout
    let message = `⚡️ *${gameName}*\n`;

    // Adiciona a seleção (⚽️)
    if (superOdd.selectionName) {
        message += `⚽️ ${superOdd.selectionName.trim()}\n`;
    }
    // Adiciona o mercado (🎯) se existir e for diferente da seleção
    if (superOdd.marketName && superOdd.marketName.toLowerCase() !== (superOdd.selectionName || '').toLowerCase()) {
        message += `🎯 ${superOdd.marketName.trim()}\n`;
    }

    // Adiciona a linha das odds
    message += `💰 ${parseFloat(superOdd.originalOdd).toFixed(2)}  》 *${parseFloat(superOdd.boostedOdd).toFixed(2)}*\n\n`; // Garantir 2 casas decimais

    // Adiciona o nome da casa de apostas e o link de afiliado
    message += `*${superOdd.provider}*\n`;
    message += `📲 [CLIQUE AQUI](${superOdd.link})\n\n`;

    // Adiciona a hora de expiração
    message += `⏰ Expira em: ${expireTimeFormatted}\n\n`;

    // Adiciona os avisos de responsabilidade
    message += `⚠️ Jogue com responsabilidade.\n`;
    message += `🔞 Apenas para maiores de 18 anos.`;

    // Envia a mensagem formatada para o Telegram
    await sendTelegramMessage(message, false);
}


/**
 * Funçao principal para disparar o resumo diário de todas as odds.
 * Esta função é para ser chamada por um CRON JOB SEPARADO, se necessário, e NÃO pelo coletor de odds.
 */
async function sendDailyOddsSummary() {
  console.log('[TelegramNotifierService] Iniciando envio do resumo diário de odds...');
  const normalEvents = await getTodaysEventsForReport();
  const activeSuperOdds = await getActiveSuperOddsForReport();

  let fullMessage = '';

  const normalOddsSection = formatNormalOddsMessage(normalEvents);
  if (normalOddsSection) {
    fullMessage += normalOddsSection;
  }

  const superOddsSection = formatSuperOddsMessage(activeSuperOdds);
  if (superOddsSection) {
    if (fullMessage) {
      fullMessage += '\n---\n\n';
    }
    fullMessage += superOddsSection;
  }

  if (!fullMessage) {
    fullMessage = `*📊 Resumo Diário de Odds - ${moment().tz('America/Sao_Paulo').format('DD/MM/YYYY')}*\n\n` +
                  'Nenhum evento ou super odd encontrada para hoje/amanhã.';
  } else {
    // REMOVIDO: Linha "Dados coletados via APIs de Odds e CraqueStats" e pré-visualização de link do resumo diário.
  }

  // ADICIONAR os avisos de responsabilidade para o resumo diário também, por boa prática
  fullMessage += `\n\n⚠️ Jogue com responsabilidade.\n`;
  fullMessage += `🔞 Apenas para maiores de 18 anos.`;

  await sendTelegramMessage(fullMessage, false);
}

module.exports = {
  sendDailyOddsSummary,
  sendSuperOddAlert,
};