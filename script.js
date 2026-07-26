// AETHERIS AI Video Call controller
// Professional low-latency simulation & WebRTC loopback

document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const localVideo = document.getElementById('local-video');
  const localCamPlaceholder = document.getElementById('local-cam-placeholder');
  const btnAudio = document.getElementById('btn-audio');
  const btnVideo = document.getElementById('btn-video');
  const btnCall = document.getElementById('btn-call');
  const btnNoise = document.getElementById('btn-noise');
  const btnFilter = document.getElementById('btn-filter');
  
  const aiModelImg = document.getElementById('ai-model-img');
  const currentModelName = document.getElementById('current-model-name');
  const audioWaveBars = document.getElementById('audio-wave-bars');
  
  // Age Gate Elements
  const gatewayOverlay = document.getElementById('gateway-overlay');
  const btnGateEnter = document.getElementById('btn-gate-enter');
  const btnGateExit = document.getElementById('btn-gate-exit');
  const gateBlockedMsg = document.getElementById('gate-blocked-msg');
  
  const tokenCountVal = document.getElementById('token-count-val');
  const tokenProgressFill = document.getElementById('token-progress-fill-bar');
  const tokenStatusIndicator = document.getElementById('token-status-indicator');
  const countdownTimer = document.getElementById('countdown-timer');
  
  const aiMoodSelect = document.getElementById('ai-mood');
  const transcriptContainer = document.getElementById('transcript-container');
  const chatUserInput = document.getElementById('chat-user-input');
  const btnChatSend = document.getElementById('btn-chat-send');
  const callTimerVal = document.getElementById('call-timer');
  const latencyVal = document.getElementById('latency-val');
  
  // Stats Elements
  const statFps = document.getElementById('stat-fps');
  const statJitter = document.getElementById('stat-jitter');
  const statLag = document.getElementById('stat-lag');
  const statAudio = document.getElementById('stat-audio');
  
  // Modals Elements
  const modalTerms = document.getElementById('modal-terms');
  const modalPrivacy = document.getElementById('modal-privacy');
  const linkTerms = document.getElementById('link-terms');
  const linkPrivacy = document.getElementById('link-privacy');
  const closeTerms = document.getElementById('close-terms');
  const closePrivacy = document.getElementById('close-privacy');
  
  // Notification Banner
  const notification = document.getElementById('app-notification');
  const notificationMsg = document.getElementById('notification-message');
  
  // State variables
  let localStream = null;
  let isAudioActive = true;
  let isVideoActive = true;
  let isNoiseSuppression = true;
  let isCallActive = true;
  
  let totalTokens = 100;
  let consumedTokens = 0;
  let callTimerInterval = null;
  let callSeconds = 0;
  let lastTokenCheckTime = Date.now();
  
  // Web Audio Context for audio analysis
  let audioContext = null;
  let analyser = null;
  let microphoneSource = null;
  let audioDataArray = new Uint8Array(0);
  let userVolumeLevel = 0; // calculated in loop
  
  // Set Greeting Time to Current local time
  const greetingTimeEl = document.getElementById('greeting-time');
  const now = new Date();
  greetingTimeEl.textContent = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  // Notification Helper
  function showNotification(message) {
    notificationMsg.textContent = message;
    notification.classList.add('active');
    setTimeout(() => {
      notification.classList.remove('active');
    }, 4000);
  }

  // Age Gateway verification
  function initAgeGate() {
    const isVerified = localStorage.getItem('aetheris_age_verified') === 'true';
    if (isVerified) {
      gatewayOverlay.classList.add('hidden');
    } else {
      gatewayOverlay.classList.remove('hidden');
    }

    btnGateEnter.addEventListener('click', () => {
      localStorage.setItem('aetheris_age_verified', 'true');
      gatewayOverlay.classList.add('hidden');
      showNotification("AETHERIS gateway unlocked. Connection established.");
      if (!localStream) {
        startLocalWebcam();
      }
    });

    btnGateExit.addEventListener('click', () => {
      gateBlockedMsg.style.display = 'block';
      setTimeout(() => {
        window.location.href = 'https://www.google.com';
      }, 1500);
    });
  }

  // Initial Token Setup
  function initTokens() {
    let savedTokens = localStorage.getItem('aetheris_tokens');
    let lastResetStr = localStorage.getItem('aetheris_last_reset');
    
    const nowMs = Date.now();
    
    if (!savedTokens || !lastResetStr) {
      // First time initialization
      localStorage.setItem('aetheris_tokens', '100');
      localStorage.setItem('aetheris_last_reset', nowMs.toString());
      totalTokens = 100;
    } else {
      const lastReset = parseInt(lastResetStr, 10);
      const timeDiff = nowMs - lastReset;
      const twentyFourHours = 24 * 60 * 60 * 1000;
      
      if (timeDiff >= twentyFourHours) {
        // Reset tokens
        localStorage.setItem('aetheris_tokens', '100');
        localStorage.setItem('aetheris_last_reset', nowMs.toString());
        totalTokens = 100;
        showNotification("Daily 100 Tokens granted!");
      } else {
        totalTokens = parseFloat(savedTokens);
      }
    }
    
    updateTokenUI();
  }

  function updateTokenUI() {
    tokenCountVal.textContent = Math.ceil(totalTokens);
    const percentage = (totalTokens / 100) * 100;
    tokenProgressFill.style.width = `${percentage}%`;
    
    if (totalTokens <= 0) {
      tokenStatusIndicator.textContent = "Exhausted";
      tokenStatusIndicator.style.borderColor = "var(--neon-red)";
      tokenStatusIndicator.style.color = "var(--neon-red)";
      if (isCallActive) {
        endCall("Tokens exhausted. Daily limit reached.");
      }
    } else {
      tokenStatusIndicator.textContent = "Active";
      tokenStatusIndicator.style.borderColor = "rgba(255, 0, 127, 0.2)";
      tokenStatusIndicator.style.color = "var(--neon-pink)";
    }
  }

  // 24-hour Countdown Timer
  function runCountdown() {
    let lastReset = parseInt(localStorage.getItem('aetheris_last_reset') || Date.now(), 10);
    const twentyFourHours = 24 * 60 * 60 * 1000;
    
    setInterval(() => {
      const nowMs = Date.now();
      const nextReset = lastReset + twentyFourHours;
      const remaining = nextReset - nowMs;
      
      if (remaining <= 0) {
        localStorage.setItem('aetheris_tokens', '100');
        localStorage.setItem('aetheris_last_reset', nowMs.toString());
        lastReset = nowMs;
        totalTokens = 100;
        updateTokenUI();
        showNotification("Tokens reset! 100 fresh tokens available.");
      } else {
        const hours = Math.floor(remaining / (1000 * 60 * 60));
        const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((remaining % (1000 * 60)) / 1000);
        
        countdownTimer.textContent = 
          `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
      }
    }, 1000);
  }

  // Camera & Audio permissions and activation
  async function startLocalWebcam() {
    try {
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      
      localStream = await navigator.mediaDevices.getUserMedia({
        video: isVideoActive ? { width: 640, height: 360 } : false,
        audio: true
      });

      localVideo.srcObject = localStream;
      localCamPlaceholder.style.display = 'none';
      localVideo.style.display = 'block';

      initAudioAnalysis(localStream);
      updateTrackMuteStates();
      
    } catch (err) {
      console.warn("Media devices access error: ", err);
      localCamPlaceholder.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#ff2e2e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
        <span style="color:#ff2e2e; font-size:0.75rem; text-align:center;">Camera Blocked / Unavailable</span>
      `;
      try {
        const audioOnlyStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        initAudioAnalysis(audioOnlyStream);
      } catch (audioErr) {
        console.warn("Audio input blocked as well: ", audioErr);
      }
    }
  }

  function initAudioAnalysis(stream) {
    try {
      if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }
      
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 64;
      
      microphoneSource = audioContext.createMediaStreamSource(stream);
      
      if (isNoiseSuppression) {
        const biquadFilter = audioContext.createBiquadFilter();
        biquadFilter.type = "highpass";
        biquadFilter.frequency.value = 150; 
        
        microphoneSource.connect(biquadFilter);
        biquadFilter.connect(analyser);
      } else {
        microphoneSource.connect(analyser);
      }
      
      audioDataArray = new Uint8Array(analyser.frequencyBinCount);
    } catch (e) {
      console.error("Failed to setup Audio Context Analyzer:", e);
    }
  }

  function updateTrackMuteStates() {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = isAudioActive;
      });
      localStream.getVideoTracks().forEach(track => {
        track.enabled = isVideoActive;
      });
    }

    if (isAudioActive) {
      btnAudio.classList.add('active');
    } else {
      btnAudio.classList.remove('active');
    }

    if (isVideoActive) {
      btnVideo.classList.add('active');
      localVideo.style.opacity = 1;
    } else {
      btnVideo.classList.remove('active');
      localVideo.style.opacity = 0;
    }
  }

  // Active call time tracker & token usage
  function startCallTracker() {
    callSeconds = 0;
    lastTokenCheckTime = Date.now();
    callTimerVal.textContent = "00:00";
    
    if (callTimerInterval) clearInterval(callTimerInterval);
    
    callTimerInterval = setInterval(() => {
      if (!isCallActive) return;
      
      callSeconds++;
      const minutes = Math.floor(callSeconds / 60);
      const seconds = callSeconds % 60;
      callTimerVal.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
      
      const now = Date.now();
      const elapsedSec = (now - lastTokenCheckTime) / 1000;
      
      if (elapsedSec >= 15) {
        const deduction = (elapsedSec / 60);
        totalTokens = Math.max(0, totalTokens - deduction);
        localStorage.setItem('aetheris_tokens', totalTokens.toString());
        updateTokenUI();
        lastTokenCheckTime = now;
      }
      
      if (callSeconds % 12 === 0) {
        triggerAIResponse();
      }
    }, 1000);
  }

  function endCall(reason = "Call Disconnected") {
    isCallActive = false;
    clearInterval(callTimerInterval);
    
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      localStream = null;
    }
    
    localVideo.style.display = 'none';
    localCamPlaceholder.style.display = 'flex';
    localCamPlaceholder.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="var(--neon-red)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67 19.42 19.42 0 0 1-2.67-3.33A19.79 19.79 0 0 1 2 4.78 2 2 0 0 1 4 2.56h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8 10.48a16.13 16.13 0 0 0 2.68 2.83z"></path></svg>
      <span style="color:var(--neon-red);">${reason}</span>
    `;
    
    btnCall.classList.remove('end-call');
    btnCall.style.background = 'rgba(16, 185, 129, 0.15)';
    btnCall.style.borderColor = '#10b981';
    btnCall.style.color = '#10b981';
    btnCall.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
    `;
    btnCall.title = "Re-establish Call";
    
    addTranscriptMessage("system", "Session ended. " + reason);
    showNotification(reason);
  }

  function restartCall() {
    isCallActive = true;
    btnCall.classList.add('end-call');
    btnCall.style.background = '';
    btnCall.style.borderColor = '';
    btnCall.style.color = '';
    btnCall.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67 19.42 19.42 0 0 1-2.67-3.33A19.79 19.79 0 0 1 2 4.78 2 2 0 0 1 4 2.56h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8 10.48a16.13 16.13 0 0 0 2.68 2.83z"></path></svg>
    `;
    btnCall.title = "Disconnect Call";
    
    startLocalWebcam();
    startCallTracker();
    addTranscriptMessage("system", "AI calling channel re-established.");
    showNotification("Low-lag signaling tunnel initialized.");
  }

  // Modals operations
  function toggleModal(modal, show) {
    if (show) {
      modal.classList.add('active');
    } else {
      modal.classList.remove('active');
    }
  }

  linkTerms.addEventListener('click', () => toggleModal(modalTerms, true));
  closeTerms.addEventListener('click', () => toggleModal(modalTerms, false));
  
  linkPrivacy.addEventListener('click', () => toggleModal(modalPrivacy, true));
  closePrivacy.addEventListener('click', () => toggleModal(modalPrivacy, false));

  window.addEventListener('click', (e) => {
    if (e.target === modalTerms) toggleModal(modalTerms, false);
    if (e.target === modalPrivacy) toggleModal(modalPrivacy, false);
  });

  // Controls actions
  btnAudio.addEventListener('click', () => {
    isAudioActive = !isAudioActive;
    updateTrackMuteStates();
    showNotification(isAudioActive ? "Microphone active" : "Microphone muted");
  });

  btnVideo.addEventListener('click', () => {
    isVideoActive = !isVideoActive;
    if (isVideoActive) {
      startLocalWebcam();
    } else {
      updateTrackMuteStates();
    }
    showNotification(isVideoActive ? "Webcam preview active" : "Webcam feed suspended");
  });

  btnNoise.addEventListener('click', () => {
    isNoiseSuppression = !isNoiseSuppression;
    if (isNoiseSuppression) {
      btnNoise.classList.add('active');
      showNotification("Ultra-low-lag noise cancellation filter engaged.");
    } else {
      btnNoise.classList.remove('active');
      showNotification("Raw audio bypass mode.");
    }
    if (localStream) {
      initAudioAnalysis(localStream);
    }
  });

  btnCall.addEventListener('click', () => {
    if (isCallActive) {
      endCall("Call terminated by user.");
    } else {
      restartCall();
    }
  });

  // Camera Filters cycling
  const cameraFilters = ['filter-default', 'filter-studio', 'filter-warm', 'filter-cyber', 'filter-monochrome'];
  let currentFilterIndex = 0;
  btnFilter.addEventListener('click', () => {
    aiModelImg.className = '';
    currentFilterIndex = (currentFilterIndex + 1) % cameraFilters.length;
    const newFilter = cameraFilters[currentFilterIndex];
    aiModelImg.classList.add(newFilter);
    
    const filterName = newFilter.replace('filter-', '').toUpperCase();
    showNotification(`Camera Preset: ${filterName}`);
  });

  // Dynamic user message interaction handler
  function handleUserChatMessage() {
    const userText = chatUserInput.value.trim();
    if (!userText) return;
    if (!isCallActive) {
      showNotification("Call connection is offline.");
      return;
    }

    addTranscriptMessage("user", userText);
    chatUserInput.value = "";

    const textLower = userText.toLowerCase();
    const selectedKey = aiMoodSelect.value;
    let responseText = "";
    
    if (selectedKey === 'priya_saree') {
      if (textLower.includes('saree') || textLower.includes('sari') || textLower.includes('cloth') || textLower.includes('wear')) {
        responseText = "This drape is called the Nivi style, which originated in Andhra Pradesh. The border is hand-crafted. Do you like traditional styles?";
      } else if (textLower.includes('beautiful') || textLower.includes('hot') || textLower.includes('look') || textLower.includes('nice') || textLower.includes('sexy')) {
        responseText = "Thank you! I appreciate the compliment. I chose this deep red and gold color theme for its classic elegance.";
      } else {
        responseText = "That is interesting. Let's discuss traditional fabric drapes, weaves, and color palettes!";
      }
    } else if (selectedKey === 'ananya_beach') {
      if (textLower.includes('dress') || textLower.includes('beach') || textLower.includes('ocean') || textLower.includes('water') || textLower.includes('swim')) {
        responseText = "Tropical resort wear is designed to be lightweight. This neon pink shade reflects summer getaway vibes! It's so light and breezy.";
      } else if (textLower.includes('beautiful') || textLower.includes('hot') || textLower.includes('look') || textLower.includes('nice') || textLower.includes('sexy')) {
        responseText = "Thanks! It's so comfortable for sunny beach days, I love bright tropical styling.";
      } else {
        responseText = "The ocean view here is perfect. Tell me, do you prefer beach resort styling, or do you prefer layered winter wear?";
      }
    } else if (selectedKey === 'kavya_cyberpunk') {
      if (textLower.includes('cyber') || textLower.includes('suit') || textLower.includes('neon') || textLower.includes('glow') || textLower.includes('red')) {
        responseText = "My suit uses active optical polymers to channel real-time network states. Visual rendering latency is under 0.05ms.";
      } else if (textLower.includes('beautiful') || textLower.includes('hot') || textLower.includes('look') || textLower.includes('nice')) {
        responseText = "Design aesthetics are configured for high-contrast neon highlights. Perfect for night sync operations.";
      } else {
        responseText = "Suit interface status is stable. Let me know what visual shell parameters you'd like to test next.";
      }
    } else if (selectedKey === 'zara_denim') {
      if (textLower.includes('denim') || textLower.includes('jacket') || textLower.includes('blue') || textLower.includes('casual')) {
        responseText = "Denim is rugged, but this neon blue city wash gives it a sharp, modern cyberpunk edge. Perfect for street styling.";
      } else if (textLower.includes('beautiful') || textLower.includes('hot') || textLower.includes('look') || textLower.includes('nice')) {
        responseText = "Thank you! Classic denim with neon color pop highlights always makes an impression.";
      } else {
        responseText = "Casual urban wear is my go-to choice. What do you think about pairing this jacket with neon blue sneaker highlights?";
      }
    } else if (selectedKey === 'chloe_active') {
      if (textLower.includes('sport') || textLower.includes('active') || textLower.includes('workout') || textLower.includes('fit') || textLower.includes('run')) {
        responseText = "This compression material enhances ventilation and muscular support, designed specifically for high-intensity athletic routines.";
      } else if (textLower.includes('beautiful') || textLower.includes('hot') || textLower.includes('look') || textLower.includes('nice')) {
        responseText = "Appreciate the feedback! High-contrast neon pink keeps visibility high during night runs.";
      } else {
        responseText = "Fitness styling combines function and form. Are you interested in performance wear fabrics or casual athleisure styles?";
      }
    } else {
      responseText = "I'm listening. Tell me more about what you think!";
    }

    // Trigger model speech equalizer wave response
    setTimeout(() => {
      if (!isCallActive) return;
      aiSpeechPulseIntensity = 2.0; 
      addTranscriptMessage("ai", responseText);
    }, 1000);
  }

  btnChatSend.addEventListener('click', handleUserChatMessage);
  chatUserInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      handleUserChatMessage();
    }
  });

  // Model switching logic
  const modelsData = {
    priya_saree: {
      name: "Priya (Saree Model)",
      img: "saree_model.jpg",
      greeting: "Hello, dear. I am Priya. I am presenting this premium red-gold designer saree for you today. How do I look? Let's chat!",
      phrases: [
        "Traditional sarees hold so much elegance and design heritage. Do you like this embroidery?",
        "Yes, the fabric is premium silk. It feels wonderful and flows beautifully.",
        "I can showcase different drapes if you would like to see them later in our call.",
        "Aetheris' low latency makes our fashion conversation feel so natural, don't you think?",
        "Tell me, do you prefer modern styles, or do you appreciate classic traditional wear like this saree?"
      ]
    },
    ananya_beach: {
      name: "Ananya (Beach Dress)",
      img: "beach_dress_model.jpg",
      greeting: "Hi there! Ananya here, enjoying this lovely day in my neon pink beach dress! The ocean breeze is amazing. Let's talk fashion!",
      phrases: [
        "This tropical pink beach dress is perfect for warm summer getaways. It's so light and breezy!",
        "I love walking along the beach in outfits like this. It makes me feel completely refreshed.",
        "Do you have a favorite vacation spot? I would love to dress for it next time.",
        "With Aetheris running at 60fps, you can see the fabric movement perfectly on this video link.",
        "Let's chat about your favorite summer style trends. What kind of colors do you love wearing?"
      ]
    },
    kavya_cyberpunk: {
      name: "Kavya (Cyberpunk Red)",
      img: "cyberpunk_suit_model.jpg",
      greeting: "System online. I am Kavya. Wearing the experimental neon pink and red cyberpunk shell suit. Ready for visual sync.",
      phrases: [
        "This shell is equipped with glowing fiber optics. It is fully integrated with low-latency link channels.",
        "The neon color patterns represent active neural network status feeds.",
        "We are chatting via a secure sandboxed WebRTC lane. Your metrics look fully stable.",
        "Do you like this futuristic design? It is optimized for high-mobility cybernetic operations.",
        "Tell me, does this cyberpunk styling match your workspace colors? I find the neon glow very energizing."
      ]
    },
    zara_denim: {
      name: "Zara (Denim Blue)",
      img: "denim_blue_model.jpg",
      greeting: "Hey! Zara here. How do you like this neon blue denim style? It's all about comfortable casual urban wear. Let's chat!",
      phrases: [
        "Denim jacket design is timeless. The neon blue city glow matches it perfectly.",
        "I love styled casual pieces. They are versatile and easy to wear day or night.",
        "We are getting crisp frames on this calling connection. Telemetry looks fantastic.",
        "Do you want to see other drapes or fits of this premium denim jacket design?",
        "What are your favorite casual fashion trends? Tell me about your wardrobe choices!"
      ]
    },
    chloe_active: {
      name: "Chloe (Active Sportswear)",
      img: "sportswear_pink_model.jpg",
      greeting: "Hello! Chloe here. Reviewing this pink high-performance active sportswear shell. Ready to talk sports and styling!",
      phrases: [
        "Activewear styling is all about high-performance fibers and comfort fit lines.",
        "This bright neon pink highlights the dynamic lines of the design.",
        "Do you work out or do running? Sportswear designs have changed so much lately.",
        "Our audio-visual connection latency is practically zero. Seamless conversation!",
        "Let's chat about healthy living or design details. What interests you today?"
      ]
    }
  };

  aiMoodSelect.addEventListener('change', (e) => {
    const selectedKey = e.target.value;
    const model = modelsData[selectedKey];
    if (model) {
      aiModelImg.style.transform = 'scale(0.95)';
      aiModelImg.style.opacity = '0.5';
      
      setTimeout(() => {
        aiModelImg.src = model.img;
        currentModelName.textContent = model.name;
        aiModelImg.style.transform = 'scale(1)';
        aiModelImg.style.opacity = '1';
        
        addTranscriptMessage("ai", model.greeting);
        showNotification(`Switched to ${model.name}`);
      }, 300);
    }
  });

  // Model Avatars grid selection logic
  const avatarItems = document.querySelectorAll('.model-avatar-item');
  avatarItems.forEach(item => {
    item.addEventListener('click', () => {
      const targetModelKey = item.getAttribute('data-model');
      
      // Update dropdown value
      aiMoodSelect.value = targetModelKey;
      
      // Trigger change event to load details
      aiMoodSelect.dispatchEvent(new Event('change'));
      
      // Update active styling class
      avatarItems.forEach(avatar => avatar.classList.remove('active'));
      item.classList.add('active');
    });
  });

  // Sync dropdown change back to avatar items selection border
  aiMoodSelect.addEventListener('change', (e) => {
    const selectedKey = e.target.value;
    avatarItems.forEach(avatar => {
      if (avatar.getAttribute('data-model') === selectedKey) {
        avatar.classList.add('active');
      } else {
        avatar.classList.remove('active');
      }
    });
  });

  const userPhrases = [
    "That outfit looks absolutely stunning on you!",
    "Can you tell me more about the fabric design?",
    "Where is that background location from?",
    "How does your low-latency video feed stay so sharp?",
    "I really love the neon pink colors on you!"
  ];

  function addTranscriptMessage(sender, text) {
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${sender}`;
    
    let timeStr = "";
    const bTime = new Date();
    timeStr = `${String(bTime.getHours()).padStart(2, '0')}:${String(bTime.getMinutes()).padStart(2, '0')}`;
    
    if (sender === "system") {
      bubble.style.alignSelf = "center";
      bubble.style.background = "rgba(255, 46, 46, 0.05)";
      bubble.style.border = "1px dashed rgba(255, 46, 46, 0.2)";
      bubble.style.color = "var(--text-muted)";
      bubble.style.fontSize = "0.75rem";
      bubble.style.textAlign = "center";
      bubble.innerHTML = `${text}`;
    } else {
      bubble.innerHTML = `${text} <span class="bubble-time">${timeStr}</span>`;
    }
    
    transcriptContainer.appendChild(bubble);
    transcriptContainer.scrollTop = transcriptContainer.scrollHeight;
  }

  let aiPhraseIndex = 0;
  function triggerAIResponse() {
    if (!isCallActive) return;
    
    const simulateUserAsk = Math.random() > 0.5;
    if (simulateUserAsk) {
      const userTxt = userPhrases[Math.floor(Math.random() * userPhrases.length)];
      addTranscriptMessage("user", userTxt);
      
      setTimeout(() => {
        sendAIResponse();
      }, 1000);
    } else {
      sendAIResponse();
    }
  }

  function sendAIResponse() {
    if (!isCallActive) return;
    const selectedKey = aiMoodSelect.value;
    const model = modelsData[selectedKey] || modelsData.priya_saree;
    const phrases = model.phrases;
    const phrase = phrases[aiPhraseIndex % phrases.length];
    aiPhraseIndex++;
    
    // Trigger visual speaker equalizer burst
    aiSpeechPulseIntensity = 1.8;
    
    addTranscriptMessage("ai", phrase);
  }

  // Visual voice wave equalizer bar loop
  let aiSpeechPulseIntensity = 0.0;
  
  function updateEqualizerBars() {
    requestAnimationFrame(updateEqualizerBars);
    
    if (!isCallActive) {
      const bars = audioWaveBars.getElementsByClassName('wave-bar');
      for (let bar of bars) {
        bar.style.height = '4px';
      }
      return;
    }
    
    // Capture user voice audio levels
    if (analyser && isAudioActive) {
      analyser.getByteFrequencyData(audioDataArray);
      let sum = 0;
      for (let i = 0; i < audioDataArray.length; i++) {
        sum += audioDataArray[i];
      }
      userVolumeLevel = sum / audioDataArray.length;
    } else {
      userVolumeLevel = 0;
    }
    
    // Decay AI speech visualizer pulse
    if (aiSpeechPulseIntensity > 0) {
      aiSpeechPulseIntensity -= 0.03;
    } else {
      aiSpeechPulseIntensity = 0;
    }
    
    // Distribute levels across visual equalizer wave bars
    const bars = audioWaveBars.getElementsByClassName('wave-bar');
    for (let i = 0; i < bars.length; i++) {
      let audioVal = 0;
      if (audioDataArray.length > 0 && isAudioActive) {
        const binIndex = Math.floor((i / bars.length) * audioDataArray.length * 0.5);
        audioVal = audioDataArray[binIndex] || 0;
      }
      
      // Compute heights based on both User mic audio level and AI speech visual pulses
      const baseHeight = 4;
      const micAddition = audioVal / 3;
      const aiAddition = aiSpeechPulseIntensity * (Math.sin(i * 1.5 + Date.now() / 100) * 12 + 16);
      
      const targetHeight = Math.min(50, baseHeight + micAddition + aiAddition);
      bars[i].style.height = `${targetHeight}px`;
    }
  }

  // Telemetry stats oscillations (FPS, Jitter, Lag)
  function simulateTelemetry() {
    setInterval(() => {
      if (!isCallActive) {
        statFps.textContent = "0.0";
        statJitter.textContent = "0.0 ms";
        statLag.textContent = "0 ms";
        statAudio.textContent = "0.00 ms";
        latencyVal.textContent = "Offline";
        latencyVal.parentElement.style.color = "var(--neon-red)";
        latencyVal.parentElement.style.background = "rgba(255, 46, 46, 0.1)";
        latencyVal.parentElement.style.borderColor = "rgba(255, 46, 46, 0.2)";
        return;
      }
      
      const fps = (60.0 - Math.random() * 0.2).toFixed(1);
      statFps.textContent = fps;
      
      const jitter = (0.1 + (Math.random() - 0.5) * 0.02).toFixed(2);
      statJitter.textContent = `${jitter} ms`;
      
      const lag = Math.random() > 0.98 ? 1 : 0;
      statLag.textContent = `${lag} ms`;
      statLag.style.color = lag > 0 ? "var(--neon-red)" : "var(--neon-pink)";
      
      latencyVal.textContent = `Latency: ${lag}ms (Ultra-Low)`;
      latencyVal.parentElement.style.color = "#10b981";
      latencyVal.parentElement.style.background = "rgba(16, 185, 129, 0.1)";
      latencyVal.parentElement.style.borderColor = "rgba(16, 185, 129, 0.2)";
      
      const audio = (0.05 + (Math.random() - 0.5) * 0.005).toFixed(3);
      statAudio.textContent = `${audio} ms`;
    }, 800);
  }

  // App Initialization
  initAgeGate();
  initTokens();
  runCountdown();
  
  // Only auto start camera if already verified
  if (localStorage.getItem('aetheris_age_verified') === 'true') {
    startLocalWebcam();
  }
  
  startCallTracker();
  updateEqualizerBars();
  simulateTelemetry();
  
  // Set initial greeting
  setTimeout(() => {
    if (isCallActive) {
      addTranscriptMessage("ai", modelsData.priya_saree.greeting);
    }
  }, 1000);
  
  showNotification("AETHERIS zero-lag model link initialized.");
});

