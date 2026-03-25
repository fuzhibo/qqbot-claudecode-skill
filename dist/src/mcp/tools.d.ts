/**
 * MCP 工具定义
 */
import type { McpToolResponse } from './types.js';
/**
 * 工具定义列表
 */
export declare const toolDefinitions: ({
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            botName?: undefined;
            targetId?: undefined;
            content?: undefined;
            msgId?: undefined;
            filePath?: undefined;
            desc?: undefined;
            limit?: undefined;
        };
        required?: undefined;
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            botName: {
                type: string;
                description: string;
            };
            targetId: {
                type: string;
                description: string;
            };
            content: {
                type: string;
                description: string;
            };
            msgId: {
                type: string;
                description: string;
            };
            filePath?: undefined;
            desc?: undefined;
            limit?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            botName: {
                type: string;
                description: string;
            };
            targetId: {
                type: string;
                description: string;
            };
            filePath: {
                type: string;
                description: string;
            };
            desc: {
                type: string;
                description: string;
            };
            content?: undefined;
            msgId?: undefined;
            limit?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            botName: {
                type: string;
                description: string;
            };
            targetId?: undefined;
            content?: undefined;
            msgId?: undefined;
            filePath?: undefined;
            desc?: undefined;
            limit?: undefined;
        };
        required?: undefined;
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            botName: {
                type: string;
                description: string;
            };
            targetId: {
                type: string;
                description: string;
            };
            limit: {
                type: string;
                description: string;
            };
            content?: undefined;
            msgId?: undefined;
            filePath?: undefined;
            desc?: undefined;
        };
        required: string[];
    };
})[];
/**
 * 处理工具调用
 */
export declare function handleToolCall(name: string, args: Record<string, unknown>): Promise<McpToolResponse>;
