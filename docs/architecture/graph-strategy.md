# Graph strategy

Neo4j is the canonical graph store for repository topology, audit history, and risk context.

- Define stable node and edge conventions.
- Retain snapshots per audit run.
- Support graph diff between current and previous audit.
- Add queries for changed critical paths, highest blast radius, and recurring findings across audits.
- Rebuild graph snapshots from ingestion when indexes drift.
