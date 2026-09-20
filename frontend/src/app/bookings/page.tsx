"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { VERIFIED_DESTINATIONS } from "@/src/lib/fixtures";
import { VERIFIED_BOOKING_REGISTRY, UT_ESSENTIALS, BookingServiceCategory, getTourHQUrl } from "@/src/lib/bookingProviders";

import Image from "next/image";
import { Plane, Bed, Train, Car, Users, Landmark, ArrowRight } from "lucide-react";

const BOOKING_INTENTS = [
  {
    id: "FLIGHTS",
    label: "Flights",
    description: "Get there",
    icon: Plane,
    image: "/images/bookingcards/ChatGPT Image Sep 20, 2026, 12_40_50 AM.png",
    accentColor: "#f0f8ff",
    iconBg: "rgba(240,248,255,0.7)",
    iconTint: "#0070f3"
  },
  {
    id: "STAYS",
    label: "Stays",
    description: "Hotels & homes",
    icon: Bed,
    image: "/images/bookingcards/ChatGPT Image Sep 20, 2026, 12_44_54 AM.png",
    accentColor: "#fffaf0",
    iconBg: "rgba(255,235,214,0.7)",
    iconTint: "#d97706"
  },
  {
    id: "TRAINS",
    label: "Trains",
    description: "Rail journeys",
    icon: Train,
    image: "/images/bookingcards/ChatGPT Image Sep 20, 2026, 12_49_34 AM.png",
    accentColor: "#f0fdf4",
    iconBg: "rgba(220,252,231,0.7)",
    iconTint: "#16a34a"
  },
  {
    id: "LOCAL_TRANSPORT",
    label: "Local transport",
    description: "Cabs & transfers",
    icon: Car,
    image: "/images/bookingcards/ChatGPT Image Sep 20, 2026, 01_06_55 AM.png",
    accentColor: "#fffbeb",
    iconBg: "rgba(254,243,199,0.7)",
    iconTint: "#d97706"
  },
  {
    id: "GUIDES_EXPERIENCES",
    label: "Guides & experiences",
    description: "Local operators",
    icon: Users,
    image: "/images/bookingcards/ChatGPT Image Sep 20, 2026, 01_10_00 AM.png",
    accentColor: "#f5f3ff",
    iconBg: "rgba(237,233,254,0.7)",
    iconTint: "#7c3aed"
  },
  {
    id: "TEMPLE_DARSHAN",
    label: "Temple / Darshan",
    description: "Official pilgrimage bookings",
    icon: Landmark,
    image: "/images/bookingcards/ChatGPT Image Sep 20, 2026, 01_14_47 AM.png",
    accentColor: "#fff1f2",
    iconBg: "rgba(255,228,230,0.7)",
    iconTint: "#e11d48"
  },
] as const;

