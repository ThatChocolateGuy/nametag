import axios from 'axios';
import https from 'https';

// Create axios instance with SSL bypass for development
const axiosInstance = axios.create({
  httpsAgent: new https.Agent({
    rejectUnauthorized: false
  })
});

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

export class MemoryClient {
  private baseUrl: string;
  private userUuid: string;
  private postEndpoint?: string;
  private isConnected = false;
  private sseAbortController?: AbortController;

  constructor(mcpUrl: string) {
    // Extract UUID from URL like: https://memory.mcpgenerator.com/{uuid}/sse
    const matches = mcpUrl.match(/\/([a-f0-9-]+)\/(sse)?$/);
    if (!matches) {
      throw new Error('Invalid Memory MCP URL format. Expected: https://memory.mcpgenerator.com/{uuid}/sse');
    }

    this.userUuid = matches[1];
    this.baseUrl = mcpUrl.replace(/\/sse$/, '');

    console.log(`Memory MCP Client initialized`);
    console.log(`Base URL: ${this.baseUrl}`);
    console.log(`User UUID: ${this.userUuid}`);

    // Start SSE connection to get JSON-RPC endpoint
    this.connectSSE();
  }

  /**
   * Establish SSE connection using native fetch to get the POST endpoint
   */
  private async connectSSE(): Promise<void> {
    try {
      const sseUrl = `${this.baseUrl}/sse`;
      console.log(`Connecting to Memory MCP SSE: ${sseUrl}`);

      this.sseAbortController = new AbortController();

      // Use fetch with streaming for SSE (works better with Bun)
      const response = await fetch(sseUrl, {
        headers: {
          'Accept': 'text/event-stream'
        },
        signal: this.sseAbortController.signal
      });

      if (!response.ok) {
        console.error(`SSE connection failed with status ${response.status}`);
        return;
      }

      console.log('SSE connection established, reading stream...');

      // Read the stream
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        console.error('No stream reader available');
        return;
      }

      // Process SSE messages
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          console.log('SSE stream ended');
          break;
        }

        // Decode and process chunk
        buffer += decoder.decode(value, { stream: true });

        // Process complete messages
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        let currentEvent = '';
        let currentData = '';

