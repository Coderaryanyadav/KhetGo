# 🤝 Contributing to KhetGo

First off, thank you for considering contributing to KhetGo! It's people like you that make KhetGo such a great tool for farmers across India.

---

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
- [Development Setup](#development-setup)
- [Coding Standards](#coding-standards)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Translation Contributions](#translation-contributions)

---

## 🌟 Code of Conduct

This project and everyone participating in it is governed by our commitment to:

- **Be Respectful**: Treat everyone with respect and kindness
- **Be Collaborative**: Work together towards the common goal of helping farmers
- **Be Inclusive**: Welcome contributors from all backgrounds
- **Be Patient**: Remember that everyone is learning

---

## 🛠️ How Can I Contribute?

### 🐛 Reporting Bugs

Before creating bug reports, please check existing issues. When you create a bug report, include:

- **Clear title** - Summarize the issue in one sentence
- **Steps to reproduce** - Detailed steps to recreate the problem
- **Expected behavior** - What you expected to happen
- **Actual behavior** - What actually happened
- **Screenshots** - If applicable
- **Environment** - Browser version, OS, device type
- **Console errors** - Any JavaScript errors from browser console

**Example:**
```markdown
**Title**: Marketplace listings not loading on Safari

**Steps to Reproduce**:
1. Open KhetGo on Safari 17.x
2. Navigate to Marketplace
3. Observe that no listings appear

**Expected**: Listings should load and display
**Actual**: Page shows empty state indefinitely
**Browser**: Safari 17.2 on macOS Sonoma
**Console Error**: `TypeError: Cannot read property 'data' of undefined`
```

### ✨ Suggesting Features

Feature suggestions are welcome! Please provide:

- **Use case** - Why is this feature needed?
- **Target audience** - Who will benefit?
- **Implementation ideas** - How might this work?
- **Alternatives** - Other ways to achieve the same goal

### 🌐 Translation Contributions

We need help translating KhetGo into more Indian languages! Currently supported:
- English ✅
- हिन्दी (Hindi) ✅
- मराठी (Marathi) ✅

**Needed**: tamil, Telugu, Kannada, Bengali, Gujarati, Punjabi, and more!

See [Translation Guidelines](#translation-contributions) below.

---

## 💻 Development Setup

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Git
- A Supabase account (free tier is fine)

### Getting Started

1. **Fork the repository**
   ```bash
   # Click "Fork" on GitHub, then clone your fork
   git clone https://github.com/YOUR_USERNAME/KhetGo.git
   cd KhetGo
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your Supabase credentials
   ```

4. **Run database migrations**
   - Copy contents of `SCHEMA.sql`
   - Run in your Supabase SQL Editor

5. **Start development server**
   ```bash
   npm run dev
   ```

6. **Open browser**
   - Navigate to `http://localhost:5173`

---

## 📝 Coding Standards

### JavaScript Style Guide

- Use **ES6+** modern JavaScript
- Use **const** by default, **let** when reassignment is needed
- Avoid **var**
- Use **template literals** for string concatenation
- Use **arrow functions** for callbacks
- Add **JSDoc comments** for functions

**Example:**
```javascript
/**
 * Fetches marketplace listings near the user
 * @param {number} latitude - User's latitude
 * @param {number} longitude - User's longitude
 * @param {number} radiusKm - Search radius in kilometers
 * @returns {Promise<Array>} Array of listings
 */
async function getNearbyListings(latitude, longitude, radiusKm = 50) {
  const { data, error } = await supabase
    .from('marketplace_listings')
    .select('*')
    .eq('status', 'active');
  
  if (error) throw error;
  return data;
}
```

### CSS Style Guide

- Use **BEM naming** where applicable
- Keep selectors **specific but not overly nested**
- Use **CSS custom properties** (variables) for theming
- Mobile-first responsive design
- Support dark mode preferences

**Example:**
```css
/* Good */
.marketplace-card {
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
}

.marketplace-card__title {
  font-size: 1.25rem;
  font-weight: 600;
}

/* Avoid deeply nested selectors */
.container .wrapper .card .title { /* Too specific! */ }
```

### File Organization

```
src/
├── main.js           # Main application logic
├── supabase.js       # Supabase client configuration
├── style.css         # Global styles
├── i18n/             # (future) Translation files
└── utils/            # (future) Utility functions
```

---

## 🎯 Commit Guidelines

We follow [Conventional Commits](https://www.conventionalcommits.org/):

### Format
```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types
- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation changes
- **style**: Code formatting (not CSS)
- **refactor**: Code restructuring
- **perf**: Performance improvements
- **test**: Adding tests
- **chore**: Build process, dependencies

### Examples
```bash
feat(marketplace): add filter by crop type

fix(khata): incorrect profit calculation for multiple entries

docs(readme): update installation instructions

refactor(auth): simplify login flow logic
```

---

## 🔄 Pull Request Process

1. **Create a feature branch**
   ```bash
   git checkout -b feat/your-feature-name
   ```

2. **Make your changes**
   - Write clean, documented code
   - Follow coding standards
   - Test your changes thoroughly

3. **Commit your changes**
   ```bash
   git add .
   git commit -m "feat(scope): description"
   ```

4. **Push to your fork**
   ```bash
   git push origin feat/your-feature-name
   ```

5. **Open a Pull Request**
   - Go to the original KhetGo repository
   - Click "New Pull Request"
   - Select your fork and branch
   - Fill out the PR template

### PR Checklist

- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex logic
- [ ] Documentation updated (if needed)
- [ ] No console errors or warnings
- [ ] Tested on desktop and mobile
- [ ] Tested on at least 2 browsers
- [ ] No breaking changes (or clearly documented)

---

## 🌍 Translation Contributions

### Adding a New Language

1. **Create translation object** in `src/main.js`:
   ```javascript
   const translations = {
     en: { /* existing */ },
     hi: { /* existing */ },
     mr: { /* existing */ },
     ta: { // Tamil (new)
       appTitle: "கேட்கோ",
       marketplace: "சந்தை",
       // ... add all translations
     }
   };
   ```

2. **Test thoroughly**
   - Ensure all UI strings are translated
   - Check for text overflow issues
   - Verify culturally appropriate terms

3. **Update language selector**
   - Add new language option in the UI

### Translation Guidelines

- **Use formal/respectful tone** - We're addressing farmers of all ages
- **Keep it simple** - Avoid complex technical jargon
- **Be culturally aware** - Use region-appropriate agricultural terms
- **Test with native speakers** - If possible, have a native speaker review

---

## 🏆 Recognition

Contributors will be recognized in:
- README.md Contributors section
- CHANGELOG.md for significant contributions
- Project documentation

---

## 📞 Questions?

- **GitHub Discussions**: Ask questions and share ideas
- **Issues**: For bug reports and feature requests
- **Email**: [Your contact email]

---

**Thank you for contributing to KhetGo! Together, we're empowering Indian farmers.** 🌾💚

**Built with ❤️ by contributors like you**
