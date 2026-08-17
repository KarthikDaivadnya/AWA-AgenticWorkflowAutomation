# Agentic Workflow Automation Tool

An AI-powered SaaS platform for building and running chains of AI agent
steps — summarize, extract, classify, draft a reply, or run a custom
prompt — where each step's output feeds the next step's input.

**Stack:** React (Vite) · Node.js/Express · AWS (S3 + DynamoDB, deployment-ready) · Socket.io · Claude (Anthropic API) · SQLite (local dev)

## Why this exists

Chains AI agent steps into a reusable pipeline with a visual builder,
live execution tracking over WebSockets, and a real path to cloud
deployment — not just a Jupyter notebook demo.

## Quick start (local, no AWS needed)

**Backend**
```bash
cd backend
cp .env.example .env
# edit .env: set JWT_SECRET and ANTHROPIC_API_KEY
npm install
npm run dev
```
Runs on `http://localhost:4000`.

**Frontend**
```bash
cd frontend
npm install
npm run dev
```
Runs on `http://localhost:5173`.

Register an account, create a workflow (e.g. Summarize → Classify),
paste some text, and watch it execute step by step in real time.

## Project structure

```
backend/
  src/routes/        auth, workflows, runs
  src/services/       agentService (Claude calls), storageService (local/S3)
  src/db/             SQLite schema, mirrors the DynamoDB item shape
  src/ws/             Socket.io live run updates
frontend/
  src/pages/          Auth, Dashboard, WorkflowBuilder, RunView
  src/context/        auth state
  src/theme.css        design tokens (dark control-panel aesthetic)
aws/
  dynamodb-table.json, iam-policy.json, README.md   deployment-ready AWS config
.github/workflows/
  deploy.yml          CI/CD to Elastic Beanstalk
```

## Deploying to AWS

See [`aws/README.md`](aws/README.md) for the full architecture and
step-by-step deployment guide (S3, DynamoDB, Elastic Beanstalk, IAM,
CI/CD).

## Notes

- Local mode uses SQLite + disk storage — zero AWS cost to develop or demo.
- The SQLite schema is deliberately shaped to map 1:1 onto the DynamoDB
  single-table design, so the storage layer swap is contained to
  `storageService.js` rather than spread across route logic.
- Agent step chaining (output → next input) is what makes this
  "agentic" rather than a single LLM call — see `agentService.js`.
