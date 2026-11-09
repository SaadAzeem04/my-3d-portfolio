import * as THREE from 'three';
import { GoogleGenAI } from '@google/genai';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// 1. Scene, Camera, Renderer
const scene = new THREE.Scene();
// No scene.background: the canvas is transparent so the background video shows through

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 20;

const canvas = document.querySelector('#bg');
const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);

// 2. Lighting (mint + amber to match the site)
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
const mintLight = new THREE.PointLight(0x6ee7b7, 600);
mintLight.position.set(10, 10, 10);
const amberLight = new THREE.PointLight(0xffb347, 400);
amberLight.position.set(-12, -4, 8);
scene.add(ambientLight, mintLight, amberLight);

// 4. Load 3D Avatar (.glb)
let avatar;
const gltfLoader = new GLTFLoader();
gltfLoader.load(
  '/avatar.glb',
  (gltf) => {
    avatar = gltf.scene;
    avatar.position.x = 5;
    avatar.position.y = -2;
    avatar.scale.set(15, 15, 15);
    scene.add(avatar);
  },
  undefined,
  (error) => console.error('Error loading the avatar model:', error)
);

// 5. Mouse parallax
let mx = 0, my = 0;
window.addEventListener('mousemove', (e) => {
  mx = (e.clientX / window.innerWidth - 0.5) * 2;
  my = (e.clientY / window.innerHeight - 0.5) * 2;
});

// Click the avatar to make it spin
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let spin = 0;
window.addEventListener('click', (e) => {
  if (!avatar || e.target.closest('a, button, input, textarea, #chat-window')) return;
  pointer.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  if (raycaster.intersectObject(avatar, true).length) spin = 0.35;
});

// 6. Animation loop
function animate() {
  requestAnimationFrame(animate);
  if (avatar) {
    avatar.rotation.y += 0.01 + spin;
    spin *= 0.95;                                                  // click spin fades out
    avatar.rotation.x += (my * 0.15 - avatar.rotation.x) * 0.05;   // tilts toward mouse
    avatar.position.x += (5 + mx * 0.8 - avatar.position.x) * 0.05;
    avatar.position.y = -2 + Math.sin(performance.now() / 900) * 0.25; // gentle floating
  }
  renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// 7. Scroll animation
function moveCamera() {
  const t = document.body.getBoundingClientRect().top;
  if (avatar) {
    avatar.rotation.y += 0.05;
    avatar.position.z = t * -0.001;
  }
  camera.position.z = t * -0.01 + 20;
  camera.position.x = t * -0.0002;
  camera.position.y = t * -0.0002;
}
document.body.onscroll = moveCamera;
moveCamera();

// ==========================================
// UI effects: typing, counters, reveal
// ==========================================
const roles = ['Game Developer', 'Unity & Unreal Engine', 'C# & C++', 'Level & Story Design'];
const typingEl = document.getElementById('typing');
let r = 0, c = 0, deleting = false;
function type() {
  const word = roles[r];
  c += deleting ? -1 : 1;
  typingEl.textContent = word.slice(0, c);
  let delay = deleting ? 40 : 90;
  if (!deleting && c === word.length) { deleting = true; delay = 1400; }
  else if (deleting && c === 0) { deleting = false; r = (r + 1) % roles.length; delay = 350; }
  setTimeout(type, delay);
}
if (typingEl) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) typingEl.textContent = roles[0];
  else type();
}

function countUp(el) {
  const target = parseFloat(el.dataset.count);
  const dec = parseInt(el.dataset.dec || '0', 10);
  const suffix = el.dataset.suffix || '';
  const start = performance.now();
  (function step(now) {
    const p = Math.min((now - start) / 1200, 1);
    el.textContent = (target * p).toFixed(dec) + (p === 1 ? suffix : '');
    if (p < 1) requestAnimationFrame(step);
  })(start);
}

