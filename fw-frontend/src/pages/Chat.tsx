import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { chatApi } from '../services/api';
import './Chat.css';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

const Chat: React.FC = () => {
    const [searchParams] = useSearchParams();
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [agentId, setAgentId] = useState<string | null>(null);
    const [lastOffset, setLastOffset] = useState(0);
    const [isMonitoring, setIsMonitoring] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const monitoringRef = useRef<boolean>(false);
    const lastOffsetRef = useRef<number>(0);
    const navigate = useNavigate();

    // 自动滚动到底部
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // 自动调整输入框高度
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, [inputValue]);

    // 从 URL 参数获取 agentId，如果没有则从后端获取
    useEffect(() => {
        const urlAgentId = searchParams.get('agentId') || searchParams.get('agent_id');
        if (urlAgentId) {
            setAgentId(urlAgentId);
        } else {
            // 如果没有提供 agentId，尝试从后端获取
            const fetchAgentId = async () => {
                try {
                    const agentInfo = await chatApi.getAgentInfo();
                    if (agentInfo.agent_id) {
                        setAgentId(agentInfo.agent_id);
                    } else {
                        const errorMessage: Message = {
                            id: 'error',
                            role: 'assistant',
                            content: '无法获取 Agent ID，请确保 Parlant 服务器已启动',
                            timestamp: new Date(),
                        };
                        setMessages([errorMessage]);
                    }
                } catch (error: any) {
                    console.error('获取 Agent ID 失败:', error);
                    const errorMessage: Message = {
                        id: 'error',
                        role: 'assistant',
                        content: '无法连接到服务器，请确保 Parlant 服务器已启动',
                        timestamp: new Date(),
                    };
                    setMessages([errorMessage]);
                }
            };
            fetchAgentId();
        }
    }, [searchParams]);

    // 初始化会话
    useEffect(() => {
        if (!agentId) {
            return; // 如果没有 agentId，不初始化会话
        }

        const initSession = async () => {
            try {
                const session = await chatApi.createSession(
                    agentId,
                    undefined,
                    `聊天会话 ${new Date().toLocaleString('zh-CN')}`
                );
                setSessionId(session.id);
                // 开始监听事件
                startEventMonitoring(session.id);
            } catch (error: any) {
                console.error('创建会话失败:', error);
                let errorMessage = '无法连接到服务器，请稍后重试。';
                
                // 尝试获取更详细的错误信息
                if (error.response?.data?.detail) {
                    errorMessage = `连接失败: ${error.response.data.detail}`;
                } else if (error.response?.data?.error) {
                    errorMessage = `连接失败: ${error.response.data.error}`;
                } else if (error.message) {
                    errorMessage = `连接失败: ${error.message}`;
                }
                
                const errorMsg: Message = {
                    id: 'error',
                    role: 'assistant',
                    content: errorMessage,
                    timestamp: new Date(),
                };
                setMessages([errorMsg]);
            }
        };
        
        initSession();

        return () => {
            // 清理时停止监听
            monitoringRef.current = false;
        };
    }, [agentId]);

    // 开始事件监听
    const startEventMonitoring = async (sid: string) => {
        if (monitoringRef.current) return;
        monitoringRef.current = true;
        setIsMonitoring(true);

        const pollEvents = async () => {
            while (monitoringRef.current && sid && agentId) {
                try {
                    const response = await chatApi.listEvents(
                        sid,
                        agentId,
                        lastOffsetRef.current,
                        30,
                        null
                    );

                    const events = response.events || [];
                    
                    if (Array.isArray(events) && events.length > 0) {
                        for (const event of events) {
                            await handleEvent(event);
                            if (event.offset !== undefined) {
                                const newOffset = Math.max(lastOffsetRef.current, event.offset + 1);
                                lastOffsetRef.current = newOffset;
                                setLastOffset(newOffset);
                            }
                        }
                    }
                } catch (error) {
                    console.error('获取事件失败:', error);
                    // 等待后重试
                    await new Promise((resolve) => setTimeout(resolve, 5000));
                }
            }
        };

        pollEvents();
    };

    // 处理事件
    const handleEvent = async (event: any) => {
        const eventKind = event.kind || event.type;
        const eventSource = event.source || event.data?.source;

        // 只处理消息事件，且不是用户消息（用户消息已经乐观更新）
        if (eventKind === 'message' && eventSource !== 'customer') {
            let messageText = '';
            
            // 尝试多种可能的消息字段位置
            if (event.data?.data?.message) {
                messageText = event.data.data.message;
            } else if (event.data?.message) {
                messageText = event.data.message;
            } else if (event.message) {
                messageText = event.message;
            } else if (event.data?.data && typeof event.data.data === 'string') {
                messageText = event.data.data;
            } else if (event.data && typeof event.data === 'string') {
                messageText = event.data;
            }

            if (messageText) {
                const assistantMessage: Message = {
                    id: event.id || Date.now().toString(),
                    role: 'assistant',
                    content: messageText,
                    timestamp: event.timestamp ? new Date(event.timestamp) : new Date(),
                };
                setMessages((prev) => [...prev, assistantMessage]);
                setIsLoading(false);
            }
        }
    };

    const handleSend = async () => {
        if (!inputValue.trim() || isLoading || !sessionId || !agentId) return;

        const messageContent = inputValue.trim();

        // 立即显示用户消息（乐观更新）
        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: messageContent,
            timestamp: new Date(),
        };

        setMessages((prev) => [...prev, userMessage]);
        setInputValue('');
        setIsLoading(true);
        
        // 重置输入框高度
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
        }

        try {
            // 发送消息到后端
            await chatApi.createEvent(
                sessionId,
                agentId,
                'message',
                'customer',
                messageContent
            );
            // 消息发送成功，等待事件监听获取回复
        } catch (error) {
            console.error('发送消息失败:', error);
            setIsLoading(false);
            const errorMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: '发送消息失败，请重试。',
                timestamp: new Date(),
            };
            setMessages((prev) => [...prev, errorMessage]);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="chat-container">
            <div className="header">
                <h1>💬 快速咨询</h1>
                <button className="btn-back" onClick={() => navigate('/')}>
                    ← 返回首页
                </button>
            </div>

            <div className="chat-content">
                <div className="messages-container">
                    {messages.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state-icon">💬</div>
                            <p>开始您的咨询之旅</p>
                        </div>
                    ) : (
                        <div className="messages-list">
                            {messages.map((message) => (
                                <div
                                    key={message.id}
                                    className={`message ${message.role === 'user' ? 'user-message' : 'assistant-message'}`}
                                >
                                    <div className="message-avatar">
                                        {message.role === 'user' ? '👤' : '🔮'}
                                    </div>
                                    <div className="message-content">
                                        <div className="message-text">{message.content}</div>
                                        <div className="message-time">
                                            {message.timestamp.toLocaleTimeString('zh-CN', {
                                                hour: '2-digit',
                                                minute: '2-digit',
                                            })}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {isLoading && (
                                <div className="message assistant-message">
                                    <div className="message-avatar">🔮</div>
                                    <div className="message-content">
                                        <div className="typing-indicator">
                                            <span></span>
                                            <span></span>
                                            <span></span>
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>
                    )}
                </div>

                <div className="input-container">
                    <div className="input-wrapper">
                        <textarea
                            ref={textareaRef}
                            className="chat-input"
                            placeholder="输入您的问题..."
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyPress={handleKeyPress}
                            rows={1}
                            disabled={isLoading}
                        />
                        <button
                            className="send-button"
                            onClick={handleSend}
                            disabled={!inputValue.trim() || isLoading || !agentId}
                        >
                            {isLoading ? '⏳' : '📤'}
                        </button>
                    </div>
                    <div className="input-hint">
                        按 Enter 发送，Shift + Enter 换行
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Chat;

