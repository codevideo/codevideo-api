import { GoogleGenAI } from '@google/genai';
import { LLMAdapter, LLMStreamChunk, LLMResponse, LLMConfig } from '../types';

export class GeminiAdapter implements LLMAdapter {
    private client: GoogleGenAI;
    private config: LLMConfig;

    constructor(apiKey?: string, config: LLMConfig = {}) {
        const key = apiKey || process.env.GEMINI_API_KEY;
        if (!key) {
            throw new Error('Gemini API key is required. Set GEMINI_API_KEY environment variable or pass apiKey parameter.');
        }
        
        this.client = new GoogleGenAI({
            apiKey: key
        });
        this.config = {
            model: 'gemini-2.5-pro',
            maxTokens: 8000,
            temperature: 0.7,
            ...config
        };
    }

    async generateContent(prompt: string): Promise<LLMResponse> {
        const response = await this.client.models.generateContent({
            model: this.config.model!,
            contents: prompt,
            config: {
                maxOutputTokens: this.config.maxTokens,
                temperature: this.config.temperature
            }
        });

        return { text: response.text || '' };
    }

    async* generateContentStream(prompt: string): AsyncIterable<LLMStreamChunk> {
        const response = await this.client.models.generateContentStream({
            model: this.config.model!,
            contents: prompt,
            config: {
                maxOutputTokens: this.config.maxTokens,
                temperature: this.config.temperature
            }
        });

        for await (const chunk of response) {
            if (chunk.text) {
                yield {
                    text: chunk.text,
                    isComplete: false
                };
            }
        }
        
        yield {
            text: '',
            isComplete: true
        };
    }
}
