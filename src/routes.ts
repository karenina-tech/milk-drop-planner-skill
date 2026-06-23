import type { FastifyInstance } from 'fastify';
import * as fs from 'fs';
import * as path from 'path';
import { GLOBAL_TOOL_DEFINITIONS } from './ai/toolDefinitions.js';
import { checkBagSafetyTool } from './tools/checkBagSafety.js';
import { validateStashSafetyTool } from './tools/validateStashSafety.js';
import { calculateFifoScheduleTool } from './tools/calculateFifoSchedule.js';
import { compileStashReport, compileScheduleReport } from './domain/reportGenerator.js';

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
      if (result.success && result.bags) {
        const generatedAt = new Date().toISOString().split('T')[0];
        const htmlData = compileStashReport(result.bags, generatedAt);
        fs.writeFileSync(path.join(process.cwd(), 'stash-report.html'), htmlData, 'utf-8');
        const reportUrl = `http://${request.headers.host}/api/stash-report`;
        return reply.code(200).send({ ...result, reportUrl });
      }
      return reply.code(400).send(result);
    } catch (error: unknown) {
      fastify.log.error(error);
      return reply.code(500).send({ success: false, error: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' });
    }
  });

  fastify.get('/api/stash-template', async (_request, reply) => {
    const filePath = path.join(process.cwd(), 'templates', 'stash_template.csv');
    if (!fs.existsSync(filePath)) {
      return reply.code(404).send({ success: false, error: 'NOT_FOUND', message: 'Template file not found.' });
    }
    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', 'attachment; filename="stash_template.csv"');
    return reply.code(200).send(fs.readFileSync(filePath, 'utf-8'));
  });

  fastify.get('/api/stash-report', async (_request, reply) => {
    const filePath = path.join(process.cwd(), 'stash-report.html');
    if (!fs.existsSync(filePath)) {
      return reply.code(404).send({ success: false, error: 'NOT_FOUND', message: 'No stash report found. Call validate-stash-safety first.' });
    }
    reply.header('Content-Type', 'text/html');
    reply.header('Content-Disposition', 'inline; filename="milk-stash-report.html"');
    return reply.code(200).send(fs.readFileSync(filePath, 'utf-8'));
  });

  fastify.post('/api/tools/calculate-fifo-schedule', async (request, reply) => {
    try {
      const result = calculateFifoScheduleTool(request.body);
      if (result.success && result.schedule) {
        const generatedAt = new Date().toISOString().split('T')[0];
        const htmlData = compileScheduleReport(result.dailyTargetOz, result.schedule, generatedAt);
        fs.writeFileSync(path.join(process.cwd(), 'schedule-report.html'), htmlData, 'utf-8');
        const scheduleReportUrl = `http://${request.headers.host}/api/schedule-report`;
        return reply.code(200).send({ ...result, scheduleReportUrl });
      }
      return reply.code(400).send(result);
    } catch (error: unknown) {
      fastify.log.error(error);
      return reply.code(500).send({ success: false, error: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' });
    }
  });

  fastify.get('/api/schedule-report', async (_request, reply) => {
    const filePath = path.join(process.cwd(), 'schedule-report.html');
    if (!fs.existsSync(filePath)) {
      return reply.code(404).send({ success: false, error: 'NOT_FOUND', message: 'No schedule report found. Call calculate-fifo-schedule first.' });
    }
    reply.header('Content-Type', 'text/html');
    reply.header('Content-Disposition', 'inline; filename="milk-schedule-report.html"');
    return reply.code(200).send(fs.readFileSync(filePath, 'utf-8'));
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
