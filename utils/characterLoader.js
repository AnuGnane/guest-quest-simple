const fs = require('fs');
const path = require('path');

/**
 * Character Loader Utility
 * 
 * Dynamically loads character sets from JSON files in the characters/ directory.
 * This allows for easy addition/removal of character sets without modifying server code.
 */

class CharacterLoader {
    constructor(charactersDir = './characters') {
        this.charactersDir = charactersDir;
        this.characterDatabase = {};
        this.characterSets = {};
    }

    /**
     * Load all character sets from JSON files
     */
    loadCharacterSets() {
        try {
            // Check if characters directory exists
            if (!fs.existsSync(this.charactersDir)) {
                console.warn(`Characters directory ${this.charactersDir} not found. Creating it...`);
                fs.mkdirSync(this.charactersDir, { recursive: true });
                return;
            }

            // Read all JSON files from characters directory
            const files = fs.readdirSync(this.charactersDir)
                .filter(file => file.endsWith('.json'));

            if (files.length === 0) {
                console.warn('No character set files found in characters directory');
                return;
            }

            console.log(`📚 Loading character sets from ${files.length} files...`);

            files.forEach(file => {
                try {
                    const setId = path.basename(file, '.json');
                    const filePath = path.join(this.charactersDir, file);
                    const rawData = fs.readFileSync(filePath, 'utf8');
                    const characterSet = JSON.parse(rawData);

                    // Validate character set structure
                    if (!this.validateCharacterSet(characterSet, setId)) {
                        console.error(`❌ Invalid character set structure in ${file}`);
                        return;
                    }

                    // Process characters to add image paths and ensure consistent structure
                    const processedCharacters = characterSet.characters.map(char => ({
                        id: char.id,
                        name: char.name,
                        image: `/images/characters/${setId}/${char.id}.png`,
                        attributes: char.attributes
                    }));

                    // Store in database format
                    this.characterDatabase[setId] = {
                        setName: characterSet.setName,
                        description: characterSet.description,
                        characters: processedCharacters
                    };

                    // Create legacy format for compatibility
                    this.characterSets[setId] = processedCharacters.map(char => ({
                        ...char.attributes,
                        name: char.name,
                        image: char.image,
                        id: char.id
                    }));

                    console.log(`✅ Loaded character set: ${characterSet.setName} (${processedCharacters.length} characters)`);

                } catch (error) {
                    console.error(`❌ Error loading character set from ${file}:`, error.message);
                }
            });

            console.log(`🎮 Total character sets loaded: ${Object.keys(this.characterDatabase).length}`);

        } catch (error) {
            console.error('❌ Error loading character sets:', error.message);
        }
    }

    /**
     * Validate character set structure
     */
    validateCharacterSet(characterSet, setId) {
        if (!characterSet.setName || typeof characterSet.setName !== 'string') {
            console.error(`Missing or invalid setName in ${setId}`);
            return false;
        }

        if (!characterSet.description || typeof characterSet.description !== 'string') {
            console.error(`Missing or invalid description in ${setId}`);
            return false;
        }

        if (!Array.isArray(characterSet.characters) || characterSet.characters.length === 0) {
            console.error(`Missing or empty characters array in ${setId}`);
            return false;
        }

        // Validate each character
        for (let i = 0; i < characterSet.characters.length; i++) {
            const char = characterSet.characters[i];
            
            if (!char.id || typeof char.id !== 'string') {
                console.error(`Character ${i} missing or invalid id in ${setId}`);
                return false;
            }

            if (!char.name || typeof char.name !== 'string') {
                console.error(`Character ${char.id} missing or invalid name in ${setId}`);
                return false;
            }

            if (!char.attributes || typeof char.attributes !== 'object') {
                console.error(`Character ${char.id} missing or invalid attributes in ${setId}`);
                return false;
            }

            // Check for duplicate IDs
            const duplicateId = characterSet.characters.find((otherChar, j) => 
                j !== i && otherChar.id === char.id
            );
            if (duplicateId) {
                console.error(`Duplicate character ID '${char.id}' in ${setId}`);
                return false;
            }
        }

        return true;
    }

    /**
     * Get all character sets (legacy format)
     */
    getCharacterSets() {
        return this.characterSets;
    }

    /**
     * Get character database (new format)
     */
    getCharacterDatabase() {
        return this.characterDatabase;
    }

    /**
     * Get specific character set
     */
    getCharacterSet(setId) {
        return this.characterDatabase[setId];
    }

    /**
     * Get available character set names for UI
     */
    getAvailableSetNames() {
        const sets = {};
        Object.keys(this.characterDatabase).forEach(key => {
            sets[key] = this.characterDatabase[key].characters.map(char => char.name);
        });
        return sets;
    }

    /**
     * Reload character sets (useful for development)
     */
    reload() {
        this.characterDatabase = {};
        this.characterSets = {};
        this.loadCharacterSets();
    }

    /**
     * Add a new character set programmatically
     */
    addCharacterSet(setId, characterSet) {
        if (!this.validateCharacterSet(characterSet, setId)) {
            throw new Error(`Invalid character set structure for ${setId}`);
        }

        const filePath = path.join(this.charactersDir, `${setId}.json`);
        fs.writeFileSync(filePath, JSON.stringify(characterSet, null, 2));
        
        console.log(`✅ Added new character set: ${setId}`);
        this.reload();
    }

    /**
     * Remove a character set
     */
    removeCharacterSet(setId) {
        const filePath = path.join(this.charactersDir, `${setId}.json`);
        
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`🗑️ Removed character set: ${setId}`);
            this.reload();
        } else {
            console.warn(`Character set ${setId} not found`);
        }
    }

    /**
     * Get statistics about loaded character sets
     */
    getStats() {
        const stats = {
            totalSets: Object.keys(this.characterDatabase).length,
            totalCharacters: 0,
            sets: {}
        };

        Object.keys(this.characterDatabase).forEach(setId => {
            const set = this.characterDatabase[setId];
            stats.totalCharacters += set.characters.length;
            stats.sets[setId] = {
                name: set.setName,
                description: set.description,
                characterCount: set.characters.length
            };
        });

        return stats;
    }
}

module.exports = CharacterLoader;