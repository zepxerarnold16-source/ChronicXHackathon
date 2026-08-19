// ============================================================
// CHRONICAI — BACKEND SERVER
// Express + Groq AI
// Civic Report Analysis
// Authority Routing
// Report Management
// Admin Status Update
// SLA Monitoring
// Automatic Escalation
// Frontend Server
// ============================================================

"use strict";

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// ============================================================
// ENVIRONMENT
// ============================================================

dotenv.config();

// ============================================================
// ES MODULE PATH
// ============================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================
// APP
// IMPORTANT: app MUST be created before app.get/app.post
// ============================================================

const app = express();

const PORT = Number(process.env.PORT) || 3000;

// ============================================================
// DIRECTORIES
// ============================================================

const FRONTEND_DIR = __dirname;

const DATA_DIR = path.join(
    __dirname,
    "data"
);

const REPORTS_FILE = path.join(
    DATA_DIR,
    "reports.json"
);

// ============================================================
// CREATE DATA DIRECTORY
// ============================================================

fs.mkdirSync(DATA_DIR, {
    recursive: true
});

// ============================================================
// CREATE REPORT DATABASE
// ============================================================

if (!fs.existsSync(REPORTS_FILE)) {
    fs.writeFileSync(
        REPORTS_FILE,
        "[]",
        "utf8"
    );
}

// ============================================================
// SECURITY
// ============================================================

app.disable("x-powered-by");

// ============================================================
// CORS
// ============================================================

app.use(
    cors({
        origin: true,
        credentials: false
    })
);

// ============================================================
// BODY PARSER
// ============================================================

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
// CLEAN TEXT
// ============================================================

function cleanText(
    value,
    maxLength = 5000
) {
    if (typeof value !== "string") {
        return "";
    }

    return value
        .trim()
        .slice(0, maxLength);
}

// ============================================================
// CLEAN ARRAY
// ============================================================

function cleanArray(
    value,
    maxItems = 20
) {
    if (!Array.isArray(value)) {
        return [];
    }

    return value
        .filter(
            item =>
                typeof item === "string"
        )
        .map(
            item =>
                cleanText(item, 500)
        )
        .filter(Boolean)
        .slice(0, maxItems);
}

// ============================================================
// READ REPORTS
// ============================================================

function readReports() {
    try {
        const content =
            fs.readFileSync(
                REPORTS_FILE,
                "utf8"
            );

        const reports =
            JSON.parse(content);

        return Array.isArray(reports)
            ? reports
            : [];

    } catch (error) {

        console.error(
            "Unable to read reports:",
            error
        );

        return [];
    }
}

// ============================================================
// SAVE REPORTS
// ============================================================