const io = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add('in');
    entry.target.querySelectorAll('[data-count]').forEach(countUp);
    io.unobserve(entry.target);
  });
}, { threshold: 0.15 });
document.querySelectorAll('.reveal').forEach((el) => io.observe(el));

// ==========================================
// Contact Form
// ==========================================
const form = document.getElementById('contact-form');
const statusDiv = document.getElementById('form-status');

if (form) {
  form.addEventListener('submit', function (event) {
    event.preventDefault();
    statusDiv.textContent = 'Sending...';
    statusDiv.style.color = '#ffb347';

    emailjs.sendForm('service_jerlz5g', 'template_26a0iws', form).then(
      () => {
        statusDiv.textContent = 'Message sent successfully!';
        statusDiv.style.color = '#6ee7b7';
        form.reset();
      },
      (error) => {
        statusDiv.textContent = 'Failed to send the message. Please try again.';
        statusDiv.style.color = '#ff6b6b';
        console.log('FAILED...', error);
      }
    );
  });
}

// ==========================================
// RAG Chatbot
// ==========================================
// Key now comes from a .env file (VITE_GEMINI_API_KEY), not from the code.
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const ai = API_KEY ? new GoogleGenAI({ apiKey: API_KEY }) : null;

const saadContext = `
You are an AI assistant for Syed Saad Azeem's professional portfolio website. Your job is to answer questions politely and accurately based ONLY on the following information. Do not make up any facts.

Personal Details:
- Name: Syed Saad Azeem
- Age: 21 years old
- Location: North Karachi, Pakistan
- Email: saadazeem9689@gmail.com
- Contact: 0317-2709689
- LinkedIn: https://www.linkedin.com/in/syed-saad-azeem-912416363/
- Instagram: https://www.instagram.com/saadazeem710
- Other Activities: Provides tuition services and explores social media marketing (Email Marketing).

Education:
- Currently a fourth-year BS Computer Science (Gaming & Animation) student at NED University of Engineering & Technology, Karachi (2023 - Present) with a CGPA of 3.48 (up to 6th Semester).
- Previously enrolled in Electronics Engineering (CGPA: 3.73) before transferring to BSCS.
- Intermediate (Pre-Engineering) from Govt. Delhi College, Karachi (80.0%).
- Matriculation from Education Trust Nasra School, Karachi (92.3%).

Certifications (CEGA - Center for Excellence in Gaming & Animation):
- Unreal Engine Game Development (Blueprint scripting, C++ integration, 3D environment design).
- Game Pre-Production & Design (GDD creation, storyboarding, project pipelines).
- Post Production: Video Editing & Post-Production, Adobe After Effects (Motion Graphics, Visual Effects, 3D camera tracking, Compositing).

Technical Skills:
- Game Engines: Unity, Unreal Engine.
- Web & 3D Web: Three.js, React Three Fiber, Vanilla Three.js, HTML, CSS, JavaScript, Vite.
- Programming Languages: C#, C++, Python.
- Tools: Blender, Adobe After Effects, Canva, Git.
- Concepts: Game Mechanics, Physics Systems, Animation, Level Design, Pre-Production (Team Lead experience), Story Developing, OOP, VR and AR.

Professional Experience:
- Game Development Intern at Game Storm Studios (Summer 2026, 2 Months). Developed a complete 2D game from scratch, designing and implementing 6-7 levels.

Notable Game Projects:
1. The Signal Shutdown (Unity/C#)
2. Coin Cascade (Unity/C#)
3. Furious Seven (Unity/C#)
4. The Living Jungle (Unreal Engine)
5. The Kitchen Carnage (Pre-Production Team Lead)
6. Solar System VR (Unity)
7. WADA (Unreal Engine)
8. Web Portfolio & Network Security (Vanilla Three.js & Pygame)
9. Documentary Style Video: a solo 20-second Adobe After Effects project (final project of the CEGA Post Production course) about the Kennedy and Khrushchev era (1961 to 1963), with an archival memo, hanging photo cards, an animated timeline, 3D camera moves, transitions and sound. Also an After Effects portfolio showreel

Instructions for AI:
- Keep answers professional, concise, and friendly.
- If a user asks about projects, give a brief overview and suggest they check the portfolio sections.
`;

