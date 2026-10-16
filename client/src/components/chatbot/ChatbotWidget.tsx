import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUp, BedDouble, ChevronRight, MapPin, Navigation, Star, X } from 'lucide-react';
import { chatbotApi, type UserLocationParam } from '@/api/chatbot';
import { cn, formatCurrency } from '@/lib/utils';
import type { ChatbotMessage, PGListing } from '@/types';
import { AneiAvatar } from './AneiAvatar';

// Quick questions (the server reads "near me", "4+ star" and amenity names out of these)
const SUGGESTED_PROMPTS = ['Find PGs near me', 'Near me with 4+ star reviews', 'Near me with WiFi & AC'];

export function ChatbotWidget() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [userLocation, setUserLocation] = useState<UserLocationParam | null>(null);
  const [locatingStatus, setLocatingStatus] = useState<'idle' | 'locating' | 'ready' | 'error'>('idle');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasLocated = useRef(false);

  // ── Location Detection — Same logic as HomePage ─────────────────────────────
  const detectLocation = useCallback(async () => {
    if (!navigator.geolocation) return;
    setLocatingStatus('locating');

    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const { latitude: lat, longitude: lng } = coords;
        let city = '';
        let area = '';

        try {
          const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string;
          if (apiKey && apiKey !== 'YOUR_GOOGLE_MAPS_API_KEY_HERE') {
            const res = await fetch(
              `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&result_type=locality|sublocality&key=${apiKey}`
            );
            const data = await res.json();
            const comps = data.results?.[0]?.address_components ?? [];
            city = comps.find((c: { types: string[] }) => c.types.includes('locality'))?.long_name ?? '';
            area = comps.find((c: { types: string[] }) => c.types.includes('sublocality_level_1'))?.long_name ?? '';
          }

          // Fallback: Nominatim reverse geocoding
          if (!city) {
            const res = await fetch(
              `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
              { headers: { 'Accept-Language': 'en' } }
            );
            const data = await res.json();
            city = data.address?.city || data.address?.town || data.address?.village || '';
            area = data.address?.suburb || data.address?.neighbourhood || '';
          }
        } catch {
          // ignore geocode error
        }

        const loc = { lat, lng, city: city || undefined, area: area || undefined };
        setUserLocation(loc);
        setLocatingStatus('ready');
      },
      () => {
        setLocatingStatus('error');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  useEffect(() => {
    if (isOpen && !hasLocated.current) {
      hasLocated.current = true;
      detectLocation();
    }
  }, [isOpen, detectLocation]);

  const [messages, setMessages] = useState<ChatbotMessage[]>([
    {
      id: 'welcome',
      sender: 'bot',
      text: "Hi, I'm Anei. Tell me what you're looking for, like a budget, an area or WiFi, and I'll find places that fit.",
      timestamp: new Date(),
    },
  ]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen, isLoading]);

  const handleSend = async (userText?: string) => {
    const textToSend = userText || input;
    if (!textToSend.trim() || isLoading) return;

    const userMsg: ChatbotMessage = {
      id: crypto.randomUUID(),
      sender: 'user',
      text: textToSend.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!userText) setInput('');
    setIsLoading(true);

    try {
      const history = messages
        .filter((m) => m.id !== 'welcome')
        .map((m) => ({ role: m.sender === 'user' ? 'user' : 'model', text: m.text }));

      const res = await chatbotApi.getRecommendations(textToSend, history, userLocation);

      const botMsg: ChatbotMessage = {
        id: crypto.randomUUID(),
        sender: 'bot',
        text: res.data?.reply || 'Here’s what I found:',
        recommendations: res.data?.recommendations || [],
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          sender: 'bot',
          text: 'Sorry, I couldn’t search just now. Try again in a moment, or use the search bar on the page.',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Quick questions only make sense before the conversation gets going
  const showPrompts = messages.length <= 3 && !isLoading;

  return (
    <div className="font-display text-ink">
      {/* Launcher */}
      <button
        id="chatbot-trigger-btn"
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={isOpen ? 'Close chat' : 'Ask Anei'}
        aria-expanded={isOpen}
        className={cn(
          'group fixed bottom-6 right-4 z-50 flex h-14 items-center gap-2.5 rounded-full border border-black/[0.06] bg-white p-1.5 shadow-[0_18px_40px_-16px_rgba(17,17,17,0.45)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_22px_46px_-16px_rgba(17,17,17,0.5)] active:scale-95 sm:right-6',
          isOpen ? 'pr-1.5' : 'pr-1.5 sm:pr-5'
        )}
      >
        {isOpen ? (
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-ink text-white">
            <X className="h-5 w-5 transition-transform duration-300 group-hover:rotate-90" />
          </span>
        ) : (
          <>
            <AneiAvatar className="h-11 w-11 transition-transform duration-300 group-hover:-rotate-6" />
            <span className="hidden text-sm font-medium sm:inline">Ask Anei</span>
          </>
        )}
      </button>

      {/* Chat window */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Chat with Anei"
          className="fixed bottom-24 right-4 z-50 flex h-[560px] max-h-[calc(100dvh-8rem)] w-[calc(100vw-2rem)] max-w-[400px] origin-bottom-right animate-fade-in flex-col overflow-hidden rounded-[28px] border border-black/[0.06] bg-white shadow-[0_40px_90px_-30px_rgba(15,23,42,0.4)] sm:right-6"
        >
          {/* Header */}
          <div className="flex items-center gap-3 border-b border-black/[0.06] px-5 py-4">
            <AneiAvatar className="h-10 w-10" />
            <div className="min-w-0 flex-1">
              <h3 className="text-[15px] font-semibold leading-tight">Anei</h3>
              <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                {locatingStatus === 'locating' && <span>Finding your location…</span>}
                {locatingStatus === 'ready' && userLocation && (
                  <>
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    <span className="truncate">
                      {userLocation.area ? `${userLocation.area}, ` : ''}
                      {userLocation.city || 'Near you'}
                    </span>
                  </>
                )}
                {locatingStatus !== 'locating' && locatingStatus !== 'ready' && (
                  <button type="button" onClick={detectLocation} className="flex items-center gap-1 hover:text-ink">
                    <Navigation className="h-3 w-3" />
                    <span className="underline-offset-2 hover:underline">Use my location</span>
                  </button>
                )}
              </div>
            </div>
            <button
              type="button"
              aria-label="Close chat"
              onClick={() => setIsOpen(false)}
              className="flex h-9 w-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface hover:text-ink"
            >
              <X className="h-[18px] w-[18px]" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-5">
            {messages.map((m) => (
              <div key={m.id} className={cn('flex animate-fade-in gap-2.5', m.sender === 'user' ? 'justify-end' : 'justify-start')}>
                {m.sender === 'bot' && <AneiAvatar className="mt-0.5 h-7 w-7" still />}

                <div className={cn('max-w-[82%] space-y-2', m.sender === 'user' && 'flex flex-col items-end')}>
                  <div
                    className={cn(
                      'rounded-[20px] px-4 py-2.5 text-[13.5px] leading-relaxed',
                      m.sender === 'user' ? 'rounded-br-md bg-ink text-white' : 'rounded-bl-md bg-surface'
                    )}
                  >
                    {m.text.split('\n').map((line, i) => (
                      <p key={i} className={i > 0 ? 'mt-1' : ''}>
                        {line.replace(/\*\*(.*?)\*\*/g, '$1')}
                      </p>
                    ))}
                  </div>

                  {/* Places Anei found */}
                  {m.recommendations && m.recommendations.length > 0 && (
                    <div className="space-y-2 pt-1">
                      {m.recommendations.map((pg: PGListing) => (
                        <button
                          key={pg._id}
                          type="button"
                          onClick={() => {
                            setIsOpen(false);
                            navigate(`/pg/${pg._id}`);
                          }}
                          className="group flex w-full items-center gap-3 rounded-2xl border border-black/[0.06] bg-white p-2 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_30px_-18px_rgba(17,17,17,0.4)]"
                        >
                          <div className="h-14 w-16 shrink-0 overflow-hidden rounded-xl bg-surface">
                            {pg.images?.[0] ? (
                              <img
                                src={pg.images[0].url}
                                alt=""
                                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-muted">
                                <BedDouble className="h-5 w-5" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[13px] font-semibold">{pg.title}</p>
                            <p className="mt-0.5 flex items-center gap-1 truncate text-[11.5px] text-muted">
                              <MapPin className="h-3 w-3 shrink-0" />
                              <span className="truncate">
                                {pg.location.address}, {pg.location.city}
                              </span>
                            </p>
                            <p className="mt-1 flex items-center gap-2 text-xs">
                              <span className="font-semibold text-accent">{formatCurrency(pg.rent)}/mo</span>
                              {pg.ratingAverage ? (
                                <span className="flex items-center gap-0.5">
                                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                                  {pg.ratingAverage.toFixed(1)}
                                </span>
                              ) : null}
                            </p>
                          </div>
                          <ChevronRight className="h-4 w-4 shrink-0 text-muted transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-ink" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex animate-fade-in items-center gap-2.5">
                <AneiAvatar className="h-7 w-7" still />
                <div className="flex items-center gap-1 rounded-[20px] rounded-bl-md bg-surface px-4 py-3.5" aria-label="Anei is looking">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="typing-dot h-1.5 w-1.5 rounded-full bg-ink" style={{ animationDelay: `${i * 150}ms` }} />
                  ))}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick questions */}
          {showPrompts && (
            <div className="scrollbar-hide flex gap-2 overflow-x-auto px-4 pb-3">
              {SUGGESTED_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => handleSend(prompt)}
                  className="shrink-0 rounded-full border border-black/[0.08] bg-white px-3.5 py-2 text-[12.5px] font-medium transition-all hover:border-ink hover:bg-ink hover:text-white active:scale-95"
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="border-t border-black/[0.06] p-3"
          >
            <div className="flex items-center gap-2 rounded-2xl bg-surface p-1.5 pl-4 transition-all focus-within:bg-white focus-within:ring-4 focus-within:ring-black/[0.04] focus-within:[box-shadow:inset_0_0_0_1px_rgba(0,0,0,0.1)]">
              <input
                id="chatbot-input"
                type="text"
                placeholder="e.g. PG under 6000 with WiFi"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={isLoading}
                className="min-w-0 flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-muted/80"
              />
              <button
                type="submit"
                aria-label="Send"
                disabled={!input.trim() || isLoading}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-ink text-white transition-all hover:bg-black/85 active:scale-90 disabled:opacity-30"
              >
                <ArrowUp className="h-4 w-4" />
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
