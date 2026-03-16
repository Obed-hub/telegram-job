const mockJobs = [
    { title: "Senior React Developer", company: "Vercel", type: "Full-time", location: "Remote", tags: ["React", "TypeScript", "Next.js"], desc: "Join our core team to build the future of the web. We are looking for experts in React and server-side rendering." },
    { title: "Node.js Backend Engineer", company: "Discord", type: "Full-time", location: "San Francisco", tags: ["Node.js", "Rust", "Scale"], desc: "Help us build the most reliable communication platform in the world. Experience with distributed systems required." },
    { title: "Product Designer", company: "Figma", type: "Contract", location: "Remote", tags: ["UI/UX", "Visual", "Design"], desc: "Work on the design tools you use every day. We need a creative mind to push the boundaries of collaborative design." },
    { title: "Fullstack Engineer", company: "Stripe", type: "Full-time", location: "Remote", tags: ["Ruby", "React", "Fintech"], desc: "Build the economic infrastructure of the internet. We value clean code and customer focus." }
];

const tg = window.Telegram?.WebApp;
if (tg) {
    tg.expand();
    tg.ready();
    tg.HeaderColor = '#0f172a';
}

let jobIndex = 0;
const cardDeck = document.getElementById('cardDeck');
const passBtn = document.getElementById('passBtn');
const applyBtn = document.getElementById('applyBtn');

function createCard(job) {
    const card = document.createElement('div');
    card.className = 'job-card';
    
    // Aesthetic Tip: Use a random high-quality Unsplash image for dating vibe
    const randomImg = `https://images.unsplash.com/photo-${1500000000000 + Math.floor(Math.random() * 1000000)}?auto=format&fit=crop&w=400&q=80`;
    
    card.innerHTML = `
        <img src="https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=400&q=80" alt="Job Image">
        <h2>${job.title}</h2>
        <div class="company">${job.company}</div>
        <div class="tags">
            <span class="tag">${job.type}</span>
            <span class="tag">${job.location}</span>
            ${job.tags.map(t => `<span class="tag">${t}</span>`).join('')}
        </div>
        <p class="desc">${job.desc}</p>
    `;

    // Swipe logic
    let startX = 0;
    let currentX = 0;

    card.addEventListener('touchstart', (e) => startX = e.touches[0].clientX);
    card.addEventListener('touchmove', (e) => {
        currentX = e.touches[0].clientX;
        const diff = currentX - startX;
        card.style.transform = `translateX(${diff}px) rotate(${diff / 20}deg)`;
        
        // Visual feedback
        if (diff > 50) card.style.border = '2px solid #0088cc';
        else if (diff < -50) card.style.border = '2px solid #ff4d6d';
        else card.style.border = '1px solid rgba(255, 255, 255, 0.1)';
    });

    card.addEventListener('touchend', () => {
        const diff = currentX - startX;
        if (Math.abs(diff) > 100) {
            diff > 0 ? apply() : pass();
        } else {
            card.style.transform = '';
            card.style.border = '1px solid rgba(255, 255, 255, 0.1)';
        }
    });

    return card;
}

function nextJob() {
    if (jobIndex < mockJobs.length) {
        const card = createCard(mockJobs[jobIndex]);
        cardDeck.appendChild(card);
        jobIndex++;
    } else {
        document.querySelector('.empty-state').style.display = 'block';
    }
}

function pass() {
    const card = cardDeck.querySelector('.job-card:last-child');
    if (!card) return;
    card.classList.add('swipe-left');
    setTimeout(() => {
        card.remove();
        nextJob();
    }, 300);
}

function apply() {
    const card = cardDeck.querySelector('.job-card:last-child');
    if (!card) return;
    card.classList.add('swipe-right');
    
    // Haptic feedback
    if (tg) tg.HapticFeedback.notificationOccurred('success');
    
    setTimeout(() => {
        card.remove();
        nextJob();
        // Show Telegram Alert on match
        if (tg) tg.showAlert("It's a Match! 🎯 Your application has been sent.");
    }, 300);
}

passBtn.addEventListener('click', pass);
applyBtn.addEventListener('click', apply);

// Initial load
nextJob();

// Tab switching (UI Only)
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
        document.querySelector('.nav-item.active').classList.remove('active');
        item.classList.add('active');
        if (tg) tg.HapticFeedback.impactOccurred('light');
    });
});
