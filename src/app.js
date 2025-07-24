// src/app.js
require('dotenv').config();

const express = require('express');
const cron = require('node-cron');
const mainRoutes = require('./routes/index');
const db = require('./models');
const oddsCollectorService = require('./features/odds-collector/odds-collector.service');
const superOddsCollectorService = require('./features/super-odds-collector/super-odds-collector.service');
const telegramNotifierService = require('./features/telegram-notifier/telegram-notifier.service');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.send('API de Coleta de Odds em execução!');
});

app.use('/api', mainRoutes);

// Sincroniza o banco de dados e depois inicia o servidor
// ATENÇÃO: 'force: true' IRÁ APAGAR E RECRIAR AS TABELAS.
// USE APENAS PARA O SETUP INICIAL EM DESENVOLVIMENTO OU SE QUISER RESETAR O DB.
// REVERTA PARA 'force: false' APÓS A PRIMEIRA EXECUÇÃO BEM-SUCEDIDA.
db.sequelize.sync({ force: true }) // <--- ALTERADO PARA TRUE
  .then(() => {
    console.log('Banco de dados sincronizado (tabelas recriadas!).'); // Alerta de recriação

    // --- CONFIGURAÇÃO DOS CRON JOBS ---

    // 1. Cron Job para Coleta de Odds Normais (diário)
    // Roda à 00:00 (meia-noite) todos os dias.
    cron.schedule('0 0 * * *', async () => {
      console.log('Iniciando cron job: Coleta diária de odds normais...');
      try {
        await oddsCollectorService.fetchOdds('soccer', 'eu', 'h2h');
        console.log('Coleta diária de odds normais concluída.');
      } catch (error) {
        console.error('Erro no cron job de coleta de odds normais:', error.message);
      }
    }, {
      scheduled: true,
      timezone: "America/Sao_Paulo"
    });


    // 2. Cron Job para Coleta de SUPER ODDS (a cada 1 minuto para "tempo real")
    // Roda a cada 1 minuto.
    cron.schedule('* * * * *', async () => {
      console.log('Iniciando cron job: Coleta de super odds (a cada minuto)...');
      try {
        await superOddsCollectorService.fetchAndSaveSuperOdds();
        console.log('Coleta de super odds concluída.');
      } catch (error) {
        console.error('Erro no cron job de coleta de super odds:', error.message);
      }
    }, {
      scheduled: true,
      timezone: "America/Sao_Paulo"
    });


    // 3. Cron Job para Envio do Resumo Diário para o Telegram
    // Roda às 08:00 (8 da manhã) todos os dias.
    cron.schedule('0 8 * * *', async () => {
      console.log('Iniciando cron job: Envio de resumo diário para o Telegram...');
      try {
        await telegramNotifierService.sendDailyOddsSummary();
        console.log('Envio de resumo diário para o Telegram concluído.');
      } catch (error) {
        console.error('Erro no cron job de envio para o Telegram:', error.message);
      }
    }, {
      scheduled: true,
      timezone: "America/Sao_Paulo"
    });

    // --- FIM DA CONFIGURAÇÃO DOS CRON JOBS ---

    app.listen(PORT, () => {
      console.log(`Servidor Odds Collector API rodando na porta ${PORT}`);
      console.log(`Acesse: http://localhost:${PORT}`);
      console.log('Cron jobs agendados.');
    });
  })
  .catch(err => {
    console.error('Erro ao sincronizar o banco de dados:', err);
    process.exit(1);
  });

module.exports = app;