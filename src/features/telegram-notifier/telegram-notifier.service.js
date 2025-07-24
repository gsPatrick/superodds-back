// src/features/telegram-notifier/telegram-notifier.service.js
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

/**
 * Envia uma mensagem para o Telegram.
 * @param {string} text - O texto da mensagem a ser enviado.
 * @param {boolean} [disableWebPagePreview=true] - Desabilita a visualização de links na mensagem.
 */
async function sendTelegramMessage(text, disableWebPagePreview = true) {
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
      console.error('[TelegramNotifierService] Erro ao enviar mensagem para o Telegram:', error.response.status, error.response.data);
    } else if (error.request) {
      console.error('[TelegramNotifierService] Nenhuma resposta recebida do Telegram API:', error.message);
    } else {
      console.error('[TelegramNotifierService] Erro ao configurar requisição para Telegram API:', error.message);
    }
  }
}

/**
 * Busca eventos do dia para compor a mensagem do Telegram.
 * Pega eventos que começam hoje ou nos próximos N dias (ajustável).
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
      limit: 10 // Limitar o número de eventos para evitar mensagens muito longas
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
          [Op.gt]: now, // Garante que a odd ainda não expirou
        },
      },
      order: [['boostedOdd', 'DESC']], // Ordena as maiores odds primeiro
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
      message += `⚡️ *${gameNameDisplay}*\n`; // Jogo primeiro, com emoji de raio

      // Lógica para display do mercado e seleção similar ao alerta individual, mas mais compacto
      if (sOdd.selectionName && sOdd.selectionName.toLowerCase() !== sOdd.marketName?.toLowerCase()) {
          message += `  ⚽️ ${sOdd.selectionName}\n`;
          if (sOdd.marketName) {
              message += `  🎯 ${sOdd.marketName}\n`;
          }
      } else if (sOdd.marketName) {
          message += `  ⚽️ ${sOdd.marketName}\n`;
      } else if (sOdd.selectionName) {
          message += `  ⚽️ ${sOdd.selectionName}\n`;
      }


      message += `  💰 ${sOdd.originalOdd} 》 ${sOdd.boostedOdd}\n`;
      message += `  *${sOdd.provider}*\n`;
      message += `  👉 [CLIQUE AQUI](${sOdd.link})\n`;
      message += `  Vence em: ${expireTimeFormatted}\n\n`;
    });
  }
  return message;
}

/**
 * Envia uma notificação concisa e formatada para uma única Super Odd, similar ao exemplo da imagem.
 * @param {Object} superOdd - O objeto SuperOdd recém-criado.
 */
async function sendSuperOddAlert(superOdd) {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
        console.warn('[TelegramNotifierService] Alerta de Super Odd ignorado: token ou chat ID não configurados.');
        return;
    }

    // Garante que o nome do jogo seja formatado como no exemplo "Time A X Time B"
    const cleanedGameName = superOdd.gameName ? superOdd.gameName.replace(/ vs\.? /g, ' X ').replace(/ vs /g, ' X ').trim() : 'Evento Desconhecido';

    let message = `⚡️ *${cleanedGameName}*\n`; // Lightning bolt e nome do jogo em negrito

    // Adiciona o nome da seleção e o nome do mercado, com emojis apropriados
    // A ordem e qual campo é exibido primeiro pode variar, baseando-se no exemplo da imagem.
    // O exemplo mostra '2:0' (selection_name) e depois 'Resultado Correto' (market_name).
    // Vou usar selectionName e, se marketName for diferente e existir, adicioná-lo.
    if (superOdd.selectionName) {
        message += `⚽️ ${superOdd.selectionName}`;
        if (superOdd.marketName && superOdd.marketName.toLowerCase() !== superOdd.selectionName.toLowerCase()) { // Evita duplicar se forem iguais
            message += `\n🎯 ${superOdd.marketName}`;
        }
    } else if (superOdd.marketName) { // Se não tiver selectionName mas tiver marketName
        message += `⚽️ ${superOdd.marketName}`;
    }

    // Odds original e turbinada, com emoji de dinheiro e '》'
    message += `\n💰 ${superOdd.originalOdd} 》 ${superOdd.boostedOdd}`;

    // Nome da casa de aposta
    message += `\n\n*${superOdd.provider}*\n`;

    // Chamada para ação com link de afiliado
    message += `👉 [CLIQUE AQUI](${superOdd.link})`;

    // Disclaimer de responsabilidade
    message += `\nJogue com responsabilidade`;

    // A informação de expiração não está diretamente no bloco da imagem,
    // mas é crucial para super odds. Vou mantê-la no final.
    const expireTimeFormatted = moment(superOdd.expireAtTimestamp).tz('America/Sao_Paulo').format('DD/MM HH:mm');
    message += `\nVálido até: ${expireTimeFormatted}`;


    console.log(`[TelegramNotifierService] Enviando alerta para nova super odd: ${superOdd.unique_key}`);
    await sendTelegramMessage(message, false); // Desabilita preview de link para ficar mais limpo visualmente
}


/**
 * Funçao principal para disparar o resumo diário de todas as odds.
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
      fullMessage += '\n---\n\n'; // Separador entre seções
    }
    fullMessage += superOddsSection;
  }

  if (!fullMessage) {
    fullMessage = `*📊 Resumo Diário de Odds - ${moment().tz('America/Sao_Paulo').format('DD/MM/YYYY')}*\n\n` +
                  'Nenhum evento ou super odd encontrada para hoje/amanhã.';
  } else {
    fullMessage += `\n\n_Dados coletados via APIs de Odds e CraqueStats_ [${moment().tz('America/Sao_Paulo').format('HH:mm')}]`;
  }

  await sendTelegramMessage(fullMessage, false);
}

module.exports = {
  sendDailyOddsSummary,
  sendSuperOddAlert,
};