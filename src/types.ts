// Common types for LLM adapters

export interface LLMStreamChunk {
    text: string;
    isComplete?: boolean;
}

export interface LLMResponse {
    text: string;
}

export interface LLMAdapter {
    generateContent(prompt: string): Promise<LLMResponse>;
    generateContentStream(prompt: string): AsyncIterable<LLMStreamChunk>;
}

export interface LLMConfig {
    model?: string;
    maxTokens?: number;
    temperature?: number;
    [key: string]: any;
}
