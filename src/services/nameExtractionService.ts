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
