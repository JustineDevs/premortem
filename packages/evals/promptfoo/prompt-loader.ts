import fs from 'node:fs/promises';
import path from 'node:path';

async function loadSpecialistFloor() {
  const floorPath = path.resolve(process.cwd(), '.agents/prompts/specialist-floor.md');
  try {
    const floor = await fs.readFile(floorPath, 'utf8');
    return floor.trim();
  } catch {
    return '';
  }
}

async function loadWorkflowContract() {
  const contractPath = path.resolve(process.cwd(), '.agents/prompts/workflow-contract.md');
  try {
    const contract = await fs.readFile(contractPath, 'utf8');
    return contract.trim();
  } catch {
    return '';
  }
}

export default async function loadPrompt(context) {
  const promptPath = context?.vars?.promptPath;
  if (typeof promptPath !== 'string' || promptPath.trim().length === 0) {
    throw new Error('promptPath is required for promptfoo dynamic prompt loading.');
  }

  const absolutePath = path.resolve(process.cwd(), promptPath);
  const floorPath = path.resolve(process.cwd(), '.agents/prompts/specialist-floor.md');
  const workflowContractPath = path.resolve(process.cwd(), '.agents/prompts/workflow-contract.md');

  if (absolutePath === floorPath || absolutePath === workflowContractPath) {
    return fs.readFile(absolutePath, 'utf8').then((promptText) => promptText.trim());
  }

  const [specialistFloor, workflowContract, promptText] = await Promise.all([
    loadSpecialistFloor(),
    loadWorkflowContract(),
    fs.readFile(absolutePath, 'utf8')
  ]);

  const parts = [specialistFloor, workflowContract, promptText].filter(
    (part) => typeof part === 'string' && part.trim().length > 0
  );

  return parts.join('\n\n');
}
