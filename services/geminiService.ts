
import { GoogleGenAI, Chat, Modality } from "@google/genai";

// Ensure the API key is handled by the environment.
const API_KEY = process.env.API_KEY;
if (!API_KEY) {
    // In a real app, you might want to handle this more gracefully.
    // For this environment, we assume it's always present.
    console.warn("API_KEY environment variable not set.");
}
const ai = new GoogleGenAI({ apiKey: API_KEY! });


// ============================================================================
// CHATBOT SERVICE (gemini-2.5-flash)
// ============================================================================
class ChatSession {
    private chat: Chat;

    constructor() {
        this.chat = ai.chats.create({
            model: 'gemini-2.5-flash',
            config: {
                systemInstruction: 'You are a helpful assistant for the AgriConnect Hub platform. Answer questions about farming, market prices, and how to use the platform. Keep your answers concise and friendly.',
            },
        });
    }

    async sendMessage(message: string): Promise<string> {
        const result = await this.chat.sendMessage({ message });
        return result.text;
    }
}

export const startChat = async (): Promise<ChatSession> => {
    return new ChatSession();
};


// ============================================================================
// IMAGE GENERATION SERVICE (imagen-4.0-generate-001)
// ============================================================================
export const generateImage = async (prompt: string): Promise<string> => {
    try {
        const response = await ai.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt: prompt,
            config: {
                numberOfImages: 1,
                outputMimeType: 'image/jpeg',
                aspectRatio: '1:1',
            },
        });
        
        if (response.generatedImages && response.generatedImages.length > 0) {
            return response.generatedImages[0].image.imageBytes;
        } else {
            throw new Error("No image was generated.");
        }
    } catch (error) {
        console.error("Error generating image with Gemini:", error);
        throw new Error("Failed to generate image. Please check the prompt or try again later.");
    }
};

// ============================================================================
// TEXT-TO-SPEECH SERVICE (gemini-2.5-flash-preview-tts)
// ============================================================================

// --- Audio Decoding Utilities ---

function decodeBase64(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}


export const generateSpeech = async (text: string): Promise<void> => {
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `Say it clearly: ${text}` }] }],
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: 'Kore' },
                },
            },
        },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
        throw new Error("No audio data received from API.");
    }
    
    // @ts-ignore
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const outputAudioContext = new AudioContext({ sampleRate: 24000 });
    
    const decodedBytes = decodeBase64(base64Audio);
    const audioBuffer = await decodeAudioData(decodedBytes, outputAudioContext, 24000, 1);
    
    const source = outputAudioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(outputAudioContext.destination);
    source.start();
};
