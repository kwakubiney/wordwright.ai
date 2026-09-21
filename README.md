# Wordwright.ai

A Chrome extension that helps you master vocabulary through active practice and spaced repetition.

## Features

### Word Collection
- Add words manually or look up definitions with one click
- Auto-fetch definitions from dictionary API
- AI-generated example sentences when dictionary lacks them
- Reject and edit auto-filled content if not helpful

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
- Jev makes typed sentence-usage judgments directly, with deterministic teaching feedback

## Installation

### Load as Unpacked Extension (Developer Mode)

1. Download or clone this repository
   ```
   git clone https://github.com/kwakubiney/wordwright.git
   ```
2. Open Chrome and go to `chrome://extensions`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked"
5. Select the `wordwright` folder

The extension icon will appear in your toolbar.

### Configure Jev

1. Click the Wordwright.ai icon, then the gear icon (Settings)
2. Add a **TypeSafe API key** for Jev from [console.typesafe.ai](https://console.typesafe.ai)
3. Save and start learning

Sentence evaluation uses Jev directly. Jev returns the score, correctness signals, probabilities, and confidence; the extension supplies short deterministic feedback from that judgment. If Jev reports an uncertain result, the extension asks the learner to self-grade instead of silently guessing.
