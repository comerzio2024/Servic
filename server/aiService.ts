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

export async function analyzeImagesForHashtags(imageUrls: string[]): Promise<string[]> {
  try {
    if (!imageUrls || imageUrls.length === 0) {
      return [];
    }

    // Build content array with text and images
    const content: any[] = [
      {
        type: "text",
        text: `Analyze these service images and suggest 5-8 relevant hashtags that would help users discover this service on a Swiss marketplace.

Requirements:
- Suggest hashtags that describe the SERVICE TYPE (not the images themselves)
- Format: lowercase, no spaces (e.g., #plumbing, #design-services)
- Focus on what SERVICE is being offered
- Include practical, searchable terms
- Return ONLY hashtags, one per line, no numbering or extra text
- Include both specific and general hashtags

Examples for different services:
- Plumber: #plumbing #pipe-repair #swiss-handyman #installation
- Designer: #graphic-design #branding #web-design #creative-services
- Tutor: #tutoring #education #learning #language-lessons`,
      },
    ];

    // Add images
    for (const url of imageUrls.slice(0, 3)) {
      try {
        if (url.startsWith('http')) {
          content.push({
            type: "image_url",
            image_url: { url },
          });
        } else if (url.startsWith('data:')) {
          // For data URLs, we can use them directly
          const base64Data = url.split(',')[1];
          const mimeType = url.match(/data:([^;]+)/)?.[1] || 'image/jpeg';
          content.push({
            type: "image_url",
            image_url: { url: url },
          });
        }
      } catch {
        // Skip invalid URLs
      }
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an expert at analyzing service images and suggesting relevant hashtags for a Swiss marketplace.",
        },
        {
          role: "user",
          content,
        },
      ],
      max_tokens: 200,
    });

    const text = response.choices[0].message.content || "";
    const hashtags = text
      .split('\n')
      .map(line => line.trim().replace(/^#+\s*/, '').replace(/^#+/, '').toLowerCase())
      .filter(tag => tag.length > 0 && tag.length < 30 && tag.match(/^[a-z0-9\-]+$/))
      .slice(0, 8);

    return hashtags.length > 0 ? hashtags : [];
  } catch (error) {
    console.error("AI hashtag analysis failed:", error);
    return [];
  }
}

export async function validateCategoryName(
  categoryName: string,
  description?: string
): Promise<{
  isValid: boolean;
  isDuplicate?: boolean;
  similarity?: number;
  message: string;
}> {
  try {
    // Check if category name is reasonable
    if (categoryName.trim().length < 3) {
      return {
        isValid: false,
        message: "Category name must be at least 3 characters long",
      };
    }

    if (categoryName.length > 50) {
      return {
        isValid: false,
        message: "Category name must not exceed 50 characters",
      };
    }

    // Use AI to validate and check for similarity with existing categories
    const prompt = `You are validating a new service category for a Swiss marketplace.

Category Name: "${categoryName}"
${description ? `Description: "${description}"` : ""}

Check if this is:
1. A unique, specific category (not too generic)
2. Not similar to common categories like: "Cleaning", "Plumbing", "Tutoring", "Design", "Fitness", "Photography", "Consulting", "Gardening"
3. Professional and appropriate for B2C service marketplace

Respond with JSON: { "isValid": boolean, "isDuplicate": boolean, "similarity": number (0-1), "message": string }`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a category validator for a service marketplace. Return JSON only.",
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
      isValid: result.isValid !== false,
      isDuplicate: result.isDuplicate || false,
      similarity: result.similarity || 0,
      message: result.message || "Category validated",
    };
  } catch (error) {
    console.error("AI category validation failed:", error);
    return {
      isValid: true,
      message: "Category validation not available",
    };
  }
}

export async function suggestCategoryAlternative(
  categoryName: string,
  userFeedback?: string
): Promise<string[]> {
  try {
    const prompt = `The user suggested a new service category but we want to check if similar existing categories would work better.

Suggested Category: "${categoryName}"
${userFeedback ? `User Context: "${userFeedback}"` : ""}

Common Swiss marketplace categories:
- Home Services, Cleaning, Plumbing, Electrical, Garden Maintenance
- Design & Creative, Graphic Design, Web Design, Photography, Video Production
- Education, Tutoring, Language Lessons, Music Lessons
- Wellness & Fitness, Yoga, Personal Training, Massage, Nutrition
- Business Support, Consulting, Marketing, Translation, Bookkeeping
- Automotive, Pet Care, Events & Entertainment, Legal, Technology

Suggest 2-3 EXISTING categories that might fit this service request, or suggest the new category if none match well.
Return ONLY category names, one per line, no numbering.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a category expert for a Swiss service marketplace. Return only category names, one per line.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      max_tokens: 100,
    });

    const text = response.choices[0].message.content || "";
    const suggestions = text
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .slice(0, 3);

    return suggestions;
  } catch (error) {
    console.error("AI category suggestion failed:", error);
    return [];
  }
}
