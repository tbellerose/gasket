/* eslint-disable no-console, no-sync, max-statements */

const fs = require('fs');
const path = require('path');
const {
  promisify
} = require('util');

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const projectRoot = path.resolve(__dirname, '..');


/**
 * Dependency name and expected version range
 *
 * @type {object.<string,string>}
 */
const depVersions = {
  '@babel/cli': '^7.5.5',
  '@babel/core': '^7.5.5',
  '@babel/node': '^7.5.5',
  '@babel/runtime': '^7.5.5',
  '@babel/plugin-transform-runtime': '^7.5.5',
  '@babel/preset-env': '^7.5.5',
  '@babel/preset-react': '^7.0.0',

  'jest': '^24.8.0',
  'assume': '^2.2.0',
  'sinon': '^7.4.1',
  'assume-sinon': '^1.0.1',
  'mocha': '^6.2.0',
  'chai': '^4.2.0',
  'nyc': '^14.1.1',
  'proxyquire': '^2.1.3',

  'react': '^16.8.6',
  'react-dom': '^16.8.6',
  'redux': '^4.0.4',
  'deepmerge': '^4.0.0',
  'diagnostics': '^2.0.2',

  'babel-eslint': '^10.0.2',
  'eslint': '^6.1.0',
  'eslint-config-godaddy': '^4.0.0',
  'eslint-config-godaddy-react': '^6.0.0',
  'eslint-plugin-json': '^1.4.0',
  'eslint-plugin-jest': '^22.15.1',
  'eslint-plugin-mocha': '^6.0.0',
  'eslint-plugin-react': '^7.14.0',

  'enzyme': '^3.10.0',
  'enzyme-adapter-react-16': '^1.14.0',

  'handlebars': '^4.4.3',
  'rimraf': '^3.0.0',
  'glob': '^7.1.4',
  'semver': '^6.3.0'
};


/**
 * Expected order of the overall package
 *
 * @type {string[]}
 */
const pkgOrder = [
  'name',
  'version',
  'description',
  'main',
  'browser',
  'module',
  'bin',
  'files',
  'scripts',
  'repository',
  'publishConfig',
  'keywords',
  'author',
  'maintainers',
  'license',
  'bugs',
  'homepage',
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'eslintConfig',
  'eslintIgnore',
  'gasket'
];

/**
 * Expected order of scripts
 *
 * @type {string[]}
 */
const scriptsOrder = [
  'lint',
  'lint:fix',
  'lint:fix:all',
  'stylelint',
  'mocha',
  'jest',
  'pretest',
  'test',
  'test:runner',
  'test:watch',
  'test:coverage',
  'posttest',
  'build',
  'build:watch',
  'prepack',
  'postpack',
  'prepublish',
  'prepublishOnly'
];


/**
 * Shortcut to stringfy and object in a readable way
 *
 * @param {object} json - Object to stringify very prettily
 * @returns {string} pretty
 */
const prettyPrint = json => JSON.stringify(json, null, 2) + '\n';

/**
 * Builds a sort function from an array.
 * Items found in the array will be arranged as listed.
 * Otherwise, they will be sorted alphanumeric at the end.
 *
 * @param {Array} arr - Array of sorted keys
 * @returns {function} compare
 */
const orderedSort = arr => (a, b) => {
  let comparison = 0;
  let aIdx = arr.indexOf(a);
  let bIdx = arr.indexOf(b);

  if (aIdx < 0) aIdx = 100;
  if (bIdx < 0) bIdx = 100;

  if (aIdx > bIdx) {
    comparison = 1;
  } else if (bIdx > aIdx) {
    comparison = -1;
  } else {
    comparison = a > b ? 1 : -1;
  }

  return comparison;
};

/**
 * Takes and object and sorts its keys
 *
 * @param {object} obj - Object with keys to be ordered
 * @param {string} [attr] - name of object property to sort
 * @param {function} [compare] - optional sort function
 * @returns {object} sorted
 */
function sortKeys(obj, attr, compare) {
  const target = attr ? obj[attr] : obj;

  if (!target) return obj;

  const ordered = {};
  Object.keys(target).sort(compare).forEach(function (key) {
    ordered[key] = target[key];
  });

  if (attr) {
    obj[attr] = ordered;
  }
  return attr ? obj : ordered;
}

/**
 * Adjust versions of dependencies in package match the version expected
 *
 * @param {object} pkgJson - package.json contents
 * @param {string} attr - Either devDependencies or dependencies
 * @returns {object} pkgJson
 */
function alignDeps(pkgJson, attr) {
  if (!pkgJson[attr]) return pkgJson;

  const deps = Object.keys(pkgJson[attr]);
  const updated = {};

  deps.forEach(dep => {
    updated[dep] = depVersions[dep] || pkgJson[attr][dep];
  });
  pkgJson[attr] = updated;
  return pkgJson;
}

/**
 * Set standard properties in packages
 *
 * @param {object} pkgJson - package.json contents
 */
function fixedProperties(pkgJson) {

  pkgJson.author = 'GoDaddy Operating Company, LLC';
  pkgJson.repository = {
    type: 'git',
    url: 'git+ssh://git@github.com/godaddy/gasket.git'
  };
  pkgJson.publishConfig = {
    access: 'public'
  };
  pkgJson.license = 'MIT';
  pkgJson.bugs = {
    url: 'https://github.com/godaddy/gasket/issues'
  };
}

/**
 * Checks for expected scripts and warns if missing
 *
 * @param {object} pkgJson - package.json contents
 */
function checkScripts(pkgJson) {
  const { name, scripts } = pkgJson;

  const expected = [
    'test',
    'test:coverage',
    'posttest'
  ];

  expected.forEach(s => {
    if (scripts && !(s in scripts)) {
      console.warn(`${name} does not have script: ${s}`);
    }
  });
}

/**
 * Read, fix up, and write out updated package.json file
 *
 * @param {string} pkgPath path to a package.json file
 * @returns {Promise} promise
 */
async function fixupPackage(pkgPath) {
  let pkgJson;
  try {
    pkgJson = JSON.parse(await readFile(pkgPath));
  } catch (e) {
    console.error(e.message);
    return;
  }

  fixedProperties(pkgJson);

  checkScripts(pkgJson);

  pkgJson = sortKeys(pkgJson, null, orderedSort(pkgOrder));
  pkgJson = sortKeys(pkgJson, 'scripts', orderedSort(scriptsOrder));
  pkgJson = sortKeys(pkgJson, 'peerDependencies');
  pkgJson = sortKeys(pkgJson, 'dependencies');
  pkgJson = sortKeys(pkgJson, 'devDependencies');

  pkgJson = alignDeps(pkgJson, 'dependencies');
  pkgJson = alignDeps(pkgJson, 'devDependencies');

  await writeFile(pkgPath, prettyPrint(pkgJson));
  console.log('aligned', path.relative(projectRoot, pkgPath));
}

/**
 * Finds all the packages and fixes them up
 *
 * @returns {Promise} promise
 */
async function main() {
  const packagesDir = path.join(projectRoot, 'packages');

  const paths = fs.readdirSync(packagesDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory() && dirent.name.startsWith('gasket'))
    .map(dirent => path.join(packagesDir, dirent.name, 'package.json'));

  paths.push(path.join(projectRoot, 'package.json'));

  await Promise.all(paths.map(pkgPath => fixupPackage(pkgPath)));
  console.log('Finished.');
}

main();
