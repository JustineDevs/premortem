#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import re
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from neo4j import GraphDatabase


@dataclass(frozen=True)
class Neo4jConfig:
    uri: str
    username: str
    password: str


def neo4j_config() -> Neo4jConfig:
    return Neo4jConfig(
        uri=os.getenv('NEO4J_URI') or 'bolt://localhost:7687',
        username=os.getenv('NEO4J_USERNAME') or 'neo4j',
        password=os.getenv('NEO4J_PASSWORD') or 'password12345',
    )


def open_driver():
    config = neo4j_config()
    return GraphDatabase.driver(config.uri, auth=(config.username, config.password))


def ensure_schema(driver) -> None:
    with driver.session() as session:
        session.run(
            """
            CREATE CONSTRAINT premortem_graphiti_episode_uuid IF NOT EXISTS
            FOR (episode:PremortemGraphitiEpisode)
            REQUIRE episode.uuid IS UNIQUE
            """
        )
        session.run(
            """
            CREATE CONSTRAINT premortem_graphiti_fact_uuid IF NOT EXISTS
            FOR (fact:PremortemGraphitiFact)
            REQUIRE fact.uuid IS UNIQUE
            """
        )
        session.run(
            """
            CREATE INDEX premortem_graphiti_fact_project_id IF NOT EXISTS
            FOR (fact:PremortemGraphitiFact)
            ON (fact.project_id)
            """
        )


def _coerce_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    result: list[str] = []
    for item in value:
        if isinstance(item, str):
            stripped = item.strip()
            if stripped:
                result.append(stripped)
        elif item is not None:
            result.append(str(item))
    return result


def _fact_text(entry: dict[str, Any]) -> str:
    parts: list[str] = []
    for key in ('summary', 'category', 'severity', 'fact'):
        value = entry.get(key)
        if isinstance(value, str) and value.strip():
            parts.append(value.strip())
    trigger_conditions = entry.get('trigger_conditions')
    if isinstance(trigger_conditions, list):
        parts.extend(str(item).strip() for item in trigger_conditions if str(item).strip())
    dedupe_keys = entry.get('dedupe_keys')
    if isinstance(dedupe_keys, list):
        parts.extend(str(item).strip() for item in dedupe_keys if str(item).strip())
    return ' '.join(parts).strip()


def _normalize_body(body: Any) -> list[dict[str, Any]]:
    if not isinstance(body, list):
        return []
    normalized: list[dict[str, Any]] = []
    for item in body:
        if isinstance(item, dict):
            normalized.append(item)
    return normalized


def _iso_value(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, str):
        return value
    if hasattr(value, 'isoformat'):
        return value.isoformat()
    return str(value)


