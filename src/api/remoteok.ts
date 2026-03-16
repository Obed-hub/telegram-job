import axios from 'axios';
import type { Job } from './remotive.js';

export async function fetchRemoteOKJobs(): Promise<Job[]> {
  try {
    const response = await axios.get('https://remoteok.com/api');
    // RemoteOK returns an array where the first item is a legal notice/meta info
    const jobs = Array.isArray(response.data) ? response.data.slice(1) : [];
    return jobs.map((job: any) => ({
      id: `remoteok-${job.id}`,
      title: job.position,
      company_name: job.company,
      url: job.url,
      category: job.tags?.join(', ') || 'Remote',
      description: job.description,
      publication_date: job.date,
      source: 'RemoteOK',
    }));
  } catch (error) {
    console.error('Error fetching RemoteOK jobs:', error);
    return [];
  }
}
