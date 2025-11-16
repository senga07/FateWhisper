import axios from 'axios';
import type { Expert, AnalysisResult } from '../types';

const API_BASE = '/api';

export const expertApi = {
  getList: async (): Promise<Expert[]> => {
    const response = await axios.get(`${API_BASE}/expert/list`);
    return response.data;
  },

  getById: async (id: string): Promise<Expert> => {
    const response = await axios.get(`${API_BASE}/expert/${id}`);
    return response.data;
  },

  create: async (expert: Omit<Expert, 'id'>): Promise<Expert> => {
    const response = await axios.post(`${API_BASE}/expert/create`, expert);
    return response.data;
  },

  update: async (id: string, expert: Partial<Expert>): Promise<Expert> => {
    const response = await axios.put(`${API_BASE}/expert/${id}`, expert);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await axios.delete(`${API_BASE}/expert/${id}`);
  },
};

export const fortuneApi = {
  analyze: async (
    formData: FormData,
    expertIds: string[],
    taskId: string,
    onComplete?: (result: AnalysisResult) => void
  ): Promise<AnalysisResult> => {
    const expertParams = expertIds.length > 0 
      ? expertIds.map(id => `expert=${encodeURIComponent(id)}`).join('&')
      : '';
    const url = expertParams 
      ? `${API_BASE}/fortune/analyze?${expertParams}&task_id=${encodeURIComponent(taskId)}`
      : `${API_BASE}/fortune/analyze?task_id=${encodeURIComponent(taskId)}`;

    const response = await fetch(url, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`分析失败: ${response.status} ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    if (!reader) {
      throw new Error('无法读取响应流');
    }

    // 用于累积专家报告
    const expertResults: Record<string, { expert_name: string; expert_report: string }> = {};
    let finalAnalysis: string | null = null;
    let totalChunksReceived = 0; // 用于追踪接收到的chunk数量

    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (value) {
          const decodedChunk = decoder.decode(value, { stream: true });
          buffer += decodedChunk;

          // 检查buffer是否被转义（整个字符串被引号包裹）
          let processedBuffer = buffer;
          let bufferWasParsed = false;
          if (buffer.trim().startsWith('"') && buffer.trim().endsWith('"')) {
            try {
              const parsed = JSON.parse(buffer.trim());
              if (typeof parsed === 'string') {
                processedBuffer = parsed;
                bufferWasParsed = true;
              }
            } catch (e) {
              // 解析失败，继续使用原buffer
            }
          }
          
          // 按 \n\n 分割消息
          let messages = processedBuffer.split('\n\n');
          
          // 如果分割后只有一个大块，可能包含多个data:消息
          if (messages.length === 1 && messages[0]) {
            const singleMessage = messages[0];
            // 检查是否包含转义的 \n\n（即 \\n\\n）
            if (singleMessage.includes('\\n\\n')) {
              // 按转义的 \n\n 分割
              const escapedSplit = singleMessage.split('\\n\\n');
              messages = escapedSplit.filter(m => m.trim()); // 过滤空消息
              if (bufferWasParsed) {
                buffer = ''; // 如果buffer被解析了，清空buffer
              }
            } else {
              // 尝试匹配所有 "data: {" 开头的块
              const dataMatches = singleMessage.match(/data:\s*\{/g);
              if (dataMatches && dataMatches.length > 1) {
                // 如果包含多个 "data: {"，尝试按此分割
                // 使用更简单的方法：找到所有 data: { 的位置，然后提取完整的JSON对象
                const matches: string[] = [];
                let searchIndex = 0;
                while (true) {
                  const dataIndex = singleMessage.indexOf('data: {', searchIndex);
                  if (dataIndex === -1) break;
                  
                  // 从 data: { 开始，找到匹配的 }
                  let braceCount = 0;
                  let lastBrace = -1;
                  for (let i = dataIndex + 6; i < singleMessage.length; i++) {
                    if (singleMessage[i] === '{') braceCount++;
                    if (singleMessage[i] === '}') {
                      braceCount--;
                      if (braceCount === 0) {
                        lastBrace = i;
                        break;
                      }
                    }
                  }
                  
                  if (lastBrace !== -1) {
                    matches.push(singleMessage.substring(dataIndex, lastBrace + 1));
                    searchIndex = lastBrace + 1;
                  } else {
                    break;
                  }
                }
                
                if (matches.length > 1) {
                  messages = matches;
                  if (bufferWasParsed) {
                    buffer = ''; // 如果buffer被解析了，清空buffer
                  }
                }
              }
            }
          }
          
          // 保留最后一个可能不完整的消息块到 buffer
          if (messages.length > 0 && !bufferWasParsed) {
            buffer = messages.pop() || '';
          } else if (bufferWasParsed) {
            // 如果processedBuffer被处理了，清空buffer
            buffer = '';
          }
          
          // 处理每个完整的消息块
          for (let i = 0; i < messages.length; i++) {
            const messageBlock = messages[i];
            
            // 每个消息块可能包含 "data: {json}" 格式
            // 需要找到所有 "data: " 开头的行
            const lines = messageBlock.split('\n');
            
            for (let j = 0; j < lines.length; j++) {
              const line = lines[j];
              let trimmedLine = line.trim();
              
              // 跳过空行
              if (!trimmedLine) {
                continue;
              }
              
              // 处理转义的字符串：如果整行被引号包裹，先去掉外层引号
              if (trimmedLine.startsWith('"') && trimmedLine.endsWith('"')) {
                try {
                  trimmedLine = JSON.parse(trimmedLine);
                } catch (e) {
                  // 解析失败，保持原样
                }
              }
              
              // 如果去掉引号后是字符串，需要再次检查
              if (typeof trimmedLine === 'string') {
                // 检查是否以 "data: " 开头
                if (trimmedLine.startsWith('data: ')) {
                  try {
                    // 提取 JSON 字符串（去除 "data: " 前缀）
                    let jsonStr = trimmedLine.substring(6).trim();
                    let chunk: any = null;
                    
                    // 如果 jsonStr 是被转义的字符串（整个被引号包裹），需要先解析外层引号
                    // 例如: "{\"expert_name\": \"...\"}" -> {"expert_name": "..."}
                    if (jsonStr.startsWith('"') && jsonStr.endsWith('"')) {
                      try {
                        const parsed = JSON.parse(jsonStr);
                        if (typeof parsed === 'string') {
                          // 如果解析后还是字符串，说明是双重转义的JSON字符串，需要再次解析
                          jsonStr = parsed;
                        } else {
                          // 如果解析后是对象，直接使用
                          chunk = parsed;
                        }
                      } catch (e) {
                        // 解析失败，继续使用原字符串
                      }
                    }
                    
                    // 如果还没有解析出 chunk，继续解析 JSON 字符串
                    if (!chunk) {
                      // 如果 JSON 字符串可能包含多个对象或额外字符，尝试找到第一个完整的 JSON 对象
                      // 通过查找第一个 { 和最后一个 } 来提取完整的 JSON
                      const firstBrace = jsonStr.indexOf('{');
                      if (firstBrace !== -1) {
                        // 找到第一个 {，然后找到匹配的最后一个 }
                        let braceCount = 0;
                        let lastBrace = -1;
                        for (let i = firstBrace; i < jsonStr.length; i++) {
                          if (jsonStr[i] === '{') braceCount++;
                          if (jsonStr[i] === '}') {
                            braceCount--;
                            if (braceCount === 0) {
                              lastBrace = i;
                              break;
                            }
                          }
                        }
                        
                        if (lastBrace !== -1) {
                          jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
                        }
                      }
                      
                      // 解析 JSON
                      try {
                        chunk = JSON.parse(jsonStr);
                      } catch (e) {
                        continue; // 跳过这个数据块
                      }
                    }
                    
                    // 处理专家报告数据（统一处理所有报告，包括综合报告）
                    if (chunk && chunk.expert_name && chunk.expert_report !== undefined) {
                      totalChunksReceived++;
                      const expertName = chunk.expert_name;
                      const expertReport = chunk.expert_report;
                      
                      // 统一处理所有报告，如果同一个专家有多个报告，则追加内容
                      if (expertResults[expertName]) {
                        expertResults[expertName].expert_report += '\n\n' + expertReport;
                      } else {
                        expertResults[expertName] = {
                          expert_name: expertName,
                          expert_report: expertReport,
                        };
                      }
                      
                      // 实时通知更新（如果最后一个报告是综合报告，则设置analysis字段）
                      if (onComplete) {
                        // 如果报告名称包含"综合"，也设置到analysis字段（向后兼容）
                        if (expertName.includes('综合')) {
                          finalAnalysis = expertReport;
                        }
                        
                        // 创建expertResults的副本，确保传递的是当前所有累积的报告
                        const currentExpertResults = { ...expertResults };
                        onComplete({
                          success: true,
                          message: '分析进行中',
                          analysis: finalAnalysis || undefined,
                          expert_results: Object.keys(currentExpertResults).length > 0 ? currentExpertResults : undefined,
                          timestamp: new Date().toISOString(),
                        });
                      }
                    }
                  } catch (e) {
                    // 解析失败，跳过
                  }
                }
              }
            }
          }
          
          // 如果 buffer 中还有 "data: " 开头的完整消息，也尝试处理
          if (buffer.includes('data: ') && buffer.includes('\n\n')) {
            // 如果 buffer 中包含完整的消息分隔符，说明还有未处理的消息
            const remainingMessages = buffer.split('\n\n');
            buffer = remainingMessages.pop() || '';
            
            for (const messageBlock of remainingMessages) {
              const lines = messageBlock.split('\n');
              for (const line of lines) {
                let trimmedLine = line.trim();
                
                // 处理转义的字符串：如果整行被引号包裹，先去掉外层引号
                if (trimmedLine.startsWith('"') && trimmedLine.endsWith('"')) {
                  try {
                    trimmedLine = JSON.parse(trimmedLine);
                  } catch (e) {
                    // 忽略解析错误
                  }
                }
                
                if (trimmedLine.startsWith('data: ')) {
                  let jsonStr = '';
                  try {
                    jsonStr = trimmedLine.substring(6).trim();
                    
                    // 提取第一个完整的 JSON 对象
                    const firstBrace = jsonStr.indexOf('{');
                    if (firstBrace !== -1) {
                      let braceCount = 0;
                      let lastBrace = -1;
                      for (let i = firstBrace; i < jsonStr.length; i++) {
                        if (jsonStr[i] === '{') braceCount++;
                        if (jsonStr[i] === '}') {
                          braceCount--;
                          if (braceCount === 0) {
                            lastBrace = i;
                            break;
                          }
                        }
                      }
                      if (lastBrace !== -1) {
                        jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
                      }
                    }
                    
                    const chunk = JSON.parse(jsonStr);
                    
                    if (chunk && chunk.expert_name && chunk.expert_report !== undefined) {
                      const expertName = chunk.expert_name;
                      const expertReport = chunk.expert_report;
                      
                      if (expertName.includes('综合')) {
                        finalAnalysis = expertReport;
                        expertResults[expertName] = {
                          expert_name: expertName,
                          expert_report: expertReport,
                        };
                      } else {
                        if (expertResults[expertName]) {
                          expertResults[expertName].expert_report += '\n\n' + expertReport;
                        } else {
                          expertResults[expertName] = {
                            expert_name: expertName,
                            expert_report: expertReport,
                          };
                        }
                      }
                      
                      if (onComplete) {
                        onComplete({
                          success: true,
                          message: '分析进行中',
                          analysis: finalAnalysis || undefined,
                          expert_results: Object.keys(expertResults).length > 0 ? expertResults : undefined,
                          timestamp: new Date().toISOString(),
                        });
                      }
                    }
                  } catch (e) {
                    // 解析失败，跳过
                  }
                }
              }
            }
          }
        }
        
        if (done) {
          // 处理剩余的 buffer
          if (buffer.trim()) {
            // 按 "\n\n" 分割剩余的消息
            const remainingMessages = buffer.split('\n\n');
            
            for (const messageBlock of remainingMessages) {
              const lines = messageBlock.split('\n');
              for (const line of lines) {
                let trimmedLine = line.trim();
                
                // 处理转义的字符串：如果整行被引号包裹，先去掉外层引号
                if (trimmedLine.startsWith('"') && trimmedLine.endsWith('"')) {
                  try {
                    trimmedLine = JSON.parse(trimmedLine);
                  } catch (e) {
                    // 忽略解析错误
                  }
                }
                
                if (trimmedLine.startsWith('data: ')) {
                  let jsonStr = '';
                  try {
                    jsonStr = trimmedLine.substring(6).trim();
                    
                    // 提取第一个完整的 JSON 对象
                    const firstBrace = jsonStr.indexOf('{');
                    if (firstBrace !== -1) {
                      let braceCount = 0;
                      let lastBrace = -1;
                      for (let i = firstBrace; i < jsonStr.length; i++) {
                        if (jsonStr[i] === '{') braceCount++;
                        if (jsonStr[i] === '}') {
                          braceCount--;
                          if (braceCount === 0) {
                            lastBrace = i;
                            break;
                          }
                        }
                      }
                      if (lastBrace !== -1) {
                        jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
                      }
                    }
                    
                    const chunk = JSON.parse(jsonStr);
                    
                    if (chunk && chunk.expert_name && chunk.expert_report !== undefined) {
                      const expertName = chunk.expert_name;
                      const expertReport = chunk.expert_report;
                      
                      if (expertName === '命理师综合分析' || expertName.includes('综合')) {
                        finalAnalysis = expertReport;
                        expertResults[expertName] = {
                          expert_name: expertName,
                          expert_report: expertReport,
                        };
                      } else {
                        if (expertResults[expertName]) {
                          expertResults[expertName].expert_report += '\n\n' + expertReport;
                        } else {
                          expertResults[expertName] = {
                            expert_name: expertName,
                            expert_report: expertReport,
                          };
                        }
                      }
                    }
                  } catch (e) {
                    // 解析失败，跳过
                  }
                }
              }
            }
          }
          
          // 构建最终结果
          const result: AnalysisResult = {
            success: true,
            message: '分析完成',
            analysis: finalAnalysis || undefined,
            expert_results: Object.keys(expertResults).length > 0 ? expertResults : undefined,
            timestamp: new Date().toISOString(),
          };
          
          if (onComplete) {
            onComplete(result);
          }
          
          return result;
        }
      }
    } catch (error) {
      throw error;
    }
  },
};

