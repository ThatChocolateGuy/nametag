import { AssemblyAI, RealtimeTranscript } from 'assemblyai';
import * as fs from 'fs';
import * as path from 'path';

export interface TranscriptionSegment {
  speaker: string;
  text: string;
  timestamp: number;
  isFinal: boolean;
}

interface BufferedSegment {
  text: string;
  timestamp: number;
  startTime: number;  // Relative to buffer start
  endTime: number;
}

interface AudioBuffer {
  chunks: Buffer[];
  segments: BufferedSegment[];
  startTime: number;
  totalDuration: number;  // in milliseconds
}

export class DiarizationService {
  private client: AssemblyAI;
  private transcriber: any = null;
  private onSegmentCallback?: (segment: TranscriptionSegment) => void;
  private onSpeakerCorrectionCallback?: (corrections: Map<number, string>) => void;

  // Hybrid approach: buffer audio for async diarization
  private audioBuffer: AudioBuffer = {
    chunks: [],
    segments: [],
    startTime: Date.now(),
    totalDuration: 0
  };
  private bufferInterval: number = 15000; // Process buffer every 15 seconds
  private bufferTimer?: NodeJS.Timeout;
  private sampleRate: number = 16000;
  private tempDir: string = './temp';

  constructor(apiKey: string) {
    this.client = new AssemblyAI({
      apiKey: apiKey
    });

    // Create temp directory for audio files
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * Start hybrid diarization: immediate transcription + buffered speaker diarization
   */
  async startHybrid(
    onSegment: (segment: TranscriptionSegment) => void,
    onSpeakerCorrection: (corrections: Map<number, string>) => void,
    sampleRate: number = 16000
  ): Promise<void> {
    this.onSegmentCallback = onSegment;
    this.onSpeakerCorrectionCallback = onSpeakerCorrection;
    this.sampleRate = sampleRate;

    console.log('✓ Starting hybrid diarization (immediate transcription + async speaker detection)');

    // Start periodic buffer processing
    this.bufferTimer = setInterval(() => {
      this.processBuffer().catch(err => {
        console.error('Error processing audio buffer:', err);
      });
    }, this.bufferInterval);

    console.log(`✓ Hybrid diarization started (buffer interval: ${this.bufferInterval}ms)`);
  }

  /**
   * Buffer a transcript segment (from MentraOS)
   */
  bufferTranscript(text: string, timestamp: number): void {
    if (!text.trim()) return;

    const relativeTime = timestamp - this.audioBuffer.startTime;

    this.audioBuffer.segments.push({
      text,
      timestamp,
      startTime: relativeTime,
      endTime: relativeTime + 2000  // Estimate 2 second duration
    });
  }

  /**
   * Buffer an audio chunk for async diarization
   */
  bufferAudio(chunk: Buffer): void {
    this.audioBuffer.chunks.push(chunk);

    // Estimate duration based on sample rate and buffer size
    // PCM 16-bit = 2 bytes per sample
    const samples = chunk.length / 2;
    const durationMs = (samples / this.sampleRate) * 1000;
    this.audioBuffer.totalDuration += durationMs;
  }

  /**
   * Process buffered audio: convert to WAV, upload for diarization, assign speakers
   */
  private async processBuffer(): Promise<void> {
    // Skip if buffer is empty or too small
    if (this.audioBuffer.chunks.length === 0 || this.audioBuffer.segments.length === 0) {
      return;
    }

    console.log(`\n🎤 Processing audio buffer: ${this.audioBuffer.segments.length} segments, ${this.audioBuffer.totalDuration.toFixed(0)}ms duration`);

    try {
      // 1. Combine audio chunks into single buffer
      const combinedAudio = Buffer.concat(this.audioBuffer.chunks);

      // 2. Save as temporary WAV file
      const wavPath = await this.saveAsWav(combinedAudio, this.sampleRate);

      // 3. Upload to AssemblyAI for async transcription with speaker labels
      console.log('📤 Uploading to AssemblyAI for diarization...');
      const transcript = await this.client.transcripts.transcribe({
        audio: wavPath,
        speaker_labels: true  // CRITICAL: Enable speaker diarization
      });

      // 4. Extract speaker information from utterances
      if (transcript.utterances && transcript.utterances.length > 0) {
        console.log(`✓ Received ${transcript.utterances.length} diarized utterances`);

        // 5. Match utterances to buffered segments and assign speakers
        const corrections = this.matchSpeakers(transcript.utterances, this.audioBuffer.segments);

        // 6. Send corrections to callback
        if (this.onSpeakerCorrectionCallback && corrections.size > 0) {
          this.onSpeakerCorrectionCallback(corrections);
          console.log(`✓ Corrected ${corrections.size} speaker assignments`);
        }
      } else {
        console.log('⚠️  No utterances returned from AssemblyAI');
      }

      // 7. Clean up temp file
      fs.unlinkSync(wavPath);

      // 8. Reset buffer for next interval
      this.audioBuffer = {
        chunks: [],
        segments: [],
        startTime: Date.now(),
        totalDuration: 0
      };

    } catch (error) {
      console.error('Error processing buffer:', error);
      // Reset buffer anyway to avoid accumulation
      this.audioBuffer = {
        chunks: [],
        segments: [],
        startTime: Date.now(),
        totalDuration: 0
      };
    }
  }

  /**
   * Match diarized utterances to buffered segments by timestamp
   */
  private matchSpeakers(utterances: any[], segments: BufferedSegment[]): Map<number, string> {
    const corrections = new Map<number, string>();

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];

      // Find best matching utterance by timestamp overlap
      let bestMatch: any = null;
      let bestOverlap = 0;

      for (const utterance of utterances) {
        const uttStart = utterance.start;  // milliseconds
        const uttEnd = utterance.end;

        // Calculate overlap between segment and utterance
        const overlapStart = Math.max(segment.startTime, uttStart);
        const overlapEnd = Math.min(segment.endTime, uttEnd);
        const overlap = Math.max(0, overlapEnd - overlapStart);

        if (overlap > bestOverlap) {
          bestOverlap = overlap;
          bestMatch = utterance;
        }
      }

      // If we found a good match, record the speaker correction
      if (bestMatch && bestOverlap > 500) {  // Require at least 500ms overlap
        const speakerLabel = `Speaker ${bestMatch.speaker}`;
        corrections.set(segment.timestamp, speakerLabel);
        console.log(`  [${i}] ${segment.text.substring(0, 50)}... → ${speakerLabel}`);
      }
    }

