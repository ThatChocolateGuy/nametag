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
      this.transcriber = this.client.realtime.transcriber({
        sampleRate,
        encoding: 'pcm_s16le'
      });

      this.transcriber.on('transcript', (transcript: RealtimeTranscript) => {
        if (!transcript.text) return;

        const segment: TranscriptionSegment = {
          speaker: 'unknown', // Real-time doesn't support diarization yet
          text: transcript.text,
          timestamp: Date.now(),
          isFinal: transcript.message_type === 'FinalTranscript'
        };

        if (this.onSegmentCallback) {
          this.onSegmentCallback(segment);
        }
      });

      this.transcriber.on('error', (error: Error) => {
        console.error('Transcription error:', error);
      });

      await this.transcriber.connect();
      console.log('Real-time transcription started');
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
