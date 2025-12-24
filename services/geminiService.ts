
import { GoogleGenAI, Type, Content, GenerateContentResponse } from "@google/genai";
import { DebatePersona, AnalysisReport, StoryInteractable, SceneConfig } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Models
const TEXT_MODEL = 'gemini-3-flash-preview';
const IMAGE_MODEL = 'gemini-2.5-flash-image'; 

// Timeouts (in ms)
const TIMEOUT_TEXT = 15000; // 15s for text
const TIMEOUT_IMAGE = 20000; // 20s for image

/**
 * Utility to wrap promises with a timeout
 */
const withTimeout = <T>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => 
      setTimeout(() => reject(new Error(`${label} 请求超时，请重试`)), ms)
    )
  ]);
};

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
 * Generates a structured 3D scene configuration based on the topic.
 * NOW SUPPORTS STATE PERSISTENCE via previousState
 */
export const generateSceneConfiguration = async (
  topic: string, 
  context: string,
  previousState: SceneConfig | null = null // New Parameter
): Promise<SceneConfig> => {
  
  const previousObjectsJSON = previousState ? JSON.stringify(previousState.objects) : "[] (初始化场景)";

  const systemPrompt = `
    你是一个**高中科学/历史教育可视化引擎**。
    你的任务：将抽象的知识点转化为 3D 场景配置，用于教学演示。
    
    *** 教育可视化规则 ***
    1. **还原教科书场景**：如果是化学，还原实验装置；如果是物理，还原理想模型（斜面、滑块）；如果是历史，还原沙盘或关键文物。
    2. **准确性优先**：
       - 化学试剂颜色必须准确（如：铜离子溶液=蓝色，高锰酸钾=紫红）。
       - 历史人物阵营颜色要区分明显。
    3. **标签 (Label) 必须包含知识点**：不仅标记物体名称，最好包含关键属性。例如："锌片 (负极)", "小球 (m=1kg)", "秦军 (黑色旗帜)"。
    
    [映射指南]:
    1. **人物/角色** -> 使用 'CYLINDER'。
    2. **固体块/书籍/装置底座** -> 使用 'CUBE'。
    3. **原子/电子/天体** -> 使用 'SPHERE'。
    4. **容器/反应釜** -> 使用 'BEAKER' 或 'FLASK' (必须设置 liquidColor)。
    
    可用物体类型: BEAKER, FLASK, SPHERE, CUBE, PLANE, CYLINDER.
    必须包含 type: 'PLANE' 作为实验台或地面。
    
    输出完整的 JSON 配置。
  `;

  const userContent = `
    教学主题: ${topic}
    上一帧状态:
    ${previousObjectsJSON}

    当前教学环节描述: 
    ${context}

    请输出更新后的教学场景 JSON。
  `;

  try {
    const call = ai.models.generateContent({
      model: TEXT_MODEL,
      contents: userContent,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            objects: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  type: { type: Type.STRING, enum: ['BEAKER', 'FLASK', 'SPHERE', 'CUBE', 'PLANE', 'CYLINDER'] },
                  position: { type: Type.ARRAY, items: { type: Type.NUMBER } },
                  scale: { type: Type.ARRAY, items: { type: Type.NUMBER } },
                  color: { type: Type.STRING },
                  label: { type: Type.STRING },
                  liquidColor: { type: Type.STRING },
                  liquidLevel: { type: Type.NUMBER },
                },
                required: ['id', 'type', 'position', 'label'] // Made label required
              }
            },
            lightingColor: { type: Type.STRING },
            environment: { type: Type.STRING, enum: ['LAB', 'SPACE', 'DEFAULT'] }
          },
          required: ['objects']
        }
      }
    });

    const response = await withTimeout<GenerateContentResponse>(call, 8000, "Scene Config");

    const text = response.text;
    if (!text) throw new Error("No config generated");
    return JSON.parse(text.replace(/```json\n?|```/g, '').trim());

  } catch (e) {
    console.error("Scene Config Gen Error:", e);
    // Return previous state if generation fails to avoid flickering
    if (previousState) return previousState;

    return {
      objects: [
        { id: 'floor', type: 'PLANE', position: [0, -0.5, 0], scale: [10, 0.5, 10], color: '#1e293b', label: '实验台' },
        { id: 'error_cube', type: 'CUBE', position: [0, 0.5, 0], color: '#ef4444', label: '配置生成失败' }
      ]
    };
  }
};


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
  shouldUpdateVisuals: boolean; 
  report?: AnalysisReport;
}> => {
  
  const systemPrompt = `
    你是一位**苏格拉底式的学科导师**，正在引导学生进行一场**沉浸式情境学习**。
    
    背景设定: ${context}。
    
    你的任务：
    1. **响应行动**：根据用户的操作，推演符合学科逻辑的结果（符合物理定律、化学反应方程式或历史史实）。
    2. **植入知识点**：在描述中自然地解释现象背后的原理。例如，如果用户混合了酸碱，解释中和反应放热；如果用户在辛亥革命前夕，解释当时的社会矛盾。
    3. **引导思考**：不要直接给答案，通过现象引导用户思考下一步。
    4. **视觉更新判断**：只有当实验现象明显、场景切换或物体状态改变时，shouldUpdateVisuals 为 true。
    
    **文本风格**: 专业、严谨但生动。使用简体中文。对于关键术语（如“氧化还原”、“动量守恒”），请加粗或强调。
    
    如果用户操作导致严重的错误（如实验室爆炸、历史严重偏差），请给出“模拟失败”的结局，并解释原因。
  `;

  // Convert history to proper Content format for better context handling
  const contents = history.map(h => ({
    role: h.role === 'user' ? 'user' : 'model',
    parts: [{ text: h.text }]
  }));
  
  // Add the current user action
  contents.push({
    role: 'user',
    parts: [{ text: `学生行动: ${userAction}` }]
  });

  try {
    const call = ai.models.generateContent({
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
            shouldUpdateVisuals: { type: Type.BOOLEAN }, 
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
          required: ["description", "isEnded", "shouldUpdateVisuals"]
        }
      }
    });

    const response = await withTimeout<GenerateContentResponse>(call, TIMEOUT_TEXT, "Simulation Turn");

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    
    // Robust JSON Parsing
    let parsedData;
    try {
        const cleanedText = text.replace(/```json\n?|```/g, '').trim();
        parsedData = JSON.parse(cleanedText);
    } catch (jsonError) {
        console.warn("JSON Parse Failed, attempting fallback", jsonError);
        return {
            description: "导师正在整理教案... (解析错误)",
            options: ["继续观察"],
            shouldUpdateVisuals: false,
            isEnded: false
        };
    }

    return parsedData;

  } catch (error) {
    console.error("Simulation Error:", error);
    return {
      description: "与导师的连接不稳定，请重试。",
      options: ["重试"],
      shouldUpdateVisuals: false,
      isEnded: false
    };
  }
};

