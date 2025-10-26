"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryClient = void 0;
const axios_1 = __importDefault(require("axios"));
class MemoryClient {
    constructor(mcpUrl) {
        this.baseUrl = mcpUrl;
    }
    /**
     * Store a person's information in memory
     */
    async storePerson(person) {
        try {
            const memory = {
                name: person.name,
                speakerId: person.speakerId,
                lastConversation: person.lastConversation || '',
                lastTopics: person.lastTopics || [],
                lastMet: person.lastMet ? person.lastMet.toISOString() : new Date().toISOString()
            };
            // Store as a memory entry
            await this.storeMemory(`person_${person.speakerId}`, JSON.stringify(memory));
            console.log(`Stored memory for ${person.name} (Speaker ${person.speakerId})`);
        }
        catch (error) {
            console.error('Error storing person:', error);
            throw error;
        }
    }
    /**
     * Retrieve a person by speaker ID
     */
    async getPerson(speakerId) {
        try {
            const memory = await this.getMemory(`person_${speakerId}`);
            if (!memory)
                return null;
            const data = JSON.parse(memory);
            return {
                name: data.name,
                speakerId: data.speakerId,
                lastConversation: data.lastConversation,
                lastTopics: data.lastTopics,
                lastMet: new Date(data.lastMet)
            };
        }
        catch (error) {
            console.error('Error retrieving person:', error);
            return null;
        }
    }
    /**
     * Search for a person by name
     */
    async findPersonByName(name) {
        try {
            const memories = await this.searchMemories(name);
            if (!memories || memories.length === 0)
                return null;
            // Find the person memory
            const personMemory = memories.find((m) => {
                try {
                    const data = JSON.parse(m.value || m);
                    return data.name?.toLowerCase() === name.toLowerCase();
                }
                catch {
                    return false;
                }
            });
            if (!personMemory)
                return null;
            const data = JSON.parse(personMemory.value || personMemory);
            return {
                name: data.name,
                speakerId: data.speakerId,
                lastConversation: data.lastConversation,
                lastTopics: data.lastTopics,
                lastMet: new Date(data.lastMet)
            };
        }
        catch (error) {
            console.error('Error finding person by name:', error);
            return null;
        }
    }
    /**
     * Generic method to store a memory
     */
    async storeMemory(key, value) {
        try {
            // MCP memory server typically uses POST with key-value pairs
            await axios_1.default.post(this.baseUrl, {
                action: 'store',
                key,
                value
            }, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        }
        catch (error) {
            console.error('Error storing memory:', error);
            throw error;
        }
    }
    /**
     * Generic method to retrieve a memory
     */
    async getMemory(key) {
        try {
            const response = await axios_1.default.post(this.baseUrl, {
                action: 'retrieve',
                key
            }, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            return response.data?.value || null;
        }
        catch (error) {
            console.error('Error retrieving memory:', error);
            return null;
        }
    }
    /**
     * Search memories by query
     */
    async searchMemories(query) {
        try {
            const response = await axios_1.default.post(this.baseUrl, {
                action: 'search',
                query
            }, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            return response.data?.results || [];
        }
        catch (error) {
            console.error('Error searching memories:', error);
            return [];
        }
    }
}
exports.MemoryClient = MemoryClient;
