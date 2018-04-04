const chalk = require('chalk');

/**
 * Log an error
 */
exports.logError = function logError(message) {
  console.error(chalk.red(`\n  error: ${message}\n`));
};
