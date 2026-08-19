// ============================================================
// CHRONICAI — COMPLETE BACKEND SERVER
// ============================================================
//
// AI ROUTING
// ------------------------------------------------------------
// NORMAL CHRONIC CHAT       -> GROK
// PRODUCT CHAT            -> GROK
// CHRONIC REPORT ANALYSIS   -> GEMINI
// PRODUCT SCANNER         -> GEMINI
//
// OTHER FEATURES
// ------------------------------------------------------------
// Gmail OTP
// Phone OTP / Twilio
// Chronic Reports
// Authority Routing
// Email Complaint
// Health / AI Status
// Static Frontend
//
// IMPORTANT:
// DELETE YOUR OLD server.js CONTENT COMPLETELY
// THEN PASTE THIS FILE ONLY ONCE.
// ============================================================

"use strict";

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import nodemailer from "nodemailer";
import twilio from "twilio";
import { fileURLToPath } from "url";


// ============================================================
// ENV
// ============================================================

dotenv.config();


// ============================================================
// PATH
// ============================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


// ============================================================
// EXPRESS
// ============================================================

const app = express();

const PORT =
    Number(process.env.PORT) || 3000;


// ============================================================
// SERVER SETTINGS
// ============================================================

app.disable("x-powered-by");

app.use(
    cors({
        origin: true,
        methods: [
            "GET",
            "POST",
            "PUT",
            "DELETE",
            "OPTIONS"
        ],
        allowedHeaders: [
            "Content-Type",
            "Authorization"
        ]
    })
);

app.use(
    express.json({
        limit: "20mb"
    })
);

app.use(
    express.urlencoded({
        extended: true,
        limit: "20mb"
    })
);


// ============================================================
// DATA DIRECTORY
// ============================================================

const DATA_DIR =
    path.join(__dirname, "data");

const REPORTS_FILE =
    path.join(
        DATA_DIR,
        "reports.json"
    );

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
// API KEYS
// ============================================================

const GEMINI_API_KEY =
    String(
        process.env.GEMINI_API_KEY || ""
    ).trim();

const GROQ_API_KEY =
    String(
        process.env.GROQ_API_KEY || ""
    ).trim();


// ============================================================
// MODELS
// ============================================================

const GEMINI_MODEL =
    process.env.GEMINI_MODEL ||
    "gemini-3.5-flash";

const GROQ_TEXT_MODEL =
    process.env.GROQ_TEXT_MODEL ||
    "llama-3.3-70b-versatile";

const GROQ_VISION_MODEL =
    process.env.GROQ_VISION_MODEL ||
    "meta-llama/llama-4-scout-17b-16e-instruct";


// ============================================================
// EMAIL CONFIG
// ============================================================

const EMAIL_USER =
    process.env.EMAIL_USER || "";

const EMAIL_PASSWORD =
    process.env.EMAIL_PASSWORD || "";

let emailTransporter = null;

if (
    EMAIL_USER &&
    EMAIL_PASSWORD
) {
    emailTransporter =
        nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: EMAIL_USER,
                pass: EMAIL_PASSWORD
            }
        });
}


// ============================================================
// TWILIO CONFIG
// ============================================================

const TWILIO_ACCOUNT_SID =
    process.env.TWILIO_ACCOUNT_SID || "";

const TWILIO_AUTH_TOKEN =
    process.env.TWILIO_AUTH_TOKEN || "";

const TWILIO_PHONE_NUMBER =
    process.env.TWILIO_PHONE_NUMBER || "";

let twilioClient = null;

if (
    TWILIO_ACCOUNT_SID &&
    TWILIO_AUTH_TOKEN
) {
    twilioClient =
        twilio(
            TWILIO_ACCOUNT_SID,
            TWILIO_AUTH_TOKEN
        );
}


// ============================================================
// AUTHORITY CONTACT CONFIG
// ============================================================

const AUTHORITY_CONFIG = {

    road: {
        email:
            process.env.ROAD_AUTHORITY_EMAIL || "",
        phone:
            process.env.ROAD_AUTHORITY_PHONE || ""
    },

    sanitation: {
        email:
            process.env.SANITATION_AUTHORITY_EMAIL || "",
        phone:
            process.env.SANITATION_AUTHORITY_PHONE || ""
    },

    drainage: {
        email:
            process.env.DRAINAGE_AUTHORITY_EMAIL || "",
        phone:
            process.env.DRAINAGE_AUTHORITY_PHONE || ""
    },

    electricity: {
        email:
            process.env.ELECTRICITY_AUTHORITY_EMAIL || "",
        phone:
            process.env.ELECTRICITY_AUTHORITY_PHONE || ""
    },

    water: {
        email:
            process.env.WATER_AUTHORITY_EMAIL || "",
        phone:
            process.env.WATER_AUTHORITY_PHONE || ""
    },

    general: {
        email:
            process.env.GENERAL_AUTHORITY_EMAIL || "",
        phone:
            process.env.GENERAL_AUTHORITY_PHONE || ""
    }

};


