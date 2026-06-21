import { AnthropicAdapter } from './anthropic/adapter';
import { GeminiAdapter } from './gemini/adapter';
import { LLMAdapter, LLMConfig } from './types';

export type LLMProvider = 'anthropic' | 'gemini';

export interface LLMFactoryOptions {
    provider: LLMProvider;
    apiKey?: string;
    config?: LLMConfig;
}

export class LLMFactory {
    static createAdapter(options: LLMFactoryOptions): LLMAdapter {
        const { provider, apiKey, config = {} } = options;

        switch (provider) {
            case 'anthropic':
                return new AnthropicAdapter(apiKey, config);
            case 'gemini':
                return new GeminiAdapter(apiKey, config);
            default:
                throw new Error(`Unsupported LLM provider: ${provider}`);
        }
    }

    static createAnthropicAdapter(apiKey?: string, config?: LLMConfig): LLMAdapter {
        return new AnthropicAdapter(apiKey, config);
    }

    static createGeminiAdapter(apiKey?: string, config?: LLMConfig): LLMAdapter {
        return new GeminiAdapter(apiKey, config);
    }
}
