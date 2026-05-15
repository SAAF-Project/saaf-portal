"use client";

import { useState } from "react";
import ComingSoonBanner from "@/components/ComingSoonBanner";

interface Item {
  title: string;
  desc: string;
  meta: string;
}

interface Provider {
  key: string;
  icon: string;
  title: string;
  badge: string;
  description: string;
  url: string;
  urlLabel: string;
  itemsLabel: string;
  items: Item[];
  footnote?: string;
}

const PROVIDERS: Provider[] = [
  {
    key: "anthropic",
    icon: "🎓",
    title: "Anthropic Academy",
    badge: "External · Free",
    description:
      "Anthropic's official course library. Wide range — from beginner Claude usage to advanced API and MCP development.",
    url: "https://anthropic.skilljar.com/",
    urlLabel: "anthropic.skilljar.com ↗",
    itemsLabel: "Available courses",
    items: [
      { title: "Claude 101", desc: "Use Claude for everyday work tasks — core features and resources for advanced learning.", meta: "All" },
      { title: "Claude Code 101", desc: "Use Claude Code effectively in your daily development workflow.", meta: "Engineers" },
      { title: "Introduction to Claude Cowork", desc: "Hands-on course on task loops, plugins, skills, file workflows, multi-step work.", meta: "Engineers" },
      { title: "Claude Code in Action", desc: "Integrate Claude Code into your development workflow.", meta: "Engineers" },
      { title: "AI Fluency: Framework & Foundations", desc: "Collaborate with AI systems effectively, efficiently, ethically, and safely.", meta: "All" },
      { title: "Building with the Claude API", desc: "Work with Anthropic models programmatically using the Claude API.", meta: "Engineers" },
      { title: "Introduction to Model Context Protocol (MCP)", desc: "Build MCP servers and clients — tools, resources, and prompts.", meta: "Engineers" },
      { title: "Introduction to Agent Skills", desc: "Build, configure, and share reusable markdown instructions for Claude Code.", meta: "Engineers" },
      { title: "Introduction to Subagents", desc: "Use and create sub-agents to manage context and delegate specialised tasks.", meta: "Engineers" },
      { title: "Model Context Protocol: Advanced Topics", desc: "Advanced MCP patterns: sampling, notifications, production development.", meta: "Engineers (advanced)" },
      { title: "AI Capabilities and Limitations", desc: "Introductory course on how AI works.", meta: "All" },
      { title: "Claude with Amazon Bedrock", desc: "Working with Claude through AWS Bedrock.", meta: "AWS users" },
      { title: "Claude with Google Cloud Vertex AI", desc: "Working with Anthropic models through Google Cloud Vertex AI.", meta: "GCP users" },
      { title: "AI Fluency for Educators / Students / Nonprofits / Small Businesses", desc: "Sector-specific AI fluency tracks for different audiences.", meta: "Various" },
    ],
  },
  {
    key: "ccfe",
    icon: "💻",
    title: "Claude Code for Everyone",
    badge: "External · Free*",
    description:
      "Hands-on tutorial for non-technical users — learn Claude Code inside Claude Code. No coding or terminal experience required.",
    url: "https://ccforeveryone.com/",
    urlLabel: "ccforeveryone.com ↗",
    itemsLabel: "Modules",
    items: [
      { title: "Module 0: Getting Started", desc: "Orientation: Claude Code basics, installation, and initial project setup.", meta: "~30 min" },
      { title: "Module 1: Fundamentals", desc: "Core skills: file operations, visual workspace, parallel agent launching, sub-agents, project memory (CLAUDE.md), power-user commands.", meta: "~3 hours" },
      { title: "Module 2: Vibe Coding", desc: "App development with Claude Code: planning interviews, scaffolded apps, screenshot iteration, GitHub version control, Vercel deployment.", meta: "~1-2 hours" },
      { title: "Mini Lessons", desc: "Specialised workflows: Ross Mike techniques, advanced approaches, Vin Obsidian integrations.", meta: "Varies" },
    ],
    footnote:
      "* Course material is free, but requires a Claude Pro or Max subscription (~$20/month) to follow along.",
  },
  {
    key: "forhumanity",
    icon: "🎯",
    title: "ForHumanity AI Education and Training Center",
    badge: "External · Certification",
    description:
      "Non-profit public charity offering certifications for AI auditors. The most directly relevant body of work for SAAF participants — covers EU AI Act, GDPR, governance, and specialised auditor tracks. Awards the ForHumanity Certified Auditor (FHCA) designation.",
    url: "https://forhumanity.center/forhumanity-ai-education-and-training-center/",
    urlLabel: "forhumanity.center ↗",
    itemsLabel: "Certification tracks",
    items: [
      { title: "Foundations of Independent Audit of AI Systems (IAAIS)", desc: "Foundation course required for all ForHumanity certification paths.", meta: "Foundation" },
      { title: "CORE AAA Governance", desc: "16 foundational pillars for AI systems governance.", meta: "Governance" },
      { title: "EU AI Act certification", desc: "Auditor certification for the EU AI Act compliance regime.", meta: "Regulation" },
      { title: "Digital Services Act (DSA)", desc: "Audit certification for DSA-regulated platforms.", meta: "Regulation" },
      { title: "UK GDPR / India DPDPA", desc: "Jurisdiction-specific data protection auditor tracks.", meta: "Regulation" },
      { title: "Automated Employment Decision Tools (AEDT)", desc: "Specialised auditor program for hiring/HR AI systems.", meta: "Specialised" },
      { title: "Disability Inclusion & Accessibility (DI&A)", desc: "Auditor track for accessibility-focused AI assessments.", meta: "Specialised" },
      { title: "Children's Code Supplemental", desc: "Add-on for auditors working with systems used by children.", meta: "Specialised" },
      { title: "Cybersecurity (modular augmentation)", desc: "Cybersecurity-focused module for AI audit work.", meta: "Specialised" },
      { title: "Risk Management Framework (RMF)", desc: "AI risk management auditor certification.", meta: "Risk" },
      { title: "Algorithm Ethics (Expert accreditation)", desc: "Expert-level accreditation in algorithmic ethics.", meta: "Ethics" },
      { title: "Cognitive Bias", desc: "26 lectures on cognitive bias in AI systems.", meta: "Ethics" },
    ],
    footnote:
      "Audience: organisational compliance professionals, independent auditors, ethics committee members, AI system developers. Pricing not listed publicly on the site.",
  },
];

