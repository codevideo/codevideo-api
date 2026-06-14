export interface LanguageToolResponse {
    software: Software;
    warnings: Warnings;
    language: Language;
    matches: Match[];
    sentenceRanges: [number, number][];
    extendedSentenceRanges: ExtendedSentenceRange[];
  }
  
  export interface Software {
    name: string;
    version: string;
    buildDate: string;
    apiVersion: number;
    premium: boolean;
    premiumHint: string;
    status: string;
  }
  
  export interface Warnings {
    incompleteResults: boolean;
  }
  
  export interface Language {
    name: string;
    code: string;
    detectedLanguage: DetectedLanguage;
  }
  
  export interface DetectedLanguage {
    name: string;
    code: string;
    confidence: number;
    source: string;
  }
  
  export interface Match {
    message: string;
    shortMessage: string;
    replacements: Replacement[];
    offset: number;
    length: number;
    context: Context;
    sentence: string;
    type: TypeInfo;
    rule: Rule;
    ignoreForIncompleteSentence: boolean;
    contextForSureMatch: number;
  }
  
  export interface Replacement {
    value: string;
    shortDescription?: string;
  }
  
  export interface Context {
    text: string;
    offset: number;
    length: number;
  }
  
  export interface TypeInfo {
    typeName: string;
  }
  
  export interface Rule {
    id: string;
    description: string;
    issueType: string;
    urls?: Url[];
    category: Category;
  }
  
  export interface Url {
    value: string;
  }
  
  export interface Category {
    id: string;
    name: string;
  }
  
  export interface ExtendedSentenceRange {
    from: number;
    to: number;
    detectedLanguages: DetectedLanguageShort[];
  }
  
  export interface DetectedLanguageShort {
    language: string;
    rate: number;
  }