    return corrections;
  }

  /**
   * Convert PCM audio buffer to WAV file
   */
  private async saveAsWav(pcmBuffer: Buffer, sampleRate: number): Promise<string> {
    const wavPath = path.join(this.tempDir, `audio_${Date.now()}.wav`);

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
    wavHeader.writeUInt32LE(sampleRate * 2, 28);  // Byte rate (sample rate * block align)
    wavHeader.writeUInt16LE(2, 32);   // Block align (channels * bytes per sample)
    wavHeader.writeUInt16LE(16, 34);  // Bits per sample

    // data sub-chunk
    wavHeader.write('data', 36);
    wavHeader.writeUInt32LE(pcmBuffer.length, 40);

    // Combine header and audio data
    const wavBuffer = Buffer.concat([wavHeader, pcmBuffer]);

    // Write to file
    fs.writeFileSync(wavPath, wavBuffer);

    return wavPath;
  }

  /**
   * Stop hybrid diarization
   */
  async stopHybrid(): Promise<void> {
    // Stop buffer processing timer
    if (this.bufferTimer) {
      clearInterval(this.bufferTimer);
      this.bufferTimer = undefined;
    }

    // Process any remaining buffered audio
    if (this.audioBuffer.chunks.length > 0) {
      console.log('Processing remaining audio buffer...');
      await this.processBuffer();
    }

    // Clean up temp files
    if (fs.existsSync(this.tempDir)) {
      const files = fs.readdirSync(this.tempDir);
      for (const file of files) {
        try {
          fs.unlinkSync(path.join(this.tempDir, file));
        } catch (err) {
          console.warn(`Could not delete temp file ${file}:`, err);
        }
      }
    }

    console.log('✓ Hybrid diarization stopped');
  }

  /**
   * Transcribe pre-recorded audio with speaker diarization
   * This is useful for batch processing or testing
   */
  async transcribeWithDiarization(audioUrl: string): Promise<TranscriptionSegment[]> {
    try {
      const transcript = await this.client.transcripts.transcribe({
        audio: audioUrl,
        speaker_labels: true
      });

      if (!transcript.utterances) {
        return [];
      }

      return transcript.utterances.map((utterance) => ({
        speaker: utterance.speaker,
        text: utterance.text,
        timestamp: utterance.start,
        isFinal: true
      }));
    } catch (error) {
      console.error('Error transcribing audio:', error);
      throw error;
    }
  }
}