// ============================================================
// OTP STORAGE
// ============================================================

const otpStore = new Map();


// ============================================================
// HELPERS
// ============================================================

function cleanText(
    value,
    maxLength = 20000
) {
    if (
        value === undefined ||
        value === null
    ) {
        return "";
    }

    return String(value)
        .trim()
        .slice(
            0,
            maxLength
        );
}


function generateOTP() {
    return String(
        Math.floor(
            100000 +
            Math.random() *
            900000
        )
    );
}


function generateId(
    prefix = "CHRONIC-"
) {
    return (
        prefix +
        Date.now() +
        "-" +
        crypto
            .randomBytes(3)
            .toString("hex")
            .toUpperCase()
    );
}


function isImageDataUrl(
    image
) {
    return (
        typeof image === "string" &&
        /^data:image\/.+;base64,/i.test(
            image
        )
    );
}


function parseJSON(text) {

    if (!text) {
        throw new Error(
            "AI returned an empty response."
        );
    }

    let cleaned =
        String(text)
            .trim()
            .replace(
                /^```json/i,
                ""
            )
            .replace(
                /^```/i,
                ""
            )
            .replace(
                /```$/i,
                ""
            )
            .trim();

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
        end !== -1 &&
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
// GEMINI CALL
// ============================================================

async function callGemini({
    systemPrompt,
    userText,
    image = null,
    jsonMode = false,
    temperature = 0.2,
    maxOutputTokens = 1800
}) {

    if (!GEMINI_API_KEY) {
        throw new Error(
            "GEMINI_API_KEY is missing in .env"
        );
    }

    const parts = [];

    parts.push({
        text:
            `${systemPrompt}\n\n${userText}`
    });

    if (
        image &&
        isImageDataUrl(image)
    ) {

        const match =
            image.match(
                /^data:(image\/[^;]+);base64,(.+)$/s
            );

        if (match) {

            parts.push({
                inlineData: {
                    mimeType:
                        match[1],
                    data:
                        match[2]
                }
            });

        }
    }


    const body = {

        contents: [
            {
                role: "user",
                parts
            }
        ],

        generationConfig: {
            temperature,
            maxOutputTokens
        }

    };


    if (jsonMode) {

        body.generationConfig.responseMimeType =
            "application/json";
    }


    const response =
        await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
                GEMINI_MODEL
            )}:generateContent?key=${encodeURIComponent(
                GEMINI_API_KEY
            )}`,
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body:
                    JSON.stringify(body)
            }
        );


    if (!response.ok) {

        const errorText =
            await response
                .text()
                .catch(
                    () => ""
                );

        throw new Error(
            `Gemini API ${response.status}: ${errorText.slice(
                0,
                1000
            )}`
        );
    }


    const data =
        await response.json();


    const text =
        data
            ?.candidates?.[0]
            ?.content?.parts
            ?.map(
                p =>
                    p?.text || ""
            )
            .join("")
            .trim();


    if (!text) {

        throw new Error(
            "Gemini returned an empty response."
        );
    }


    return text;
}


// ============================================================
// GROK / GROQ CALL
// ============================================================

