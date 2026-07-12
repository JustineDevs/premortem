#!/usr/bin/env python3
import json
import sys

from neo4j_store import search_episodes


def main() -> None:
    payload = json.loads(sys.stdin.read())
    print(json.dumps(search_episodes(payload)))


if __name__ == '__main__':
    main()
