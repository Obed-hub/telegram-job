import express from 'express';
import cron from 'node-cron';
import bot from './bot.js';
import { fetchAllJobs } from './api/index.js';
import { getAllUsers, saveJob, isJobProcessed, checkDatabaseConnection, db } from './firebase.js';
import { matchJob } from './matcher.js';

const app = express();
app.use(express.json());

// Webhook for Flutterwave
app.post('/webhook/flutterwave', async (req, res) => {
  const secretHash = process.env.FLW_WEBHOOK_HASH;
  const signature = req.headers['verif-hash'];

  if (!signature || signature !== secretHash) {
    return res.status(401).send('Invalid signature');
  }

  const { status, tx_ref } = req.body.data || req.body;

  if (status === 'successful') {
    const chatId = tx_ref.split('_')[1];
    if (chatId) {
      try {
        await db.collection('users').doc(chatId).update({ isPremium: true });
        await bot.sendMessage(chatId, "🎉 *Payment Received!*\n\nYou are now a *Pro Member*. All premium features are unlocked!", { parse_mode: 'Markdown' });
      } catch (err) {
        console.error(`Error upgrading user ${chatId}:`, err);
      }
    }
  }
  res.status(200).send('Webhook processed');
});

// Health check
app.get('/health', (req, res) => res.send('OK'));

// Send a daily summary of matches to all users
async function sendDailyDigest() {
  console.log('Running daily job digest...');
  try {
    const allJobs = await fetchAllJobs();
    const users = await getAllUsers();
    
    // Filter jobs from last 24h
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentJobs = allJobs.filter(j => new Date(j.publication_date) >= dayAgo);

    if (recentJobs.length === 0) return;

    for (const user of users) {
      const topMatches = recentJobs
        .map(job => ({ job, match: matchJob(job, user) }))
        .filter(res => res.match.score >= 50)
        .sort((a, b) => b.match.score - a.match.score)
        .slice(0, 5);

      if (topMatches.length > 0) {
        let digestMsg = `📅 *Your Daily Job Digest*\n\nHere are your top matches from the last 24 hours:\n\n`;
        digestMsg += topMatches.map(m => `🔹 *${m.job.title}* @ ${m.job.company_name} (${m.match.score}%)`).join('\n');
        digestMsg += `\n\nUse /jobs to see full details!`;
        
        await bot.sendMessage(user.chatId, digestMsg, { parse_mode: 'Markdown' }).catch(err => console.error(`Digest fail for ${user.chatId}:`, err));
      }
    }
  } catch (error) {
    console.error('Error in daily digest:', error);
  }
}

// Background task to poll for jobs every 3 hours
async function pollJobs() {
  console.log('Starting background job poll...');
  try {
    const jobs = await fetchAllJobs();
    const users = await getAllUsers();

    for (const job of jobs) {
      if (!(await isJobProcessed(job.id))) {
        await saveJob(job);
        const jobDate = new Date(job.publication_date);
        const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        if (jobDate < dayAgo) continue;

        for (const user of users) {
          const matchResult = matchJob(job, user as import('./firebase.js').UserDoc);
          if (matchResult.score >= 75) {
            const message = `*New High Match Found! 🌟*\n\n*${job.title}*\n🏢 ${job.company_name}\n🎯 Match Score: ${matchResult.score}%\n\nURL: ${job.url}`;
            await bot.sendMessage(user.chatId, message.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1'), { parse_mode: 'MarkdownV2' })
              .catch(() => {});
          }
        }
      }
    }
  } catch (error) {
    console.error('Error in pollJobs:', error);
  }
}

// Global error handlers to prevent process crashes
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

async function startBot() {
  try {
    await checkDatabaseConnection();
    const PORT = Number(process.env.PORT) || 3000;
    app.listen(PORT, '0.0.0.0', () => console.log(`Server on port ${PORT}`));

    await bot.startPolling();
    console.log('Bot is running...');
    
    pollJobs();
    setInterval(pollJobs, 1000 * 60 * 60 * 3);

    // Schedule daily digest at 9:00 AM
    cron.schedule('0 9 * * *', sendDailyDigest);
    
  } catch (err: any) {
    console.error('CRITICAL STARTUP ERROR:', err.message);
    process.exit(1);
  }
}

startBot();

process.once('SIGINT', () => bot.stopPolling({ reason: 'SIGINT' }));
process.once('SIGTERM', () => bot.stopPolling({ reason: 'SIGTERM' }));