async function callGrok({
    systemPrompt,
    userText,
    history = [],
    image = null,
    temperature = 0.5,
    maxTokens = 1800
}) {

    if (!GROQ_API_KEY) {
        throw new Error(
            "GROQ_API_KEY is missing in .env"
        );
    }


    const messages = [];


    messages.push({
        role: "system",
        content:
            systemPrompt
    });


    if (
        Array.isArray(history)
    ) {

        for (
            const item of history.slice(-20)
        ) {

            if (
                !item ||
                typeof item !== "object"
            ) {
                continue;
            }

            const role =
                item.role === "assistant"
                    ? "assistant"
                    : "user";

            const content =
                cleanText(
                    item.content ||
                    item.message ||
                    item.text
                );

            if (content) {

                messages.push({
                    role,
                    content
                });
            }
        }
    }


    const userContent = [];


    if (userText) {

        userContent.push({
            type: "text",
            text: userText
        });
    }


    if (
        image &&
        isImageDataUrl(image)
    ) {

        userContent.push({
            type: "image_url",
            image_url: {
                url: image
            }
        });
    }


    messages.push({
        role: "user",
        content:
            userContent.length === 1 &&
            userContent[0].type === "text"
                ? userContent[0].text
                : userContent
    });


    const model =
        image
            ? GROQ_VISION_MODEL
            : GROQ_TEXT_MODEL;


    const response =
        await fetch(
            "https://api.groq.com/openai/v1/chat/completions",
            {
                method: "POST",

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

                        max_tokens:
                            maxTokens
                    })
            }
        );


    if (!response.ok) {

        const errorText =
            await response
                .text()
                .catch(
                    () => ""
                );

        throw new Error(
            `Grok API ${response.status}: ${errorText.slice(
                0,
                1000
            )}`
        );
    }


    const data =
        await response.json();


    const text =
        data
            ?.choices?.[0]
            ?.message?.content
            ?.trim();


    if (!text) {

        throw new Error(
            "Grok returned an empty response."
        );
    }


    return text;
}


// ============================================================
// AUTHORITY ROUTING
// ============================================================

function normalizeAuthority(
    category = "",
    department = "",
    problem = ""
) {

    const text =
        (
            `${category} ${department} ${problem}`
        )
            .toLowerCase();


    if (
        text.includes("electric") ||
        text.includes("power") ||
        text.includes("transformer") ||
        text.includes("street light")
    ) {
        return "electricity";
    }


    if (
        text.includes("water") ||
        text.includes("pipeline") ||
        text.includes("drinking")
    ) {
        return "water";
    }


    if (
        text.includes("drain") ||
        text.includes("sewer") ||
        text.includes("sewage")
    ) {
        return "drainage";
    }


    if (
        text.includes("garbage") ||
        text.includes("waste") ||
        text.includes("sanitation") ||
        text.includes("toilet")
    ) {
        return "sanitation";
    }


    if (
        text.includes("road") ||
        text.includes("pothole") ||
        text.includes("traffic") ||
        text.includes("footpath") ||
        text.includes("street")
    ) {
        return "road";
    }


    return "general";
}


function getAuthorityContact(
    analysis
) {

    const type =
        normalizeAuthority(
            analysis?.category,
            analysis?.department,
            analysis?.problem
        );


    const contact =
        AUTHORITY_CONFIG[type] ||
        AUTHORITY_CONFIG.general;


    return {

        authorityType:
            type,

        email:
            contact.email,

        phone:
            contact.phone

    };
}


// ============================================================
// HEALTH
// ============================================================

app.get(
    "/api/health",
    (_req, res) => {

        res.json({

            success: true,

            status: "online",

            service:
                "ChronicAI Backend",

            ai: {

                chronicReport:
                    "Google Gemini",

                productScanner:
                    "Google Gemini",

                normalChat:
                    "Grok",

                productChat:
                    "Grok"

            },

            configured: {

                gemini:
                    Boolean(
                        GEMINI_API_KEY
                    ),

                grok:
                    Boolean(
                        GROQ_API_KEY
                    ),

                email:
                    Boolean(
                        emailTransporter
                    ),

                twilio:
                    Boolean(
                        twilioClient
                    )

            },

            models: {

                gemini:
                    GEMINI_MODEL,

                grokText:
                    GROQ_TEXT_MODEL,

                grokVision:
                    GROQ_VISION_MODEL

            },

            timestamp:
                new Date()
                    .toISOString()

        });

    }
);


// ============================================================
// AI STATUS
// ============================================================

app.get(
    "/api/ai-status",
    (_req, res) => {

        res.json({

            success: true,

            ai: {

                chronicReport: {
                    provider:
                        "Google Gemini",
                    configured:
                        Boolean(
                            GEMINI_API_KEY
                        )
                },

                productScanner: {
                    provider:
                        "Google Gemini",
                    configured:
                        Boolean(
                            GEMINI_API_KEY
                        )
                },

                normalChat: {
                    provider:
                        "Grok",
                    configured:
                        Boolean(
                            GROQ_API_KEY
                        )
                },

                productChat: {
                    provider:
                        "Grok",
                    configured:
                        Boolean(
                            GROQ_API_KEY
                        )
                }

            }

        });

    }
);


// ============================================================
// API INFO
// ============================================================

