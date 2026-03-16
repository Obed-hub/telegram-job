import TelegramBot from 'node-telegram-bot-api';
import * as dotenv from 'dotenv';
import { 
  saveUserSkills, 
  getUserSkills, 
  saveUserPreferences, 
  saveUserProfile, 
  updateUserState, 
  getUserState, 
  getUserProfile, 
  getUserPreferences, 
  saveJobInteraction, 
  getUserDoc,
  getJobByButtonId 
} from './firebase.js';
import { fetchAllJobs } from './api/index.js';
import { matchJob } from './matcher.js';
import { downloadTelegramFile, parseCVBuffer } from './parser.js';
import { generateCoverLetter, answerJobQnA, optimizeCVForJob } from './ai_service.js';
import { generatePaymentLink } from './payments.js';
import { incrementWeeklyInteractions } from './firebase.js';

dotenv.config();

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN!, { polling: false });

// Helper to wrap bot handlers in try-catch to prevent crashes
function catchAsync(fn: Function) {
  return async (...args: any[]) => {
    try {
      await fn(...args);
    } catch (err: any) {
      console.error('BOT ERROR:', err.message);
    }
  };
}

bot.onText(/\/start/, catchAsync(async (msg: TelegramBot.Message) => {
  const chatId = msg.chat.id;
  const welcomeText = `Welcome to Job Matchmaker! 🚀\n\nI can help you find remote jobs or freelance gigs that perfectly match your skills.\n\nType /help at any time to see all available commands.\n\nTo get started, what kind of opportunities are you looking for?`;
  
  const keyboard = {
    reply_markup: {
      inline_keyboard: [
        [
          { text: 'Full-time Jobs', callback_data: 'role_jobs' },
          { text: 'Freelance Gigs', callback_data: 'role_gigs' }
        ],
        [
          { text: 'Both', callback_data: 'role_both' }
        ]
      ]
    }
  };
  
  await bot.sendMessage(chatId, welcomeText, keyboard);
}));

