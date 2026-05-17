# Execution flow

## Build sequence

```
Owner                AgentPhone      Orchestrator        Codegen         Site (:5173)
  │                       │               │                 │                │
  │── call ──────────────►│               │                 │                │
  │                       │── webhook ───►│                 │                │
  │◄─ intake questions ───┤◄──────────────┤ (Claude convo)   │                │
  │── answers ───────────►│── webhook ───►│                 │                │
  │                       │               │─ profile.json   │                │
  │                       │               │── buildInitial ►│                │
  │                       │               │                 │── clone+fill ─►│
  │                       │               │                 │── git init ───►│
  │◄─ "site is ready" ────┤◄──────────────┤◄── EditResult ──┤   Vite HMR     │
  │                       │               │                 │                │
```

## Edit loop

```
Owner          AgentPhone     Orchestrator       Whiteboard      Codegen      Site
  │── "darker green" ──────────►│                    │             │           │
  │                             │── applyEdit ──────────────────► │           │
  │                             │                    │             │─ edit ──►│
  │◄─ ack + summary ────────────┤◄── EditResult ──────────────────┤  HMR      │
  │                             │                    │             │           │
  │◄─ whiteboard link (iMessage)┤                    │             │           │
  │── opens link, draws ───────────────────────────► │             │           │
  │                             │◄── annotated PNG ──┤             │           │
  │                             │── applyEdit(png) ──────────────► │           │
  │◄─ ack ──────────────────────┤◄── EditResult ──────────────────┤  HMR      │
```

## Act 2 — operate mode

```
state: LIVE ──► owner confirms ──► OPERATING
                                       │
Customer ── call ──► AgentPhone ──► orchestrator routes by state ──► merchant-agent
                                       │
                     answers from profile.json (hours, products, address)
```

Same AgentPhone number. The orchestrator routes inbound calls by the business
state: `REVISING`/`BUILDING` → builder flow; `OPERATING` → merchant ops agent.