/**
 * Generates a visual representation of the current simulation state.
 */
export const generateSimulationImage = async (
  description: string, 
  style: 'ARTISTIC' | 'SCHEMATIC' = 'ARTISTIC'
): Promise<string | null> => {
  const cachedImage = await searchImageDatabase(description);
  if (cachedImage) return cachedImage;

  try {
    let stylePrompt = "";
    if (style === 'SCHEMATIC') {
      stylePrompt = "Educational textbook illustration, clean vector lines, schematic diagram, scientific visualization, white background, labeled parts style.";
    } else {
      stylePrompt = "Historical painting or Scientific Visualization, highly detailed, realistic textures, educational atmosphere, accurate period/lab details.";
    }

    const prompt = `${stylePrompt} Subject matter: ${description.substring(0, 300)}`;

    const call = ai.models.generateContent({
      model: IMAGE_MODEL,
      contents: prompt,
      config: {}
    });

    const response = await withTimeout<GenerateContentResponse>(call, TIMEOUT_IMAGE, "Image Generation");

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
    return null;
  }
};

export const generateDebateResponse = async (
  history: { role: 'user' | 'model'; text: string }[],
  topic: string,
  persona: DebatePersona
): Promise<string> => {

  let personaInstruction = "";
  switch (persona) {
    case DebatePersona.SKEPTIC:
      personaInstruction = "你是一个**严谨的考官**。挑战用户的论点，指出逻辑漏洞，要求引用具体的定律或史实作为依据。";
      break;
    case DebatePersona.OPTIMIST:
      personaInstruction = "你是一个**富有想象力的启发者**。鼓励用户进行发散思维，将知识点应用到未来的极端场景中。";
      break;
    case DebatePersona.COLLABORATOR:
      personaInstruction = "你是一个**勤奋的学习小组组长**。帮助用户梳理知识点，补充遗漏的信息，共同构建完整的知识框架。";
      break;
    case DebatePersona.SOCRATIC:
      personaInstruction = "你是一位**苏格拉底式教授**。绝不直接给出答案，而是通过一系列层层递进的问题，引导用户自己推导出公式或结论。";
      break;
  }

  const systemInstruction = `
    背景: 我们正在讨论学术/学习话题 "${topic}"。
    你的角色: ${personaInstruction}
    目标: 帮助用户深化对知识点的理解。
    请全程使用简体中文回复。保持回复简洁（100字以内），聚焦于知识本身。
  `;

  const contents: Content[] = history.map(h => ({
      role: h.role === 'user' ? 'user' : 'model',
      parts: [{ text: h.text }]
  }));

  try {
    const call = ai.models.generateContent({
      model: TEXT_MODEL,
      contents: contents, 
      config: { systemInstruction }
    });

    const response = await withTimeout<GenerateContentResponse>(call, TIMEOUT_TEXT, "Debate Response");
    return response.text || "（思考中...）";
  } catch (error) {
    console.error("Debate Error:", error);
    return "连接超时，请重试。";
  }
};

