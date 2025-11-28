/**
 * AI Notification Prioritization Service
 * 
 * Uses OpenAI to intelligently prioritize notifications based on:
 * - User activity patterns
 * - Notification type and content
 * - User engagement history
 * - Time of day and context
 */

import OpenAI from "openai";

// Initialize OpenAI client (uses existing OPENAI_API_KEY from env)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "stub",
});

interface PrioritizationInput {
  userId: string;
  notificationType: string;
  title: string;
  message: string;
  metadata?: Record<string, any>;
}

interface PrioritizationResult {
  priority: number;       // 1-10, where 1 is highest priority
  relevanceScore: number; // 0.0-1.0, how relevant this is to user
  reasoning: string;      // Why this priority was assigned
}

// Default priority mapping for when AI is unavailable
const DEFAULT_PRIORITIES: Record<string, number> = {
  payment: 1,     // Financial matters are highest priority
  booking: 2,     // Time-sensitive booking updates
  message: 3,     // Direct communications
  review: 4,      // User engagement
  referral: 5,    // Growth-related
  service: 6,     // Service updates
  system: 7,      // System notifications
  promotion: 8,   // Promotional content (lowest user priority)
};

/**
 * Prioritizes a notification using AI analysis
 * Falls back to rule-based prioritization if AI fails
 */
export async function prioritizeNotification(
  input: PrioritizationInput
): Promise<PrioritizationResult> {
  // Check if OpenAI is configured
  if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === "stub") {
    return fallbackPrioritization(input);
  }

  try {
    const prompt = buildPrioritizationPrompt(input);
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Cost-effective for prioritization
      messages: [
        {
          role: "system",
          content: `You are a notification prioritization assistant for a multi-vendor marketplace platform.
Your task is to analyze notifications and assign them a priority score based on urgency, relevance, and user impact.

Priority Scale:
1-2: Critical (payments, urgent bookings, security)
3-4: High (direct messages, booking confirmations)
5-6: Medium (reviews, service updates)
7-8: Low (referrals, general updates)
9-10: Minimal (promotions, optional content)

Consider:
- Time sensitivity
- Financial impact
- User engagement value
- Action required by user

Respond in JSON format only:
{
  "priority": <number 1-10>,
  "relevanceScore": <number 0.0-1.0>,
  "reasoning": "<brief explanation>"
}`,
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.3, // Low temperature for consistent results
      max_tokens: 200,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("Empty response from OpenAI");
    }

    const result = JSON.parse(content);
    
    // Validate and sanitize the response
    return {
      priority: Math.max(1, Math.min(10, Math.round(result.priority || 5))),
      relevanceScore: Math.max(0, Math.min(1, result.relevanceScore || 0.5)),
      reasoning: result.reasoning || "AI prioritization applied",
    };

  } catch (error) {
    console.error("[AI Notification] Prioritization failed:", error);
    return fallbackPrioritization(input);
  }
}

/**
 * Builds the prompt for AI prioritization
 */
function buildPrioritizationPrompt(input: PrioritizationInput): string {
  return `Analyze this notification and assign a priority:

Type: ${input.notificationType}
Title: ${input.title}
Message: ${input.message}
${input.metadata ? `Additional Context: ${JSON.stringify(input.metadata)}` : ""}

Assign a priority (1-10) and relevance score (0.0-1.0).`;
}

/**
 * Rule-based fallback when AI is unavailable
 */
function fallbackPrioritization(input: PrioritizationInput): PrioritizationResult {
  const basePriority = DEFAULT_PRIORITIES[input.notificationType] || 5;
  
  // Adjust based on keywords in title/message
  let adjustment = 0;
  const content = (input.title + " " + input.message).toLowerCase();
  
  // Urgent keywords increase priority (lower number)
  if (content.includes("urgent") || content.includes("important") || content.includes("action required")) {
    adjustment -= 1;
  }
  
  // Financial keywords increase priority
  if (content.includes("payment") || content.includes("refund") || content.includes("money")) {
    adjustment -= 1;
  }
  
  // Time-sensitive keywords
  if (content.includes("expires") || content.includes("limited time") || content.includes("deadline")) {
    adjustment -= 1;
  }
  
  // Positive keywords might be less urgent
  if (content.includes("congratulations") || content.includes("earned") || content.includes("bonus")) {
    adjustment += 1;
  }

  const finalPriority = Math.max(1, Math.min(10, basePriority + adjustment));
  const relevanceScore = 1 - (finalPriority / 10);

  return {
    priority: finalPriority,
    relevanceScore,
    reasoning: `Rule-based prioritization: ${input.notificationType} with base priority ${basePriority}, adjusted by ${adjustment}`,
  };
}

/**
 * Batch prioritizes multiple notifications (more efficient for bulk operations)
 */
export async function prioritizeNotificationBatch(
  inputs: PrioritizationInput[]
): Promise<PrioritizationResult[]> {
  // For now, process individually
  // Future optimization: batch API calls
  return Promise.all(inputs.map(prioritizeNotification));
}

/**
 * Analyzes user engagement to adjust future prioritization
 * This could be called periodically to build user preference models
 */
export async function analyzeUserEngagement(
  userId: string,
  interactions: Array<{
    notificationId: string;
    type: string;
    wasRead: boolean;
    wasClicked: boolean;
    dismissedQuickly: boolean;
  }>
): Promise<Record<string, number>> {
  // Simple engagement scoring
  const typeScores: Record<string, { total: number; engaged: number }> = {};

  for (const interaction of interactions) {
    if (!typeScores[interaction.type]) {
      typeScores[interaction.type] = { total: 0, engaged: 0 };
    }
    
    typeScores[interaction.type].total++;
    
    if (interaction.wasClicked || (interaction.wasRead && !interaction.dismissedQuickly)) {
      typeScores[interaction.type].engaged++;
    }
  }

  // Convert to engagement rates
  const engagementRates: Record<string, number> = {};
  for (const [type, scores] of Object.entries(typeScores)) {
    engagementRates[type] = scores.total > 0 ? scores.engaged / scores.total : 0.5;
  }

  console.log(`[AI Notification] User ${userId} engagement rates:`, engagementRates);
  
  return engagementRates;
}

