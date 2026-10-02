# MTC container deployment

MTC uses one combined application image, `mtc-app`, for both the NestJS API and
the Next.js web application. This mirrors the ANSEI runtime model: the same image
is started with a different service role.

## Build the image

```bash
docker build \
  --build-arg API_URL=http://api:31000 \
  --build-arg VUTEQ_SSO_BASE_URL=https://sso.vuteq.co.id \
  --build-arg VUTEQ_SSO_PUBLIC_ORIGIN=https://mtc.example.com \
  -t mtc-app:local .
```

The image supports these commands:

- `api`: deploys pending Prisma migrations, then starts NestJS on port `31000`.
- `web`: starts the Next.js standalone server on port `31001`.
- `all`: starts both processes in one container. Production Compose should use
  separate API and web containers so each process has an independent health and
  restart lifecycle.

## Run with Compose

`docker-compose.yml` uses the same `mtc-app` image definition for the API and
web services while retaining independent runtime roles, health checks, ports,
secrets, and restart lifecycles.

```bash
docker compose up -d --build
```

To use an image already built or pulled by the deployment host:

```bash
MTC_IMAGE=your-dockerhub-user/mtc-app:production docker compose up -d --no-build
```

Do not put SSO connection secrets, database credentials, API keys, or session
secrets in Docker build arguments. Supply runtime secrets through the existing
environment or secret-management mechanism.

## GitHub Actions

`.github/workflows/ci-and-publish.yml` validates Prisma, applies migrations only
to its disposable PostgreSQL service, and runs lint, test, and build checks.
After a successful push validation, it publishes the combined `mtc-app` image to
Docker Hub with an immutable `sha-*` tag and a `production` or `staging` tag.

An automated Docker Hub publish job requires these GitHub Environment secrets:

- `DOCKERHUB_USERNAME`
- `DOCKERHUB_TOKEN`

Required GitHub Environment variables or secrets are `API_URL`,
`VUTEQ_SSO_BASE_URL`, and `VUTEQ_SSO_PUBLIC_ORIGIN`. Keep the `production` and
`staging` values in their corresponding GitHub Environments. The workflow does
not provide deployment URL fallbacks.
