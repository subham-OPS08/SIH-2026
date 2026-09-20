"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { BrandLogo } from "./BrandLogo";
import {
  VERIFIED_DESTINATIONS,
  VERIFIED_TERRITORIES,
  VERIFIED_FESTIVALS,
  VERIFIED_BOOKABLE_EXPERIENCES,
  VERIFIED_NATIONAL_CONTACTS,
} from "@/src/lib/fixtures";

interface SearchSuggestionItem {
  id: string;
  title: string;
  subtitle: string;
  category: "UT" | "Destination" | "Festival" | "Booking" | "Safety" | "Tool";
  badge: string;
  href: string;
}

const SITE_PAGES = [
  {
    title: "Interactive 3D Map",
    subtitle: "Explore 8 Union Territories with 3D terrain & verified markers",
    category: "Tool" as const,
    badge: "Interactive Map",
    href: "/map",
    keywords: ["map", "3d", "coordinates", "terrain", "gis", "satellite", "explore"],
  },
  {
    title: "Smart Itinerary Planner",
    subtitle: "Build AI-optimized day-by-day travel schedules across Bharat",
    category: "Tool" as const,
    badge: "Trip Planner",
    href: "/itinerary",
    keywords: ["itinerary", "plan", "trip", "schedule", "planner", "days", "budget", "route"],
  },
  {
    title: "Verified Bookings & E-Tickets",
    subtitle: "Official government ticketing portals and state tourism stays",
    category: "Tool" as const,
    badge: "Official Booking",
    href: "/bookings",
    keywords: ["booking", "ticket", "hotel", "resort", "ferry", "pass", "permit", "stay"],
  },
  {
    title: "2026 Cultural Festival Calendar",
    subtitle: "Verified festival schedules directly from UT Tourism departments",
    category: "Tool" as const,
    badge: "2026 Calendar",
    href: "/festivals",
    keywords: ["festival", "event", "culture", "calendar", "dance", "celebration", "hemis", "tulip"],
  },
  {
    title: "All Verified Destinations Hub",
    subtitle: "Browse 40+ curated attractions across all 8 Union Territories",
    category: "Tool" as const,
    badge: "Explore All",
    href: "/destinations",
    keywords: ["destinations", "places", "attractions", "beaches", "forts", "monasteries", "all"],
  },
];

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isDark, setIsDark] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMobileSearchExpanded, setIsMobileSearchExpanded] = useState(false);

  const searchContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedTheme = localStorage.getItem("bsy_theme");
    if (savedTheme === "dark") {
      setIsDark(true);
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      setIsDark(false);
      document.documentElement.setAttribute("data-theme", "light");
    }

    const handleScroll = () => {
      setIsScrolled(window.scrollY > 30);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close search suggestions on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsSearchFocused(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Reset search state on route change
  useEffect(() => {
    setIsSearchFocused(false);
    setSelectedIndex(-1);
    setIsMenuOpen(false);
    setIsMobileSearchExpanded(false);
  }, [pathname]);

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    const theme = next ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("bsy_theme", theme);
  };

  // Comprehensive multi-dataset live suggestions computation
  const suggestions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];

    const results: SearchSuggestionItem[] = [];

    // 1. Union Territories
    VERIFIED_TERRITORIES.forEach((t) => {
      const matchScore =
        (t.name.toLowerCase().includes(q) ? 10 : 0) +
        (t.shortName.toLowerCase().includes(q) ? 8 : 0) +
        (t.capital.toLowerCase().includes(q) ? 6 : 0) +
        (t.popularDestinations?.some((p) => p.toLowerCase().includes(q)) ? 5 : 0) +
        (t.tagline.toLowerCase().includes(q) ? 4 : 0);

      if (matchScore > 0) {
        results.push({
          id: `ut-${t.id}`,
          title: t.name,
          subtitle: `Capital: ${t.capital} • ${t.tagline}`,
          category: "UT",
          badge: "Union Territory",
          href: `/destinations?ut=${t.slug}`,
        });
      }
    });

    // 2. Destinations & Attractions
    VERIFIED_DESTINATIONS.forEach((d) => {
      const matchScore =
        (d.name.toLowerCase().includes(q) ? 10 : 0) +
        (d.type?.toLowerCase().includes(q) ? 6 : 0) +
        (d.territoryName?.toLowerCase().includes(q) ? 5 : 0) +
        (d.shortDescription?.toLowerCase().includes(q) ? 4 : 0) +
        (d.highlights?.some((h) => h.toLowerCase().includes(q)) ? 4 : 0);

      if (matchScore > 0) {
        results.push({
          id: `dest-${d.id}`,
          title: d.name,
          subtitle: `${d.territoryName} • ${d.type}`,
          category: "Destination",
          badge: d.type || "Attraction",
          href: `/destinations/${d.slug}`,
        });
      }
    });

    // 3. Cultural Festivals
    VERIFIED_FESTIVALS.forEach((f) => {
      const matchScore =
        (f.name.toLowerCase().includes(q) ? 10 : 0) +
        (f.location?.toLowerCase().includes(q) ? 6 : 0) +
        (f.territoryName?.toLowerCase().includes(q) ? 5 : 0) +
        (f.category?.toLowerCase().includes(q) ? 4 : 0);

      if (matchScore > 0) {
        results.push({
          id: `fest-${f.id}`,
          title: f.name,
          subtitle: `${f.displayDate} • ${f.location} (${f.territoryName})`,
          category: "Festival",
          badge: "Festival",
          href: "/festivals",
        });
      }
    });

    // 4. Bookable Experiences & Passes
    VERIFIED_BOOKABLE_EXPERIENCES.forEach((b) => {
      const matchScore =
        (b.title.toLowerCase().includes(q) ? 10 : 0) +
        (b.location?.toLowerCase().includes(q) ? 5 : 0) +
        (b.providerName?.toLowerCase().includes(q) ? 4 : 0);

      if (matchScore > 0) {
        results.push({
          id: `booking-${b.id}`,
          title: b.title,
          subtitle: `${b.location} • Official Provider: ${b.providerName}`,
          category: "Booking",
          badge: "E-Ticket",
          href: "/bookings",
        });
      }
    });

    // 5. Emergency Helplines & Safety Contacts
    VERIFIED_NATIONAL_CONTACTS.forEach((c, idx) => {
      const matchScore =
        (c.service.toLowerCase().includes(q) ? 10 : 0) +
        (c.number.toLowerCase().includes(q) ? 10 : 0) +
        (c.category?.toLowerCase().includes(q) ? 6 : 0) +
        (c.description?.toLowerCase().includes(q) ? 4 : 0);

      if (matchScore > 0) {
        results.push({
          id: `safety-${idx}`,
          title: `${c.service} (${c.number})`,
          subtitle: `${c.category} • ${c.description}`,
          category: "Safety",
          badge: "Emergency Helpline",
          href: "/safety",
        });
      }
    });

    // 6. Site Tools & Key Pages
    SITE_PAGES.forEach((p, idx) => {
      const matchScore =
        (p.title.toLowerCase().includes(q) ? 10 : 0) +
        (p.keywords.some((k) => k.includes(q)) ? 8 : 0) +
        (p.subtitle.toLowerCase().includes(q) ? 4 : 0);

      if (matchScore > 0) {
        results.push({
          id: `page-${idx}`,
          title: p.title,
          subtitle: p.subtitle,
          category: "Tool",
          badge: p.badge,
          href: p.href,
        });
      }
    });

    return results.slice(0, 10);
  }, [searchQuery]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIndex >= 0 && suggestions[selectedIndex]) {
      router.push(suggestions[selectedIndex].href);
      setIsSearchFocused(false);
      return;
    }
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setIsSearchFocused(false);
    } else {
      router.push("/destinations");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isSearchFocused || suggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === "Escape") {
      setIsSearchFocused(false);
    }
  };

  const navLinks = [
    { label: "Home", href: "/" },
    { label: "Destinations", href: "/destinations" },
    { label: "Itinerary", href: "/itinerary" },
    { label: "Experience", href: "/experience" },
    { label: "Booking", href: "/bookings" },
  ];

  const navRef = useRef<HTMLElement>(null);
  const linkRefs = useRef<Record<string, HTMLElement | null>>({});
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [indicatorStyle, setIndicatorStyle] = useState<{ left: number; width: number; opacity: number }>({
    left: 0,
    width: 0,
    opacity: 0,
  });

  const activeKey = useMemo(() => {
    if (hoveredKey) return hoveredKey;
    const match = navLinks.find(
      (link) => pathname === link.href || (link.href !== "/" && pathname.startsWith(link.href))
    );
    return match ? match.href : null;
  }, [pathname, hoveredKey, navLinks]);

  const updateIndicator = useCallback(() => {
    if (!navRef.current) return;
    if (activeKey && linkRefs.current[activeKey]) {
      const el = linkRefs.current[activeKey]!;
      const navRect = navRef.current.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();

      const left = elRect.left - navRect.left;
      const width = elRect.width;

      setIndicatorStyle({
        left: left + 8,
        width: Math.max(0, width - 16),
        opacity: 1,
      });
    } else {
      setIndicatorStyle((prev) => ({ ...prev, opacity: 0 }));
    }
  }, [activeKey]);

  useEffect(() => {
    updateIndicator();
    const rafId = requestAnimationFrame(updateIndicator);
    window.addEventListener("resize", updateIndicator);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", updateIndicator);
    };
  }, [updateIndicator]);

  const isHome = pathname === "/";
  const isTransparent = isHome && !isScrolled;

  return (
    <>
      <style>{`
        /* RESPONSIVE NAVBAR CLASSES */
        .bsy-navbar-container {
          display: flex;
          align-items: center;
          justify-content: space-between;
          height: 72px;
          width: 100%;
          max-width: 100%;
          padding: 0 clamp(16px, 2.5vw, 28px);
          margin: 0 auto;
          gap: 12px;
          position: relative;
        }

        .bsy-nav-left {
          display: flex;
          align-items: center;
          z-index: 2;
          flex-shrink: 0;
        }

        .bsy-nav-center {
          display: flex;
          gap: 4px;
          align-items: center;
          justify-content: center;
          flex: 1;
          min-width: 0;
          white-space: nowrap;
          z-index: 1;
        }

        .bsy-nav-right {
          display: flex;
          align-items: center;
          gap: 8px;
          z-index: 30;
          position: relative;
          flex-shrink: 0;
        }

        .bsy-search-form {
          display: flex;
          align-items: center;
          border-radius: var(--radius-pill, 9999px);
          padding: 7px 14px;
          gap: 8px;
          width: 240px;
          transition: all 0.25s ease;
          position: relative;
        }

        .bsy-search-input-wrapper {
          display: block;
          flex: 1;
        }

        .bsy-mobile-menu-trigger {
          display: none;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          border: none;
          background: transparent;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        /* Narrow desktop (~1140px - 1320px) */
        @media (max-width: 1320px) {
          .bsy-search-form {
            width: 180px;
          }
          .bsy-nav-center {
            gap: 2px;
          }
        }

        /* STATE 2: COMPACT / TABLET (< 1140px) */
        @media (max-width: 1140px) {
          .bsy-nav-center {
            display: none !important;
          }
          .bsy-mobile-menu-trigger {
            display: flex;
          }
          .bsy-search-form {
            width: 200px;
          }
        }

        /* STATE 3: MOBILE (< 768px) */
        @media (max-width: 768px) {
          .bsy-search-form {
            width: 40px;
            padding: 0;
            justify-content: center;
            background: transparent !important;
            border: none !important;
          }
          .bsy-search-input-wrapper {
            display: none;
          }

          /* Expanded search state on mobile */
          .bsy-nav-right.search-expanded .bsy-search-form {
            position: absolute;
            right: 0;
            width: calc(100vw - 32px);
            max-width: 400px;
            background: var(--color-bg-surface, #fff) !important;
            border: 1px solid var(--color-border-subtle) !important;
            padding: 7px 14px;
            z-index: 50;
          }
          .bsy-nav-right.search-expanded .bsy-search-input-wrapper {
            display: block;
          }

          .hide-on-mobile {
            display: none !important;
          }
        }
      `}</style>

      {/* MOBILE FULLSCREEN MENU */}
      {isMenuOpen && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)'
          }}
          onClick={() => setIsMenuOpen(false)}
        >
          <div
            style={{
              position: 'absolute', top: 0, right: 0, bottom: 0,
              width: 'min(320px, 85vw)',
              background: isDark ? 'rgba(19, 27, 46, 0.98)' : 'rgba(250, 247, 242, 0.98)',
              boxShadow: '-10px 0 40px rgba(0,0,0,0.2)',
              padding: '24px',
              display: 'flex', flexDirection: 'column',
              overflowY: 'auto'
            }}
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Mobile Navigation Menu"
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
              <BrandLogo size="sm" textColor={isDark ? '#FFFFFF' : undefined} />
              <button
                onClick={() => setIsMenuOpen(false)}
                aria-label="Close navigation menu"
                style={{
                  background: 'transparent', border: 'none',
                  color: isDark ? '#FFFFFF' : 'var(--color-text-primary)',
                  fontSize: '1.5rem', cursor: 'pointer',
                  padding: '4px'
                }}
              >✕</button>
            </div>

            <nav style={{ display: 'flex', flexDirection: 'column', gap: '16px' }} aria-label="Mobile Navigation">
              {navLinks.map(l => {
                const isActive = pathname === l.href || (l.href !== '/' && pathname.startsWith(l.href));
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    onClick={() => setIsMenuOpen(false)}
                    style={{
                      fontSize: '1.1rem', fontWeight: isActive ? 700 : 500, textDecoration: 'none',
                      color: isActive ? 'var(--color-accent)' : (isDark ? '#FFFFFF' : 'var(--color-text-primary)'),
                      padding: '8px 0'
                    }}
                  >{l.label}</Link>
                );
              })}


              <div style={{ borderTop: '1px solid var(--color-border-subtle)', margin: '16px 0' }}></div>

              <Link
                href="/profile"
                onClick={() => setIsMenuOpen(false)}
                style={{
                  fontSize: '1.1rem', fontWeight: 500, textDecoration: 'none',
                  color: isDark ? '#FFFFFF' : 'var(--color-text-primary)', padding: '8px 0'
                }}
              >Profile</Link>

              <button
                onClick={() => { toggleTheme(); setIsMenuOpen(false); }}
                style={{
                  fontSize: '1.1rem', fontWeight: 500, textAlign: 'left', padding: '8px 0',
                  color: isDark ? '#FFFFFF' : 'var(--color-text-primary)', background: 'transparent', border: 'none', cursor: 'pointer'
                }}
              >Theme: {isDark ? 'Dark' : 'Light'}</button>

              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  if (typeof window !== "undefined") {
                    window.dispatchEvent(new CustomEvent("open-yatra-ai"));
                  }
                }}
                style={{
                  fontSize: '1.1rem', fontWeight: 600, textDecoration: 'none',
                  color: 'var(--color-accent)', padding: '8px 0',
                  background: 'transparent', border: 'none', textAlign: 'left',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
                }}
              >✦ Yatra AI</button>

              <Link
                href="/safety"
                onClick={() => setIsMenuOpen(false)}
                style={{
                  fontSize: '1.1rem', fontWeight: 700, textDecoration: 'none', color: '#dc2626',
                  marginTop: '16px', display: 'flex', alignItems: 'center', gap: '8px'
                }}
              >
                <span style={{ background: '#dc2626', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem' }}>SOS</span>
                Emergency
              </Link>
            </nav>
          </div>
        </div>
      )}

      {/* Global Page Offset for Non-Home Pages */}
      {!isHome && <div style={{ height: '72px', width: '100%', flexShrink: 0 }} aria-hidden="true" />}
      <header
        className={`navbar fixed top-0 w-full z-50 transition-all duration-300 ${isTransparent ? "navbar-transparent" : "navbar-scrolled"}`}
        style={{
          background: isTransparent
            ? "transparent"
            : isDark
            ? "#131B2E"
            : "#FAF7F2",
          backdropFilter: isTransparent ? "none" : "blur(16px)",
          WebkitBackdropFilter: isTransparent ? "none" : "blur(16px)",
          borderBottom: isTransparent
            ? "none"
            : isDark
            ? "1px solid rgba(255, 255, 255, 0.08)"
            : "1px solid var(--color-border-subtle)",
          boxShadow: isTransparent ? "none" : isScrolled ? "0 10px 30px -15px rgba(0, 0, 0, 0.25)" : "none",
        }}
        role="banner"
      >
        <div className="bsy-navbar-container">
          {/* Left Corner: Brand Logo */}
          <div className="bsy-nav-left" style={{ opacity: isMobileSearchExpanded ? 0 : 1, pointerEvents: isMobileSearchExpanded ? 'none' : 'auto', transition: 'opacity 0.2s' }}>
            <BrandLogo size="md" textColor={isDark ? "#FFFFFF" : isTransparent ? "#FFFFFF" : undefined} isDark={isDark} />
          </div>

          {/* Desktop Navigation Links — STATE 1 Only */}
          <nav
            ref={navRef}
            className="bsy-nav-center nav-links"
            role="navigation"
            aria-label="Main Navigation"
            onMouseLeave={() => setHoveredKey(null)}
            style={{
              position: "absolute",
              left: "50%",
              transform: "translateX(-50%)",
              display: "flex",
              gap: "2px",
              alignItems: "center",
              height: "100%",
            }}
          >
            {navLinks.map((link) => {
              const isActive = pathname === link.href || (link.href !== "/" && pathname.startsWith(link.href));
              const isItemHovered = hoveredKey === link.href;
              const isHighlight = isItemHovered || (!hoveredKey && isActive);
              return (
                <Link
                  key={link.href}
                  ref={(el) => { linkRefs.current[link.href] = el; }}
                  href={link.href}
                  onMouseEnter={() => setHoveredKey(link.href)}
                  className={`nav-link ${isActive ? "active" : ""}`}
                  style={{
                    padding: "8px 14px",
                    fontSize: "0.875rem",
                    fontWeight: isHighlight ? 600 : 500,
                    textDecoration: "none",
                    color: isTransparent
                      ? isHighlight
                        ? "#FFFFFF"
                        : "rgba(255, 255, 255, 0.75)"
                      : isHighlight
                      ? "var(--color-brand-accent, #C88E44)"
                      : "var(--color-text-secondary)",
                    background: "transparent",
                    border: "none",
                    borderRadius: 0,
                    position: "relative",
                    textShadow: isTransparent ? "0 1px 4px rgba(0, 0, 0, 0.6)" : "none",
                    transition: "color 0.2s ease",
                  }}
                >
                  {link.label}
                </Link>
              );
            })}

            {/* Animated Moving Line Indicator */}
            <span
              className="nav-sliding-indicator"
              style={{
                position: "absolute",
                bottom: "16px",
                left: `${indicatorStyle.left}px`,
                width: `${indicatorStyle.width}px`,
                height: "2.5px",
                borderRadius: "3px",
                background: isTransparent
                  ? "#FFFFFF"
                  : "var(--color-brand-accent, #C88E44)",
                boxShadow: "none",
                opacity: indicatorStyle.opacity,
                transition: "left 0.3s cubic-bezier(0.25, 1, 0.5, 1), width 0.3s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.2s ease, background-color 0.25s ease",
                pointerEvents: "none",
              }}
            />
          </nav>

          {/* Right Corner: Universal Search Bar, Actions, and Menu Button */}
          <div
            ref={searchContainerRef}
            className={`bsy-nav-right navbar-actions ${isMobileSearchExpanded ? 'search-expanded' : ''}`}
          >
            {/* Search Form */}
            <form
              onSubmit={handleSearchSubmit}
              className="bsy-search-form"
              style={{
                background: (isDark || (isTransparent && !isMobileSearchExpanded))
                  ? "rgba(255, 255, 255, 0.14)"
                  : "rgba(45, 27, 20, 0.05)",
                border: (isDark || (isTransparent && !isMobileSearchExpanded))
                  ? "1px solid rgba(255, 255, 255, 0.25)"
                  : "1px solid var(--color-border-subtle)",
                backdropFilter: (isDark || isTransparent) ? "blur(12px)" : "none",
                WebkitBackdropFilter: (isDark || isTransparent) ? "blur(12px)" : "none",
              }}
            >
              <button
                type="button"
                onClick={() => {
                  if (window.innerWidth <= 768) {
                    setIsMobileSearchExpanded(true);
                  }
                }}
                style={{ background: 'transparent', border: 'none', padding: 0, display: 'flex', cursor: 'pointer' }}
                aria-label="Search"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  style={{
                    color: (isDark || (isTransparent && !isMobileSearchExpanded)) ? "rgba(255, 255, 255, 0.9)" : "var(--color-text-muted)",
                    flexShrink: 0,
                  }}
                >
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
              </button>

              <div className="bsy-search-input-wrapper">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setIsSearchFocused(true);
                    setSelectedIndex(-1);
                  }}
                  onFocus={() => setIsSearchFocused(true)}
                  onKeyDown={handleKeyDown}
                  placeholder="Search everything across Bharat..."
                  style={{
                    border: "none",
                    background: "transparent",
                    outline: "none",
                    fontSize: "0.85rem",
                    color: (isDark || (isTransparent && !isMobileSearchExpanded)) ? "#FFFFFF" : "var(--color-text-primary)",
                    width: "100%",
                  }}
                  className={(isDark || (isTransparent && !isMobileSearchExpanded)) ? "hero-search-input" : ""}
                />
              </div>

              {/* Clear / Close Search Button */}
              {(searchQuery || isMobileSearchExpanded) && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSearchQuery("");
                    setIsSearchFocused(false);
                    setIsMobileSearchExpanded(false);
                  }}
                  style={{
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    color: (isDark || (isTransparent && !isMobileSearchExpanded)) ? "#FFFFFF" : "var(--color-text-muted)",
                    padding: "0 2px",
                    fontSize: "0.8rem",
                    lineHeight: 1,
                  }}
                  aria-label="Clear Search"
                >
                  ✕
                </button>
              )}
            </form>

            {/* Real-time Universal Suggestions Dropdown Menu */}
            {isSearchFocused && searchQuery.trim().length > 0 && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 10px)",
                  right: 0,
                  width: "min(440px, 92vw)",
                  maxHeight: "440px",
                  overflowY: "auto",
                  background: isDark
                    ? "rgba(19, 27, 46, 0.98)"
                    : "rgba(255, 255, 255, 0.98)",
                  backdropFilter: "blur(20px)",
                  WebkitBackdropFilter: "blur(20px)",
                  border: "1px solid var(--color-border-subtle)",
                  borderRadius: "var(--radius-xl, 16px)",
                  boxShadow: "0 18px 45px -10px rgba(0, 0, 0, 0.28), 0 0 0 1px rgba(200, 142, 68, 0.15)",
                  zIndex: 100,
                  padding: "8px 0",
                }}
              >
                {suggestions.length > 0 ? (
                  <>
                    <div
                      style={{
                        padding: "8px 16px",
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        color: "var(--color-brand-accent, #C88E44)",
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        borderBottom: "1px solid var(--color-border-subtle)",
                      }}
                    >
                      Instant Results ({suggestions.length})
                    </div>

                    <div style={{ padding: "4px 0" }}>
                      {suggestions.map((item, idx) => {
                        const isSelected = idx === selectedIndex;
                        return (
                          <Link
                            key={item.id}
                            href={item.href}
                            onClick={() => setIsSearchFocused(false)}
                            onMouseEnter={() => setSelectedIndex(idx)}
                            style={{
                              display: "block",
                              padding: "9px 16px",
                              textDecoration: "none",
                              background: isSelected
                                ? isDark
                                  ? "rgba(200, 142, 68, 0.22)"
                                  : "rgba(200, 142, 68, 0.14)"
                                : "transparent",
                              transition: "background 0.15s ease",
                              borderLeft: isSelected ? "3px solid var(--color-brand-accent, #C88E44)" : "3px solid transparent",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", marginBottom: "3px" }}>
                              <span
                                style={{
                                  fontSize: "0.875rem",
                                  fontWeight: 700,
                                  color: "var(--color-text-primary)",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {item.title}
                              </span>
                              <span
                                style={{
                                  fontSize: "0.68rem",
                                  fontWeight: 600,
                                  padding: "2px 7px",
                                  borderRadius: "4px",
                                  background: "rgba(200, 142, 68, 0.15)",
                                  color: "var(--color-brand-accent, #C88E44)",
                                  flexShrink: 0,
                                  textTransform: "uppercase",
                                  letterSpacing: "0.03em",
                                }}
                              >
                                {item.badge}
                              </span>
                            </div>
                            <div
                              style={{
                                fontSize: "0.775rem",
                                color: "var(--color-text-secondary)",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {item.subtitle}
                            </div>
                          </Link>
                        );
                      })}
                    </div>

                    {/* Full Search Page Action Footer */}
                    <div
                      style={{
                        borderTop: "1px solid var(--color-border-subtle)",
                        padding: "8px 16px 4px",
                        marginTop: "4px",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
                          setIsSearchFocused(false);
                          setIsMobileSearchExpanded(false);
                        }}
                        style={{
                          width: "100%",
                          background: "transparent",
                          border: "none",
                          color: "var(--color-brand-accent, #C88E44)",
                          fontSize: "0.825rem",
                          fontWeight: 700,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "6px 0",
                        }}
                      >
                        <span>View all search results for &ldquo;{searchQuery}&rdquo;</span>
                        <span>→</span>
                      </button>
                    </div>
                  </>
                ) : (
                  <div style={{ padding: "20px 16px", textAlign: "center" }}>
                    <div style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--color-text-primary)", marginBottom: "4px" }}>
                      No exact instant matches
                    </div>
                    <div style={{ fontSize: "0.775rem", color: "var(--color-text-secondary)", marginBottom: "12px" }}>
                      Try searching by territory, destination name, festival, or helpline.
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
                        setIsSearchFocused(false);
                        setIsMobileSearchExpanded(false);
                      }}
                      className="btn btn-sm btn-outline"
                      style={{ fontSize: "0.8rem", width: "100%" }}
                    >
                      Search full site database for &ldquo;{searchQuery}&rdquo; →
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* User Profile */}
            <Link
              href="/profile"
              className="btn btn-sm btn-ghost btn-icon-only rounded-full w-10 h-10 flex items-center justify-center text-[var(--color-text-primary)] hide-on-mobile"
              aria-label="User Profile"
              style={{
                color: (isDark || isTransparent) ? "#FFFFFF" : "var(--color-text-primary)",
                background: (isDark || isTransparent) ? "rgba(255, 255, 255, 0.14)" : "transparent",
                border: (isDark || isTransparent) ? "1px solid rgba(255, 255, 255, 0.22)" : "none",
                backdropFilter: (isDark || isTransparent) ? "blur(8px)" : "none",
                WebkitBackdropFilter: (isDark || isTransparent) ? "blur(8px)" : "none",
                borderRadius: "50%",
                width: "36px",
                height: "36px",
                display: isMobileSearchExpanded ? "none" : "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.2s ease",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
            </Link>

            {/* Dark/Light Theme Switcher */}
            <button
              type="button"
              className="btn btn-sm btn-ghost btn-icon-only rounded-full w-10 h-10 flex items-center justify-center text-[var(--color-text-primary)] hide-on-mobile"
              onClick={toggleTheme}
              aria-label={`Toggle ${isDark ? "Light" : "Dark"} Mode`}
              style={{
                color: (isDark || isTransparent) ? "#FFFFFF" : "var(--color-text-primary)",
                background: (isDark || isTransparent) ? "rgba(255, 255, 255, 0.14)" : "transparent",
                border: (isDark || isTransparent) ? "1px solid rgba(255, 255, 255, 0.22)" : "none",
                backdropFilter: (isDark || isTransparent) ? "blur(8px)" : "none",
                WebkitBackdropFilter: (isDark || isTransparent) ? "blur(8px)" : "none",
                borderRadius: "50%",
                width: "36px",
                height: "36px",
                display: isMobileSearchExpanded ? "none" : "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.2s ease",
              }}
            >
              {isDark ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <circle cx="12" cy="12" r="5"></circle>
                  <line x1="12" y1="1" x2="12" y2="3"></line>
                  <line x1="12" y1="21" x2="12" y2="23"></line>
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                  <line x1="1" y1="12" x2="3" y2="12"></line>
                  <line x1="21" y1="12" x2="23" y2="12"></line>
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                </svg>
              )}
            </button>

            {/* Mobile Menu Hamburger Button */}
            <button
              type="button"
              className="bsy-mobile-menu-trigger"
              onClick={() => setIsMenuOpen(true)}
              aria-label="Open Navigation Menu"
              aria-expanded={isMenuOpen}
              style={{
                color: (isDark || isTransparent) ? "#FFFFFF" : "var(--color-text-primary)",
                display: isMobileSearchExpanded ? "none" : undefined,
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>
      </header>
    </>
  );
}
