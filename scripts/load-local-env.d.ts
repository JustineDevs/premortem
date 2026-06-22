export declare function resolvePremortemRepoRoot(startDir?: string): string;

export declare function loadPremortemLocalEnv(repoRoot?: string): string;

export declare function loadPremortemProductionEnv(repoRoot?: string): string;

export declare function loadPremortemEnvFiles(
  fileNames: string[],
  repoRoot?: string,
  options?: {
    override?: boolean;
  }
): void;
