import axios from 'axios';
import type { Job } from './remotive.js';

export async function fetchArbeitnowJobs(): Promise<Job[]> {
  try {
    const response = await axios.get('https://www.arbeitnow.com/api/job-board-api');
    const jobs = response.data.data;
    return jobs.map((job: any) => ({
      id: `arbeitnow-${job.slug}`,
      title: job.title,
      company_name: job.company_name,
      url: job.url,
      category: 'General',
      description: job.description,
      publication_date: new Date(job.created_at * 1000).toISOString(),
      source: 'Arbeitnow',
    }));
  } catch (error) {
    console.error('Error fetching Arbeitnow jobs:', error);
    return [];
  }
}
