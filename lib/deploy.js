const inquirer = require('inquirer');
const shell = require('shelljs');
const tmp = require('tmp');
const path = require('path');
const fs = require('fs');
const chalk = require('chalk');
const rimraf = require('rimraf');
const mkdirp = require('mkdirp');
const unique = require('array-unique');
const escapeStringRegexp = require('escape-string-regexp');
const { logError } = require('./utils');

function getProjectDestinationPath(type, dirname) {
  return (type === 'application') ? `${dirname}` : `wp-content/${type}s/${dirname}`;
}

/**
 * Appends project's .wpeignore or .gitignore file to WP Engine repos .gitignore
 *
 * It makes sure some files like .DS_Store, node_modules etc are always ignored.
 *
 * All lines of project's .wpeignore or .gitignore file are prefixed with
 * `wp-content/<project-type>/<dirname>/`.
 */
function wpeignoreToGitignore(type, dirname, projectPath, tmpDeploymentDir) {
  let projectGitignore = '';
  let rootGitignore = '';
  const destinationPath = getProjectDestinationPath(type, dirname);

  try {
    projectGitignore = fs.readFileSync(
      path.join(projectPath, '.wpeignore'),
      'utf8',
    );
  } catch (e) {
    try {
      projectGitignore = fs.readFileSync(
        path.join(projectPath, '.gitignore'),
        'utf8',
      );
    } catch (err) {} // eslint-disable-line no-empty
  }

  try {
    rootGitignore = fs.readFileSync(
      path.join(tmpDeploymentDir, '.gitignore'),
      'utf8',
    );
  } catch (e) {} // eslint-disable-line no-empty

  // make sure these files/folders are always ignored
  const alwaysIgnore = [
    '.DS_Store',
    'node_modules',
  ];

  // merge and remove duplicates
  projectGitignore = unique([
    ...projectGitignore.split('\n'),
    ...alwaysIgnore,
  ])
    // remove empty lines
    .filter(line => line.trim().length > 0)
    // prefix each line with theme/plugin path
    .map(line => (
      `${destinationPath}${line.startsWith('/') ? '' : '/'}${line}`
    ))
    .join('\n');

  const headerComment = `# ${dirname} ${type} (added and managed by wpe-deploy)\n`;
  const footerComment = `# END ${dirname} ${type}\n`;

  let projectGitignoreBlock = '\n\n';
  projectGitignoreBlock += headerComment;
  projectGitignoreBlock += `${projectGitignore}\n`;
  projectGitignoreBlock += footerComment;

  let pattern = '(?:\n\n)?';
  pattern += escapeStringRegexp(headerComment.trim());
  pattern += '[\\s|\\S]*?';
  pattern += escapeStringRegexp(footerComment.trim());
  pattern += '\n?';
  // remove any lines added in previous deploy
  rootGitignore = rootGitignore.replace(new RegExp(pattern, 'm'), '');

  // append new project ignore block
  rootGitignore += projectGitignoreBlock;

  try {
    fs.writeFileSync(path.join(tmpDeploymentDir, '.gitignore'), rootGitignore);
  } catch (err) {
    console.log(chalk.red('\n  error: unable to create or modify .gitignore\n'));
    throw err;
  }
}

/**
 * Deploy theme or plugin to WP Engine
 */
function deploy(savedConfig, env, skipConfirm, force) {
  const {
    type, dirname, subdomain, scripts,
  } = savedConfig;
  const cwd = process.cwd();
  let environment;
  const projectDestinationPath = getProjectDestinationPath(type, dirname);

  if (env && typeof env === 'string') {
    environment = env.trim();

    if (!['staging', 'production'].includes(environment)) {
      logError(`invalid env '${environment}'`);
      console.log(
        '  Valid options are %s and %s\n',
        chalk.cyan('staging'),
        chalk.cyan('production'),
      );

      process.exit(1);
    }
  } else {
    const child = shell.exec(
      'git rev-parse --abbrev-ref HEAD',
      { silent: true },
    );

    if (child.code !== 0) {
      logError(`this git repo '${cwd}' does not have any commits yet`);
      process.exit(1);
    } else if (child.stdout.trim() === 'master') {
      environment = 'production';
    } else {
      environment = 'staging';
    }
  }

  const wpeRepo = `git@git.wpengine.com:${environment}/${subdomain}.git`;

  // create a temporary directory
  const tmpDir = tmp.dirSync().name;
  const tmpDeploymentDir = path.join(tmpDir, 'deployment');
  const tmpProjectDir = path.join(
    tmpDeploymentDir,
    projectDestinationPath,
  );

  // clone the WPEngine repo to the deployment directory
  console.log(`Cloning ${chalk.cyan(wpeRepo)} into '${tmpDeploymentDir}'...`);
  const cloneWpeRepoCmd = `git clone ${wpeRepo} ${tmpDeploymentDir}`;
  if (shell.exec(cloneWpeRepoCmd, { silent: true }).code !== 0) {
    logError(`failed to clone ${wpeRepo}`);
    process.exit(1);
  }

  // Delete plugin/theme if it exists
  rimraf.sync(tmpProjectDir, { glob: false });

  // based on the project type create wp-content/themes
  // or wp-content/plugins dir if not exists
  shell.cd(tmpDeploymentDir);
  mkdirp(path.join('wp-content', `${type}s`));

  // clone current repository into temporary directory
  console.log(`Cloning current ${type} repository into '${tmpProjectDir}'...`);
  const copyProjectRepoCmd = `git clone --reference ${cwd} ${cwd} ${tmpProjectDir}`;
  if (shell.exec(copyProjectRepoCmd, { silent: true }).code !== 0) {
    logError(`failed to copy ${cwd} into ${tmpProjectDir}`);
    process.exit(1);
  }

  // Delete .git & .gitignore from theme/plugin
  rimraf.sync(path.join(tmpProjectDir, '.git'), { glob: false });
  rimraf.sync(path.join(tmpProjectDir, '.gitignore'), { glob: false });

  // run custom scripts
  if (scripts) {
    shell.cd(tmpProjectDir);
    console.log(`Running custom scripts '${chalk.cyan(scripts)}'...`);
    if (shell.exec(scripts).code !== 0) {
      process.exit(1);
    }
  }

  wpeignoreToGitignore(type, dirname, cwd, tmpDeploymentDir);

  // commit and push to WP Engine
  console.log('\n');
  shell.cd(tmpDeploymentDir);
  shell.exec('git add -A', { silent: true });

  const commitCmd = `git commit -m "Update ${type} ${dirname} to latest version"`;
  if (shell.exec(commitCmd).code !== 0) {
    process.exit(1);
  }

  const pushAndClean = () => {
    const forceOption = force ? '--force' : '';
    shell.exec(`git push ${forceOption}`);

    // clean temp directory
    rimraf.sync(tmpDir, { glob: false });
  };

  if (skipConfirm) {
    pushAndClean();
    return;
  }

  inquirer.prompt([{
    type: 'confirm',
    name: 'confirm',
    message: `Are you sure you want to deploy ${chalk.cyan(dirname)} ${type} to ${chalk.cyan(wpeRepo)}`,
  }]).then(({ confirm }) => {
    if (!confirm) {
      process.exit(1);
    }

    pushAndClean();
  });
}

module.exports = deploy;
