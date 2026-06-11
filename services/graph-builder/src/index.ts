export const serviceName = '@premortem/graph-builder';

export {
  isNeo4jGraphEnabled,
  readGraphSnapshotFromNeo4j,
  writeGraphSnapshotToNeo4j,
  writeGraphSnapshotToNeo4j as writeGraphSnapshot
} from './neo4j/client';
