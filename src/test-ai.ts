import { callAI } from './ai_service.js';

async function testAI() {
  console.log('--- Testing Groq ---');
  try {
    const groqRes = await callAI({ prompt: 'Say hello!', provider: 'groq' });
    console.log('Groq response:', groqRes);
  } catch (e: any) {
    console.error('Groq failed:', e.message);
  }

  console.log('\n--- Testing Gemini ---');
  try {
    const geminiRes = await callAI({ prompt: 'Say hello!', provider: 'gemini' });
    console.log('Gemini response:', geminiRes);
  } catch (e: any) {
    console.error('Gemini failed:', e.message);
  }
}

testAI();
