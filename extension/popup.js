// Advanced Popup Script for Streak Tracker
class StreakPopup {
  constructor() {
    this.elements = {
      loading: document.getElementById('loading'),
      content: document.getElementById('content'),
      statusIndicator: document.getElementById('statusIndicator'),
      statusIcon: document.getElementById('statusIcon'),
      statusText: document.getElementById('statusText'),
      currentStreak: document.getElementById('currentStreak'),
      longestStreak: document.getElementById('longestStreak'),
      totalDays: document.getElementById('totalDays'),
      successRate: document.getElementById('successRate'),
      progressFill: document.getElementById('progressFill'),
      markBtn: document.getElementById('markBtn'),
      resetBtn: document.getElementById('resetBtn')
    };

    this.init();
  }

  async init() {
    this.setupEventListeners();
    await this.loadStreakData();
  }

  setupEventListeners() {
    this.elements.markBtn.addEventListener('click', () => this.markStreak());
    this.elements.resetBtn.addEventListener('click', () => this.resetStreak());
  }

  async sendMessage(message) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(message, (response) => {
        resolve(response || {});
      });
    });
  }

  async loadStreakData() {
    try {
      this.showLoading(true);
      
      const stats = await this.sendMessage({ action: "getStreakStats" });
      this.updateUI(stats);
      
      this.showLoading(false);
    } catch (error) {
      console.error("Error loading streak data:", error);
      this.showError("Failed to load streak data");
    }
  }

  updateUI(stats) {
    // Update numbers with animation
    this.animateNumber(this.elements.currentStreak, stats.currentStreak);
    this.animateNumber(this.elements.longestStreak, stats.longestStreak);
    this.animateNumber(this.elements.totalDays, stats.totalDays);
    
    // Update success rate
    this.elements.successRate.textContent = `${stats.successRate}%`;
    
    // Update progress bar
    const progressPercent = Math.min((stats.currentStreak / Math.max(stats.longestStreak, 10)) * 100, 100);
    this.elements.progressFill.style.width = `${progressPercent}%`;
    
    // Update status
    this.updateStatus(stats);
    
    // Update button states
    this.updateButtons(stats);
  }

  animateNumber(element, targetValue, duration = 1000) {
    const startValue = parseInt(element.textContent) || 0;
    const difference = targetValue - startValue;
    const startTime = performance.now();
    
    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function for smooth animation
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      const currentValue = Math.round(startValue + (difference * easeOutQuart));
      
      element.textContent = currentValue;
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
  }

  updateStatus(stats) {
    let statusClass, statusIcon, statusText;
    
    switch (stats.status) {
      case 'active':
        if (stats.canMarkToday) {
          statusClass = 'status-pending';
          statusIcon = '⏳';
          statusText = 'Ready to mark today!';
        } else {
          statusClass = 'status-active';
          statusIcon = '🔥';
          statusText = 'Streak is active!';
        }
        break;
      case 'pending':
        statusClass = 'status-pending';
        statusIcon = '⏳';
        statusText = 'Mark today to continue!';
        break;
      case 'broken':
        statusClass = 'status-broken';
        statusIcon = '💔';
        statusText = 'Streak broken - start fresh!';
        break;
      default:
        statusClass = 'status-pending';
        statusIcon = '🎯';
        statusText = 'Start your streak today!';
    }
    
    this.elements.statusIndicator.className = `status-indicator ${statusClass}`;
    this.elements.statusIcon.textContent = statusIcon;
    this.elements.statusText.textContent = statusText;
  }

  updateButtons(stats) {
    // Update mark button
    if (stats.canMarkToday) {
      this.elements.markBtn.disabled = false;
      this.elements.markBtn.textContent = stats.currentStreak > 0 ? 
        `Day ${stats.currentStreak + 1}` : 'Start Streak';
    } else {
      this.elements.markBtn.disabled = true;
      this.elements.markBtn.textContent = 'Already Marked';
    }
    
    // Reset button is always enabled
    this.elements.resetBtn.disabled = false;
  }

  async markStreak() {
    try {
      this.elements.markBtn.disabled = true;
      const originalText = this.elements.markBtn.textContent;
      this.elements.markBtn.textContent = 'Marking...';
      
      const result = await this.sendMessage({ action: "markStreak" });
      
      if (result.success) {
        // Success feedback
        this.elements.markBtn.textContent = '✅ Marked!';
        this.elements.markBtn.style.background = 'linear-gradient(45deg, #00c851, #00ff62)';
        
        // Reload data to show updated stats
        setTimeout(async () => {
          await this.loadStreakData();
          this.elements.markBtn.style.background = '';
        }, 1500);
        
      } else {
        // Error feedback
        this.elements.markBtn.textContent = result.message || 'Error';
        this.elements.markBtn.style.background = 'linear-gradient(45deg, #ff4444, #ff6666)';
        
        setTimeout(() => {
          this.elements.markBtn.textContent = originalText;
          this.elements.markBtn.style.background = '';
          this.elements.markBtn.disabled = false;
        }, 2000);
      }
      
    } catch (error) {
      console.error("Error marking streak:", error);
      this.showError("Failed to mark streak");
    }
  }

  async resetStreak() {
    // Confirmation dialog
    if (!confirm('Are you sure you want to reset your streak? This action cannot be undone.')) {
      return;
    }
    
    try {
      this.elements.resetBtn.disabled = true;
      this.elements.resetBtn.textContent = 'Resetting...';
      
      await this.sendMessage({ action: "resetStreak" });
      
      // Success feedback
      this.elements.resetBtn.textContent = '✅ Reset!';
      this.elements.resetBtn.style.background = 'linear-gradient(45deg, #00c851, #00ff62)';
      
      // Reload data
      setTimeout(async () => {
        await this.loadStreakData();
        this.elements.resetBtn.style.background = '';
        this.elements.resetBtn.textContent = 'Reset';
        this.elements.resetBtn.disabled = false;
      }, 1500);
      
    } catch (error) {
      console.error("Error resetting streak:", error);
      this.showError("Failed to reset streak");
    }
  }

  showLoading(show) {
    if (show) {
      this.elements.loading.style.display = 'block';
      this.elements.content.style.display = 'none';
    } else {
      this.elements.loading.style.display = 'none';
      this.elements.content.style.display = 'block';
    }
  }

  showError(message) {
    this.showLoading(false);
    
    // Create error display
    const errorDiv = document.createElement('div');
    errorDiv.innerHTML = `
      <div style="text-align: center; padding: 20px;">
        <div style="font-size: 48px; margin-bottom: 10px;">❌</div>
        <h3 style="margin-bottom: 10px;">Oops!</h3>
        <p style="opacity: 0.8; margin-bottom: 15px;">${message}</p>
        <button class="btn btn-primary" onclick="location.reload()">Try Again</button>
      </div>
    `;
    
    this.elements.content.innerHTML = '';
    this.elements.content.appendChild(errorDiv);
    this.elements.content.style.display = 'block';
  }

  // Add some visual enhancements
  addVisualEffects() {
    // Add floating particles effect for high streaks
    const currentStreak = parseInt(this.elements.currentStreak.textContent);
    
    if (currentStreak >= 7) {
      this.createParticles();
    }
  }

  createParticles() {
    const container = document.querySelector('.container');
    
    for (let i = 0; i < 5; i++) {
      const particle = document.createElement('div');
      particle.innerHTML = ['🔥', '⭐', '💎', '🏆', '⚡'][Math.floor(Math.random() * 5)];
      particle.style.cssText = `
        position: absolute;
        top: ${Math.random() * 100}%;
        left: ${Math.random() * 100}%;
        font-size: ${12 + Math.random() * 8}px;
        opacity: 0.7;
        pointer-events: none;
        animation: float ${2 + Math.random() * 3}s ease-in-out infinite;
        animation-delay: ${Math.random() * 2}s;
        z-index: -1;
      `;
      
      container.appendChild(particle);
      
      // Remove particle after animation
      setTimeout(() => {
        if (particle.parentNode) {
          particle.parentNode.removeChild(particle);
        }
      }, 5000);
    }
    
    // Add CSS for floating animation if not exists
    if (!document.getElementById('particle-styles')) {
      const style = document.createElement('style');
      style.id = 'particle-styles';
      style.textContent = `
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(180deg); }
        }
      `;
      document.head.appendChild(style);
    }
  }
}

// Initialize popup when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new StreakPopup();
});

// Add some extra styling for better visual feedback
const style = document.createElement('style');
style.textContent = `
  .btn:active {
    transform: translateY(0px) !important;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2) !important;
  }
  
  .stat-item:hover {
    transform: translateY(-2px);
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
    transition: all 0.3s ease;
  }
  
  .current-streak:hover {
    transform: translateY(-3px) scale(1.02);
  }
`;
document.head.appendChild(style);