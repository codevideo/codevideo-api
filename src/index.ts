import { FastMCP } from 'fastmcp';
import http from 'http';
import WebSocket from 'ws';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { verifyToken } from '@clerk/backend';
import { z } from 'zod';
import { AllActionStrings } from "@fullstackcraftllc/codevideo-types";
import { LLMFactory, LLMProvider } from './llm-factory';
import { LLMAdapter } from './types';

// Configuration
const LLM_PROVIDER: LLMProvider = (process.env.LLM_PROVIDER as LLMProvider) || 'gemini';
const DEFAULT_MODEL = LLM_PROVIDER === 'anthropic' ? 'claude-sonnet-4-20250514' : 'gemini-2.5-pro';

const app = express();
app.use(cors());
app.use(express.json());

const mcp = new FastMCP({
    name: 'codevideo-genie',
    version: '1.0.0'
});

// Create LLM adapter based on environment configuration
const llmAdapter: LLMAdapter = LLMFactory.createAdapter({
    provider: LLM_PROVIDER,
    config: {
        model: DEFAULT_MODEL,
        maxTokens: 8000,
        temperature: 0.7
    }
});

console.log(`🤖 Using ${LLM_PROVIDER.toUpperCase()} LLM with model: ${DEFAULT_MODEL}`);

// Helper function to clean JSON response from LLM (removes markdown code blocks)
function cleanJsonResponse(text: string): string {
    let cleanText = text.trim();
    
    // Remove markdown code block markers if present
    if (cleanText.startsWith('```json')) {
        cleanText = cleanText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanText.startsWith('```')) {
        cleanText = cleanText.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    
    return cleanText;
}

// Delimiter parser for streaming actions
class DelimitedJSONParser {
    private buffer = '';
    private readonly startDelim = '<<<ACTION_START>>>';
    private readonly endDelim = '<<<ACTION_END>>>';

    parse(chunk: string): any[] {
        this.buffer += chunk;
        const results: any[] = [];

        let startPos = this.buffer.indexOf(this.startDelim);
        while (startPos !== -1) {
            const endPos = this.buffer.indexOf(this.endDelim, startPos);
            if (endPos !== -1) {
                const jsonStart = startPos + this.startDelim.length;
                const jsonStr = this.buffer.substring(jsonStart, endPos).trim();

                try {
                    const action = JSON.parse(jsonStr);
                    results.push(action);
                } catch (e) {
                    console.warn('Failed to parse action JSON:', jsonStr);
                }

                this.buffer = this.buffer.substring(endPos + this.endDelim.length);
                startPos = this.buffer.indexOf(this.startDelim);
            } else {
                break;
            }
        }

        return results;
    }
}

// Connections grouped by sessionId, so a generation streams ONLY to the client
// that requested it instead of every connected browser (multi-tenant safe).
const sessions = new Map<string, Set<WebSocket>>();
let totalConnections = 0;
const MAX_CONNECTIONS = Number(process.env.GENIE_MAX_WS_CONNECTIONS) || 200;

// The WebSocket server shares the HTTP server (one port), so a single reverse-
// proxy location can serve both the trigger and the stream. Wired at listen time.
function handleWsConnection(ws: WebSocket, req: http.IncomingMessage) {
    if (totalConnections >= MAX_CONNECTIONS) {
        ws.close(1013, 'Server at capacity');
        return;
    }
    // sessionId arrives as a query param: ws://host:9000?sessionId=<uuid>
    const sessionId = new URL(req.url ?? '', 'http://localhost').searchParams.get('sessionId');
    if (!sessionId) {
        ws.close(1008, 'Missing sessionId');
        return;
    }
    totalConnections++;
    let set = sessions.get(sessionId);
    if (!set) {
        set = new Set();
        sessions.set(sessionId, set);
    }
    set.add(ws);
    console.log(`Client connected (session ${sessionId}); ${totalConnections} total`);

    ws.on('close', () => {
        totalConnections--;
        const s = sessions.get(sessionId);
        if (s) {
            s.delete(ws);
            if (s.size === 0) sessions.delete(sessionId);
        }
        console.log(`Client disconnected (session ${sessionId}); ${totalConnections} total`);
    });
}

// Send only to the sockets belonging to one session.
function sendToSession(sessionId: string, data: any) {
    const set = sessions.get(sessionId);
    if (!set) return;
    const message = JSON.stringify(data);
    set.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) ws.send(message);
    });
}

// Broadcast to ALL connected clients. Used only by the legacy MCP tool path,
// which has no per-user session; the public HTTP path uses sendToSession.
function broadcast(data: any) {
    const message = JSON.stringify(data);
    sessions.forEach(set => set.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) ws.send(message);
    }));
}

