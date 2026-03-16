import axios from 'axios';

export interface Job {
  id: string;
  buttonId?: string;
  title: string;
  company_name: string;
  url: string;
  category: string;
  description: string;
  publication_date: string;
  source: string;
}

export async function fetchRemotiveJobs(): Promise<Job[]> {
  try {
    const response = await axios.get('https://remotive.com/api/remote-jobs');
    const jobs = response.data.jobs;
    return jobs.map((job: any) => ({
      id: `remotive-${job.id}`,
      title: job.title,
      company_name: job.company_name,
      url: job.url,
      category: job.category,
      description: job.description,
      publication_date: job.publication_date,
      source: 'Remotive',
    }));
  } catch (error) {
    console.error('Error fetching Remotive jobs:', error);
    return [];
  }
}
