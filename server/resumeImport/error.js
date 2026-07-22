export class ImportResumeError extends Error {
  constructor(message, {
    statusCode = 400,
    code = 'import/failed',
    diagnostics = null,
    expose = statusCode < 500,
  } = {}) {
    super(message);
    this.name = 'ImportResumeError';
    this.statusCode = statusCode;
    this.code = code;
    this.diagnostics = diagnostics;
    this.expose = expose;
  }
}
