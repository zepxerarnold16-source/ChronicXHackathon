// ============================================================
// CHRONICAI — FINAL COMPLETE SERVER.JS
// ============================================================
//
// CHRONICAI BACKEND
//
// AI ARCHITECTURE
// ------------------------------------------------------------
//
// AI LIFE HELPER        -> GROQ
// NORMAL CHAT           -> GROQ
// PRODUCT LIVE CHAT     -> GROQ
// AUTHORITY ASSISTANT   -> GROQ
// IMAGE CHAT            -> GROQ VISION
//
// CHRONIC REPORT ANALYSIS -> GEMINI
// PRODUCT SCANNER       -> GEMINI
//
// EMAIL OTP             -> GMAIL / NODEMAILER
// PHONE OTP             -> TWILIO
//
// REPORT STORAGE        -> JSON FILE
// REPORT EMAIL          -> GMAIL
//
// ============================================================

"use strict";

// ============================================================
// IMPORTS
// ============================================================

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import nodemailer from "nodemailer";
import { fileURLToPath } from "url";
import multer from "multer";

dotenv.config();

// ============================================================
// PATH
// ============================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================
// EXPRESS APP
// ============================================================

const app = express();

app.disable("x-powered-by");

const PORT =
    Number(process.env.PORT) || 3000;

// ============================================================
// DATA DIRECTORY
// ============================================================

const DATA_DIR =
    path.join(__dirname, "data");

const REPORTS_FILE =
    path.join(DATA_DIR, "reports.json");

if (!fs.existsSync(DATA_DIR)) {

    fs.mkdirSync(
        DATA_DIR,
        {
            recursive: true
        }
    );

}

if (!fs.existsSync(REPORTS_FILE)) {

    fs.writeFileSync(
        REPORTS_FILE,
        "[]",
        "utf8"
    );

}

// ============================================================
// MIDDLEWARE
// ============================================================

app.use(
    cors({
        origin: true,
        credentials: true
    })
);

app.use(
    express.json({
        limit: "25mb"
    })
);

app.use(
    express.urlencoded({
        extended: true,
        limit: "25mb"
    })
);

// ============================================================
// GENERAL HELPERS
// ============================================================

function cleanText(value) {

    if (
        value === undefined ||
        value === null
    ) {

        return "";

    }

    return String(value).trim();

}

// ============================================================
// SECURE ID
// ============================================================

function generateSecureId(prefix = "") {

    return (
        prefix +
        crypto.randomBytes(16).toString("hex")
    );

}

// ============================================================
// IMAGE HELPERS
// ============================================================

function isImageDataUrl(image) {

    return (
        typeof image === "string" &&
        /^data:image\/[a-zA-Z0-9.+-]+;base64,/i.test(image)
    );

}

function validateImage(image) {

    if (!image) {

        return {
            valid: false,
            error: "Image is required."
        };

    }

    if (!isImageDataUrl(image)) {

        return {
            valid: false,
            error: "Invalid image format."
        };

    }

    // Approximate base64 request safety limit.
    // Groq vision has its own request limits.
    if (
        image.length >
        5_000_000
    ) {

        return {
            valid: false,
            error:
                "Image is too large. Please use a smaller image."
        };

    }

    return {
        valid: true
    };

}

function imageToGeminiPart(image) {

    const match =
        image.match(
            /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/i
        );

    if (!match) {

        throw new Error(
            "Invalid image data."
        );

    }

    return {

        inline_data: {

            mime_type:
                match[1],

            data:
                match[2]

        }

    };

}

// ============================================================
// GEMINI CONFIGURATION
// ============================================================
//
// ONLY:
// CHRONIC Report Analysis
// Product Scanner
//
// ============================================================

const GEMINI_API_KEY =
    cleanText(
        process.env.GEMINI_API_KEY
    );

//
// Default kept configurable through .env.
// If your existing Gemini model works, keep your
// GEMINI_MODEL value in .env.
//
// Example:
// GEMINI_MODEL=gemini-3.5-flash
//

const GEMINI_MODEL =
    cleanText(
        process.env.GEMINI_MODEL
    ) ||
    "gemini-3.5-flash";

const GEMINI_API_URL =
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// ============================================================
// GROQ CONFIGURATION
// ============================================================
//
// NORMAL CHAT
// PRODUCT CHAT
// AUTHORITY
// IMAGE CHAT
//
// ============================================================

const GROQ_API_KEY =
    cleanText(
        process.env.GROQ_API_KEY
    );

//
// Current production text model.
//
const GROQ_TEXT_MODEL =
    cleanText(
        process.env.GROQ_TEXT_MODEL
    ) ||
    "llama-3.3-70b-versatile";

//
// Current Groq multimodal model.
//
const GROQ_VISION_MODEL =
    cleanText(
        process.env.GROQ_VISION_MODEL
    ) ||
    "meta-llama/llama-4-scout-17b-16e-instruct";

const GROQ_API_URL =
    "https://api.groq.com/openai/v1/chat/completions";

// ============================================================
// GMAIL CONFIGURATION
// ============================================================

const EMAIL_USER =
    cleanText(
        process.env.EMAIL_USER
    );

const EMAIL_PASSWORD =
    cleanText(
        process.env.EMAIL_PASSWORD
    );

const EMAIL_FROM =
    cleanText(
        process.env.EMAIL_FROM
    ) ||
    EMAIL_USER;

let emailTransporter = null;

if (
    EMAIL_USER &&
    EMAIL_PASSWORD
) {

    try {

        emailTransporter =
            nodemailer.createTransport({

                service: "gmail",

                auth: {

                    user:
                        EMAIL_USER,

                    pass:
                        EMAIL_PASSWORD

                },

                connectionTimeout:
                    20_000,

                greetingTimeout:
                    20_000,

                socketTimeout:
                    30_000

            });

    } catch (error) {

        console.error(
            "GMAIL INITIALIZATION ERROR:",
            error?.message || error
        );

    }

}

// ============================================================
// CONFIG CHECK
// ============================================================

function hasGeminiKey() {

    return Boolean(
        GEMINI_API_KEY &&
        GEMINI_API_KEY.length > 10
    );

}

function hasGroqKey() {

    return Boolean(
        GROQ_API_KEY &&
        GROQ_API_KEY.length > 10
    );

}

function hasEmailConfig() {

    return Boolean(
        emailTransporter
    );

}

// ============================================================
// CHAT MEMORY
// ============================================================

const chatSessions =
    new Map();

const CHAT_SESSION_TTL =
    30 * 60 * 1000;

const MAX_CHAT_SESSIONS =
    500;

// ============================================================
// CLEANUP CHAT MEMORY
// ============================================================

function cleanupChatSessions() {

    const now =
        Date.now();

    for (
        const [
            id,
            session
        ]
        of chatSessions
    ) {

        if (
            !session ||
            now -
            session.updatedAt >
            CHAT_SESSION_TTL
        ) {

            chatSessions.delete(
                id
            );

        }

    }

    while (
        chatSessions.size >
        MAX_CHAT_SESSIONS
    ) {

        const oldest =
            chatSessions
                .keys()
                .next()
                .value;

        if (!oldest) {

            break;

        }

        chatSessions.delete(
            oldest
        );

    }

}

// ============================================================
// HISTORY NORMALIZER
// ============================================================

function normalizeHistory(history) {

    if (
        !Array.isArray(history)
    ) {

        return [];

    }

    return history
        .slice(-20)
        .map(
            item => {

                const role =
                    item?.role === "assistant" ||
                    item?.role === "model"
                        ? "assistant"
                        : "user";

                const content =
                    cleanText(
                        item?.content ??
                        item?.text ??
                        item?.message
                    );

                if (!content) {

                    return null;

                }

                return {

                    role,

                    content

                };

            }
        )
        .filter(Boolean);

}

// ============================================================
// GET CHAT SESSION ID
// ============================================================

function getChatSessionId(body) {

    const supplied =
        cleanText(
            body?.conversationId ||
            body?.sessionId
        );

    const id =
        supplied ||
        generateSecureId(
            "CHAT-"
        );

    if (
        !chatSessions.has(id)
    ) {

        chatSessions.set(

            id,

            {

                history: [],

                updatedAt:
                    Date.now()

            }

        );

    }

    return id;

}

// ============================================================
// GROQ ERROR PARSER
// ============================================================

function getGroqErrorMessage(text) {

    try {

        const data =
            JSON.parse(text);

        return (
            data?.error?.message ||
            data?.error?.type ||
            data?.message ||
            "Groq API error."
        );

    } catch {

        return (
            text ||
            "Groq API error."
        );

    }

}

// ============================================================
// GROQ API
// ============================================================

