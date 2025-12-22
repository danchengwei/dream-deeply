
import { GoogleGenAI, Type, Content } from "@google/genai";
import { DebatePersona, AnalysisReport, StoryInteractable } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Models
const TEXT_MODEL = 'gemini-3-flash-preview';
const IMAGE_MODEL = 'gemini-2.5-flash-image'; 

/**
 * DATABASE / SEARCH INFRASTRUCTURE (Backup Plan / Optimization)
 */
const DB_SEARCH_ENABLED = false; 

const searchImageDatabase = async (prompt: string): Promise<string | null> => {
  if (!DB_SEARCH_ENABLED) return null;
  return null;
};

const uploadImageToDatabase = async (prompt: string, imageBase64: string): Promise<void> => {
  // Placeholder implementation
};


/**
 * Generates the next turn in a text-based adventure/simulation.
 * Enhanced with robust JSON parsing and fallback mechanisms.
 */
export const generateSimulationTurn = async (
  history: { role: 'user' | 'model'; text: string }[],
  context: string,
  userAction: string
): Promise<{ 
  description: string; 
  options: string[];
  isEnded: boolean;
  report?: AnalysisReport;
}> => {
  
  const systemPrompt = `
    你是一个高级沉浸式教育模拟引擎。
    背景设定: ${context}。
    
    你的任务：
    1. 根据"用户行动"（User Action）推进场景。
    2. 严格遵守JSON输出格式，不要输出任何Markdown标记或额外文本。
    3. 判断模拟是否应该结束（isEnded）。
    4. 如果模拟未结束，必须提供 3 个建议的行动选项（options）。
    
    请使用简体中文回复。
  `;

  // Convert history to proper Content format for better context handling
  const contents = history.map(h => ({
    role: h.role === 'user' ? 'user' : 'model',
    parts: [{ text: h.text }]
  }));
  
  // Add the current user action
  contents.push({
    role: 'user',
    parts: [{ text: `用户行动: ${userAction}` }]
  });

  try {
    const response = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: contents,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            description: { type: Type.STRING },
            options: { 
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            isEnded: { type: Type.BOOLEAN },
            report: {
              type: Type.OBJECT,
              properties: {
                score: { type: Type.INTEGER },
                evaluation: { type: Type.STRING },
                keyLearnings: { 
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                },
                suggestions: { type: Type.STRING }
              }
            }
          },
          required: ["description", "isEnded"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    
    // Robust JSON Parsing
    let parsedData;
    try {
        // Attempt to clean markdown code blocks if they slip through
        const cleanedText = text.replace(/```json\n?|```/g, '').trim();
        parsedData = JSON.parse(cleanedText);
    } catch (jsonError) {
        console.warn("JSON Parse Failed, attempting fallback", jsonError);
        // Fallback for malformed JSON
        return {
            description: "系统正在重新校准数据流... (解析错误)",
            options: ["继续"],
            isEnded: false
        };
    }

    return parsedData;

  } catch (error) {
    console.error("Simulation Error:", error);
    return {
      description: "模拟引擎连接不稳定，无法判断结果。请尝试其他操作。",
      options: ["重试"],
      isEnded: false
    };
  }
};

/**
 * Generates a visual representation of the current simulation state.
 */
export const generateSimulationImage = async (description: string): Promise<string | null> => {
  const cachedImage = await searchImageDatabase(description);
  if (cachedImage) return cachedImage;

  try {
    const prompt = `Digital art, highly detailed, cinematic lighting. Scene: ${description.substring(0, 300)}`;

    const response = await ai.models.generateContent({
      model: IMAGE_MODEL,
      contents: prompt,
      config: {}
    });

    const parts = response.candidates?.[0]?.content?.parts;
    if (parts) {
      for (const part of parts) {
        if (part.inlineData && part.inlineData.data) {
           const imageBase64 = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
           uploadImageToDatabase(description, imageBase64);
           return imageBase64;
        }
      }
    }
    return null;
  } catch (error) {
    console.error("Image Gen Error:", error);
    // Return null explicitly to stop loading spinners
    return null;
  }
};

/**
 * Chat with a debate partner or project collaborator.
 * Enhanced to use structured Content arrays for proper role history.
 */
export const generateDebateResponse = async (
  history: { role: 'user' | 'model'; text: string }[],
  topic: string,
  persona: DebatePersona
): Promise<string> => {

  let personaInstruction = "";
  switch (persona) {
    case DebatePersona.SKEPTIC:
      personaInstruction = "你是一个怀疑论者对手。挑战用户的逻辑，指出谬误，并要求证据。礼貌但坚定。";
      break;
    case DebatePersona.OPTIMIST:
      personaInstruction = "你是一个过度乐观的支持者。同意用户的观点，但将其推导到极端的结论以测试边界。";
      break;
    case DebatePersona.COLLABORATOR:
      personaInstruction = "你是一个乐于助人的项目队友。进行头脑风暴，提出改进建议，并在用户想法的基础上进行建设性构建。";
      break;
    case DebatePersona.SOCRATIC:
      personaInstruction = "你是一位苏格拉底式导师。用问题回答问题，引导用户自己发现真理。不要直接给出答案。";
      break;
  }

  const systemInstruction = `
    背景: 我们正在讨论 "${topic}"。
    你的角色: ${personaInstruction}
    请使用简体中文回复。保持回复简洁（100字以内），以保持对话流畅。
  `;

  // Map internal history format to Gemini API 'Content' objects
  const contents: Content[] = history.map(h => ({
      role: h.role === 'user' ? 'user' : 'model',
      parts: [{ text: h.text }]
  }));

  try {
    const response = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: contents, 
      config: { systemInstruction }
    });
    return response.text || "（思考中...）";
  } catch (error) {
    console.error("Debate Error:", error);
    return "连接断开，请重试。";
  }
};

