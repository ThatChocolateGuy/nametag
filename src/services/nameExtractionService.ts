import OpenAI from 'openai';

export interface ExtractedName {
  name: string;
  speaker: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface ConversationSummary {
  mainTopics: string[];
  keyPoints: string[];
  summary: string;
}

export class NameExtractionService {
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model: string = 'gpt-4o-mini') {
    this.client = new OpenAI({
      apiKey: apiKey
    });
    this.model = model;
    console.log(`NameExtractionService initialized with model: ${this.model}`);
  }

  /**
   * Extract names from conversation transcript
   * Looks for patterns like "I'm John", "This is Sarah", "My name is..."
   */
  async extractNames(transcript: string): Promise<ExtractedName[]> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        max_completion_tokens: 1024,
        temperature: 0.3,
        messages: [{
          role: 'user',
          content: `Analyze this conversation transcript and extract ONLY names from SELF-INTRODUCTIONS.

Transcript:
${transcript}

Return ONLY a JSON array of objects with this format:
[
  {
    "name": "John Smith",
    "speaker": "unknown",
    "confidence": "high"
  }
]

CRITICAL Rules:
- ONLY extract names when someone introduces THEMSELVES using first-person: "I'm X", "I am X", "My name is X", "Call me X"
- DO NOT extract names mentioned in third person: "I met John", "John told me", "This is for Sarah"
- DO NOT extract names from questions: "Are you John?"
- Use "high" confidence ONLY for clear first-person self-introductions
- Use "medium" for uncertain cases
- Use "low" for very ambiguous cases
- If no SELF-introductions found, return empty array []
- Return ONLY valid JSON, no explanation or markdown`
        }]
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        return [];
      }

      const text = content.trim();

      // Try to extract JSON from markdown code blocks if present
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, text];
      const jsonText = jsonMatch[1] || text;

      const names = JSON.parse(jsonText);
      return Array.isArray(names) ? names : [];
    } catch (error) {
      console.error('Error extracting names:', error);
      return [];
    }
  }

  /**
   * Generate a conversation summary with key topics and points
   */
  async summarizeConversation(transcript: string): Promise<ConversationSummary> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        max_completion_tokens: 1024,
        temperature: 0.5,
        messages: [{
          role: 'user',
          content: `Summarize this conversation into key topics and points.

Transcript:
${transcript}

Return ONLY a JSON object with this format:
{
  "mainTopics": ["topic1", "topic2"],
  "keyPoints": ["point1", "point2"],
  "summary": "Brief 1-2 sentence summary"
}

IMPORTANT: Write ALL content in PAST TENSE as if recalling what was discussed.
Examples:
- Good: "Discussed project timeline", "Talked about weekend plans", "Mentioned new job"
- Bad: "Discussing project timeline", "Talking about weekend plans", "Mentions new job"

Focus on the most important information that would help someone remember this conversation later.
Return ONLY valid JSON, no explanation.`
        }]
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        return {
          mainTopics: [],
          keyPoints: [],
          summary: ''
        };
      }

      const text = content.trim();

      // Try to extract JSON from markdown code blocks if present
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, text];
      const jsonText = jsonMatch[1] || text;

      return JSON.parse(jsonText);
    } catch (error) {
      console.error('Error summarizing conversation:', error);
      return {
        mainTopics: [],
        keyPoints: [],
        summary: 'Error generating summary'
      };
    }
  }

  /**
   * Generate a conversation prompt/starter based on full conversation history
   * Uses recent conversations for specific prompts, older ones for general prompts
   * @param personName Name of the person
   * @param conversationHistory Full conversation history (chronological, oldest first)
   * @returns AI-generated conversation prompt (question format, < 140 chars)
   */
  async generateConversationPrompt(
    personName: string,
    conversationHistory: Array<{
      date: Date;
      transcript: string;
      topics: string[];
      keyPoints?: string[];
    }>
  ): Promise<string> {
    try {
      if (conversationHistory.length === 0) {
        return `How have you been, ${personName}?`;
      }

      // Get most recent conversation
      const mostRecent = conversationHistory[conversationHistory.length - 1];
      const daysSinceLastConv = Math.floor(
        (Date.now() - mostRecent.date.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Build context from all conversations
      const allKeyPoints: string[] = [];
      const allTopics: string[] = [];

      for (const conv of conversationHistory) {
        if (conv.keyPoints) {
          allKeyPoints.push(...conv.keyPoints);
        }
        if (conv.topics) {
          allTopics.push(...conv.topics);
        }
      }

      // Create context string
      const contextParts: string[] = [];
      if (allKeyPoints.length > 0) {
        contextParts.push(`Key points: ${allKeyPoints.join('; ')}`);
      }
      if (allTopics.length > 0) {
        contextParts.push(`Topics: ${allTopics.join(', ')}`);
      }

      const context = contextParts.join('\n');

      // Different prompts for recent vs older conversations
      const isRecent = daysSinceLastConv <= 7;

      const systemPrompt = isRecent
        ? `You are an AI assistant helping the user remember details about ${personName} from RECENT conversations.
Generate a helpful prompt that reminds the user what to ask or mention.
Reference specific events or topics from the last week.
Use third person perspective (e.g., "How was ${personName}'s..." or "Ask ${personName} about...").
Format as a single concise prompt under 140 characters.
Be specific and helpful to guide the conversation.

Examples:
"Ask ${personName} about the new puppy - how is it settling in?"
"Follow up on ${personName}'s project deadline - how did it go?"
"${personName} was planning a trip to Italy - when are they leaving?"
"Check in on ${personName}'s dinner plans after the car discussion."`
        : `You are an AI assistant helping the user remember details about ${personName} from PAST conversations.
Generate a helpful prompt that reminds the user what to follow up on.
Reference older topics but make them forward-looking.
Use third person perspective (e.g., "Ask ${personName} about..." or "See if ${personName}...").
Format as a single concise prompt under 140 characters.

Examples:
"Ask ${personName} about guitar lessons - how's that progressing?"
"${personName} was considering a career change - any updates?"
"Check if ${personName} has taken any trips lately - they wanted to travel more."
"See how ${personName}'s new hobby is going - they mentioned starting it."`;

      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: `Generate a conversation prompt for ${personName}.\n\nConversation context:\n${context}\n\nDays since last conversation: ${daysSinceLastConv}`
          }
        ],
        temperature: 0.8, // More creative for prompts
        max_tokens: 60 // Keep it concise (140 chars ≈ 40-50 tokens)
      });

      let prompt = completion.choices[0]?.message?.content?.trim() || '';

      // Remove quotes if AI added them
      prompt = prompt.replace(/^["']|["']$/g, '');

      // Ensure it's a reasonable length (truncate if needed)
      if (prompt.length > 140) {
        prompt = prompt.substring(0, 137) + '...';
      }

      // Fallback if empty
      if (!prompt) {
        return `How have things been going, ${personName}?`;
      }

      return prompt;
    } catch (error) {
      console.error('Error generating conversation prompt:', error);
      // Fallback to a generic prompt
      return `How have you been, ${personName}?`;
    }
  }

  /**
   * Match speaker to known person by analyzing context
   */
  async matchSpeakerToPerson(
    transcript: string,
    knownPeople: Array<{ name: string; lastTopics?: string[] }>
  ): Promise<string | null> {
    if (knownPeople.length === 0) return null;

    try {
      const peopleList = knownPeople.map(p =>
        `- ${p.name}${p.lastTopics ? ` (previously talked about: ${p.lastTopics.join(', ')})` : ''}`
      ).join('\n');

      const response = await this.client.chat.completions.create({
        model: this.model,
        max_completion_tokens: 512,
        temperature: 0.3,
        messages: [{
          role: 'user',
          content: `Based on this conversation snippet, determine if the speaker matches any of these known people:

${peopleList}

Conversation:
${transcript}

Return ONLY the exact name if you find a match with high confidence, or "null" if no match.
Consider topic continuity and context. Return ONLY the name or null, no explanation.`
        }]
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        return null;
      }

      const result = content.trim();
      return result === 'null' ? null : result;
    } catch (error) {
      console.error('Error matching speaker:', error);
      return null;
    }
  }
}
