/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_GEMINI_API_KEY: string
    readonly VITE_DEEPSEEK_API_KEY: string
    readonly VITE_GROQ_API_KEY: string
    readonly VITE_ZHIPU_AI_API_KEY: string
    readonly VITE_OLLAMA_CLOUD_API_KEY: string
    readonly VITE_OLLAMA_CLOUD_MODEL: string
    readonly VITE_LOCAL_OLLAMA_MODEL: string
    readonly VITE_FIREBASE_API_KEY: string
    readonly VITE_FIREBASE_AUTH_DOMAIN: string
    readonly VITE_FIREBASE_PROJECT_ID: string
    readonly VITE_FIREBASE_STORAGE_BUCKET: string
    readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string
    readonly VITE_FIREBASE_APP_ID: string
    readonly VITE_FIREBASE_MEASUREMENT_ID: string
    // more env variables...
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}

interface Window {
    electronAPI: {
        askAI: (prompt: string, model?: string) => Promise<string>;
        [key: string]: any;
    }
}

declare module 'qrcode' {
    export function toDataURL(text: string, options?: any): Promise<string>;
}
