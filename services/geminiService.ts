import { GoogleGenAI, Type } from "@google/genai";
import { ExtractedPageContent, ChemicalExtractionResult, BoundingBox } from "../types";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

// Helper to clean JSON string if the model wraps it in markdown blocks
const cleanJson = (text: string): string => {
  let clean = text.trim();
  if (clean.startsWith('```json')) {
    clean = clean.replace(/^```json/, '').replace(/```$/, '');
  } else if (clean.startsWith('```')) {
    clean = clean.replace(/^```/, '').replace(/```$/, '');
  }
  return clean;
};

export const extractPageContent = async (base64Image: string): Promise<ExtractedPageContent> => {
  const modelId = "gemini-2.5-flash"; // Fast and capable for OCR + BBox

  const prompt = `
    Analyze this page from a scientific paper. 
    1. Transcribe the full text content into clean Markdown format. Preserve headers, lists, and basic formatting.
    2. Identify visual figures, diagrams, or chemical schemes. Return their bounding boxes (ymin, xmin, ymax, xmax) normalized 0-1000.
    
    Return a JSON object with this schema:
    {
      "markdown": "The full markdown text...",
      "figures": [
        { "ymin": 0, "xmin": 0, "ymax": 100, "xmax": 100, "label": "Figure 1: Title" }
      ]
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: {
        parts: [
          { inlineData: { mimeType: "image/png", data: base64Image } },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            markdown: { type: Type.STRING },
            figures: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  ymin: { type: Type.INTEGER },
                  xmin: { type: Type.INTEGER },
                  ymax: { type: Type.INTEGER },
                  xmax: { type: Type.INTEGER },
                  label: { type: Type.STRING }
                }
              }
            }
          }
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from Gemini");
    
    const parsed = JSON.parse(cleanJson(text));
    return parsed as ExtractedPageContent;

  } catch (error) {
    console.error("Gemini Extraction Error:", error);
    // Fallback if JSON parsing fails heavily
    return {
      markdown: "Error processing content. Please try again.",
      figures: []
    };
  }
};

export const extractSmilesFromCrop = async (base64Crop: string): Promise<ChemicalExtractionResult> => {
  // Using Pro model for better chemical reasoning
  const modelId = "gemini-3-pro-preview"; 
  
  const prompt = `
    Analyze the chemical structure in this image. 
    Convert the structure into its corresponding SMILES string.
    If multiple structures are present, provide the SMILES for the most prominent one.
    Also provide a short confidence assessment (High/Medium/Low).
  `;

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: {
        parts: [
          { inlineData: { mimeType: "image/png", data: base64Crop } },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            smiles: { type: Type.STRING },
            confidence: { type: Type.STRING }
          }
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response");
    
    return JSON.parse(cleanJson(text)) as ChemicalExtractionResult;
  } catch (error) {
    console.error("SMILES Extraction Error:", error);
    return { smiles: "Could not extract SMILES", confidence: "Low" };
  }
};
