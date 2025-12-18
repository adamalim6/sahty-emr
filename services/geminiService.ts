
import { GoogleGenAI } from "@google/genai";

// Medical response generation service using Gemini API
export const generateMedicalResponse = async (prompt: string): Promise<string> => {
  // Always obtain the API key directly from the environment variable and create a fresh instance
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    const response = await ai.models.generateContent({
      // Using gemini-3-flash-preview for basic medical/text tasks as recommended
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        systemInstruction: "Vous êtes un assistant médical expert intégré dans un dossier médical électronique (EMR). Répondez de manière professionnelle, concise et précise aux questions médicales ou administratives.",
      }
    });
    // Access the text property directly on the response object
    return response.text || "Aucune réponse générée.";
  } catch (error) {
    console.error("Erreur Gemini:", error);
    return "Une erreur est survenue lors de la consultation de l'assistant IA.";
  }
};