bot.on('callback_query', catchAsync(async (query: TelegramBot.CallbackQuery) => {
  const chatId = query.message?.chat.id;
  if (!chatId) return;

  let data = query.data;
  if (!data) return;

  // Resolve buttonId if it's a job action
  if (data.startsWith('job_')) {
    const parts = data.split('_');
    const action = parts[1];
    const buttonId = parts[2];
    if (!buttonId) return bot.answerCallbackQuery(query.id, { text: 'Invalid job link.' });
    
    const job = await getJobByButtonId(buttonId);
    if (!job) {
      return bot.answerCallbackQuery(query.id, { text: 'Job not found or link expired.' });
    }
    // Reconstruct data with full ID for the rest of the logic
    data = `job_${action}_${job.id}`;
  }

  if (data.startsWith('role_')) {
    const roleType = (data.split('_')[1] || 'both') as 'jobs' | 'gigs' | 'both';
    await saveUserPreferences(chatId, { roleType });
    if (query.message?.message_id) {
      bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: query.message.message_id });
    }
    await bot.sendMessage(chatId, `Great! You're looking for *${roleType}*.\n\nTo give you the best matches, please upload your CV (PDF format). You can also use /uploadcv at any time to update it.`, { parse_mode: 'Markdown' });
    await updateUserState(chatId, 'awaiting_cv');
  } 
  else if (data === 'edit_profile') {
    await bot.sendMessage(chatId, 'What is your preferred role title? (e.g. Senior Backend Engineer)');
    await updateUserState(chatId, 'editing_preferred_role');
  } 
  else if (data === 'edit_prefs') {
    const keyboard = {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Junior', callback_data: 'seniority_junior' }, { text: 'Mid-Level', callback_data: 'seniority_mid' }],
          [{ text: 'Senior/Lead', callback_data: 'seniority_senior' }]
        ]
      }
    };
    await bot.sendMessage(chatId, 'What level of roles are you looking for?', keyboard);
  } 
  else if (data.startsWith('seniority_')) {
    const seniority = data.split('_')[1] as 'junior' | 'mid' | 'senior';
    await saveUserPreferences(chatId, { seniority });
    const keyboard = {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Fully Remote', callback_data: 'mode_remote' }],
          [{ text: 'Hybrid', callback_data: 'mode_hybrid' }],
          [{ text: 'On-site', callback_data: 'mode_onsite' }]
        ]
      }
    };
    await bot.editMessageText('Got it! Now, what is your preferred working mode?', { 
      chat_id: chatId, 
      message_id: query.message?.message_id, 
      reply_markup: keyboard.reply_markup 
    });
  } 
  else if (data.startsWith('mode_')) {
    const mode = data.split('_')[1] as 'remote' | 'hybrid' | 'onsite';
    await saveUserPreferences(chatId, { mode });
    const keyboard = {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Full-time', callback_data: 'pref_jobtype_full-time' }],
          [{ text: 'Contract', callback_data: 'pref_jobtype_contract' }],
          [{ text: 'Freelance', callback_data: 'pref_jobtype_freelance' }]
        ]
      }
    };
    await bot.editMessageText('Understood. What type of work do you prefer?', { 
      chat_id: chatId, 
      message_id: query.message?.message_id, 
      reply_markup: keyboard.reply_markup 
    });
  }
  else if (data.startsWith('job_')) {
    const parts = data.split('_');
    const action = parts[1];
    const jobId = parts.slice(2).join('_');
    if (!jobId) return;

    if (action === 'skip' || action === 'interested' || action === 'save') {
      await saveJobInteraction(chatId, jobId, action as any);
      if (query.message?.message_id) {
        await sendNextJob(chatId, query.message.message_id);
      } else {
        await sendNextJob(chatId);
      }
    } else if (action === 'details') {
      await showJobDetails(chatId, jobId, query.message?.message_id);
    } else if (action === 'cover') {
      if (!(await checkWeeklyLimit(chatId))) return;
      const user = await getUserProfile(chatId);
      const allJobs = await fetchAllJobs();
      const job = allJobs.find(j => j.id === jobId);
      if (job && user) {
        await bot.sendMessage(chatId, "AI is drafting your cover letter... ✍️");
        const letter = await generateCoverLetter(job.title, job.company_name, job.description, user);
        await bot.sendMessage(chatId, `✉️ *Your Custom Cover Letter:*\n\n${letter}`, { parse_mode: 'Markdown' });
      }
    } else if (action === 'qna') {
      if (!(await checkWeeklyLimit(chatId))) return;
      await bot.sendMessage(chatId, "Ask me anything about this job! (Type your matching question now)");
      await updateUserState(chatId, `qna_${jobId}`);
    } else if (action === 'fitcv') {
      const userDoc = await getUserDoc(chatId);
      if (!userDoc?.isPremium) {
        return bot.sendMessage(chatId, "⭐ *Premium Feature*\n\nCV Optimization is a premium feature. Use /upgrade to unlock it!", { parse_mode: 'Markdown' });
      }
      const allJobs = await fetchAllJobs();
      const job = allJobs.find(j => j.id === jobId);
      if (job) {
        if (await checkWeeklyLimit(chatId)) {
          await bot.sendMessage(chatId, "AI is optimizing your CV details for this specific application... 🪄");
          const optimized = await optimizeCVForJob(job.description, userDoc.profile);
          await bot.sendMessage(chatId, `✨ *Optimized CV Snapshot:*\n\n${optimized.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1')}`, { parse_mode: 'MarkdownV2' });
        }
      }
    }
  }
  else if (data === 'upgrade_premium') {
    const user = await getUserDoc(chatId);
    if (!user) return;
    await bot.sendMessage(chatId, "Generating your secure payment link... 💳");
    try {
      const link = await generatePaymentLink({
        chatId,
        email: user.profile?.email || 'user@example.com',
        name: user.profile?.name || 'Job Seeker',
        amount: 5000,
        currency: 'NGN'
      });
      await bot.sendMessage(chatId, `🚀 *Upgrade to Pro*\n\nPlease complete your payment via Flutterwave to unlock all features:\n\n[Click here to Pay](${link})`, { parse_mode: 'Markdown' });
    } catch (err: any) {
      bot.sendMessage(chatId, `❌ *Payment Error*\n\nDetails: ${err.message || 'Unknown error'}\n\nPlease try again later.`, { parse_mode: 'Markdown' });
    }
  }
  else if (data === 'close_message') {
    if (query.message?.message_id) {
       bot.deleteMessage(chatId, query.message.message_id);
    }
  }

  bot.answerCallbackQuery(query.id);
}));

