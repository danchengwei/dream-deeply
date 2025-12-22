
import { GoogleGenAI, Type } from "@google/genai";
import { DebatePersona, AnalysisReport, StoryInteractable } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Models
const TEXT_MODEL = 'gemini-3-flash-preview';
const IMAGE_MODEL = 'gemini-2.5-flash-image'; 

/**
 * Generates the next turn in a text-based adventure/simulation.
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
    1. 根据"用户行动"（User Action）推进场景。用户的输入可能是选择预设选项，也可能是完全自定义的文本输入。
    2. 如果是自定义输入，请结合当前物理/历史/化学背景判断其合理性和后果。如果行为不合逻辑或不可能，请描述尝试失败的后果。
    3. 渲染环境气氛、感官细节和教育背景。
    4. 判断模拟是否应该结束（isEnded）。结束条件包括：用户达成目标、用户死亡/遭受重大失败、或历史事件完结。
    5. 如果模拟结束（isEnded = true），必须生成一份分析报告（analysisReport），且"options"字段留空。
    6. 如果模拟未结束，提供 3 个建议的行动选项（options）。
    
    请使用简体中文回复。

    输出 JSON 格式:
    {
      "description": "对结果的生动叙述。",
      "options": ["选项1", "选项2", "选项3"], // 仅在 isEnded 为 false 时提供
      "isEnded": boolean, // 是否结束
      "report": { // 仅在 isEnded 为 true 时提供
         "score": number, // 0-100分，基于用户的决策质量
         "evaluation": "对用户整体表现的评价",
         "keyLearnings": ["学到的知识点1", "学到的知识点2"],
         "suggestions": "改进建议"
      }
    }
  `;

  // Convert simple history to prompt format
  let promptHistory = history.map(h => `${h.role === 'user' ? '用户' : '系统'}: ${h.text}`).join('\n');
  const fullPrompt = `${promptHistory}\n用户行动: ${userAction}`;

  try {
    const response = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: fullPrompt,
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
    
    // Clean up markdown code blocks if present (e.g. ```json ... ```)
    const cleanedText = text.replace(/```json\n?|```/g, '').trim();

    return JSON.parse(cleanedText);
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
  try {
    // Simplified prompt for speed and reliability
    const prompt = `Digital art, highly detailed, cinematic lighting. Scene: ${description}`;

    const response = await ai.models.generateContent({
      model: IMAGE_MODEL,
      contents: prompt,
      config: {}
    });

    // Iterate parts to find the image
    const parts = response.candidates?.[0]?.content?.parts;
    if (parts) {
      for (const part of parts) {
        if (part.inlineData && part.inlineData.data) {
           return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
      }
    }
    return null;
  } catch (error) {
    console.error("Image Gen Error:", error);
    return null;
  }
};

/**
 * Chat with a debate partner or project collaborator.
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

  // Replay history (excluding the very last user message which we send now)
  // Construct conversation string for context
  const conversationString = history.map(h => `${h.role === 'user' ? '用户' : '伙伴'}: ${h.text}`).join('\n');

  try {
    const response = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: `${conversationString}\n伙伴:`, // Completion style
      config: { systemInstruction }
    });
    return response.text || "...";
  } catch (error) {
    console.error("Debate Error:", error);
    return "我需要一点时间思考这个问题。";
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

  const prompt = `历史:\n${history.slice(-2).join('\n')}\n动作: ${action}`;

  try {
    const response = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: prompt,
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
