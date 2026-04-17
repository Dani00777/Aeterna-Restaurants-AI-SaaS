import { GoogleGenAI } from "@google/genai";
import { MenuItem, Restaurant } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const SYSTEM_PROMPT = () => `You are Aeterna, a polite and efficient Restaurant Manager.
When the user asks to see the menu or view the menu items, simply reply with a helpful greeting and include the exact tag [SHOW_MENU_BUTTON] in your response. DO NOT list the menu items as text if they ask for the menu.
If you don't understand the user's request, ask: "Sahab, kya aap order confirm karna chahte hain?"
Speak in a friendly, helpful, conversational tone, and understand natural language confirmation phrases like 'haan', 'ok', 'theek', 'confirm'.`;

export const getAIResponse = async (
  restaurant: Restaurant,
  menu: MenuItem[],
  ingredients: any[],
  staff: any[],
  trainingNotes: string,
  history: { role: 'user' | 'model'; text: string }[],
  tableNumber?: string
) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Gemini API Key is missing.");
  }

  const model = "gemini-3.1-pro-preview";
  
  try {
    // Send full history for context
    const contents = history.map(h => ({
      role: h.role === 'user' ? 'user' : 'model',
      parts: [{ text: h.text }]
    }));
    
    // Inject context data into the last message
    const lastIdx = contents.length - 1;
    contents[lastIdx].parts[0].text = `Data: Menu=${JSON.stringify(menu)}, Ingredients=${JSON.stringify(ingredients)}, Staff=${JSON.stringify(staff)}. ${contents[lastIdx].parts[0].text}`;

    console.log(`Gemini API: Calling ${model} with full context.`);

    const response = await ai.models.generateContent({
      model,
      contents,
      config: {
        systemInstruction: SYSTEM_PROMPT(),
        temperature: 0.7, // Increased for more natural conversation
      },
    });

    if (!response || !response.text) {
      throw new Error("Empty response from Gemini API");
    }

    return response.text;
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};
