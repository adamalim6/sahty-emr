
import { GoogleGenAI, Type } from "@google/genai";
import { InventoryItem } from "../types/pharmacy";

const getAIClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export const analyzeInventoryDiscrepancies = async (items: InventoryItem[]): Promise<string> => {
  const ai = getAIClient();
  
  const discrepancies = items.filter(item => 
    item.actualQty !== null && item.actualQty !== item.theoreticalQty
  ).map(item => ({
    nom: item.name,
    categorie: item.category,
    attendu: item.theoreticalQty,
    trouve: item.actualQty,
    ecart: (item.actualQty || 0) - item.theoreticalQty,
    differenceValeur: ((item.actualQty || 0) - item.theoreticalQty) * item.unitPrice
  }));

  if (discrepancies.length === 0) {
    return "## Aucun Écart Détecté\n\nExcellent travail ! Toutes les quantités comptées correspondent parfaitement aux enregistrements système. Aucune action d'audit n'est requise pour le moment.";
  }

  const prompt = `
    Tu es un expert en audit de pharmacie hospitalière.
    Analyse les écarts d'inventaire suivants trouvés lors d'un inventaire tournant.
    
    Données (format JSON) :
    ${JSON.stringify(discrepancies, null, 2)}

    Fournis un rapport d'audit professionnel en français au format Markdown avec :
    1. **Résumé Exécutif** : Aperçu global de la précision.
    2. **Écarts à Haut Risque** : Souligne les pertes significatives, surtout pour les Stupéfiants ou articles coûteux.
    3. **Analyse des Tendances** : Y a-t-il des catégories ou emplacements spécifiques sujets aux erreurs ?
    4. **Recommandations** : Étapes correctives (ex: recomptage, vérification bac péremption, enquête vol).

    Réponds exclusivement en FRANÇAIS.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || "Impossible de générer l'analyse pour le moment.";
  } catch (error) {
    console.error("Gemini analysis failed:", error);
    return "Erreur lors de la génération de l'analyse. Veuillez vérifier votre clé API.";
  }
};

interface ExtractionResult {
  reference: string;
  quantities: { productId: string; qty: number }[];
}

export const extractDeliveryNoteData = async (
  imageBase64: string, 
  expectedProducts: { id: string; name: string }[]
): Promise<ExtractionResult> => {
  const ai = getAIClient();

  const prompt = `
    Tu es un assistant IA pour une pharmacie hospitalière. 
    Analyse l'image jointe d'un Bon de Livraison.
    
    Tâches :
    1. Extraire le **Numéro de Référence du Bon de Livraison** (souvent marqué BL, Réf, ou Livraison n°).
    2. Extraire la **Quantité Livrée** pour chaque article.
    
    Liste des produits attendus :
    ${JSON.stringify(expectedProducts, null, 2)}
    
    Fais correspondre les articles de l'image avec la liste attendue.
    Renvoie le résultat STRICTEMENT au format JSON.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            reference: {
              type: Type.STRING,
              description: 'Reference number of the delivery note found in the image.',
            },
            quantities: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  productId: { type: Type.STRING },
                  qty: { type: Type.NUMBER }
                },
                required: ["productId", "qty"],
              }
            }
          },
          required: ["reference", "quantities"],
          propertyOrdering: ["reference", "quantities"],
        }
      }
    });

    const text = response.text || "{}";
    return JSON.parse(text) as ExtractionResult;
  } catch (error) {
    console.error("Gemini Extraction Failed:", error);
    throw new Error("Échec de l'extraction des données de l'image.");
  }
};
