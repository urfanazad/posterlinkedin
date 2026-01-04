# MCP LinkedIn Poster (TypeScript)

An **MCP (Model Context Protocol) server** that allows ChatGPT / Claude Desktop to **post content to LinkedIn** using the official **LinkedIn UGC Posts API** and an **OAuth 2.0 access token**.

This server runs locally and is designed to be registered in your **ChatGPT / Claude MCP server settings**.

---

## What this does

- Runs an MCP server over **stdio**
- Accepts post requests from ChatGPT / Claude
- Publishes text posts to **your LinkedIn profile**
- Uses **LinkedIn OAuth (3-legged)** authentication
- Reads secrets securely via environment variables

---

## Project structure

mcp-linkedin-poster/
├─ src/
│ └─ index.ts # main MCP server (TypeScript source)
├─ dist/
│ └─ index.js # compiled output (what Node actually runs)
├─ .env # environment variables (DO NOT COMMIT)
├─ package.json
├─ tsconfig.json
└─ README.md

yaml
Copy code

### What is `dist`?
`dist` stands for **distribution**.  
It contains the compiled JavaScript output generated from TypeScript.

You **edit** `src/index.ts`  
You **run** `dist/index.js`

---

## Install

```bash
npm install
Build
Compile TypeScript → JavaScript:

bash
Copy code
npx tsc
This generates:

bash
Copy code
dist/index.js
Run locally (sanity check)
bash
Copy code
node dist/index.js
If environment variables are missing you will see:

bash
Copy code
Missing env LINKEDIN_ACCESS_TOKEN
Missing env LINKEDIN_AUTHOR_URN
That is expected until setup is complete.

Environment variables (.env)
Create a file named .env in the project root:

env
Copy code
LINKEDIN_ACCESS_TOKEN=
LINKEDIN_AUTHOR_URN=
LINKEDIN_VERSION=202502
What each variable is
Variable	Description
LINKEDIN_ACCESS_TOKEN	OAuth 2.0 member access token from LinkedIn
LINKEDIN_AUTHOR_URN	Your LinkedIn profile URN (urn:li:person:...)
LINKEDIN_VERSION	LinkedIn API version header (optional, safe to keep)

⚠️ Never commit .env
Add it to .gitignore.

How to get LINKEDIN_ACCESS_TOKEN
Go to https://www.linkedin.com/developers/

Open your LinkedIn app

Use OAuth 2.0 → Token Generator

Select scope:

w_member_social (required for posting)

Generate token

Copy it as a single line

Paste into .env:

env
Copy code
LINKEDIN_ACCESS_TOKEN=PASTE_TOKEN_HERE
How to get LINKEDIN_AUTHOR_URN
Method (recommended): LinkedIn userinfo endpoint
Curl
bash
Copy code
curl -X GET "https://api.linkedin.com/v2/userinfo" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json"
Example response:

json
Copy code
{
  "sub": "8qD1tr1-1m",
  "name": "Your Name"
}
Your author URN becomes:

env
Copy code
LINKEDIN_AUTHOR_URN=urn:li:person:8qD1tr1-1m
Windows PowerShell version
powershell
Copy code
$token="YOUR_ACCESS_TOKEN"
Invoke-RestMethod `
  -Uri "https://api.linkedin.com/v2/userinfo" `
  -Headers @{ Authorization = "Bearer $token" }
Example: LinkedIn post via curl (UGC API)
bash
Copy code
curl -X POST "https://api.linkedin.com/v2/ugcPosts" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "X-Restli-Protocol-Version: 2.0.0" \
  -H "Content-Type: application/json" \
  -d '{
    "author": "urn:li:person:YOUR_PERSON_ID",
    "lifecycleState": "PUBLISHED",
    "specificContent": {
      "com.linkedin.ugc.ShareContent": {
        "shareCommentary": { "text": "Hello from MCP 🚀" },
        "shareMediaCategory": "NONE"
      }
    },
    "visibility": {
      "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
    }
  }'
A 201 Created response means success.

Registering this server in ChatGPT / Claude MCP
Add this to your MCP config:

json
Copy code
{
  "mcpServers": {
    "linkedin_poster": {
      "command": "node",
      "args": [
        "C:\\Users\\User\\Desktop\\mcp-linkedin-poster\\dist\\index.js"
      ],
      "env": {
        "LINKEDIN_ACCESS_TOKEN": "PASTE_TOKEN_HERE",
        "LINKEDIN_AUTHOR_URN": "urn:li:person:PASTE_ID_HERE",
        "LINKEDIN_VERSION": "202502"
      }
    }
  }
}
Restart ChatGPT / Claude Desktop after saving.

Common errors & fixes
❌ Missing env LINKEDIN_ACCESS_TOKEN
.env not created

MCP config missing env

Token pasted with line breaks

❌ Invalid OAuth 2.0 Access Token (code 190)
Token expired

Wrong app

Missing w_member_social scope

Regenerate token.

❌ PowerShell header error
Use a hashtable, not a string:

powershell
Copy code
-Headers @{ Authorization = "Bearer $token" }
❌ Node cannot find dist/index.js
Run commands from the project root, not src/.

Correct:

bash
Copy code
node dist\index.js
Wrong:

bash
Copy code
node src\dist\index.js
Security notes
Treat LinkedIn tokens like passwords

Do not commit secrets

Prefer MCP environment injection over .env in production
**
for CLAUDE

    "linkedin_poster": {
      "command": "node",
      "args": [
        "C:\\Users\\User\\Desktop\\mcp-linkedin-poster\\dist\\index.js"
      ],
      "env": {
        "LINKEDIN_ACCESS_TOKEN": "",
        "LINKEDIN_AUTHOR_URN": "urn:li:person:",
        "LINKEDIN_VERSION": "202502"