export function BookingsContent() {
  const searchParams = useSearchParams();

  const [activeIntent, setActiveIntent] = useState<BookingServiceCategory | null>(null);

  // Context State
  const [hasImportedItinerary, setHasImportedItinerary] = useState(false);
  const [destination, setDestination] = useState<string>("");
  const [origin, setOrigin] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [travellers, setTravellers] = useState<string>("2");

  const [minDateStr, setMinDateStr] = useState<string>("");

  useEffect(() => {
    // Generate current local date for validation
    const today = new Date();
    const tzOffset = today.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(Date.now() - tzOffset)).toISOString().split('T')[0];
    setMinDateStr(localISOTime);
  }, []);

  const handleImportItinerary = () => {
    const dest = searchParams.get("destination");
    const start = searchParams.get("startDate");
    const end = searchParams.get("endDate");
    const pax = searchParams.get("travellers");

    if (dest) {
      const matchedDest = VERIFIED_DESTINATIONS.find(d =>
        d.id.toLowerCase() === dest.toLowerCase() ||
        d.name.toLowerCase() === dest.toLowerCase() ||
        d.territoryId.toLowerCase() === dest.toLowerCase()
      );
      setDestination(matchedDest ? matchedDest.name : dest);
    }

    // Strict date validation on import
    let dateError = false;
    if (start) {
      if (start < minDateStr) {
        dateError = true;
      } else {
        setStartDate(start);
      }
    }
    if (end) {
      if (end < minDateStr || (start && end <= start)) {
        dateError = true;
      } else {
        setEndDate(end);
      }
    }

    if (pax) setTravellers(pax);
    setHasImportedItinerary(true);

    if (dateError) {
      alert("That trip date has passed. Choose new dates to continue.");
    }
  };

  const hasItineraryParams = searchParams.has("destination") || searchParams.has("startDate");

  const buildHandoffUrl = () => {
    if (activeIntent === "FLIGHTS") {
      const provider = VERIFIED_BOOKING_REGISTRY.find(p => p.id === 'flights-skyscanner-india');
      if (origin && destination && startDate) {
        const outDate = startDate.replace(/-/g, '');
        const inDate = endDate ? endDate.replace(/-/g, '') : '';
        return `https://www.skyscanner.co.in/transport/flights/${encodeURIComponent(origin)}/${encodeURIComponent(destination)}/${outDate}/${inDate}/?adultsv2=${travellers}&cabinclass=economy`;
      }
      return provider?.url || "#";
    }

    if (activeIntent === "STAYS") {
      const provider = VERIFIED_BOOKING_REGISTRY.find(p => p.id === 'stays-airbnb');
      if (destination && startDate && endDate) {
        return `https://www.airbnb.co.in/s/${encodeURIComponent(destination)}/homes?checkin=${startDate}&checkout=${endDate}&adults=${travellers}`;
      }
      return provider?.url || "#";
    }

    if (activeIntent === "TRAINS") {
      return VERIFIED_BOOKING_REGISTRY.find(p => p.id === 'trains-irctc')?.url || "#";
    }

    if (activeIntent === "LOCAL_TRANSPORT") {
      const provider = VERIFIED_BOOKING_REGISTRY.find(p => p.id === 'transport-uber');
      if (destination) {
        return `https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff=${encodeURIComponent(destination)}`;
      }
      return provider?.url || "#";
    }

    if (activeIntent === "TEMPLE_DARSHAN") {
      const specificProvider = VERIFIED_BOOKING_REGISTRY.find(p => p.service === 'TEMPLE_DARSHAN' && (p.destination === destination || destination.includes(p.destination)));
      return specificProvider?.url || "https://tourism.gov.in/";
    }

    if (activeIntent === "GUIDES_EXPERIENCES") {
      if (!destination) return "#";
      const tourHqUrl = getTourHQUrl(destination);
      if (tourHqUrl) return tourHqUrl;
      const specificProvider = VERIFIED_BOOKING_REGISTRY.find(p => p.service === 'GUIDES_EXPERIENCES' && (p.destination === destination || destination.includes(p.destination)));
      if (specificProvider) return specificProvider.url;
      return VERIFIED_BOOKING_REGISTRY.find(p => p.id === 'guides-desh')?.url || "https://tourism.gov.in/";
    }

    return "#";
  };

  const getProviderName = () => {
    if (activeIntent === "FLIGHTS") return "Skyscanner";
    if (activeIntent === "STAYS") return "Airbnb";
    if (activeIntent === "TRAINS") return "IRCTC";
    if (activeIntent === "LOCAL_TRANSPORT") return "Uber";

    if (activeIntent === "TEMPLE_DARSHAN") {
      const p = VERIFIED_BOOKING_REGISTRY.find(p => p.service === 'TEMPLE_DARSHAN' && (p.destination === destination || destination.includes(p.destination)));
      return p ? p.provider : "Official Portal";
    }

    if (activeIntent === "GUIDES_EXPERIENCES") {
      const tourHqUrl = getTourHQUrl(destination);
      if (tourHqUrl) return "TourHQ";
      const p = VERIFIED_BOOKING_REGISTRY.find(p => p.service === 'GUIDES_EXPERIENCES' && (p.destination === destination || destination.includes(p.destination)));
      return p ? p.provider : "Official Tourism Portal";
    }

    return "Provider";
  };

  const activeEssentials = UT_ESSENTIALS.find(u => u.destinationId === destination || destination.includes(u.destinationId));

  return (
    <main className="container section-spacing relative" role="main" style={{ minHeight: "100vh", paddingBottom: "120px", zIndex: 0 }}>
      <style>{`
        .booking-cards-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 24px;
          margin-bottom: 32px;
          text-align: left;
        }
        @media (max-width: 1024px) {
          .booking-cards-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        @media (max-width: 768px) {
          .booking-cards-grid {
            grid-template-columns: 1fr;
          }
        }
        .booking-card-item {
          position: relative;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          text-align: left;
          transition: all 0.3s ease-out;
          outline: none;
          border-radius: 20px;
          border: 1px solid var(--color-border-subtle, rgba(0,0,0,0.05));
          box-shadow: 0 4px 20px rgba(0,0,0,0.03);
          height: 280px;
          cursor: pointer;
        }
        .booking-card-item:hover, .booking-card-item:focus-visible {
          transform: translateY(-4px);
          box-shadow: 0 12px 30px rgba(0,0,0,0.08);
        }
        .booking-card-image-wrapper {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          overflow: hidden;
          z-index: 0;
        }
        .booking-card-img {
          object-fit: cover;
          transition: transform 0.5s ease-out;
        }
        .booking-card-item:hover .booking-card-img, .booking-card-item:focus-visible .booking-card-img {
          transform: scale(1.02);
        }
        .booking-card-overlay {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 60%;
          background: linear-gradient(to bottom, transparent, rgba(0,0,0,0.60));
          pointer-events: none;
          z-index: 1;
        }
        .booking-card-content {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          display: flex;
          flex-direction: row;
          align-items: flex-end;
          justify-content: space-between;
          padding: 20px;
          z-index: 2;
        }
        .booking-card-icon-circle {
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          flex-shrink: 0;
          width: 48px;
          height: 48px;
          backdrop-filter: blur(4px);
        }
        .booking-card-arrow-circle {
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          flex-shrink: 0;
          width: 36px;
          height: 36px;
          background-color: rgba(255,255,255,0.2);
          backdrop-filter: blur(4px);
          border: 1px solid rgba(255,255,255,0.4);
          color: #ffffff;
          transition: transform 0.3s ease, background-color 0.3s ease;
        }
        .booking-card-item:hover .booking-card-arrow-circle, .booking-card-item:focus-visible .booking-card-arrow-circle {
          transform: translateX(4px);
          background-color: rgba(255,255,255,0.3);
        }
      `}</style>

      {/* Subtle travel-photo wash */}
      {!activeIntent && (
        <div
          className="absolute inset-0 pointer-events-none z-[-1]"
          style={{
            backgroundImage: "url('/images/Andaman and Nicobar Islands_hero.jpeg')",
            backgroundSize: "cover",
            backgroundPosition: "center",
            opacity: 0.04,
            filter: "blur(10px)",
            WebkitMaskImage: "linear-gradient(to bottom, transparent, black 20%, black 80%, transparent)",
            maskImage: "linear-gradient(to bottom, transparent, black 20%, black 80%, transparent)"
          }}
        />
      )}

      {!activeIntent ? (
        <section style={{ maxWidth: "1000px", margin: "40px auto", textAlign: "center" }}>
          <h4 style={{ fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--color-accent, #C88E44)", fontWeight: 800, marginBottom: "16px" }}>
            Book with Dishaara
          </h4>
          <h1 className="font-serif" style={{ fontSize: "clamp(2rem, 4vw, 3.5rem)", marginBottom: "var(--space-2xl)", color: "var(--color-text-primary, #2D1B14)", lineHeight: 1.1 }}>
            Where do you want Dishaara to help?
          </h1>

          <div className="booking-cards-grid">
            {BOOKING_INTENTS.map((intent) => {
              const Icon = intent.icon;
              return (
                <button
                  key={intent.id}
                  onClick={() => setActiveIntent(intent.id as BookingServiceCategory)}
                  className="booking-card-item"
                  style={{ backgroundColor: "#1c1c28" }}
                >
                  <div className="booking-card-image-wrapper">
                    <Image
                      src={intent.image}
                      alt={intent.label}
                      fill
                      className="booking-card-img"
                      sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    />
                  </div>

                  <div className="booking-card-overlay" />

                  <div className="booking-card-content">
                    <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: "16px" }}>
                      <div
                        className="booking-card-icon-circle"
                        style={{ backgroundColor: intent.iconBg, color: intent.iconTint }}
                      >
                        <Icon size={24} strokeWidth={2} />
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", textAlign: "left" }}>
                        <h3 style={{ fontSize: "1.15rem", fontWeight: 700, color: "#ffffff", margin: "0 0 2px 0", lineHeight: 1.2 }}>{intent.label}</h3>
                        <p style={{ fontSize: "0.9rem", color: "rgba(255,255,255,0.85)", margin: 0 }}>{intent.description}</p>
                      </div>
                    </div>

                    <div className="booking-card-arrow-circle">
                      <ArrowRight size={18} strokeWidth={2.5} />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {!hasImportedItinerary && hasItineraryParams && (
            <button
              onClick={handleImportItinerary}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--color-text-secondary)",
                fontSize: "0.95rem",
                textDecoration: "underline",
                cursor: "pointer",
                padding: "8px 16px"
              }}
            >
              Use my Dishaara itinerary
            </button>
          )}
        </section>
      ) : (
        <section style={{ maxWidth: "600px", margin: "40px auto" }}>

          <button
            onClick={() => setActiveIntent(null)}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--color-text-secondary)",
              fontSize: "0.9rem",
              cursor: "pointer",
              marginBottom: "24px",
              display: "flex",
              alignItems: "center",
              gap: "8px"
            }}
          >
            ← Back to options
          </button>

          <div style={{
            background: "var(--color-bg-surface-elevated, #FFFFFF)",
            borderRadius: "20px",
            padding: "40px",
            border: "1px solid var(--color-border-subtle)",
            boxShadow: "0 12px 40px rgba(45,27,20,0.05)"
          }}>
            <h2 className="font-serif" style={{ fontSize: "2.2rem", marginBottom: "8px", color: "var(--color-text-primary)" }}>
              {BOOKING_INTENTS.find(i => i.id === activeIntent)?.label}
            </h2>
            <p style={{ color: "var(--color-text-secondary)", marginBottom: "32px", fontSize: "1.05rem" }}>
              {activeIntent === "GUIDES_EXPERIENCES"
                ? "Find local guides and experiences for your destination."
                : "Provide the details below to construct your verified handoff."}
            </p>

            <form style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

              {/* Conditional Inputs based on Intent */}

              {(activeIntent === "FLIGHTS" || activeIntent === "TRAINS" || activeIntent === "LOCAL_TRANSPORT") && (
                <div>
                  <label style={{ display: "block", fontSize: "0.9rem", fontWeight: 600, marginBottom: "8px" }}>From</label>
                  <input
                    type="text"
                    value={origin}
                    onChange={(e) => setOrigin(e.target.value)}
                    placeholder="City or Airport"
                    style={{ width: "100%", padding: "14px", borderRadius: "10px", border: "1px solid var(--color-border-subtle)", fontSize: "1rem" }}
                  />
                </div>
              )}

              {activeIntent !== "LOCAL_TRANSPORT" && (
                <div>
                  <label style={{ display: "block", fontSize: "0.9rem", fontWeight: 600, marginBottom: "8px" }}>
                    {activeIntent === "TEMPLE_DARSHAN" ? "Temple / Shrine Location" : "Destination"}
                  </label>
                  <input
                    type="text"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    placeholder="City, State, or Region"
                    style={{ width: "100%", padding: "14px", borderRadius: "10px", border: "1px solid var(--color-border-subtle)", fontSize: "1rem" }}
                  />
                </div>
              )}

              {activeIntent === "LOCAL_TRANSPORT" && (
                <div>
                  <label style={{ display: "block", fontSize: "0.9rem", fontWeight: 600, marginBottom: "8px" }}>Drop-off</label>
                  <input
                    type="text"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    placeholder="Destination"
                    style={{ width: "100%", padding: "14px", borderRadius: "10px", border: "1px solid var(--color-border-subtle)", fontSize: "1rem" }}
                  />
                </div>
              )}

              {(activeIntent === "FLIGHTS" || activeIntent === "STAYS" || activeIntent === "TRAINS") && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.9rem", fontWeight: 600, marginBottom: "8px" }}>
                      {activeIntent === "STAYS" ? "Check-in" : "Departure"}
                    </label>
                    <input
                      type="date"
                      min={minDateStr}
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      style={{ width: "100%", padding: "14px", borderRadius: "10px", border: "1px solid var(--color-border-subtle)", fontSize: "1rem" }}
                    />
                  </div>
                  {(activeIntent === "FLIGHTS" || activeIntent === "STAYS") && (
                    <div>
                      <label style={{ display: "block", fontSize: "0.9rem", fontWeight: 600, marginBottom: "8px" }}>
                        {activeIntent === "STAYS" ? "Check-out" : "Return (Optional)"}
                      </label>
                      <input
                        type="date"
                        min={startDate || minDateStr}
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        style={{ width: "100%", padding: "14px", borderRadius: "10px", border: "1px solid var(--color-border-subtle)", fontSize: "1rem" }}
                      />
                    </div>
                  )}
                </div>
              )}

              {(activeIntent === "FLIGHTS" || activeIntent === "STAYS" || activeIntent === "TRAINS") && (
                <div>
                  <label style={{ display: "block", fontSize: "0.9rem", fontWeight: 600, marginBottom: "8px" }}>Travellers / Guests</label>
                  <select
                    value={travellers}
                    onChange={(e) => setTravellers(e.target.value)}
                    style={{ width: "100%", padding: "14px", borderRadius: "10px", border: "1px solid var(--color-border-subtle)", fontSize: "1rem", background: "white" }}
                  >
                    {[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              )}

              <div style={{ marginTop: "16px", paddingTop: "24px", borderTop: "1px solid var(--color-border-subtle)" }}>
                {activeIntent === "GUIDES_EXPERIENCES" && destination && !getTourHQUrl(destination) && (
                  <p style={{ textAlign: "center", fontSize: "0.9rem", color: "var(--color-text-secondary)", marginBottom: "16px", padding: "12px", background: "var(--color-bg-canvas)", borderRadius: "8px", border: "1px dashed var(--color-border-subtle)" }}>
                    TourHQ guides aren't mapped for this destination yet.
                  </p>
                )}
                <a
                  href={buildHandoffUrl()}
                  target={buildHandoffUrl() === "#" ? undefined : "_blank"}
                  rel={buildHandoffUrl() === "#" ? undefined : "noopener noreferrer"}
                  onClick={(e) => { if (buildHandoffUrl() === "#") e.preventDefault(); }}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "center",
                    background: (activeIntent === "GUIDES_EXPERIENCES" && destination && !getTourHQUrl(destination))
                      ? "var(--color-bg-canvas, #FAF7F2)"
                      : "var(--color-accent, #C88E44)",
                    color: (activeIntent === "GUIDES_EXPERIENCES" && destination && !getTourHQUrl(destination))
                      ? "var(--color-text-primary, #2D1B14)"
                      : "#ffffff",
                    border: (activeIntent === "GUIDES_EXPERIENCES" && destination && !getTourHQUrl(destination))
                      ? "1px solid var(--color-border-subtle)"
                      : "none",
                    padding: "16px",
                    borderRadius: "12px",
                    fontSize: "1.1rem",
                    fontWeight: 800,
                    textDecoration: "none",
                    boxShadow: (activeIntent === "GUIDES_EXPERIENCES" && destination && !getTourHQUrl(destination))
                      ? "none"
                      : "0 4px 14px rgba(200, 142, 68, 0.3)",
                    opacity: buildHandoffUrl() === "#" ? 0.6 : 1,
                    cursor: buildHandoffUrl() === "#" ? "not-allowed" : "pointer"
                  }}
                >
                  {activeIntent === "GUIDES_EXPERIENCES" && !destination
                    ? "Enter destination to continue"
                    : `Continue to ${getProviderName()} ↗`}
                </a>
                <p style={{ textAlign: "center", fontSize: "0.8rem", color: "var(--color-text-muted)", marginTop: "12px" }}>
                  Booking is completed securely on the official provider's website.
                </p>
              </div>

            </form>
          </div>

          {/* Destination Specific Recommendations */}
          {activeEssentials && (
            <div style={{
              marginTop: "32px",
              padding: "24px",
              background: "var(--color-bg-canvas, #FAF7F2)",
              borderRadius: "16px",
              border: "1px solid var(--color-border-subtle)"
            }}>
              <h4 style={{ fontSize: "0.8rem", fontWeight: 800, letterSpacing: "0.05em", color: "var(--color-text-secondary)", marginBottom: "8px" }}>
                {activeEssentials.title}
              </h4>
              <p style={{ fontSize: "0.95rem", color: "var(--color-text-primary)", marginBottom: "16px" }}>
                {activeEssentials.description}
              </p>
              <a
                href={activeEssentials.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-block",
                  padding: "10px 20px",
                  border: "1px solid var(--color-accent, #C88E44)",
                  color: "var(--color-accent, #C88E44)",
                  borderRadius: "8px",
                  fontSize: "0.9rem",
                  fontWeight: 700,
                  textDecoration: "none"
                }}
              >
                Visit {activeEssentials.provider} ↗
              </a>
            </div>
          )}

        </section>
      )}
    </main>
  );
}

export default function BookingsPage() {
  return (
    <React.Suspense fallback={<div className="container py-20 text-center" style={{ minHeight: "100vh" }}>Loading booking details...</div>}>
      <BookingsContent />
    </React.Suspense>
  );
}
