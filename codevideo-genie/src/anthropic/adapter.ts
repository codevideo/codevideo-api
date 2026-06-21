import { Anthropic } from '@anthropic-ai/sdk';
import { LLMAdapter, LLMStreamChunk, LLMResponse, LLMConfig } from '../types';

export class AnthropicAdapter implements LLMAdapter {
    private client: Anthropic;
    private config: LLMConfig;

    constructor(apiKey?: string, config: LLMConfig = {}) {
        const key = apiKey || process.env.ANTHROPIC_API_KEY;
        if (!key) {
            throw new Error('Anthropic API key is required. Set ANTHROPIC_API_KEY environment variable or pass apiKey parameter.');
        }
        
        this.client = new Anthropic({
            apiKey: key
        });
        this.config = {
            model: 'claude-sonnet-4-20250514',
            maxTokens: 8000,
            temperature: 0.7,
            ...config
        };
    }

    async generateContent(prompt: string): Promise<LLMResponse> {
        const response = await this.client.messages.create({
            model: this.config.model!,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: this.config.maxTokens!,
            temperature: this.config.temperature
        });

        const content = response.content[0];
        if (content.type === 'text') {
            return { text: content.text };
        }
        
        throw new Error('Unexpected response format from Anthropic API');
    }

    async* generateContentStream(prompt: string): AsyncIterable<LLMStreamChunk> {
        const stream = await this.client.messages.create({
            model: this.config.model!,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: this.config.maxTokens!,
            temperature: this.config.temperature,
            stream: true
        });

        for await (const chunk of stream) {
            if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
                yield {
                    text: chunk.delta.text,
                    isComplete: false
                };
            } else if (chunk.type === 'message_stop') {
                yield {
                    text: '',
                    isComplete: true
                };
            }
        }
    }
}
