import axios from 'axios';
import type { Job } from './remotive.js';

// These typically require a company slug. For a general "matchmaker", 
// we might iterate over a list of known companies or allow users to suggest boards.
// Here we implement the base fetchers.

export async function fetchGreenhouseJobs(companySlug: string): Promise<Job[]> {
  try {
    const response = await axios.get(`https://boards-api.greenhouse.io/v1/boards/${companySlug}/jobs`);
    const jobs = response.data.jobs;
    return jobs.map((job: any) => ({
      id: `greenhouse-${companySlug}-${job.id}`,
      title: job.title,
      company_name: companySlug,
      url: job.absolute_url,
      category: job.departments?.[0]?.name || 'Engineering',
      description: '', // Greenhouse API list view doesn't include full description usually
      publication_date: job.updated_at,
      source: `Greenhouse (${companySlug})`,
    }));
  } catch (error: any) {
    console.error(`Error fetching Greenhouse jobs for ${companySlug}:`, error.message);
    return [];
  }
}

export async function fetchLeverJobs(companySlug: string): Promise<Job[]> {
  try {
    const response = await axios.get(`https://api.lever.co/v0/postings/${companySlug}`);
    const jobs = response.data;
    return jobs.map((job: any) => ({
      id: `lever-${companySlug}-${job.id}`,
      title: job.text,
      company_name: companySlug,
      url: job.hostedUrl,
      category: job.categories?.team || 'General',
      description: job.descriptionPlain || '',
      publication_date: new Date(job.createdAt).toISOString(),
      source: `Lever (${companySlug})`,
    }));
  } catch (error: any) {
    console.error(`Error fetching Lever jobs for ${companySlug}:`, error.message);
    return [];
  }
}
