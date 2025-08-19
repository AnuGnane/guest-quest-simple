#!/usr/bin/env node

/**
 * Character Set Management Script
 * 
 * Command-line tool for managing character sets:
 * - List all character sets
 * - Add new character sets
 * - Remove character sets
 * - Validate character sets
 * - Generate templates
 */

const CharacterLoader = require('./utils/characterLoader');
const fs = require('fs');
const path = require('path');

class CharacterManager {
    constructor() {
        this.loader = new CharacterLoader();
        this.loader.loadCharacterSets();
    }

    /**
     * List all character sets with details
     */
    list() {
        console.log('📚 CHARACTER SETS OVERVIEW\n');
        console.log('='.repeat(60));
        
        const stats = this.loader.getStats();
        
        if (stats.totalSets === 0) {
            console.log('❌ No character sets found');
            console.log('💡 Use "node manage-characters.js template" to create a template');
            return;
        }

        console.log(`📊 Total Sets: ${stats.totalSets}`);
        console.log(`👥 Total Characters: ${stats.totalCharacters}\n`);

        Object.keys(stats.sets).forEach(setId => {
            const set = stats.sets[setId];
            console.log(`🎮 ${setId.toUpperCase()}`);
            console.log(`   Name: ${set.name}`);
            console.log(`   Description: ${set.description}`);
            console.log(`   Characters: ${set.characterCount}`);
            console.log('');
        });
    }

    /**
     * Show detailed information about a specific character set
     */
    show(setId) {
        const set = this.loader.getCharacterSet(setId);
        
        if (!set) {
            console.log(`❌ Character set '${setId}' not found`);
            return;
        }

        console.log(`🎮 CHARACTER SET: ${set.setName.toUpperCase()}\n`);
        console.log('='.repeat(60));
        console.log(`Description: ${set.description}`);
        console.log(`Characters: ${set.characters.length}\n`);

        console.log('👥 CHARACTERS:');
        set.characters.forEach((char, index) => {
            console.log(`${(index + 1).toString().padStart(2)}. ${char.name} (${char.id})`);
            
            // Show attributes
            const attributes = Object.entries(char.attributes)
                .map(([key, value]) => `${key}: ${value}`)
                .join(', ');
            console.log(`    ${attributes}`);
            console.log('');
        });
    }

    /**
     * Validate all character sets
     */
    validate() {
        console.log('🔍 VALIDATING CHARACTER SETS\n');
        console.log('='.repeat(60));

        const files = fs.readdirSync('./characters')
            .filter(file => file.endsWith('.json'));

        if (files.length === 0) {
            console.log('❌ No character set files found');
            return;
        }

        let validSets = 0;
        let invalidSets = 0;

        files.forEach(file => {
            try {
                const setId = path.basename(file, '.json');
                const filePath = path.join('./characters', file);
                const rawData = fs.readFileSync(filePath, 'utf8');
                const characterSet = JSON.parse(rawData);

                console.log(`🔍 Validating ${setId}...`);

                if (this.loader.validateCharacterSet(characterSet, setId)) {
                    console.log(`✅ ${setId}: Valid`);
                    validSets++;
                } else {
                    console.log(`❌ ${setId}: Invalid`);
                    invalidSets++;
                }

            } catch (error) {
                console.log(`❌ ${file}: JSON Parse Error - ${error.message}`);
                invalidSets++;
            }
        });

        console.log('\n📊 VALIDATION SUMMARY:');
        console.log(`✅ Valid sets: ${validSets}`);
        console.log(`❌ Invalid sets: ${invalidSets}`);
    }

    /**
     * Generate a template for a new character set
     */
    template(setId = 'new_set') {
        const template = {
            setName: "New Character Set",
            description: "Description of your character set",
            characters: [
                {
                    id: "character1",
                    name: "Character One",
                    attributes: {
                        attribute1: "value1",
                        attribute2: "value2",
                        attribute3: "value3"
                    }
                },
                {
                    id: "character2",
                    name: "Character Two",
                    attributes: {
                        attribute1: "value1",
                        attribute2: "value2",
                        attribute3: "value3"
                    }
                }
            ]
        };

        const filename = `characters/${setId}.json`;
        
        if (fs.existsSync(filename)) {
            console.log(`❌ File ${filename} already exists`);
            return;
        }

        fs.writeFileSync(filename, JSON.stringify(template, null, 2));
        console.log(`✅ Template created: ${filename}`);
        console.log('💡 Edit the file to customize your character set');
    }

    /**
     * Remove a character set
     */
    remove(setId) {
        if (!setId) {
            console.log('❌ Please specify a character set ID to remove');
            return;
        }

        const filename = `characters/${setId}.json`;
        
        if (!fs.existsSync(filename)) {
            console.log(`❌ Character set '${setId}' not found`);
            return;
        }

        // Confirm deletion
        console.log(`⚠️  Are you sure you want to delete '${setId}'? This cannot be undone.`);
        console.log('💡 To confirm, run: node manage-characters.js remove-confirm ' + setId);
    }

    /**
     * Confirm removal of a character set
     */
    removeConfirm(setId) {
        const filename = `characters/${setId}.json`;
        
        if (!fs.existsSync(filename)) {
            console.log(`❌ Character set '${setId}' not found`);
            return;
        }

        fs.unlinkSync(filename);
        console.log(`🗑️ Removed character set: ${setId}`);
    }

    /**
     * Show usage help
     */
    help() {
        console.log('🎮 CHARACTER SET MANAGER\n');
        console.log('Usage: node manage-characters.js <command> [options]\n');
        console.log('Commands:');
        console.log('  list                    List all character sets');
        console.log('  show <setId>           Show detailed info about a character set');
        console.log('  validate               Validate all character set files');
        console.log('  template [setId]       Generate a template file');
        console.log('  remove <setId>         Remove a character set (with confirmation)');
        console.log('  help                   Show this help message\n');
        console.log('Examples:');
        console.log('  node manage-characters.js list');
        console.log('  node manage-characters.js show classic');
        console.log('  node manage-characters.js template pirates');
        console.log('  node manage-characters.js remove old_set');
    }
}

// Command line interface
function main() {
    const args = process.argv.slice(2);
    const command = args[0];
    const manager = new CharacterManager();

    switch (command) {
        case 'list':
            manager.list();
            break;
        case 'show':
            manager.show(args[1]);
            break;
        case 'validate':
            manager.validate();
            break;
        case 'template':
            manager.template(args[1]);
            break;
        case 'remove':
            manager.remove(args[1]);
            break;
        case 'remove-confirm':
            manager.removeConfirm(args[1]);
            break;
        case 'help':
        default:
            manager.help();
            break;
    }
}

if (require.main === module) {
    main();
}

module.exports = CharacterManager;