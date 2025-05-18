const { Builder, By, until } = require('selenium-webdriver');
const assert = require('assert');
const { describe, it } = require('mocha');

// Create a driver instance that can be shared
let driver;

// Export a function to get the driver
const getDriver = () => driver;

// Setup hook
before(async () => {
  driver = await new Builder().forBrowser('chrome').build();
  await driver.manage().setTimeouts({ implicit: 10000 });
});

after(async () => {
  if (driver) {
    await driver.quit();
  }
});

module.exports = { getDriver, By, until };