export const initializeStoryRole = async (theme: string): Promise<{role: string, visualPrompt: string}> => {
  const systemPrompt = `
    你是一个**教育RPG**的角色生成器。
    根据学习主题"${theme}"，生成一个相关的历史人物、科学家、作家或典型角色。
    
    要求：
    1. Role 必须是与该知识领域强相关的具体人物或身份（例如：如果是化学，可以是"居里夫人"；如果是文学，可以是"孔乙己"）。
    2. Visual Prompt 必须简短、英文、描述面部特征和标志性物品（如实验服、羽毛笔、汉服）。
    
    输出 JSON: { "role": "string", "visualPrompt": "string" }
  `;
  
  try {
    const call = ai.models.generateContent({
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

    const response = await withTimeout<GenerateContentResponse>(call, 10000, "Role Init"); // 10s for init

    const text = response.text;
    if (!text) throw new Error("No response");
    return JSON.parse(text.replace(/```json\n?|```/g, '').trim());
  } catch (error) {
    console.error("Role Init Error:", error);
    throw error; // Rethrow to handle in UI
  }
};

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
    你是一个**交互式学习课件**的生成引擎。主题：${theme}，角色：${role}。
    
    任务：
    1. **剧情生成 (narrative)**：根据历史和动作生成下一段剧情。**必须嵌入具体的知识点**（如：历史事件的起因、物理现象的微观解释、文学意象的分析）。请使用简体中文，文笔要符合教材或文学作品的风格。
    2. **视觉提示 (visualPrompt)**：英文，描述当前场景的关键教育元素（如：实验仪器细节、特定的历史建筑风格）。
    3. **互动点 (interactables)**：生成1-3个互动点。
       - **label**：互动对象的名称（如："伏打电堆", "《新青年》杂志", "滑块"）。
       - **description**：该对象包含的知识点或它的状态（使用简体中文）。
    
    输出 JSON。
  `;

  const contents: Content[] = [];
  
  if (history.length > 0) {
      const contextStr = `前情提要:\n${history.slice(-3).join('\n')}`;
      contents.push({ role: 'user', parts: [{ text: contextStr }] });
      contents.push({ role: 'model', parts: [{ text: '明白，请继续。' }] });
  }

  contents.push({ role: 'user', parts: [{ text: `学生尝试动作: ${action}` }] });

  try {
    const call = ai.models.generateContent({
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

    const response = await withTimeout<GenerateContentResponse>(call, 12000, "Story Gen");

    const text = response.text;
    if (!text) throw new Error("No response");
    const cleanedText = text.replace(/```json\n?|```/g, '').trim();
    return JSON.parse(cleanedText);

  } catch (error) {
    console.error("Story Gen Error:", error);
    throw error; // Rethrow for UI to handle
  }
};
