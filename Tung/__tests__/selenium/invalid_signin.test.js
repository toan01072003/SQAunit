const { describe, it, before } = require('mocha');
const { By, until, getDriver } = require('./setup');
const assert = require('assert');

describe('Sign In - Invalid Credentials', () => {
  let driver;

  before(() => {
    driver = getDriver();
  });

  it('should show error message with invalid credentials', async () => {
    await driver.get('http://localhost:3000/signin');
    await driver.wait(until.elementLocated(By.css('form')), 10000);
    const emailInput = await driver.findElement(By.name('email'));
    await emailInput.sendKeys('invalid@example.com');
    const passwordInput = await driver.findElement(By.name('password'));
    await passwordInput.sendKeys('wrongpassword');
    const signInButton = await driver.findElement(By.xpath("//button[contains(text(), 'Sign in')]"));
    await signInButton.click();
    const errorElement = await driver.wait(until.elementLocated(By.css('.text-red-700')), 10000);
    const errorText = await errorElement.getText();
    assert.ok(errorText.includes('Invalid'));

    // Wait 2 seconds to see the error message
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log('✅ Invalid credentials test completed');
  });
});