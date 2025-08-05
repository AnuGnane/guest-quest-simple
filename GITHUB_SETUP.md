# GitHub Setup Instructions

## 🔗 Link Your Project to GitHub

### Step 1: Create GitHub Repository
1. Go to [GitHub.com](https://github.com) and sign in
2. Click the "+" icon in the top right corner
3. Select "New repository"
4. Fill in the details:
   - **Repository name**: `guest-quest-simple`
   - **Description**: `A simplified multiplayer Guess Who game`
   - **Visibility**: Public (or Private if you prefer)
   - **DO NOT** initialize with README, .gitignore, or license (we already have these)
5. Click "Create repository"

### Step 2: Connect Local Repository to GitHub
After creating the repository, GitHub will show you commands. Use these:

```bash
# Add GitHub as remote origin (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/guest-quest-simple.git

# Rename main branch to 'main' (optional, GitHub prefers 'main' over 'master')
git branch -M main

# Push your code to GitHub
git push -u origin main
```

### Step 3: Verify Upload
1. Refresh your GitHub repository page
2. You should see all your files uploaded
3. The README.md should display automatically

## 🔄 Daily Workflow

### Making Changes
```bash
# After making changes to your code
git add .
git commit -m "Describe what you changed"
git push
```

### Common Commit Messages
- `git commit -m "Add new character set"`
- `git commit -m "Fix WebSocket connection issue"`
- `git commit -m "Improve game UI styling"`
- `git commit -m "Add player reconnection feature"`

## 🌟 GitHub Features You Can Use

### Issues
- Track bugs and feature requests
- Plan improvements
- Collaborate with others

### Releases
- Tag stable versions
- Provide download packages
- Document version changes

### GitHub Pages (Optional)
You can host your game for free on GitHub Pages:
1. Go to repository Settings
2. Scroll to "Pages" section
3. Select source branch (main)
4. Your game will be available at: `https://YOUR_USERNAME.github.io/guest-quest-simple`

Note: For GitHub Pages, you'll need to modify the WebSocket connection in `game.js` to work with the hosted environment.

## 🔒 Security Note

Never commit sensitive information like:
- API keys
- Passwords
- Personal information
- Environment variables with secrets

Use `.env` files (already in .gitignore) for sensitive data.

## 🎉 You're All Set!

Your Guest Quest Simple game is now:
- ✅ Version controlled with Git
- ✅ Backed up on GitHub
- ✅ Ready for collaboration
- ✅ Easy to deploy anywhere

Happy coding! 🚀