app.get(
    "/api",
    (_req, res) => {

        res.json({

            success: true,

            message:
                "ChronicAI backend is running.",

            endpoints: {

                health:
                    "GET /api/health",

                aiStatus:
                    "GET /api/ai-status",

                chat:
                    "POST /api/chat",

                analyze:
                    "POST /api/analyze",

                analyzeProduct:
                    "POST /api/analyze-product",

                productQuestion:
                    "POST /api/product-question",

                requestOTP:
                    "POST /api/request-otp",

                verifyOTP:
                    "POST /api/verify-otp",

                requestPhoneOTP:
                    "POST /api/request-phone-otp",

                verifyPhoneOTP:
                    "POST /api/verify-phone-otp",

                reports:
                    "POST /api/reports",

                getReports:
                    "GET /api/reports",

                singleReport:
                    "GET /api/reports/:reportId",

                sendReport:
                    "POST /api/send-report"

            }

        });

    }
);


// ============================================================
// NORMAL CHRONIC CHAT
// ============================================================
// IMPORTANT:
// THIS USES GROK.
// GEMINI IS NOT USED HERE.
// ============================================================

app.post(
    "/api/chat",
    async (req, res) => {

        try {

            const message =
                cleanText(
                    req.body?.message ||
                    req.body?.question
                );


            const history =
                Array.isArray(
                    req.body?.history
                )
                    ? req.body.history
                    : [];


            const image =
                isImageDataUrl(
                    req.body?.image
                )
                    ? req.body.image
                    : null;


            if (
                !message &&
                !image
            ) {

                return res.status(400)
                    .json({

                        success: false,

                        error:
                            "Message or image is required."

                    });
            }


            const systemPrompt = `

You are ChronicAI Live Helper.

You are powered by GROK.

Have a natural, intelligent conversation.

Do NOT automatically convert every message into
a formal civic report.

If the user asks about roads, water, electricity,
garbage, drainage, government services or other
civic topics, answer naturally.

Do not invent facts.

If current local information is unavailable,
say so clearly.

Answer in the language used by the user.

Return normal conversational text only.

`;


            const answer =
                await callGrok({

                    systemPrompt,

                    userText:
                        message ||
                        "Please understand the attached image.",

                    history,

                    image,

                    temperature:
                        0.55,

                    maxTokens:
                        1800

                });


            return res.json({

                success: true,

                provider: "Grok",

                model:
                    image
                        ? GROQ_VISION_MODEL
                        : GROQ_TEXT_MODEL,

                answer,

                message: answer

            });

        } catch (error) {

            console.error(
                "GROK CHAT ERROR:",
                error
            );


            return res.status(500)
                .json({

                    success: false,

                    provider: "Grok",

                    error:
                        error?.message ||
                        "Grok chat failed."

                });

        }

    }
);


// ============================================================
// CIVIC REPORT ANALYSIS
// ============================================================
// GEMINI ONLY
// ============================================================

app.post(
    "/api/analyze",
    async (req, res) => {

        try {

            const description =
                cleanText(
                    req.body?.description
                );

            const location =
                cleanText(
                    req.body?.location
                );

            const reporterName =
                cleanText(
                    req.body?.reporterName
                );

            const image =
                isImageDataUrl(
                    req.body?.image
                )
                    ? req.body.image
                    : null;


            if (
                !description &&
                !image
            ) {

                return res.status(400)
                    .json({

                        success: false,

                        error:
                            "Description or image is required."

                    });
            }


            const systemPrompt = `

You are ChronicAI's Civic Report Analysis AI.

IMPORTANT:
Use GOOGLE GEMINI for this task.

Analyze the citizen's civic problem using:
- description
- uploaded image
- location

Determine:

1. problem
2. category
3. severity
4. confidence
5. department
6. summary
7. recommendation
8. responsibleAuthority
9. requestedAction
10. officialComplaint
11. authorityReason

Do not invent information.

If location is provided, preserve it.

Return ONLY valid JSON.

JSON format:

{
  "problem": "",
  "category": "",
  "severity": "Low",
  "confidence": "Medium",
  "department": "",
  "responsibleAuthority": "",
  "location": "",
  "summary": "",
  "recommendation": "",
  "authorityReason": "",
  "officialComplaint": "",
  "problemDescription": "",
  "requestedAction": ""
}

`;


            const userText = `

Reporter:
${reporterName || "Citizen"}

Description:
${description || "No description provided"}

Location:
${location || "No location provided"}

Analyze this civic report.

`;


            const raw =
                await callGemini({

                    systemPrompt,

                    userText,

                    image,

                    jsonMode: true,

                    temperature:
                        0.2,

                    maxOutputTokens:
                        2000

                });


            const analysis =
                parseJSON(raw);


            const authority =
                getAuthorityContact(
                    analysis
                );


            analysis.location =
                analysis.location ||
                location ||
                "Not provided";


            analysis.authorityType =
                authority.authorityType;


            analysis.authorityEmail =
                authority.email;


            analysis.authorityPhone =
                authority.phone;


            return res.json({

                success: true,

                provider:
                    "Google Gemini",

                model:
                    GEMINI_MODEL,

                analysis,

                result:
                    analysis

            });

        } catch (error) {

            console.error(
                "GEMINI CIVIC ANALYSIS ERROR:",
                error
            );


            return res.status(500)
                .json({

                    success: false,

                    provider:
                        "Google Gemini",

                    error:
                        error?.message ||
                        "Civic report analysis failed."

                });

        }

    }
);


