import neo4j from 'neo4j-driver';

export interface Neo4jConfig {
  uri: string;
  username: string;
  password: string;
}

export function createNeo4jConfig(): Neo4jConfig {
  return {
    uri: process.env.NEO4J_URI ?? 'bolt://localhost:7687',
    username: process.env.NEO4J_USERNAME ?? 'neo4j',
    password: process.env.NEO4J_PASSWORD ?? 'password12345'
  };
}

export function createNeo4jDriver() {
  const config = createNeo4jConfig();
  return neo4j.driver(config.uri, neo4j.auth.basic(config.username, config.password));
}
