export class DisjointSet {
  private readonly parent: number[];
  private readonly rank: number[];

  constructor(size: number) {
    this.parent = Array.from({ length: size }, (_, index) => index);
    this.rank = Array.from({ length: size }, () => 0);
  }

  find(index: number): number {
    const parent = this.parent[index];
    if (parent === undefined) {
      throw new RangeError(`DisjointSet index out of bounds: ${index}`);
    }
    if (parent !== index) {
      this.parent[index] = this.find(parent);
    }
    return this.parent[index]!;
  }

  union(a: number, b: number): void {
    let rootA = this.find(a);
    let rootB = this.find(b);
    if (rootA === rootB) return;

    if (this.rank[rootA]! < this.rank[rootB]!) {
      [rootA, rootB] = [rootB, rootA];
    }

    this.parent[rootB] = rootA;
    if (this.rank[rootA]! === this.rank[rootB]!) {
      this.rank[rootA] = this.rank[rootA]! + 1;
    }
  }
}