const chatToggleBtn = document.getElementById('chat-toggle-btn');
const chatWindow = document.getElementById('chat-window');
const closeChatBtn = document.getElementById('close-chat');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const chatMessages = document.getElementById('chat-messages');

chatToggleBtn.addEventListener('click', () => {
  chatWindow.classList.remove('hidden');
  chatToggleBtn.style.display = 'none';
});
closeChatBtn.addEventListener('click', () => {
  chatWindow.classList.add('hidden');
  chatToggleBtn.style.display = 'block';
});

// ------------------------------------------
// Built-in answers (work even if the AI server is down)
// ------------------------------------------
const INSTA_URL = 'instagram.com/saadazeem710';
const faq = [
  { k: ['signal', 'siren', 'police'], a: 'The Signal Shutdown (Unity / C#, Semester 5): a 3D story-based game where you survive a police headquarters full of corrupted officers and shut down the siren. Saad made the story and concept.' },
  { k: ['coin', 'cascade', 'platformer'], a: 'Coin Cascade (Unity / C#, Semester 5): a fast-paced 2D platformer with fluid walking and jumping and a high-score system built on coin collection and hazard avoidance. Saad made it on his own.' },
  { k: ['furious', 'racing'], a: 'Furious Seven (Unity / C#, Semester 5): a 3D game that blends open-world and racing, where players complete assigned tasks in each level. Saad made the main menu UI and one level.' },
  { k: ['jungle', 'living'], a: 'The Living Jungle (Unreal Engine, Semester 6): a 3D game where you are trapped in a magical jungle and must fight enemies, collect items and escape the dungeon. Saad worked on the core mechanics.' },
  { k: ['kitchen', 'carnage', 'chef', 'blaze', 'moldrak'], a: 'The Kitchen Carnage (pre-production, Semester 6): a 3D animated action-adventure where Chef Blaze fights corrupted food creatures in a living kitchen and restores balance to the Spice Core to stop Lord Moldrak. Saad was the team lead.' },
  { k: ['solar', 'planet', 'space'], a: 'Solar System (Unity VR, Semester 6): a VR simulator for exploring the solar system, space and spacecraft, with informative details about each planet. Saad did the VR environment design.' },
  { k: ['wada', 'castle', 'rpg'], a: 'WADA (Unreal Engine, Semester 7): an open-world survival RPG where you save your child in a castle using a bow and arrow, a sword and assassination skills. Saad did the level and story design.' },
  { k: ['documentary', 'kennedy', 'khrushchev', 'cold war', 'cuban'], a: 'Documentary Style Video: a solo 20-second Adobe After Effects project, the final project of Saad\'s Post Production course at CEGA. It covers the Kennedy and Khrushchev era (1961 to 1963) with an archival memo, hanging photo cards, an animated timeline, 3D camera moves, transitions and sound. Watch it from the Projects section.' },
  { k: ['after effects', 'aftereffects', 'motion', 'showreel', 'reel', 'vfx', 'video'], a: 'Saad uses Adobe After Effects for motion graphics, visual effects and compositing (he trained in it at CEGA). Check the Showreel section for his portfolio reel and the Projects section for his Documentary Style Video.' },
  { k: ['project', 'portfolio'], a: "Saad's game projects: The Signal Shutdown, Coin Cascade, Furious Seven (Unity), The Living Jungle, WADA (Unreal Engine), The Kitchen Carnage (pre-production, team lead) and Solar System VR. He also has a solo After Effects project, the Documentary Style Video. Ask about any of them by name, or open the Projects section." },
  { k: ['skill', 'tech', 'stack', 'tools', 'software', 'language', 'engine', 'programming'], a: "Game engines: Unity and Unreal Engine. Languages: C#, C++ and Python. Tools: Blender, Adobe After Effects, Canva and Git. Web: Three.js, React Three Fiber, HTML, CSS, JavaScript and Vite. Concepts: game mechanics, physics systems, animation, level design, pre-production, story developing, OOP, VR and AR." },
  { k: ['study', 'university', 'education', 'degree', 'cgpa', 'gpa', 'college', 'school', 'semester', 'ned', 'matric', 'intermediate', 'marks'], a: 'Saad is a fourth-year BS Computer Science (Gaming & Animation) student at NED University of Engineering & Technology, Karachi (2023 to present), with a CGPA of 3.48 up to 6th semester. He transferred from Electronics Engineering (CGPA 3.73). Intermediate: Govt. Delhi College (80.0% in Part 2). Matriculation: Education Trust Nasra School (92.3%).' },
  { k: ['experience', 'intern', 'internship', 'job', 'studio', 'storm', 'career'], a: 'Saad was a Game Development Intern at Game Storm Studios in Summer 2026 (2 months). He built a complete 2D game from scratch using a reference game, designing and implementing 6 to 7 levels, and handled core mechanics, asset integration and level progression.' },
  { k: ['certificate', 'certification', 'course', 'cega', 'training'], a: 'From CEGA (Center for Excellence in Gaming & Animation): Unreal Engine Game Development (Blueprint scripting, C++ integration, 3D environment design), Game Pre-Production & Design (GDD, storyboarding, project pipelines) and Post Production (video editing and Adobe After Effects).' },
  { k: ['contact', 'email', 'reach', 'phone', 'number', 'call', 'linkedin', 'instagram', 'insta', 'social', 'message'], a: `Email: saadazeem9689@gmail.com. Phone: 0317-2709689. LinkedIn: linkedin.com/in/syed-saad-azeem-912416363. Instagram: ${INSTA_URL}. You can also use the contact form on this page.` },
  { k: ['live', 'location', 'city', 'karachi', 'based', 'reside', 'address', 'where is he', 'from where'], a: 'Saad is based in North Karachi, Pakistan.' },
  { k: ['age', 'old', 'born'], a: 'Saad is 21 years old.' },
  { k: ['tuition', 'teach', 'marketing', 'canva', 'hobby', 'hobbies', 'other'], a: 'Besides game development, Saad provides tuition services and explores social media marketing (including email marketing), using Canva for design.' },
  { k: ['lead', 'team', 'leader', 'teamwork'], a: 'Saad was the team lead on The Kitchen Carnage, a pre-production project in Semester 6, and worked on team game projects throughout his degree.' },
  { k: ['who is', 'who are', 'about him', 'about saad', 'about you', 'introduce', 'yourself', 'hello', 'hi', 'hey', 'salam', 'assalam'], a: 'Saad (Syed Saad Azeem) is a 21-year-old game developer from North Karachi and a fourth-year BSCS (Gaming & Animation) student at NED University. He builds games in Unity and Unreal Engine, does motion graphics in After Effects, and also offers tuition and explores social media marketing. Ask me about his skills, projects, education, experience or contact details.' },
];