// FastMCP tool for generating lessons
mcp.addTool({
    name: 'generate-lesson',
    description: 'Generate CodeVideo lesson with streaming updates',
    parameters: z.object({
        prompt: z.string().describe('Lesson description')
    }),
    execute: async ({ prompt }: { prompt: string }) => {
        console.log('Starting lesson generation for:', prompt);

        const parser = new DelimitedJSONParser();
        let actionCount = 0;

        // Send initial lesson metadata
        const lessonMetadata = await extractLessonMetadata(prompt);

        broadcast({
            type: 'setLessonName',
            lessonName: lessonMetadata.name
        });

        broadcast({
            type: 'setLessonDescription',
            lessonDescription: lessonMetadata.description
        });

        // Build streaming prompt
        const streamingPrompt = `
Generate CodeVideo tutorial actions for: ${prompt}

IMPORTANT: Output each action immediately using this exact format:

<<<ACTION_START>>>
{"name": "author-speak-before", "value": "Let's create a React component"}
<<<ACTION_END>>>

<<<ACTION_START>>>
{"name": "file-create", "value": "Button.tsx"}
<<<ACTION_END>>>

Generate actions one at a time. Start generating now:
`;

        try {
            const stream = llmAdapter.generateContentStream(streamingPrompt);

            for await (const chunk of stream) {
                if (chunk.text && !chunk.isComplete) {
                    const actions = parser.parse(chunk.text);

                    actions.forEach(action => {
                        if (action.name && action.value) {
                            actionCount++;

                            // Broadcast action immediately
                            broadcast({
                                type: 'appendLessonAction',
                                lessonAction: {
                                    id: `action-${actionCount}`,
                                    name: action.name,
                                    value: action.value
                                }
                            });

                            console.log(`Streamed action ${actionCount}:`, action.name);
                        }
                    });
                }
            }

            // Send completion
            broadcast({
                type: 'generationComplete',
                totalActions: actionCount
            });

            return `Generated lesson with ${actionCount} actions`;
        } catch (error) {
            console.error('Error generating lesson:', error);
            broadcast({
                type: 'error',
                message: (error as Error).message
            });
            throw error;
        }
    }
});

// FastMCP tool for extracting lesson metadata
mcp.addTool({
    name: 'extract-lesson-metadata',
    description: 'Extract lesson name and description from a prompt using AI',
    parameters: z.object({
        prompt: z.string().describe('The lesson prompt to extract metadata from')
    }),
    execute: async ({ prompt }: { prompt: string }) => {
        try {
            const extractionPrompt = `
Extract a concise lesson name and description from this coding tutorial prompt:

"${prompt}"

Respond ONLY with a JSON object in this exact format:
{
    "name": "Brief, clear lesson title (max 50 chars)",
    "description": "One sentence description of what the student will learn"
}

Examples:
- Prompt: "Create a React component with useState" 
  Response: {"name": "React useState Hook", "description": "Learn how to manage state in React components using the useState hook"}

- Prompt: "Build a REST API with Express and TypeScript"
  Response: {"name": "Express TypeScript API", "description": "Learn how to build a REST API using Express.js and TypeScript"}

Focus on the main technology and concept. Keep the name short and descriptive.
`;

            const response = await llmAdapter.generateContent(extractionPrompt);

            try {
                const cleanText = cleanJsonResponse(response.text);
                const metadata = JSON.parse(cleanText);
                return JSON.stringify({
                    name: metadata.name || 'Coding Tutorial',
                    description: metadata.description || `Learn ${metadata.name || 'coding concepts'} step by step`
                });
            } catch (parseError) {
                console.warn('Failed to parse lesson metadata JSON:', response.text);
                return JSON.stringify({
                    name: 'Coding Tutorial',
                    description: 'Learn coding concepts step by step'
                });
            }

        } catch (error) {
            console.error('Error extracting lesson metadata:', error);
            return JSON.stringify({
                name: 'Coding Tutorial',
                description: 'Learn coding concepts step by step'
            });
        }
    }
});

// Helper function to extract lesson metadata (wrapper for the tool)
async function extractLessonMetadata(prompt: string): Promise<{ name: string; description: string }> {
    const extractionPrompt = `
Extract a concise lesson name and description from this coding tutorial prompt:

"${prompt}"

Respond ONLY with a JSON object in this exact format:
{
    "name": "Brief, clear lesson title (max 50 chars)",
    "description": "One sentence description of what the student will learn"
}

Examples:
- Prompt: "Create a React component with useState" 
  Response: {"name": "React useState Hook", "description": "Learn how to manage state in React components using the useState hook"}

- Prompt: "Build a REST API with Express and TypeScript"
  Response: {"name": "Express TypeScript API", "description": "Learn how to build a REST API using Express.js and TypeScript"}

Focus on the main technology and concept. Keep the name short and descriptive.
`;

    const response = await llmAdapter.generateContent(extractionPrompt);
    try {
        const cleanText = cleanJsonResponse(response.text);
        const metadata = JSON.parse(cleanText);
        return {
            name: metadata.name || 'Coding Tutorial',
            description: metadata.description || `Learn ${metadata.name || 'coding concepts'} step by step`
        };
    } catch (parseError) {
        console.warn('Failed to parse lesson metadata JSON:', response.text);
        return {
            name: 'Coding Tutorial',
            description: 'Learn coding concepts step by step'
        };
    }
}

