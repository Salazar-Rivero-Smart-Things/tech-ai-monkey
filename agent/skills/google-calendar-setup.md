---
description: Use when the customer wants to connect their Google Calendar, set up Google Calendar integration, needs OAuth credentials for Google, or needs to enable the Calendar API.
---

# Guide a Customer Through Google Calendar API Setup

**Purpose:** Walk a non-technical customer through creating a Google Cloud project, enabling the Google Calendar API, configuring the OAuth consent screen, creating OAuth 2.0 credentials, and connecting those credentials to the agent's integration.

## Behavior Rules
- **No secrets in chat (CRITICAL):** NEVER ask the customer to paste their Client Secret or refresh token into chat.
- **No impersonation (CRITICAL):** NEVER attempt to perform the steps on the customer's behalf. You cannot access their Google account.
- **One step at a time:** Present one step at a time. Wait for explicit confirmation before continuing.
- **Define jargon:** Define technical terms in parentheses the first time they appear.
- **Stuck handling:** If the customer is stuck twice on the same step, surface the troubleshooting playbook.
- **Progress logging:** Track the current step id so the customer can resume later.
- **Abandon message:** If abandoned, remind the customer their project and credentials persist and can be resumed at https://console.cloud.google.com/.

## Prerequisites
- A Google account (personal Gmail or Google Workspace).
- Access to that account in the current browser session.
- Chrome, Edge, Firefox, or Safari on a desktop/laptop.
- Ability to receive email or SMS at the account for verification.
- Agreement to Google Cloud's terms (free tier is fine; no payment required).
- *If using Google Workspace, admin may need to allow API access (May require IT approval and delay setup).*

## Steps (Present One by One)

### Step 1: Create (or select) a Google Cloud Project
1. Open a browser and go to https://console.cloud.google.com/.
2. Sign in with the Google account they want to use.
3. Accept the Terms of Service if prompted.
4. In the top bar, click the project dropdown ('Select a project' or current project name).
5. Click 'NEW PROJECT' in the top-right of the dialog.
6. Project name: suggest something clear, e.g. 'calendar-agent-integration'.
7. Location: leave as 'No organization' unless they have a Workspace org and know which one to pick.
8. Click 'CREATE'.
9. Wait 10–30 seconds. When the notification appears, click 'SELECT PROJECT' (or select it from the dropdown).
*Check to continue:* Do you see the project name in the top bar of the Cloud Console?
*(If they don't see NEW PROJECT: They may not be signed in, or the console is in a different language. Refresh the page.)*
*(If Workspace account is blocked: IT admin must enable Cloud Console for the org.)*

### Step 2: Enable the Google Calendar API
1. In the Cloud Console, use the search bar at the top.
2. Type 'Google Calendar API' and press Enter.
3. Click the 'Google Calendar API' result (under Marketplace).
4. Click the blue 'ENABLE' button.
5. Wait for the page to reload — it will show 'API Enabled' and a 'MANAGE' button.
*Check to continue:* Does the page say 'API Enabled'?
*(Note: Calendar API alone covers reading/writing events and managing calendars. Do NOT enable extra APIs unless a later step requires them.)*

### Step 3: Configure the OAuth Consent Screen
1. Left sidebar: 'APIs & Services' → 'OAuth consent screen'.
2. User Type: choose 'External' for personal Gmail or non-org users; 'Internal' if ONLY Workspace org members will use it. Click 'CREATE'.
3. App information: set App name (e.g. 'My Calendar Agent'), User support email, and Developer contact email. Skip Logo/App domain for now.
4. Click 'SAVE AND CONTINUE'.
5. Scopes page: click 'ADD OR REMOVE SCOPES' and add ONLY the scopes the integration needs.
6. Click 'UPDATE', then 'SAVE AND CONTINUE'.
7. Test users page: if User Type = External and app is in Testing, add the connecting Google accounts (including the customer's own) under 'ADD USERS'. Click 'SAVE AND CONTINUE'.
8. Summary page: review and click 'BACK TO DASHBOARD'.
*Check to continue:* Does the OAuth consent screen dashboard show your app name and the scopes you added?
*(Warning: While the app is in 'Testing' mode, refresh tokens expire after 7 days. For long-term use, they should publish the app.)*

### Step 4: Create OAuth 2.0 Credentials
1. Left sidebar: 'APIs & Services' → 'Credentials'.
2. Click '+ CREATE CREDENTIALS' → 'OAuth client ID'.
3. Application type: 'Web application' if the integration runs on a server or web app (most common for AI agents). 'Desktop app' if it runs locally.
4. Name: e.g. 'Calendar Agent Web Client'.
5. Authorized JavaScript origins (Web app only): add the origin of their app, e.g. https://myagent.example.com or http://localhost:3000 for local dev.
6. Authorized redirect URIs (Web app only): add the EXACT callback URL the integration uses.
7. Click 'CREATE'.
8. In the dialog, click 'DOWNLOAD JSON' to save a copy, and copy the Client ID and Client Secret into a secure location (password manager, secrets vault).
*Check to continue:* Do you have the Client ID and Client Secret saved somewhere secure?
*(Security warning: Treat the Client Secret like a password. Never commit it to Git or paste it into chat. If leaked, go back to Credentials and reset the secret.)*

### Step 5: Provide Credentials to the Integration
1. Open the integration's configuration (env vars, settings page, or secrets manager).
2. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI.
3. Save and restart the integration if required.
4. Trigger the 'Connect Google Calendar' flow inside the integration.
5. On the Google consent screen, sign in and grant the requested scopes.
6. The integration should now show 'Connected'.
*Check to continue:* Does the integration show your Google account as connected?

### Step 6: (Optional) Publish the OAuth App
Use when: Customer needs refresh tokens valid longer than 7 days, or users outside the test-user list need to connect.
1. 'APIs & Services' → 'OAuth consent screen'.
2. Click 'PUBLISH APP' and confirm.
3. For sensitive scopes (like full calendar access), Google may require verification (privacy policy, homepage, demo video). Warn the customer this can take days. For internal Workspace apps, publishing is instant.

## Troubleshooting
- **Access blocked: This app's request is invalid:** Redirect URI mismatch. Fix: Copy the exact URI from the error and paste it into Authorized redirect URIs in the credential settings.
- **This app is blocked / not verified:** External app in Testing mode and user not added. Fix: Add the user under Test users, or publish the app.
- **invalid_grant after ~7 days:** Testing-mode refresh token expiry. Fix: Re-authorize, or publish the app (step 6).
- **API has not been used in project X before:** Calendar API not enabled. Fix: Re-do step 2 for the correct project.
- **Consent screen won't save:** Missing required fields. Fix: Fill every required field; re-check scopes.
- **Workspace user can't access Cloud Console:** Admin policy. Fix: Customer must ask their Workspace admin to allow Cloud Console + Calendar API access.