function localAnswer(userMessage) {
  const msg = userMessage.toLowerCase();
  const words = msg.split(/[^a-z0-9]+/).filter(Boolean);
  let best = null, bestScore = 0;
  for (const item of faq) {
    let score = 0;
    for (const key of item.k) {
      const hit = key.includes(' ')
        ? msg.includes(key)
        : words.some((w) => (key.length <= 3 ? w === key : w.startsWith(key)));
      if (hit) score++;
    }
    if (score > bestScore) { best = item; bestScore = score; }
  }
  return best ? best.a : "I don't have that one in my notes. Try asking about Saad's skills, projects, education, internship, certifications or contact details.";
}

function addMsg(text, cls) {
  const d = document.createElement('div');
  d.classList.add('message', cls);
  d.textContent = text;
  chatMessages.appendChild(d);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Suggested questions: answered instantly from the built-in list (no server needed)
const chipsBox = document.getElementById('chat-chips');
['Who is Saad?', 'What are his skills?', 'Tell me about his projects', 'Where does he study?', 'Does he have work experience?', 'How can I contact him?']
  .forEach((q) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = q;
    b.addEventListener('click', () => { addMsg(q, 'user-msg'); addMsg(localAnswer(q), 'bot-msg'); });
    chipsBox.appendChild(b);
  });

