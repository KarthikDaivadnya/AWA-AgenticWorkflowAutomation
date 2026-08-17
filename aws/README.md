# AWS Deployment

This app runs entirely on local storage (SQLite + disk) by default so it's
runnable in five minutes with no cloud account. Flipping `STORAGE_MODE=aws`
in `backend/.env` swaps file uploads to S3 — the DynamoDB swap for the
database is scaffolded (see `dynamodb-table.json`) but not required to
demo the app.

## Architecture

```
React (Vite) ──▶ CloudFront + S3 (static hosting)
                       │
                       ▼
        API Gateway / ALB ──▶ Elastic Beanstalk (Node.js/Express)
                                       │
                         ┌─────────────┼─────────────┐
                         ▼             ▼             ▼
                    DynamoDB         S3          Anthropic API
                 (workflows/runs)  (uploads)     (agent steps)
```

## Steps to deploy for real

1. **S3 bucket for uploads**
   ```
   aws s3 mb s3://agentic-workflow-uploads --region ap-south-1
   ```

2. **DynamoDB table**
   ```
   aws dynamodb create-table --cli-input-json file://dynamodb-table.json
   ```

3. **IAM role** — attach `iam-policy.json` to the role your compute
   (Elastic Beanstalk instance profile, or Lambda execution role) assumes.

4. **Backend compute** — simplest path is Elastic Beanstalk (Node.js
   platform): `eb init`, `eb create agentic-workflow-prod`. The GitHub
   Actions workflow in `.github/workflows/deploy.yml` deploys on every
   push to `main` once `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`
   secrets are set on the repo.

5. **Frontend** — `npm run build` in `frontend/`, then:
   ```
   aws s3 sync dist/ s3://your-frontend-bucket --delete
   ```
   Put CloudFront in front of that bucket for HTTPS + caching.

6. **Env vars on the EB environment**: `STORAGE_MODE=aws`, `AWS_REGION`,
   `S3_BUCKET_NAME`, `DYNAMODB_TABLE_NAME`, `ANTHROPIC_API_KEY`,
   `JWT_SECRET`, `CORS_ORIGIN` (your CloudFront URL).

## Why this shape

- **DynamoDB single-table design** keeps read/write costs near-zero at
  portfolio-project traffic and is the standard serverless-friendly
  pattern interviewers ask about.
- **S3 + presigned uploads** avoids routing large files through your
  compute layer.
- **Elastic Beanstalk over raw EC2** because it gives you rolling
  deploys and health checks without hand-rolling infra — a reasonable
  "I know when not to over-engineer" talking point.