// Rate limit the costly generation trigger per IP.
const agentLimiter = rateLimit({
    windowMs: Number(process.env.GENIE_RATE_WINDOW_MS) || 10 * 60 * 1000,
    max: Number(process.env.GENIE_RATE_MAX) || 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: 'Too many generation requests, please slow down.' },
});

// Verify the caller's Clerk session JWT. Enforced only when CLERK_SECRET_KEY is
// set, so local dev without Clerk still works; set it in production so randoms
// can't burn the server-side LLM key.
const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;
async function requireAuth(req: Request, res: Response, next: NextFunction) {
    if (!CLERK_SECRET_KEY) {
        return next();
    }
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) {
        res.status(401).json({ success: false, error: 'Sign in to generate.' });
        return;
    }
    try {
        await verifyToken(token, { secretKey: CLERK_SECRET_KEY });
        next();
    } catch {
        res.status(401).json({ success: false, error: 'Invalid or expired session.' });
    }
}

// HTTP endpoint for your React app to trigger generation
app.post('/codevideo-mcp/agent', agentLimiter, requireAuth, async (req, res) => {
    const { prompt, sessionId } = req.body ?? {};
    if (!sessionId) {
        return res.status(400).json({ success: false, error: 'Missing sessionId.' });
    }
    if (!prompt) {
        return res.status(400).json({ success: false, error: 'Missing prompt.' });
    }
    // Shadow broadcast: stream this generation ONLY to the requesting client's
    // session rather than every connected browser.
    const broadcast = (data: any) => sendToSession(sessionId, data);
    try {
        console.log('Received prompt:', prompt);

        // Since FastMCP handles tools internally, we manually call the generate-lesson logic
        // This triggers the same functionality without accessing internal tool registry
        console.log('Starting lesson generation for:', prompt);

        const parser = new DelimitedJSONParser();
        let actionCount = 0;

        // Send initial lesson metadata
        const lessonMetadata = await extractLessonMetadata(prompt);

        broadcast({
            type: 'setLessonName',
            lessonName: lessonMetadata.name
        });

        broadcast({
            type: 'setLessonDescription',
            lessonDescription: lessonMetadata.description
        });

        // Build streaming prompt
        const streamingPrompt = `
You are an expert senior software engineer and educator, and skilled in describing software concepts in a way that is easy for students to understand. You are going to create lesson actions using the CodeVideo framework, a framework that uses simple JSON to generate tutorials in a variety of formats (video, markdown, pdf, and more). This JSON array is always an array of simple \`IAction\`:

\`\`\`typescript
export interface IAction {
    name: AllActions;
    value: string;
}
\`\`\`

Where \`AllActions\` is:

\`\`\`typescript
import { AuthorActions } from "./AuthorActions";
import { MouseActions } from "./MouseActions";
import { FileExplorerActions } from "./FileExplorerActions";
import { TerminalActions } from "./TerminalActions";
import { EditorActions } from "./EditorActions";
import { ExternalActions } from "./ExternalActions";

// all actions combines the 5 domains of the CodeVideo world
export type AllActions =
| AuthorActions
| FileExplorerActions
| EditorActions
| MouseActions
| TerminalActions
| AuthorActions
| ExternalActions;
\`\`\`

Here are all the action types you have to choose from:

\`\`\`typescript
export const AllActionStrings = [
    ${AllActionStrings.map((action) => `"${action}"`).join(",\n        ")}
];
\`\`\`

Use the MCP tool \`codevideo_get_action_names\` to get the most updated list of all the actions available. You can also use the MCP tool \`codevideo_get_example_actions_array_by_keyword\`  \`codevideo_get_example_lessons_by_keyword\` to get verified, accurate, and correct lessons created by humans.

Also VERY IMPORTANT to note, while most 'value' properties are corresponding strings, things like \`editor-enter\` are considered "Repeatable" properties, which MUST have a string number as the 'value' property, which is 99% of the time the string "1", but can be any positive integer, representing the number of times to repeat. An action can be checked for repeatability with the MCP tool \`codevideo_is_repeatable_action\`. To be stressed again: the "value" property of any codevideo action CANNOT be left empty!

Please do not use \`file-explorer-create-file\` directly, instead use the following flow:

\`\`\`json
{
"name": "mouse-move-file-explorer",
"value": "1"
},
{
    "name": "mouse-right-click",
    "value": "1"
},
{
    "name": "mouse-move-file-explorer-context-menu-new-file",
    "value": "1"
},
{
    "name": "mouse-left-click",
    "value": "1"
},
{
    "name": "file-explorer-type-new-file-input",
    "value": "my_file.py"
},
{
    "name": "file-explorer-enter-new-file-input",
    "value": "1"
},
\`\`\`

Likewise, for opening existing files, use the following flow:

\`\`\`json
{
    "name": "mouse-move-file-explorer-file",
    "value": "my_file.py"
},
{
    "name": "file-explorer-open-file",
    "value": "1"
}
\`\`\`     

Also, you SHOULD NEVER use \`file-explorer-set-working-directory\` or \`file-explorer-set-file-contents\`! These are ONLY FOR INTERNAL USAGE!

STYLE AND PACING: As much as possible, try to incorporate speech actions during writing of code. We shouldn't have super long blocks of just typing code. Also, for speaking actions themselves, if they are longer than 2-3 sentences, they should be broken into multiple speak actions. Think about the flow of time as well. For example, if you say you are going to save the file, the editor-save action should always come after that speak action. If you say you are going to open up a terminal, that speak action should be BEFORE the terminal-open action. REGARDLESS OF ORDER, ONLY USE THE \`author-speak-before\` ACTION.

With all this in mind, you are to create actions on the following topic:

${prompt}

Be sure to include a corresponding initial \`author-speak-before\` action and a final summary \`author-speak-before\` action.

OF ABSOLUTE IMPORTANCE: Output each action immediately using this exact format:

<<<ACTION_START>>>
{"name": "author-speak-before", "value": "Let's create a React component"}
<<<ACTION_END>>>

<<<ACTION_START>>>
{"name": "file-create", "value": "Button.tsx"}
<<<ACTION_END>>>

Generate actions one at a time. Start generating now:
`;

        const stream = llmAdapter.generateContentStream(streamingPrompt);

        for await (const chunk of stream) {
            if (chunk.text && !chunk.isComplete) {
                const actions = parser.parse(chunk.text);

                actions.forEach(action => {
                    if (action.name && action.value) {
                        actionCount++;

                        // Broadcast action immediately
                        broadcast({
                            type: 'appendLessonAction',
                            lessonAction: {
                                id: `action-${actionCount}`,
                                name: action.name,
                                value: action.value
                            }
                        });

                        console.log(`Streamed action ${actionCount}:`, action.name);
                    }
                });
            }
        }

        // Send completion
        broadcast({
            type: 'generationComplete',
            totalActions: actionCount
        });

        res.json({
            success: true,
            message: 'Lesson generation started',
            result: `Generated lesson with ${actionCount} actions`
        });
    } catch (error) {
        console.error('Error:', error);
        // let the client's IDE stop "streaming" instead of hanging
        broadcast({ type: 'error', message: (error as Error).message });
        if (!res.headersSent) {
            res.status(500).json({
                success: false,
                error: (error as Error).message
            });
        }
    }
});

