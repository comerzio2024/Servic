import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface CategorySuggestion {
  categorySlug: string;
  confidence: number;
  reasoning: string;
}

export async function categorizeService(
  title: string,
  description: string
): Promise<CategorySuggestion> {
  try {
    const prompt = `Analyze this service listing and suggest the most appropriate category from the following options:
- home-services (Home Services)
- design-creative (Design & Creative)
- education (Education & Tutoring)
- wellness (Wellness & Fitness)
- business (Business Support)

Service Title: ${title}
Service Description: ${description}

Respond with JSON in this format: { "categorySlug": string, "confidence": number (0-1), "reasoning": string }`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an AI assistant that categorizes service listings with high accuracy.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");

    return {
      categorySlug: result.categorySlug || "business",
      confidence: Math.max(0, Math.min(1, result.confidence || 0.5)),
      reasoning: result.reasoning || "Auto-categorized",
    };
  } catch (error) {
    console.error("AI categorization failed:", error);
    // Fallback to business category
    return {
      categorySlug: "business",
      confidence: 0.3,
      reasoning: "Fallback categorization due to AI service error",
    };
  }
}

export async function generateSimpleServiceDescription(
  title: string,
  categoryName?: string
): Promise<string> {
  try {
    const categoryHint = categoryName ? ` in the ${categoryName} category` : "";
    const prompt = `Generate a professional, compelling service description for a Swiss marketplace listing${categoryHint}.

Service Title: ${title}

Requirements:
- Write 3-4 paragraphs (150-200 words total)
- Use professional but friendly tone
- Highlight key benefits and value proposition
- Include what makes this service unique
- Mention Swiss quality standards if relevant
- Write in clear, concise sentences
- Do NOT include pricing information
- Do NOT use marketing fluff or excessive adjectives

Return ONLY the description text, no additional commentary.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a professional copywriter specializing in service marketplace listings. You write clear, compelling descriptions that convert browsers into customers.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      max_completion_tokens: 300,
    });

    return response.choices[0].message.content?.trim() || "";
  } catch (error) {
    console.error("AI description generation failed:", error);
    throw new Error("Failed to generate description");
  }
}
