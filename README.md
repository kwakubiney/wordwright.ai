# Lexi.ai

A Chrome extension that helps you master vocabulary through active practice and spaced repetition.

## Features

### Word Collection
- Add words manually or look up definitions with one click

### Practice Modes
- **Production**: Write your own sentences using the word
- **Cloze**: Fill-in-the-blank with semantic distractors
- **MCQ**: Multiple choice meaning-in-context
- **Rewrite**: Rephrase sentences using the target word
- Dedicated assessment page for distraction-free practice

### Spaced Repetition
- SM-2 algorithm schedules reviews at optimal intervals
- Words due for review appear in Practice tab
- Tab reminders notify you when words are due

### AI Integration
- Choose between OpenRouter (cloud) or Ollama (local)
- AI feedback on sentence usage with detailed explanations
- Privacy-focused local option for offline learning

## Installation

### Load as Unpacked Extension (Developer Mode)

1. Download or clone this repository
   ```
   git clone https://github.com/kwakubiney/lexi.ai.git
   ```
2. Open Chrome and go to `chrome://extensions`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked"
5. Select the `lexi.ai` folder

The extension icon will appear in your toolbar.

### Configure AI Provider

1. Click the Lexi.ai icon, then the gear icon (Settings)
2. Choose your AI provider:
   - **OpenRouter** (cloud): Get a free API key at [openrouter.ai/keys](https://openrouter.ai/keys)
   - **Ollama** (local): Run `ollama serve` and click "Fetch Models"
3. Save and start learning