// Behind a reverse proxy (nginx), trust it so express-rate-limit keys on the
// real client IP (X-Forwarded-For) instead of the proxy's IP. Set
// GENIE_TRUST_PROXY=1 in production; leave unset locally.
if (process.env.GENIE_TRUST_PROXY) {
    app.set('trust proxy', Number(process.env.GENIE_TRUST_PROXY) || 1);
}

// One HTTP server hosts BOTH the REST trigger and the WebSocket stream, so a
// single public URL maps to one upstream (e.g. https://api.codevideo.io/genie
// for the POST + wss://api.codevideo.io/genie for the stream). Default 3001,
// NOT 3000: the genie frontend's next/netlify dev use 3000, so a 3000 default
// here would lose the port and the trigger would hit Next (404, no CORS).
const PORT = Number(process.env.GENIE_HTTP_PORT ?? process.env.PORT) || 3001;
const httpServer = http.createServer(app);
const wss = new WebSocket.Server({ server: httpServer });
wss.on('connection', handleWsConnection);
httpServer.listen(PORT, () => {
    console.log(`Genie HTTP + WebSocket server on port ${PORT} (WS shares the port)`);
});
httpServer.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`\n[genie] Port ${PORT} is already in use. Set GENIE_HTTP_PORT to a free port and point the frontend's NEXT_PUBLIC_GENIE_API_URL/WS_URL at it.\n`);
    } else {
        console.error('[genie] HTTP server error:', err);
    }
    process.exit(1);
});

// Start the FastMCP server using stdio transport (for testing)
mcp.start({
    transportType: "stdio",
});