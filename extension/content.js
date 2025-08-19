// Enhanced Content Script for Streak Tracker
class StreakButton {
  constructor() {
    this.buttonId = 'advanced-streak-button';
    this.isButtonVisible = false;
    this.init();
  }

  init() {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => this.startButtonLogic());
    } else {
      this.startButtonLogic();
    }
  }

  async startButtonLogic() {
    console.log("🔥 Advanced Streak Tracker content script loaded");
    
    // Check if button should be shown
    const response = await this.sendMessage({ action: "shouldShowButton" });
    
    if (response.shouldShow) {
      // Show button after 5 seconds delay (as requested)
      setTimeout(() => {
        this.showStreakButton();
      }, 5000);
    } else {
      console.log("Button not shown - already marked today or conditions not met");
    }
  }

  async sendMessage(message) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(message, (response) => {
        resolve(response || {});
      });
    });
  }

  async showStreakButton() {
    // Prevent multiple buttons
    if (document.getElementById(this.buttonId) || this.isButtonVisible) {
      return;
    }

    // Get current streak data for button text
    const streakData = await this.sendMessage({ action: "getStreakStats" });
    
    const button = this.createButton(streakData);
    document.body.appendChild(button);
    this.isButtonVisible = true;

    // Add entrance animation
    requestAnimationFrame(() => {
      button.style.transform = 'translateX(0)';
      button.style.opacity = '1';
    });
  }

  createButton(streakData) {
    const button = document.createElement("button");
    button.id = this.buttonId;
    
    // Dynamic button text based on streak status
    let buttonText = "Mark Today as Done";
    let buttonColor = "#ff4500";
    
    if (streakData.currentStreak > 0) {
      buttonText = `Continue Streak (Day ${streakData.currentStreak + 1})`;
      buttonColor = "#00c851";
    }
    
    button.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="font-size: 18px;">🔥</span>
        <span>${buttonText}</span>
      </div>
    `;
    
    // Enhanced styling
    button.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      padding: 12px 20px;
      background: linear-gradient(45deg, ${buttonColor}, ${this.lightenColor(buttonColor, 20)});
      color: white;
      border: none;
      border-radius: 25px;
      cursor: pointer;
      z-index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      font-weight: 600;
      box-shadow: 0 4px 15px rgba(0,0,0,0.2);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      transform: translateX(100px);
      opacity: 0;
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255,255,255,0.2);
    `;

    // Hover effects
    button.addEventListener('mouseenter', () => {
      button.style.transform = 'translateX(0) scale(1.05)';
      button.style.boxShadow = '0 6px 20px rgba(0,0,0,0.3)';
    });

    button.addEventListener('mouseleave', () => {
      button.style.transform = 'translateX(0) scale(1)';
      button.style.boxShadow = '0 4px 15px rgba(0,0,0,0.2)';
    });

    // Click handler
    button.addEventListener('click', () => this.handleButtonClick(button));

    return button;
  }

  async handleButtonClick(button) {
    // Prevent double clicks
    button.disabled = true;
    button.style.opacity = '0.7';

    // Show loading state
    const originalContent = button.innerHTML;
    button.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <div style="width: 18px; height: 18px; border: 2px solid #ffffff; border-top: 2px solid transparent; border-radius: 50%; animation: spin 1s linear infinite;"></div>
        <span>Marking...</span>
      </div>
    `;

    // Add loading animation styles
    if (!document.getElementById('streak-loading-styles')) {
      const style = document.createElement('style');
      style.id = 'streak-loading-styles';
      style.textContent = `
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `;
      document.head.appendChild(style);
    }

    try {
      const result = await this.sendMessage({ action: "markStreak" });
      
      if (result.success) {
        // Success animation
        button.innerHTML = `
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 18px;">✅</span>
            <span>Streak Marked!</span>
          </div>
        `;
        button.style.background = 'linear-gradient(45deg, #00c851, #00ff62)';
        
        // Remove button after success
        setTimeout(() => {
          this.removeButton(button);
        }, 2000);
        
      } else {
        // Error state
        button.innerHTML = `
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 18px;">❌</span>
            <span>${result.message}</span>
          </div>
        `;
        button.style.background = 'linear-gradient(45deg, #ff4444, #ff6666)';
        
        // Restore original state after showing error
        setTimeout(() => {
          button.innerHTML = originalContent;
          button.style.background = 'linear-gradient(45deg, #ff4500, #ff6600)';
          button.disabled = false;
          button.style.opacity = '1';
        }, 3000);
      }
    } catch (error) {
      console.error("Error marking streak:", error);
      
      // Error state
      button.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 18px;">❌</span>
          <span>Error occurred</span>
        </div>
      `;
      button.style.background = 'linear-gradient(45deg, #ff4444, #ff6666)';
      
      setTimeout(() => {
        button.innerHTML = originalContent;
        button.style.background = 'linear-gradient(45deg, #ff4500, #ff6600)';
        button.disabled = false;
        button.style.opacity = '1';
      }, 3000);
    }
  }

  removeButton(button) {
    button.style.transform = 'translateX(100px)';
    button.style.opacity = '0';
    
    setTimeout(() => {
      if (button.parentNode) {
        button.parentNode.removeChild(button);
      }
      this.isButtonVisible = false;
    }, 300);
  }

  lightenColor(color, percent) {
    const num = parseInt(color.replace("#", ""), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) + amt;
    const G = (num >> 8 & 0x00FF) + amt;
    const B = (num & 0x0000FF) + amt;
    return "#" + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
      (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
      (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
  }
}

// Initialize the streak button
new StreakButton();