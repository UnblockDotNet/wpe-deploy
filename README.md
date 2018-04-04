# WPE Deploy

[![npm version](https://badge.fury.io/js/wpe-deploy.svg)](https://badge.fury.io/js/wpe-deploy)

### A command-line tool for deploying WordPress plugins and themes to WP Engine


## Install
Install with [npm](https://www.npmjs.com/):

```sh
$ npm install -g wpe-deploy
```


## Usage
> Note: You need to have your SSH key added to WP Engine to be able to deploy using wpedeploy.

First generate a config file `wpedeploy.json` at the root of the theme or plugin:

```sh
$ wpedeploy init
```

Then deploy the theme or plugin in the current directory to WP Engine:

```sh
$ wpedeploy
```


## Options
To see all available options:

```sh
$ wpedeploy -h

  Usage: wpedeploy [command] [options]

  deploy a WordPress plugin or theme to WP Engine

  Options:

    -v, --version       output the version number

    -e, --env <env>     environment to deploy to, staging or production
    -s, --skip-confirm  push changes to WP Engine repo without asking for confirmation
    -f, --force         force push your changes to WP Engine repo
    -h, --help          output usage information

  Commands:

    init|i              interactively create a wpedeploy.json file
```

### `-e, --env <env>`
By default your theme/plugin is deployed to `production` env if you are on master branch of your theme/plugin or `staging` otherwise. You can manually set the WP Engine environment you want to push your theme/plugin to using this option. Supported values are `staging` and `production`.
To deploy theme/plugin to staging:
```sh
$ wpedeploy -e staging
```

### `-s, --skip-confirm`

wpedeploy confirms before your theme or plugin is pushed to WP Engine so that you can review the changes. You can skip this confirmation using this option:
```sh
$ wpedeploy -s
```

### `-f, --force`
This option will force push your changes to WP Engine repo:
```sh
$ wpedeploy -f
```


## TODO
- [ ] Improve documentation
- [ ] Write tests
