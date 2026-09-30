import React, { useState, useEffect, useRef } from 'react';
import { Wrench, Send, Paperclip, AlertTriangle, Calendar, CheckCircle2, User, Bot, X, Search, FileText } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

const API_BASE = 'http://localhost:8000/api';


export default function App() {
  const [sessionId, setSessionId] = useState(localStorage.getItem('mechanic_session_id') || '');
  const [apiStatus, setApiStatus] = useState({ gemini_configured: false, status: 'checking' });
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'bot',
      text: "Hello! I'm your Senior AI Car Mechanic. What year, make, and model is your vehicle, and what symptoms or noises are you noticing?",
      media_url: null,
      media_type: 'none'
    }
  ]);
  const [input, setInput] = useState('');
  const [mediaFile, setMediaFile] = useState(null); // { url, type, name }
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/status/`)
      .then((res) => res.json())
      .then((data) => setApiStatus(data))
      .catch(() => setApiStatus({ gemini_configured: false, status: 'offline' }));
  }, []);

  
  // Diagnosis state
  const [diagnosis, setDiagnosis] = useState(null);
  
  // Booking Modal State
  const todayStr = new Date().toISOString().split('T')[0];
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [bookingForm, setBookingForm] = useState({
    name: '',
    phone: '',
    car: '',
    date: todayStr,
    timeSlot: '10:00 AM - 12:00 PM'
  });
  const [bookingConfirmed, setBookingConfirmed] = useState(null);


  // Booking Lookup State
  const [lookupId, setLookupId] = useState('');
  const [lookupResult, setLookupResult] = useState(null);
  const [showLookupModal, setShowLookupModal] = useState(false);

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, diagnosis]);

  // Handle file upload to backend
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setUploading(true);
    try {
      const res = await fetch(`${API_BASE}/upload/`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        setMediaFile({
          url: data.media_url,
          type: data.media_type,
          name: data.filename
        });
      }
    } catch (err) {
      alert('File upload failed: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  // Send message
  const sendMessage = async (overrideText = null) => {
    const textToSend = overrideText !== null ? overrideText : input.trim();
    if (!textToSend && !mediaFile) return;

    const userMsg = {
      id: Date.now(),
      sender: 'user',
      text: textToSend,
      media_url: mediaFile ? mediaFile.url : null,
      media_type: mediaFile ? mediaFile.type : 'none'
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!overrideText) setInput('');
    const currentMedia = mediaFile;
    setMediaFile(null);
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/chat/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          message: textToSend,
          media_url: currentMedia ? currentMedia.url : null,
          media_type: currentMedia ? currentMedia.type : 'none'
        })
      });
      const data = await res.json();
      if (res.ok) {
        if (!sessionId && data.session_id) {
          setSessionId(data.session_id);
          localStorage.setItem('mechanic_session_id', data.session_id);
        }
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + 1,
            sender: 'bot',
            text: data.reply,
            media_url: null,
            media_type: 'none'
          }
        ]);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: 'bot',
          text: 'Unable to reach backend server. Please check your connection.',
          media_url: null,
          media_type: 'none'
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Trigger Diagnosis
  const handleRequestDiagnosis = async () => {
    if (!sessionId) {
      alert('Please send at least one query about your vehicle first.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/diagnosis/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId })
      });
      const data = await res.json();
      if (res.ok && data.diagnosis) {
        setDiagnosis(data.diagnosis);
        setBookingForm((prev) => ({
          ...prev,
          car: prev.car || '2022 Vehicle Model'
        }));
      } else {
        alert(data.error || 'Failed to generate diagnosis.');
      }
    } catch (err) {
      alert('Diagnosis request failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Submit Mechanic Booking
  const handleBookingSubmit = async (e) => {
    e.preventDefault();
    if (!bookingForm.name || !bookingForm.phone || !bookingForm.car || !bookingForm.date) {
      alert('Please fill in all required booking fields.');
      return;
    }

    const fullBookingDate = `${bookingForm.date} (${bookingForm.timeSlot || '10:00 AM'})`;

    try {
      const res = await fetch(`${API_BASE}/booking/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          customer_name: bookingForm.name,
          customer_phone: bookingForm.phone,
          car_model: bookingForm.car,
          service_requested: diagnosis ? diagnosis.recommended_service : 'General Vehicle Diagnostics & Repair',
          booking_date: fullBookingDate
        })
      });
      const data = await res.json();
      if (res.ok) {
        setBookingConfirmed(data.booking);
      } else {
        alert(data.error || 'Booking failed.');
      }
    } catch (err) {
      alert('Booking failed: ' + err.message);
    }
  };


  // Lookup Booking by ID
  const handleLookup = async (e) => {
    e.preventDefault();
    if (!lookupId.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/booking/${lookupId.trim()}/`);
      const data = await res.json();
      if (res.ok) {
        setLookupResult(data);
      } else {
        setLookupResult({ error: 'Booking ID not found.' });
      }
    } catch (err) {
      setLookupResult({ error: 'Failed to fetch booking details.' });
    }
  };

  return (
    <div className="app-container">
      {/* App Header */}
      <header className="app-header">
        <div className="brand">
          <div className="brand-icon">
            <Wrench size={22} />
          </div>
          <div>
            <div className="brand-title">MechanicAI</div>
            <div className="brand-subtitle">Virtual Senior Auto Technician</div>
          </div>
        </div>
        <div className="header-actions">
          <div className="badge" style={apiStatus.gemini_configured ? { background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', borderColor: 'rgba(56, 189, 248, 0.3)' } : {}}>
            <span className="dot" style={apiStatus.gemini_configured ? { background: '#38bdf8', boxShadow: '0 0 8px #38bdf8' } : {}}></span> 
            {apiStatus.gemini_configured ? '✨ Gemini AI Connected' : '⚙️ Rule-Based Technician Engine'}
          </div>
          <button className="action-btn" onClick={() => setShowLookupModal(true)} title="Check Booking Status">
            <Search size={18} />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="main-content">
        <div className="chat-section">
          {/* Chat Messages */}
          <div className="chat-messages">
            {messages.map((msg) => (
              <div key={msg.id} className={`message-wrapper ${msg.sender}`}>
                <div className={`avatar ${msg.sender}`}>
                  {msg.sender === 'user' ? <User size={18} /> : <Bot size={18} />}
                </div>
                <div className="message-content">
                  <div className="message-bubble">
                    {msg.text ? (
                      <div className="markdown-content">
                        <ReactMarkdown>{msg.text}</ReactMarkdown>
                      </div>
                    ) : null}


                    {/* Media render */}
                    {msg.media_url && (
                      <div className="media-preview">
                        {!msg.text && (
                          <div style={{ fontSize: '12px', fontWeight: 600, opacity: 0.9, marginBottom: '4px' }}>
                            {msg.media_type === 'audio' ? '🎵 Audio Noise Recording' : msg.media_type === 'image' ? '🖼️ Visual Inspection Photo' : '🎥 Video File'}
                          </div>
                        )}
                        {msg.media_type === 'image' && (
                          <img src={msg.media_url.startsWith('http') ? msg.media_url : `http://localhost:8000${msg.media_url}`} alt="Uploaded inspection file" />
                        )}
                        {msg.media_type === 'audio' && (
                          <audio controls src={msg.media_url.startsWith('http') ? msg.media_url : `http://localhost:8000${msg.media_url}`} style={{ width: '100%', minWidth: '250px' }} />
                        )}
                        {msg.media_type === 'video' && (
                          <video controls src={msg.media_url.startsWith('http') ? msg.media_url : `http://localhost:8000${msg.media_url}`} style={{ width: '100%' }} />
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}


            {/* Diagnosis Card if generated */}
            {diagnosis && (
              <div className="diagnosis-card">
                <div className="diag-header">
                  <AlertTriangle size={18} /> Official Vehicle Diagnostic Report
                </div>
                <div className="diag-item">
                  <span className="diag-label">Issue Summary: </span>{diagnosis.issue_summary}
                </div>
                <div className="diag-item">
                  <span className="diag-label">Probable Root Cause: </span>{diagnosis.root_cause}
                </div>
                <div className="diag-item">
                  <span className="diag-label">Recommended Repair: </span><strong>{diagnosis.recommended_service}</strong>
                </div>
                <div className="diag-item">
                  <span className="diag-label">Est. Cost Range: </span>{diagnosis.estimated_cost}
                </div>
                <button className="btn-book" onClick={() => setShowBookingModal(true)}>
                  <Calendar size={16} /> Book Certified Mechanic Now
                </button>
              </div>
            )}

            {loading && (
              <div className="message-wrapper bot">
                <div className="avatar bot"><Bot size={18} /></div>
                <div className="message-bubble">Mechanic is analyzing symptoms...</div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Action Chips & Input Bar */}
          <div className="chat-input-bar">
            {/* Quick Prompts & Diagnosis Action */}
            <div className="quick-actions">
              <button 
                className="quick-chip"
                onClick={() => sendMessage("My brakes are squeaking when I stop.")}
              >
                🔊 Brake Noise
              </button>
              <button 
                className="quick-chip"
                onClick={() => sendMessage("Engine is smoking and overheating.")}
              >
                🔥 Engine Overheat
              </button>
              <button 
                className="quick-chip"
                onClick={() => sendMessage("Car clicks but won't start.")}
              >
                ⚡ Battery / Starter
              </button>
              <button 
                className="quick-chip" 
                style={{ borderColor: '#f97316', color: '#f97316' }}
                onClick={handleRequestDiagnosis}
              >
                📋 Generate Diagnosis Report
              </button>
            </div>

            {/* Attached Media Chip */}
            {mediaFile && (
              <div className="media-chip">
                <span>Attached: {mediaFile.name} ({mediaFile.type})</span>
                <span className="chip-remove" onClick={() => setMediaFile(null)}><X size={14} /></span>
              </div>
            )}

            {/* Input Controls */}
            <div className="input-controls">
              <input 
                type="file" 
                ref={fileInputRef} 
                style={{ display: 'none' }} 
                accept="image/*,audio/*,video/*"
                onChange={handleFileChange}
              />
              <button 
                className="action-btn" 
                onClick={() => fileInputRef.current.click()}
                disabled={uploading}
                title="Attach Image / Audio / Video"
              >
                <Paperclip size={18} />
              </button>
              <input 
                type="text" 
                className="chat-input"
                placeholder="Describe your car problem or noise..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              />
              <button 
                className="action-btn send" 
                onClick={() => sendMessage()}
                disabled={loading}
              >
                <Send size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mechanic Booking Modal */}
      {showBookingModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <div className="modal-title">Book Mechanic Repair Service</div>
              <button className="modal-close" onClick={() => { setShowBookingModal(false); setBookingConfirmed(null); }}>
                <X size={20} />
              </button>
            </div>

            {bookingConfirmed ? (
              <div className="booking-success-box">
                <div className="success-icon">
                  <CheckCircle2 size={30} />
                </div>
                <h3>Booking Confirmed!</h3>
                <p style={{ color: '#94a3b8', fontSize: '13px', margin: '8px 0 16px 0' }}>
                  A technician is assigned to your vehicle service.
                </p>
                <div style={{ background: '#0f172a', padding: '12px', borderRadius: '8px', textAlign: 'left', fontSize: '13px' }}>
                  <div><strong>Booking ID:</strong> {bookingConfirmed.booking_id}</div>
                  <div><strong>Name:</strong> {bookingConfirmed.customer_name}</div>
                  <div><strong>Service:</strong> {bookingConfirmed.service_requested}</div>
                  <div><strong>Date:</strong> {bookingConfirmed.booking_date}</div>
                  <div><strong>Status:</strong> <span style={{ color: '#22c55e' }}>{bookingConfirmed.status}</span></div>
                </div>
                <button className="btn-submit" style={{ marginTop: '16px' }} onClick={() => { setShowBookingModal(false); setBookingConfirmed(null); }}>
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={handleBookingSubmit}>
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    required 
                    placeholder="John Doe"
                    value={bookingForm.name}
                    onChange={(e) => setBookingForm({ ...bookingForm, name: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone Number</label>
                  <input 
                    type="tel" 
                    className="form-input" 
                    required 
                    placeholder="+1 (555) 019-2834"
                    value={bookingForm.phone}
                    onChange={(e) => setBookingForm({ ...bookingForm, phone: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Car Model & Year</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    required 
                    placeholder="2021 Honda Civic"
                    value={bookingForm.car}
                    onChange={(e) => setBookingForm({ ...bookingForm, car: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Preferred Appointment Date</label>
                  <input 
                    type="date" 
                    className="form-input" 
                    required 
                    min={todayStr}
                    value={bookingForm.date}
                    onChange={(e) => setBookingForm({ ...bookingForm, date: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Preferred Time Slot</label>
                  <select
                    className="form-input"
                    required
                    value={bookingForm.timeSlot}
                    onChange={(e) => setBookingForm({ ...bookingForm, timeSlot: e.target.value })}
                  >
                    <option value="10:00 AM - 12:00 PM">10:00 AM - 12:00 PM (Morning)</option>
                    <option value="12:00 PM - 02:00 PM">12:00 PM - 02:00 PM (Afternoon)</option>
                    <option value="02:00 PM - 04:00 PM">02:00 PM - 04:00 PM (Afternoon)</option>
                    <option value="04:00 PM - 06:00 PM">04:00 PM - 06:00 PM (Evening)</option>
                  </select>
                </div>

                <button type="submit" className="btn-submit">
                  Confirm Mechanic Reservation
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Booking Lookup Modal */}
      {showLookupModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <div className="modal-title">Check Booking Details</div>
              <button className="modal-close" onClick={() => { setShowLookupModal(false); setLookupResult(null); }}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleLookup}>
              <div className="form-group">
                <label className="form-label">Enter Booking UUID</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
                  value={lookupId}
                  onChange={(e) => setLookupId(e.target.value)}
                />
              </div>
              <button type="submit" className="btn-submit" style={{ background: '#0284c7' }}>
                Search Booking
              </button>
            </form>

            {lookupResult && (
              <div style={{ marginTop: '16px', background: '#0f172a', padding: '12px', borderRadius: '8px', fontSize: '13px' }}>
                {lookupResult.error ? (
                  <div style={{ color: '#ef4444' }}>{lookupResult.error}</div>
                ) : (
                  <div>
                    <div><strong>Customer:</strong> {lookupResult.customer_name}</div>
                    <div><strong>Vehicle:</strong> {lookupResult.car_model}</div>
                    <div><strong>Service:</strong> {lookupResult.service_requested}</div>
                    <div><strong>Date:</strong> {lookupResult.booking_date}</div>
                    <div><strong>Status:</strong> <span style={{ color: '#22c55e' }}>{lookupResult.status}</span></div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
