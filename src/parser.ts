import axios from 'axios';
import { PDFParse } from 'pdf-parse';
import * as dotenv from 'dotenv';
import type { UserProfile } from './firebase.js';

dotenv.config();

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

/**
 * Downloads a file from Telegram given its file_path.
 */
export async function downloadTelegramFile(filePath: string): Promise<Buffer> {
  const url = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${filePath}`;
  const response = await axios.get(url, { responseType: 'arraybuffer' });
  return Buffer.from(response.data, 'binary');
}

/**
 * Parses a PDF buffer and extracts structural data using basic Regex/Heuristics.
 */
export async function parseCVBuffer(buffer: Buffer): Promise<Partial<UserProfile>> {
  try {
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    const text = result.text;
    
    return extractProfileFromText(text);
  } catch (error) {
    console.error('Failed to parse PDF:', error);
    throw new Error('Failed to parse the PDF document.');
  }
}

function extractProfileFromText(text: string): Partial<UserProfile> {
  const profile: Partial<UserProfile> = {};
  
  // Basic Regex Extractors
  const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/i;
  const emailMatch = text.match(emailRegex);
  if (emailMatch && emailMatch[1]) profile.email = emailMatch[1];
  
  // Very rough phone regex, usually localized
  const phoneRegex = /(?:\+?\d{1,3}[\s-]?)?\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{4}/;
  const phoneMatch = text.match(phoneRegex);
  if (phoneMatch && phoneMatch[0]) profile.phone = phoneMatch[0];
  
  // Links
  const linkedinRegex = /(https?:\/\/(www\.)?linkedin\.com\/in\/[a-zA-Z0-9_-]+)/i;
  const linkedinMatch = text.match(linkedinRegex);
  if (linkedinMatch && linkedinMatch[1]) profile.linkedinUrl = linkedinMatch[1];

  const githubRegex = /(https?:\/\/(www\.)?github\.com\/[a-zA-Z0-9_-]+)/i;
  const githubMatch = text.match(githubRegex);
  if (githubMatch && githubMatch[1]) profile.githubUrl = githubMatch[1];
  
  // Keyword-based Skill Extraction (Expandable list)
  const commonSkills = [
    'JavaScript', 'TypeScript', 'React', 'Node.js', 'Python', 'Java', 'C++', 'C#', 
    'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'SQL', 'NoSQL', 'MongoDB', 
    'PostgreSQL', 'HTML', 'CSS', 'Tailwind', 'Next.js', 'Vue', 'Angular', 
    'GraphQL', 'REST API', 'Figma', 'UI/UX', 'SEO', 'Marketing'
  ];
  
  const extractedSkills: string[] = [];
  commonSkills.forEach(skill => {
    // Word boundary to avoid partial matches
    const skillRegex = new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (skillRegex.test(text)) {
      extractedSkills.push(skill);
    }
  });
  
  profile.skills = extractedSkills;
  
  // Try to find the first name by getting the first line or first word chunk that looks like a name
  const nameMatch = text.match(/^([A-Z][a-z]+(?:\s[A-Z][a-z]+)*)/);
  if (nameMatch && nameMatch[1]) {
    profile.name = nameMatch[1].trim();
  }

  return profile;
}
