import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface ConversationEntry {
  date: Date;
  transcript: string;
  topics: string[];
  keyPoints?: string[];  // Key points from the conversation for quick context
  duration?: number; // Duration in seconds
}

export interface Person {
  name: string;
  speakerId: string;
  userId: string;  // MentraOS user ID for data isolation
  voiceReference?: string;  // Base64 encoded audio clip (2-10 seconds)
  conversationHistory: ConversationEntry[];  // Full history of all conversations
  lastConversation?: string;  // Deprecated - kept for backward compatibility
  lastTopics?: string[];      // Deprecated - kept for backward compatibility
  lastMet?: Date;
  conversationPrompt?: string;  // AI-generated conversation starter
  promptGeneratedDate?: Date;   // When prompt was last generated
  promptShownCount?: number;     // Times prompt has been shown
  lastPromptShown?: Date;        // Last time prompt was displayed
}

interface DatabasePerson {
  id: string;
  name: string;
  speaker_id: string;
  user_id: string;
  voice_reference?: string;
  last_met?: string;
  conversation_prompt?: string;
  prompt_generated_date?: string;
  prompt_shown_count?: number;
  last_prompt_shown?: string;
  created_at: string;
  updated_at: string;
}

interface DatabaseConversationEntry {
  id: string;
  person_id: string;
  user_id: string;
  date: string;
  transcript: string;
  topics: string[];
  key_points?: string[];
  duration?: number;
  created_at: string;
}

/**
 * Supabase storage client - drop-in replacement for FileStorageClient
 * Stores person data in Supabase PostgreSQL database
 *
 * Requires environment variables:
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_KEY (use service_role key, not anon key)
 */
export class SupabaseStorageClient {
  private supabase: SupabaseClient;
  private isConnected = false;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      const missingVars = [];
      if (!supabaseUrl) missingVars.push('SUPABASE_URL');
      if (!supabaseKey) missingVars.push('SUPABASE_SERVICE_KEY');

      console.error('╔════════════════════════════════════════════════════════════════╗');
      console.error('║          SUPABASE CONFIGURATION ERROR                          ║');
      console.error('╚════════════════════════════════════════════════════════════════╝');
      console.error('');
      console.error(`❌ Missing required environment variables: ${missingVars.join(', ')}`);
      console.error('');
      console.error('To fix this issue:');
      console.error('');
      console.error('LOCAL DEVELOPMENT:');
      console.error('  1. Copy .env.example to .env');
      console.error('  2. Add your Supabase credentials from:');
      console.error('     https://supabase.com/dashboard → Your Project → Settings → API');
      console.error('  3. Set SUPABASE_URL and SUPABASE_SERVICE_KEY in .env');
      console.error('');
      console.error('VERCEL DEPLOYMENT:');
      console.error('  Option 1 - Using Vercel Dashboard:');
      console.error('    1. Go to https://vercel.com/dashboard');
      console.error('    2. Select your project → Settings → Environment Variables');
      console.error('    3. Add SUPABASE_URL and SUPABASE_SERVICE_KEY');
      console.error('    4. Redeploy your application');
      console.error('');
      console.error('  Option 2 - Using Vercel CLI:');
      console.error('    1. Install: npm install -g vercel');
      console.error('    2. Run: npm run setup:vercel-env');
      console.error('    3. Redeploy: vercel --prod');
      console.error('');
      console.error('════════════════════════════════════════════════════════════════');

