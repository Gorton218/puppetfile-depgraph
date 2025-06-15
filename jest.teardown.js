// Global teardown for Jest
const { PuppetForgeService } = require('./out/puppetForgeService');

module.exports = async () => {
    // Cleanup any HTTP agents
    if (PuppetForgeService && PuppetForgeService.cleanupAgents) {
        PuppetForgeService.cleanupAgents();
    }
    
    // Force garbage collection if available
    if (global.gc) {
        global.gc();
    }
    
    // Give a moment for any pending operations to complete
    await new Promise(resolve => setTimeout(resolve, 100));
};