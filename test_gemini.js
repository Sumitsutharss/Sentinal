import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();

async function testGemini() {
  const apiKey = process.env.GEMINI_API_KEY;
  console.log('Testing Gemini API key presence:', Boolean(apiKey));

  // Try GoogleGenerativeAI
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const modelName = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
    const model = genAI.getGenerativeModel({ model: modelName });
    const result = await model.generateContent('Return JSON: {"status": "ok", "message": "Gemini connection active"}');
    const text = result.response.text();
    console.log('GoogleGenerativeAI response:', text);
  } catch (err) {
    console.log('GoogleGenerativeAI error:', err.message);
  }

  // Try GoogleGenAI
  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
      contents: 'Return JSON: {"status": "ok", "message": "GoogleGenAI SDK active"}',
    });
    console.log('GoogleGenAI response:', response.text);
  } catch (err) {
    console.log('GoogleGenAI error:', err.message);
  }
}

testGemini();
