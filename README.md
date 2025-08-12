# Operation Gold Star

This repository contains the early scaffolding for the Operation Gold Star platform.

## Development

### Requirements
- Node.js 20+
- Docker (optional for running services)

### Setup

Install dependencies:
```bash
npm install
```

Copy the environment file:
```bash
cp .env.example .env
```

Run the dev server:
```bash
npm run dev
```

The API exposes a health check at `GET /health`.

### Docker

To run the API along with Postgres and Redis:
```bash
docker-compose up --build
```

### Tests

```bash
npm test
```

### Lint

```bash
npm run lint
```
