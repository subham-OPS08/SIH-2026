"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { aiService } from "@/src/services/aiService";
import type { AIMessage } from "@/src/types";
import { linkifyPlaces, findPlaceForHeading, QuickPlaceRedirectionStrip } from "./ai/placeNavigation";

export function FloatingYatraAI() {

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<AIMessage[]>([
    {
      id: "msg-floating-welcome",
      role: "assistant",
      timestamp: "Just now",
      content: "Hey there, how can I help you?",
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [isThinking, setIsThinking] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Listen for global open-yatra-ai event
  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    window.addEventListener("open-yatra-ai", handleOpen);
    return () => window.removeEventListener("open-yatra-ai", handleOpen);
  }, []);

  // Close overlay on route change
  const pathname = usePathname();
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Auto-scroll to bottom of conversation
  useEffect(() => {
    if (isOpen && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isThinking, isOpen]);

  // Focus textarea when window opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 150);
    }
  }, [isOpen]);

  // Auto-resize composer textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 100)}px`;
    }
  }, [inputText]);

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputText).trim();
    if (!query || isThinking) return;

    const userMessage: AIMessage = {
      id: `usr-${Date.now()}`,
      role: "user",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      content: query,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText("");
    setIsThinking(true);

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    try {
      const history = messages
        .filter((m) => m.id !== "msg-floating-welcome")
        .slice(-8)
        .map((m) => ({ role: m.role, content: m.content }));

      const response = await aiService.sendMessage(query, history);

      if (response.success && response.data) {
        setMessages((prev) => [...prev, response.data]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            role: "assistant",
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            content:
              response.error?.message ||
              "I have consulted the official government knowledge base. Please dial 112 for urgent emergency support.",
            citations: [
              { title: "National Emergency Response System (112)", url: "https://112.gov.in", verified: true },
              { title: "Tourist Helpline (1363)", url: "https://1363.gov.in", verified: true },
            ],
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          content:
            "I am temporarily unable to connect to the live travel intelligence service. For immediate life safety or travel queries, please dial 112 or 1363.",
          citations: [{ title: "National Emergency 112", url: "https://112.gov.in", verified: true }],
        },
      ]);
    } finally {
      setIsThinking(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleClearChat = () => {
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        role: "assistant",
        timestamp: "Just now",
        content: "Hey there, how can I help you?",
      },
    ]);
  };

  // Preprocessor to segregate clustered RAG blocks and unstructured text
  const preprocessAndFormatAIResponse = (text: string): string => {
    if (!text) return "";

    // If text has clustered fields (e.g. "Destination: ... Tagline: ... Overview: ... Highlights: ...")
    if (
      text.includes("Destination:") ||
      text.includes("Overview:") ||
      text.includes("Highlights:") ||
      text.includes("Things to do:") ||
      text.includes("Safety Guidelines:") ||
      text.includes("Coordinates:")
    ) {
      let processed = text;

      // Handle top intelligence intro
      processed = processed.replace(
        /Based on verified \*\*Bharat Safe Yatra\*\* official intelligence:\s*/gi,
        "Based on verified **Bharat Safe Yatra** official intelligence:\n\n"
      );

      // Handle raw record title like "Government Museum & Art Gallery — Overview & Highlights (OFFICIAL_TOURISM)"
      processed = processed.replace(
        /(?:\n|^)\*\*([^*]+(?:Overview|Highlights|Safety|Culture)[^*]*)\*\*\s*/gi,
        "\n### 🏛️ $1\n\n"
      );

      // Replace Destination: Name (Territory)
      processed = processed.replace(
        /Destination:\s*([^(.\n]+)(?:\s*\(([^)]+)\))?/gi,
        (match, name, territory) => {
          const loc = territory ? `📍 **${territory.trim()}**` : "";
          return `### 🏛️ ${name.trim()}\n${loc}`;
        }
      );

      // Replace Tagline
      processed = processed.replace(
        /\.?\s*Tagline:\s*([^.\n]+)(?:\.|\n|$)/gi,
        "\n*$1*\n\n---\n"
      );

      // Replace Type & Coordinates
      processed = processed.replace(/Type:\s*([^.\n]+)(?:\.|\n|$)/gi, " • 🏷️ **Type:** $1");
      processed = processed.replace(/Coordinates:\s*([0-9.,\s-]+)(?:\.|\n|$)/gi, " • 🧭 **GPS:** `$1`\n\n");

      // Replace Section Headers
      processed = processed
        .replace(/\.?\s*Overview:\s*/gi, "\n\n**📖 Overview**\n")
        .replace(/\.?\s*Highlights:\s*/gi, "\n\n**🌟 Key Highlights**\n")
        .replace(/\.?\s*Things to do:\s*/gi, "\n\n**🎯 Recommended Experiences**\n")
        .replace(/\.?\s*Safety Guidelines:\s*/gi, "\n\n**🛡️ Safety & Practical Advice**\n")
        .replace(/\.?\s*Nearest Emergency Medical Facility:\s*/gi, "\n\n**🏥 Emergency Response Facility**\n")
        .replace(/\.?\s*Weather advisory:\s*/gi, "\n\n**☀️ Weather & Best Season**\n")
        .replace(/\.?\s*Specialty dishes:\s*/gi, "\n\n**🍲 Regional Specialties**\n")
        .replace(/\.?\s*Permits(?: REQUIRED)?:\s*/gi, "\n\n**📋 Entry & Permits**\n");

      // Segregate semicolon-delimited lists under Highlights, Experiences, and Things to do
      processed = processed.replace(
        /(\*\*(?:🌟 Key Highlights|🎯 Recommended Experiences|🛡️ Safety & Practical Advice)\*\*)\n([^\n]+)/g,
        (match, header, body) => {
          const items = body
            .split(/[;]\s*/)
            .map((item: string) => item.trim().replace(/^\.+|\.+$/g, ""))
            .filter((item: string) => item.length > 2);
          if (items.length > 1) {
            return `${header}\n${items.map((i: string) => `• ${i}`).join("\n")}`;
          }
          return match;
        }
      );

      return processed;
    }

    return text;
  };

  // Helper to render formatted markdown with modern, visually appealing segregation
  const renderMessageContent = (rawContent: string) => {
    const content = preprocessAndFormatAIResponse(rawContent);
    const lines = content.split("\n");

    return lines.map((line, idx) => {
      const trimmed = line.trim();

      // Empty line spacer
      if (!trimmed) {
        return <div key={idx} style={{ height: "6px" }} />;
      }

      // Main Section Headings (### )
      if (line.startsWith("### ")) {
        const headingText = line.replace("### ", "").trim();
        const matchedPlace = findPlaceForHeading(headingText);
        return (
          <div
            key={idx}
            style={{
              fontSize: "0.98rem",
              fontWeight: 800,
              color: "var(--color-text-primary, #1C1917)",
              margin: "12px 0 6px 0",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "8px",
              paddingBottom: "4px",
              borderBottom: "1px solid var(--color-border-subtle, rgba(0,0,0,0.06))",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ color: "var(--color-accent, #FF9933)", fontSize: "1.1rem" }}>✦</span>
              <span>{headingText}</span>
            </div>
            {matchedPlace && (
              <Link
                href={matchedPlace.url}
                title={`Visit ${matchedPlace.name}`}
                style={{
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  color: "#FFFFFF",
                  background: "linear-gradient(135deg, #FF9933, #EA580C)",
                  padding: "3px 10px",
                  borderRadius: "12px",
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  boxShadow: "0 1px 3px rgba(255, 153, 51, 0.35)",
                  flexShrink: 0,
                }}
              >
                <span>Explore</span>
                <span style={{ fontSize: "0.75em" }}>➔</span>
              </Link>
            )}
          </div>
        );
      }

      if (line.startsWith("## ")) {
        return (
          <h3
            key={idx}
            style={{
              fontSize: "1.05rem",
              fontWeight: 800,
              color: "var(--color-text-primary, #1C1917)",
              margin: "14px 0 6px 0",
            }}
          >
            {line.replace("## ", "")}
          </h3>
        );
      }

      // Horizontal Rule / Divider
      if (trimmed === "---") {
        return (
          <hr
            key={idx}
            style={{
              margin: "10px 0",
              border: "none",
              borderTop: "1px solid var(--color-border-subtle, rgba(0, 0, 0, 0.08))",
            }}
          />
        );
      }

      // Metadata Badges Row (contains 📍, 🏷️, 🧭, or • separated chips)
      if (
        (line.includes("📍") || line.includes("🏷️") || line.includes("🧭")) &&
        line.includes("•")
      ) {
        const badges = line.split("•").map((b) => b.trim()).filter(Boolean);
        return (
          <div
            key={idx}
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "6px",
              margin: "6px 0 8px 0",
            }}
          >
            {badges.map((badge, bIdx) => (
              <span
                key={bIdx}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  padding: "3px 9px",
                  borderRadius: "9999px",
                  background: "rgba(255, 153, 51, 0.09)",
                  color: "var(--color-text-primary, #1C1917)",
                  border: "1px solid rgba(255, 153, 51, 0.25)",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
                }}
              >
                {formatBoldAndCode(badge)}
              </span>
            ))}
          </div>
        );
      }

      // Section Category Headers (e.g. **📖 Overview**, **🌟 Key Highlights**, etc.)
      const isSectionHeader =
        line.startsWith("**") &&
        (line.includes("Overview") ||
          line.includes("Highlights") ||
          line.includes("Experiences") ||
          line.includes("Things To Do") ||
          line.includes("Activities") ||
          line.includes("Safety") ||
          line.includes("Permits") ||
          line.includes("Entry") ||
          line.includes("Climate") ||
          line.includes("Season") ||
          line.includes("Specialties") ||
          line.includes("Emergency") ||
          line.includes("Advisories") ||
          line.includes("Destinations"));

      if (isSectionHeader) {
        return (
          <div
            key={idx}
            style={{
              fontSize: "0.825rem",
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              color: "var(--color-accent, #B45309)",
              marginTop: "12px",
              marginBottom: "5px",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            {formatBoldAndCode(line)}
          </div>
        );
      }

      // Bullet items (• or -) styled as clean, segregated mini-cards
      if (line.startsWith("• ") || line.startsWith("- ")) {
        const text = line.substring(2);
        return (
          <div
            key={idx}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "8px",
              margin: "3px 0",
              padding: "5px 10px",
              borderRadius: "8px",
              background: "rgba(0, 0, 0, 0.025)",
              border: "1px solid rgba(0, 0, 0, 0.04)",
              lineHeight: 1.5,
              fontSize: "0.85rem",
              transition: "background 0.2s ease",
            }}
          >
            <span
              style={{
                color: "var(--color-accent, #FF9933)",
                fontWeight: 800,
                fontSize: "0.85rem",
                lineHeight: "1.3rem",
              }}
            >
              ✦
            </span>
            <div style={{ flex: 1, color: "var(--color-text-primary, #1C1917)" }}>
              {formatBoldAndCode(text)}
            </div>
          </div>
        );
      }

      // Numbered lists (e.g. "1. ")
      if (/^\d+\.\s/.test(line)) {
        return (
          <div
            key={idx}
            style={{
              margin: "4px 0",
              padding: "5px 10px",
              borderRadius: "8px",
              background: "rgba(0, 0, 0, 0.02)",
              border: "1px solid rgba(0, 0, 0, 0.03)",
              lineHeight: 1.5,
              fontSize: "0.85rem",
            }}
          >
            {formatBoldAndCode(line)}
          </div>
        );
      }

      // Callout / Advisory tip (starts with 💡 or 🔗)
      if (line.startsWith("💡") || line.startsWith("🔗") || line.startsWith("*All guidance") || line.startsWith("Note:")) {
        return (
          <div
            key={idx}
            style={{
              margin: "10px 0 4px",
              padding: "8px 12px",
              borderRadius: "8px",
              background: "rgba(245, 158, 11, 0.08)",
              border: "1px solid rgba(245, 158, 11, 0.25)",
              fontSize: "0.785rem",
              color: "var(--color-text-secondary, #57534E)",
              lineHeight: 1.5,
            }}
          >
            {formatBoldAndCode(line)}
          </div>
        );
      }

      // Standard paragraph
      return (
        <p
          key={idx}
          style={{
            margin: "4px 0",
            lineHeight: 1.6,
            fontSize: "0.875rem",
            color: "var(--color-text-primary, #1C1917)",
          }}
        >
          {formatBoldAndCode(line)}
        </p>
      );
    });
  };

  // Helper to parse bold, italics, code, and links
  const formatBoldAndCode = (text: string) => {
    // Split by markdown bold **text**, code `code`, and italics *text*
    const parts = text.split(/(\*\*.*?\*\*|`.*?`|\*.*?\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        const inner = part.slice(2, -2);
        return (
          <strong key={i} style={{ fontWeight: 700, color: "var(--color-text-primary, #1C1917)" }}>
            {linkifyPlaces(inner)}
          </strong>
        );
      }
      if (part.startsWith("*") && part.endsWith("*") && !part.startsWith("**")) {
        const inner = part.slice(1, -1);
        return (
          <em key={i} style={{ fontStyle: "italic", color: "var(--color-text-secondary, #78716C)" }}>
            {linkifyPlaces(inner)}
          </em>
        );
      }
      if (part.startsWith("`") && part.endsWith("`")) {
        return (
          <code
            key={i}
            style={{
              background: "rgba(0, 0, 0, 0.06)",
              padding: "2px 6px",
              borderRadius: "4px",
              fontSize: "0.825em",
              fontFamily: "monospace",
              color: "var(--color-accent, #B45309)",
            }}
          >
            {part.slice(1, -1)}
          </code>
        );
      }
      return <React.Fragment key={i}>{linkifyPlaces(part)}</React.Fragment>;
    });
  };


  return (
    <>
      {/* 1. FLOATING ACTION LAUNCHER BUTTON */}
      <div
        style={{
          position: "fixed",
          bottom: "24px",
          right: "24px",
          zIndex: 9000,
          display: "flex",
          alignItems: "center",
          gap: "10px",
        }}
      >
        <button
          onClick={() => setIsOpen((prev) => !prev)}
          aria-label={isOpen ? "Close Yatra AI" : "Open Yatra AI Companion"}
          className="yatra-floating-fab"
          style={{
            height: "56px",
            padding: isOpen ? "0 18px" : "0 22px",
            borderRadius: "32px",
            background: "linear-gradient(135deg, #1C1917 0%, #292524 100%)",
            color: "#FFFFFF",
            border: "1.5px solid rgba(255, 153, 51, 0.4)",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            fontSize: "15px",
            fontWeight: 700,
            letterSpacing: "0.02em",
            boxShadow: isOpen
              ? "0 8px 24px rgba(0, 0, 0, 0.35)"
              : "0 6px 20px rgba(0, 0, 0, 0.25), 0 0 16px rgba(255, 153, 51, 0.2)",
            cursor: "pointer",
            transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          {isOpen ? (
            <>
              <span style={{ fontSize: "16px", color: "#FF9933" }}>✕</span>
              <span style={{ fontSize: "14px" }}>Close</span>
            </>
          ) : (
            <>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "26px",
                  height: "26px",
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #FF9933 0%, #E65100 100%)",
                  color: "#FFFFFF",
                  fontSize: "14px",
                  boxShadow: "0 0 8px rgba(255, 153, 51, 0.5)",
                }}
              >
                ✦
              </span>
              <span style={{ whiteSpace: "nowrap" }}>Yatra AI</span>
            </>
          )}
        </button>
      </div>

      {/* 2. FLOATING CHAT WINDOW DRAWER */}
      {isOpen && (
        <div
          className="yatra-chat-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Yatra AI Companion"
          style={{
            position: "fixed",
            bottom: "92px",
            right: "24px",
            width: "410px",
            maxWidth: "calc(100vw - 32px)",
            height: "590px",
            maxHeight: "calc(100vh - 110px)",
            backgroundColor: "var(--color-bg-surface, #FFFFFF)",
            borderRadius: "20px",
            boxShadow: "0 20px 48px rgba(0, 0, 0, 0.22), 0 0 0 1px rgba(0, 0, 0, 0.08)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            zIndex: 9001,
            animation: "yatraChatSlideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "14px 18px",
              background: "linear-gradient(to right, #1C1917, #292524)",
              color: "#FFFFFF",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #FF9933, #138808)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#FFFFFF",
                  fontSize: "16px",
                  fontWeight: 800,
                  boxShadow: "0 0 10px rgba(255, 153, 51, 0.4)",
                }}
              >
                ✦
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: "1rem", letterSpacing: "0.01em" }}>
                  Yatra AI
                </div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              {/* New Chat */}
              <button
                type="button"
                onClick={handleClearChat}
                title="Start new conversation"
                style={{
                  background: "rgba(255, 255, 255, 0.1)",
                  border: "none",
                  color: "#D6D3D1",
                  borderRadius: "6px",
                  padding: "4px 8px",
                  fontSize: "0.75rem",
                  cursor: "pointer",
                }}
              >
                ↺ Clear
              </button>


              {/* Close Button */}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Close"
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#D6D3D1",
                  fontSize: "18px",
                  cursor: "pointer",
                  padding: "4px 6px",
                  lineHeight: 1,
                }}
              >
                ✕
              </button>
            </div>
          </div>

          {/* Messages Stream */}
          <div
            style={{
              flex: 1,
              padding: "16px",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              backgroundColor: "var(--color-bg-canvas, #F9F9F6)",
            }}
          >
            {/* Render Messages */}
            {messages.map((msg) => {
              const isUser = msg.role === "user";
              return (
                <div
                  key={msg.id}
                  style={{
                    alignSelf: isUser ? "flex-end" : "flex-start",
                    maxWidth: isUser ? "85%" : "95%",
                    display: "flex",
                    flexDirection: "column",
                    gap: "3px",
                  }}
                >
                  {/* Timestamp header */}
                  <div
                    style={{
                      fontSize: "0.68rem",
                      fontWeight: 600,
                      color: "var(--color-text-muted, #A8A29E)",
                      alignSelf: isUser ? "flex-end" : "flex-start",
                      padding: "0 4px",
                    }}
                  >
                    {isUser ? "You" : "Yatra AI"} • {msg.timestamp || "Just now"}
                  </div>

                  {/* Message Bubble */}
                  <div
                    style={{
                      background: isUser
                        ? "linear-gradient(135deg, #1E293B, #0F172A)"
                        : "var(--color-bg-surface, #FFFFFF)",
                      color: isUser ? "#FFFFFF" : "var(--color-text-primary, #1C1917)",
                      padding: "12px 16px",
                      borderRadius: isUser ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                      border: isUser
                        ? "1px solid rgba(255, 255, 255, 0.15)"
                        : "1px solid var(--color-border-subtle, rgba(0, 0, 0, 0.08))",
                      fontSize: "0.875rem",
                      boxShadow: isUser
                        ? "0 4px 14px rgba(15, 23, 42, 0.3)"
                        : "0 2px 8px rgba(0, 0, 0, 0.04)",
                    }}
                  >
                    {isUser ? (
                      <div
                        style={{
                          color: "#FFFFFF",
                          whiteSpace: "pre-wrap",
                          fontWeight: 500,
                          lineHeight: 1.55,
                          fontSize: "0.9rem",
                        }}
                      >
                        {msg.content}
                      </div>
                    ) : (
                      <>
                        {renderMessageContent(msg.content)}
                        <QuickPlaceRedirectionStrip text={msg.content} />
                      </>
                    )}
                  </div>

                  {/* Grounded Source Citations */}
                  {msg.citations && msg.citations.length > 0 && (
                    <div
                      style={{
                        fontSize: "0.72rem",
                        color: "var(--color-text-muted, #78716C)",
                        display: "flex",
                        alignItems: "center",
                        gap: "5px",
                        flexWrap: "wrap",
                        padding: "2px 4px",
                      }}
                    >
                      <span style={{ fontWeight: 700, color: "var(--color-text-secondary, #57534E)" }}>
                        Sources:
                      </span>
                      {msg.citations.slice(0, 2).map((cite, cIdx) => (
                        <a
                          key={cIdx}
                          href={cite.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            color: "var(--color-accent, #B45309)",
                            textDecoration: "underline",
                            fontWeight: 600,
                          }}
                        >
                          {cite.title || "Official Portal"}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Thinking / Loading Indicator */}
            {isThinking && (
              <div
                style={{
                  alignSelf: "flex-start",
                  background: "var(--color-bg-surface, #FFFFFF)",
                  padding: "10px 14px",
                  borderRadius: "14px 14px 14px 4px",
                  border: "1px solid var(--color-border-subtle, rgba(0,0,0,0.08))",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "0.8rem",
                  color: "var(--color-text-secondary, #78716C)",
                }}
              >
                <span className="yatra-thinking-spinner" />
                <span>Consulting verified tourism intelligence…</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Composer */}
          <div
            style={{
              padding: "10px 14px 12px 14px",
              background: "var(--color-bg-surface, #FFFFFF)",
              borderTop: "1px solid var(--color-border-subtle, rgba(0, 0, 0, 0.08))",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                gap: "8px",
                background: "var(--color-bg-canvas, #F5F5F0)",
                border: "1px solid var(--color-border-subtle, rgba(0, 0, 0, 0.12))",
                borderRadius: "12px",
                padding: "6px 8px 6px 12px",
              }}
            >
              <textarea
                ref={textareaRef}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask Yatra AI about places, permits, safety, weather..."
                rows={1}
                disabled={isThinking}
                style={{
                  flex: 1,
                  border: "none",
                  background: "transparent",
                  outline: "none",
                  resize: "none",
                  fontSize: "0.875rem",
                  lineHeight: 1.4,
                  maxHeight: "100px",
                  color: "var(--color-text-primary, #1C1917)",
                  fontFamily: "inherit",
                }}
              />

              <button
                type="button"
                onClick={() => handleSendMessage()}
                disabled={!inputText.trim() || isThinking}
                aria-label="Send query"
                style={{
                  width: "34px",
                  height: "34px",
                  borderRadius: "8px",
                  background: inputText.trim() && !isThinking
                    ? "var(--color-accent, #FF9933)"
                    : "rgba(0, 0, 0, 0.1)",
                  color: inputText.trim() && !isThinking ? "#FFFFFF" : "#A8A29E",
                  border: "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: inputText.trim() && !isThinking ? "pointer" : "not-allowed",
                  fontSize: "14px",
                  transition: "all 0.15s ease",
                  flexShrink: 0,
                }}
              >
                ➤
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Styles for Animations */}
      <style>{`
        .yatra-floating-fab:hover {
          transform: translateY(-2px);
          border-color: #FF9933 !important;
          box-shadow: 0 10px 24px rgba(0, 0, 0, 0.35), 0 0 20px rgba(255, 153, 51, 0.35) !important;
        }
        @keyframes yatraChatSlideUp {
          from {
            opacity: 0;
            transform: translateY(16px) scale(0.97);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        .yatra-thinking-spinner {
          width: 14px;
          height: 14px;
          border: 2px solid rgba(255, 153, 51, 0.25);
          border-top-color: #FF9933;
          border-radius: 50%;
          animation: yatraSpin 0.7s linear infinite;
        }
        @keyframes yatraSpin {
          to { transform: rotate(360deg); }
        }
        @media (max-width: 640px) {
          .yatra-chat-modal {
            bottom: 84px !important;
            right: 12px !important;
            width: calc(100vw - 24px) !important;
            height: calc(100vh - 100px) !important;
          }
          .yatra-floating-fab {
            bottom: 16px !important;
            right: 16px !important;
          }
        }
      `}</style>
    </>
  );
}
