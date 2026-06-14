import announcementIcon from '../../../public/landing/announcement-icon.png';
import consoleAuditsPreview from '../../../public/landing/console-audits-preview.png';
import geminiIcon from '../../../public/landing/gemini-icon.png';
import geminiWordmark from '../../../public/landing/gemini-wordmark.png';
import githubWordmark from '../../../public/landing/github-wordmark.png';
import gitlabWordmark from '../../../public/landing/gitlab-wordmark.png';
import googleCloudWordmark from '../../../public/landing/google-cloud-wordmark.png';
import heroScreenshot from '../../../public/landing/hero-screenshot.png';
import premortemHeader from '../../../public/landing/premortem-header.png';
import socialGithubIcon from '../../../public/landing/social-github-icon.png';

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
