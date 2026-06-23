const milkBagItemSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', description: 'A unique identifier for the bag (e.g. "bag-1" or a UUID).' },
    pumpDate: { type: 'string', description: 'The date the milk was pumped, in YYYY-MM-DD format.' },
    volumeInOz: { type: 'number', description: 'Volume of milk in the bag, in ounces (0–20).' },
    location: { type: 'string', enum: ['ambient', 'fridge', 'freezer', 'ultra-freezer'], description: 'Where the bag is stored.' },
  },
  required: ['id', 'pumpDate', 'volumeInOz', 'location'],
};

export const checkBagSafetySchema = {
  name: 'checkBagSafety',
  endpoint: '/api/tools/check-bag-safety',
  description:
    'Checks a single breast milk bag for expiration based on CDC & AAP storage guidelines. ' +
    'Returns the expiry date, safety status, days remaining, and handling/warming instructions for the given storage location. ' +
    'Call this when the parent provides details about one specific bag.',
  parameters: {
    type: 'object',
    properties: {
      pumpDate: {
        type: 'string',
        description: 'The date the milk was pumped, in YYYY-MM-DD format.',
      },
      volumeInOz: {
        type: 'number',
        description: 'Volume of milk in the bag, in ounces. Must be between 0 and 20.',
      },
      location: {
        type: 'string',
        enum: ['ambient', 'fridge', 'freezer', 'ultra-freezer'],
        description: 'Where the bag is stored.',
      },
    },
    required: ['pumpDate', 'volumeInOz', 'location'],
  },
};

export const validateStashSafetySchema = {
  name: 'validateStashSafety',
  endpoint: '/api/tools/validate-stash-safety',
  description:
    'Checks an entire breast milk stash for safety. Returns each bag with its urgency level ' +
    '(expired, expiring within 24 hours, expiring within 72 hours, or safe) and expiry date. ' +
    'Also returns a summary count per urgency level. Call this when the parent wants an overview of their full stash.',
  parameters: {
    type: 'object',
    properties: {
      stash: {
        type: 'array',
        description: 'The list of milk bags in the stash.',
        items: milkBagItemSchema,
        minItems: 1,
      },
    },
    required: ['stash'],
  },
};

export const calculateFifoScheduleSchema = {
  name: 'calculateFifoSchedule',
  endpoint: '/api/tools/calculate-fifo-schedule',
  description:
    'Generates a 7-day FIFO (first in, first out) feeding schedule from a breast milk stash and a daily target volume. ' +
    'Uses oldest bags first to minimize waste. Returns each day\'s date, servings (bag IDs + ounces used), total ounces, ' +
    'and any shortfall if the stash is insufficient. Call this when the parent wants a feeding plan for the week.',
  parameters: {
    type: 'object',
    properties: {
      stash: {
        type: 'array',
        description: 'The list of milk bags in the stash.',
        items: milkBagItemSchema,
        minItems: 1,
      },
      dailyTargetOz: {
        type: 'number',
        description: 'The total ounces of milk the baby needs per day.',
      },
    },
    required: ['stash', 'dailyTargetOz'],
  },
};

export const GLOBAL_TOOL_DEFINITIONS = [
  checkBagSafetySchema,
  validateStashSafetySchema,
  calculateFifoScheduleSchema,
];