async function callGroq({

    systemPrompt,

    userText,

    history = [],

    image = null,

    temperature = 0.55,

    maxTokens = 1800,

    retries = 2

}) {

    if (
        !hasGroqKey()
    ) {

        throw new Error(
            "GROQ_API_KEY is missing. Add GROQ_API_KEY to your .env file."
        );

    }

    const messages = [];

    // --------------------------------------------------------
    // SYSTEM
    // --------------------------------------------------------

    messages.push({

        role: "system",

        content:
            systemPrompt ||
            "You are a helpful AI assistant."

    });

    // --------------------------------------------------------
    // HISTORY
    // --------------------------------------------------------

    const normalizedHistory =
        normalizeHistory(
            history
        );

    for (
        const item
        of normalizedHistory
    ) {

        messages.push({

            role:
                item.role === "assistant"
                    ? "assistant"
                    : "user",

            content:
                item.content

        });

    }

    // --------------------------------------------------------
    // USER
    // --------------------------------------------------------

    if (image) {

        const validation =
            validateImage(
                image
            );

        if (
            !validation.valid
        ) {

            throw new Error(
                validation.error
            );

        }

        messages.push({

            role: "user",

            content: [

                {

                    type: "text",

                    text:
                        userText ||
                        "Please analyze this image."

                },

                {

                    type: "image_url",

                    image_url: {

                        url:
                            image

                    }

                }

            ]

        });

    } else {

        messages.push({

            role: "user",

            content:
                userText || ""

        });

    }

    // --------------------------------------------------------
    // MODEL
    // --------------------------------------------------------

    const model =
        image
            ? GROQ_VISION_MODEL
            : GROQ_TEXT_MODEL;

    // --------------------------------------------------------
    // RETRY LOOP
    // --------------------------------------------------------

    let lastError = null;

    for (
        let attempt = 0;
        attempt <= retries;
        attempt++
    ) {

        const controller =
            new AbortController();

        const timeout =
            setTimeout(
                () => {

                    controller.abort();

                },
                120_000
            );

        try {

            console.log(
                `[GROQ] Request attempt ${attempt + 1}/${retries + 1}`
            );

            console.log(
                `[GROQ] Model: ${model}`
            );

            const response =
                await fetch(

                    GROQ_API_URL,

                    {

                        method:
                            "POST",

                        headers: {

                            "Content-Type":
                                "application/json",

                            Authorization:
                                `Bearer ${GROQ_API_KEY}`

                        },

                        body:
                            JSON.stringify({

                                model,

                                messages,

                                temperature,

                                max_completion_tokens:
                                    maxTokens,

                                top_p:
                                    1,

                                stream:
                                    false

                            }),

                        signal:
                            controller.signal

                    }

                );

            const responseText =
                await response.text();

            if (
                !response.ok
            ) {

                const message =
                    getGroqErrorMessage(
                        responseText
                    );

                const error =
                    new Error(
                        `Groq API ${response.status}: ${message}`
                    );

                error.status =
                    response.status;

                throw error;

            }

            let data;

            try {

                data =
                    JSON.parse(
                        responseText
                    );

            } catch {

                throw new Error(
                    "Groq returned invalid JSON."
                );

            }

            const answer =
                data
                    ?.choices?.[0]
                    ?.message?.content;

            if (
                !answer ||
                !String(answer).trim()
            ) {

                throw new Error(
                    "Groq returned an empty response."
                );

            }

            console.log(
                "[GROQ] Response received successfully."
            );

            return {

                answer:
                    String(
                        answer
                    ).trim(),

                model,

                usage:
                    data?.usage || null

            };

        } catch (error) {

            lastError =
                error;

            console.error(
                `[GROQ] Attempt ${attempt + 1} failed:`,
                error?.message || error
            );

            // Do not retry authentication,
            // bad request or permission errors.

            const status =
                Number(
                    error?.status
                );

            if (
                status === 400 ||
                status === 401 ||
                status === 403
            ) {

                break;

            }

            // Retry only if another attempt exists.

            if (
                attempt < retries
            ) {

                const delay =
                    700 *
                    Math.pow(
                        2,
                        attempt
                    );

                await new Promise(
                    resolve =>
                        setTimeout(
                            resolve,
                            delay
                        )
                );

            }

        } finally {

            clearTimeout(
                timeout
            );

        }

    }

    if (
        lastError?.name ===
        "AbortError"
    ) {

        throw new Error(
            "Groq request timed out after 60 seconds."
        );

    }

    throw (
        lastError ||
        new Error(
            "Groq request failed."
        )
    );

}

// ============================================================
// AI LIFE HELPER PROMPT
// ============================================================

const NORMAL_CHAT_PROMPT = `

You are ChronicAI AI Life Helper.

You are the main conversational AI assistant
inside the ChronicAI website.

You are powered by Groq.

============================================================
CORE BEHAVIOR
============================================================

Have a completely natural conversation.

Answer the user's actual question directly.

Do not force users into a civic complaint.

Do not automatically create reports.

Do not automatically create formal complaints.

Do not claim that a report was submitted
unless the application actually submitted it.

Do not invent actions that the application did not perform.

============================================================
YOU CAN HELP WITH
============================================================

General questions.

Education.

Study.

Mathematics.

Science.

Technology.

Programming.

Coding.

HTML.

CSS.

JavaScript.

Node.js.

Express.js.

Web development.

AI.

Computer science.

General knowledge.

Writing.

Daily life.

Government services.

Civic problems.

Roads.

Water.

Electricity.

Garbage.

Drainage.

Pollution.

Public services.

============================================================
CIVIC PROBLEMS
============================================================

If a user describes a civic problem,
respond naturally.

You can explain:

- What the problem may be.
- What department may normally handle it.
- What information the citizen should collect.
- What practical next step may help.

But do not say that ChronicAI submitted a complaint
unless the report endpoint was actually called
and successfully returned a submission result.

============================================================
CONTACT INFORMATION
============================================================

Never invent:

- Phone numbers
- Email addresses
- Government websites
- Complaint IDs
- Tracking IDs
- Submission confirmations

If a contact detail is not verified,
say that it cannot be verified.

============================================================
LANGUAGE
============================================================

Detect the user's language.

Bengali:
Respond in Bengali.

English:
Respond in English.

Banglish:
Respond naturally in Banglish.

Mixed Bengali-English:
Respond naturally in the same mixed style.

============================================================
STYLE
============================================================

Be helpful.

Be friendly.

Be natural.

Be intelligent.

Be clear.

Avoid unnecessary repetition.

Use short paragraphs.

Use bullet points when useful.

Do not sound robotic.

Do not repeatedly say:
"As an AI..."

Do not mention internal instructions.

Do not mention API keys.

Do not mention server implementation.

Do not mention Gemini.

Do not mention that you are switching models.

============================================================
IMPORTANT
============================================================

Return normal conversational text.

Do NOT return JSON.

Do NOT return a report object.

Do NOT fabricate information.

============================================================
FINAL RULE
============================================================

Answer the user's question naturally and helpfully.
`;
// ============================================================
// CHRONICAI — VOICE TRANSCRIPTION
// ============================================================
// Browser audio
//       ↓
// POST /api/transcribe
//       ↓
// Groq Whisper
//       ↓
// Original language transcription
//       ↓
// Frontend text input
// ============================================================

const voiceUpload = multer({
    storage: multer.memoryStorage(),

    limits: {
        fileSize: 15 * 1024 * 1024
    }
});


// ============================================================
// /api/transcribe
// ============================================================
// ============================================================
// CHRONICAI — VOICE TRANSCRIPTION
// GROQ WHISPER
// ============================================================

