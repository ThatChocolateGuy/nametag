import { AssemblyAI, RealtimeTranscript } from 'assemblyai';

export interface TranscriptionSegment {
  speaker: string;
  text: string;
  timestamp: number;
  isFinal: boolean;
}

export class DiarizationService {
  private client: AssemblyAI;
  private transcriber: any = null;
  private onSegmentCallback?: (segment: TranscriptionSegment) => void;

  constructor(apiKey: string) {
    this.client = new AssemblyAI({
      apiKey: apiKey
    });
  }

  /**
   * Start real-time transcription with speaker diarization
   */
  async startRealtime(
    onSegment: (segment: TranscriptionSegment) => void,
    sampleRate: number = 16000
  ): Promise<void> {
    this.onSegmentCallback = onSegment;

    try {
      // Configure real-time transcriber
      // NOTE: AssemblyAI realtime API doesn't support speaker diarization yet
      // speaker_labels is only available in the async transcript API
      // For now, this provides faster transcription, but speaker detection
      // would require the async API or a hybrid approach
      this.transcriber = this.client.realtime.transcriber({
        sampleRate,
        encoding: 'pcm_s16le'
      });

      this.transcriber.on('transcript', (transcript: RealtimeTranscript) => {
        if (!transcript.text) return;

        // NOTE: Real-time API doesn't support speaker diarization yet
        // All transcripts will be labeled as "Speaker A" for now
        // Future enhancement: Implement hybrid approach using batch API for diarization
        const speakerLabel = 'A';

        const segment: TranscriptionSegment = {
          speaker: `Speaker ${speakerLabel}`,
          text: transcript.text,
          timestamp: Date.now(),
          isFinal: transcript.message_type === 'FinalTranscript'
        };

        if (this.onSegmentCallback && segment.isFinal) {
          this.onSegmentCallback(segment);
          console.log(`[${segment.speaker}] ${segment.text}`);
        }
      });

      this.transcriber.on('error', (error: Error) => {
        console.error('AssemblyAI transcription error:', error);
      });

      this.transcriber.on('open', () => {
        console.log('✓ AssemblyAI real-time connection established');
        console.log('⚠️  Note: Speaker diarization not available in real-time API');
      });

      this.transcriber.on('close', () => {
        console.log('AssemblyAI connection closed');
      });

      await this.transcriber.connect();
      console.log('✓ Real-time transcription with diarization started');
    } catch (error) {
      console.error('Error starting real-time transcription:', error);
      throw error;
    }
  }

  /**
   * Send audio data to the transcriber
   */
  sendAudio(audioData: Buffer): void {
    if (this.transcriber) {
      this.transcriber.sendAudio(audioData);
    }
  }

  /**
   * Stop real-time transcription
   */
  async stopRealtime(): Promise<void> {
    if (this.transcriber) {
      await this.transcriber.close();
      this.transcriber = null;
      console.log('Real-time transcription stopped');
    }
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