function saveReports(reports) {

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
// REPORT ID
// ============================================================

function generateReportId() {

    return (
        "CHRONIC-" +
        Date.now() +
        "-" +
        Math.floor(
            1000 +
            Math.random() * 9000
        )
    );
}

// ============================================================
// EVENT ID
// ============================================================

function generateEventId() {

    return (
        "EVT-" +
        Date.now() +
        "-" +
        Math.floor(
            Math.random() * 10000
        )
    );
}

// ============================================================
// IMAGE VALIDATION
// ============================================================

function isValidImageDataUrl(value) {

    return (
        typeof value === "string" &&
        /^data:image\/(jpeg|jpg|png|webp|gif);base64,/i.test(
            value
        )
    );
}

// ============================================================
// SLA HOURS
// ============================================================

function getSlaHours(
    severity,
    suggested
) {

    const custom =
        Number(suggested);

    if (
        Number.isFinite(custom) &&
        custom >= 1 &&
        custom <= 720
    ) {
        return custom;
    }

    const level =
        String(severity || "")
            .toLowerCase();

    if (level === "critical") {
        return 12;
    }

    if (level === "high") {
        return 24;
    }

    if (level === "medium") {
        return 48;
    }

    return 72;
}

// ============================================================
// ADD HOURS
// ============================================================

function addHours(
    date,
    hours
) {

    return new Date(
        new Date(date).getTime() +
        hours *
        60 *
        60 *
        1000
    ).toISOString();
}

// ============================================================
// AUTHORITY FALLBACK
// ============================================================

function getAuthorityFallback(
    category
) {

    const value =
        String(category || "")
            .toLowerCase();

    if (
        value.includes("road") ||
        value.includes("pothole") ||
        value.includes("street") ||
        value.includes("traffic")
    ) {

        return {

            department:
                "Road & Infrastructure Department",

            authority:
                "Municipal / Public Works Authority"
        };
    }

    if (
        value.includes("waste") ||
        value.includes("garbage") ||
        value.includes("sanitation")
    ) {

        return {

            department:
                "Waste Management Department",

            authority:
                "Municipal Sanitation Authority"
        };
    }

    if (
        value.includes("water") ||
        value.includes("drainage") ||
        value.includes("sewer")
    ) {

        return {

            department:
                "Water & Drainage Department",

            authority:
                "Municipal Water Authority"
        };
    }

    if (
        value.includes("electric") ||
        value.includes("street light") ||
        value.includes("power")
    ) {

        return {

            department:
                "Electrical Department",

            authority:
                "Municipal Electrical Authority"
        };
    }

    if (
        value.includes("park") ||
        value.includes("tree") ||
        value.includes("environment")
    ) {

        return {

            department:
                "Environment & Parks Department",

            authority:
                "Municipal Environment Authority"
        };
    }

    return {

        department:
            "Municipal Authority",

        authority:
            "Local Civic Authority"
    };
}

// ============================================================
// NORMALIZE ANALYSIS
// ============================================================

function normalizeAnalysis(
    analysis,
    location = ""
) {

    const fallback =
        getAuthorityFallback(
            analysis?.category
        );

    const severity =
        cleanText(
            analysis?.severity,
            50
        ) || "Medium";

    const slaHours =
        getSlaHours(
            severity,
            analysis?.suggestedSlaHours
        );

    return {

        problem:
            cleanText(
                analysis?.problem,
                300
            ) ||
            "Public civic issue",

        category:
            cleanText(
                analysis?.category,
                200
            ) ||
            "General Civic Issue",

        severity,

        department:
            cleanText(
                analysis?.department,
                200
            ) ||
            fallback.department,

        location:
            cleanText(
                analysis?.location,
                500
            ) ||
            location ||
            "Not provided",

        confidence:
            cleanText(
                analysis?.confidence,
                50
            ) ||
            "Medium",

        summary:
            cleanText(
                analysis?.summary,
                1500
            ) ||
            "The reported civic issue was analyzed.",

        recommendation:
            cleanText(
                analysis?.recommendation,
                1500
            ) ||
            "The responsible civic authority should review the issue.",

        objectionTitle:
            cleanText(
                analysis?.objectionTitle,
                300
            ) ||
            "Civic Complaint",

        officialComplaint:
            cleanText(
                analysis?.officialComplaint,
                3000
            ) ||
            "A civic issue has been reported for official review.",

        problemDescription:
            cleanText(
                analysis?.problemDescription,
                2500
            ) ||
            "A civic issue was reported.",

        requestedAction:
            cleanText(
                analysis?.requestedAction,
                1500
            ) ||
            "Please inspect the reported issue and take appropriate corrective action.",

        priority:
            cleanText(
                analysis?.priority,
                50
            ) ||
            severity,

        responsibleAuthority:
            cleanText(
                analysis?.responsibleAuthority,
                300
            ) ||
            fallback.authority,

        authorityReason:
            cleanText(
                analysis?.authorityReason,
                1000
            ) ||
            "Authority selected based on the civic issue category.",

        requiredEvidence:
            cleanArray(
                analysis?.requiredEvidence
            ),

        suggestedSlaHours:
            slaHours
    };
}

// ============================================================
// GROQ AI
// ============================================================

async function callGroqAI({
    description,
    location,
    image
}) {

    const apiKey =
        process.env.GROQ_API_KEY;

    if (!apiKey) {

        throw new Error(
            "GROQ_API_KEY is missing in .env"
        );
    }

    const model =
        process.env.GROQ_VISION_MODEL ||
        "meta-llama/llama-4-scout-17b-16e-instruct";

    // ========================================================
    // SYSTEM PROMPT
    // ========================================================

    const systemPrompt = `
You are ChronicAI, an intelligent civic problem analysis assistant.

Analyze citizen civic complaints.

Input may contain:

- written description
- location
- uploaded image
- image + description

Analyze only the available evidence carefully.

Determine:

1. Actual civic problem
2. Category
3. Severity
4. Department
5. Responsible authority
6. Authority reason
7. Summary
8. Recommendation
9. Official complaint
10. Requested action
11. Required evidence
12. SLA

Do not invent facts.

Do not claim that an authority has already received the complaint.

Return ONLY valid JSON.

Use exactly this structure:

{
    "problem": "",
    "category": "",
    "severity": "Low | Medium | High | Critical",
    "department": "",
    "location": "",
    "confidence": "High | Medium | Low",
    "summary": "",
    "recommendation": "",
    "objectionTitle": "",
    "officialComplaint": "",
    "problemDescription": "",
    "requestedAction": "",
    "priority": "Low | Medium | High | Critical",
    "responsibleAuthority": "",
    "authorityReason": "",
    "requiredEvidence": [],
    "suggestedSlaHours": 48
}
`;

    // ========================================================
    // USER CONTENT
    // ========================================================

    const textPrompt = `
Citizen Description:

${description || "No description provided"}

Citizen Location:

${location || "No location provided"}

Analyze this civic report.

Return only the required JSON object.
`;

    const content = [

        {
            type: "text",
            text: textPrompt
        }

    ];

    // ========================================================
    // IMAGE
    // ========================================================

    if (image) {

        content.push({

            type: "image_url",

            image_url: {
                url: image
            }

        });
    }

    // ========================================================
    // TIMEOUT
    // ========================================================

    const controller =
        new AbortController();

    const timeout =
        setTimeout(
            () => {
                controller.abort();
            },
            45000
        );

    try {

        console.log("");
        console.log(
            "========== GROQ REQUEST =========="
        );

        console.log(
            "Model:",
            model
        );

        console.log(
            "API Key:",
            apiKey
                ? "FOUND"
                : "MISSING"
        );

        console.log(
            "Description:",
            description
                ? "YES"
                : "NO"
        );

        console.log(
            "Location:",
            location
                ? "YES"
                : "NO"
        );

        console.log(
            "Image:",
            image
                ? "YES"
                : "NO"
        );

        console.log(
            "=================================="
        );

        console.log("");

        // ====================================================
        // GROQ REQUEST
        // ====================================================

        const response =
            await fetch(
                "https://api.groq.com/openai/v1/chat/completions",
                {

                    method: "POST",

                    headers: {

                        "Content-Type":
                            "application/json",

                        "Authorization":
                            `Bearer ${apiKey}`

                    },

                    body:
                        JSON.stringify({

                            model,

                            messages: [

                                {
                                    role:
                                        "system",

                                    content:
                                        systemPrompt
                                },

                                {
                                    role:
                                        "user",

                                    content
                                }

                            ],

                            temperature:
                                0.2,

                            max_completion_tokens:
                                1600,

                            response_format: {
                                type:
                                    "json_object"
                            }

                        }),

                    signal:
                        controller.signal

                }
            );

        // ====================================================
        // READ RESPONSE
        // ====================================================

        const responseText =
            await response.text();

        console.log(
            "Groq HTTP Status:",
            response.status
        );

        // ====================================================
        // ERROR
        // ====================================================

        if (!response.ok) {

            console.error(
                "Groq API Error:",
                responseText
            );

            throw new Error(
                `Groq API returned ${response.status}: ${responseText.slice(
                    0,
                    1500
                )}`
            );
        }

        // ====================================================
        // PARSE API JSON
        // ====================================================

        let data;

        try {

            data =
                JSON.parse(
                    responseText
                );

        } catch (error) {

            console.error(
                "Groq returned invalid JSON:",
                responseText
            );

            throw new Error(
                "Groq returned an invalid API response."
            );
        }

        // ====================================================
        // EXTRACT AI MESSAGE
        // ====================================================

        const raw =
            data
                ?.choices?.[0]
                ?.message
                ?.content;

        if (!raw) {

            console.error(
                "Unexpected Groq response:",
                data
            );

            throw new Error(
                "Groq returned an empty AI response."
            );
        }

        console.log(
            "Groq AI response received successfully."
        );

        // ====================================================
        // CLEAN MODEL JSON
        // ====================================================

        let cleaned =
            String(raw).trim();

        cleaned =
            cleaned
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

        // ====================================================
        // PARSE AI JSON
        // ====================================================

        try {

            return JSON.parse(
                cleaned
            );

        } catch (error) {

            console.error(
                "AI JSON parse error:",
                error
            );

            console.error(
                "AI raw content:",
                cleaned
            );

            throw new Error(
                "Groq AI returned invalid JSON."
            );
        }

    } catch (error) {

        if (
            error?.name ===
            "AbortError"
        ) {

            throw new Error(
                "Groq AI request timed out after 45 seconds."
            );
        }

        throw error;

    } finally {

        clearTimeout(
            timeout
        );
    }
}

// ============================================================
// HEALTH CHECK
// ============================================================

app.get(
    "/api/health",
    (req, res) => {

        res.json({

            success: true,

            status:
                "online",

            service:
                "ChronicAI",

            aiConfigured:
                Boolean(
                    process.env.GROQ_API_KEY
                ),

            model:
                process.env.GROQ_VISION_MODEL ||
                "meta-llama/llama-4-scout-17b-16e-instruct",

            timestamp:
                new Date().toISOString()

        });
    }
);

// ============================================================
// GROQ TEST
// ============================================================

app.get(
    "/api/test-groq",
    async (req, res) => {

        try {

            const apiKey =
                process.env.GROQ_API_KEY;

            if (!apiKey) {

                return res.status(500).json({

                    success:
                        false,

                    error:
                        "GROQ_API_KEY is missing in .env"

                });
            }

            const model =
                process.env.GROQ_VISION_MODEL ||
                "meta-llama/llama-4-scout-17b-16e-instruct";

            const response =
                await fetch(
                    "https://api.groq.com/openai/v1/chat/completions",
                    {

                        method:
                            "POST",

                        headers: {

                            "Content-Type":
                                "application/json",

                            "Authorization":
                                `Bearer ${apiKey}`

                        },

                        body:
                            JSON.stringify({

                                model,

                                messages: [

                                    {
                                        role:
                                            "user",

                                        content:
                                            "Reply with exactly: ChronicAI Groq connection successful."
                                    }

                                ],

                                temperature:
                                    0,

                                max_completion_tokens:
                                    50

                            })

                    }
                );

            const text =
                await response.text();

            if (!response.ok) {

                return res.status(
                    response.status
                ).json({

                    success:
                        false,

                    error:
                        "Groq connection failed.",

                    groqStatus:
                        response.status,

                    groqResponse:
                        text.slice(
                            0,
                            1500
                        )

                });
            }

            let data;

            try {

                data =
                    JSON.parse(
                        text
                    );

            } catch {

                return res.status(500).json({

                    success:
                        false,

                    error:
                        "Groq returned invalid JSON.",

                    raw:
                        text.slice(
                            0,
                            1000
                        )

                });
            }

            const message =
                data
                    ?.choices?.[0]
                    ?.message
                    ?.content;

            return res.json({

                success:
                    true,

                message:
                    message ||
                    "Groq responded successfully.",

                model,

                timestamp:
                    new Date().toISOString()

            });

        } catch (error) {

            console.error(
                "GROQ TEST ERROR:",
                error
            );

            return res.status(500).json({

                success:
                    false,

                error:
                    error?.message ||
                    "Unable to connect to Groq."

            });
        }
    }
);

// ============================================================
// API INFORMATION
// ============================================================

app.get(
    "/api",
    (req, res) => {

        res.json({

            success:
                true,

            message:
                "ChronicAI backend API is running.",

            endpoints: {

                health:
                    "GET /api/health",

                testGroq:
                    "GET /api/test-groq",

                analyze:
                    "POST /api/analyze",

                createReport:
                    "POST /api/reports",

                reports:
                    "GET /api/reports",

                singleReport:
                    "GET /api/reports/:reportId",

                status:
                    "PATCH /api/reports/:reportId/status",

                escalate:
                    "POST /api/reports/:reportId/escalate",

                timeline:
                    "GET /api/reports/:reportId/timeline"

            }

        });
    }
);

// ============================================================
// AI ANALYZE
// ============================================================

app.post(
    "/api/analyze",
    async (req, res) => {

        try {

            const description =
                cleanText(
                    req.body?.description,
                    5000
                );

            const location =
                cleanText(
                    req.body?.location,
                    500
                );

            const reporterName =
                cleanText(
                    req.body?.reporterName,
                    150
                );

            const image =
                typeof req.body?.image ===
                "string"
                    ? req.body.image.trim()
                    : null;

            if (
                !description &&
                !image
            ) {

                return res.status(400).json({

                    success:
                        false,

                    error:
                        "Please provide a description or image."

                });
            }

            if (
                image &&
                !isValidImageDataUrl(
                    image
                )
            ) {

                return res.status(400).json({

                    success:
                        false,

                    error:
                        "Invalid image format."

                });
            }

            const rawAnalysis =
                await callGroqAI({

                    description,

                    location,

                    image

                });

            const analysis =
                normalizeAnalysis(
                    rawAnalysis,
                    location
                );

            return res.json({

                success:
                    true,

                reporterName:
                    reporterName ||
                    "Anonymous",

                analysis

            });

        } catch (error) {

            console.error(
                "ANALYZE ERROR:",
                error
            );

            return res.status(500).json({

                success:
                    false,

                error:
                    error?.message ||
                    "AI analysis failed."

            });
        }
    }
);

// ============================================================
// CREATE REPORT
// ============================================================

app.post(
    "/api/reports",
    (req, res) => {

        try {

            const reporterName =
                cleanText(
                    req.body?.reporterName,
                    150
                );

            const reporterUid =
                cleanText(
                    req.body?.reporterUid,
                    200
                );

            const description =
                cleanText(
                    req.body?.description,
                    5000
                );

            const location =
                cleanText(
                    req.body?.location,
                    500
                );

            const analysis =
                req.body?.analysis;

            if (
                !analysis ||
                typeof analysis !==
                "object"
            ) {

                return res.status(400).json({

                    success:
                        false,

                    error:
                        "AI analysis is required."

                });
            }

            if (!location) {

                return res.status(400).json({

                    success:
                        false,

                    error:
                        "Report location is required."

                });
            }

            const normalized =
                normalizeAnalysis(
                    analysis,
                    location
                );

            const reportId =
                generateReportId();

            const createdAt =
                new Date().toISOString();

            const slaHours =
                getSlaHours(
                    normalized.severity,
                    normalized.suggestedSlaHours
                );

            const slaDeadline =
                addHours(
                    createdAt,
                    slaHours
                );

            const timeline = [

                {

                    eventId:
                        generateEventId(),

                    type:
                        "SUBMITTED",

                    status:
                        "Submitted",

                    message:
                        "Citizen submitted a civic report.",

                    actor:
                        "Citizen",

                    timestamp:
                        createdAt

                },

                {

                    eventId:
                        generateEventId(),

                    type:
                        "AI_ANALYSIS",

                    status:
                        "AI Analyzed",

                    message:
                        "ChronicAI analyzed the report.",

                    actor:
                        "ChronicAI",

                    timestamp:
                        createdAt

                },

                {

                    eventId:
                        generateEventId(),

                    type:
                        "AUTHORITY_ROUTING",

                    status:
                        "Authority Recommended",

                    message:
                        `Recommended authority: ${normalized.responsibleAuthority}`,

                    actor:
                        "ChronicAI",

                    timestamp:
                        createdAt

                }

            ];

            const report = {

                reportId,

                reporterUid:
                    reporterUid ||
                    null,

                reporterName:
                    reporterName ||
                    "Anonymous",

                description,

                location,

                analysis:
                    normalized,

                objection: {

                    title:
                        normalized.objectionTitle,

                    officialComplaint:
                        normalized.officialComplaint,

                    problemDescription:
                        normalized.problemDescription,

                    requestedAction:
                        normalized.requestedAction

                },

                authority: {

                    department:
                        normalized.department,

                    responsibleAuthority:
                        normalized.responsibleAuthority,

                    reason:
                        normalized.authorityReason,

                    routed:
                        false,

                    routedAt:
                        null

                },

                status:
                    "Submitted",

                priority:
                    normalized.priority,

                sla: {

                    hours:
                        slaHours,

                    deadline:
                        slaDeadline,

                    breached:
                        false,

                    breachedAt:
                        null

                },

                escalation: {

                    escalated:
                        false,

                    escalatedAt:
                        null,

                    escalatedTo:
                        null,

                    reason:
                        null

                },

                admin: {

                    assignedTo:
                        null,

                    assignedDepartment:
                        null,

                    note:
                        null,

                    updatedAt:
                        null

                },

                timeline,

                createdAt,

                updatedAt:
                    createdAt

            };

            const reports =
                readReports();

            reports.push(report);

            saveReports(reports);

            console.log(
                `New report: ${reportId}`
            );

            return res.status(201).json({

                success:
                    true,

                message:
                    "Civic report submitted successfully.",

                reportId,

                report

            });

        } catch (error) {

            console.error(
                "REPORT ERROR:",
                error
            );

            return res.status(500).json({

                success:
                    false,

                error:
                    "Unable to save report."

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

        try {

            const reports =
                readReports();

            return res.json({

                success:
                    true,

                count:
                    reports.length,

                reports

            });

        } catch (error) {

            console.error(
                error
            );

            return res.status(500).json({

                success:
                    false,

                error:
                    "Unable to load reports."

            });
        }
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

            return res.status(404).json({

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
// UPDATE STATUS
// ============================================================

app.patch(
    "/api/reports/:reportId/status",
    (req, res) => {

        try {

            const allowedStatuses = [

                "Submitted",
                "Verified",
                "Assigned",
                "In Progress",
                "Resolved",
                "Rejected",
                "Escalated"

            ];

            const status =
                cleanText(
                    req.body?.status,
                    100
                );

            const adminNote =
                cleanText(
                    req.body?.adminNote,
                    2000
                );

            const assignedTo =
                cleanText(
                    req.body?.assignedTo,
                    200
                );

            const assignedDepartment =
                cleanText(
                    req.body?.assignedDepartment,
                    300
                );

            if (
                !allowedStatuses.includes(
                    status
                )
            ) {

                return res.status(400).json({

                    success:
                        false,

                    error:
                        "Invalid status."

                });
            }

            const reports =
                readReports();

            const index =
                reports.findIndex(
                    report =>
                        report.reportId ===
                        req.params.reportId
                );

            if (index === -1) {

                return res.status(404).json({

                    success:
                        false,

                    error:
                        "Report not found."

                });
            }

            const report =
                reports[index];

            const previousStatus =
                report.status;

            const now =
                new Date().toISOString();

            report.status =
                status;

            report.updatedAt =
                now;

            if (assignedTo) {

                report.admin.assignedTo =
                    assignedTo;
            }

            if (assignedDepartment) {

                report.admin.assignedDepartment =
                    assignedDepartment;
            }

            if (adminNote) {

                report.admin.note =
                    adminNote;
            }

            report.admin.updatedAt =
                now;

            if (
                status ===
                "Assigned"
            ) {

                report.authority.routed =
                    true;

                report.authority.routedAt =
                    report.authority.routedAt ||
                    now;
            }

            report.timeline.push({

                eventId:
                    generateEventId(),

                type:
                    "STATUS_UPDATE",

                status,

                previousStatus,

                message:
                    adminNote ||
                    `Status changed from ${previousStatus} to ${status}.`,

                actor:
                    assignedTo ||
                    "Admin",

                timestamp:
                    now

            });

            reports[index] =
                report;

            saveReports(reports);

            return res.json({

                success:
                    true,

                message:
                    "Report status updated.",

                report

            });

        } catch (error) {

            console.error(
                error
            );

            return res.status(500).json({

                success:
                    false,

                error:
                    "Unable to update report."

            });
        }
    }
);

// ============================================================
// ESCALATE REPORT
// ============================================================

app.post(
    "/api/reports/:reportId/escalate",
    (req, res) => {

        try {

            const reason =
                cleanText(
                    req.body?.reason,
                    2000
                ) ||
                "Report escalated for higher authority review.";

            const escalatedTo =
                cleanText(
                    req.body?.escalatedTo,
                    300
                ) ||
                "Higher Civic Authority";

            const reports =
                readReports();

            const index =
                reports.findIndex(
                    report =>
                        report.reportId ===
                        req.params.reportId
                );

            if (index === -1) {

                return res.status(404).json({

                    success:
                        false,

                    error:
                        "Report not found."

                });
            }

            const report =
                reports[index];

            const now =
                new Date().toISOString();

            report.status =
                "Escalated";

            report.updatedAt =
                now;

            report.escalation = {

                escalated:
                    true,

                escalatedAt:
                    now,

                escalatedTo,

                reason

            };

            report.timeline.push({

                eventId:
                    generateEventId(),

                type:
                    "ESCALATION",

                status:
                    "Escalated",

                message:
                    reason,

                actor:
                    "Admin",

                timestamp:
                    now

            });

            reports[index] =
                report;

            saveReports(reports);

            return res.json({

                success:
                    true,

                message:
                    "Report escalated successfully.",

                report

            });

        } catch (error) {

            console.error(
                error
            );

            return res.status(500).json({

                success:
                    false,

                error:
                    "Unable to escalate report."

            });
        }
    }
);

// ============================================================
// TIMELINE
// ============================================================

app.get(
    "/api/reports/:reportId/timeline",
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

            return res.status(404).json({

                success:
                    false,

                error:
                    "Report not found."

            });
        }

        return res.json({

            success:
                true,

            reportId:
                report.reportId,

            status:
                report.status,

            timeline:
                report.timeline || []

        });
    }
);

// ============================================================
// AUTOMATIC SLA ESCALATION
// ============================================================

function checkSlaAndEscalate() {

    try {

        const reports =
            readReports();

        let changed =
            false;

        const now =
            Date.now();

        for (
            const report of reports
        ) {

            if (
                !report?.sla?.deadline
            ) {
                continue;
            }

            if (
                report.status ===
                "Resolved" ||
                report.status ===
                "Rejected"
            ) {
                continue;
            }

            const deadline =
                new Date(
                    report.sla.deadline
                ).getTime();

            if (
                Number.isNaN(
                    deadline
                )
            ) {
                continue;
            }

            if (
                now >= deadline &&
                !report.sla.breached
            ) {

                const breachTime =
                    new Date().toISOString();

                report.sla.breached =
                    true;

                report.sla.breachedAt =
                    breachTime;

                report.status =
                    "Escalated";

                report.updatedAt =
                    breachTime;

                report.escalation = {

                    escalated:
                        true,

                    escalatedAt:
                        breachTime,

                    escalatedTo:
                        "Higher Civic Authority",

                    reason:
                        "SLA deadline exceeded without resolution."

                };

                report.timeline.push({

                    eventId:
                        generateEventId(),

                    type:
                        "SLA_BREACH",

                    status:
                        "Escalated",

                    message:
                        "SLA deadline exceeded. Report automatically escalated.",

                    actor:
                        "ChronicAI SLA System",

                    timestamp:
                        breachTime

                });

                changed =
                    true;
            }
        }

        if (changed) {

            saveReports(
                reports
            );
        }

    } catch (error) {

        console.error(
            "SLA CHECK ERROR:",
            error
        );
    }
}

// ============================================================
// SLA CHECK EVERY MINUTE
// ============================================================

setInterval(
    checkSlaAndEscalate,
    60 * 1000
);

checkSlaAndEscalate();

// ============================================================
// API 404
// IMPORTANT: This must be AFTER all API routes.
// ============================================================

app.use(
    "/api",
    (req, res) => {

        return res.status(404).json({

            success:
                false,

            error:
                "API endpoint not found."

        });
    }
);

// ============================================================
// BLOCK PRIVATE FILES
// ============================================================

app.use(
    (req, res, next) => {

        const requestedPath =
            req.path.toLowerCase();

        const blocked =
            requestedPath ===
                "/server.js" ||

            requestedPath ===
                "/package.json" ||

            requestedPath ===
                "/package-lock.json" ||

            requestedPath ===
                "/.env" ||

            requestedPath.startsWith(
                "/data/"
            ) ||

            requestedPath.startsWith(
                "/node_modules/"
            );

        if (blocked) {

            return res
                .status(404)
                .send("Not found");
        }

        next();
    }
);

// ============================================================
// STATIC FRONTEND
// ============================================================

app.use(
    express.static(
        FRONTEND_DIR,
        {
            index:
                false,

            dotfiles:
                "ignore",

            fallthrough:
                true
        }
    )
);

// ============================================================
// ROOT
// ============================================================

app.get(
    "/",
    (req, res) => {

        return res.sendFile(
            path.join(
                FRONTEND_DIR,
                "index.html"
            )
        );
    }
);

// ============================================================
// INDEX
// ============================================================

app.get(
    "/index.html",
    (req, res) => {

        return res.sendFile(
            path.join(
                FRONTEND_DIR,
                "index.html"
            )
        );
    }
);

// ============================================================
// FRONTEND FALLBACK
// ============================================================

app.use(
    (req, res, next) => {

        const extension =
            path.extname(
                req.path
            );

        if (extension) {
            return next();
        }

        const indexPath =
            path.join(
                FRONTEND_DIR,
                "index.html"
            );

        if (
            fs.existsSync(
                indexPath
            )
        ) {

            return res.sendFile(
                indexPath,
                error => {

                    if (error) {
                        next(error);
                    }

                }
            );
        }

        next();
    }
);

// ============================================================
// FINAL 404
// ============================================================

app.use(
    (req, res) => {

        return res
            .status(404)
            .send(
                "ChronicAI: Page not found."
            );
    }
);

// ============================================================
// GLOBAL ERROR
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

            return next(error);
        }

        return res.status(500).json({

            success:
                false,

            error:
                "Internal server error."

        });
    }
);

// ============================================================
// START SERVER
// ============================================================

app.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log("");

        console.log(
            "=========================================="
        );

        console.log(
            "          CHRONICAI BACKEND SERVER"
        );

        console.log(
            "=========================================="
        );

        console.log(
            `Server running on port: ${PORT}`
        );

        console.log(
            `Local URL: http://localhost:${PORT}`
        );

        console.log(
            `Frontend: http://localhost:${PORT}/`
        );

        console.log(
            `Health: http://localhost:${PORT}/api/health`
        );

        console.log(
            `Groq Test: http://localhost:${PORT}/api/test-groq`
        );

        console.log(
            `API: http://localhost:${PORT}/api`
        );

        console.log(
            `Reports: http://localhost:${PORT}/api/reports`
        );

        console.log("");

        console.log(
            "AI Analysis: ENABLED"
        );

        console.log(
            "AI Complaint Generation: ENABLED"
        );

        console.log(
            "Authority Routing: ENABLED"
        );

        console.log(
            "Admin Status Update: ENABLED"
        );

        console.log(
            "Report Timeline: ENABLED"
        );

        console.log(
            "SLA Monitoring: ENABLED"
        );

        console.log(
            "Automatic Escalation: ENABLED"
        );

        console.log("");

        console.log(
            `Frontend directory: ${FRONTEND_DIR}`
        );

        console.log(
            `index.html exists: ${
                fs.existsSync(
                    path.join(
                        FRONTEND_DIR,
                        "index.html"
                    )
                )
            }`
        );

        console.log(
            `Groq AI Ready: ${
                process.env.GROQ_API_KEY
                    ? "YES"
                    : "NO"
            }`
        );

        console.log(
            "Firebase Auth: CLIENT-SIDE"
        );

        console.log(
            "Firebase Database: CLIENT-SIDE"
        );

        console.log(
            "=========================================="
        );

        console.log("");
    }
);