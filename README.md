# BD Tracker CRM — Vendor Acquisition System

A CRM for managing e-commerce vendor acquisition. Track leads, vendors, product listings, quality control, and team performance across the Nepalcan marketplace.

---

## Table of Contents

- [Getting Started](#getting-started)
- [Dashboard](#dashboard)
- [Managing Leads](#managing-leads)
- [Pipeline Stages](#pipeline-stages)
- [Managing Vendors & Active Sellers](#managing-vendors--active-sellers)
- [Follow-ups](#follow-ups)
- [Activities & Tasks](#activities--tasks)
- [Notifications](#notifications)
- [Goals & Targets](#goals--targets)
- [Analytics](#analytics)
- [User Roles](#user-roles)
- [Browser Extension](#browser-extension)
- [Troubleshooting](#troubleshooting)
- [Setup (Developers)](#setup-developers)

---

## Getting Started

### Logging In

Open the app at the deployed URL. You'll see the login screen. Enter your email and password — these are provided by your system administrator.

After login you land on the **Dashboard**. Your name and role appear in the sidebar. If you don't see the sidebar, you may not have the right permissions — contact your admin.

### Navigation

The sidebar gives you access to:

| Page | What it's for |
|------|--------------|
| Dashboard | Overview counts and charts |
| Leads | Manage leads/vendors |
| Vendors | Vendor management + follow-ups |
| Active Sellers | Activated seller records |
| Tasks | Personal and team tasks |
| Goals | BD targets and progress |
| BD Tiers | Commission tier structure |
| Tickets | Support tickets |
| Nepalcan Sales | Order data from Nepalcan |
| Analytics | Reports, leaderboard, daily reports |
| Users | User management (admin only) |
| Settings | Pipeline stages and permissions |
| Extension | Extension version & download |
| Finance | Financial records |

---

## Dashboard

The dashboard shows:

- **Today's Follow-ups** — Scheduled follow-ups with overdue indicators
- **Quick Stats** — Total leads, vendors, active sellers
- **Lead Growth Chart** — New leads over time
- **BD Leaderboard** — Team performance ranking
- **Recent Activities** — Latest lead interactions

Click any stat card to navigate directly to that section.

---

## Managing Leads

### Listing View

The **Leads** page shows all leads in a table (desktop) or card layout (mobile). You can:

- **Search** by name, phone, email, or location
- **Filter** by pipeline stage, category, or assigned user
- **Sort** by newest, oldest, or lead score

### Creating a Lead

Click the **+ Add Lead** button. Fill in:

- Business name, contact person, phone, email
- Category and location
- Assign to a team member
- Lead score (optional, for prioritization)

### Lead Detail

Click a lead row to open the detail modal. From here you can:

- View all information and activity history
- Change pipeline stage
- Log a call, WhatsApp, email, meeting, or follow-up
- View upcoming follow-ups
- Track product readiness and verification status

### Accepting Assignments

If a lead is assigned to you with `assignment_status: pending`, you'll see an **Accept** button. Click it to claim the lead.

### Bulk Upload

Admins can upload leads in bulk via Excel (.xlsx). Click the **Upload** button, download the template, fill it in, and upload.

### Bulk Transfer

Select multiple leads and transfer them to another team member in one action.

---

## Pipeline Stages

Leads move through configurable pipeline stages:

- **New** — Fresh lead, no contact yet
- **Contacted** — Initial outreach made
- **Interested** — Lead showed interest
- **Meeting Scheduled** — Demo/meeting booked
- **Negotiation** — Discussing terms
- **Document Pending** — Awaiting paperwork
- **Activated** — Onboarded as active seller

Admins can customize these stages and their order in **Settings → Pipeline**.

---

## Managing Vendors & Active Sellers

### Vendor Management

The **Vendors** page shows all tracked businesses. It has tabs:

- **Active** — Active vendors/sellers
- **Follow-up** — Today's follow-up tasks
- **Archived** — Inactive/archived records

Each vendor shows business name, contact, category, product count, verification status, pipeline stage, and manager.

### Active Sellers

The **Active Sellers** page lists sellers who completed onboarding. It includes:

- Seller name, contact, activation date
- Total product count
- Verification status
- Delivery zone information

---

## Follow-ups

Follow-ups are scheduled activities that remind you to contact a lead or vendor.

### Today's Follow-ups

On the **Leads** page and **Vendors** page, switch to the **Follow-up** tab to see:

- **Time** — When the follow-up is scheduled
- **Overdue** — Red indicator if past due
- **Vendor/Lead name**, contact, note, pipeline stage, manager
- **Activity status** — Green checkmark if already logged, amber alert if not
- **Action** — Click to open the record

### Auto Follow-ups

The system automatically creates follow-ups for stalled records:

| Type | When | What it means |
|------|------|---------------|
| **3-Day Drop** | 3 days after Proposal Dropped status | Lead dropped after proposal — needs re-engagement |
| **7-Day Stale** | 7 days since last activity on an interested lead | Lead went cold — follow up |

Auto follow-ups appear in an amber-colored section below the main follow-ups. They look the same but are auto-generated by the system.

### Completing a Follow-up

Open the lead/vendor record from the follow-up and log the activity (call, WhatsApp, etc.). The system tracks whether an activity was logged that day and marks the follow-up as done.

---

## Activities & Tasks

### Logging Activities

On any lead or vendor detail, you can log:

- **Call** — Phone conversation summary
- **WhatsApp** — Chat summary
- **Email** — Email correspondence
- **Meeting** — In-person or virtual meeting notes
- **Follow-up Scheduled** — Set a reminder for a future date
- **Note** — General note

Each activity records who logged it, when, and the details.

### Tasks

The **Tasks** page shows all tasks with:

- Title and description
- Status (Open / In Progress / Done)
- Priority level
- Assigned user and due date
- Department filtering

Tasks can be created from the Tasks page or auto-generated by the system.

---

## Notifications

The bell icon in the header shows unread notifications. Notifications are created for:

- Follow-up reminders
- Assignment changes
- Status updates
- System alerts

**Note:** The CEO (Summit Shrestha) is excluded from all notifications by design.

---

## Goals & Targets

### Personal Goals

Set on the **Goals** page. Each goal has:

- A target number (leads, conversions, revenue, etc.)
- Current progress
- Associated pipeline stage
- Time period

### Team Targets

Admins set daily team targets for:

- Listing target (products listed per day)
- Spec target (specs added)
- QC target (QC operations)

These show up in the browser extension popup as progress bars.

### Operational Goals

On the **Operational Goals** page, manage per-user or per-team targets for listing and QC teams.

---

## Analytics

### Analytics Hub

The **Analytics** page has four tabs:

| Tab | What it shows |
|-----|--------------|
| **BD Leaderboard** | Team ranking by performance metrics |
| **Daily Report** | Per-day activity breakdown |
| **Nepalcan Analytics** | Listing and QC data from the extension |
| **Vendor Snapshots** | Vendor health over time |

### BD Leaderboard

Ranks team members by:

- Listings created
- Specs added
- Products updated
- QC approved/rejected

Click a member to drill into their detailed performance.

### Daily Report

Shows daily counts of activities, follow-ups completed, and status changes. Useful for end-of-day reporting.

### Nepalcan Analytics

Tracks events captured by the browser extension:

- Listings, updates, spec additions
- QC approvals and rejections
- Session duration and activity patterns

Data is shown per-vendor and per-user with date filtering.

---

## User Roles

| Role | Capabilities |
|------|------------|
| **Super Admin** | Full access to everything — users, settings, finance, all data |
| **Admin** | Manage users, settings, extension, reports. Cannot delete users |
| **User** (Listing/QC) | Day-to-day: manage leads, vendors, log activities, follow-ups. Sees own data + team data |
| **Viewer** | Read-only access to dashboards, reports, leads |

---

## Browser Extension

The BD Tracker browser extension automatically tracks your activity on the Nepalcan marketplace (https://commerce.thecanbrand.com).

### Installation

1. Go to the **Extension** page in the BD Tracker web app
2. Click **Download Extension** to get `extension.zip`
3. Unzip the file to a folder
4. Open Chrome/Edge and go to `chrome://extensions`
5. Enable **Developer mode** (toggle in top-right)
6. Click **Load unpacked** and select the unzipped folder
7. The BD Tracker icon appears in your toolbar

### Login

1. Click the BD Tracker icon in the toolbar
2. Click **Sign In**
3. Enter your BD Tracker email and password
4. You're now logged in. The extension starts tracking immediately.

### What It Tracks

The extension intercepts network requests on the Nepalcan marketplace and records events:

| Event | When it fires |
|-------|--------------|
| **Product Viewed** | You open a product detail page |
| **Listing Created** | You create a product listing (POST with package type) |
| **Product Updated** | You edit a product |
| **Spec Added** | You add compliance values to a product |
| **QC Approved** | You approve a product's quality check (single or bulk) |
| **QC Rejected** | You reject a product's quality check (single or bulk) |
| **QC Pending** | You visit the QC pending products page |
| **Session Ended** | You close a product tab (summarizes activity) |

### Popup Stats

Click the extension icon to see your personal stats:

- **Listings** — Number of products you've listed today
- **Spec Added** — Number of specs you've added
- **QC Approved** — Number of quality-check approvals

Below that you'll see:

- **Target** — Daily goal for each metric (set by admin)
- **Version** — Current extension version
- **Last Sync** — When data was last sent to the server

### QC Tracking: Approved vs Rejected

- **Single approve/reject:** Tracked individually when you click the approve or reject button on a product
- **Bulk approve:** The extension reads `approved` from the response `{ data: { approved: N } }` and records 1 event with `bulk_count: N`
- **Bulk reject:** The extension reads `rejected` from the response `{ data: { rejected: N } }` and records 1 event with `bulk_count: N`

All QC events are counted correctly in analytics using the `bulk_count` field.

### Admin: Clear QC Pending

If you're an admin, the popup shows a **Clear QC Pending** button. This deletes stored QC pending records — useful after mass QC operations.

### Sync

The extension syncs automatically every 5 minutes. You can also click **Sync Now** in the popup to force an immediate sync.

### Update Banner

When a new extension version is available, a banner appears in the popup with the version number and changelog. Download the latest `extension.zip` from the web app and reinstall.

### Auth Failures

If the extension gets 3 consecutive 401 (unauthorized) responses from the API, it logs you out automatically. Re-sign in from the popup.

### Event Queue & Recovery

If the extension context becomes invalid (e.g., after a Chrome update), events are queued in `chrome.storage.local`. When the context recovers, queued events are drained and sent. Orphaned sessions (crashed tabs) are also recovered on the next page load.

---

## Troubleshooting

### "Extension not tracking"

1. Check you're logged in — open the popup
2. Verify you're on `commerce.thecanbrand.com` or `demo.commerce.thecanbrand.com`
3. Check the browser console (F12 → Console) for `[BD Tracker]` logs
4. Reinstall the extension from the web app

### "Stats show 0"

1. You may not have done any tracked activity yet
2. Check the extension popup's Last Sync time — click **Sync Now**
3. Verify the backend is online

### "Follow-ups not showing"

1. Switch to the **Follow-up** tab on Leads or Vendors page
2. Check that you have activities with scheduled follow-up dates
3. Auto follow-ups appear separately below the main list

### "Can't see a page"

Ask your admin to check your role permissions. Some pages require specific permissions (e.g., Users page needs `users.view`).

### "Bulk QC count seems wrong"

Bulk QC events use the response's `approved` or `rejected` count — not the number of products you selected. If the API response says `approved: 4` but you selected 5, the count will be 4 (the other 1 was already approved).

---

## Setup (Developers)

### Prerequisites

- Node.js 18+
- MongoDB (local or Atlas)
- npm

### Backend

```bash
cd backend
npm install
cp .env.example .env   # Configure your environment
npm run dev            # Starts on port 5000
npm run seed           # Seed initial data
```

### Frontend

```bash
cd frontend
npm install
npm run dev            # Starts on port 5173
```

### Extension (local development)

1. Edit `backend/public/extension/config.js` and change `API_BASE_URL` to `http://localhost:5000/api/v1`
2. Rebuild the zip:
   ```bash
   cd backend/public/extension
   rm -f extension.zip && zip -r extension.zip . -x "*.zip"
   ```
3. Load the unpacked extension in Chrome
4. To verify the extension is running your local code, check the console for `[BD Tracker v1.0.12-bulkcnt]`

### Deploy

- **Frontend:** `npm run build` → deploy `dist/` to Vercel/Netlify
- **Backend:** Deploy to Vercel as a serverless function. Note: Vercel Hobby has a 10s function timeout; MongoDB Atlas free tier requires 3–8s cold connection