function ProviderCard({ provider }: { provider: Provider }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-surface border border-border rounded-2xl overflow-hidden mb-6">
      <div className="p-6">
        <div className="flex items-start gap-3">
          <span className="text-3xl shrink-0">{provider.icon}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-lg font-bold">{provider.title}</h3>
              <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-saaf-yellow/15 text-saaf-yellow">
                {provider.badge}
              </span>
            </div>
            <p className="text-muted text-sm mt-1">{provider.description}</p>
            <a
              href={provider.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-2 text-sm text-accent font-semibold hover:underline"
            >
              {provider.urlLabel}
            </a>
          </div>
        </div>
      </div>

      <button
        onClick={() => setOpen(!open)}
        className="w-full px-6 py-3 border-t border-border flex items-center gap-2 text-xs font-bold text-muted uppercase tracking-wider hover:bg-white/3 transition-colors cursor-pointer"
        aria-expanded={open}
      >
        <span className="text-muted">{open ? "▼" : "▶"}</span>
        <span>{open ? "Hide" : "Show"} {provider.itemsLabel.toLowerCase()} ({provider.items.length})</span>
      </button>

      {open && (
        <div className="px-6 pb-6 border-t border-border/50">
          <div className="space-y-2 mt-3">
            {provider.items.map((item) => (
              <div
                key={item.title}
                className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-white/3 transition-colors"
              >
                <span className="text-saaf-green text-xs mt-1 shrink-0">✓</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{item.title}</span>
                    <span className="text-[10px] text-muted">· {item.meta}</span>
                  </div>
                  <p className="text-xs text-muted mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
          {provider.footnote && (
            <p className="text-[11px] text-muted italic mt-4">{provider.footnote}</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function ELearningPage() {
  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-extrabold mb-2">E-Learning</h1>
      <p className="text-muted text-sm mb-8">
        SAAF doesn&apos;t have its own learning platform yet — but here are external resources we
        recommend to build the AI fluency you need to contribute effectively.
      </p>

      <div className="mb-8">
        <ComingSoonBanner
          title="SAAF Learning Modules"
          description="Interactive learning modules tailored to AI audit agent development — coming to this portal in a future hackathon. Build your skills in prompts, tools, regulatory frameworks, and output quality."
        />
      </div>

      <div className="mb-4 flex items-center gap-2 flex-wrap">
        <h2 className="text-xl font-extrabold">External resources</h2>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-saaf-yellow/15 text-saaf-yellow font-bold uppercase tracking-wider">
          External
        </span>
      </div>
      <p className="text-muted text-sm mb-6">
        These resources are <strong className="text-text">not built or maintained by SAAF</strong>.
        We link them here because they&apos;re the best foundational training we know of for the
        tools and disciplines many SAAF participants use.
      </p>

      {PROVIDERS.map((p) => (
        <ProviderCard key={p.key} provider={p} />
      ))}

      <div className="p-4 bg-saaf-yellow/5 border border-saaf-yellow/20 rounded-xl text-xs text-muted leading-relaxed">
        <p className="text-saaf-yellow font-semibold mb-1">Disclaimer</p>
        <p>
          External resources are linked for convenience. SAAF Project does not endorse, control, or
          guarantee the content, pricing, or availability of these third-party platforms. Course
          information was accurate at the time of writing — refer to the source sites for the
          latest curriculum and pricing.
        </p>
      </div>

      <div className="mt-6 p-4 bg-accent/5 border border-accent/20 rounded-xl text-sm">
        <p className="text-muted">
          <strong className="text-text">Know a great learning resource?</strong> Use the Feedback
          button (bottom-right) to suggest it — we&apos;ll review and add it here.
        </p>
      </div>
    </div>
  );
}
