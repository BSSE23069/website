import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });

export async function analyzeDistressMessage(message: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: message,
      config: {
        systemInstruction: `Analyze the following distress message from a ship captain. 
        Extract structured information including severity (LOW, MEDIUM, HIGH, CRITICAL), 
        the core problem, injury count, and estimated damage. 
        Return as JSON.`,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            severity: { type: Type.STRING, enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"] },
            problem: { type: Type.STRING },
            injuries: { type: Type.NUMBER },
            damageEstimate: { type: Type.STRING },
            suggestedAction: { type: Type.STRING }
          },
          required: ["severity", "problem"]
        }
      }
    });

    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("AI Analysis Error:", error);
    return { severity: "UNKNOWN", problem: message };
  }
}
