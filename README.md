# AHS-POC

🚜 Autonomous Haulage System (AHS) – Proof of Concept
📌 Project Overview

This project is a Proof of Concept Autonomous Haulage System (AHS) inspired by:

Komatsu Autonomous Haulage System

Caterpillar Inc. MineStar™ Command

The objective is to mimic real-world mining fleet autonomy systems in both:

Functionality

Architecture

Technology stack

Deployment workflow

UI/UX design philosophy

This POC demonstrates knowledge in:

Fleet autonomy simulation

Real-time telemetry systems

Map-based vehicle tracking

Backend command orchestration

Angular enterprise architecture

.NET microservice backend

DevOps via WSL + GitHub SSH

🏗 System Architecture
🖥 Frontend (Operator Control System)

Framework: Angular v21
Architecture Style: Standalone Components
Rendering Model: Modern bootstrapApplication (no NgModules)
Mapping Engine: MapLibre GL JS

Architectural Decisions

Standalone components (no AppModule)

Separate .ts, .html, .css files

Feature-based folder structure

Service isolation per domain

Dependency Injection via providedIn: 'root'

Reactive state using RxJS

Application Structure
src/app/
│
├── layout/
│   └── shell/
│
├── features/
│   ├── dashboard/
│   ├── fleet/
│   └── map/
│
├── services/
│   ├── fleet.service.ts
│   ├── simulation.service.ts
│   ├── telemetry.service.ts
│   └── command.service.ts
│
└── models/

🚛 Hybrid Fleet Simulation (Current State)

The system simulates 10 autonomous haul trucks using a Hybrid model:

🟢 What “Hybrid” Means in This POC

Backend authoritative control

Frontend interpolation for smooth motion

Simulated GPS + telemetry stream

Realistic haul cycles (Load → Haul → Dump → Return)

🔟 Fleet Simulation Details

Each truck contains:

ID

Position (lat/lng)

Speed

Heading

Load state

Health state

Autonomous mode status

Route path

Trucks are simulated with:

Randomized start positions

Path interpolation

Status transitions

Time-based event updates

🗺 Map System
🌍 Map Engine

Powered by:

MapLibre GL JS

Why MapLibre?

Open-source alternative to Mapbox

Industrial mapping flexibility

Supports vector tiles

Real-time marker updates

WebGL rendering performance

📍 Map Capabilities (Current)

10 live moving trucks

Real-time position updates

Smooth animation

Route polylines

Fleet zoom and pan

Click-to-select vehicle

Telemetry popup display

📡 Backend (.NET Core)
⚙️ Framework

ASP.NET Core Web API

REST + WebSocket ready

Service-based architecture

🔁 Backend Responsibilities

Fleet state authority

Simulation engine (optional)

Telemetry broadcast

Command processing

Event logging

🧠 Backend Services

FleetStateService

SimulationEngineService

CommandDispatcher

TelemetryHub (SignalR-ready)

📊 Dashboard System

The dashboard represents a mine operations control room interface.

Current Components

Fleet Status Summary

Active vs Idle Trucks

Haul Cycle State Distribution

System Health Overview

Autonomous vs Manual Count

Future upgrades:

Production metrics

Tonnage moved

Utilization %

Heatmaps

🛰 Real-Time Communication Layer

Current Mode:

Simulated internal service streaming

Planned:

SignalR WebSocket streaming

Event-driven backend updates

Command acknowledgment system

🧩 Angular Architecture Details
🏗 Bootstrapping Style
bootstrapApplication(AppComponent, appConfig)


No NgModule used.

🧠 Dependency Injection

All services use:

@Injectable({
  providedIn: 'root'
})


Ensures:

Singleton instances

Clean dependency graph

Easy testing

📁 Component Pattern

Each component contains:

component.ts
component.html
component.css


Example:

map.component.ts
map.component.html
map.component.css

🧪 Simulation Modes
Mode	Description
Frontend Only	Simulated in Angular
Backend Driven	Server authoritative
Hybrid (Current)	Mixed model
🔐 Dev Workflow
🖥 Development Environment

Windows 11

WSL2 (Ubuntu)

Node LTS

.NET 8 SDK

🔑 GitHub via SSH (WSL)

Workflow:

ssh-keygen -t ed25519
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_ed25519


Add public key to GitHub.

Clone via:

git clone git@github.com:username/ahs-poc.git

📦 Project Phases
✅ Phase 0 – Architecture Setup

Angular v21 standalone

Shell layout

Routing configured

✅ Phase 1 – Fleet Simulation

10 trucks

Hybrid simulation

Route logic

✅ Phase 2 – Map Integration

MapLibre integrated

Live truck markers

Animated movement

🔜 Phase 3 – Backend Authority

Move simulation to .NET

WebSocket telemetry

🔜 Phase 4 – Command & Control

Dispatch commands

Route reassignment

Manual override mode

🔜 Phase 5 – Production Metrics

Tonnage tracking

Efficiency analysis

Event logging

🎯 Project Goals

This POC demonstrates:

Enterprise Angular architecture

Real-time vehicle systems

Mining fleet simulation logic

Map-based telemetry visualization

Backend authoritative control design

Clean GitOps workflow

Industrial system replication capability

📈 Future Expansion

Collision avoidance logic

Traffic management AI

Geofencing zones

Obstacle detection simulation

Operator override console

Authentication & role-based access

Docker deployment

Kubernetes orchestration

🏁 Current Status Summary
System	Status
Angular Architecture	✅ Complete
MapLibre Integration	✅ Working
10 Truck Simulation	✅ Working
Hybrid Mode	✅ Active
.NET Backend	⚙️ Partial
WebSocket Streaming	🔜 Planned
Command Center	🔜 Planned
👨‍💻 Author

Karl Mouat