async function generateResponse(userMessage) {
  const prompt = `${saadContext}\n\nUser Question: ${userMessage}\nAnswer:`;

  if (ai) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
      });
      if (response && response.text) return response.text;
    } catch (error) {
      console.warn('AI server busy, using local backup...', error.message);
    }
  }

  return localAnswer(userMessage);
}

async function sendMessage() {
  const text = chatInput.value.trim();
  if (text === '') return;

  const userMsgDiv = document.createElement('div');
  userMsgDiv.classList.add('message', 'user-msg');
  userMsgDiv.textContent = text;
  chatMessages.appendChild(userMsgDiv);
  chatInput.value = '';
  chatMessages.scrollTop = chatMessages.scrollHeight;

  const typingDiv = document.createElement('div');
  typingDiv.classList.add('message', 'bot-msg');
  typingDiv.textContent = 'Thinking...';
  chatMessages.appendChild(typingDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  let botReply = '';
  try {
    botReply = await generateResponse(text);
  } catch (error) {
    console.error('Chat Error:', error);
    botReply = "Sorry, I couldn't reach my brain right now. Please try again.";
  }

  if (chatMessages.contains(typingDiv)) chatMessages.removeChild(typingDiv);

  const botMsgDiv = document.createElement('div');
  botMsgDiv.classList.add('message', 'bot-msg');
  botMsgDiv.textContent = botReply;
  chatMessages.appendChild(botMsgDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

sendBtn.addEventListener('click', sendMessage);
chatInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') sendMessage();
});


// ==========================================
// Navbar: active link + scroll progress
// ==========================================
const navLinks = document.querySelectorAll('#navbar a');
const spy = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (!e.isIntersecting) return;
    navLinks.forEach((l) => l.classList.toggle('active', l.getAttribute('href') === '#' + e.target.id));
  });
}, { rootMargin: '-45% 0px -50% 0px' });
document.querySelectorAll('main section').forEach((s) => spy.observe(s));

const bar = document.getElementById('progress');
window.addEventListener('scroll', () => {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  bar.style.transform = `scaleX(${max > 0 ? window.scrollY / max : 0})`;
});

// ==========================================
// Theme toggle (dark / light)
// ==========================================
const themeBtn = document.getElementById('theme-toggle');
function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  themeBtn.setAttribute('aria-label', t === 'light' ? 'Switch to dark theme' : 'Switch to light theme');
  try { localStorage.setItem('theme', t); } catch (e) {}
}
applyTheme(document.documentElement.getAttribute('data-theme') || 'dark');
themeBtn.addEventListener('click', () =>
  applyTheme(document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light'));

// ==========================================
// Signature leans toward the cursor
// ==========================================
const sign = document.querySelector('#site-logo img');
if (sign && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  window.addEventListener('pointermove', (e) => {
    const r = sign.parentElement.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    sign.style.transform = Math.hypot(dx, dy) < 260
      ? `perspective(500px) translate(${dx * 0.06}px, ${dy * 0.06}px) rotateY(${dx * 0.05}deg) rotateX(${-dy * 0.08}deg) scale(1.06)`
      : '';
  });
  document.addEventListener('pointerleave', () => { sign.style.transform = ''; });
}