        for (const line of lines) {
          if (line.startsWith('event:')) {
            currentEvent = line.substring(6).trim();
          } else if (line.startsWith('data:')) {
            currentData = line.substring(5).trim();
          } else if (line === '') {
            // Empty line marks end of message
            if (currentData) {
              this.handleSSEMessage(currentEvent, currentData);
              currentEvent = '';
              currentData = '';
            }
          }
        }
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('SSE connection aborted');
      } else {
        console.error('Error establishing SSE connection:', error);
      }
    }
  }

  /**
   * Handle incoming SSE messages
   */
  private handleSSEMessage(event: string, data: string): void {
    try {
      console.log(`Received SSE ${event || 'message'} event:`, data);

      // Parse the data
      const parsed = JSON.parse(data);

      // Look for endpoint URI - this is what we need for JSON-RPC calls
      if (parsed.postEndpointUri || parsed.uri || parsed.endpoint) {
        this.postEndpoint = parsed.postEndpointUri || parsed.uri || parsed.endpoint;
        this.isConnected = true;
        console.log(`✓ Memory MCP Client connected!`);
        console.log(`✓ POST endpoint: ${this.postEndpoint}`);
      } else {
        console.log('SSE message data:', parsed);
      }
    } catch (error) {
      console.error('Error parsing SSE message:', error);
      console.log('Raw SSE data:', data);
    }
  }

  /**
   * Wait for SSE connection to be established
   */
  private async waitForConnection(timeoutMs = 5000): Promise<boolean> {
    const startTime = Date.now();
    while (!this.isConnected && (Date.now() - startTime) < timeoutMs) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return this.isConnected;
  }

  /**
   * Store a person's information in memory
   */
  async storePerson(person: Person): Promise<void> {
    try {
      if (!this.isConnected) {
        const connected = await this.waitForConnection();
        if (!connected) {
          console.warn('Memory MCP not connected. Skipping memory storage.');
          return;
        }
      }

      const memory = {
        name: person.name,
        speakerId: person.speakerId,
        lastConversation: person.lastConversation || '',
        lastTopics: person.lastTopics || [],
        lastMet: person.lastMet ? person.lastMet.toISOString() : new Date().toISOString()
      };

      await this.storeMemory(
        `person_${person.speakerId}`,
        JSON.stringify(memory)
      );

      console.log(`Stored memory for ${person.name} (Speaker ${person.speakerId})`);
    } catch (error) {
      console.warn(`Could not store person ${person.name}:`, error);
    }
  }

  /**
   * Retrieve a person by speaker ID
   */
  async getPerson(speakerId: string): Promise<Person | null> {
    try {
      const memory = await this.getMemory(`person_${speakerId}`);
      if (!memory) return null;

      const data = JSON.parse(memory);
      return {
        name: data.name,
        speakerId: data.speakerId,
        voiceReference: data.voiceReference,
        conversationHistory: data.conversationHistory || [],
        lastConversation: data.lastConversation,
        lastTopics: data.lastTopics,
        lastMet: new Date(data.lastMet)
      };
    } catch (error) {
      console.error('Error retrieving person:', error);
      return null;
    }
  }

  /**
   * Search for a person by name
   */
  async findPersonByName(name: string): Promise<Person | null> {
    try {
      const memories = await this.getAllMemories();
      if (!memories || memories.length === 0) return null;

      // Find the person memory
      const personMemory = memories.find((m: any) => {
        try {
          // Memory MCP returns objects with 'content' field
          const content = m.content || m.value;
          if (!content) return false;

          const data = typeof content === 'string' ? JSON.parse(content) : content;
          return data.name?.toLowerCase() === name.toLowerCase();
        } catch {
          return false;
        }
      });

      if (!personMemory) return null;

      const content = personMemory.content || personMemory.value;
      const data = typeof content === 'string' ? JSON.parse(content) : content;

      return {
        name: data.name,
        speakerId: data.speakerId,
        voiceReference: data.voiceReference,
        conversationHistory: data.conversationHistory || [],
        lastConversation: data.lastConversation,
        lastTopics: data.lastTopics,
        lastMet: new Date(data.lastMet)
      };
    } catch (error) {
      console.error('Error finding person by name:', error);
      return null;
    }
  }

  /**
   * Store a memory using Memory MCP JSON-RPC protocol
   */
  private async storeMemory(key: string, value: string): Promise<void> {
    if (!this.postEndpoint) {
      console.warn('Memory MCP POST endpoint not available yet. Skipping storage.');
      return;
    }

    try {
      // Use JSON-RPC 2.0 protocol to create memory
      const response = await axiosInstance.post(this.postEndpoint, {
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'memories/create',
        params: {
          content: value
        }
      }, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.data?.result || response.data?.success) {
        console.log(`✓ Memory stored: ${key}`);
      } else if (response.data?.error) {
        console.warn(`Memory storage error:`, response.data.error);
      } else {
        console.log(`Memory stored (JSON-RPC response):`, response.data);
      }
    } catch (error: any) {
      console.warn(`Warning: Could not store memory ${key}:`, error.message);
      if (error.response?.data) {
        console.warn(`Response data:`, error.response.data);
      }
    }
  }

  /**
   * Retrieve a memory by key using REST API
   */
  private async getMemory(key: string): Promise<string | null> {
    try {
      // GET /{uuid}/memories/{memoryId}
      const url = `${this.baseUrl}/memories/${encodeURIComponent(key)}`;
      const response = await axiosInstance.get(url, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      return response.data?.content || response.data || null;
    } catch (error: any) {
      if (error.response?.status === 404) {
        // Memory doesn't exist
        return null;
      }
      console.error(`Error retrieving memory ${key}:`, error.message);
      return null;
    }
  }

  /**
   * Get all memories using REST API
   */
  private async getAllMemories(): Promise<any[]> {
    try {
      // GET /{uuid}/memories
      const response = await axiosInstance.get(`${this.baseUrl}/memories`, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      // API returns {success: true, memories: [...]}
      return response.data?.memories || [];
    } catch (error: any) {
      if (error.response?.status === 404) {
        // No memories yet, return empty array
        return [];
      }
      console.error('Error fetching all memories:', error.response?.data || error.message);
      return [];
    }
  }

  /**
   * Clean up SSE connection
   */
  disconnect(): void {
    if (this.sseAbortController) {
      this.sseAbortController.abort();
      this.isConnected = false;
      console.log('Memory MCP SSE connection closed');
    }
  }
}