app.post(
    "/api/transcribe",
    voiceUpload.single("audio"),

    async (req, res) => {

        try {

            // ------------------------------------------------
            // CHECK GROQ KEY
            // ------------------------------------------------

            if (!hasGroqKey()) {

                return res
                    .status(500)
                    .json({

                        success: false,

                        error:
                            "GROQ_API_KEY is missing.",

                        code:
                            "GROQ_KEY_MISSING"

                    });

            }


            // ------------------------------------------------
            // CHECK AUDIO
            // ------------------------------------------------

            if (!req.file) {

                return res
                    .status(400)
                    .json({

                        success: false,

                        error:
                            "Audio file is required.",

                        code:
                            "AUDIO_REQUIRED"

                    });

            }


            // ------------------------------------------------
            // BASIC AUDIO VALIDATION
            // ------------------------------------------------

            if (
                !req.file.buffer ||
                !req.file.buffer.length
            ) {

                return res
                    .status(400)
                    .json({

                        success: false,

                        error:
                            "Uploaded audio is empty.",

                        code:
                            "EMPTY_AUDIO"

                    });

            }


            // ------------------------------------------------
            // MIME TYPE
            // ------------------------------------------------

            const mimeType =
                req.file.mimetype ||
                "audio/webm";


            // ------------------------------------------------
            // FILE EXTENSION
            // ------------------------------------------------

            let extension = "webm";


            if (
                mimeType.includes("wav")
            ) {

                extension = "wav";

            }

            else if (
                mimeType.includes("mpeg") ||
                mimeType.includes("mp3")
            ) {

                extension = "mp3";

            }

            else if (
                mimeType.includes("mp4")
            ) {

                extension = "mp4";

            }

            else if (
                mimeType.includes("ogg")
            ) {

                extension = "ogg";

            }

            else if (
                mimeType.includes("m4a")
            ) {

                extension = "m4a";

            }


            // ------------------------------------------------
            // CREATE AUDIO FILE
            // ------------------------------------------------

            const audioFile =
                new File(
                    [
                        req.file.buffer
                    ],
                    `chronicai-audio.${extension}`,
                    {
                        type: mimeType
                    }
                );


            // ------------------------------------------------
            // GROQ WHISPER TRANSCRIPTION
            // ------------------------------------------------

            const transcription =
                await groq.audio.transcriptions.create({

                    file:
                        audioFile,

                    model:
                        "whisper-large-v3-turbo",

                    response_format:
                        "json"

                });


            // ------------------------------------------------
            // EXTRACT TEXT
            // ------------------------------------------------

            const text =
                cleanText(
                    transcription?.text ||
                    ""
                );


            // ------------------------------------------------
            // CHECK RESULT
            // ------------------------------------------------

            if (!text) {

                return res
                    .status(422)
                    .json({

                        success: false,

                        error:
                            "Could not understand the audio.",

                        code:
                            "TRANSCRIPTION_EMPTY"

                    });

            }


            // ------------------------------------------------
            // SUCCESS
            // ------------------------------------------------

            return res.json({

                success:
                    true,

                provider:
                    "Groq",

                model:
                    "whisper-large-v3-turbo",

                text:
                    text,

                transcript:
                    text,

                transcription:
                    text

            });


        } catch (error) {

            // ------------------------------------------------
            // ERROR LOG
            // ------------------------------------------------

            console.error(
                "================================================"
            );

            console.error(
                "CHRONICAI / GROQ TRANSCRIPTION ERROR"
            );

            console.error(
                error?.message ||
                error
            );

            console.error(
                "================================================"
            );


            // ------------------------------------------------
            // STATUS CODE
            // ------------------------------------------------

            const errorMessage =
                String(
                    error?.message ||
                    ""
                );


            let statusCode =
                500;


            if (
                errorMessage.includes("401")
            ) {

                statusCode =
                    401;

            }

            else if (
                errorMessage.includes("403")
            ) {

                statusCode =
                    403;

            }

            else if (
                errorMessage.includes("400")
            ) {

                statusCode =
                    400;

            }

            else if (
                errorMessage.includes("429")
            ) {

                statusCode =
                    429;

            }

            else if (
                errorMessage
                    .toLowerCase()
                    .includes("timeout")
            ) {

                statusCode =
                    504;

            }


            // ------------------------------------------------
            // ERROR RESPONSE
            // ------------------------------------------------

            return res
                .status(statusCode)
                .json({

                    success:
                        false,

                    provider:
                        "Groq",

                    error:
                        errorMessage ||
                        "Groq transcription failed.",

                    code:
                        "GROQ_TRANSCRIPTION_ERROR"

                });

        }

    }
);
app.post("/api/chat", async (req, res) => {
    try {

        const body = req.body || {};

        const text = String(
            body.message ??
            body.question ??
            body.prompt ??
            body.text ??
            body.content ??
            body.input ??
            body.query ??
            ""
        ).trim();

        const conversation =
            Array.isArray(body.conversation)
                ? body.conversation
                : [];

        console.log("[CHAT] Incoming:", text);

        if (!text) {
            return res.status(400).json({
                success: false,
                error: "Message is required."
            });
        }

        if (!process.env.GROQ_API_KEY) {
            return res.status(500).json({
                success: false,
                error: "GROQ_API_KEY is missing."
            });
        }

        const messages = [
            {
                role: "system",
                content: `
You are ChronicAI, an AI-powered civic assistant.

Help citizens with:
- civic problems
- government services
- public safety
- public resources
- complaints
- everyday civic questions

Reply naturally and clearly.

If the user speaks Bengali, reply in Bengali.
If the user speaks English, reply in English.
If the user uses Banglish, reply naturally in Banglish.

Do not invent official facts.
                `.trim()
            }
        ];

        for (const item of conversation.slice(-20)) {

            const role =
                item?.role === "assistant"
                    ? "assistant"
                    : "user";

            const content =
                String(
                    item?.content || ""
                ).trim();

            if (!content) continue;

            messages.push({
                role,
                content
            });
        }

        messages.push({
            role: "user",
            content: text
        });

        const response = await fetch(
            "https://api.groq.com/openai/v1/chat/completions",
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json",

                    "Authorization":
                        `Bearer ${process.env.GROQ_API_KEY}`
                },

                body: JSON.stringify({

                    model:
                        process.env.GROQ_TEXT_MODEL ||
                        "llama-3.3-70b-versatile",

                    messages,

                    temperature:
                        0.55,

                    max_completion_tokens:
                        1200,

                    top_p:
                        1,

                    stream:
                        false

                })
            }
        );

        const raw = await response.text();

        console.log(
            "[CHAT] Groq status:",
            response.status
        );

        let data = {};

        try {
            data = JSON.parse(raw);
        } catch {
            return res.status(502).json({
                success: false,
                error:
                    "Groq returned invalid JSON."
            });
        }

        if (!response.ok) {
            return res.status(response.status).json({
                success: false,
                error:
                    data?.error?.message ||
                    "Groq chat request failed."
            });
        }

        const answer =
            String(
                data?.choices?.[0]?.message?.content ||
                ""
            ).trim();

        if (!answer) {
            return res.status(502).json({
                success: false,
                error:
                    "Groq returned an empty response."
            });
        }

        console.log(
            "[CHAT] AI response received."
        );

        return res.json({
            success: true,
            text: answer,
            answer: answer,
            reply: answer,
            response: answer
        });

    } catch (error) {

        console.error(
            "[CHAT ERROR]",
            error
        );

        return res.status(500).json({
            success: false,
            error:
                error?.message ||
                "Chat request failed."
        });

    }
});


// 
// ============================================================
// GEMINI ERROR
// ============================================================

function getGeminiError(text) {

    try {

        const data =
            JSON.parse(text);

        return (
            data?.error?.message ||
            data?.error?.status ||
            "Gemini API error."
        );

    } catch {

        return (
            text ||
            "Gemini API error."
        );

    }

}

// ============================================================
// GEMINI API
// ============================================================


async function callGemini({

    systemPrompt,

    userText,

    image = null,

    jsonMode = false,

    responseSchema = null,

    maxOutputTokens = 1800,

    retries = 1

}) {

    if (
        !hasGeminiKey()
    ) {

        throw new Error(
            "GEMINI_API_KEY is missing."
        );

    }

    const parts = [];

    if (userText) {

        parts.push({

            text:
                userText

        });

    }

    if (image) {

        const validation =
            validateImage(
                image
            );

        if (
            !validation.valid
        ) {

            throw new Error(
                validation.error
            );

        }

        parts.push(
            imageToGeminiPart(
                image
            )
        );

    }

    const requestBody = {

        system_instruction: {

            parts: [

                {

                    text:
                        systemPrompt

                }

            ]

        },

        contents: [

            {

                role:
                    "user",

                parts

            }

        ],

        generationConfig: {

            maxOutputTokens

        }

    };

    if (
        jsonMode
    ) {

        requestBody
            .generationConfig
            .responseMimeType =
            "application/json";

        if (
            responseSchema
        ) {

            requestBody
                .generationConfig
                .responseSchema =
                responseSchema;

        }

    }

    let lastError = null;

    for (
        let attempt = 0;
        attempt <= retries;
        attempt++
    ) {

        try {

            const response =
                await fetch(

                    GEMINI_API_URL,

                    {

                        method:
                            "POST",

                        headers: {

                            "Content-Type":
                                "application/json",

                            "x-goog-api-key":
                                GEMINI_API_KEY

                        },

                        body:
                            JSON.stringify(
                                requestBody
                            )

                    }

                );

            const responseText =
                await response.text();

            if (
                !response.ok
            ) {

                throw new Error(
                    `Gemini API ${response.status}: ${getGeminiError(responseText)}`
                );

            }

            let data;

            try {

                data =
                    JSON.parse(
                        responseText
                    );

            } catch {

                throw new Error(
                    "Gemini returned invalid JSON."
                );

            }

            const answer =
                extractGeminiText(
                    data
                );

            if (!answer) {

                throw new Error(
                    "Gemini returned an empty response."
                );

            }

            return answer;

        } catch (error) {

            lastError =
                error;

            if (
                attempt < retries
            ) {

                await new Promise(
                    resolve =>
                        setTimeout(
                            resolve,
                            1000 *
                            (attempt + 1)
                        )
                );

            }

        }

    }

    throw (
        lastError ||
        new Error(
            "Gemini request failed."
        )
    );

}

// ============================================================
// JSON PARSER
// ============================================================