def write_episode(payload: dict[str, Any]) -> None:
    driver = open_driver()
    ensure_schema(driver)
    reference_time = payload.get('reference_time')
    if isinstance(reference_time, str) and reference_time:
        reference_time_value = reference_time
    else:
        reference_time_value = datetime.now(timezone.utc).isoformat()

    episode_uuid = str(uuid.uuid4())
    facts = _normalize_body(payload.get('body'))
    with driver.session() as session:
        session.run(
            """
            CREATE (episode:PremortemGraphitiEpisode {
              uuid: $episode_uuid,
              project_id: $project_id,
              name: $name,
              source_description: $source_description,
              reference_time: datetime($reference_time),
              body_json: $body_json,
              created_at: datetime()
            })
            RETURN episode.uuid AS uuid
            """,
            episode_uuid=episode_uuid,
            project_id=str(payload.get('project_id') or ''),
            name=str(payload.get('name') or f'audit:{payload.get("project_id")}:episode'),
            source_description=str(payload.get('source_description') or ''),
            reference_time=reference_time_value,
            body_json=json.dumps(facts, ensure_ascii=False),
        ).single()

        def create_fact(session, index: int, entry: dict[str, Any]) -> None:
            fact_uuid = str(uuid.uuid4())
            fact_text = _fact_text(entry) or f"{entry.get('category', 'finding')}:{entry.get('summary', '')}"
            search_text = fact_text.lower()
            session.run(
                """
                MATCH (episode:PremortemGraphitiEpisode {uuid: $episode_uuid})
                CREATE (fact:PremortemGraphitiFact {
                  uuid: $fact_uuid,
                  project_id: $project_id,
                  episode_uuid: $episode_uuid,
                  episode_name: $episode_name,
                  position: $position,
                  fact: $fact,
                  summary: $summary,
                  category: $category,
                  severity: $severity,
                  trigger_conditions_json: $trigger_conditions_json,
                  dedupe_keys_json: $dedupe_keys_json,
                  source_description: $source_description,
                  reference_time: datetime($reference_time),
                  valid_at: $valid_at,
                  invalid_at: null,
                  search_text: $search_text,
                  created_at: datetime()
                })
                CREATE (episode)-[:HAS_FACT]->(fact)
                """,
                episode_uuid=episode_uuid,
                fact_uuid=fact_uuid,
                project_id=str(payload.get('project_id') or ''),
                episode_name=str(payload.get('name') or ''),
                position=index,
                fact=fact_text,
                summary=str(entry.get('summary') or entry.get('fact') or fact_text),
                category=str(entry.get('category') or ''),
                severity=str(entry.get('severity') or ''),
                trigger_conditions_json=json.dumps(entry.get('trigger_conditions') if isinstance(entry.get('trigger_conditions'), list) else [], ensure_ascii=False),
                dedupe_keys_json=json.dumps(entry.get('dedupe_keys') if isinstance(entry.get('dedupe_keys'), list) else [], ensure_ascii=False),
                source_description=str(payload.get('source_description') or ''),
                reference_time=reference_time_value,
                valid_at=reference_time_value,
                search_text=search_text,
            )

        for index, entry in enumerate(facts):
            create_fact(session, index, entry)

    driver.close()


def _tokenize(text: str) -> list[str]:
    return [token for token in re.findall(r'[a-z0-9]+', text.lower()) if len(token) > 2]


def _score_candidate(query: str, candidate: dict[str, Any]) -> float:
    haystack = ' '.join(
        str(candidate.get(key) or '')
        for key in ('fact', 'summary', 'category', 'search_text')
    ).lower()
    query_tokens = set(_tokenize(query))
    if not query_tokens:
        return 0.0

    haystack_tokens = set(_tokenize(haystack))
    overlap = len(query_tokens & haystack_tokens)
    score = float(overlap)
    if query.lower() in haystack:
        score += 1.0
    if candidate.get('severity'):
        score += 0.1
    return score


def search_episodes(payload: dict[str, Any]) -> list[dict[str, Any]]:
    driver = open_driver()
    try:
        with driver.session() as session:
            rows = session.run(
                """
                MATCH (fact:PremortemGraphitiFact {project_id: $project_id})
                RETURN fact.uuid AS uuid,
                       fact.fact AS fact,
                       fact.summary AS summary,
                       fact.category AS category,
                       fact.severity AS severity,
                       fact.valid_at AS valid_at,
                       fact.invalid_at AS invalid_at,
                       fact.search_text AS search_text
                ORDER BY fact.created_at DESC
                LIMIT $limit
                """,
                project_id=str(payload.get('project_id') or ''),
                limit=max(int(payload.get('num_results') or 10) * 10, 50),
            )
            candidates = [dict(row) for row in rows]

        query = str(payload.get('query') or '')
        scored = []
        for candidate in candidates:
            score = _score_candidate(query, candidate)
            if score <= 0:
                continue
            scored.append((score, candidate))

        scored.sort(
            key=lambda item: (item[0], _iso_value(item[1].get('valid_at')) or ''),
            reverse=True,
        )
        results: list[dict[str, Any]] = []
        for _, candidate in scored[: max(int(payload.get('num_results') or 10), 1)]:
            results.append(
                {
                    'uuid': str(candidate.get('uuid') or ''),
                    'fact': str(candidate.get('fact') or candidate.get('summary') or ''),
                    'valid_at': _iso_value(candidate.get('valid_at')),
                    'invalid_at': _iso_value(candidate.get('invalid_at')),
                }
            )
        return results
    finally:
        driver.close()
