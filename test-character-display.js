#!/usr/bin/env node

/**
 * Test Character Display
 * 
 * Simple test to verify character attributes are displayed correctly
 * for different character sets
 */

const CharacterLoader = require('./utils/characterLoader');

function testCharacterDisplay() {
    console.log('🧪 Testing Character Display Logic\n');
    
    const loader = new CharacterLoader();
    loader.loadCharacterSets();
    
    const characterDatabase = loader.getCharacterDatabase();
    
    Object.keys(characterDatabase).forEach(setId => {
        const characterSet = characterDatabase[setId];
        console.log(`🎮 ${setId.toUpperCase()} - ${characterSet.setName}`);
        console.log('='.repeat(50));
        
        // Show first 3 characters from each set
        characterSet.characters.slice(0, 3).forEach(character => {
            console.log(`\n👤 ${character.name}:`);
            
            // Test the attribute display logic
            const attributes = [];
            if (character.attributes) {
                Object.keys(character.attributes).forEach(key => {
                    const value = character.attributes[key];
                    if (value !== undefined && value !== null && value !== '') {
                        const displayName = formatAttributeName(key);
                        const displayValue = formatAttributeValue(value);
                        attributes.push(`${displayName}: ${displayValue}`);
                    }
                });
            }
            
            console.log(`   ${attributes.join(' • ')}`);
        });
        
        console.log('\n');
    });
}

function formatAttributeName(key) {
    // Convert camelCase to readable format
    return key.replace(/([A-Z])/g, ' $1')
              .replace(/^./, str => str.toUpperCase())
              .replace('Has Glasses', 'Glasses')
              .replace('Hair Color', 'Hair')
              .replace('Has Cape', 'Cape')
              .replace('Can Fly', 'Flight');
}

function formatAttributeValue(value) {
    if (typeof value === 'boolean') {
        return value ? 'Yes' : 'No';
    }
    if (typeof value === 'string') {
        // Convert snake_case and camelCase to readable format
        return value.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim()
                   .split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    }
    return String(value);
}

if (require.main === module) {
    testCharacterDisplay();
}

module.exports = { testCharacterDisplay };