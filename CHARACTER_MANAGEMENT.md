# 🎮 Character Management System

## Overview

The Guest Quest game now uses a flexible, file-based character management system that allows you to easily add, remove, and modify character sets without touching the server code.

## 📁 File Structure

```
guest-quest-simple/
├── characters/                 # Character set definitions
│   ├── classic.json           # Classic character set
│   ├── superheroes.json       # Superhero character set
│   └── animals.json           # Animal character set
├── utils/
│   └── characterLoader.js     # Character loading utility
├── manage-characters.js       # Management script
└── server.js                  # Updated to use dynamic loading
```

## 🚀 Quick Start

### View All Character Sets
```bash
npm run characters list
```

### View Specific Character Set
```bash
npm run characters show classic
npm run characters show superheroes
```

### Create New Character Set
```bash
npm run characters template pirates
# Edit characters/pirates.json
```

### Validate Character Sets
```bash
npm run characters validate
```

## 📝 Character Set Format

Each character set is a JSON file with this structure:

```json
{
  "setName": "Display Name",
  "description": "Description of the character set",
  "characters": [
    {
      "id": "unique_id",
      "name": "Display Name",
      "attributes": {
        "attribute1": "value1",
        "attribute2": "value2",
        "attribute3": "value3"
      }
    }
  ]
}
```

### Example: Pirates Character Set

```json
{
  "setName": "Pirates",
  "description": "Swashbuckling pirates from the seven seas",
  "characters": [
    {
      "id": "blackbeard",
      "name": "Blackbeard",
      "attributes": {
        "gender": "male",
        "hasBeard": true,
        "weapon": "cutlass",
        "ship": "queen_annes_revenge",
        "treasure": "gold"
      }
    },
    {
      "id": "anne_bonny",
      "name": "Anne Bonny",
      "attributes": {
        "gender": "female",
        "hasBeard": false,
        "weapon": "pistol",
        "ship": "revenge",
        "treasure": "jewels"
      }
    }
  ]
}
```

## 🎯 Available Character Sets

### 1. Classic Characters (24 characters)
- **Attributes**: gender, hairColor, age, location
- **Theme**: Traditional Guess Who style characters
- **Good for**: Classic gameplay

### 2. Superheroes (16 characters)
- **Attributes**: gender, powers, team, hasCape, location
- **Theme**: Comic book superheroes
- **Good for**: Fans of Marvel/DC

### 3. Animals (16 characters)
- **Attributes**: species, habitat, size, diet, canFly
- **Theme**: Cute animal characters
- **Good for**: Kids and animal lovers

## 🛠️ Management Commands

### List Commands
```bash
# List all character sets
npm run characters list

# Show detailed info about a set
npm run characters show <setId>
```

### Creation Commands
```bash
# Create a template for a new set
npm run characters template <setId>

# Example: Create pirates template
npm run characters template pirates
```

### Validation Commands
```bash
# Validate all character sets
npm run characters validate
```

### Removal Commands
```bash
# Remove a character set (with confirmation)
npm run characters remove <setId>
```

## 🔧 Advanced Usage

### Programmatic Access

```javascript
const CharacterLoader = require('./utils/characterLoader');

const loader = new CharacterLoader();
loader.loadCharacterSets();

// Get all character sets
const sets = loader.getCharacterSets();

// Get specific character set
const pirates = loader.getCharacterSet('pirates');

// Get statistics
const stats = loader.getStats();
console.log(`Total characters: ${stats.totalCharacters}`);
```

### Hot Reloading (Development)

```bash
# Reload character sets without restarting server
curl -X POST http://localhost:3000/api/characters/reload
```

## 📋 Character Set Guidelines

### Naming Conventions
- **File names**: lowercase, underscores (e.g., `space_explorers.json`)
- **Character IDs**: lowercase, underscores (e.g., `captain_kirk`)
- **Character names**: Proper case (e.g., `Captain Kirk`)

### Attribute Guidelines
- **Consistency**: All characters in a set should have the same attributes
- **Balance**: Ensure good distribution of attribute values
- **Simplicity**: 4-6 attributes work best for gameplay
- **Boolean values**: Use `true`/`false` for yes/no attributes

### Recommended Attribute Types
- **Gender**: `"male"`, `"female"`, `"non-binary"`
- **Boolean**: `true`, `false`
- **Categories**: `"small"`, `"medium"`, `"large"`
- **Locations**: Specific places relevant to the theme

## 🎨 Image Management

Character images should be placed in:
```
public/images/characters/<setId>/<characterId>.png
```

Example:
```
public/images/characters/pirates/blackbeard.png
public/images/characters/pirates/anne_bonny.png
```

The system automatically generates image paths based on set ID and character ID.

## 🧪 Testing New Character Sets

1. **Create the character set**:
   ```bash
   npm run characters template my_set
   ```

2. **Edit the file**: Customize `characters/my_set.json`

3. **Validate the set**:
   ```bash
   npm run characters validate
   ```

4. **Test in game**:
   ```bash
   npm run test-game
   ```

5. **Add images**: Place character images in `public/images/characters/my_set/`

## 🚨 Troubleshooting

### Common Issues

1. **"Character set not found"**
   - Check file exists in `characters/` directory
   - Ensure filename matches set ID
   - Run `npm run characters validate`

2. **"Invalid character set structure"**
   - Check JSON syntax with a validator
   - Ensure all required fields are present
   - Run `npm run characters validate`

3. **Images not loading**
   - Check image files exist in correct directory
   - Ensure filenames match character IDs
   - Check image file extensions are `.png`

### Validation Errors

The validation system checks for:
- ✅ Valid JSON syntax
- ✅ Required fields (setName, description, characters)
- ✅ Unique character IDs
- ✅ Consistent attribute structure
- ✅ Non-empty character arrays

## 🔄 Migration from Old System

The new system is backward compatible. The server automatically:
1. Loads character sets from JSON files
2. Converts them to the legacy format for game compatibility
3. Maintains all existing API endpoints

No changes needed to existing game client code!

## 🎯 Benefits of New System

### ✅ **Easy Management**
- Add/remove character sets without code changes
- Simple JSON format for non-developers
- Command-line tools for management

### ✅ **Flexible Structure**
- Support for any attribute types
- Unlimited character sets
- Custom themes and categories

### ✅ **Developer Friendly**
- Hot reloading for development
- Validation and error checking
- Programmatic API access

### ✅ **Maintainable**
- Separate data from code
- Version control friendly
- Easy backup and sharing

## 🚀 Future Enhancements

Potential future features:
- Web-based character set editor
- Automatic image optimization
- Character set sharing/marketplace
- Advanced validation rules
- Multi-language support

---

**Ready to create your own character sets?** Start with:
```bash
npm run characters template my_awesome_set
```