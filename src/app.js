// src/app.js
require('dotenv').config();

const express = require('express');
const cors = require('cors'); // Importa o pacote cors
const cron = require('node-cron');
const mainRoutes = require('./routes/index');
const db = require('./models');
const oddsCollectorService = require('./features/odds-collector/odds-collector.service');
const superOddsCollectorService = require('./features/super-odds-collector/super-odds-collector.service');
const telegramNotifierService = require('./features/telegram-notifier/telegram-notifier.service');

const app = express();
const PORT = process.env.PORT || 3000;

// --- CONFIGURAÇÃO DO CORS ---
// Habilita o CORS para TODAS as origens e rotas.
// Em produção, você pode restringir a origem para o domínio do seu front-end:
// app.use(cors({ origin: 'https://seu-dominio-frontend.com' }));
app.use(cors()); // <--- ADICIONADO AQUI

// --- FIM DA CONFIGURAÇÃO DO CORS ---

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.send('API de Coleta de Odds em execução!');
});

app.use('/api', mainRoutes);

// Sincroniza o banco de dados e depois inicia o servidor
// ATENÇÃO: Se você precisar resetar o banco de dados, mude para 'force: true' temporariamente.
// MANTENHA 'force: false' para operação normal.
db.sequelize.sync({ force: false }) 
  .then(() => {
    console.log('Banco de dados sincronizado.');

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


    // 2. Cron Job para Coleta de SUPER ODDS (a cada 1 minuto)
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