bot.on('message', catchAsync(async (msg: TelegramBot.Message) => {
  const chatId = msg.chat.id;
  if (!msg.text) return;
  if (msg.text.startsWith('/') && !['/skip', '/cancel'].includes(msg.text)) return; 
  
  const state = await getUserState(chatId);
  if (!state) return;
  
  const text = msg.text.trim();
  const isSkip = text.toLowerCase() === '/skip';
  const isCancel = text.toLowerCase() === '/cancel';

  if (isCancel) {
    await updateUserState(chatId, null);
    return bot.sendMessage(chatId, 'Wizard cancelled. Use /profile to view your info.');
  }

  if (state === 'editing_preferred_role') {
    if (!isSkip) await saveUserProfile(chatId, { preferredRole: text });
    await bot.sendMessage(chatId, 'Current location? (e.g. London, UK, or Remote) /skip to leave unchanged.');
    await updateUserState(chatId, 'editing_location');
  } 
  else if (state === 'editing_location') {
    if (!isSkip) await saveUserProfile(chatId, { location: text });
    await bot.sendMessage(chatId, 'What are your top skills? (comma separated list) /skip to leave unchanged.');
    await updateUserState(chatId, 'editing_skills');
  }
  else if (state === 'editing_skills') {
    if (!isSkip) {
      const skills = text.split(',').map(s => s.trim()).filter(s => s.length > 0);
      await saveUserProfile(chatId, { skills });
    }
    await bot.sendMessage(chatId, 'Salary expectation? (e.g. $100k/year) /skip to leave unchanged.');
    await updateUserState(chatId, 'editing_salary_expectation');
  }
  else if (state === 'editing_salary_expectation') {
    if (!isSkip) await saveUserProfile(chatId, { salaryExpectation: text });
    const keyboard = {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Full-time', callback_data: 'profile_worktype_full-time' }],
          [{ text: 'Contract', callback_data: 'profile_worktype_contract' }],
          [{ text: 'Freelance', callback_data: 'profile_worktype_freelance' }]
        ]
      }
    };
    await bot.sendMessage(chatId, 'Preferred work type?', keyboard);
    await updateUserState(chatId, null);
  }
  else if (state && state.startsWith('qna_')) {
    const jobId = state.split('_')[1];
    if (!jobId) return;
    const user = await getUserProfile(chatId);
    const allJobs = await fetchAllJobs();
    const job = allJobs.find(j => j.id === jobId);
    
    if (job && user) {
      await bot.sendChatAction(chatId, 'typing');
      const answer = await answerJobQnA(text, job, user);
      await bot.sendMessage(chatId, `🤖 *AI Answer:*\n\n${answer}`, { parse_mode: 'Markdown' });
    }
  }
}));

bot.onText(/\/help/, catchAsync((msg: TelegramBot.Message) => {
  const chatId = msg.chat.id;
  const helpText = `Here are the available commands:\n\n/start - Restart the onboarding\n/uploadcv - Upload your resume\n/profile - View or edit your parsed profile\n/preferences - Update your job preferences\n/jobs - View matched jobs\n/saved - View jobs you've saved\n/upgrade - Upgrade to Premium for AI features`;
  bot.sendMessage(chatId, helpText);
}));

bot.onText(/\/upgrade/, catchAsync(async (msg: TelegramBot.Message) => {
  const chatId = msg.chat.id;
  const upgradeText = `⭐ *Job Matchmaker Pro*\n\nUpgrade to Pro to unlock unlimited access:\n\n` +
    `✅ Unlimited freelancer/gig work\n` +
    `✅ Unlimited remote jobs\n` +
    `✅ Visa-sponsored jobs\n` +
    `✅ AI CV tailoring\n` +
    `✅ Unlimited cover letters\n` +
    `✅ Unlimited Q&A answers\n\n` +
    `*Join today for early bird access!*`;
  
  const keyboard = {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🚀 Upgrade to Pro', callback_data: 'upgrade_premium' }],
        [{ text: 'Maybe Later', callback_data: 'close_message' }]
      ]
    }
  };
  
  await bot.sendMessage(chatId, upgradeText, { parse_mode: 'Markdown', ...keyboard });
}));

bot.onText(/\/debug_pay/, catchAsync(async (msg: TelegramBot.Message) => {
  const chatId = msg.chat.id;
  try {
     const { getFlw } = await import('./payments.js');
     const flwInstance = getFlw();
     if (!flwInstance) {
       return bot.sendMessage(chatId, "Status: SDK NOT Initialized. Keys missing?");
     }
     const keys = Object.keys(flwInstance);
     const status = `✅ SDK Initialized\nProperties: ${keys.join(', ')}\n\nEnv check:\nPUBLIC: ${process.env.FLW_PUBLIC_KEY ? 'OK' : 'MISSING'}\nSECRET: ${process.env.FLW_SECRET_KEY ? 'OK' : 'MISSING'}`;
     bot.sendMessage(chatId, status);
  } catch (err: any) {
     bot.sendMessage(chatId, `Error in debug: ${err.message}`);
  }
}));

