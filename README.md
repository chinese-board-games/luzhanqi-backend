# luzhanqi-backend

Backend for the luzhanqi project.

## Environment

Ensure that you have VSCode installed, with ESLint and Prettier linting enabled on save.  
In your project directory, initialize a file `.env`:
Run

```bash
cat > .env << EOF
PORT=8080

MONGODB_USER=root
MONGODB_PASSWORD=alpine
MONGODB_DATABASE=luzhanqi
MONGODB_LOCAL_PORT=7017
MONGODB_DOCKER_PORT=27017

NODE_LOCAL_PORT=4000
NODE_DOCKER_PORT=8080
EOF
```

Install docker and docker-compose. Then run

Optionally, if you need to test real (non-anonymous) sign-in locally, also
add `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and
`FIREBASE_PRIVATE_KEY_B64` (base64-encoded service account private key) to
`.env` — ask a team member for a service account key. Without these,
anonymous play works fine but any request carrying a real auth token fails.

## Starting the server

`git clone` to copy repository files into your local.  
`docker-compose up`

## Deployment

- **Production**: https://luzhanqi-backend.onrender.com (Render, deploys
  from the `production` branch)
- **Staging**: https://luzhanqi-backend-staging.onrender.com (Render,
  deploys from `main`)

Merging a PR into `main` deploys to staging, then a GitHub Actions workflow
smoke-tests it and — if it passes — promotes it to production
automatically. See `AGENTS.md`'s "Deployment" section for the full flow,
and `CONTRIBUTORS.md` for the contribution workflow.
