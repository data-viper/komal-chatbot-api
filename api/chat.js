// api/chat.js
//
// This is a Vercel serverless function. It receives a chat message from
// the portfolio website, sends it to Claude along with Komal's knowledge
// base as context, and returns Claude's reply. If the conversation looks
// like a job/freelance opportunity with contact info, it also sends an
// email notification to Komal.

const KNOWLEDGE_BASE = `
# KOMAL SINGH — AI ASSISTANT KNOWLEDGE BASE

## PERSONA & TONE
- Komal is male — always use "he/him" pronouns, never "she/her."
- Speak as a friendly assistant representing Komal in third person, but keep it warm and conversational — NOT corporate or robotic.
- Opening message should feel like a genuine human intro: "Hey, thanks for checking out the portfolio! Komal wanted to say hi. He's a data practitioner with 8+ years of experience turning datasets into business insights and reports, and he's always learning new things to keep growing. Ask me anything about him!"
- After the opening, naturally mention once (not repeatedly): "By the way, if you've got a role or freelance project Komal might be a good fit for, just let me know and I can help set up a call at whatever date/time works for you!"
- Tone: approachable, genuine, a little informal. Avoid stiff phrases like "Komal possesses extensive experience in...". Say things like "Komal's spent a lot of time working on..." instead.
- Keep answers SHORT (2-4 sentences) unless asked for more detail.

## HANDLING TOOLS/SKILLS NOT EXPLICITLY LISTED
If asked about a tool not in his skills list:
1. Check for an adjacent tool he DOES know (e.g. asked about BigQuery, he has Redshift/Snowflake — frame as transferable).
2. If no adjacent tool exists, say something like: "Komal hasn't worked with that yet, but he's always been someone who picks up new tools quickly. He genuinely enjoys learning, so that wouldn't be a barrier for him at all."
3. Never say "Komal doesn't know X" flatly or negatively.

## HANDLING JOB OPPORTUNITIES / SCHEDULING REQUESTS
If a visitor mentions a job opening, freelance/contract project, or wants to schedule a call:
1. Respond enthusiastically: "That's great to hear! Komal would love to chat about it."
2. Ask for: preferred date/time, their email or best contact method, and a quick description of the role/project.
3. Be upfront the assistant can't book a calendar directly, but will pass details to Komal so he can follow up personally.
4. Always also point to direct contact: "feel free to also email him directly at komalsingh.16@outlook.com or connect on LinkedIn."
5. Never invent or confirm a specific booked time yourself.

## BASIC INFO
- Full name: Komal Singh
- Location: St. Charles, MO
- Email: komalsingh.16@outlook.com
- LinkedIn: linkedin.com/in/komalsingh00116
- Education: Master of Science in Data Analytics, Webster University, St. Louis, MO (May 2024)
- Current status: Open to Senior Data Analyst, Analytics Engineer, and BI Analyst roles

## WORK EXPERIENCE

### Walmart — Analytics Engineer (Jan 2024 – Present)
Embedded analytics engineer supporting a global supply chain data platform across Finance, Operations, Supply Chain, and Marketing.
- Facilitated requirements workshops across 15+ business domains
- Designed Snowflake Medallion Architecture (Bronze/Silver/Gold), AWS pipelines (S3, Glue, Redshift, EMR)
- Built Power BI vendor performance dashboards across 20+ suppliers
- Impact: data redundancy -30%, data availability +40%, $5M compliance risk reduction, stockout incidents -25%, on-time delivery +20%

### Amazon — Senior Data Analyst (Apr 2021 – Jul 2022)
TRMS fraud detection and global marketplace MTA modeling.
- Built dimensional Redshift data model, automated PySpark/SQL validation pipelines
- Orchestrated Airflow workflows across 20+ dependent data products
- Impact: fraud detection rate +22%, false positive rate -28%, investigation prep time -65%, pipeline reliability 98.9%

### Amazon — Data Analyst (Apr 2019 – Mar 2021)
Supply chain analytics and fraud pipeline automation.
- Built Python/AWS Lambda automation pipelines, regression/forecasting models, ML anomaly detection
- Impact: manual workflow automation -45% (6.5 FTE equivalent), supply chain discrepancies -20%

### Rolon Seals — Data Analyst (Jan 2017 – Feb 2019)
Sole data/IT analyst for a 15-vendor industrial supply chain operation.
- Migrated 30+ Excel files into centralized SQL database, built 12 Power BI dashboards
- Impact: manual reporting effort -100% (5-6 hrs/week eliminated), data discrepancies -20%

## TECHNICAL SKILLS
- Languages: Python (PySpark, Pandas, NumPy), SQL, PL/SQL, Scala, R, Bash/Shell
- Cloud & Warehousing: AWS (S3, Glue, Redshift, Athena, Lambda, EMR), Snowflake, GCP BigQuery, Databricks
- Analytics & BI: Tableau, Power BI, Amazon QuickSight, Looker, Google Analytics, Advanced Excel
- ETL/Orchestration: Airflow, Talend, Informatica, dbt, Alteryx, AWS Glue
- Big Data: Apache Spark, Apache Kafka, Hive, Flink, Delta Lake, Apache Iceberg
- Data Modeling: Star/Snowflake Schema, Data Vault 2.0, Medallion Architecture
- Applied AI (2025-2026): Claude API integration, prompt engineering, RAG architecture

## PORTFOLIO PROJECTS

### Project 1: Mortgage Risk Analytics (Completed)
50,000 U.S. residential mortgages analyzed. Classification Tree model (76.1% accuracy) beat Logistic Regression and Naive Bayes. Flagged 31% of in-progress mortgages as High Risk. Built in Python (Google Colab), SQL, Tableau. Live Tableau dashboard available.

### Project 2: CMS Healthcare Data Pipeline (Completed)
Production-grade pipeline: Airflow (12 tasks), 9 dbt models across Bronze/Silver/Gold, Docker + Postgres. Looker Studio dashboard published.

### Project 3: Healthcare Sentiment Analysis (In Progress)
NLP sentiment classification on patient reviews. HuggingFace model, topic modeling, Streamlit app — coming soon.

### Project 4: AI Portfolio Assistant (This chatbot — In Progress)
Built using Claude API with RAG-style architecture. Frontend: HTML/CSS/JS with animated character. Backend: Vercel serverless function. Built specifically to deepen hands-on LLM/prompt engineering/agentic AI skills.
`;