// ============================================================
// PRODUCT SCANNER
// ============================================================
// GEMINI ONLY
// ============================================================

app.post(
    "/api/analyze-product",
    async (req, res) => {

        try {

            const image =
                isImageDataUrl(
                    req.body?.image
                )
                    ? req.body.image
                    : null;


            const productName =
                cleanText(
                    req.body?.productName
                );

            const question =
                cleanText(
                    req.body?.question
                );


            if (
                !image &&
                !productName &&
                !question
            ) {

                return res.status(400)
                    .json({

                        success: false,

                        error:
                            "Product image, name or question is required."

                    });
            }


            const systemPrompt = `

You are ChronicAI Product Scanner.

Use GOOGLE GEMINI.

Analyze products from the available information
and image.

You may identify:

- product name
- brand
- category
- visible price
- approximate purpose
- visible ingredients
- visible warnings
- visible expiry information
- consumer complaint possibility

IMPORTANT:

Never invent medical or safety information.

If information is not visible or verified,
say "Not available from the provided information."

Return ONLY valid JSON.

Format:

{
  "productName": "",
  "brand": "",
  "category": "",
  "price": "",
  "purpose": "",
  "ingredients": "",
  "warnings": "",
  "expiry": "",
  "answer": "",
  "confidence": "High | Medium | Low",
  "complaintPossible": false
}

`;


            const userText = `

Product name:
${productName || "Unknown"}

User question:
${question || "Analyze this product."}

Analyze the product.

`;


            const raw =
                await callGemini({

                    systemPrompt,

                    userText,

                    image,

                    jsonMode: true,

                    temperature:
                        0.25,

                    maxOutputTokens:
                        1800

                });


            const result =
                parseJSON(raw);


            return res.json({

                success: true,

                provider:
                    "Google Gemini",

                model:
                    GEMINI_MODEL,

                result,

                answer:
                    result.answer || ""

            });

        } catch (error) {

            console.error(
                "PRODUCT SCANNER ERROR:",
                error
            );


            return res.status(500)
                .json({

                    success: false,

                    provider:
                        "Google Gemini",

                    error:
                        error?.message ||
                        "Product scanner failed."

                });

        }

    }
);


// ============================================================
// PRODUCT CHAT
// ============================================================
// GROK ONLY
// ============================================================

app.post(
    "/api/product-question",
    async (req, res) => {

        try {

            const question =
                cleanText(
                    req.body?.question ||
                    req.body?.message
                );

            const productName =
                cleanText(
                    req.body?.productName
                );

            const productContext =
                cleanText(
                    req.body?.productContext
                );

            const image =
                isImageDataUrl(
                    req.body?.image
                )
                    ? req.body.image
                    : null;

            const history =
                Array.isArray(
                    req.body?.history
                )
                    ? req.body.history
                    : [];


            if (
                !question &&
                !image
            ) {

                return res.status(400)
                    .json({

                        success: false,

                        error:
                            "Product question or image is required."

                    });
            }


            const systemPrompt = `

You are ChronicAI Product Chat Assistant.

You are powered by GROK.

This endpoint is ONLY for product-related
conversation.

Discuss products naturally.

You can help with:

- product questions
- consumer questions
- product comparisons
- visible label information
- price questions
- usage questions
- complaint guidance
- receipt/product complaint preparation

Do not invent facts.

If the user asks about medical safety,
do not present uncertain information as fact.

If information is unavailable,
clearly say that.

Answer naturally.

Do NOT return civic-report JSON.

`;


            const userText = `

Product:
${productName || "Not specified"}

Known product information:
${productContext || "Not provided"}

User question:
${question || "Please analyze the product image."}

`;


            const answer =
                await callGrok({

                    systemPrompt,

                    userText,

                    history,

                    image,

                    temperature:
                        0.45,

                    maxTokens:
                        1800

                });


            return res.json({

                success: true,

                provider:
                    "Grok",

                model:
                    image
                        ? GROQ_VISION_MODEL
                        : GROQ_TEXT_MODEL,

                answer,

                message:
                    answer

            });

        } catch (error) {

            console.error(
                "GROK PRODUCT CHAT ERROR:",
                error
            );


            return res.status(500)
                .json({

                    success: false,

                    provider:
                        "Grok",

                    error:
                        error?.message ||
                        "Grok product chat failed."

                });

        }

    }
);


