import { test, expect } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { PRODUCTION_COMMANDS, commandExecutionPolicy } from '../../src/cli/command-registry';
import { createProductionCommandRuntime } from '../../src/cli/runtime';
import { executeCommand } from 'halfcode-lite-cli-logic';
test('actual production command/profile pairs use required capabilities without starting live owners', async () => {
    const root = await mkdtemp(join(tmpdir(), 'production-profile-proof-'));
    try {
        for (const args of [['Resource', 'tree'], ['Resource', 'validate'], ['SOP', 'list'], ['Page', 'list'], ['LocalFunction', 'list'], ['BrowserWebApi', 'list'], ['mcp-app', 'config']]) {
            const runtime = createProductionCommandRuntime(root, commandExecutionPolicy(args));
            try {
                expect('httpServer' in runtime).toBe(false);
                const result = await executeCommand(PRODUCTION_COMMANDS, args, runtime);
                expect(result.code).toBe(0);
            }
            finally {
                await runtime.close?.();
            }
        }
    }
    finally {
        await rm(root, { recursive: true, force: true });
    }
});
