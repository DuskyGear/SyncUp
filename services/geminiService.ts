
import { GoogleGenAI } from "@google/genai";

// Fixed: The API key must be obtained exclusively from the environment variable process.env.API_KEY.
export const generateTaskDescription = async (title: string): Promise<string> => {
  if (!process.env.API_KEY) return "No API key configured for Gemini.";
  
  try {
    // Fixed: Always use const ai = new GoogleGenAI({apiKey: process.env.API_KEY});
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Generate a detailed professional task description for a task titled: "${title}". 
      The description should include objectives and a short checklist. Keep it concise but helpful.`,
    });
    
    return response.text || "Failed to generate description.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Error generating AI content.";
  }
};