// ============================================================
// REQUEST EMAIL OTP
// ============================================================

app.post(
    "/api/request-otp",
    async (req, res) => {

        try {

            const email =
                cleanText(
                    req.body?.email
                )
                .toLowerCase();


            if (!email) {

                return res.status(400)
                    .json({

                        success: false,

                        error:
                            "Email is required."

                    });
            }


            if (!emailTransporter) {

                return res.status(503)
                    .json({

                        success: false,

                        error:
                            "Email OTP is not configured."

                    });
            }


            const otp =
                generateOTP();


            otpStore.set(
                `email:${email}`,
                {
                    otp,
                    expires:
                        Date.now() +
                        5 * 60 * 1000,
                    attempts: 0
                }
            );


            await emailTransporter.sendMail({

                from:
                    EMAIL_USER,

                to:
                    email,

                subject:
                    "ChronicAI Verification OTP",

                text:
                    `Your ChronicAI verification OTP is ${otp}. It is valid for 5 minutes.`,

                html:
                    `
                    <div style="font-family:Arial">
                        <h2>ChronicAI Verification</h2>
                        <p>Your verification OTP is:</p>
                        <h1>${otp}</h1>
                        <p>This OTP expires in 5 minutes.</p>
                    </div>
                    `

            });


            return res.json({

                success: true,

                message:
                    "Email OTP sent successfully."

            });

        } catch (error) {

            console.error(
                "EMAIL OTP ERROR:",
                error
            );


            return res.status(500)
                .json({

                    success: false,

                    error:
                        "Failed to send email OTP."

                });

        }

    }
);


// ============================================================
// VERIFY EMAIL OTP
// ============================================================

app.post(
    "/api/verify-otp",
    (req, res) => {

        const email =
            cleanText(
                req.body?.email
            )
            .toLowerCase();

        const otp =
            cleanText(
                req.body?.otp
            );


        if (
            !email ||
            !otp
        ) {

            return res.status(400)
                .json({

                    success: false,

                    error:
                        "Email and OTP are required."

                });
        }


        const key =
            `email:${email}`;

        const record =
            otpStore.get(key);


        if (!record) {

            return res.status(400)
                .json({

                    success: false,

                    error:
                        "OTP not found or expired."

                });
        }


        if (
            Date.now() >
            record.expires
        ) {

            otpStore.delete(key);

            return res.status(400)
                .json({

                    success: false,

                    error:
                        "OTP expired."

                });
        }


        if (
            record.otp !== otp
        ) {

            record.attempts++;

            if (
                record.attempts >= 5
            ) {
                otpStore.delete(key);
            }

            return res.status(400)
                .json({

                    success: false,

                    error:
                        "Invalid OTP."

                });
        }


        otpStore.delete(key);


        return res.json({

            success: true,

            verified: true,

            message:
                "Email verified successfully."

        });

    }
);


// ============================================================
// REQUEST PHONE OTP
// ============================================================

app.post(
    "/api/request-phone-otp",
    async (req, res) => {

        try {

            const phone =
                cleanText(
                    req.body?.phone
                );


            if (!phone) {

                return res.status(400)
                    .json({

                        success: false,

                        error:
                            "Phone number is required."

                    });
            }


            if (
                !twilioClient ||
                !TWILIO_PHONE_NUMBER
            ) {

                return res.status(503)
                    .json({

                        success: false,

                        error:
                            "Twilio phone OTP is not configured."

                    });
            }


            const otp =
                generateOTP();


            otpStore.set(
                `phone:${phone}`,
                {
                    otp,
                    expires:
                        Date.now() +
                        5 * 60 * 1000,
                    attempts: 0
                }
            );


            await twilioClient
                .messages
                .create({

                    body:
                        `ChronicAI verification OTP: ${otp}. Valid for 5 minutes.`,

                    from:
                        TWILIO_PHONE_NUMBER,

                    to:
                        phone

                });


            return res.json({

                success: true,

                message:
                    "Phone OTP sent successfully."

            });

        } catch (error) {

            console.error(
                "PHONE OTP ERROR:",
                error
            );


            return res.status(500)
                .json({

                    success: false,

                    error:
                        "Failed to send phone OTP."

                });

        }

    }
);


