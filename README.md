# AHS-POC

Autonomous Haulage System (AHS) – Proof of Concept
Overview

This project is a full-stack Proof-of-Concept (POC) Autonomous Haulage System inspired by industrial fleet autonomy platforms such as:

Komatsu Autonomous Haulage System (AHS)

Caterpillar Inc. MineStar Command for hauling

The goal of this repository is to demonstrate the architectural, software engineering, and systems integration principles required to design, build, deploy, and maintain an autonomous fleet control system.

This project focuses on:

Fleet telemetry visualization

Operator command interface

Dispatch simulation

Vehicle state management

CI/CD workflow integration

Linux-based development environment (WSL Ubuntu)

Professional Git branching workflow


**🎯 Purpose**


This repository exists as a technical portfolio project to demonstrate:

Distributed system architecture design

Real-time telemetry processing

Operator UI development

DevOps & CI pipeline configuration

Linux-based development practices

GitHub-based collaborative workflow

**🏗 Architecture (Phase 0)**

ahs-poc/
│
├── ui/                     # Angular 21 Standalone frontend
│   ├── features/
│   ├── layout/
│   └── core/services/
│
├── .github/
│   └── workflows/
│       └── ci.yml          # GitHub Actions CI pipeline
│
└── services/               # (Phase 1+) Simulation + API layer


**🖥 Technology Stack**

Frontend

Angular 21 (Standalone Components)

TypeScript

CSS (separate files per component)

Angular Router

Dependency Injection (service-based architecture)

Backend (Planned – Phase 1+)

Node.js

REST API

WebSocket telemetry streaming

Fleet simulation engine

Dev Environment

Windows 11 Pro

WSL2 (Ubuntu Linux)

Node 24 LTS

Git (SSH configured)

CI/CD

GitHub Actions

Automated build + test pipeline


**🚀 Features (Phase 0)**


Dashboard overview (fleet KPIs)

Fleet table view

Telemetry panel (mock data)

Command interface (mock dispatch + stop)

Angular standalone architecture

CI pipeline for build + test

**🔜 Planned Phases**


**Phase 1**


Real simulation engine

WebSocket live telemetry

Dispatch state machine

Vehicle route simulation


**Phase 2**


Map integration

Geofencing

Command validation logic


**Phase 3**


Multi-vehicle scaling

Fleet optimization logic

Event logging & replay

**📦 Running Locally**

cd ahs-poc
npm install
npm start


Open:

http://localhost:4200

🔐 Development Workflow

WSL Ubuntu used as primary dev environment

SSH-based GitHub authentication

Branch-per-feature strategy

CI triggered on push to main

📘 Educational Focus

This project demonstrates practical understanding of:

Real-time control system UI architecture

Autonomous fleet state modelling

DevOps best practices

GitHub CI workflows

Cross-platform Linux development

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 21.1.4.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
