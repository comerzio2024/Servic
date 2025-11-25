import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface CategoryValidationResult {
  isValid: boolean;
  suggestedName?: string;
  reasoning: string;
  confidence: number;
}

export async function validateCategoryName(categoryName: string, description?: string): Promise<CategoryValidationResult> {
  const prompt = `Evaluate if this category name makes sense for a Swiss service marketplace:
Category Name: "${categoryName}"
${description ? `Description: "${description}"` : ''}

Existing categories: Home Services, Design & Creative, Education & Tutoring, Wellness & Fitness, Business Support

Analyze:
1. Is this a clear, professional category name?
2. Is it distinct from existing categories?
3. Would it be useful for a service marketplace?
4. Is it in appropriate language (English, German, French, or Italian)?

If the name is problematic, suggest a better alternative.

Respond in JSON format:
{
  "isValid": boolean,
  "suggestedName": "string (only if not valid)",
  "reasoning": "string",
  "confidence": number (0-1)
}`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a category validation AI for a service marketplace. Be strict but fair in your validation.",
        },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 300,
    });

    const result = JSON.parse(completion.choices[0]?.message?.content || "{}");
    return {
      isValid: result.isValid || false,
      suggestedName: result.suggestedName,
      reasoning: result.reasoning || "Unable to validate category",
      confidence: result.confidence || 0,
    };
  } catch (error) {
    console.error("Error validating category:", error);
    return {
      isValid: false,
      reasoning: "Failed to validate category. Please submit for admin review.",
      confidence: 0,
    };
  }
}

export async function suggestCategoryAlternative(categoryName: string, userFeedback?: string): Promise<string> {
  const prompt = `The user suggested a category name: "${categoryName}"
${userFeedback ? `User feedback: "${userFeedback}"` : ''}

Suggest 3 alternative professional category names that would work better for a Swiss service marketplace.
Keep them concise, clear, and professional.

Format as a conversational response suggesting the alternatives.`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a helpful AI assistant suggesting better category names.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 300,
    });

    return completion.choices[0]?.message?.content || "I couldn't generate suggestions. Please try a different name.";
  } catch (error) {
    console.error("Error suggesting alternative:", error);
    return "I'm having trouble generating suggestions. Please try again or submit your category for admin review.";
  }
}

// Check if a category already exists (fuzzy matching)
export function findSimilarCategoryName(categoryName: string, existingCategories: Array<{name: string; id: string}>): {category: {name: string; id: string} | null; similarity: number} {
  const normalize = (str: string) => str.toLowerCase().trim().replace(/[&,]/g, '').replace(/\s+/g, ' ');
  const normalizedInput = normalize(categoryName);
  
  let bestMatch: {category: {name: string; id: string} | null; similarity: number} = {
    category: null,
    similarity: 0
  };

  for (const existing of existingCategories) {
    const normalizedExisting = normalize(existing.name);
    
    // Exact match after normalization
    if (normalizedInput === normalizedExisting) {
      return { category: existing, similarity: 1.0 };
    }
    
    // Substring match
    if (normalizedInput.includes(normalizedExisting) || normalizedExisting.includes(normalizedInput)) {
      bestMatch = { category: existing, similarity: 0.9 };
      continue;
    }
    
    // Levenshtein distance for fuzzy matching
    const distance = levenshteinDistance(normalizedInput, normalizedExisting);
    const maxLen = Math.max(normalizedInput.length, normalizedExisting.length);
    const similarity = 1 - (distance / maxLen);
    
    if (similarity > 0.75 && similarity > bestMatch.similarity) {
      bestMatch = { category: existing, similarity };
    }
  }
  
  return bestMatch;
}

// Simple Levenshtein distance implementation
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }

  return dp[m][n];
}