// ============================================================
// VERIFY PHONE OTP
// ============================================================

app.post(
    "/api/verify-phone-otp",
    (req, res) => {

        const phone =
            cleanText(
                req.body?.phone
            );

        const otp =
            cleanText(
                req.body?.otp
            );


        if (
            !phone ||
            !otp
        ) {

            return res.status(400)
                .json({

                    success: false,

                    error:
                        "Phone and OTP are required."

                });
        }


        const key =
            `phone:${phone}`;

        const record =
            otpStore.get(key);


        if (!record) {

            return res.status(400)
                .json({

                    success: false,

                    error:
                        "OTP not found or expired."

                });
        }


        if (
            Date.now() >
            record.expires
        ) {

            otpStore.delete(key);

            return res.status(400)
                .json({

                    success: false,

                    error:
                        "OTP expired."

                });
        }


        if (
            record.otp !== otp
        ) {

            record.attempts++;

            return res.status(400)
                .json({

                    success: false,

                    error:
                        "Invalid OTP."

                });
        }


        otpStore.delete(key);


        return res.json({

            success: true,

            verified: true,

            message:
                "Phone verified successfully."

        });

    }
);


// ============================================================
// REPORT STORAGE
// ============================================================

function readReports() {

    try {

        return JSON.parse(
            fs.readFileSync(
                REPORTS_FILE,
                "utf8"
            )
        );

    } catch {

        return [];

    }

}


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
// CREATE CIVIC REPORT
// ============================================================

app.post(
    "/api/reports",
    (req, res) => {

        try {

            const body =
                req.body || {};


            const analysis =
                body.analysis &&
                typeof body.analysis === "object"
                    ? body.analysis
                    : {};


            const authority =
                getAuthorityContact(
                    analysis
                );


            const report = {

                reportId:
                    generateId(
                        "CHRONIC-"
                    ),

                reporterName:
                    cleanText(
                        body.reporterName
                    ) ||
                    "Anonymous",

                email:
                    cleanText(
                        body.email
                    ),

                phone:
                    cleanText(
                        body.phone
                    ),

                description:
                    cleanText(
                        body.description
                    ),

                location:
                    cleanText(
                        body.location
                    ),

                latitude:
                    body.latitude ??
                    null,

                longitude:
                    body.longitude ??
                    null,

                image:
                    typeof body.image === "string"
                        ? body.image
                        : null,

                analysis,

                authority: {

                    type:
                        authority.authorityType,

                    email:
                        authority.email,

                    phone:
                        authority.phone

                },

                status:
                    "Submitted",

                createdAt:
                    new Date()
                        .toISOString()

            };


            if (
                !report.description &&
                !report.image &&
                !Object.keys(
                    analysis
                ).length
            ) {

                return res.status(400)
                    .json({

                        success: false,

                        error:
                            "Report information is required."

                    });
            }


            const reports =
                readReports();


            reports.push(
                report
            );


            writeReports(
                reports
            );


            return res.json({

                success: true,

                message:
                    "Civic report submitted successfully.",

                reportId:
                    report.reportId,

                report,

                authority:
                    report.authority

            });

        } catch (error) {

            console.error(
                "REPORT ERROR:",
                error
            );


            return res.status(500)
                .json({

                    success: false,

                    error:
                        "Failed to create report."

                });

        }

    }
);


// ============================================================
// GET ALL REPORTS
// ============================================================

