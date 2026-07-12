#!/usr/bin/env python3
import json
import sys

from neo4j_store import write_episode


def main() -> None:
    payload = json.loads(sys.stdin.read())
    write_episode(payload)


if __name__ == '__main__':
    main()