      throw new Error(`Supabase credentials not configured. Missing: ${missingVars.join(', ')}`);
    }

    // Handle self-signed certificates ONLY in local development
    // (corporate proxies, VPNs, antivirus software)
    // NEVER disable SSL validation in production (Railway, Vercel)
    if (process.env.NODE_ENV !== 'production' &&
        !process.env.RAILWAY_ENVIRONMENT &&
        process.env.VERCEL !== '1' &&
        process.env.NODE_TLS_REJECT_UNAUTHORIZED !== '1') {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
      console.log('⚠️  SSL certificate validation disabled (local development only)');
    }

    // Initialize Supabase client with service role key
    this.supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    this.isConnected = true;
    console.log('Supabase Storage Client initialized');
    console.log(`Connected to: ${supabaseUrl}`);
  }

  /**
   * Convert database person + conversations to Person interface
   */
  private async dbPersonToPerson(dbPerson: DatabasePerson): Promise<Person> {
    // Fetch conversation history for this person (oldest first for array indexing)
    const { data: conversations, error } = await this.supabase
      .from('conversation_entries')
      .select('*')
      .eq('person_id', dbPerson.id)
      .order('date', { ascending: true });  // Oldest first, so newest is at end of array

    if (error) {
      console.error('Error fetching conversations:', error);
    }

    const conversationHistory: ConversationEntry[] = (conversations || []).map(conv => ({
      date: new Date(conv.date),
      transcript: conv.transcript,
      topics: conv.topics || [],
      keyPoints: conv.key_points,
      duration: conv.duration
    }));

    return {
      name: dbPerson.name,
      speakerId: dbPerson.speaker_id,
      userId: dbPerson.user_id,
      voiceReference: dbPerson.voice_reference,
      conversationHistory,
      lastMet: dbPerson.last_met ? new Date(dbPerson.last_met) : undefined,
      // Deprecated fields for backward compatibility - get most recent conversation
      lastConversation: conversationHistory[conversationHistory.length - 1]?.transcript,
      lastTopics: conversationHistory[conversationHistory.length - 1]?.topics,
      // Conversation prompt fields
      conversationPrompt: dbPerson.conversation_prompt,
      promptGeneratedDate: dbPerson.prompt_generated_date ? new Date(dbPerson.prompt_generated_date) : undefined,
      promptShownCount: dbPerson.prompt_shown_count,
      lastPromptShown: dbPerson.last_prompt_shown ? new Date(dbPerson.last_prompt_shown) : undefined
    };
  }

  /**
   * Store a person's information
   */
  async storePerson(person: Person): Promise<void> {
    try {
      // Check if person already exists (name must be unique per user)
      const { data: existing } = await this.supabase
        .from('people')
        .select('id, speaker_id')
        .eq('name', person.name)
        .eq('user_id', person.userId)
        .single();

      let personId: string;

      if (existing) {
        // Update existing person
        if (existing.speaker_id !== person.speakerId) {
          console.log(`✓ Updated ${person.name}'s speaker ID: ${existing.speaker_id} → ${person.speakerId}`);
        }

        const { error: updateError} = await this.supabase
          .from('people')
          .update({
            speaker_id: person.speakerId,
            voice_reference: person.voiceReference,
            last_met: person.lastMet?.toISOString() || new Date().toISOString(),
            conversation_prompt: person.conversationPrompt,
            prompt_generated_date: person.promptGeneratedDate?.toISOString(),
            prompt_shown_count: person.promptShownCount ?? 0,
            last_prompt_shown: person.lastPromptShown ? person.lastPromptShown.toISOString() : null
          })
          .eq('id', existing.id);

        if (updateError) throw updateError;
        
        // Log prompt tracking updates
        if (person.conversationPrompt !== undefined) {
          console.log(`  📝 DB Update: conversation_prompt="${person.conversationPrompt.substring(0, 60)}${person.conversationPrompt.length > 60 ? '...' : ''}"`);
        }
        if (person.lastPromptShown !== undefined || person.promptShownCount !== undefined) {
          console.log(`  📊 DB Update: prompt_shown_count=${person.promptShownCount ?? 0}, last_prompt_shown=${person.lastPromptShown ? person.lastPromptShown.toISOString() : 'null'}`);
        }
        
        personId = existing.id;
      } else {
        // Insert new person
        const { data: newPerson, error: insertError } = await this.supabase
          .from('people')
          .insert({
            name: person.name,
            speaker_id: person.speakerId,
            user_id: person.userId,
            voice_reference: person.voiceReference,
            last_met: person.lastMet?.toISOString() || new Date().toISOString(),
            conversation_prompt: person.conversationPrompt,
            prompt_generated_date: person.promptGeneratedDate?.toISOString(),
            prompt_shown_count: person.promptShownCount ?? 0,
            last_prompt_shown: person.lastPromptShown ? person.lastPromptShown.toISOString() : null
          })
          .select('id')
          .single();

        if (insertError) throw insertError;
        if (!newPerson) throw new Error('Failed to create person');
        personId = newPerson.id;
      }

      // Store conversation history
      // Delete existing conversations and insert new ones (simpler than diff)
      if (person.conversationHistory && person.conversationHistory.length > 0) {
        // Delete old conversations
        await this.supabase
          .from('conversation_entries')
          .delete()
          .eq('person_id', personId);

        // Insert new conversations
        const conversationInserts = person.conversationHistory.map(conv => ({
          person_id: personId,
          user_id: person.userId,
          date: conv.date.toISOString(),
          transcript: conv.transcript,
          topics: conv.topics,
          key_points: conv.keyPoints,
          duration: conv.duration
        }));

        const { error: convError } = await this.supabase
          .from('conversation_entries')
          .insert(conversationInserts);

        if (convError) throw convError;
      }

      console.log(`✓ Stored ${person.name} (Speaker ${person.speakerId})`);
    } catch (error) {
      console.error(`Error storing person ${person.name}:`, error);
      throw error;
    }
  }

  /**
   * Retrieve a person by speaker ID or name (filtered by userId)
   */
  async getPerson(speakerIdOrName: string, userId: string): Promise<Person | null> {
    try {
      // Try to find by speaker ID first, then by name (always filter by userId)
      let { data: dbPerson } = await this.supabase
        .from('people')
        .select('*')
        .eq('speaker_id', speakerIdOrName)
        .eq('user_id', userId)
        .single();

      if (!dbPerson) {
        // Try by name (case-insensitive, still filter by userId)
        const { data } = await this.supabase
          .from('people')
          .select('*')
          .ilike('name', speakerIdOrName)
          .eq('user_id', userId)
          .single();

        dbPerson = data;
      }

      if (!dbPerson) return null;

      return await this.dbPersonToPerson(dbPerson);
    } catch (error) {
      console.error('Error retrieving person:', error);
      return null;
    }
  }

  /**
   * Search for a person by name (case-insensitive, filtered by userId)
   */
  async findPersonByName(name: string, userId: string): Promise<Person | null> {
    try {
      const { data: dbPerson } = await this.supabase
        .from('people')
        .select('*')
        .ilike('name', name)
        .eq('user_id', userId)
        .single();

      if (!dbPerson) return null;

      return await this.dbPersonToPerson(dbPerson);
    } catch (error) {
      console.error('Error finding person by name:', error);
      return null;
    }
  }

  /**
   * Get all stored people for a specific user
   */
  async getAllPeople(userId: string): Promise<Person[]> {
    try {
      const { data: dbPeople, error } = await this.supabase
        .from('people')
        .select('*')
        .eq('user_id', userId)
        .order('last_met', { ascending: false, nullsFirst: false });

      if (error) throw error;
      if (!dbPeople) return [];

      // Convert all database people to Person objects
      const people = await Promise.all(
        dbPeople.map(dbPerson => this.dbPersonToPerson(dbPerson))
      );

      return people;
    } catch (error) {
      console.error('Error getting all people:', error);
      return [];
    }
  }

  /**
   * Delete a person by name (filtered by userId)
   */
  async deletePerson(name: string, userId: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('people')
        .delete()
        .ilike('name', name)
        .eq('user_id', userId);

      if (error) throw error;

      console.log(`Deleted person: ${name} (user: ${userId})`);
      return true;
    } catch (error) {
      console.error('Error deleting person:', error);
      return false;
    }
  }

  /**
   * Clear all stored data (use with caution!)
   */
  async clearAll(): Promise<void> {
    try {
      // Delete all conversations first (foreign key constraint)
      await this.supabase.from('conversation_entries').delete().neq('id', '00000000-0000-0000-0000-000000000000');

      // Delete all people
      await this.supabase.from('people').delete().neq('id', '00000000-0000-0000-0000-000000000000');

      console.log('All data cleared from storage');
    } catch (error) {
      console.error('Error clearing storage:', error);
      throw error;
    }
  }

  /**
   * Get storage statistics
   */
  getStats(): { totalPeople: number; filePath: string; fileSize: number } {
    // Note: This is synchronous in FileStorageClient but async here
    // For compatibility, we return placeholder and log a warning
    console.warn('getStats() is deprecated. Use getStatsAsync() instead.');
    return {
      totalPeople: 0,
      filePath: 'supabase://people',
      fileSize: 0
    };
  }

  /**
   * Get storage statistics for a specific user (async version)
   */
  async getStatsAsync(userId: string): Promise<{
    totalPeople: number;
    totalConversations: number;
    peopleWithVoices: number;
    averageConversationsPerPerson: number;
  }> {
    try {
      // Use the storage_stats view created in schema.sql
      const { data, error } = await this.supabase
        .from('storage_stats')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) throw error;

      return {
        totalPeople: data?.total_people || 0,
        totalConversations: data?.total_conversations || 0,
        peopleWithVoices: data?.people_with_voices || 0,
        averageConversationsPerPerson: parseFloat(data?.avg_conversations_per_person || '0')
      };
    } catch (error) {
      console.error('Error getting stats:', error);
      return {
        totalPeople: 0,
        totalConversations: 0,
        peopleWithVoices: 0,
        averageConversationsPerPerson: 0
      };
    }
  }

  /**
   * Check if storage is connected/available
   */
  isReady(): boolean {
    return this.isConnected;
  }

  /**
   * Export storage to JSON string for a specific user
   */
  async exportData(userId: string): Promise<string> {
    try {
      const people = await this.getAllPeople(userId);
      const exportData = {
        people: people.reduce((acc, person) => {
          const key = `person_${person.name.toLowerCase().replace(/\s+/g, '_')}`;
          acc[key] = person;
          return acc;
        }, {} as { [key: string]: Person }),
        version: '2.0.0',
        lastModified: new Date().toISOString(),
        source: 'supabase'
      };

      return JSON.stringify(exportData, null, 2);
    } catch (error) {
      console.error('Error exporting data:', error);
      return '{}';
    }
  }

  /**
   * Import storage from JSON string
   */
  async importData(jsonData: string): Promise<void> {
    try {
      const data = JSON.parse(jsonData);

      if (!data.people || typeof data.people !== 'object') {
        throw new Error('Invalid data structure');
      }

      // Import each person
      const importPromises = Object.values(data.people).map((person: any) =>
        this.storePerson(person as Person)
      );

      await Promise.all(importPromises);

      console.log('Data imported successfully');
    } catch (error) {
      console.error('Error importing data:', error);
      throw error;
    }
  }

  /**
   * Disconnect (cleanup) - compatibility method
   */
  disconnect(): void {
    console.log('Supabase storage connection closed');
    this.isConnected = false;
  }
}