bot.onText(/\/uploadcv/, catchAsync(async (msg: TelegramBot.Message) => {
  const chatId = msg.chat.id;
  await updateUserState(chatId, 'awaiting_cv');
  bot.sendMessage(chatId, 'Please upload your CV in PDF format now. I will parse it to create your profile.');
}));

bot.on('document', catchAsync(async (msg: TelegramBot.Message) => {
  const chatId = msg.chat.id;
  const state = await getUserState(chatId);
  const document = msg.document;

  if (state !== 'awaiting_cv' || document?.mime_type !== 'application/pdf') {
    return;
  }

  bot.sendMessage(chatId, 'Processing your CV... ⏳');
  
  try {
    const file = await bot.getFile(document.file_id);
    if (!file.file_path) throw new Error("Could not retrieve file path.");

    const fileBuffer = await downloadTelegramFile(file.file_path);
    const parsedData = await parseCVBuffer(fileBuffer);
    await saveUserProfile(chatId, parsedData);
    await updateUserState(chatId, null);
    
    const successMsg = `✅ Upload successful!\n\nI extracted the following information:\n` +
      `*Name:* ${parsedData.name || 'Not found'}\n` +
      `*Email:* ${parsedData.email || 'Not found'}\n` +
      `*Skills:* ${parsedData.skills?.join(', ') || 'Not found'}\n\n` +
      `If this looks incomplete, you can edit it via /profile. Use /matches to see your first recommendations!`;
      
    bot.sendMessage(chatId, successMsg, { parse_mode: 'Markdown' });
  } catch (error: any) {
    console.error('CV Parsing Error:', error);
    bot.sendMessage(chatId, 'Sorry, I had trouble parsing that PDF. Please try a different file or update your profile manually using /profile.');
  }
}));

bot.onText(/\/profile/, catchAsync(async (msg: TelegramBot.Message) => {
  const chatId = msg.chat.id;
  const userDoc = await getUserDoc(chatId);

  if (!userDoc || (!userDoc.profile && !userDoc.preferences)) {
    return bot.sendMessage(chatId, 'You haven\'t set up a profile yet. Use /start to begin or /uploadcv to upload a resume.');
  }

  const profileText = `*Your Profile*\n\n` +
    `*Name:* ${userDoc.profile?.name || 'Not set'}\n` +
    `*Email:* ${userDoc.profile?.email || 'Not set'}\n` +
    `*Role:* ${userDoc.profile?.preferredRole || 'Not set'}\n` +
    `*Location:* ${userDoc.profile?.location || 'Not set'}\n\n` +
    `*Status:* ${userDoc.isPremium ? '⭐ Premium Member' : 'Free Tier'}\n`;

  const inline_keyboard = [
    [{ text: '✏️ Edit Profile', callback_data: 'edit_profile' }, { text: '⚙️ Edit Preferences', callback_data: 'edit_prefs' }]
  ];

  if (!userDoc.isPremium) {
    inline_keyboard.push([{ text: '🚀 Upgrade to Premium', callback_data: 'upgrade_premium' }]);
  }

  bot.sendMessage(chatId, profileText, { 
    parse_mode: 'Markdown', 
    reply_markup: { inline_keyboard } 
  });
}));

bot.onText(/\/preferences/, catchAsync(async (msg: TelegramBot.Message) => {
  const chatId = msg.chat.id;
  const keyboard = {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Junior', callback_data: 'seniority_junior' }, { text: 'Mid-Level', callback_data: 'seniority_mid' }],
        [{ text: 'Senior/Lead', callback_data: 'seniority_senior' }]
      ]
    }
  };
  await bot.sendMessage(chatId, 'Let\'s update your job preferences. First, what level of roles are you looking for?', keyboard);
}));

