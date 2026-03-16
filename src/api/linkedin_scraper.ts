import axios from 'axios';
import type { Job } from './remotive.js';

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
];

export async function fetchLinkedInJobs(keyword: string = 'Software Engineer', location: string = 'Remote'): Promise<Job[]> {
  try {
    // Try the guest API first
    const url = `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings?keywords=${encodeURIComponent(keyword)}&location=${encodeURIComponent(location)}&start=0`;
    
    const userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      } as any,
      timeout: 10000
    });

    const html = response.data;
    const jobs: Job[] = [];
    
    // Improved regex-based extraction
    const jobCards = html.match(/<div class="base-search-card__info">([\s\S]*?)<\/div>/g) || [];

    for (const card of jobCards) {
      const titleMatch = card.match(/<h3 class="base-search-card__title">\s*([\s\S]*?)\s*<\/h3>/);
      const companyMatch = card.match(/<h4 class="base-search-card__subtitle">\s*([\s\S]*?)\s*<\/h4>/);
      // Try to find the link in the parent element if possible, or use a heuristic
      const urlMatch = html.match(/<a class="base-card__full-link" href="(.*?)"/);
      
      if (titleMatch && companyMatch) {
         const title = titleMatch[1].trim();
         const company = companyMatch[1].replace(/<[^>]*>?/gm, '').trim();
         const jobUrl = urlMatch ? urlMatch[1].split('?')[0] : `https://www.linkedin.com/jobs/search?keywords=${encodeURIComponent(keyword)}`;
         const id = `linkedin-${Math.random().toString(36).substr(2, 9)}`;

         jobs.push({
           id,
           title,
           company_name: company,
           url: jobUrl,
           category: 'LinkedIn Job',
           description: 'Click link to view specific details on LinkedIn. Guest view limits apply.',
           publication_date: new Date().toISOString(),
           source: 'LinkedIn'
         });
      }
    }

    console.log(`LinkedIn Scraper: Found ${jobs.length} jobs.`);
    return jobs;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
       console.warn('LinkedIn Guest API returned 404. It may be restricted in this region/IP.');
    } else {
       console.error('Error scraping LinkedIn jobs:', (error as any).message);
    }
    return [];
  }
}
