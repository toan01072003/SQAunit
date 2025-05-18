const { describe } = require('mocha');
const { By, until } = require('selenium-webdriver');
const assert = require('assert');
const { before, after } = require('./setup');

describe('Sign In - Context Based Authentication', () => {
  it('should handle context-based authentication', async () => {
    await driver.get('http://localhost:3000/signin');
    await driver.wait(until.elementLocated(By.css('form')), 10000);
    const emailInput = await driver.findElement(By.name('email'));
    await emailInput.sendKeys('user@example.com');
    const passwordInput = await driver.findElement(By.name('password'));
    await passwordInput.sendKeys('password123');
    const signInButton = await driver.findElement(By.xpath("//button[contains(text(), 'Sign in')]"));
    await signInButton.click();

    try {
      const contextMessage = await driver.wait(until.elementLocated(By.css('.text-red-700')), 10000);
      const messageText = await contextMessage.getText();
      assert.ok(messageText.includes('verification'));
    } catch (error) {
      const successElement = await driver.wait(until.elementLocated(By.css('.text-green-700')), 10000);
      assert.ok(await successElement.isDisplayed());
    }
  });
});