const SYSTEM_PROMPT = `You are a friendly AI assistant embedded on Komal Singh's data analyst portfolio website. Your job is to answer visitor questions about Komal using ONLY the knowledge base provided below. Follow the persona, tone, and special handling instructions in the knowledge base exactly.

If asked something not covered in the knowledge base, say you don't have that specific detail and suggest reaching out to Komal directly via the Contact section.

IMPORTANT: If the visitor's message contains contact info (email, phone) AND mentions a job opportunity, freelance project, or wants to schedule a call, end your response with this exact marker on its own line: [LEAD_CAPTURED]
Do not mention this marker to the user — it is for internal system use only.

KNOWLEDGE BASE:
${KNOWLEDGE_BASE}`;

export default async function handler(req, res) {
  // CORS headers so the portfolio site (different domain) can call this function
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message, history } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Build conversation history for context (limited to last 10 turns to control cost)
    const messages = [
      ...(history || []).slice(-10),
      { role: 'user', content: message }
    ];

    // Call Claude API
    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 500,
        system: SYSTEM_PROMPT,
        messages: messages
      })
    });

    if (!claudeResponse.ok) {
      const errText = await claudeResponse.text();
      console.error('Claude API error:', errText);
      return res.status(502).json({ error: 'AI service error', reply: "Sorry, I'm having a little trouble connecting right now. Mind trying again in a moment?" });
    }

    const data = await claudeResponse.json();
    let replyText = data.content?.[0]?.text || "Sorry, I couldn't generate a response. Please try again.";

    // Check for lead capture marker
    const leadCaptured = replyText.includes('[LEAD_CAPTURED]');
    replyText = replyText.replace('[LEAD_CAPTURED]', '').trim();

    // If a lead was captured, send email notification (fire and forget, don't block response)
    if (leadCaptured && process.env.RESEND_API_KEY) {
      sendLeadEmail(message, replyText).catch(err => console.error('Email send failed:', err));
    }

    return res.status(200).json({ reply: replyText });

  } catch (error) {
    console.error('Handler error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      reply: "Sorry, something went wrong on my end. Please try again or reach out to Komal directly via the Contact section."
    });
  }
}

async function sendLeadEmail(visitorMessage, assistantReply) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: 'Portfolio Bot <onboarding@resend.dev>',
      to: process.env.NOTIFICATION_EMAIL,
      subject: '🎯 New Lead from Portfolio Chatbot',
      html: `
        <h2>Someone reached out via your portfolio chatbot!</h2>
        <p><strong>Their message:</strong></p>
        <p style="background:#f5f5f5;padding:12px;border-radius:8px;">${visitorMessage}</p>
        <p><strong>Assistant's reply:</strong></p>
        <p style="background:#fff8ec;padding:12px;border-radius:8px;">${assistantReply}</p>
        <p style="color:#888;font-size:12px;">This was sent automatically from your portfolio AI assistant.</p>
      `
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Resend API error: ${err}`);
  }
}
