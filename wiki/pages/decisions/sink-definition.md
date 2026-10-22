---
title: Decision — what is a sink
category: decisions
tags: [filters, sink]
sources: [raw/home-exercise.pdf]
updated: 2026-10-22
---

## Decision (2026-10-22)

Sink = node whose `kind` is in `SINK_KINDS = { rds }`. In this data that is only `prod-postgresdb`.

The assignment says "Sink (rds/sql)". `sqs` is a message queue, not a data store, so it is excluded. Adding it is a
one-line change to `SINK_KINDS`.
