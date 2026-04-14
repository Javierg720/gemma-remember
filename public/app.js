// ===== DATA =====
let DATA = null;
let currentPerson = null;

// ===== TEXT-TO-SPEECH (Edge TTS Ava Multilingual) =====
let ttsEnabled = true;
let currentAudio = null;

function initTTS() {
  console.log('TTS initialized: Edge TTS Ava Multilingual');
}

async function speak(text) {
  if (!ttsEnabled || !text) return;

  // Stop any currently playing audio
  stopSpeaking();

  try {
    const response = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });

    if (!response.ok) throw new Error('TTS API failed');

    const data = await response.json();
    const audioBlob = base64ToBlob(data.audio, 'audio/mpeg');
    const audioUrl = URL.createObjectURL(audioBlob);

    currentAudio = new Audio(audioUrl);
    currentAudio.play();
    currentAudio.onended = () => URL.revokeObjectURL(audioUrl);

  } catch (err) {
    console.error('TTS error:', err);
    // Fallback to browser TTS
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      speechSynthesis.speak(utterance);
    }
  }
}

function base64ToBlob(base64, mimeType) {
  const bytes = atob(base64);
  const buffer = new ArrayBuffer(bytes.length);
  const arr = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i++) {
    arr[i] = bytes.charCodeAt(i);
  }
  return new Blob([buffer], { type: mimeType });
}

function stopSpeaking() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  if ('speechSynthesis' in window) {
    speechSynthesis.cancel();
  }
}

function toggleTTS() {
  ttsEnabled = !ttsEnabled;
  const btn = document.getElementById('ttsToggle');
  if (btn) {
    btn.classList.toggle('muted', !ttsEnabled);
    btn.title = ttsEnabled ? 'Mute voice' : 'Unmute voice';
  }
  if (!ttsEnabled) stopSpeaking();
}

async function loadData() {
  const res = await fetch('responses.json');
  DATA = await res.json();
  renderFamily();
  setTimeOfDay();
}

function setTimeOfDay() {
  const h = new Date().getHours();
  const el = document.getElementById('timeOfDay');
  if (h < 12) el.textContent = 'morning';
  else if (h < 17) el.textContent = 'afternoon';
  else el.textContent = 'evening';
}

// ===== NAVIGATION =====
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');

  // Update tab bar active states
  document.querySelectorAll('.tab-bar .tab').forEach(t => {
    t.classList.remove('active');
    if (t.querySelector('span') && t.querySelector('span').textContent.toLowerCase() === id) {
      t.classList.add('active');
    }
  });
}

// ===== FAMILY RENDERING =====
function getInitials(name) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase();
}

function getAvatarGradient(color) {
  // Darken the color slightly for better contrast with white text
  const r = parseInt(color.slice(1,3),16);
  const g = parseInt(color.slice(3,5),16);
  const b = parseInt(color.slice(5,7),16);
  const darker = `rgb(${Math.max(0,r-40)},${Math.max(0,g-40)},${Math.max(0,b-40)})`;
  return `linear-gradient(135deg, ${color}, ${darker})`;
}

function renderFamily() {
  if (!DATA) return;
  const people = DATA.photo_queries;

  // Home scroll
  const scroll = document.getElementById('familyScroll');
  scroll.innerHTML = '';
  for (const [key, p] of Object.entries(people)) {
    const el = document.createElement('button');
    el.className = 'family-thumb';
    el.onclick = () => showPerson(key);
    el.innerHTML = `
      <div class="avatar" style="background:${getAvatarGradient(p.color)}">${getInitials(p.name)}</div>
      <span>${p.name}</span>
    `;
    scroll.appendChild(el);
  }

  // Family grid
  const grid = document.getElementById('familyGrid');
  grid.innerHTML = '';
  for (const [key, p] of Object.entries(people)) {
    const el = document.createElement('button');
    el.className = 'family-card';
    el.onclick = () => showPerson(key);
    el.innerHTML = `
      <div class="avatar" style="background:${getAvatarGradient(p.color)}">${getInitials(p.name)}</div>
      <h4>${p.name}</h4>
      <span>${p.relationship}</span>
    `;
    grid.appendChild(el);
  }
}

function showPerson(key) {
  if (!DATA) return;
  const p = DATA.photo_queries[key];
  if (!p) return;
  currentPerson = key;

  document.getElementById('personHeaderName').textContent = p.name;
  document.getElementById('personName').textContent = p.name;
  document.getElementById('personRel').textContent = p.relationship;
  document.getElementById('personStory').textContent = p.story;
  document.getElementById('personAskName').textContent = p.name;

  const avatar = document.getElementById('personAvatar');
  avatar.style.background = getAvatarGradient(p.color);
  avatar.textContent = getInitials(p.name);

  const list = document.getElementById('personMemories');
  list.innerHTML = '';
  for (const cap of p.captions) {
    const li = document.createElement('li');
    li.textContent = cap;
    list.appendChild(li);
  }

  showScreen('person');
}

function goAskAbout() {
  if (!currentPerson || !DATA) return;
  const p = DATA.photo_queries[currentPerson];
  showScreen('ask');
  setTimeout(() => {
    const input = document.getElementById('qInput');
    input.value = `Tell me about ${p.name}`;
    sendMessage();
  }, 350);
}

// ===== IDENTIFY (photo) =====
const fileInput = document.getElementById('fileInput');
const preview = document.getElementById('preview');
const uploadPrompt = document.getElementById('uploadPrompt');
const uploadZone = document.getElementById('uploadZone');
const btnIdentify = document.getElementById('btnIdentify');