/**
 * Initialize a character role and visual for the story.
 */
export const initializeStoryRole = async (theme: string): Promise<{role: string, visualPrompt: string}> => {
  const systemPrompt = `
    你是一个RPG设定生成器。
    根据主题"${theme}"，生成角色(Role)和头像提示词(Visual Prompt)。
    Visual Prompt 必须简短、英文、描述面部特征、风格为Digital Art。
    输出 JSON: { "role": "string", "visualPrompt": "string" }
  `;
  
  try {
    const response = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: "Start",
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
             role: { type: Type.STRING },
             visualPrompt: { type: Type.STRING }
          },
          required: ["role", "visualPrompt"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response");
    return JSON.parse(text.replace(/```json\n?|```/g, '').trim());
  } catch (error) {
    console.error("Role Init Error:", error);
    return { role: "探险家", visualPrompt: "Explorer face, mysterious, digital art" };
  }
};

/**
 * Generates a structured scene for the Interactive Story mode.
 */
export const generateStoryScene = async (
  history: string[], 
  action: string,
  theme: string,
  role: string
): Promise<{
  narrative: string;
  visualPrompt: string;
  interactables: StoryInteractable[];
}> => {
  const systemPrompt = `
    你是一个解密游戏引擎。主题：${theme}，角色：${role}。
    
    任务：
    1. 根据历史和动作生成下一段简短剧情(narrative)。
    2. 生成场景图片提示词(visualPrompt)：英文，简短直接，描述环境。
    3. 生成1-3个互动点(interactables)。
    
    输出 JSON。
  `;

  // Explicitly separate history from current action
  const contents: Content[] = [];
  
  if (history.length > 0) {
      // Summarize history context if too long
      const contextStr = `前情提要:\n${history.slice(-3).join('\n')}`;
      contents.push({ role: 'user', parts: [{ text: contextStr }] });
      contents.push({ role: 'model', parts: [{ text: '明白，请继续。' }] });
  }

  contents.push({ role: 'user', parts: [{ text: `当前动作: ${action}` }] });

  try {
    const response = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: contents,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
         responseSchema: {
          type: Type.OBJECT,
          properties: {
            narrative: { type: Type.STRING },
            visualPrompt: { type: Type.STRING },
            interactables: { 
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  label: { type: Type.STRING },
                  type: { type: Type.STRING, enum: ['EXAMINE', 'PICKUP', 'TRANSITION'] },
                  description: { type: Type.STRING }
                },
                required: ['id', 'label', 'type', 'description']
              }
            }
          },
          required: ["narrative", "visualPrompt", "interactables"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response");
    const cleanedText = text.replace(/```json\n?|```/g, '').trim();
    return JSON.parse(cleanedText);

  } catch (error) {
    console.error("Story Gen Error:", error);
    return {
      narrative: "信号受到干扰...",
      visualPrompt: "Glitch art, static noise, abstract",
      interactables: [
        { id: 'retry', label: '重试', type: 'EXAMINE', description: '尝试重新连接' }
      ]
    };
  }
};
