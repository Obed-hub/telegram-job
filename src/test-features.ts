import { fetchLinkedInJobs } from './api/linkedin_scraper.js';
import { generateCoverLetter } from './ai_service.js';

async function test() {
  console.log('--- Testing LinkedIn Scraper ---');
  const jobs = await fetchLinkedInJobs('Node.js Developer', 'Remote');
  console.log(`Found ${jobs.length} jobs on LinkedIn.`);
  if (jobs.length > 0) {
    console.log('First job:', jobs[0]?.title, '@', jobs[0]?.company_name);
  }

  console.log('\n--- Testing AI Cover Letter (Sample) ---');
  const mockUser = {
    skills: ['Node.js', 'React', 'TypeScript'],
    preferredRole: 'Fullstack Engineer'
  };
  
  try {
    const letter = await generateCoverLetter(
      'Software Engineer', 
      'Tech Corp', 
      'We are looking for a Node.js expert...', 
      mockUser
    );
    console.log('Generated Letter Preview (first 100 chars):');
    console.log(letter.substring(0, 100) + '...');
  } catch (e: any) {
    console.log('AI Test skipped or failed (check keys):', e.message);
  }
}

test();
