import announcementIcon from './images/announcement-icon.png';
import consoleAuditsPreview from './images/console-audits-preview.png';
import geminiIcon from './images/gemini-icon.png';
import geminiWordmark from './images/gemini-wordmark.png';
import githubWordmark from './images/github-wordmark.png';
import gitlabWordmark from './images/gitlab-wordmark.png';
import googleCloudWordmark from './images/google-cloud-wordmark.png';
import heroScreenshot from './images/hero-screenshot.png';
import premortemHeader from './images/premortem-header.png';
import socialGithubIcon from './images/social-github-icon.png';

export const assets = {
  heroScreenshot: heroScreenshot.src,
  workflowHeader: premortemHeader.src,
  consoleAuditsPreview: consoleAuditsPreview.src,
  googleCloud: googleCloudWordmark.src,
  gitlab: gitlabWordmark.src,
  github: githubWordmark.src,
  geminiWordmark: geminiWordmark.src,
  geminiIcon: geminiIcon.src,
  announcementIcon: announcementIcon.src,
  socialGithubIcon: socialGithubIcon.src,
  githubIcon: '/logo/brand/GitHub_Logos/GitHub Logos/SVG/GitHub_Invertocat_White.svg',
  premortemMark: '/logo/svg/premortem-mark.svg'
} as const;
