const mockJobs = [
    { title: "Senior React Developer", company: "Vercel", source: "Lever", description: "Looking for TypeScript expert", url: "#" },
    { title: "Node.js Backend Engineer", company: "Discord", source: "Greenhouse", description: "Build scalable systems", url: "#" },
    { title: "Fullstack Engineer (React/Node)", company: "Stripe", source: "Greenhouse", description: "Remote friendly, TS mandatory", url: "#" },
    { title: "Product Designer", company: "Figma", source: "Lever", description: "Design the future of design", url: "#" },
    { title: "iOS Developer", company: "Nooro", source: "Remotive", description: "SwiftUI and Combine", url: "#" },
    { title: "Python Data Scientist", company: "Google", source: "Internal", description: "AI and machine learning", url: "#" },
    { title: "Frontend Lead", company: "Airbnb", source: "Greenhouse", description: "React and Styled Components", url: "#" },
    { title: "Rust Core Dev", company: "Replit", source: "Lever", description: "Cloud infrastructure", url: "#" }
];

const chatWindow = document.getElementById('chatWindow');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');

let userSkills = [];

const tg = window.Telegram?.WebApp;
if (tg) {
    tg.expand();
    tg.ready();
}

function addMessage(text, type = 'bot') {
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${type}`;
    msgDiv.innerHTML = `<div class="bubble">${text}</div>`;
    chatWindow.appendChild(msgDiv);
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

// Greet user if TWA is active
if (tg && tg.initDataUnsafe?.user) {
    const user = tg.initDataUnsafe.user;
    setTimeout(() => {
        addMessage(`Hello <b>${user.first_name}</b>! Let's find you a job.`);
    }, 1000);
}

function matchJobs(skills) {
    if (skills.length === 0) return [];
    return mockJobs.filter(job => {
        const content = `${job.title} ${job.description}`.toLowerCase();
        return skills.some(skill => content.includes(skill.toLowerCase()));
    });
}

function handleInput() {
    const val = userInput.value.trim();
    if (!val) return;

    addMessage(val, 'user');
    userInput.value = '';

    setTimeout(() => {
        if (val.startsWith('/skills')) {
            const skillsStr = val.replace('/skills', '').trim();
            userSkills = skillsStr.split(',').map(s => s.trim()).filter(s => s);
            if (userSkills.length === 0) {
                addMessage("Please provide at least one skill. Example: <code>/skills react</code>");
            } else {
                addMessage(`Skills updated to: <b>${userSkills.join(', ')}</b>. Use <b>/matches</b> to see results!`);
            }
        } else if (val === '/matches') {
            const matches = matchJobs(userSkills);
            if (matches.length === 0) {
                addMessage("No matches found for your current skills. Use <b>/skills</b> to update them!");
            } else {
                addMessage(`Found <b>${matches.length}</b> matches for you:`);
                matches.forEach(job => {
                    const card = `
                        <div class="job-card">
                            <h4>${job.title}</h4>
                            <div class="meta">${job.company} • ${job.source}</div>
                        </div>
                    `;
                    addMessage(card);
                });
            }
        } else {
            addMessage("I don't recognize that command. Try <b>/skills</b> or <b>/matches</b>.");
        }
    }, 600);
}

sendBtn.addEventListener('click', handleInput);
userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleInput();
});
