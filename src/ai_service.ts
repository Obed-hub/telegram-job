import axios from 'axios';
import * as dotenv from 'dotenv';

dotenv.config();

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

export interface AICallParams {
  prompt: string;
  systemPrompt?: string;
  provider: 'groq' | 'gemini';
}

export async function callAI({ prompt, systemPrompt, provider }: AICallParams): Promise<string> {
  if (provider === 'groq') {
    return callGroq(prompt, systemPrompt);
  } else {
    return callGemini(prompt, systemPrompt);
  }
}

async function callGroq(prompt: string, systemPrompt?: string): Promise<string> {
  if (!GROQ_API_KEY) throw new Error('GROQ_API_KEY not found');
  
  try {
    const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
      model: 'llama-3.3-70b-versatile',
      messages: [
        ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
        { role: 'user', content: prompt }
      ],
      temperature: 0.7
    }, {
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('Groq Error:', error);
    throw error;
  }
}

async function callGemini(prompt: string, systemPrompt?: string): Promise<string> {
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not found');
  
  try {
    const fullPrompt = systemPrompt ? `${systemPrompt}\n\nUser: ${prompt}` : prompt;
    const response = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      contents: [{
        parts: [{ text: fullPrompt }]
      }]
    });

    return response.data.candidates[0].content.parts[0].text;
  } catch (error) {
    console.error('Gemini Error:', error);
    throw error;
  }
}

export async function generateCoverLetter(jobTitle: string, company: string, description: string, userProfile: any): Promise<string> {
  const systemPrompt = "You are an expert career coach and professional writer. Write a compelling, concise cover letter for the user. Be professional and persuasive.";
  const prompt = `Write a cover letter for a ${jobTitle} position at ${company}. 
  Job Description: ${description.substring(0, 1000)}
  User Skills: ${userProfile.skills?.join(', ') || 'N/A'}
  User Preferred Role: ${userProfile.preferredRole || 'N/A'}`;

  return callAI({ prompt, systemPrompt, provider: 'groq' });
}

export async function answerJobQnA(question: string, jobInfo: any, userProfile: any): Promise<string> {
  const systemPrompt = "You are a job assistant bot. Answer questions about specific job listings using the provided context. If you don't know, say you're not sure.";
  const prompt = `Job Info: ${JSON.stringify(jobInfo)}
  User Profile: ${JSON.stringify(userProfile)}
  Question: ${question}`;

  return callAI({ prompt, systemPrompt, provider: 'groq' });
}

export async function optimizeCVForJob(jobDescription: string, userProfile: any): Promise<string> {
  const systemPrompt = "You are an expert CV optimizer. Tailor the user's professional summary and key skills to perfectly align with the provided job description. Highlight relevant experience and use industry keywords.";
  const prompt = `Job Description: ${jobDescription.substring(0, 2000)}
  User Profile: ${JSON.stringify(userProfile)}
  
  Please provide an optimized 'Professional Summary' and 'Key Skills' section that would make this candidate stand out for this specific job.`;

  return callAI({ prompt, systemPrompt, provider: 'groq' });
}
