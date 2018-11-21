#!/usr/bin/env node

const program = require('commander');
const inquirer = require('inquirer');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const deploy = require('../lib/deploy.js');
const logError = require('../lib/utils');

function isValidProjectType(type) {
  return ['theme', 'plugin', 'application'].includes(type);
}

function isValidDirname(dirname) {
  const validDirnamePattern = /^[a-z0-9_-]+$/i;
  return !!dirname.match(validDirnamePattern);
}

function isValidSubdomain(subdomain) {
  const validSubdomainPattern = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;
  return !!subdomain.match(validSubdomainPattern);
}

function isValidConfig(config) {
  if (typeof config !== 'object') {
    return false;
  }

  const { type, dirname, subdomain } = config;

  if (
    isValidProjectType(type)
    && isValidDirname(dirname)
    && isValidSubdomain(subdomain)
  ) {
    return true;
  }

  return false;
}

function getSavedConfig() {
  const cwd = process.cwd();
  let config = false;

  try {
    const configFile = path.join(cwd, 'wpedeploy.json');
    const configStr = fs.readFileSync(configFile, 'utf8');
    config = JSON.parse(configStr);
  } catch (e) {} // eslint-disable-line no-empty

  return isValidConfig(config) ? config : false;
}

// make sure current working directory is the root of a git repository
const cwd = process.cwd();
try {
  fs.accessSync(path.join(cwd, '.git'), fs.constants.R_OK);
} catch (err) {
  logError(`'${cwd}' is not a git repository.`);
  console.log(
    'Please try running %s command from the root of a git repository.',
    chalk.cyan('wpedeploy'),
  );
  process.exit(1);
}

const currentDirname = path.basename(path.resolve('./'));
const savedConfig = getSavedConfig();

const questions = [
  {
    type: 'list',
    name: 'type',
    message: 'Project type',
    choices: [
      { name: 'Theme', value: 'theme' },
      { name: 'Plugin', value: 'plugin' },
      { name: 'Application', value: 'application' },
    ],
    default: savedConfig ? savedConfig.type : 'theme',
  },
  {
    type: 'input',
    name: 'dirname',
    message: answers => `Name of the ${answers.type} directory`,
    suffix: ':',
    default: savedConfig ? savedConfig.dirname : currentDirname,
    validate: (dirname) => {
      if (!isValidDirname(dirname.trim())) {
        return 'Please enter a valid directory name';
      }

      return true;
    },
    filter: dirname => dirname.trim(),
  },
  {
    type: 'input',
    name: 'subdomain',
    message: 'Your WP Engine subdomain',
    suffix: ':',
    default: savedConfig ? savedConfig.subdomain : null,
    validate: (subdomain) => {
      if (!isValidSubdomain(subdomain.trim())) {
        return 'Please enter a valid subdomain';
      }

      return true;
    },
    filter: subdomain => subdomain.trim(),
  },
  {
    type: 'input',
    name: 'scripts',
    message: answers => `Scripts to run before deploying the ${answers.type} to WP Engine`,
    suffix: ':',
    default: savedConfig && savedConfig.scripts ? savedConfig.scripts : null,
    filter: subdomain => subdomain.trim(),
  },
];

program
  .version('0.1.0', '-v, --version')
  .usage('[command] [options]')
  .description('deploy a WordPress plugin or theme to WP Engine')
  .option('-e, --env <env>', 'environment to deploy to, staging or production')
  .option('-s, --skip-confirm', 'push changes to WP Engine repo without asking for confirmation')
  .option('-f, --force', 'force push your changes to WP Engine repo');

program
  .command('init')
  .alias('i')
  .description('interactively create a wpedeploy.json file')
  .action(() => {
    inquirer.prompt(questions).then((answers) => {
      const config = JSON.stringify(answers, null, '  ');
      fs.writeFileSync('wpedeploy.json', config, 'utf8');
      console.log(chalk.green('Saved your configuration into wpedeploy.json'));
    });
  });

program.parse(process.argv);

if (program.args.length === 0) {
  if (savedConfig) {
    deploy(savedConfig, program.env, program.skipConfirm, program.force);
  } else {
    console.log('\n  No configuration file found.');
    console.log(
      '  Run %s or create a wpedeploy.json file manually.\n',
      chalk.cyan('wpedeploy init'),
    );
  }
} else if (typeof program.args[0] === 'string') {
  console.error(
    '\n  wpedeploy: %s is not a wpedeploy command. See \'wpedeploy --help\'.\n',
    program.args[0],
  );
}
