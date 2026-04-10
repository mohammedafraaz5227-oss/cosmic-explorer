/**
 * AIChat.js — Handles AI chat panel, message rendering, and backend communication.
 */

export class AIChat {
  constructor() {
    this.panel = document.getElementById('ai-panel');
    this.toggle = document.getElementById('ai-toggle');
    this.closeBtn = document.getElementById('ai-panel-close');
    this.form = document.getElementById('ai-form');
    this.input = document.getElementById('ai-input');
    this.messages = document.getElementById('ai-messages');
    this.suggestions = document.getElementById('ai-suggestions');
    this.askAiBtn = document.getElementById('ask-ai-btn');

    this.isOpen = false;
    this.isLoading = false;
    this.contextPlanet = null; // currently selected planet for context

    this._bindEvents();
  }

  _bindEvents() {
    // Toggle panel
    this.toggle.addEventListener('click', () => this.togglePanel());
    this.closeBtn.addEventListener('click', () => this.closePanel());

    // Form submit
    this.form.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = this.input.value.trim();
      if (text && !this.isLoading) {
        this.sendMessage(text);
      }
    });

    // Suggestion buttons
    this.suggestions.addEventListener('click', (e) => {
      if (e.target.classList.contains('suggestion-btn')) {
        const q = e.target.dataset.q;
        if (q && !this.isLoading) {
          this.sendMessage(q);
        }
      }
    });

    // "Ask AI About This Planet" button from planet panel
    this.askAiBtn.addEventListener('click', () => {
      if (this.contextPlanet) {
        this.openPanel();
        this.sendMessage(`Tell me about ${this.contextPlanet.name}`);
      }
    });
  }

  /**
   * Set the current planet context for AI conversations.
   * @param {Object|null} planetData
   */
  setContext(planetData) {
    this.contextPlanet = planetData;
  }

  togglePanel() {
    if (this.isOpen) {
      this.closePanel();
    } else {
      this.openPanel();
    }
  }

  openPanel() {
    this.panel.classList.remove('hidden');
    this.toggle.style.display = 'none';
    this.isOpen = true;
    this.input.focus();
  }

  closePanel() {
    this.panel.classList.add('hidden');
    this.toggle.style.display = 'flex';
    this.isOpen = false;
  }

  /**
   * Send a message to the AI backend.
   * @param {string} text — user's question
   */
  async sendMessage(text) {
    if (this.isLoading) return;

    // Render user message
    this._appendMessage(text, 'user');
    this.input.value = '';

    // Hide suggestions after first question
    this.suggestions.style.display = 'none';

    // Show typing indicator
    const typingEl = this._showTyping();
    this.isLoading = true;

    try {
      const response = await fetch('/ask-space-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: text,
          context: this.contextPlanet ? this.contextPlanet.name : null,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const data = await response.json();
      typingEl.remove();

      const answer = data.answer || data.response || 'I wasn\'t able to process that question. Please try again!';
      this._appendMessage(answer, 'bot');
    } catch (error) {
      typingEl.remove();
      console.error('AI Chat error:', error);

      // Provide a helpful offline fallback
      const fallback = this._getOfflineFallback(text);
      this._appendMessage(fallback, 'bot');
    }

    this.isLoading = false;
    this._scrollToBottom();
  }

  /**
   * Generate a useful response even if backend is unavailable.
   */
  _getOfflineFallback(question) {
    const q = question.toLowerCase();

    if (this.contextPlanet) {
      const p = this.contextPlanet;
      const d = p.data;
      return `📡 AI backend is offline, but here's what I know about **${p.name}**:\n\n` +
        `${p.description}\n\n` +
        `• Radius: ${d.radius}\n` +
        `• Distance from Sun: ${d.distance}\n` +
        `• Orbital Period: ${d.orbitalPeriod}\n` +
        `• Temperature: ${d.temperature}\n` +
        `• Atmosphere: ${d.atmosphere}\n` +
        `• Moons: ${d.moons}`;
    }

    if (q.includes('mars') && q.includes('red')) {
      return '🔴 Mars appears red because its surface is rich in iron oxide (rust). The fine dust in its atmosphere scatters red light, giving the sky a butterscotch color and the planet its distinctive hue.';
    }
    if (q.includes('saturn') && q.includes('ring')) {
      return '💫 Saturn\'s rings are made of billions of particles of ice and rock, ranging from tiny grains to house-sized chunks. They may be remnants of comets, asteroids, or moons that were shattered by Saturn\'s gravity.';
    }
    if (q.includes('europa') || q.includes('life')) {
      return '🌊 Europa, Jupiter\'s moon, has a subsurface ocean beneath its icy crust. This ocean may contain twice as much water as Earth\'s oceans, making it one of the most promising places to search for extraterrestrial life.';
    }
    if (q.includes('hottest')) {
      return '🔥 Venus is the hottest planet at ~462°C — hotter than Mercury despite being farther from the Sun! Its thick CO₂ atmosphere creates an extreme greenhouse effect.';
    }

    return '📡 The AI backend is currently offline. Start the backend server with `node backend/server.js` and add your OpenAI API key to `backend/.env`. In the meantime, try clicking on a planet and asking about it — I have offline data!';
  }

  _appendMessage(text, role) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `ai-msg ${role}`;

    const avatar = document.createElement('span');
    avatar.className = 'msg-avatar';
    avatar.textContent = role === 'bot' ? '🤖' : '👤';

    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';
    
    // Basic Markdown Parser for bold and newlines
    const formattedText = text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n\n/g, '<br><br>')
      .replace(/\n/g, '<br>');
      
    bubble.innerHTML = formattedText;

    msgDiv.appendChild(avatar);
    msgDiv.appendChild(bubble);
    this.messages.appendChild(msgDiv);

    this._scrollToBottom();
  }

  _showTyping() {
    const msgDiv = document.createElement('div');
    msgDiv.className = 'ai-msg bot typing-msg';

    const avatar = document.createElement('span');
    avatar.className = 'msg-avatar';
    avatar.textContent = '🤖';

    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';
    bubble.innerHTML = '<div class="typing-dots"><span></span><span></span><span></span></div>';

    msgDiv.appendChild(avatar);
    msgDiv.appendChild(bubble);
    this.messages.appendChild(msgDiv);

    this._scrollToBottom();
    return msgDiv;
  }

  _scrollToBottom() {
    this.messages.scrollTop = this.messages.scrollHeight;
  }
}
