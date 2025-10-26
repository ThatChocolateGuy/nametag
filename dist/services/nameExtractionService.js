"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NameExtractionService = void 0;
const openai_1 = __importDefault(require("openai"));
class NameExtractionService {
    constructor(apiKey, model = 'gpt-4o-mini') {
        this.client = new openai_1.default({
            apiKey: apiKey
        });
        this.model = model;
        console.log(`NameExtractionService initialized with model: ${this.model}`);
    }
    /**
     * Extract names from conversation transcript
     * Looks for patterns like "I'm John", "This is Sarah", "My name is..."
     */
    async extractNames(transcript) {
        try {
            const response = await this.client.chat.completions.create({
                model: this.model,
                max_tokens: 1024,
                temperature: 0.3,
                messages: [{
                        role: 'user',
                        content: `Analyze this conversation transcript and extract all names mentioned when people introduce themselves or others.

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

Rules:
- Only include names from introductions like "I'm X", "My name is X", "This is X", "Call me X"
- Use "high" confidence for explicit introductions
- Use "medium" for contextual mentions
- Use "low" for ambiguous cases
- If no names found, return empty array []
- Return ONLY valid JSON, no explanation`
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
        }
        catch (error) {
            console.error('Error extracting names:', error);
            return [];
        }
    }
    /**
     * Generate a conversation summary with key topics and points
     */
    async summarizeConversation(transcript) {
        try {
            const response = await this.client.chat.completions.create({
                model: this.model,
                max_tokens: 1024,
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
        }
        catch (error) {
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
    async matchSpeakerToPerson(transcript, knownPeople) {
        if (knownPeople.length === 0)
            return null;
        try {
            const peopleList = knownPeople.map(p => `- ${p.name}${p.lastTopics ? ` (previously talked about: ${p.lastTopics.join(', ')})` : ''}`).join('\n');
            const response = await this.client.chat.completions.create({
                model: this.model,
                max_tokens: 512,
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
        }
        catch (error) {
            console.error('Error matching speaker:', error);
            return null;
        }
    }
}
exports.NameExtractionService = NameExtractionService;