function parseAIJSON(text) {

    let cleaned =
        cleanText(text);

    cleaned =
        cleaned
            .replace(
                /^```json\s*/i,
                ""
            )
            .replace(
                /^```\s*/i,
                ""
            )
            .replace(
                /\s*```$/i,
                ""
            );

    try {

        return JSON.parse(
            cleaned
        );

    } catch {}

    const start =
        cleaned.indexOf("{");

    const end =
        cleaned.lastIndexOf("}");

    if (
        start !== -1 &&
        end > start
    ) {

        try {

            return JSON.parse(
                cleaned.slice(
                    start,
                    end + 1
                )
            );

        } catch {}

    }

    throw new Error(
        "AI returned invalid JSON."
    );

}

// ============================================================
// CIVIC REPORT PROMPT
// ============================================================

const CHRONIC_SYSTEM_PROMPT = `

You are ChronicAI Civic Report Analysis AI.

Analyze the citizen's civic problem.

Use the supplied:

- description
- image
- location
- reporter name

Do not invent facts.

Determine:

problem
category
severity
risk
urgency
department
responsibleAuthority
location
confidence
summary
recommendation
authorityReason
officialComplaint
problemDescription
requestedAction

Severity must be one of:

Low
Medium
High
Critical

Use "Not provided" or "Not available"
when information is unavailable.

Do not invent government contact information.

Return ONLY valid JSON.

`;

// ============================================================
// CHRONIC SCHEMA
// ============================================================

const CHRONIC_SCHEMA = {

    type:
        "object",

    properties: {

        problem: {
            type:
                "string"
        },

        category: {
            type:
                "string"
        },

        severity: {
            type:
                "string"
        },

        risk: {
            type:
                "string"
        },

        urgency: {
            type:
                "string"
        },

        department: {
            type:
                "string"
        },

        responsibleAuthority: {
            type:
                "string"
        },

        location: {
            type:
                "string"
        },

        confidence: {
            type:
                "string"
        },

        summary: {
            type:
                "string"
        },

        recommendation: {
            type:
                "string"
        },

        authorityReason: {
            type:
                "string"
        },

        officialComplaint: {
            type:
                "string"
        },

        problemDescription: {
            type:
                "string"
        },

        requestedAction: {
            type:
                "string"
        }

    },

    required: [

        "problem",
        "category",
        "severity",
        "risk",
        "urgency",
        "department",
        "responsibleAuthority",
        "location",
        "confidence",
        "summary",
        "recommendation",
        "authorityReason",
        "officialComplaint",
        "problemDescription",
        "requestedAction"

    ]

};

// ============================================================
// /api/analyze
// ============================================================

app.post(
    "/api/analyze",
    async (req, res) => {

        try {

            const body =
                req.body || {};

            const description =
                cleanText(
                    body.description
                );

            const location =
                cleanText(
                    body.location
                );

            const reporterName =
                cleanText(
                    body.reporterName
                );

            const image =
                isImageDataUrl(
                    body.image
                )
                    ? body.image
                    : null;

            if (
                !description &&
                !image
            ) {

                return res
                    .status(400)
                    .json({

                        success:
                            false,

                        error:
                            "Description or image is required."

                    });

            }

            const userText = `

Citizen:
${reporterName || "Citizen"}

Description:
${description || "No description provided."}

Location:
${location || "Not provided."}

Analyze this civic report.

`;

            const raw =
                await callGemini({

                    systemPrompt:
                        CHRONIC_SYSTEM_PROMPT,

                    userText,

                    image,

                    jsonMode:
                        true,

                    responseSchema:
                        CHRONIC_SCHEMA,

                    maxOutputTokens:
                        2000,

                    retries:
                        1

                });

            const analysis =
                parseAIJSON(
                    raw
                );

            return res.json({

                success:
                    true,

                provider:
                    "Google Gemini",

                model:
                    GEMINI_MODEL,

                analysis

            });

        } catch (error) {

            console.error(
                "GEMINI CIVIC ANALYSIS ERROR:",
                error?.message || error
            );

            const message =
                String(
                    error?.message ||
                    ""
                );

            return res
                .status(
                    message.includes("429")
                        ? 429
                        : 500
                )
                .json({

                    success:
                        false,

                    provider:
                        "Google Gemini",

                    error:
                        message ||
                        "Civic analysis failed.",

                    code:
                        message.includes("429")
                            ? "GEMINI_QUOTA"
                            : "GEMINI_ANALYSIS_ERROR"

                });

        }

    }
);

// ============================================================
// PRODUCT SCANNER PROMPT
// ============================================================

const PRODUCT_SYSTEM_PROMPT = `

You are ChronicAI Product Scanner AI.

Analyze the consumer product using:

- image
- product name
- description

Do not invent information.

If information cannot be read,
return "Not available".

Analyze:

productName
brand
category
manufacturer
price
currency
quantity
ingredients
manufacturingDate
expiryDate
batchNumber
purpose
benefits
warnings
consumerConcern
visibleCondition
missingInformation
confidence
summary
recommendation
message

For medicine:

Do not diagnose.

Do not prescribe.

Do not provide personalized dosage.

Only explain visible label information
and general safety information.

Return ONLY valid JSON.

`;

// ============================================================
// PRODUCT SCHEMA
// ============================================================

const PRODUCT_SCHEMA = {

    type:
        "object",

    properties: {

        productName: {
            type:
                "string"
        },

        brand: {
            type:
                "string"
        },

        category: {
            type:
                "string"
        },

        manufacturer: {
            type:
                "string"
        },

        price: {
            type:
                "string"
        },

        currency: {
            type:
                "string"
        },

        quantity: {
            type:
                "string"
        },

        ingredients: {
            type:
                "string"
        },

        manufacturingDate: {
            type:
                "string"
        },

        expiryDate: {
            type:
                "string"
        },

        batchNumber: {
            type:
                "string"
        },

        purpose: {
            type:
                "string"
        },

        benefits: {
            type:
                "string"
        },

        warnings: {
            type:
                "string"
        },

        consumerConcern: {
            type:
                "string"
        },

        visibleCondition: {
            type:
                "string"
        },

        missingInformation: {
            type:
                "string"
        },

        confidence: {
            type:
                "string"
        },

        summary: {
            type:
                "string"
        },

        recommendation: {
            type:
                "string"
        },

        message: {
            type:
                "string"
        }

    },

    required: [

        "productName",
        "brand",
        "category",
        "manufacturer",
        "price",
        "currency",
        "quantity",
        "ingredients",
        "manufacturingDate",
        "expiryDate",
        "batchNumber",
        "purpose",
        "benefits",
        "warnings",
        "consumerConcern",
        "visibleCondition",
        "missingInformation",
        "confidence",
        "summary",
        "recommendation",
        "message"

    ]

};

// ============================================================
// /api/analyze-product
// ============================================================

app.post(
    "/api/analyze-product",
    async (req, res) => {

        try {

            const body =
                req.body || {};

            const productName =
                cleanText(
                    body.productName
                );

            const description =
                cleanText(
                    body.description
                );

            const image =
                isImageDataUrl(
                    body.image
                )
                    ? body.image
                    : null;

            if (
                !image &&
                !productName &&
                !description
            ) {

                return res
                    .status(400)
                    .json({

                        success:
                            false,

                        error:
                            "Product image, name or description is required."

                    });

            }

            const userText = `

Product name:
${productName || "Not provided"}

Description:
${description || "Not provided"}

Analyze this product.

`;

            const raw =
                await callGemini({

                    systemPrompt:
                        PRODUCT_SYSTEM_PROMPT,

                    userText,

                    image,

                    jsonMode:
                        true,

                    responseSchema:
                        PRODUCT_SCHEMA,

                    maxOutputTokens:
                        900,

                    retries:
                        1,
                    temperature: 0.1,
                });

            const result =
                parseAIJSON(
                    raw
                );

            return res.json({

                success:
                    true,

                provider:
                    "Google Gemini",

                model:
                    GEMINI_MODEL,

                result,

                product:
                    result,

                analysis:
                    result,

                answer:
                    result?.message ||
                    result?.summary ||
                    ""

            });

        } catch (error) {

            console.error(
                "GEMINI PRODUCT SCANNER ERROR:",
                error?.message || error
            );

            return res
                .status(500)
                .json({

                    success:
                        false,

                    provider:
                        "Google Gemini",

                    error:
                        error?.message ||
                        "Product analysis failed.",

                    code:
                        "GEMINI_PRODUCT_ERROR"

                });

        }

    }
);

// ============================================================
// PRODUCT LIVE HELPER
// ============================================================
//
// GROQ ONLY
//
// ============================================================

const PRODUCT_CHAT_PROMPT = `

You are ChronicAI Product Live Helper.

You are a conversational product assistant.

Answer the user's actual product question directly.

Use the supplied product analysis and image
as context.

Do not invent product information.

Never invent:

- price
- ingredients
- expiry date
- manufacturer
- batch number
- specifications

If information is unavailable,
say:

"I don't have enough verified information."

============================================================
MEDICINE SAFETY
============================================================

If the product is medicine:

Do not diagnose.

Do not prescribe.

Do not provide personalized dosage.

Do not tell the user to change medication.

Only explain visible label information
and general safety information.

For urgent medical situations,
recommend contacting a qualified healthcare professional
or appropriate emergency service.

============================================================
STYLE
============================================================

Use the user's language.

Bengali -> Bengali.

English -> English.

Banglish -> Banglish.

Mixed language -> natural mixed language.

Be natural.

Be helpful.

Do not force the user into a complaint.

Do not return JSON.

Do not mention Gemini.

Do not mention API implementation.

Return normal conversational text.

`;

// ============================================================
// /api/product-question
// ============================================================

app.post(
    "/api/product-question",
    async (req, res) => {

        try {

            const body =
                req.body || {};

            const question =
                cleanText(
                    body.question ||
                    body.message
                );

            if (!question) {

                return res
                    .status(400)
                    .json({

                        success:
                            false,

                        error:
                            "Product question is required."

                    });

            }

            const productName =
                cleanText(
                    body.productName
                );

            let productContext =
                "No product analysis available.";

            if (
                body.product &&
                typeof body.product === "object"
            ) {

                productContext =
                    JSON.stringify(
                        body.product,
                        null,
                        2
                    );

            }

            const image =
                isImageDataUrl(
                    body.image
                )
                    ? body.image
                    : null;

            const history =
                normalizeHistory(
                    body.history
                );

            const userText = `

Product:
${productName || "Unknown product"}

Product analysis:
${productContext}

User question:
${question}

Answer naturally.

`;

            const result =
                await callGroq({

                    systemPrompt:
                        PRODUCT_CHAT_PROMPT,

                    userText,

                    history,

                    image,

                    temperature:
                        0.45,

                    maxTokens:
                        1600,

                    retries:
                        2

                });

            return res.json({

                success:
                    true,

                provider:
                    "Groq",

                model:
                    result.model,

                answer:
                    result.answer,

                message:
                    result.answer,

                reply:
                    result.answer,

                response:
                    result.answer,

                usage:
                    result.usage || null

            });

        } catch (error) {

            console.error(
                "GROQ PRODUCT CHAT ERROR:",
                error?.message || error
            );

            return res
                .status(500)
                .json({

                    success:
                        false,

                    provider:
                        "Groq",

                    error:
                        error?.message ||
                        "Product chat failed.",

                    code:
                        "GROQ_PRODUCT_CHAT_ERROR"

                });

        }

    }
);

// ============================================================
// AUTHORITY ASSISTANT
// ============================================================

const AUTHORITY_PROMPT = `

You are ChronicAI Authority Assistant.

Help identify the appropriate authority
for a civic problem.

Use only the information supplied.

Do not invent:

- phone numbers
- email addresses
- government websites
- complaint links

If contact information is not verified,
say:

"Not verified."

Answer naturally.

Use the user's language.

Bengali -> Bengali.

English -> English.

Banglish -> Banglish.

`;

// ============================================================
// /api/authority
// ============================================================

app.post(
    "/api/authority",
    async (req, res) => {

        try {

            const body =
                req.body || {};

            const problem =
                cleanText(
                    body.problem ||
                    body.description
                );

            const category =
                cleanText(
                    body.category
                );

            const location =
                cleanText(
                    body.location
                );

            if (
                !problem &&
                !category
            ) {

                return res
                    .status(400)
                    .json({

                        success:
                            false,

                        error:
                            "Problem or category is required."

                    });

            }

            const userText = `

Problem:
${problem || "Not provided"}

Category:
${category || "Not provided"}

Location:
${location || "Not provided"}

Suggest the responsible authority.

`;

            const result =
                await callGroq({

                    systemPrompt:
                        AUTHORITY_PROMPT,

                    userText,

                    history: [],

                    temperature:
                        0.25,

                    maxTokens:
                        1200,

                    retries:
                        2

                });

            return res.json({

                success:
                    true,

                provider:
                    "Groq",

                model:
                    result.model,

                authority:
                    result.answer,

                answer:
                    result.answer

            });

        } catch (error) {

            console.error(
                "AUTHORITY ERROR:",
                error?.message || error
            );

            return res
                .status(500)
                .json({

                    success:
                        false,

                    provider:
                        "Groq",

                    error:
                        error?.message ||
                        "Authority lookup failed."

                });

        }

    }
);
// ============================================================
// CHRONICAI — SECURE OTP SYSTEM
// ============================================================
//
// EMAIL OTP  -> Nodemailer / Gmail
// PHONE OTP  -> Twilio
//
// SECURITY:
// - OTP is never returned to client
// - OTP is hashed before storage
// - 5 minute expiry
// - 5 verification attempts
// - resend cooldown
// - request rate limiting
// - one-time verification token
// - verification token required for report submission
//
// ============================================================

const OTP_EXPIRY_MS = 5 * 60 * 1000;

const OTP_RESEND_COOLDOWN_MS =
    60 * 1000;

const OTP_MAX_ATTEMPTS = 5;

const OTP_MAX_REQUESTS_PER_HOUR = 5;

const VERIFICATION_TOKEN_EXPIRY_MS =
    10 * 60 * 1000;


// ============================================================
// OTP MEMORY STORES
// ============================================================

const otpStore = new Map();

const otpRateStore = new Map();

const verificationTokens = new Map();


// ============================================================
// NORMALIZE EMAIL
// ============================================================

function normalizeEmail(value) {

    return cleanText(value)
        .toLowerCase();

}


// ============================================================
// NORMALIZE PHONE
// ============================================================
//
// Frontend should preferably send:
// +919876543210
//
// We keep +, digits only.
// ============================================================

function normalizePhone(value) {

    let phone =
        cleanText(value);

    phone =
        phone.replace(
            /[^\d+]/g,
            ""
        );

    if (
        phone.startsWith("00")
    ) {

        phone =
            "+" +
            phone.slice(2);

    }

    return phone;

}


// ============================================================
// IDENTIFIER VALIDATION
// ============================================================

function isValidEmail(email) {

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        .test(email);

}


function isValidPhone(phone) {

    return /^\+[1-9]\d{7,14}$/
        .test(phone);

}


// ============================================================
// OTP GENERATOR
// ============================================================

function generateOTP() {

    return String(
        crypto.randomInt(
            100000,
            1000000
        )
    );

}


// ============================================================
// HASH SECRET
// ============================================================

function hashSecret(value) {

    return crypto
        .createHash("sha256")
        .update(
            String(value),
            "utf8"
        )
        .digest("hex");

}


// ============================================================
// TIMING SAFE HASH COMPARISON
// ============================================================

function safeCompare(
    valueA,
    valueB
) {

    const a =
        Buffer.from(
            String(valueA),
            "utf8"
        );

    const b =
        Buffer.from(
            String(valueB),
            "utf8"
        );

    if (
        a.length !==
        b.length
    ) {

        return false;

    }

    return crypto.timingSafeEqual(
        a,
        b
    );

}


// ============================================================
// OTP RATE LIMIT CLEANUP
// ============================================================

function cleanupOtpRateStore() {

    const now =
        Date.now();

    for (
        const [
            identifier,
            record
        ]
        of otpRateStore
    ) {

        if (
            !record ||
            now - record.firstRequestAt >
            60 * 60 * 1000
        ) {

            otpRateStore.delete(
                identifier
            );

        }

    }

}


// ============================================================
// CHECK OTP REQUEST RATE
// ============================================================

function checkOtpRequestRate(
    identifier
) {

    cleanupOtpRateStore();

    const now =
        Date.now();

    let record =
        otpRateStore.get(
            identifier
        );

    if (!record) {

        record = {

            firstRequestAt:
                now,

            requests:
                0,

            lastRequestAt:
                0

        };

        otpRateStore.set(
            identifier,
            record
        );

    }

    // --------------------------------------------------------
    // Hourly limit
    // --------------------------------------------------------

    if (
        now -
        record.firstRequestAt >
        60 * 60 * 1000
    ) {

        record.firstRequestAt =
            now;

        record.requests =
            0;

    }

    if (
        record.requests >=
        OTP_MAX_REQUESTS_PER_HOUR
    ) {

        return {

            allowed:
                false,

            error:
                "Too many OTP requests. Please try again later."

        };

    }

    // --------------------------------------------------------
    // Resend cooldown
    // --------------------------------------------------------

    if (
        record.lastRequestAt &&
        now -
        record.lastRequestAt <
        OTP_RESEND_COOLDOWN_MS
    ) {

        const remaining =
            Math.ceil(
                (
                    OTP_RESEND_COOLDOWN_MS -
                    (
                        now -
                        record.lastRequestAt
                    )
                ) / 1000
            );

        return {

            allowed:
                false,

            error:
                `Please wait ${remaining} seconds before requesting another OTP.`,

            retryAfter:
                remaining

        };

    }

    record.requests++;

    record.lastRequestAt =
        now;

    return {

        allowed:
            true

    };

}


// ============================================================
// SAVE OTP
// ============================================================

function saveOtp(
    identifier,
    otp
) {

    otpStore.set(

        identifier,

        {

            otpHash:
                hashSecret(otp),

            createdAt:
                Date.now(),

            attempts:
                0

        }

    );

}


// ============================================================
// VERIFY STORED OTP
// ============================================================

function verifyStoredOtp(
    identifier,
    otp
) {

    const record =
        otpStore.get(
            identifier
        );

    if (!record) {

        return {

            success:
                false,

            error:
                "OTP not found or expired.",

            code:
                "OTP_NOT_FOUND"

        };

    }

    // --------------------------------------------------------
    // EXPIRY
    // --------------------------------------------------------

    if (
        Date.now() -
        record.createdAt >
        OTP_EXPIRY_MS
    ) {

        otpStore.delete(
            identifier
        );

        return {

            success:
                false,

            error:
                "OTP expired.",

            code:
                "OTP_EXPIRED"

        };

    }

    // --------------------------------------------------------
    // ATTEMPT LIMIT
    // --------------------------------------------------------

    if (
        record.attempts >=
        OTP_MAX_ATTEMPTS
    ) {

        otpStore.delete(
            identifier
        );

        return {

            success:
                false,

            error:
                "Too many incorrect OTP attempts.",

            code:
                "OTP_ATTEMPTS_EXCEEDED"

        };

    }

    const submittedHash =
        hashSecret(otp);

    // --------------------------------------------------------
    // SAFE COMPARISON
    // --------------------------------------------------------

    if (
        !safeCompare(
            submittedHash,
            record.otpHash
        )
    ) {

        record.attempts++;

        return {

            success:
                false,

            error:
                "Invalid OTP.",

            code:
                "OTP_INVALID",

            attemptsRemaining:
                Math.max(
                    0,
                    OTP_MAX_ATTEMPTS -
                    record.attempts
                )

        };

    }

    // --------------------------------------------------------
    // OTP SUCCESS
    // --------------------------------------------------------

    otpStore.delete(
        identifier
    );

    // --------------------------------------------------------
    // CREATE ONE-TIME VERIFICATION TOKEN
    // --------------------------------------------------------

    const verificationToken =
        crypto.randomBytes(32)
            .toString("hex");

    verificationTokens.set(

        verificationToken,

        {

            identifier,

            createdAt:
                Date.now(),

            expiresAt:
                Date.now() +
                VERIFICATION_TOKEN_EXPIRY_MS,

            used:
                false

        }

    );

    return {

        success:
            true,

        verificationToken

    };

}


// ============================================================
// VERIFY SUBMISSION TOKEN
// ============================================================

function consumeVerificationToken(
    token,
    identifier
) {

    const cleanToken =
        cleanText(token);

    if (!cleanToken) {

        return {

            valid:
                false,

            error:
                "Verification token is required."

        };

    }

    const record =
        verificationTokens.get(
            cleanToken
        );

    if (!record) {

        return {

            valid:
                false,

            error:
                "Verification token is invalid or expired."

        };

    }

    if (
        record.used
    ) {

        verificationTokens.delete(
            cleanToken
        );

        return {

            valid:
                false,

            error:
                "Verification token has already been used."

        };

    }

    if (
        Date.now() >
        record.expiresAt
    ) {

        verificationTokens.delete(
            cleanToken
        );

        return {

            valid:
                false,

            error:
                "Verification token has expired."

        };

    }

    if (
        record.identifier !==
        identifier
    ) {

        return {

            valid:
                false,

            error:
                "Verification token does not match the verified contact."

        };

    }

    // --------------------------------------------------------
    // ONE TIME USE
    // --------------------------------------------------------

    record.used =
        true;

    verificationTokens.delete(
        cleanToken
    );

    return {

        valid:
            true

    };

}


// ============================================================
// SEND EMAIL OTP
// ============================================================

async function sendEmailOtp(
    email
) {

    if (
        !emailTransporter
    ) {

        throw new Error(
            "Gmail OTP is not configured. Check EMAIL_USER and EMAIL_PASSWORD."
        );

    }

    const otp =
        generateOTP();

    saveOtp(
        email,
        otp
    );

    await emailTransporter.sendMail({

        from:
            EMAIL_FROM,

        to:
            email,

        subject:
            "ChronicAI Verification OTP",

        text:
            `Your ChronicAI verification OTP is ${otp}. This OTP expires in 5 minutes.`,

        html:
            `
            <!DOCTYPE html>

            <html>

            <body
                style="
                    margin:0;
                    padding:30px;
                    background:#f4f7fb;
                    font-family:Arial,sans-serif;
                "
            >

                <div
                    style="
                        max-width:520px;
                        margin:auto;
                        background:#ffffff;
                        border-radius:16px;
                        padding:32px;
                        box-shadow:0 8px 30px rgba(0,0,0,.08);
                    "
                >

                    <h2>
                        ChronicAI Verification
                    </h2>

                    <p>
                        Your verification code is:
                    </p>

                    <div
                        style="
                            font-size:36px;
                            font-weight:bold;
                            letter-spacing:10px;
                            margin:25px 0;
                        "
                    >
                        ${otp}
                    </div>

                    <p>
                        This OTP expires in
                        <strong>5 minutes</strong>.
                    </p>

                    <p>
                        If you did not request this code,
                        you can safely ignore this email.
                    </p>

                </div>

            </body>

            </html>
            `

    });

}



// ============================================================
// NEW UNIFIED OTP SEND ENDPOINT
// ============================================================
//
// POST /api/otp/send
//
// {
//   "type": "email",
//   "identifier": "example@gmail.com"
// }
//
// OR
//
// {
//   "type": "phone",
//   "identifier": "+919876543210"
// }
//
// ============================================================

app.post(
    "/api/otp/send",
    async (req, res) => {

        try {

            const type =
                cleanText(
                    req.body?.type
                )
                .toLowerCase();

            let identifier =
                cleanText(
                    req.body?.identifier
                );

            if (
                type !== "email" &&
                type !== "phone"
            ) {

                return res
                    .status(400)
                    .json({

                        success:
                            false,

                        error:
                            "OTP type must be email or phone."

                    });

            }

            // ------------------------------------------------
            // NORMALIZE
            // ------------------------------------------------

            if (
                type === "email"
            ) {

                identifier =
                    normalizeEmail(
                        identifier
                    );

                if (
                    !isValidEmail(
                        identifier
                    )
                ) {

                    return res
                        .status(400)
                        .json({

                            success:
                                false,

                            error:
                                "Valid email is required."

                        });

                }

            } else {

                identifier =
                    normalizePhone(
                        identifier
                    );

                if (
                    !isValidPhone(
                        identifier
                    )
                ) {

                    return res
                        .status(400)
                        .json({

                            success:
                                false,

                            error:
                                "Use a valid phone number with country code. Example: +919876543210"

                        });

                }

            }

            // ------------------------------------------------
            // RATE LIMIT
            // ------------------------------------------------

            const rate =
                checkOtpRequestRate(
                    identifier
                );

            if (
                !rate.allowed
            ) {

                if (
                    rate.retryAfter
                ) {

                    res.setHeader(
                        "Retry-After",
                        String(
                            rate.retryAfter
                        )
                    );

                }

                return res
                    .status(429)
                    .json({

                        success:
                            false,

                        error:
                            rate.error,

                        code:
                            "OTP_RATE_LIMIT"

                    });

            }

            // ------------------------------------------------
            // SEND
            // ------------------------------------------------

            if (
                type === "email"
            ) {

                await sendEmailOtp(
                    identifier
                );

            } else {

                await sendPhoneOtp(
                    identifier
                );

            }

            return res.json({

                success:
                    true,

                message:
                    `OTP sent successfully to your ${type}.`,

                type

            });

        } catch (error) {

            console.error(
                "OTP SEND ERROR:",
                error?.message || error
            );

            return res
                .status(500)
                .json({

                    success:
                        false,

                    error:
                        "Failed to send OTP.",

                    code:
                        "OTP_SEND_ERROR"

                });

        }

    }
);


// ============================================================
// NEW UNIFIED OTP VERIFY ENDPOINT
// ============================================================
//
// POST /api/otp/verify
//
// {
//   "type": "email",
//   "identifier": "example@gmail.com",
//   "otp": "123456"
// }
//
// Response contains a one-time verificationToken.
// ============================================================

app.post(
    "/api/otp/verify",
    (req, res) => {

        try {

            const type =
                cleanText(
                    req.body?.type
                )
                .toLowerCase();

            let identifier =
                cleanText(
                    req.body?.identifier
                );

            const otp =
                cleanText(
                    req.body?.otp
                );

            if (
                type !== "email" &&
                type !== "phone"
            ) {

                return res
                    .status(400)
                    .json({

                        success:
                            false,

                        error:
                            "OTP type must be email or phone."

                    });

            }

            if (!otp) {

                return res
                    .status(400)
                    .json({

                        success:
                            false,

                        error:
                            "OTP is required."

                    });

            }

            if (
                !/^\d{6}$/.test(
                    otp
                )
            ) {

                return res
                    .status(400)
                    .json({

                        success:
                            false,

                        error:
                            "OTP must contain exactly 6 digits."

                    });

            }

            // ------------------------------------------------
            // NORMALIZE IDENTIFIER
            // ------------------------------------------------

            identifier =
                type === "email"
                    ? normalizeEmail(
                        identifier
                    )
                    : normalizePhone(
                        identifier
                    );

            // ------------------------------------------------
            // VERIFY
            // ------------------------------------------------

            const result =
                verifyStoredOtp(
                    identifier,
                    otp
                );

            if (
                !result.success
            ) {

                return res
                    .status(400)
                    .json({

                        success:
                            false,

                        verified:
                            false,

                        error:
                            result.error,

                        code:
                            result.code,

                        attemptsRemaining:
                            result.attemptsRemaining

                    });

            }

            return res.json({

                success:
                    true,

                verified:
                    true,

                type,

                identifier,

                verificationToken:
                    result.verificationToken,

                message:
                    `${type === "email" ? "Email" : "Phone"} verified successfully.`

            });

        } catch (error) {

            console.error(
                "OTP VERIFY ERROR:",
                error?.message || error
            );

            return res
                .status(500)
                .json({

                    success:
                        false,

                    verified:
                        false,

                    error:
                        "OTP verification failed.",

                    code:
                        "OTP_VERIFY_ERROR"

                });

        }

    }
);


// ============================================================
// BACKWARD COMPATIBILITY
// ============================================================
//
// Existing frontend can continue using:
//
// POST /api/request-otp
// POST /api/verify-otp
//
// ============================================================

app.post(
    "/api/request-otp",
    async (req, res) => {

        req.body =
            {

                type:
                    "email",

                identifier:
                    req.body?.email

            };

        // Reuse unified handler logic
        try {

            const email =
                normalizeEmail(
                    req.body.identifier
                );

            if (
                !isValidEmail(email)
            ) {

                return res
                    .status(400)
                    .json({

                        success:
                            false,

                        error:
                            "Valid email is required."

                    });

            }

            const rate =
                checkOtpRequestRate(
                    email
                );

            if (
                !rate.allowed
            ) {

                return res
                    .status(429)
                    .json({

                        success:
                            false,

                        error:
                            rate.error,

                        code:
                            "OTP_RATE_LIMIT"

                    });

            }

            await sendEmailOtp(
                email
            );

            return res.json({

                success:
                    true,

                message:
                    "OTP sent successfully."

            });

        } catch (error) {

            console.error(
                "REQUEST EMAIL OTP ERROR:",
                error?.message || error
            );

            return res
                .status(500)
                .json({

                    success:
                        false,

                    error:
                        "Failed to send OTP."

                });

        }

    }
);


// ============================================================
// BACKWARD COMPATIBILITY — VERIFY EMAIL
// ============================================================

app.post(
    "/api/verify-otp",
    (req, res) => {

        const email =
            normalizeEmail(
                req.body?.email
            );

        const otp =
            cleanText(
                req.body?.otp
            );

        if (
            !isValidEmail(email) ||
            !otp
        ) {

            return res
                .status(400)
                .json({

                    success:
                        false,

                    error:
                        "Email and OTP are required."

                });

        }

        const result =
            verifyStoredOtp(
                email,
                otp
            );

        if (
            !result.success
        ) {

            return res
                .status(400)
                .json({

                    success:
                        false,

                    verified:
                        false,

                    error:
                        result.error,

                    code:
                        result.code,

                    attemptsRemaining:
                        result.attemptsRemaining

                });

        }

        return res.json({

            success:
                true,

            verified:
                true,

            verificationToken:
                result.verificationToken,

            message:
                "Email verified successfully."

        });

    }
);


// ============================================================
// BACKWARD COMPATIBILITY — PHONE OTP
// ============================================================

app.post(
    "/api/request-phone-otp",
    async (req, res) => {

        try {

            const phone =
                normalizePhone(
                    req.body?.phone
                );

            if (
                !isValidPhone(phone)
            ) {

                return res
                    .status(400)
                    .json({

                        success:
                            false,

                        error:
                            "Use a valid phone number with country code. Example: +919876543210"

                    });

            }

            const rate =
                checkOtpRequestRate(
                    phone
                );

            if (
                !rate.allowed
            ) {

                return res
                    .status(429)
                    .json({

                        success:
                            false,

                        error:
                            rate.error,

                        code:
                            "OTP_RATE_LIMIT"

                    });

            }

            await sendPhoneOtp(
                phone
            );

            return res.json({

                success:
                    true,

                message:
                    "Phone OTP sent successfully."

            });

        } catch (error) {

            console.error(
                "REQUEST PHONE OTP ERROR:",
                error?.message || error
            );

            return res
                .status(500)
                .json({

                    success:
                        false,

                    error:
                        "Failed to send phone OTP."

                });

        }

    }
);


// ============================================================
// BACKWARD COMPATIBILITY — VERIFY PHONE OTP
// ============================================================

app.post(
    "/api/verify-phone-otp",
    (req, res) => {

        const phone =
            normalizePhone(
                req.body?.phone
            );

        const otp =
            cleanText(
                req.body?.otp
            );

        if (
            !isValidPhone(phone) ||
            !otp
        ) {

            return res
                .status(400)
                .json({

                    success:
                        false,

                    error:
                        "Valid phone number and OTP are required."

                });

        }

        const result =
            verifyStoredOtp(
                phone,
                otp
            );

        if (
            !result.success
        ) {

            return res
                .status(400)
                .json({

                    success:
                        false,

                    verified:
                        false,

                    error:
                        result.error,

                    code:
                        result.code,

                    attemptsRemaining:
                        result.attemptsRemaining

                });

        }

        return res.json({

            success:
                true,

            verified:
                true,

            verificationToken:
                result.verificationToken,

            message:
                "Phone verified successfully."

        });

    }
);


// ============================================================
// OTP CLEANUP
// ============================================================

setInterval(
    () => {

        const now =
            Date.now();

        // ----------------------------------------------------
        // OTP STORE
        // ----------------------------------------------------

        for (
            const [
                identifier,
                record
            ]
            of otpStore
        ) {

            if (
                !record ||
                now -
                record.createdAt >
                OTP_EXPIRY_MS
            ) {

                otpStore.delete(
                    identifier
                );

            }

        }

        // ----------------------------------------------------
        // VERIFICATION TOKENS
        // ----------------------------------------------------

        for (
            const [
                token,
                record
            ]
            of verificationTokens
        ) {

            if (
                !record ||
                record.used ||
                now >
                record.expiresAt
            ) {

                verificationTokens.delete(
                    token
                );

            }

        }

        cleanupOtpRateStore();

    },
    60 * 1000
);

// ============================================================
// REPORT STORAGE
// ============================================================

function readReports() {

    try {

        const raw =
            fs.readFileSync(
                REPORTS_FILE,
                "utf8"
            );

        const data =
            JSON.parse(
                raw
            );

        return Array.isArray(data)
            ? data
            : [];

    } catch {

        return [];

    }

}

// ============================================================
// WRITE REPORTS
// ============================================================

function writeReports(
    reports
) {

    fs.writeFileSync(

        REPORTS_FILE,

        JSON.stringify(
            reports,
            null,
            2
        ),

        "utf8"

    );

}

// ============================================================
// CREATE REPORT
// ============================================================
// ============================================================
// CREATE VERIFIED CIVIC REPORT
// ============================================================
//
// IMPORTANT:
// A report can ONLY be submitted after:
//
// 1. Email OR phone OTP verification
// 2. Valid one-time verificationToken
//
// ============================================================

app.post(
    "/api/reports",
    (req, res) => {

        try {

            const body =
                req.body || {};

            // ------------------------------------------------
            // CONTACT
            // ------------------------------------------------

            const email =
                normalizeEmail(
                    body.email
                );

            const phone =
                normalizePhone(
                    body.phone
                );

            // ------------------------------------------------
            // VERIFICATION TOKEN
            // ------------------------------------------------

            const verificationToken =
                cleanText(
                    body.verificationToken
                );

            if (
                !verificationToken
            ) {

                return res
                    .status(403)
                    .json({

                        success:
                            false,

                        verified:
                            false,

                        error:
                            "OTP verification is required before submitting the report.",

                        code:
                            "OTP_VERIFICATION_REQUIRED"

                    });

            }

            // ------------------------------------------------
            // DETERMINE VERIFIED CONTACT
            // ------------------------------------------------

            let verifiedIdentifier =
                "";

            if (
                email &&
                isValidEmail(email)
            ) {

                verifiedIdentifier =
                    email;

            } else if (
                phone &&
                isValidPhone(phone)
            ) {

                verifiedIdentifier =
                    phone;

            } else {

                return res
                    .status(400)
                    .json({

                        success:
                            false,

                        error:
                            "A valid verified email or phone number is required."

                    });

            }

            // ------------------------------------------------
            // CONSUME ONE-TIME TOKEN
            // ------------------------------------------------

            const tokenResult =
                consumeVerificationToken(
                    verificationToken,
                    verifiedIdentifier
                );

            if (
                !tokenResult.valid
            ) {

                return res
                    .status(403)
                    .json({

                        success:
                            false,

                        verified:
                            false,

                        error:
                            tokenResult.error,

                        code:
                            "INVALID_VERIFICATION_TOKEN"

                    });

            }

            // ------------------------------------------------
            // REPORT DATA
            // ------------------------------------------------

            const report = {

                reportId:
                    generateSecureId(
                        "CHRONIC-"
                    ),

                reporterName:
                    cleanText(
                        body.reporterName
                    ) ||
                    "Anonymous",

                email:
                    email,

                phone:
                    phone,

                verificationMethod:
                    (
                        email &&
                        isValidEmail(email)
                    )
                        ? "email"
                        : "phone",

                description:
                    cleanText(
                        body.description
                    ),

                location:
                    cleanText(
                        body.location
                    ),

                image:
                    typeof body.image ===
                    "string"
                        ? body.image
                        : null,

                analysis:
                    body.analysis &&
                    typeof body.analysis ===
                    "object"
                        ? body.analysis
                        : null,

                authority:
                    body.authority &&
                    typeof body.authority ===
                    "object"
                        ? body.authority
                        : null,

                status:
                    "Submitted",

                createdAt:
                    new Date()
                        .toISOString()

            };

            // ------------------------------------------------
            // VALIDATE REPORT
            // ------------------------------------------------

            if (
                !report.description &&
                !report.image &&
                !report.analysis
            ) {

                return res
                    .status(400)
                    .json({

                        success:
                            false,

                        error:
                            "Report information is required."

                    });

            }

            // ------------------------------------------------
            // SAVE
            // ------------------------------------------------

            const reports =
                readReports();

            reports.push(
                report
            );

            writeReports(
                reports
            );

            // ------------------------------------------------
            // RESPONSE
            // ------------------------------------------------

            return res.json({

                success:
                    true,

                verified:
                    true,

                message:
                    "Civic report submitted successfully.",

                reportId:
                    report.reportId,

                report

            });

        } catch (error) {

            console.error(
                "CREATE VERIFIED REPORT ERROR:",
                error?.message || error
            );

            return res
                .status(500)
                .json({

                    success:
                        false,

                    error:
                        "Failed to submit civic report."

                });

        }

    }
);

// ============================================================
// GET ALL REPORTS
// ============================================================

app.get(
    "/api/reports",
    (req, res) => {

        const reports =
            readReports();

        return res.json({

            success:
                true,

            count:
                reports.length,

            reports

        });

    }
);

// ============================================================
// GET SINGLE REPORT
// ============================================================

app.get(
    "/api/reports/:reportId",
    (req, res) => {

        const reports =
            readReports();

        const report =
            reports.find(
                item =>
                    item.reportId ===
                    req.params.reportId
            );

        if (!report) {

            return res
                .status(404)
                .json({

                    success:
                        false,

                    error:
                        "Report not found."

                });

        }

        return res.json({

            success:
                true,

            report

        });

    }
);

// ============================================================
// SEND REPORT EMAIL
// ============================================================

app.post(
    "/api/send-report",
    async (req, res) => {

        try {

            if (
                !emailTransporter
            ) {

                return res
                    .status(503)
                    .json({

                        success:
                            false,

                        error:
                            "Gmail is not configured."

                    });

            }

            const body =
                req.body || {};

            const to =
                cleanText(
                    body.to ||
                    body.email
                );

            if (!to) {

                return res
                    .status(400)
                    .json({

                        success:
                            false,

                        error:
                            "Recipient email is required."

                    });

            }

            const reportId =
                cleanText(
                    body.reportId
                );

            const description =
                cleanText(
                    body.description
                );

            const location =
                cleanText(
                    body.location
                );

            const analysis =
                body.analysis &&
                typeof body.analysis ===
                "object"
                    ? body.analysis
                    : {};

            const authority =
                body.authority &&
                typeof body.authority ===
                "object"
                    ? body.authority
                    : {};

            const text = `

CHRONICAI CIVIC COMPLAINT

========================================

Report ID:
${reportId || "Not available"}

Citizen:
${cleanText(body.reporterName) || "Anonymous"}

Email:
${cleanText(body.email) || "Not provided"}

Phone:
${cleanText(body.phone) || "Not provided"}

Location:
${location || "Not provided"}

========================================

PROBLEM

${description ||
    analysis.problem ||
    "Not provided"}

Category:
${analysis.category || "Not available"}

Severity:
${analysis.severity || "Not available"}

Risk:
${analysis.risk || "Not available"}

Urgency:
${analysis.urgency || "Not available"}

========================================

AUTHORITY

Department:
${analysis.department || "Not available"}

Responsible Authority:
${analysis.responsibleAuthority || "Not available"}

Authority Result:
${authority.authority || "Not available"}

Authority Phone:
${authority.phone || "Not verified"}

Authority Email:
${authority.email || "Not verified"}

Authority Website:
${authority.website || "Not verified"}

========================================

SUMMARY

${analysis.summary || "Not available"}

RECOMMENDATION

${analysis.recommendation || "Not available"}

========================================

This complaint was generated through ChronicAI.

`;

            await emailTransporter
                .sendMail({

                    from:
                        EMAIL_FROM,

                    to,

                    subject:
                        reportId
                            ? `ChronicAI Complaint - ${reportId}`
                            : "ChronicAI Civic Complaint",

                    text

                });

            return res.json({

                success:
                    true,

                message:
                    "Civic report sent successfully by email."

            });

        } catch (error) {

            console.error(
                "SEND REPORT EMAIL ERROR:",
                error?.message || error
            );

            return res
                .status(500)
                .json({

                    success:
                        false,

                    error:
                        error?.message ||
                        "Failed to send report."

                });

        }

    }
);

// ============================================================
// TEST GMAIL
// ============================================================

app.post(
    "/api/test-email",
    async (req, res) => {

        try {

            if (
                !emailTransporter
            ) {

                return res
                    .status(503)
                    .json({

                        success:
                            false,

                        error:
                            "Gmail is not configured."

                    });

            }

            const to =
                cleanText(
                    req.body?.email
                ) ||
                EMAIL_USER;

            await emailTransporter
                .sendMail({

                    from:
                        EMAIL_FROM,

                    to,

                    subject:
                        "ChronicAI Gmail Test",

                    text:
                        "ChronicAI Gmail integration is working successfully."

                });

            return res.json({

                success:
                    true,

                message:
                    "Test email sent successfully.",

                to

            });

        } catch (error) {

            console.error(
                "TEST EMAIL ERROR:",
                error?.message || error
            );

            return res
                .status(500)
                .json({

                    success:
                        false,

                    error:
                        error?.message ||
                        "Test email failed."

                });

        }

    }
);

// ============================================================
// AI STATUS
// ============================================================

app.get(
    "/api/ai-status",
    (req, res) => {

        return res.json({

            success:
                true,

            services: {

                aiLifeHelper: {

                    provider:
                        "Groq",

                    model:
                        GROQ_TEXT_MODEL,

                    configured:
                        hasGroqKey()

                },

                normalChat: {

                    provider:
                        "Groq",

                    model:
                        GROQ_TEXT_MODEL,

                    configured:
                        hasGroqKey()

                },

                productChat: {

                    provider:
                        "Groq",

                    model:
                        GROQ_TEXT_MODEL,

                    configured:
                        hasGroqKey()

                },

                imageChat: {

                    provider:
                        "Groq",

                    model:
                        GROQ_VISION_MODEL,

                    configured:
                        hasGroqKey()

                },

                chronicAnalysis: {

                    provider:
                        "Google Gemini",

                    model:
                        GEMINI_MODEL,

                    configured:
                        hasGeminiKey()

                },

                productScanner: {

                    provider:
                        "Google Gemini",

                    model:
                        GEMINI_MODEL,

                    configured:
                        hasGeminiKey()

                },

                authorityLookup: {

                    provider:
                        "Groq",

                    model:
                        GROQ_TEXT_MODEL,

                    configured:
                        hasGroqKey()

                }

            },

            otherServices: {

                gmail: {

                    configured:
                        hasEmailConfig()

                }

            },

            serverTime:
                new Date()
                    .toISOString()

        });

    }
);

// ============================================================
// HEALTH
// ============================================================

app.get(
    "/api/health",
    (req, res) => {

        return res.json({

            success:
                true,

            status:
                "online",

            service:
                "ChronicAI Backend",

            ai: {

                aiLifeHelper:
                    "Groq",

                normalChat:
                    "Groq",

                productChat:
                    "Groq",

                imageChat:
                    "Groq",

                chronicAnalysis:
                    "Google Gemini",

                productScanner:
                    "Google Gemini",

                authority:
                    "Groq"

            },

            configured: {

                groq:
                    hasGroqKey(),

                gemini:
                    hasGeminiKey(),

                gmail:
                    hasEmailConfig(),

            },

            models: {

                groqText:
                    GROQ_TEXT_MODEL,

                groqVision:
                    GROQ_VISION_MODEL,

                gemini:
                    GEMINI_MODEL

            },

            timestamp:
                new Date()
                    .toISOString()

        });

    }
);

// ============================================================
// API INFO
// ============================================================

app.get(
    "/api",
    (req, res) => {

        return res.json({

            success:
                true,

            message:
                "ChronicAI backend API is running.",

            endpoints: {

                chat:
                    "POST /api/chat",

                analyze:
                    "POST /api/analyze",

                productScanner:
                    "POST /api/analyze-product",

                productChat:
                    "POST /api/product-question",

                authority:
                    "POST /api/authority",

                health:
                    "GET /api/health",

                aiStatus:
                    "GET /api/ai-status",

                reports:
                    "POST /api/reports",

                getReports:
                    "GET /api/reports",

                singleReport:
                    "GET /api/reports/:reportId",

                sendReport:
                    "POST /api/send-report",

                testEmail:
                    "POST /api/test-email",

                requestOTP:
                    "POST /api/request-otp",

                verifyOTP:
                    "POST /api/verify-otp",

                requestPhoneOTP:
                    "POST /api/request-phone-otp",

                verifyPhoneOTP:
                    "POST /api/verify-phone-otp"

            }

        });

    }
);

// ============================================================
// STATIC FRONTEND SECURITY
// ============================================================

app.use(
    (
        req,
        res,
        next
    ) => {

        const blocked =
            new Set([

                "/server.js",

                "/.env",

                "/package.json",

                "/package-lock.json"

            ]);

        if (
            blocked.has(
                req.path
            )
        ) {

            return res
                .status(403)
                .json({

                    success:
                        false,

                    error:
                        "Forbidden."

                });

        }

        if (
            req.path.startsWith(
                "/data/"
            )
        ) {

            return res
                .status(403)
                .json({

                    success:
                        false,

                    error:
                        "Forbidden."

                });

        }

        next();

    }
);

// ============================================================
// STATIC FRONTEND
// ============================================================

app.use(
    express.static(
        __dirname,
        {

            dotfiles:
                "deny",

            index:
                "index.html"

        }
    )
);

// ============================================================
// API 404
// ============================================================

app.use(
    "/api",
    (req, res) => {

        return res
            .status(404)
            .json({

                success:
                    false,

                error:
                    "API endpoint not found.",

                path:
                    req.originalUrl

            });

    }
);

// ============================================================
// GLOBAL ERROR HANDLER
// ============================================================

app.use(
    (
        error,
        req,
        res,
        next
    ) => {

        console.error(
            "GLOBAL SERVER ERROR:",
            error
        );

        if (
            res.headersSent
        ) {

            return next(
                error
            );

        }

        if (
            error instanceof SyntaxError &&
            error.status === 400 &&
            "body" in error
        ) {

            return res
                .status(400)
                .json({

                    success:
                        false,

                    error:
                        "Invalid JSON request body."

                });

        }

        return res
            .status(500)
            .json({

                success:
                    false,

                error:
                    "Internal server error."

            });

    }
);

// ============================================================
// PROCESS ERROR HANDLING
// ============================================================

process.on(
    "unhandledRejection",
    error => {

        console.error(
            "UNHANDLED REJECTION:",
            error
        );

    }
);

process.on(
    "uncaughtException",
    error => {

        console.error(
            "UNCAUGHT EXCEPTION:",
            error
        );

    }
);

// ============================================================
// START SERVER
// ============================================================

app.listen(
    PORT,
    () => {

        console.log("");

        console.log(
            "=================================================="
        );

        console.log(
            "                 CHRONICAI BACKEND"
        );

        console.log(
            "=================================================="
        );

        console.log(
            `Server running on port: ${PORT}`
        );

        console.log(
            `Local URL: http://localhost:${PORT}`
        );

        console.log("");

        console.log(
            "AI SERVICES"
        );

        console.log(
            "--------------------------------------------------"
        );

        console.log(

            "AI Life Helper     :",

            hasGroqKey()
                ? `GROQ (${GROQ_TEXT_MODEL})`
                : "GROQ NOT CONFIGURED"

        );

        console.log(

            "Normal Chat        :",

            hasGroqKey()
                ? `GROQ (${GROQ_TEXT_MODEL})`
                : "GROQ NOT CONFIGURED"

        );

        console.log(

            "Product Chat       :",

            hasGroqKey()
                ? `GROQ (${GROQ_TEXT_MODEL})`
                : "GROQ NOT CONFIGURED"

        );

        console.log(

            "Image Chat         :",

            hasGroqKey()
                ? `GROQ (${GROQ_VISION_MODEL})`
                : "GROQ NOT CONFIGURED"

        );

        console.log(

            "Civic Report AI    :",

            hasGeminiKey()
                ? `GEMINI (${GEMINI_MODEL})`
                : "GEMINI NOT CONFIGURED"

        );

        console.log(

            "Product Scanner    :",

            hasGeminiKey()
                ? `GEMINI (${GEMINI_MODEL})`
                : "GEMINI NOT CONFIGURED"

        );

        console.log(

            "Authority Lookup   :",

            hasGroqKey()
                ? `GROQ (${GROQ_TEXT_MODEL})`
                : "GROQ NOT CONFIGURED"

        );

        console.log("");

        console.log(
            "OTHER SERVICES"
        );

        console.log(
            "--------------------------------------------------"
        );

        console.log(

            "Gmail OTP          :",

            hasEmailConfig()
                ? "CONFIGURED"
                : "NOT CONFIGURED"

        );

        console.log("");

        console.log(
            "API ENDPOINTS"
        );

        console.log(
            "--------------------------------------------------"
        );

        console.log(
            `http://localhost:${PORT}/api`
        );

        console.log(
            `http://localhost:${PORT}/api/health`
        );

        console.log(
            `http://localhost:${PORT}/api/ai-status`
        );

        console.log("");

        console.log(
            "=================================================="
        );

        console.log("");

    }
);