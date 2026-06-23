import type { FastifyInstance } from 'fastify';
import * as fs from 'fs';
import * as path from 'path';
import { GLOBAL_TOOL_DEFINITIONS } from './ai/toolDefinitions.js';
import { checkBagSafetyTool } from './tools/checkBagSafety.js';
import { validateStashSafetyTool } from './tools/validateStashSafety.js';
import { calculateFifoScheduleTool } from './tools/calculateFifoSchedule.js';

export async function appRoutes(fastify: FastifyInstance) {
  fastify.get('/api/tools', async (_request, reply) => {
    return reply.code(200).send({
      version: '1.0.0',
      name: 'milk-drop-planner-skill',
      description: 'Breast milk storage safety checker and FIFO feeding schedule generator. Based on CDC & AAP guidelines.',
      commands: [
        {
          name: 'milk-drop-planner',
          endpoint: '/api/commands/milk-drop-planner',
          method: 'POST',
          description: 'Initializes the MilkDrop Planner flow. Returns the opening greeting.',
        },
      ],
      tools: GLOBAL_TOOL_DEFINITIONS,
    });
  });

  fastify.post('/api/commands/milk-drop-planner', async (_request, reply) => {
    return reply.code(200).send({
      command: 'milk-drop-planner',
      status: 'initialized',
      message: "🍼 MilkDrop Planner ready. Let's check your breast milk stash.",
      next_step: 'onboarding',
    });
  });

  fastify.post('/api/tools/check-bag-safety', async (request, reply) => {
    try {
      const result = checkBagSafetyTool(request.body);
      return reply.code(result.success ? 200 : 400).send(result);
    } catch (error: unknown) {
      fastify.log.error(error);
      return reply.code(500).send({ success: false, error: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' });
    }
  });

  fastify.post('/api/tools/validate-stash-safety', async (request, reply) => {
    try {
      const result = validateStashSafetyTool(request.body);
      return reply.code(result.success ? 200 : 400).send(result);
    } catch (error: unknown) {
      fastify.log.error(error);
      return reply.code(500).send({ success: false, error: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' });
    }
  });

  fastify.post('/api/tools/calculate-fifo-schedule', async (request, reply) => {
    try {
      const result = calculateFifoScheduleTool(request.body);
      return reply.code(result.success ? 200 : 400).send(result);
    } catch (error: unknown) {
      fastify.log.error(error);
      return reply.code(500).send({ success: false, error: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' });
    }
  });

  fastify.get('/api/prompt', async (_request, reply) => {
    const promptPath = path.join(process.cwd(), 'prompts', 'orchestrator.md');
    if (!fs.existsSync(promptPath)) {
      return reply.code(404).send({ success: false, error: 'NOT_FOUND', message: 'Prompt file not found.' });
    }
    const today = new Date().toISOString().split('T')[0];
    const prompt = fs.readFileSync(promptPath, 'utf-8').replace('{{TODAY}}', today);
    return reply.code(200).send({ prompt });
  });
}