fileInput.addEventListener('change', function() {
  const file = this.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    preview.src = e.target.result;
    preview.hidden = false;
    uploadPrompt.hidden = true;
    uploadZone.classList.add('has-image');
    btnIdentify.disabled = false;
  };
  reader.readAsDataURL(file);
});

function doIdentify() {
  if (!DATA) return;

  // Show loading
  const loading = document.getElementById('loading');
  loading.hidden = false;

  // Simulate inference delay
  setTimeout(() => {
    // Pick a random family member for demo (in real app, CLIP would match)
    const keys = Object.keys(DATA.photo_queries);
    const key = keys[Math.floor(Math.random() * keys.length)];
    const p = DATA.photo_queries[key];

    document.getElementById('resultName').textContent = p.name;
    document.getElementById('resultRel').textContent = p.relationship;
    document.getElementById('resultText').textContent = p.response;

    const avatar = document.getElementById('resultAvatar');
    avatar.style.background = getAvatarGradient(p.color);
    avatar.textContent = getInitials(p.name);

    document.getElementById('identifyResult').hidden = false;
    document.getElementById('identifyActions').hidden = true;
    loading.hidden = true;

    // Speak the identification result
    speak(p.response);
  }, 1800);
}

function resetIdentify() {
  preview.hidden = true;
  preview.src = '';
  uploadPrompt.hidden = false;
  uploadZone.classList.remove('has-image');
  btnIdentify.disabled = true;
  fileInput.value = '';
  document.getElementById('identifyResult').hidden = true;
  document.getElementById('identifyActions').hidden = false;
}

// ===== ASK / CHAT =====
const qInput = document.getElementById('qInput');
const messagesEl = document.getElementById('messages');

qInput.addEventListener('keydown', function(e) {
  if (e.key === 'Enter') sendMessage();
});

function goAsk(text) {
  showScreen('ask');
  setTimeout(() => {
    qInput.value = text;
    sendMessage();
  }, 350);
}

function sendFromChip(el) {
  const text = el.textContent;
  qInput.value = text;
  sendMessage();
}

function sendMessage() {
  const text = qInput.value.trim();
  if (!text || !DATA) return;
  qInput.value = '';

  // Hide welcome & suggestions after first message
  const empty = document.querySelector('.chat-empty');
  if (empty) empty.style.display = 'none';
  const sug = document.getElementById('askChips');
  if (sug) sug.style.display = 'none';

  // User message
  addMessage(text, 'user');

  // Typing indicator
  const typing = document.createElement('div');
  typing.className = 'msg-typing';
  typing.innerHTML = '<div class="typing-dots"><span></span><span></span><span></span></div>';
  messagesEl.appendChild(typing);
  scrollChat();

  // Find response
  setTimeout(() => {
    typing.remove();
    const response = findResponse(text);
    addMessage(response, 'bot');
  }, 1200 + Math.random() * 800);
}

function findResponse(query) {
  const q = query.toLowerCase().trim();

  // Direct match in text queries
  for (const [key, val] of Object.entries(DATA.text_queries)) {
    if (q.includes(key) || key.includes(q)) {
      return val.response;
    }
  }

  // Fuzzy: search for person names
  for (const [key, person] of Object.entries(DATA.photo_queries)) {
    if (q.includes(person.name.toLowerCase())) {
      return person.response;
    }
  }

  // Keyword matching
  const keywords = {
    'cookie': 'sarah', 'bak': 'sarah', 'daughter': 'sarah',
    'dog': 'buddy', 'pet': 'buddy', 'golden': 'buddy', 'retriever': 'buddy',
    'doctor': 'dr_chen', 'clinic': 'dr_chen', 'tuesday': 'dr_chen', 'checkup': 'dr_chen',
    'granddaughter': 'maya', 'nana': 'maya', 'draw': 'maya',
    'husband': 'robert', 'wedding': 'robert', 'fish': 'robert', 'rose': 'robert', 'moon river': 'robert',
    'friend': 'margaret', 'quilt': 'margaret', 'thursday': 'margaret',
    'son': 'arki', 'birdhouse': 'arki', 'carpenter': 'arki',
    'jazz': 'uncle_joe', 'fedora': 'uncle_joe', 'uncle': 'uncle_joe',
    'lisa': 'lisa', 'daughter-in-law': 'lisa', 'lemon cake': 'lisa',
  };

  for (const [kw, personKey] of Object.entries(keywords)) {
    if (q.includes(kw)) {
      return DATA.photo_queries[personKey].response;
    }
  }

  // Default
  return "I'm not quite sure about that. Could you try asking in a different way? For example, you can ask me about your family members by name, or about your daily routines.";
}

function addMessage(text, type) {
  const div = document.createElement('div');
  div.className = `msg msg-${type}`;
  div.textContent = text;

  // Add speaker button for bot messages
  if (type === 'bot') {
    const speakBtn = document.createElement('button');
    speakBtn.className = 'speak-btn';
    speakBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07"/></svg>';
    speakBtn.onclick = () => speak(text);
    div.appendChild(speakBtn);

    // Auto-speak bot responses
    speak(text);
  }

  messagesEl.appendChild(div);
  scrollChat();
}

function scrollChat() {
  const chat = document.getElementById('chat');
  requestAnimationFrame(() => {
    chat.scrollTop = chat.scrollHeight;
  });
}

// ===== INIT =====
initTTS();
loadData();
