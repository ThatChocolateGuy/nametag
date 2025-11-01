import fs from 'fs';
import path from 'path';

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
  voiceReference?: string;  // Base64 encoded audio clip (2-10 seconds)
  conversationHistory: ConversationEntry[];  // Full history of all conversations
  lastConversation?: string;  // Deprecated - kept for backward compatibility
  lastTopics?: string[];      // Deprecated - kept for backward compatibility
  lastMet?: Date;
}

interface StorageData {
  people: { [key: string]: Person };
  version: string;
  lastModified: string;
}

/**
 * File-based storage client - drop-in replacement for MemoryClient
 * Stores person data in local JSON file at ./data/memories.json
 *
 * Note: On Vercel (read-only filesystem), operates in read-only mode
 */
export class FileStorageClient {
  private filePath: string;
  private isConnected = true;
  private isReadOnly = false;

  constructor(dataDir: string = './data') {
    // Set up data directory and file path
    this.filePath = path.join(dataDir, 'memories.json');

    // Try to ensure data directory exists
    try {
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
        console.log(`Created data directory: ${dataDir}`);
      }
    } catch (error) {
      console.warn(`Cannot create data directory (read-only filesystem): ${dataDir}`);
      this.isReadOnly = true;
    }

    // Try to initialize storage file if it doesn't exist
    if (!this.isReadOnly && !fs.existsSync(this.filePath)) {
      try {
        this.initializeStorage();
      } catch (error) {
        console.warn(`Cannot initialize storage file (read-only filesystem): ${this.filePath}`);
        this.isReadOnly = true;
      }
    }

