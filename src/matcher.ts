import type { Job } from './api/remotive.js';
import type { UserDoc } from './firebase.js';

export interface MatchResult {
  score: number;
  missingSkills: string[];
  matchSummary: string;
}

export function matchJob(job: Job, user: UserDoc): MatchResult {
  let score = 0;
  let maxScore = 0;

  const profile = user.profile;
  const prefs = user.preferences;
  
  const searchContent = `${job.title} ${job.category} ${job.description}`.toLowerCase();
  
  // 1. Skill Match (Weight: 40)
  maxScore += 40;
  const missingSkills: string[] = [];
  let foundSkills = 0;
  
  if (profile.skills && profile.skills.length > 0) {
    profile.skills.forEach(skill => {
      const regex = new RegExp(`\\b${skill.toLowerCase()}\\b`, 'i');
      if (regex.test(searchContent)) {
        foundSkills++;
      } else {
        missingSkills.push(skill);
      }
    });
    score += (foundSkills / profile.skills.length) * 40;
  }

  // 2. Seniority Match (Weight: 15)
  if (prefs.seniority) {
    maxScore += 15;
    const isJunior = /junior|entry/i.test(searchContent);
    const isSenior = /senior|sr\b|lead|principal|staff/i.test(searchContent);
    
    if (prefs.seniority === 'junior' && isJunior) score += 15;
    else if (prefs.seniority === 'senior' && isSenior) score += 15;
    else if (prefs.seniority === 'mid' && !isJunior && !isSenior) score += 15;
  }

  // 3. Mode Match (Weight: 15)
  if (prefs.mode) {
    maxScore += 15;
    const isRemote = /remote|anywhere|work from home/i.test(searchContent);
    const isHybrid = /hybrid|flexible/i.test(searchContent);
    
    if (prefs.mode === 'remote' && isRemote) score += 15;
    else if (prefs.mode === 'hybrid' && (isHybrid || isRemote)) score += 15;
    else if (prefs.mode === 'onsite' && !isRemote) score += 15;
  }

  // 4. Job Category Match (Weight: 15)
  if (prefs.categories && prefs.categories.length > 0) {
    maxScore += 15;
    const matchedCategory = prefs.categories.some(cat => 
      new RegExp(`\\b${cat.toLowerCase()}\\b`, 'i').test(searchContent)
    );
    if (matchedCategory) score += 15;
  }

  // 5. Job Type Match (Weight: 15)
  if (prefs.jobType) {
    maxScore += 15;
    const regex = new RegExp(`\\b${prefs.jobType.toLowerCase()}\\b`, 'i');
    if (regex.test(searchContent)) score += 15;
  }

  // Normalize final score
  const finalScore = maxScore > 0 ? Math.round((score / maxScore) * 100) : 100;

  let matchSummary = finalScore >= 80 ? 'Highly Recommended' 
                   : finalScore >= 50 ? 'Good Fit' 
                   : 'Potential Match';

  return {
    score: finalScore,
    missingSkills: missingSkills.slice(0, 3),
    matchSummary
  };
}
