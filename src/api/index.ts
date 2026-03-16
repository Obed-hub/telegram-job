import { fetchRemotiveJobs } from './remotive.js';
import type { Job } from './remotive.js';
import { fetchArbeitnowJobs } from './arbeitnow.js';
import { fetchRemoteOKJobs } from './remoteok.js';
import { fetchGreenhouseJobs, fetchLeverJobs } from './boards.js';
import { fetchLinkedInJobs } from './linkedin_scraper.js';

const TRACKED_COMPANIES = {
  greenhouse: ['stripe', 'airbnb', 'discord', 'dropbox'],
  lever: ['figma', 'vercel', 'notion', 'replit']
};

export async function fetchAllJobs(): Promise<Job[]> {
  console.log('Fetching all jobs...');
  
  const [remotive, arbeitnow, remoteok, linkedin] = await Promise.all([
    fetchRemotiveJobs(),
    fetchArbeitnowJobs(),
    fetchRemoteOKJobs(),
    fetchLinkedInJobs()
  ]);

  const greenhousePromises = TRACKED_COMPANIES.greenhouse.map(slug => fetchGreenhouseJobs(slug));
  const leverPromises = TRACKED_COMPANIES.lever.map(slug => fetchLeverJobs(slug));

  const greenhouseResults = await Promise.all(greenhousePromises);
  const leverResults = await Promise.all(leverPromises);

  const allJobs = [
    ...remotive,
    ...arbeitnow,
    ...remoteok,
    ...linkedin,
    ...greenhouseResults.flat(),
    ...leverResults.flat()
  ];

  console.log(`Fetched total of ${allJobs.length} jobs.`);
  return allJobs;
}