bot.onText(/\/saved/, catchAsync(async (msg: TelegramBot.Message) => {
  const chatId = msg.chat.id;
  const user = await getUserDoc(chatId);
  const savedJobIds = user?.savedJobs || [];

  if (savedJobIds.length === 0) {
    return bot.sendMessage(chatId, 'You haven\'t saved any jobs yet.');
  }

  bot.sendMessage(chatId, 'Loading your saved jobs... ⏳');
  const allJobs = await fetchAllJobs();
  const savedJobs = allJobs.filter(job => savedJobIds.includes(job.id));

  let response = `⭐ *Your Saved Jobs* (${savedJobs.length})\n\n`;
  response += savedJobs.map(job => `*${job.title}* @ ${job.company_name}\nURL: ${job.url}\n`).join('\n').replace(/([_\[\]()~`>#+\-=|{}.!])/g, '\\$1');

  bot.sendMessage(chatId, response, { parse_mode: 'MarkdownV2', disable_web_page_preview: true });
}));

bot.onText(/\/matches|\/jobs/, catchAsync(async (msg: TelegramBot.Message) => {
  const chatId = msg.chat.id;
  await sendNextJob(chatId);
}));

async function sendNextJob(chatId: number, messageIdToEdit?: number) {
  const user = await getUserDoc(chatId);
  if (!user) return bot.sendMessage(chatId, 'Please run /start first.');

  const swipedJobs = new Set(user.swipedJobs || []);
  const savedJobs = new Set(user.savedJobs || []);
  const allJobs = await fetchAllJobs();
  
  let matches = allJobs.map(job => ({ job, match: matchJob(job, user) }))
                         .filter(res => res.match.score > 0 && !swipedJobs.has(res.job.id) && !savedJobs.has(res.job.id))
                         .sort((a, b) => b.match.score - a.match.score);

  if (user.isPremium && user.preferences?.onlyVisaSponsored) {
    matches = matches.filter(m => isVisaSponsored(m.job));
  }

  if (matches.length === 0) {
    const msgText = 'No new matches found right now.';
    if (messageIdToEdit) return bot.editMessageText(msgText, { chat_id: chatId, message_id: messageIdToEdit });
    return bot.sendMessage(chatId, msgText);
  }

  const nextMatch = matches[0]!;
  const job = nextMatch.job;
  const jobCard = `💼 *${job.title}*\n🏢 *${job.company_name}*\n\n🔥 *Match Score:* ${nextMatch.match.score}%`;

  const keyboard = {
    reply_markup: {
      inline_keyboard: [
        [{ text: '👎 Skip', callback_data: `job_skip_${job.buttonId || job.id}` }, { text: '👍 Interested', callback_data: `job_interested_${job.buttonId || job.id}` }],
        [{ text: '⭐ Save for Later', callback_data: `job_save_${job.buttonId || job.id}` }, { text: '📄 Details', callback_data: `job_details_${job.buttonId || job.id}` }]
      ]
    }
  };

  const formattedMsg = jobCard.replace(/([_\[\]()~`>#+\-=|{}.!])/g, '\\$1');
  if (messageIdToEdit) {
    bot.editMessageText(formattedMsg, { chat_id: chatId, message_id: messageIdToEdit, parse_mode: 'MarkdownV2', ...keyboard });
  } else {
    bot.sendMessage(chatId, formattedMsg, { parse_mode: 'MarkdownV2', ...keyboard });
  }
}

async function showJobDetails(chatId: number, jobId: string, messageIdToEdit?: number) {
  const allJobs = await fetchAllJobs();
  const job = allJobs.find(j => j.id === jobId);
  if (!job) return bot.sendMessage(chatId, 'Job not found.');

  const detailText = `💼 *${job.title}*\n🏢 *${job.company_name}*\n\nURL: ${job.url}`;
  const keyboard = {
    reply_markup: {
      inline_keyboard: [
        [{ text: '✍️ Cover Letter', callback_data: `job_cover_${job.buttonId || job.id}` }, { text: '❓ Q&A', callback_data: `job_qna_${job.buttonId || job.id}` }],
        [{ text: '✨ Fit CV (Premium)', callback_data: `job_fitcv_${job.buttonId || job.id}` }],
        [{ text: '⬅️ Back', callback_data: `job_skip_${job.buttonId || job.id}` }]
      ]
    }
  };

  const formattedMsg = detailText.replace(/([_\[\]()~`>#+\-=|{}.!])/g, '\\$1');
  if (messageIdToEdit) {
    bot.editMessageText(formattedMsg, { chat_id: chatId, message_id: messageIdToEdit, parse_mode: 'MarkdownV2', ...keyboard });
  } else {
    bot.sendMessage(chatId, formattedMsg, { parse_mode: 'MarkdownV2', ...keyboard });
  }
}

async function checkWeeklyLimit(chatId: number): Promise<boolean> {
  const user = await getUserDoc(chatId);
  if (user?.isPremium) return true;
  const count = await incrementWeeklyInteractions(chatId);
  if (count > 10) {
    await bot.sendMessage(chatId, "Weekly limit reached. Upgrade to Pro!");
    return false;
  }
  return true;
}

function isVisaSponsored(job: any): boolean {
  const text = (job.title + ' ' + (job.description || '')).toLowerCase();
  return text.includes('visa sponsorship') || text.includes('visa sponsored');
}

export default bot;