    if (this.isReadOnly) {
      console.log(`File Storage Client initialized in READ-ONLY mode`);
      console.log(`Storage path: ${this.filePath} (not writable)`);
      console.log(`Note: Running on read-only filesystem (Vercel). Write operations will be skipped.`);
    } else {
      console.log(`File Storage Client initialized`);
      console.log(`Storage path: ${this.filePath}`);
    }
  }

  /**
   * Initialize storage file with empty data structure
   */
  private initializeStorage(): void {
    const initialData: StorageData = {
      people: {},
      version: '1.0.0',
      lastModified: new Date().toISOString()
    };

    fs.writeFileSync(
      this.filePath,
      JSON.stringify(initialData, null, 2),
      'utf-8'
    );

    console.log(`Initialized storage file: ${this.filePath}`);
  }

  /**
   * Read storage data from file
   */
  private readStorage(): StorageData {
    // If file doesn't exist or we're in read-only mode, return empty data
    if (!fs.existsSync(this.filePath)) {
      console.warn('Storage file does not exist. Returning empty data structure.');
      return {
        people: {},
        version: '1.0.0',
        lastModified: new Date().toISOString()
      };
    }

    try {
      const data = fs.readFileSync(this.filePath, 'utf-8');
      const parsed = JSON.parse(data);
      
      // Migration: Add conversationHistory to existing people
      if (parsed.people) {
        Object.keys(parsed.people).forEach(key => {
          const person = parsed.people[key];
          if (!person.conversationHistory) {
            // Migrate old format to new format
            person.conversationHistory = [];
            
            // If there's a lastConversation, create one history entry
            if (person.lastConversation || person.lastTopics) {
              person.conversationHistory.push({
                date: person.lastMet || new Date(),
                transcript: person.lastConversation || '',
                topics: person.lastTopics || []
              });
            }
          }
          
          // Ensure dates are Date objects
          if (person.lastMet && typeof person.lastMet === 'string') {
            person.lastMet = new Date(person.lastMet);
          }
          
          // Convert conversation history dates
          if (person.conversationHistory) {
            person.conversationHistory = person.conversationHistory.map((conv: any) => ({
              ...conv,
              date: conv.date instanceof Date ? conv.date : new Date(conv.date)
            }));
          }
        });
      }
      
      return parsed;
    } catch (error) {
      console.error('Error reading storage:', error);
      // Return empty storage on error
      return {
        people: {},
        version: '1.0.0',
        lastModified: new Date().toISOString()
      };
    }
  }

  /**
   * Write storage data to file
   */
  private writeStorage(data: StorageData): void {
    // Skip writes if in read-only mode
    if (this.isReadOnly) {
      console.warn('Cannot write to storage (read-only mode)');
      return;
    }

    try {
      data.lastModified = new Date().toISOString();
      fs.writeFileSync(
        this.filePath,
        JSON.stringify(data, null, 2),
        'utf-8'
      );
    } catch (error) {
      console.error('Error writing storage:', error);
      // Mark as read-only if write fails
      this.isReadOnly = true;
      console.warn('Filesystem appears to be read-only. Switching to read-only mode.');
    }
  }

  /**
   * Store a person's information
   */
  async storePerson(person: Person): Promise<void> {
    // Skip writes if in read-only mode
    if (this.isReadOnly) {
      console.warn(`Cannot store person ${person.name} (read-only mode)`);
      return;
    }

    try {
      const storage = this.readStorage();

      // Create key from person's name (normalized)
      const key = `person_${person.name.toLowerCase().replace(/\s+/g, '_')}`;

      // Check if person already exists - if so, update their speaker ID mapping
      const existing = storage.people[key];
      if (existing && existing.speakerId !== person.speakerId) {
        console.log(`✓ Updated ${person.name}'s speaker ID: ${existing.speakerId} → ${person.speakerId}`);
      }

      // Store person data
      storage.people[key] = {
        ...person,
        lastMet: person.lastMet || new Date()
      };

      this.writeStorage(storage);

      console.log(`✓ Stored ${person.name} (Speaker ${person.speakerId})`);
    } catch (error) {
      console.warn(`Could not store person ${person.name}:`, error);
    }
  }

  /**
   * Retrieve a person by speaker ID or name
   * Searches through all people to find one with matching speaker ID or name
   */
  async getPerson(speakerIdOrName: string): Promise<Person | null> {
    try {
      const storage = this.readStorage();

      // Search through all people for matching speaker ID or name
      for (const key in storage.people) {
        const person = storage.people[key];
        // Match by speaker ID OR by name (case-insensitive)
        if (person.speakerId === speakerIdOrName || 
            person.name.toLowerCase() === speakerIdOrName.toLowerCase()) {
          return {
            ...person,
            lastMet: person.lastMet ? new Date(person.lastMet) : undefined
          };
        }
      }

      return null;
    } catch (error) {
      console.error('Error retrieving person:', error);
      return null;
    }
  }

  /**
   * Search for a person by name (case-insensitive)
   */
  async findPersonByName(name: string): Promise<Person | null> {
    try {
      const storage = this.readStorage();
      const nameLower = name.toLowerCase();

      // Search through all people
      for (const key in storage.people) {
        const person = storage.people[key];
        if (person.name.toLowerCase() === nameLower) {
          return {
            ...person,
            lastMet: person.lastMet ? new Date(person.lastMet) : undefined
          };
        }
      }

      return null;
    } catch (error) {
      console.error('Error finding person by name:', error);
      return null;
    }
  }

  /**
   * Get all stored people
   */
  async getAllPeople(): Promise<Person[]> {
    try {
      const storage = this.readStorage();
      return Object.values(storage.people).map(person => ({
        ...person,
        lastMet: person.lastMet ? new Date(person.lastMet) : undefined
      }));
    } catch (error) {
      console.error('Error getting all people:', error);
      return [];
    }
  }

  /**
   * Delete a person by name
   */
  async deletePerson(name: string): Promise<boolean> {
    // Skip writes if in read-only mode
    if (this.isReadOnly) {
      console.warn(`Cannot delete person ${name} (read-only mode)`);
      return false;
    }

    try {
      const storage = this.readStorage();
      const key = `person_${name.toLowerCase().replace(/\s+/g, '_')}`;

      if (!storage.people[key]) {
        return false;
      }

      delete storage.people[key];
      this.writeStorage(storage);

      console.log(`Deleted person: ${name}`);
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
    // Skip writes if in read-only mode
    if (this.isReadOnly) {
      console.warn('Cannot clear storage (read-only mode)');
      return;
    }

    try {
      this.initializeStorage();
      console.log('All data cleared from storage');
    } catch (error) {
      console.error('Error clearing storage:', error);
    }
  }

  /**
   * Get storage statistics
   */
  getStats(): { totalPeople: number; filePath: string; fileSize: number } {
    try {
      const storage = this.readStorage();
      const stats = fs.statSync(this.filePath);

      return {
        totalPeople: Object.keys(storage.people).length,
        filePath: this.filePath,
        fileSize: stats.size
      };
    } catch (error) {
      console.error('Error getting stats:', error);
      return {
        totalPeople: 0,
        filePath: this.filePath,
        fileSize: 0
      };
    }
  }

  /**
   * Check if storage is connected/available
   */
  isReady(): boolean {
    return this.isConnected && fs.existsSync(this.filePath);
  }

  /**
   * Export storage to JSON string
   */
  exportData(): string {
    try {
      const storage = this.readStorage();
      return JSON.stringify(storage, null, 2);
    } catch (error) {
      console.error('Error exporting data:', error);
      return '{}';
    }
  }

  /**
   * Import storage from JSON string
   */
  importData(jsonData: string): void {
    // Skip writes if in read-only mode
    if (this.isReadOnly) {
      console.warn('Cannot import data (read-only mode)');
      throw new Error('Cannot import data in read-only mode');
    }

    try {
      const data: StorageData = JSON.parse(jsonData);

      // Validate data structure
      if (!data.people || typeof data.people !== 'object') {
        throw new Error('Invalid data structure');
      }

      this.writeStorage(data);
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
    // No-op for file storage, but provided for interface compatibility
    console.log('File storage connection closed');
    this.isConnected = false;
  }
}
