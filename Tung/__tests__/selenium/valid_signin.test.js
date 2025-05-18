const { describe, it, before, after } = require('mocha');
const { By, until, getDriver } = require('./setup');
const assert = require('assert');

describe('Sign In - Valid Credentials', () => {
  let driver;

  before(() => {
    driver = getDriver();
  });

  it('should sign in successfully and land on the homepage', async () => {
    await driver.get('http://localhost:3000/signin');
    await driver.wait(until.elementLocated(By.css('form')), 10000);

    const emailInput = await driver.findElement(By.name('email'));
    await emailInput.sendKeys('test@example.com');

    const passwordInput = await driver.findElement(By.name('password'));
    await passwordInput.sendKeys('testpassword');

    const signInButton = await driver.findElement(By.xpath("//button[contains(text(), 'Sign in')]"));
    await signInButton.click();

    // ✅ Wait for redirect to homepage
    await driver.wait(until.urlIs('http://localhost:3000/'), 10000);

    // ✅ Wait 2 seconds before closing to visually confirm success
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('✅ Login successful, homepage loaded');
  });
});
