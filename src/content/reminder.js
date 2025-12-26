/**
 * Lexi.ai Reminder Banner
 * Injected by content script to show practice reminders
 */

// Styles for the reminder banner
const REMINDER_STYLES = `
.lexi-reminder-banner {
    position: fixed;
    top: 20px;
    right: 20px;
    width: 320px;
    background: #ffffff;
    border-radius: 12px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    z-index: 2147483647;
    animation: lexiSlideIn 0.3s ease-out;
    overflow: hidden;
}

@keyframes lexiSlideIn {
    from {
        opacity: 0;
        transform: translateX(100px);
    }
    to {
        opacity: 1;
        transform: translateX(0);
    }
}

.lexi-reminder-banner.hiding {
    animation: lexiSlideOut 0.3s ease-in forwards;
}

@keyframes lexiSlideOut {
    from {
        opacity: 1;
        transform: translateX(0);
    }
    to {
        opacity: 0;
        transform: translateX(100px);
    }
}

.lexi-reminder-header {
    background: linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%);
    color: white;
    padding: 16px 20px;
}

.lexi-reminder-title {
    font-size: 14px;
    font-weight: 600;
    margin: 0 0 4px 0;
}

.lexi-reminder-count {
    font-size: 12px;
    opacity: 0.9;
}

.lexi-reminder-body {
    padding: 16px 20px;
}

.lexi-reminder-message {
    font-size: 13px;
    color: #64748b;
    margin: 0 0 16px 0;
    line-height: 1.5;
}

.lexi-reminder-actions {
    display: flex;
    gap: 10px;
}

.lexi-btn {
    flex: 1;
    padding: 10px 16px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    border: none;
    transition: all 0.2s;
}

.lexi-btn-primary {
    background: #7c3aed;
    color: white;
}

.lexi-btn-primary:hover {
    background: #6d28d9;
}

.lexi-btn-secondary {
    background: #f1f5f9;
    color: #64748b;
}

.lexi-btn-secondary:hover {
    background: #e2e8f0;
    color: #475569;
}

.lexi-snooze-dropdown {
    position: relative;
}

.lexi-snooze-menu {
    display: none;
    position: absolute;
    bottom: 100%;
    left: 0;
    right: 0;
    background: white;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    margin-bottom: 8px;
    overflow: hidden;
}

.lexi-snooze-menu.show {
    display: block;
}

.lexi-snooze-option {
    display: block;
    width: 100%;
    padding: 10px 16px;
    border: none;
    background: none;
    text-align: left;
    font-size: 13px;
    color: #374151;
    cursor: pointer;
    transition: background 0.15s;
}

.lexi-snooze-option:hover {
    background: #f3f4f6;
}
`;

// Motivational messages (friendly, no emojis)
const MESSAGES = [
    "A few minutes of practice makes a big difference.",
    "Keep the momentum going with a quick review.",
    "Your vocabulary grows one word at a time.",
    "Consistency is the key to mastery.",
    "Small steps lead to big achievements.",
    "Your future self will thank you for practicing today."
];

function getRandomMessage() {
    return MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
}

function createReminderBanner(dueCount) {
    // Inject styles if not already present
    if (!document.getElementById('lexi-reminder-styles')) {
        const styleEl = document.createElement('style');
        styleEl.id = 'lexi-reminder-styles';
        styleEl.textContent = REMINDER_STYLES;
        document.head.appendChild(styleEl);
    }

    // Create banner
    const banner = document.createElement('div');
    banner.className = 'lexi-reminder-banner';
    banner.id = 'lexi-reminder-banner';

    banner.innerHTML = `
        <div class="lexi-reminder-header">
            <p class="lexi-reminder-title">Time to practice</p>
            <p class="lexi-reminder-count">${dueCount} word${dueCount !== 1 ? 's' : ''} ready for review</p>
        </div>
        <div class="lexi-reminder-body">
            <p class="lexi-reminder-message">${getRandomMessage()}</p>
            <div class="lexi-reminder-actions">
                <button class="lexi-btn lexi-btn-primary" id="lexi-practice-now">Practice Now</button>
                <div class="lexi-snooze-dropdown">
                    <button class="lexi-btn lexi-btn-secondary" id="lexi-snooze-btn">Snooze</button>
                    <div class="lexi-snooze-menu" id="lexi-snooze-menu">
                        <button class="lexi-snooze-option" data-minutes="30">30 minutes</button>
                        <button class="lexi-snooze-option" data-minutes="60">1 hour</button>
                        <button class="lexi-snooze-option" data-minutes="180">3 hours</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(banner);

    // Event listeners
    document.getElementById('lexi-practice-now').addEventListener('click', () => {
        chrome.runtime.sendMessage({ type: 'OPEN_PRACTICE' });
        dismissBanner();
    });

    const snoozeBtn = document.getElementById('lexi-snooze-btn');
    const snoozeMenu = document.getElementById('lexi-snooze-menu');

    snoozeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        snoozeMenu.classList.toggle('show');
    });

    document.querySelectorAll('.lexi-snooze-option').forEach(option => {
        option.addEventListener('click', () => {
            const minutes = parseInt(option.dataset.minutes);
            chrome.runtime.sendMessage({ type: 'SNOOZE_REMINDER', minutes });
            dismissBanner();
        });
    });

    // Close snooze menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!snoozeBtn.contains(e.target)) {
            snoozeMenu.classList.remove('show');
        }
    });

    // Auto-dismiss after 15 seconds
    setTimeout(() => {
        if (document.getElementById('lexi-reminder-banner')) {
            dismissBanner();
        }
    }, 15000);
}

function dismissBanner() {
    const banner = document.getElementById('lexi-reminder-banner');
    if (banner) {
        banner.classList.add('hiding');
        setTimeout(() => banner.remove(), 300);
    }
}

// Export for use by content.js
window.LexiReminder = {
    show: createReminderBanner,
    dismiss: dismissBanner
};