app.get(
    "/api/reports",
    (_req, res) => {

        const reports =
            readReports();

        res.json({

            success: true,

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

            return res.status(404)
                .json({

                    success: false,

                    error:
                        "Report not found."

                });
        }


        return res.json({

            success: true,

            report

        });

    }
);


// ============================================================
// SEND REPORT TO AUTHORITY
// ============================================================

app.post(
    "/api/send-report",
    async (req, res) => {

        try {

            const body =
                req.body || {};


            const analysis =
                body.analysis &&
                typeof body.analysis === "object"
                    ? body.analysis
                    : {};


            const authority =
                getAuthorityContact(
                    analysis
                );


            const targetEmail =
                cleanText(
                    body.authorityEmail
                ) ||
                cleanText(
                    authority.email
                );


            if (!targetEmail) {

                return res.status(400)
                    .json({

                        success: false,

                        error:
                            "Authority email is not configured for this category."

                    });
            }


            if (!emailTransporter) {

                return res.status(503)
                    .json({

                        success: false,

                        error:
                            "Gmail is not configured."

                    });
            }


            const subject =
                cleanText(
                    body.subject
                ) ||
                `ChronicAI Civic Complaint - ${
                    analysis.problem ||
                    "Civic Issue"
                }`;


            const complaint =
                cleanText(
                    body.complaint
                ) ||
                cleanText(
                    analysis.officialComplaint
                ) ||
                cleanText(
                    body.description
                );


            await emailTransporter
                .sendMail({

                    from:
                        EMAIL_USER,

                    to:
                        targetEmail,

                    subject,

                    text:
                        complaint ||
                        "Civic complaint submitted through ChronicAI."

                });


            return res.json({

                success: true,

                message:
                    "Complaint sent successfully.",

                authorityEmail:
                    targetEmail,

                authorityType:
                    authority.authorityType

            });

        } catch (error) {

            console.error(
                "SEND REPORT ERROR:",
                error
            );


            return res.status(500)
                .json({

                    success: false,

                    error:
                        error?.message ||
                        "Failed to send complaint."

                });

        }

    }
);


// ============================================================
// STATIC FRONTEND
// ============================================================

app.use(
    express.static(
        __dirname,
        {
            dotfiles: "deny",
            index: "index.html"
        }
    )
);


// ============================================================
// API 404
// ============================================================

app.use(
    "/api",
    (_req, res) => {

        res.status(404)
            .json({

                success: false,

                error:
                    "API endpoint not found."

            });

    }
);


// ============================================================
// FRONTEND FALLBACK
// ============================================================

app.use(
    (req, res, next) => {

        if (
            req.method !== "GET"
        ) {
            return next();
        }


        if (
            req.path.startsWith(
                "/api/"
            )
        ) {
            return next();
        }


        const indexFile =
            path.join(
                __dirname,
                "index.html"
            );


        if (
            fs.existsSync(
                indexFile
            )
        ) {

            return res.sendFile(
                indexFile
            );

        }


        return res.status(404)
            .send(
                "ChronicAI frontend not found."
            );

    }
);


// ============================================================
// GLOBAL ERROR HANDLER
// ============================================================

app.use(
    (
        error,
        _req,
        res,
        _next
    ) => {

        console.error(
            "SERVER ERROR:",
            error
        );


        if (
            error instanceof SyntaxError
        ) {

            return res.status(400)
                .json({

                    success: false,

                    error:
                        "Invalid JSON request."

                });
        }


        return res.status(500)
            .json({

                success: false,

                error:
                    error?.message ||
                    "Internal server error."

            });

    }
);


// ============================================================
// PROCESS ERROR HANDLERS
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
            "================================================"
        );

        console.log(
            "             CHRONICAI BACKEND"
        );

        console.log(
            "================================================"
        );

        console.log(
            `Server: http://localhost:${PORT}`
        );

        console.log("");

        console.log(
            "AI ROUTING"
        );

        console.log(
            `Civic Report Analysis : Gemini ${
                GEMINI_API_KEY
                    ? "READY"
                    : "NOT CONFIGURED"
            }`
        );

        console.log(
            `Product Scanner       : Gemini ${
                GEMINI_API_KEY
                    ? "READY"
                    : "NOT CONFIGURED"
            }`
        );

        console.log(
            `Normal Live Chat      : Grok ${
                GROQ_API_KEY
                    ? "READY"
                    : "NOT CONFIGURED"
            }`
        );

        console.log(
            `Product Chat          : Grok ${
                GROQ_API_KEY
                    ? "READY"
                    : "NOT CONFIGURED"
            }`
        );

        console.log("");

        console.log(
            `Email OTP             : ${
                emailTransporter
                    ? "ENABLED"
                    : "DISABLED"
            }`
        );

        console.log(
            `Phone OTP             : ${
                twilioClient
                    ? "ENABLED"
                    : "DISABLED"
            }`
        );

        console.log("");

        console.log(
            "================================================"
        );

        console.log("");

    }
);