# MapVibe

## Overview
MapVibe is a modern web application built using a monorepo architecture. It leverages the power of AWS for infrastructure and serverless functions, with a high-performance frontend built with React and Vite.

## Architecture
The project is organized as a monorepo using **TurboRepo** and **Bun**, ensuring fast builds and efficient dependency management.

### Structure
- **apps/**
  - `web`: The main frontend application built with React 19, Vite, and TailwindCSS.
- **packages/**
  - `api-functions`: Backend logic and serverless functions (AWS Lambda).
  - `database`: Database interaction layer using Kysely and PostgreSQL.
  - `ui-components`: Shared React UI component library.
  - `types`: Shared TypeScript definitions.
  - `utils`: Common utility functions.
  - `constants`: Shared application constants.
  - `eslint-config`: Shared ESLint configuration.
- **infrastructure/**: Infrastructure as Code (IaC) for AWS deployments.

## Tech Stack
- **Runtime**: Bun / Node.js
- **Language**: TypeScript
- **Frontend**: React 19, Vite, TailwindCSS, Lucide React
- **Backend**: AWS Lambda, Node.js
- **Database**: PostgreSQL, Kysely (Type-safe SQL builder)
- **Tools**: TurboRepo, Prettier, ESLint

## Getting Started
1. Install dependencies:
   ```bash
   bun install
   ```
2. Start development server:
   ```bash
   bun run dev
   ```
3. Build for production:
   ```bash
   bun run build
   ```
