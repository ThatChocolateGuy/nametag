import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { Person } from './supabaseStorageClient';

export interface TranscriptionSegment {
  speaker: string;  // Actual name or "Unknown"
  text: string;
  start: number;
  end: number;
}

export interface KnownSpeaker {
  name: string;
  voiceReference: string;  // Base64 encoded audio
}

/**
 * OpenAI Transcription Service with Voice Recognition
 * Uses gpt-4o-transcribe-diarize to identify speakers by voice
 */
export class OpenAITranscriptionService {
  private client: OpenAI;
  private tempDir: string = './temp';
  private audioBuffer: Buffer[] = [];
  private audioHistory: Array<{ buffer: Buffer; timestamp: number }> = [];
  private readonly audioHistoryDuration = 30000;  // Keep 30s of audio history
  private bufferInterval: number = 10000;  // Process every 10 seconds
  private bufferTimer?: NodeJS.Timeout;
  private onTranscriptionCallback?: (segment: TranscriptionSegment) => void;
  private bufferStartTime: number = 0;
  private knownPeople: Person[] = []; // Store known people for updates

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });

    // Create temp directory
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * Start buffering and processing audio
   */
  async start(
    knownPeople: Person[],
    onTranscription: (segment: TranscriptionSegment) => void
  ): Promise<void> {
    this.onTranscriptionCallback = onTranscription;
    this.knownPeople = knownPeople; // Store for later updates

    // Process buffer periodically
    this.bufferTimer = setInterval(async () => {
      await this.processBuffer(this.knownPeople);
    }, this.bufferInterval);

    console.log('✓ OpenAI transcription service started');
  }

  /**
   * Update the list of known people for voice recognition
   */
  updateKnownPeople(knownPeople: Person[]): void {
    this.knownPeople = knownPeople;
    const peopleWithVoices = knownPeople.filter(p => p.voiceReference);
    console.log(`✓ Voice database updated: ${peopleWithVoices.length} people with voice profiles`);
  }

  /**
   * Buffer audio chunk
   */
  bufferAudio(chunk: Buffer): void {
    const timestamp = Date.now();
    
    // Add to current buffer
    this.audioBuffer.push(chunk);
    
    // Add to rolling history with timestamp
    this.audioHistory.push({ buffer: chunk, timestamp });
    
    // Clean up old history (keep only last 30 seconds)
    const cutoffTime = timestamp - this.audioHistoryDuration;
    this.audioHistory = this.audioHistory.filter(h => h.timestamp > cutoffTime);
  }

  /**
   * Process buffered audio with voice recognition
   */
  private async processBuffer(knownPeople: Person[]): Promise<void> {
    if (this.audioBuffer.length === 0) return;

    console.log(`\n🎤 Processing ${this.audioBuffer.length} audio chunks...`);

    try {
      // 1. Combine audio chunks
      const combinedAudio = Buffer.concat(this.audioBuffer);
      
      // 2. Save as WAV file
      const wavPath = await this.saveAsWav(combinedAudio);

      // 3. Prepare known speaker references
      const knownSpeakers = knownPeople
        .filter(p => p.voiceReference)
        .map(p => ({
          name: p.name,
          voiceReference: p.voiceReference!
        }));

      if (knownSpeakers.length > 0) {
        console.log(`🎯 Using ${knownSpeakers.length} known voice(s) for recognition: ${knownSpeakers.map(s => s.name).join(', ')}`);
      }

      // 4. Transcribe with voice recognition
      const segments = await this.transcribeWithVoiceRecognition(
        wavPath,
        knownSpeakers
      );

      // 5. Send segments to callback
      if (this.onTranscriptionCallback) {
        for (const segment of segments) {
          this.onTranscriptionCallback(segment);
        }
      }

      // 6. Clean up
      fs.unlinkSync(wavPath);
      this.audioBuffer = [];

    } catch (error) {
      console.error('Error processing buffer:', error);
      this.audioBuffer = [];
    }
  }

  /**
   * Transcribe audio with voice recognition
   */
  private async transcribeWithVoiceRecognition(
    audioPath: string,
    knownSpeakers: KnownSpeaker[]
  ): Promise<TranscriptionSegment[]> {
    try {
      const audioFile = fs.createReadStream(audioPath);

      // Build request parameters
      const params: any = {
        model: 'gpt-4o-transcribe-diarize',
        file: audioFile,
        response_format: 'diarized_json',
        chunking_strategy: 'auto'
      };

      // Add known speaker references if available
      if (knownSpeakers.length > 0) {
        // Extract just the base64 part from data URLs (remove "data:audio/wav;base64," prefix)
        const speakerReferences = knownSpeakers.map(s => {
          if (s.voiceReference.startsWith('data:')) {
            // Remove the data URL prefix
            return s.voiceReference.split(',')[1];
          }
          return s.voiceReference;
        });

        params.extra_body = {
          known_speaker_names: knownSpeakers.map(s => s.name),
          known_speaker_references: speakerReferences
        };
        
        console.log(`✓ Using ${knownSpeakers.length} known voice(s): ${knownSpeakers.map(s => s.name).join(', ')}`);
        console.log(`  Reference sizes: ${speakerReferences.map(r => `${(r.length / 1024).toFixed(1)}KB`).join(', ')}`);
      }

      console.log(`📡 Sending to OpenAI (params):`, JSON.stringify({
        model: params.model,
        response_format: params.response_format,
        chunking_strategy: params.chunking_strategy,
        extra_body: params.extra_body ? {
          known_speaker_names: params.extra_body.known_speaker_names,
          known_speaker_references: params.extra_body.known_speaker_references?.map((r: string) => `${r.substring(0, 50)}... (${r.length} chars)`)
        } : undefined
      }, null, 2));

      const transcript = await this.client.audio.transcriptions.create(params);

      console.log(`📥 Response preview:`, JSON.stringify(transcript, null, 2).substring(0, 600));

      // Parse segments from diarized response
      const segments: TranscriptionSegment[] = [];
      const transcriptData = transcript as any;  // Type assertion for diarized response
      
      if (transcriptData.segments && Array.isArray(transcriptData.segments)) {
        console.log(`  Segment 0 speaker:`, transcriptData.segments[0]?.speaker);
        for (const seg of transcriptData.segments) {
          segments.push({
            speaker: seg.speaker || 'Unknown',
            text: seg.text,
            start: seg.start,
            end: seg.end
          });
        }
      }

      console.log(`✓ Transcribed ${segments.length} segments`);
      return segments;

    } catch (error) {
      console.error('Error transcribing with voice recognition:', error);
      return [];
    }
  }

  /**
   * Save PCM audio buffer as WAV file
   */
  private async saveAsWav(pcmBuffer: Buffer): Promise<string> {
    const wavPath = path.join(this.tempDir, `audio_${Date.now()}.wav`);
    const sampleRate = 16000;

    // Create WAV header (44 bytes)
    const wavHeader = Buffer.alloc(44);

    // RIFF chunk descriptor
    wavHeader.write('RIFF', 0);
    wavHeader.writeUInt32LE(36 + pcmBuffer.length, 4);
    wavHeader.write('WAVE', 8);

    // fmt sub-chunk
    wavHeader.write('fmt ', 12);
    wavHeader.writeUInt32LE(16, 16);  // Subchunk size
    wavHeader.writeUInt16LE(1, 20);   // Audio format (1 = PCM)
    wavHeader.writeUInt16LE(1, 22);   // Number of channels (1 = mono)
    wavHeader.writeUInt32LE(sampleRate, 24);  // Sample rate
    wavHeader.writeUInt32LE(sampleRate * 2, 28);  // Byte rate
    wavHeader.writeUInt16LE(2, 32);   // Block align
    wavHeader.writeUInt16LE(16, 34);  // Bits per sample

    // data sub-chunk
    wavHeader.write('data', 36);
    wavHeader.writeUInt32LE(pcmBuffer.length, 40);

    // Combine header and audio
    const wavBuffer = Buffer.concat([wavHeader, pcmBuffer]);
    fs.writeFileSync(wavPath, wavBuffer);

    return wavPath;
  }

  /**
   * Stop the service
   */
  async stop(): Promise<void> {
    if (this.bufferTimer) {
      clearInterval(this.bufferTimer);
      this.bufferTimer = undefined;
    }

    // Process remaining buffer
    if (this.audioBuffer.length > 0) {
      console.log('Processing remaining audio buffer...');
      await this.processBuffer([]);
    }

    console.log('✓ OpenAI transcription service stopped');
  }

  /**
   * Extract a voice reference clip from recent audio
   * Gets the last N seconds of audio from the buffer
   * @param durationMs Duration in milliseconds (default 5000ms = 5s)
   * @returns Base64 encoded WAV audio clip
   */
  async extractRecentVoiceClip(durationMs: number = 5000): Promise<string | null> {
    if (this.audioHistory.length === 0) {
      console.log('⚠️  No audio history available for voice clip extraction');
      return null;
    }

    const now = Date.now();
    const startTime = now - durationMs;

    // Get chunks from the last N seconds
    const recentChunks = this.audioHistory
      .filter(h => h.timestamp >= startTime)
      .map(h => h.buffer);

    if (recentChunks.length === 0) {
      console.log('⚠️  No recent audio chunks found');
      return null;
    }

    try {
      // Combine chunks
      const combinedAudio = Buffer.concat(recentChunks);
      
      // Convert to WAV
      const wavPath = await this.saveAsWav(combinedAudio);
      const wavBuffer = fs.readFileSync(wavPath);
      
      // Convert to base64
      const base64 = wavBuffer.toString('base64');
      const dataUrl = `data:audio/wav;base64,${base64}`;

      // Clean up temp file
      fs.unlinkSync(wavPath);

      const durationSec = durationMs / 1000;
      console.log(`✓ Extracted ${durationSec}s voice clip (${recentChunks.length} chunks, ${(base64.length / 1024).toFixed(1)}KB)`);

      return dataUrl;
    } catch (error) {
      console.error('Error extracting voice clip:', error);
      return null;
    }
  }

  /**
   * Extract a voice reference clip from audio buffer
   * Returns base64 encoded WAV file (5-10 seconds recommended)
   */
  async extractVoiceReference(
    audioChunks: Buffer[],
    startMs: number,
    durationMs: number = 5000
  ): Promise<string> {
    // Calculate which chunks to extract based on timing
    // Assuming 16kHz sample rate, 16-bit PCM = 32000 bytes/second
    const bytesPerMs = 32;
    const startByte = startMs * bytesPerMs;
    const endByte = (startMs + durationMs) * bytesPerMs;

    // Combine relevant chunks
    const combinedAudio = Buffer.concat(audioChunks);
    const clipAudio = combinedAudio.slice(startByte, endByte);

    // Convert to WAV
    const wavPath = await this.saveAsWav(clipAudio);
    const wavBuffer = fs.readFileSync(wavPath);
    
    // Convert to base64 data URL
    const base64 = wavBuffer.toString('base64');
    const dataUrl = `data:audio/wav;base64,${base64}`;

    // Clean up temp file
    fs.unlinkSync(wavPath);

    return dataUrl;
  }
}
