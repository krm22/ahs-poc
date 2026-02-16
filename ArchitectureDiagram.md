🚜 Autonomous Haulage System – Architecture Diagram
🧱 High-Level System Architecture
 ┌─────────────────────────────────────────────────────────────┐
 │                         OPERATOR UI                         │
 │                                                             │
 │  Angular v21 (Standalone)                                   │
 │  ┌───────────────────────────────────────────────────────┐   │
 │  │ Shell Layout                                         │   │
 │  │  ├── Dashboard                                       │   │
 │  │  ├── Fleet Panel                                     │   │
 │  │  ├── Map Component (MapLibre GL)                     │   │
 │  │  └── Command Console                                  │   │
 │  └───────────────────────────────────────────────────────┘   │
 │                                                             │
 │  Services:                                                  │
 │  • FleetService                                             │
 │  • SimulationService (Hybrid Mode)                          │
 │  • TelemetryService                                         │
 │  • CommandService                                           │
 └───────────────▲─────────────────────────────────────────────┘
                 │ HTTP / WebSocket (SignalR)
                 ▼
 ┌─────────────────────────────────────────────────────────────┐
 │                       .NET 8 BACKEND                        │
 │                                                             │
 │  ASP.NET Core Web API                                       │
 │                                                             │
 │  ┌───────────────────────────────────────────────────────┐   │
 │  │ FleetStateService (Authoritative State)              │   │
 │  │ SimulationEngineService (Optional Authority Mode)    │   │
 │  │ CommandDispatcher                                    │   │
 │  │ TelemetryHub (SignalR Ready)                         │   │
 │  └───────────────────────────────────────────────────────┘   │
 │                                                             │
 │  Responsibilities:                                          │
 │  • Truck state management                                  │
 │  • Route orchestration                                     │
 │  • Command validation                                      │
 │  • Telemetry broadcasting                                   │
 └───────────────▲─────────────────────────────────────────────┘
                 │
                 ▼
 ┌─────────────────────────────────────────────────────────────┐
 │                     SIMULATION LAYER                        │
 │                                                             │
 │  10 Autonomous Trucks                                       │
 │                                                             │
 │  Each Truck Contains:                                       │
 │  • Position (lat/lng)                                       │
 │  • Speed / Heading                                          │
 │  • Load State                                               │
 │  • Health State                                             │
 │  • Route Path                                               │
 │                                                             │
 │  Hybrid Model:                                              │
 │  Backend = Authority                                        │
 │  Frontend = Interpolation + Animation                       │
 └─────────────────────────────────────────────────────────────┘

🗺 Map & Visualization Layer
               Angular Map Component
                       │
                       ▼
        ┌────────────────────────────┐
        │  MapLibre GL Engine        │
        │  WebGL Rendering           │
        │  Vector Tiles              │
        │  Real-time Marker Updates  │
        └────────────────────────────┘
                       │
                       ▼
               Truck Position Stream

🔄 Data Flow Diagram
1️⃣ Telemetry Flow
Truck Simulation
      │
      ▼
Backend FleetStateService
      │
      ▼
SignalR Hub / REST Endpoint
      │
      ▼
Angular TelemetryService
      │
      ▼
Map + Dashboard Update

2️⃣ Command Flow
Operator Command (UI)
      │
      ▼
CommandService (Angular)
      │
      ▼
HTTP POST /command
      │
      ▼
CommandDispatcher (.NET)
      │
      ▼
FleetState Update
      │
      ▼
Telemetry Broadcast

🧠 Hybrid Simulation Model (Current State)
             Backend Authority
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
 Truck State Engine      Route Generator
        │
        ▼
    Telemetry Broadcast
        │
        ▼
 Frontend Interpolation (Smooth Animation)


This provides:

Deterministic fleet state

Smooth UI rendering

Low network overhead

Realistic vehicle motion

🧩 Component Interaction Diagram (Frontend)
AppComponent
   │
   ▼
ShellComponent
   │
   ├── DashboardComponent
   │      └── TelemetryService
   │
   ├── FleetComponent
   │      └── FleetService
   │
   └── MapComponent
          ├── MapLibre Instance
          ├── TelemetryService
          └── SimulationService

🏗 Deployment Architecture (Future Phase)
                ┌───────────────┐
                │  Angular Build│
                │  (ng build)   │
                └───────┬───────┘
                        ▼
                 Static Hosting
                        │
                        ▼
               Reverse Proxy (NGINX)
                        │
                        ▼
                 .NET API Server
                        │
                        ▼
                    PostgreSQL
                 (Future Expansion)

🔐 Development Environment Architecture
Windows 11
   │
   ▼
WSL2 (Ubuntu)
   │
   ├── Node LTS
   ├── Angular CLI
   ├── .NET SDK 8
   └── Git (SSH Auth)
            │
            ▼
        GitHub Repo

🎯 Architectural Philosophy

This system mirrors industrial AHS design principles:

Clear separation of UI and authority layer

Real-time telemetry streaming

Centralized command processing

Map-based operational awareness

Service-oriented backend

Event-driven updates

Inspired by real-world mining autonomy platforms such as:

Komatsu Autonomous Haulage System

Caterpillar Inc. MineStar™ Command