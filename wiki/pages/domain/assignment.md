---
title: Assignment — Backslash backend home exercise
category: domain
tags: [requirements]
sources: [raw/home-exercise.pdf]
updated: 2026-10-22
---

## Requirements

- Load the JSON graph of Train Ticket microservices (https://github.com/FudanSELab/train-ticket). See [[graph-data]].
- Build a basic query engine on top of it.
- RESTful API that returns a graph structure that is easy to render client-side.
- Filter **routes** between services by:
  - start in a public service (`publicExposed: true`)
  - end in a sink (rds/sql)
  - have a vulnerability in one of the nodes
- API must be as generic as possible so more filters can be added easily.

## Deliverables

1. README: short explanation of the solution, decisions, assumptions.
2. Git repo with the implementation (TypeScript preferred).

> ❓ OPEN: are filters combined with AND or OR? Assumed AND (intersection), see spec.
