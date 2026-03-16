import { fetchAllJobs } from './api/index.js';
import { matchJob } from './matcher.js';

async function dryRun() {
  console.log('--- Job Matchmaker Dry Run ---');
  const testUser: import('./firebase.js').UserDoc = {
    chatId: 123,
    profile: {
       skills: ['typescript', 'react', 'remote', 'node']
    },
    preferences: {
       mode: 'remote',
       roleType: 'jobs'
    },
    updatedAt: new Date(),
  };

  console.log(`Testing with profile skills: ${testUser.profile.skills.join(', ')} and mode: ${testUser.preferences.mode}`);

  try {
    const allJobs = await fetchAllJobs();
    const matchResults = allJobs.map(job => ({ job, score: matchJob(job, testUser).score }))
                                .filter(res => res.score >= 50);

    console.log(`\nFound ${matchResults.length} matches:`);
    matchResults.slice(0, 10).forEach(res => {
      console.log(`- [${res.job.source}] ${res.job.title} @ ${res.job.company_name} (Score: ${res.score}%)`);
      console.log(`  URL: ${res.job.url}\n`);
    });

    if (matchResults.length > 10) {
      console.log(`... and ${matchResults.length - 10} more.`);
    }
  } catch (error) {
    console.error('Dry run failed:', error);
  }
}

dryRun();
