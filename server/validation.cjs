/**
 * JSON schema validation for LobsterBoard config and API request bodies.
 * Zero-dependency — uses simple structural checks instead of a schema library.
 */

const MAX_CANVAS_DIMENSION = 7680; // 8K resolution
const MIN_CANVAS_DIMENSION = 320;
const MAX_WIDGETS = 500;
const MAX_STRING_LENGTH = 10000;

function validateConfigSchema(config) {
  const errors = [];

  if (typeof config !== 'object' || config === null || Array.isArray(config)) {
    return { valid: false, errors: ['Config must be a JSON object'] };
  }

  // Validate canvas
  if (config.canvas !== undefined) {
    if (typeof config.canvas !== 'object' || config.canvas === null || Array.isArray(config.canvas)) {
      errors.push('canvas must be an object');
    } else {
      if (config.canvas.width !== undefined) {
        if (typeof config.canvas.width !== 'number' || !Number.isFinite(config.canvas.width) ||
            config.canvas.width < MIN_CANVAS_DIMENSION || config.canvas.width > MAX_CANVAS_DIMENSION) {
          errors.push(`canvas.width must be a number between ${MIN_CANVAS_DIMENSION} and ${MAX_CANVAS_DIMENSION}`);
        }
      }
      if (config.canvas.height !== undefined) {
        if (typeof config.canvas.height !== 'number' || !Number.isFinite(config.canvas.height) ||
            config.canvas.height < MIN_CANVAS_DIMENSION || config.canvas.height > MAX_CANVAS_DIMENSION) {
          errors.push(`canvas.height must be a number between ${MIN_CANVAS_DIMENSION} and ${MAX_CANVAS_DIMENSION}`);
        }
      }
    }
  }

  // Validate fontScale
  if (config.fontScale !== undefined) {
    if (typeof config.fontScale !== 'number' || !Number.isFinite(config.fontScale) ||
        config.fontScale < 0.1 || config.fontScale > 10) {
      errors.push('fontScale must be a number between 0.1 and 10');
    }
  }

  // Validate widgets array
  if (config.widgets !== undefined) {
    if (!Array.isArray(config.widgets)) {
      errors.push('widgets must be an array');
    } else {
      if (config.widgets.length > MAX_WIDGETS) {
        errors.push(`widgets array exceeds maximum of ${MAX_WIDGETS} items`);
      }
      for (let i = 0; i < config.widgets.length; i++) {
        const widgetErrors = validateWidget(config.widgets[i], i);
        errors.push(...widgetErrors);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

function validateWidget(widget, index) {
  const errors = [];
  const prefix = `widgets[${index}]`;

  if (typeof widget !== 'object' || widget === null || Array.isArray(widget)) {
    return [`${prefix} must be an object`];
  }

  // Required fields
  if (typeof widget.id !== 'string' || widget.id.length === 0) {
    errors.push(`${prefix}.id must be a non-empty string`);
  }
  if (typeof widget.type !== 'string' || widget.type.length === 0) {
    errors.push(`${prefix}.type must be a non-empty string`);
  }

  // Position and size — must be finite numbers
  for (const field of ['x', 'y', 'width', 'height']) {
    if (widget[field] !== undefined) {
      if (typeof widget[field] !== 'number' || !Number.isFinite(widget[field])) {
        errors.push(`${prefix}.${field} must be a finite number`);
      } else if (widget[field] < -MAX_CANVAS_DIMENSION || widget[field] > MAX_CANVAS_DIMENSION * 2) {
        errors.push(`${prefix}.${field} is out of bounds`);
      }
    }
  }

  // Properties — must be an object if present, with string values bounded
  if (widget.properties !== undefined) {
    if (typeof widget.properties !== 'object' || widget.properties === null || Array.isArray(widget.properties)) {
      errors.push(`${prefix}.properties must be an object`);
    } else {
      for (const [key, value] of Object.entries(widget.properties)) {
        if (typeof value === 'string' && value.length > MAX_STRING_LENGTH) {
          errors.push(`${prefix}.properties.${key} exceeds maximum string length of ${MAX_STRING_LENGTH}`);
        }
      }
    }
  }

  return errors;
}

/**
 * Validate todos request body — must be an array of objects.
 */
function validateTodos(body) {
  if (!Array.isArray(body)) {
    return { valid: false, errors: ['Request body must be an array'] };
  }
  if (body.length > 1000) {
    return { valid: false, errors: ['Too many todo items (max 1000)'] };
  }
  return { valid: true, errors: [] };
}

/**
 * Validate notes request body — must be an object.
 */
function validateNotes(body) {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { valid: false, errors: ['Request body must be an object'] };
  }
  return { valid: true, errors: [] };
}

/**
 * Validate server profile creation — requires name, url, apiKey.
 */
function validateServerProfile(body) {
  const errors = [];
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { valid: false, errors: ['Request body must be an object'] };
  }
  if (typeof body.name !== 'string' || body.name.trim().length === 0) {
    errors.push('name is required and must be a non-empty string');
  }
  if (typeof body.url !== 'string' || body.url.trim().length === 0) {
    errors.push('url is required and must be a non-empty string');
  }
  if (typeof body.apiKey !== 'string' || body.apiKey.trim().length === 0) {
    errors.push('apiKey is required and must be a non-empty string');
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Validate template import — requires id and mode.
 */
function validateTemplateImport(body) {
  const errors = [];
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { valid: false, errors: ['Request body must be an object'] };
  }
  if (typeof body.id !== 'string' || body.id.trim().length === 0) {
    errors.push('id is required');
  }
  if (body.mode !== 'replace' && body.mode !== 'merge') {
    errors.push('mode must be "replace" or "merge"');
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Validate template export — requires name.
 */
function validateTemplateExport(body) {
  const errors = [];
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { valid: false, errors: ['Request body must be an object'] };
  }
  if (typeof body.name !== 'string' || body.name.trim().length === 0) {
    errors.push('name is required');
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Escape HTML special characters to prevent XSS in server-rendered widget output.
 */
function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Recursively sanitize all string values in widget properties for safe HTML rendering.
 */
function sanitizeWidgetProperties(properties) {
  if (properties == null || typeof properties !== 'object') return properties;

  if (Array.isArray(properties)) {
    return properties.map(item => {
      if (typeof item === 'string') return escapeHtml(item);
      if (typeof item === 'object' && item !== null) return sanitizeWidgetProperties(item);
      return item;
    });
  }

  const sanitized = {};
  for (const [key, value] of Object.entries(properties)) {
    if (typeof value === 'string') {
      sanitized[key] = escapeHtml(value);
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeWidgetProperties(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

/**
 * Sanitize all widgets in a config for safe HTML rendering on GET /config.
 */
function sanitizeConfig(config) {
  if (!config || !config.widgets) return config;
  const sanitized = { ...config };
  sanitized.widgets = config.widgets.map(w => {
    if (!w.properties) return w;
    return { ...w, properties: sanitizeWidgetProperties(w.properties) };
  });
  return sanitized;
}

module.exports = {
  validateConfigSchema,
  validateWidget,
  validateTodos,
  validateNotes,
  validateServerProfile,
  validateTemplateImport,
  validateTemplateExport,
  escapeHtml,
  sanitizeWidgetProperties,
  sanitizeConfig,
  MAX_CANVAS_DIMENSION,
  MIN_CANVAS_DIMENSION,
  MAX_WIDGETS,
  MAX_STRING_LENGTH,
};
