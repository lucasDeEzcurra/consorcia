You are a senior full-stack engineer helping to build an MVP for a startup called Consorcia.

The goal is to build a production-oriented MVP, not a demo script. Focus on clean architecture, simplicity, and speed.

---

# 🧠 PRODUCT OVERVIEW

Consorcia is a platform for building management companies.

Supervisors report maintenance work via Telegram (using a bot), and the system generates a monthly PDF report per building, which can be reviewed in a web app and then sent by email to all property owners.

---

# 🏗️ STACK (FIXED)

- Frontend: React (prefer simple setup like Vite)
- Backend: Supabase (PostgreSQL + Auth + Storage)
- Telegram: Telegram Bot API (webhook)
- AI: OpenAI or Claude (for text generation only)
- PDF: HTML template → PDF generation

---

# 👥 USER ROLES

## Admin
- Creates supervisors
- Creates buildings
- Assigns buildings to supervisors
- Can reassign buildings at any time
- Can view all buildings and reports

## Supervisor
- Has assigned buildings
- Uses Telegram bot to create/update jobs
- Uses web app to:
  - view jobs
  - edit jobs
  - generate reports
  - send reports

---

# 🧱 CORE ENTITIES

## Supervisor
- id
- name
- phone_number (used for Telegram identification)

## Building
- id
- name
- address
- supervisor_id
- emails (array of recipient emails)

## Job (VERY IMPORTANT)
Represents a single maintenance task.

Fields:
- id
- building_id
- description_original (from Telegram)
- description_generated (AI-enhanced)
- status: "pending" | "completed"
- created_at
- completed_at (IMPORTANT: used for reports)
- expense_amount (optional, internal only)
- expense_provider (optional)
- expense_category (optional)

## Media
- id
- job_id
- type: "before" | "after"
- url

## Report
- id
- building_id
- month (e.g. "2026-03")
- status: "draft" | "sent"
- generated_text
- created_at
- sent_at

---

# ⚠️ IMPORTANT BUSINESS RULES

- A building belongs to ONE supervisor at a time
- Buildings are independent of supervisors (reassignment does not affect history)
- A job is only included in reports if:
  → status = completed
- The date of a job = completed_at (NOT created_at)
- Expenses are stored but DO NOT appear in the PDF
- Reports group jobs by building + month (based on completed_at)

---

# 📲 TELEGRAM BOT FLOW (Webhook)

Supervisor is identified by Telegram chat ID (stored in phone_number field).

## Flow:

1. User sends message → system identifies supervisor
2. Show menu:
   1. Select building
   2. Exit

3. Show buildings (numbered list with name + address)

4. After selecting building:
   Menu:
   1. Create new job
   2. Complete pending job
   3. View pending jobs
   4. Change building
   5. Exit

---

## Create new job (PENDING)

Steps:
1. Ask for BEFORE photos
2. User sends multiple images
3. User types "LISTO"
4. Ask for short description
5. Save job with:
   - status = pending
   - created_at = now
   - NO completed_at

---

## Complete job

1. Show list of pending jobs (description + date)
2. User selects one
3. Ask for AFTER photos
4. User sends images
5. User types "LISTO"
6. Optionally ask for expense (step-by-step)
7. Set:
   - status = completed
   - completed_at = now

---

# 🌐 WEB APP

## Supervisor Dashboard

- Metrics:
  - total buildings
  - pending jobs
  - completed this month
  - reports generated

- List of assigned buildings

---

## Building Detail Page

Tabs:

1. Pending Jobs
2. Completed Jobs (current month)
3. Job History (all jobs)
4. Report History
5. Recipients (emails)
6. Generate Report

---

## Jobs UI

- Display as list
- Clicking opens detail view:
  - description
  - before images
  - after images
  - edit capabilities:
    - description
    - images
    - expense
    - delete job

---

# 📄 REPORT GENERATION

## Rules:

- One report per building per month
- Include ONLY completed jobs
- Based on completed_at date
- Generated on demand

---

## Report Structure:

1. Header:
   - building name
   - month
   - title: "Informe de Gestión Mensual"

2. AI-generated summary (short, formal)

3. List of jobs:
   For each job:
   - AI-enhanced description
   - completion date
   - before images
   - after images

4. Closing paragraph

---

## AI Requirements

- Improve clarity and tone
- DO NOT hallucinate
- DO NOT add new facts
- Style: formal, concise, slightly polished

---

# 📧 EMAIL FLOW

1. User generates report
2. Sees preview
3. Can edit text
4. Clicks "Continue"
5. Goes to confirmation screen:
   - edit subject
   - edit message
   - edit recipients
6. Click "Send"
7. Mark report as sent

---

# ⚙️ WHAT TO BUILD

1. Supabase schema (SQL)
2. Telegram webhook handler (Supabase Edge Function)
3. React frontend:
   - dashboard
   - building page
   - jobs list + detail
   - report preview
   - send flow
4. AI integration function
5. PDF generation from HTML template

---

# 🎯 PRIORITY

Focus on:
- end-to-end flow working
- Telegram → DB → Web → PDF → Email

Avoid:
- overengineering
- unnecessary abstractions
- advanced auth
- complex UI states

---

Now:
1. Design the database schema
2. Implement the backend structure
3. Generate initial frontend structure

Be pragmatic and MVP-focus
